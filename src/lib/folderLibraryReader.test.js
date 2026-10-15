import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, lstat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFolderLibrary } from './folderLibraryReader.node.js';

async function fixture(t) {
  const base = await mkdtemp(path.join(tmpdir(), 'folder-library-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'library');
  await mkdir(path.join(root, 'metadata'), { recursive: true });
  const items = ['original', 'preview-fallback', null].map((kind, index) => {
    const itemUuid = `uuid-${index}`;
    const legacyId = `legacy-${index}`;
    const assets = {};
    if (kind) for (const variant of ['image', 'image-thumbs', 'image-thumbs-mobile']) {
      assets[variant] = { path: `public/${variant}/Été People/image ${index}.jpg`, byteSize: 3,
        ...(variant === 'image' ? { kind } : {}) };
    }
    return { itemUuid, legacyId, tags: ['people/aapo', 'brand/test'], assets,
      sourceMetadata: { id: legacyId, itemUuid, arbitrary: { nested: ['keep', 42] } }, futureField: true };
  });
  const manifest = { version: 1, itemCount: 3, originals: 1, previewFallbacks: 1,
    metadataOnly: 1, desktopThumbnails: 2, mobileThumbnails: 2 };
  const appState = { board: { images: [{ referenceId: 'legacy-0', referenceItemUuid: 'uuid-0' }] },
    savedOutfits: [], unknownState: { preserve: true } };
  const save = async () => {
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(root, 'metadata/items.ndjson'), items.map((i) => JSON.stringify(i)).join('\n') + '\n');
    await writeFile(path.join(root, 'metadata/appState.json'), JSON.stringify(appState));
  };
  for (const i of items) for (const asset of Object.values(i.assets)) {
    const file = path.join(root, asset.path);
    await mkdir(path.dirname(file), { recursive: true });
    // Intentionally not real JPEG data: reader must only stat, not decode media.
    await writeFile(file, 'abc');
  }
  await save();
  return { root, base, items, manifest, appState, save };
}

async function treeSnapshot(root) {
  const output = {};
  async function walk(dir) {
    for (const name of (await readdir(dir)).sort()) {
      const file = path.join(dir, name);
      const stat = await lstat(file);
      output[path.relative(root, file)] = { mtimeMs: stat.mtimeMs, mode: stat.mode,
        bytes: stat.isFile() ? (await readFile(file)).toString('base64') : null };
      if (stat.isDirectory()) await walk(file);
    }
  }
  await walk(root);
  return output;
}

test('preserves complete records and state, resolves Unicode paths, distinguishes assets, and makes no writes', async (t) => {
  const f = await fixture(t);
  const before = await treeSnapshot(f.root);
  const snapshot = await readFolderLibrary(f.root);
  assert.deepEqual(snapshot.items, f.items);
  assert.deepEqual(snapshot.appState, f.appState);
  assert.equal(snapshot.assets.length, 6);
  assert.ok(snapshot.assets.every((a) => a.exists && a.actualByteSize === 3 && path.isAbsolute(a.absolutePath)));
  assert.deepEqual(snapshot.inventory, { itemCount: 3, originals: 1, previewFallbacks: 1,
    metadataOnly: 1, desktopThumbnails: 2, mobileThumbnails: 2 });
  assert.equal(snapshot.warnings.filter((w) => w.code === 'ORIGINAL_UNRESOLVED').length, 1);
  assert.deepEqual(await treeSnapshot(f.root), before);
});

test('missing and wrong-sized media produce warnings without dropping records', async (t) => {
  const f = await fixture(t);
  await rm(path.join(f.root, f.items[0].assets.image.path));
  await writeFile(path.join(f.root, f.items[1].assets.image.path), 'larger');
  const s = await readFolderLibrary(f.root);
  assert.equal(s.items.length, 3);
  assert.equal(s.availableAssets.image, 1);
  assert.ok(s.warnings.some((w) => w.code === 'MISSING_ASSET'));
  assert.ok(s.warnings.some((w) => w.code === 'ASSET_SIZE_MISMATCH' && w.actual === 6));
});

test('current and saved board references report missing, stale and conflicting identities', async (t) => {
  const f = await fixture(t);
  f.appState.board.images.push({ referenceId: 'absent' }, { referenceId: 'legacy-0', referenceItemUuid: 'absent' });
  f.appState.savedOutfits.push({ board: { images: [{ referenceId: 'legacy-0', referenceItemUuid: 'uuid-1' }] } });
  await f.save();
  const s = await readFolderLibrary(f.root);
  for (const code of ['UNRESOLVED_BOARD_REFERENCE', 'STALE_BOARD_REFERENCE', 'CONFLICTING_BOARD_REFERENCE']) {
    assert.ok(s.warnings.some((w) => w.code === code));
  }
  assert.deepEqual(s.appState, f.appState);
});

test('rejects duplicate or missing identities and conflicting source identity', async (t) => {
  for (const change of [
    (f) => { f.items[1].itemUuid = f.items[0].itemUuid; },
    (f) => { f.items[1].legacyId = f.items[0].legacyId; },
    (f) => { delete f.items[1].itemUuid; },
    (f) => { f.items[1].sourceMetadata.id = 'different'; }
  ]) {
    const f = await fixture(t); change(f); await f.save();
    await assert.rejects(readFolderLibrary(f.root), /identity/);
  }
});

test('rejects malformed required files and schemas', async (t) => {
  for (const [name, content] of [['manifest.json', '{'], ['metadata/items.ndjson', '{'],
    ['metadata/appState.json', '[]']]) {
    const f = await fixture(t); await writeFile(path.join(f.root, name), content);
    await assert.rejects(readFolderLibrary(f.root), /Malformed|Invalid/);
  }
  const f = await fixture(t); await rm(path.join(f.root, 'metadata/items.ndjson'));
  await assert.rejects(readFolderLibrary(f.root), /Required library file/);
});

test('rejects inconsistent record and variant counts', async (t) => {
  for (const key of ['itemCount', 'originals', 'mobileThumbnails']) {
    const f = await fixture(t); f.manifest[key]++; await f.save();
    await assert.rejects(readFolderLibrary(f.root), /count mismatch/);
  }
});

test('rejects traversal, absolute and Windows paths even when missing', async (t) => {
  for (const unsafe of ['../outside.jpg', '/tmp/outside.jpg', 'C:\\outside.jpg', 'public/../../outside.jpg']) {
    const f = await fixture(t); f.items[0].assets.image.path = unsafe; await f.save();
    await assert.rejects(readFolderLibrary(f.root), /Unsafe library path/);
  }
});

test('rejects existing and dangling symlink escapes including missing children', async (t) => {
  for (const missing of [false, true]) {
    const f = await fixture(t);
    const outside = path.join(f.base, 'outside');
    if (!missing) await mkdir(outside);
    await symlink(outside, path.join(f.root, 'escape'));
    f.items[0].assets.image.path = 'escape/missing.jpg'; await f.save();
    await assert.rejects(readFolderLibrary(f.root), /Symlink escapes/);
  }
});

test('required files cannot escape via symlinks', async (t) => {
  const f = await fixture(t);
  const file = path.join(f.root, 'manifest.json');
  const outside = path.join(f.base, 'manifest.json');
  await writeFile(outside, await readFile(file)); await rm(file); await symlink(outside, file);
  await assert.rejects(readFolderLibrary(f.root), /Symlink escapes/);
});

test('accepts in-root symlinks but rejects loops and escaped preserved previews', async (t) => {
  const f = await fixture(t);
  await symlink('public', path.join(f.root, 'alias'));
  f.items[0].assets.image.path = f.items[0].assets.image.path.replace('public/', 'alias/');
  await f.save(); assert.equal((await readFolderLibrary(f.root)).availableAssets.image, 2);
  f.items[0].preservedPreview = '../outside'; await f.save();
  await assert.rejects(readFolderLibrary(f.root), /Unsafe/);
  delete f.items[0].preservedPreview;
  await symlink('loop', path.join(f.root, 'loop'));
  f.items[0].assets.image.path = 'loop'; await f.save();
  await assert.rejects(readFolderLibrary(f.root), /Symlink loop/);
});

test('CLI accepts an explicit directory and fails clearly for invalid input', async (t) => {
  const f = await fixture(t);
  const output = execFileSync(process.execPath, ['scripts/check-folder-library.mjs', f.root], { encoding: 'utf8' });
  assert.match(output, /Records: 3; originals: 1; preview fallbacks: 1; metadata-only: 1/);
  assert.match(output, /No library or browser data was changed/);
  assert.throws(() => execFileSync(process.execPath, ['scripts/check-folder-library.mjs', f.base], { stdio: 'pipe' }),
    (error) => error.status === 1 && /Library check failed/.test(error.stderr.toString()));
});
