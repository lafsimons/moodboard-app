import { readdir, lstat, open, readFile, mkdir, rename, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { readFolderLibrary, inspectPath } from './folderLibraryReader.node.js';
import { readFolderLibraryEdits, safeTarget, writeExclusive, syncDirectory, MetadataEditError } from './folderLibraryEdits.node.js';

const roots = { image: 'public/images', 'image-thumbs': 'public/image-thumbs', 'image-thumbs-mobile': 'public/image-thumbs-mobile' };
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const folderOf = (filename) => { const folder = path.posix.dirname(filename.slice('public/images/'.length)); return folder === '.' ? '' : folder; };
const group = (items, key) => {
  const result = new Map();
  for (const item of items) { const value = key(item); if (!result.has(value)) result.set(value, []); result.get(value).push(item); }
  return result;
};

async function hashFile(root, filename) {
  const file = await inspectPath(root, filename);
  if (!file.isFile) throw new Error('Image disappeared during sync');
  const before = await lstat(file.absolutePath);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file.absolutePath)) hash.update(chunk);
  const after = await lstat(file.absolutePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) throw new Error('Image changed during sync');
  return { path: filename, sha256: hash.digest('hex'), byteSize: after.size };
}

async function walk(root, directory, issues) {
  const files = [];
  async function visit(relative) {
    const absolute = path.join(root, relative);
    let stat;
    try { stat = await lstat(absolute); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    // Never follow directory symlinks, including in-root links that could create
    // duplicate trees or cycles. inspectPath on each opened file checks ancestors.
    if (stat.isSymbolicLink()) { issues.push({ code: 'SYMLINK_SKIPPED', path: relative }); return; }
    if (stat.isDirectory()) {
      await inspectPath(root, relative);
      for (const entry of (await readdir(absolute)).sort()) {
        await visit(`${relative}/${entry}`);
      }
    } else if (stat.isFile()) {
      if (extensions.has(path.extname(relative).toLowerCase())) files.push(await hashFile(root, relative));
      else if (!path.posix.basename(relative).startsWith('.')) issues.push({ code: 'UNSUPPORTED_FILE', path: relative });
    }
  }
  await visit(directory);
  return files;
}

async function inspectImage(root, file) {
  const inspected = await inspectPath(root, file.path);
  const image = sharp(inspected.absolutePath, { limitInputPixels: 100000000 });
  const info = await image.metadata();
  if (!info.width || !info.height || !['jpeg', 'png', 'webp', 'avif', 'heif', 'gif'].includes(info.format)) throw new Error('Unsupported image');
  await image.stats();
  return { ...file, folder: folderOf(file.path), width: info.autoOrient?.width ?? info.width, height: info.autoOrient?.height ?? info.height };
}

/** Explicit manual scan: hashes media here, never during ordinary catalogue reads. */
export async function scanFolderLibrary(root) {
  const snapshot = await readFolderLibrary(root);
  await readFolderLibraryEdits(snapshot); // refuse to sync a broken metadata overlay
  const issues = [], moves = [], additions = [], updates = [], removals = [], restores = [], scanned = [];
  for (const [variant, directory] of Object.entries(roots)) {
    // An unavailable image tree is not evidence that every image was deleted.
    if (variant === 'image') await safeTarget(snapshot.root, directory, true);
    const files = await walk(snapshot.root, directory, issues);
    scanned.push(...files);
    const byPath = new Map(files.map((file) => [file.path, file]));
    const registered = snapshot.items.filter((item) => item.assets[variant]).map((item) => ({ itemUuid: item.itemUuid, asset: item.assets[variant], deleted: Boolean(item.syncDeletedAt) }));
    const knownHashes = group(registered.filter((entry) => entry.asset.sha256), (entry) => entry.asset.sha256);
    const reserved = new Set(registered.map((entry) => entry.asset.path));
    const candidates = files.filter((file) => !reserved.has(file.path));
    const candidateHashes = group(candidates, (file) => file.sha256);
    const claimed = new Set();
    const missing = [];
    const identityOf = (file) => {
      const stem = path.posix.basename(file.path, path.posix.extname(file.path));
      return registered.find((entry) => stem === entry.itemUuid || stem.endsWith(`--${entry.itemUuid}`))?.itemUuid;
    };
    const restore = (itemUuid) => { if (!restores.includes(itemUuid)) restores.push(itemUuid); };
    const edit = async (entry, file) => {
      claimed.add(file.path);
      try {
        updates.push({ ...await inspectImage(snapshot.root, file), itemUuid: entry.itemUuid, from: entry.asset.path });
        if (entry.deleted) restore(entry.itemUuid);
      } catch { issues.push({ code: 'INVALID_IMAGE', itemUuid: entry.itemUuid, path: file.path }); }
    };
    for (const { itemUuid, asset, deleted } of registered) {
      if (variant !== 'image' && (updates.some((item) => item.itemUuid === itemUuid) || deleted && !restores.includes(itemUuid) || removals.some((item) => item.itemUuid === itemUuid))) continue;
      const current = byPath.get(asset.path);
      if (current) {
        if (!asset.sha256) issues.push({ code: 'UNVERIFIED_FILE', itemUuid, variant, path: asset.path });
        else if (current.sha256 !== asset.sha256) {
          const identified = files.filter((file) => identityOf(file) === itemUuid);
          if (variant === 'image' && identified.length <= 1 && (!identityOf(current) || identityOf(current) === itemUuid)) await edit({ itemUuid, asset, deleted }, current);
          else issues.push({ code: 'CHANGED_FILE', itemUuid, variant, path: asset.path });
        }
        else if (deleted && variant === 'image') restore(itemUuid);
        continue;
      }
      missing.push({ itemUuid, asset, deleted });
    }
    // Resolve explicit UUIDs first so a surviving identical copy cannot be
    // assigned to a different deleted record through its content hash.
    const resolved = new Set();
    const move = (entry, file) => {
      moves.push({ itemUuid: entry.itemUuid, variant, from: entry.asset.path, to: file.path });
      claimed.add(file.path); resolved.add(entry.itemUuid);
      if (entry.deleted && variant === 'image') restore(entry.itemUuid);
    };
    for (const entry of missing) {
      const identified = candidates.filter((file) => identityOf(file) === entry.itemUuid);
      if (identified.length === 1 && files.filter((file) => identityOf(file) === entry.itemUuid).length === 1) {
        if (identified[0].sha256 === entry.asset.sha256) move(entry, identified[0]);
        else if (variant === 'image') { await edit(entry, identified[0]); resolved.add(entry.itemUuid); }
      }
    }
    for (const entry of missing) {
      if (resolved.has(entry.itemUuid)) continue;
      const { itemUuid, asset, deleted } = entry;
      const matches = (candidateHashes.get(asset.sha256) ?? []).filter((file) => !claimed.has(file.path) && (!identityOf(file) || identityOf(file) === itemUuid));
      const identified = files.filter((file) => identityOf(file) === itemUuid);
      if (matches.length === 1 && knownHashes.get(asset.sha256)?.length === 1) {
        move(entry, matches[0]);
      } else if (variant === 'image' && !deleted && !matches.length && !identified.length && asset.path.startsWith('public/images/') && asset.sha256 &&
        !(await inspectPath(snapshot.root, asset.path)).exists && !issues.some((issue) => issue.code === 'SYMLINK_SKIPPED' || identityOf(issue) === itemUuid)) {
        removals.push({ itemUuid, path: asset.path, name: snapshot.items.find((item) => item.itemUuid === itemUuid).name });
      } else if (!deleted) {
        issues.push({ code: matches.length || identified.length ? 'AMBIGUOUS_MOVE' : 'MISSING_FILE', itemUuid, variant, path: asset.path });
      }
    }
    if (variant !== 'image') continue;
    for (const file of candidates) {
      if (claimed.has(file.path)) continue;
      if (identityOf(file) || knownHashes.has(file.sha256) || candidateHashes.get(file.sha256).length > 1) {
        issues.push({ code: 'DUPLICATE_OR_AMBIGUOUS', path: file.path }); continue;
      }
      try {
        additions.push(await inspectImage(snapshot.root, file));
      } catch { issues.push({ code: 'INVALID_IMAGE', path: file.path }); }
    }
  }
  const revision = digest(JSON.stringify({ base: snapshot.baseRevision, catalogue: snapshot.catalogueRevision, scanned, issues, removals, restores, moves, updates }));
  return { snapshot, revision, moves, additions, updates, removals, restores, issues };
}

export function syncPreview(plan) {
  return { revision: plan.revision, moves: plan.moves, updates: plan.updates.map(({ itemUuid, from, path, width, height }) => ({ itemUuid, from, path, width, height })), removals: plan.removals, restores: plan.restores, additions: plan.additions.map(({ path, folder }) => ({ path, folder })), issues: plan.issues };
}

async function ensureDirectory(root, relative) {
  let current = '';
  for (const segment of relative.split('/')) {
    if (!segment || segment === '.' || segment === '..') throw new Error('Unsafe output directory');
    current = current ? `${current}/${segment}` : segment;
    const target = await safeTarget(root, current, true, true);
    await mkdir(target, { recursive: true });
    await safeTarget(root, current, true);
  }
}

export async function applyFolderLibrarySync(root, revision) {
  const initial = await readFolderLibrary(root);
  await safeTarget(initial.root, 'metadata', true);
  const lockPath = await safeTarget(initial.root, 'metadata/edits.lock', false, true);
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') throw new MetadataEditError(423, 'Another save or sync is running. Try again shortly.');
    throw error;
  }
  const generated = [];
  let temporary, committed = false;
  try {
    const plan = await scanFolderLibrary(initial.root);
    if (plan.revision !== revision) throw new MetadataEditError(409, 'Files or the catalogue changed after the scan. Scan again before applying.');
    if (!plan.moves.length && !plan.additions.length && !plan.updates.length && !plan.removals.length && !plan.restores.length) return { added: 0, moved: 0, removed: 0, restored: 0, updated: 0 };
    const items = structuredClone(plan.snapshot.items);
    for (const removal of plan.removals) items.find((item) => item.itemUuid === removal.itemUuid).syncDeletedAt = new Date().toISOString();
    for (const itemUuid of plan.restores) delete items.find((item) => item.itemUuid === itemUuid).syncDeletedAt;
    for (const move of plan.moves) {
      const item = items.find((entry) => entry.itemUuid === move.itemUuid);
      item.assets[move.variant].path = move.to;
      if (move.variant === 'image') item.folder = folderOf(move.to);
    }
    for (const addition of [...plan.additions, ...plan.updates]) {
      const existing = addition.itemUuid ? items.find((item) => item.itemUuid === addition.itemUuid) : null;
      const itemUuid = existing?.itemUuid ?? randomUUID(), legacyId = existing?.legacyId ?? `folder-${itemUuid}`;
      const source = await inspectPath(initial.root, addition.path);
      const name = path.posix.basename(addition.path, path.posix.extname(addition.path));
      const { folder, itemUuid: ignoredUuid, from: ignoredFrom, ...main } = addition;
      const assets = { ...existing?.assets, image: { ...existing?.assets.image, ...main, kind: existing?.assets.image.kind ?? 'original' } };
      const input = await readFile(source.absolutePath);
      if (digest(input) !== addition.sha256) throw new MetadataEditError(409, 'An image changed during sync. Scan again.');
      for (const [variant, size] of [['image-thumbs', 1200], ['image-thumbs-mobile', 560]]) {
        const directory = `${roots[variant]}${folder ? '/' + folder : ''}`;
        await ensureDirectory(initial.root, directory);
        const filename = `${directory}/${existing ? randomUUID() + '--' : ''}${itemUuid}.webp`;
        const target = await safeTarget(initial.root, filename, false, true);
        const { data, info } = await sharp(input, { limitInputPixels: 100000000 }).autoOrient().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
        // Record only files this operation created; never remove someone else's file.
        const handle = await open(target, 'wx', 0o600); generated.push(target);
        try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
        await syncDirectory(path.dirname(target));
        assets[variant] = { path: filename, byteSize: data.length, sha256: digest(data), width: info.width, height: info.height };
      }
      if ((await hashFile(initial.root, addition.path)).sha256 !== addition.sha256) throw new MetadataEditError(409, 'An image changed during sync. Scan again.');
      if (existing) { existing.assets = assets; existing.folder = folder; }
      else items.push({ itemUuid, legacyId, name, tags: [], folder, folderReason: 'Manual folder sync', originalStatus: 'available', assets, sourceMetadata: { id: legacyId, itemUuid, name, tags: [], description: '', favorite: false, createdAt: Date.now() } });
    }
    // Revalidate moved files before committing their new locations.
    for (const move of plan.moves) {
      const expected = items.find((item) => item.itemUuid === move.itemUuid).assets[move.variant];
      if ((await hashFile(initial.root, move.to)).sha256 !== expected.sha256) throw new MetadataEditError(409, 'A moved image changed during sync. Scan again.');
    }
    // Also reject files restored while thumbnails were being generated.
    for (const removal of plan.removals) {
      if ((await inspectPath(initial.root, removal.path)).exists) throw new MetadataEditError(409, 'A deleted image reappeared during sync. Scan again.');
    }
    const target = await safeTarget(initial.root, 'metadata/catalogue.json', false, true);
    await ensureDirectory(initial.root, 'metadata/sync-backups');
    const suffix = `${Date.now()}-${randomUUID()}`;
    let previous;
    try { previous = await readFile(target); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      previous = JSON.stringify({ version: 1, baseRevision: plan.snapshot.baseRevision, items: plan.snapshot.items });
    }
    await writeExclusive(path.join(initial.root, 'metadata/sync-backups', `catalogue-${suffix}.json`), previous);
    await syncDirectory(path.join(initial.root, 'metadata/sync-backups'));
    temporary = path.join(initial.root, 'metadata', `.catalogue-${suffix}.tmp`);
    await writeExclusive(temporary, JSON.stringify({ version: 1, baseRevision: plan.snapshot.baseRevision, items }, null, 2) + '\n');
    await safeTarget(initial.root, 'metadata/catalogue.json', false, true);
    await rename(temporary, target); temporary = null; committed = true;
    await syncDirectory(path.dirname(target));
    return { added: plan.additions.length, moved: plan.moves.length, removed: plan.removals.length, restored: plan.restores.length, updated: plan.updates.length };
  } finally {
    try {
      if (temporary) await unlink(temporary).catch(() => {});
      if (!committed) for (const file of generated) await unlink(file).catch(() => {});
    } finally { await lock.close(); await unlink(lockPath); }
  }
}
