import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rename, rm, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { scanFolderLibrary, applyFolderLibrarySync, syncPreview } from './folderLibrarySync.node.js';
import { readFolderLibrary } from './folderLibraryReader.node.js';
import { saveFolderLibraryMetadata, effectiveMetadata, readFolderLibraryEdits } from './folderLibraryEdits.node.js';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'folder-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'metadata'));
  for (const folder of ['images', 'image-thumbs', 'image-thumbs-mobile']) await mkdir(path.join(root, 'public', folder, 'Inbox'), { recursive: true });
  const bytes = await sharp({ create: { width: 1500, height: 1000, channels: 3, background: '#123456' } }).png().toBuffer();
  const assets = {};
  for (const [variant, dir] of [['image', 'images'], ['image-thumbs', 'image-thumbs'], ['image-thumbs-mobile', 'image-thumbs-mobile']]) {
    const filename = `public/${dir}/Inbox/Été image.png`; await writeFile(path.join(root, filename), bytes);
    assets[variant] = { path: filename, byteSize: bytes.length, sha256: hash(bytes), width: 1500, height: 1000, ...(variant === 'image' ? { kind: 'original' } : {}) };
  }
  const item = { itemUuid: 'uuid', legacyId: 'legacy', name: 'Été', tags: ['brand/tt', 'people/aapo'], folder: 'Inbox', assets, sourceMetadata: { id: 'legacy', itemUuid: 'uuid', description: 'Preserved', unknown: { keep: true }, favorite: false } };
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, itemCount: 1, originals: 1, previewFallbacks: 0, metadataOnly: 0, desktopThumbnails: 1, mobileThumbnails: 1 }));
  await writeFile(path.join(root, 'metadata/items.ndjson'), JSON.stringify(item));
  await writeFile(path.join(root, 'metadata/appState.json'), JSON.stringify({ board: { images: [{ referenceItemUuid: 'uuid', referenceId: 'legacy', x: 10, y: 20 }] } }));
  const add = async (filename = 'public/images/Inbox/New 日本.png', color = '#ff0000') => {
    await mkdir(path.dirname(path.join(root, filename)), { recursive: true });
    await writeFile(path.join(root, filename), await sharp({ create: { width: 1600, height: 800, channels: 3, background: color } }).png().toBuffer());
    return filename;
  };
  return { root, item, bytes, add };
}

async function files(root, relative = '') {
  const result = {};
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(result, await files(root, file));
    else if (entry.isFile()) result[file] = hash(await readFile(path.join(root, file)));
  }
  return result;
}

test('scanning is read-only; applies new images with stable identities and correctly sized thumbnails', async (t) => {
  const f = await fixture(t); await f.add();
  const before = await files(f.root);
  const plan = await scanFolderLibrary(f.root);
  assert.equal(plan.additions.length, 1); assert.equal(plan.moves.length, 0); assert.deepEqual(plan.issues, []);
  assert.deepEqual(await files(f.root), before);
  assert.ok(!JSON.stringify(syncPreview(plan)).includes(f.root));
  assert.deepEqual(await applyFolderLibrarySync(f.root, plan.revision), { added: 1, moved: 0, removed: 0, restored: 0, updated: 0 });
  const snapshot = await readFolderLibrary(f.root);
  assert.equal(snapshot.items.length, 2); assert.equal(snapshot.manifest.itemCount, 2); assert.equal(snapshot.baseManifest.itemCount, 1);
  const item = snapshot.items.find((record) => record.itemUuid !== 'uuid');
  assert.equal(item.name, 'New 日本'); assert.equal(item.folder, 'Inbox'); assert.deepEqual(item.tags, []);
  for (const [variant, width] of [['image-thumbs', 1200], ['image-thumbs-mobile', 560]]) {
    const info = await sharp(path.join(f.root, item.assets[variant].path)).metadata();
    assert.equal(info.width, width); assert.equal(info.height, width / 2);
  }
  const after = await files(f.root);
  for (const [name, digest] of Object.entries(before)) assert.equal(after[name], digest, name);
  const again = await scanFolderLibrary(f.root); assert.equal(again.additions.length, 0); assert.equal(again.moves.length, 0);
  assert.deepEqual(await applyFolderLibrarySync(f.root, again.revision), { added: 0, moved: 0, removed: 0, restored: 0, updated: 0 });
  assert.equal((await readdir(path.join(f.root, 'metadata/sync-backups'))).length, 1);
});

test('renames originals and thumbnails without losing metadata edits or board placements', async (t) => {
  const f = await fixture(t); const original = await readFolderLibrary(f.root);
  const metadata = { name: 'My edited name', description: 'Saved draft', tags: ['people/aapo', 'vintage/france'], favorite: true };
  await saveFolderLibraryMetadata(original, 'uuid', { revision: effectiveMetadata(f.item, await readFolderLibraryEdits(original)).metadataRevision, metadata });
  const edits = await readFile(path.join(f.root, 'metadata/edits.json')); const board = await readFile(path.join(f.root, 'metadata/appState.json'));
  for (const asset of Object.values(f.item.assets)) {
    const destination = asset.path.replace('Inbox/Été image', 'People/Aapo/自由 renamed');
    await mkdir(path.dirname(path.join(f.root, destination)), { recursive: true });
    await rename(path.join(f.root, asset.path), path.join(f.root, destination));
  }
  const plan = await scanFolderLibrary(f.root); assert.equal(plan.moves.length, 3); assert.equal(plan.additions.length, 0);
  await applyFolderLibrarySync(f.root, plan.revision);
  const snapshot = await readFolderLibrary(f.root); const item = snapshot.items[0];
  assert.equal(item.itemUuid, 'uuid'); assert.equal(item.legacyId, 'legacy'); assert.equal(item.folder, 'People/Aapo');
  assert.deepEqual(item.sourceMetadata, f.item.sourceMetadata); assert.deepEqual(item.tags, f.item.tags);
  assert.equal(effectiveMetadata(item, await readFolderLibraryEdits(snapshot)).name, metadata.name);
  assert.deepEqual(await readFile(path.join(f.root, 'metadata/edits.json')), edits); assert.deepEqual(await readFile(path.join(f.root, 'metadata/appState.json')), board);
  assert.ok(!snapshot.warnings.some((warning) => warning.code.includes('BOARD')));
});

test('missing records remain; changed files and ambiguous duplicates are not silently imported or relinked', async (t) => {
  const f = await fixture(t); const filename = f.item.assets.image.path;
  await rename(path.join(f.root, filename), path.join(f.root, 'public/images/Inbox/copy one.png'));
  await copyFile(path.join(f.root, 'public/images/Inbox/copy one.png'), path.join(f.root, 'public/images/Inbox/copy two.png'));
  await rm(path.join(f.root, f.item.assets['image-thumbs-mobile'].path));
  await writeFile(path.join(f.root, f.item.assets['image-thumbs'].path), 'different');
  const plan = await scanFolderLibrary(f.root);
  assert.equal(plan.moves.length, 0); assert.equal(plan.additions.length, 0);
  for (const code of ['AMBIGUOUS_MOVE', 'MISSING_FILE', 'CHANGED_FILE', 'DUPLICATE_OR_AMBIGUOUS']) assert.ok(plan.issues.some((issue) => issue.code === code), code);
  await applyFolderLibrarySync(f.root, plan.revision);
  assert.equal((await readFolderLibrary(f.root)).items.length, 1);
});

test('rejects a stale preview after new files, content changes, or a competing sync', async (t) => {
  const f = await fixture(t); await f.add(); const plan = await scanFolderLibrary(f.root);
  await f.add('public/images/Inbox/Other.png', '#00ff00');
  await assert.rejects(applyFolderLibrarySync(f.root, plan.revision), { status: 409 });
  const fresh = await scanFolderLibrary(f.root); await applyFolderLibrarySync(f.root, fresh.revision);
  await assert.rejects(applyFolderLibrarySync(f.root, fresh.revision), { status: 409 });
});

test('unsupported, corrupt and symlinked additions are reported without following links', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'public/images/Inbox/note.txt'), 'not an image');
  await writeFile(path.join(f.root, 'public/images/Inbox/broken.jpg'), 'not an image either');
  await symlink('/etc', path.join(f.root, 'public/images/outside'));
  const plan = await scanFolderLibrary(f.root);
  assert.equal(plan.additions.length, 0);
  for (const code of ['UNSUPPORTED_FILE', 'INVALID_IMAGE', 'SYMLINK_SKIPPED']) assert.ok(plan.issues.some((issue) => issue.code === code));
});

test('backup failure rolls back generated thumbnails and never commits a partial catalogue', async (t) => {
  const f = await fixture(t); await f.add();
  await writeFile(path.join(f.root, 'metadata/sync-backups'), 'blocked');
  const before = await files(f.root); const plan = await scanFolderLibrary(f.root);
  await assert.rejects(applyFolderLibrarySync(f.root, plan.revision));
  assert.deepEqual(await files(f.root), before);
});

test('metadata lock excludes concurrent sync and unsafe write destinations cannot escape', async (t) => {
  const f = await fixture(t); await f.add(); const plan = await scanFolderLibrary(f.root);
  await writeFile(path.join(f.root, 'metadata/edits.lock'), 'busy');
  await assert.rejects(applyFolderLibrarySync(f.root, plan.revision), { status: 423 });
  await rm(path.join(f.root, 'metadata/edits.lock'));
  await symlink('/tmp', path.join(f.root, 'metadata/sync-backups'));
  await assert.rejects(applyFolderLibrarySync(f.root, plan.revision), /Unsafe/);
  assert.equal((await readFolderLibrary(f.root)).items.length, 1);
});

test('newly imported records can be renamed again and edited durably', async (t) => {
  const f = await fixture(t); const filename = await f.add();
  await applyFolderLibrarySync(f.root, (await scanFolderLibrary(f.root)).revision);
  let snapshot = await readFolderLibrary(f.root); const item = snapshot.items.find((entry) => entry.itemUuid !== 'uuid');
  const metadata = { name: 'Saved new record', description: '', tags: ['multiple', 'tags'], favorite: true };
  await saveFolderLibraryMetadata(snapshot, item.itemUuid, { revision: effectiveMetadata(item, await readFolderLibraryEdits(snapshot)).metadataRevision, metadata });
  await rename(path.join(f.root, filename), path.join(f.root, 'public/images/Inbox/Another name.png'));
  await applyFolderLibrarySync(f.root, (await scanFolderLibrary(f.root)).revision);
  snapshot = await readFolderLibrary(f.root);
  assert.equal(snapshot.items.length, 2);
  assert.equal(effectiveMetadata(snapshot.items[1], await readFolderLibraryEdits(snapshot)).name, 'Saved new record');
  const backups = await readdir(path.join(f.root, 'metadata/sync-backups'));
  assert.equal(backups.length, 2);
});

test('deleted images leave the active inventory while their metadata and board placeholders remain', async (t) => {
  const f = await fixture(t); await rm(path.join(f.root, f.item.assets.image.path)); await f.add();
  const plan = await scanFolderLibrary(f.root);
  assert.equal(plan.removals.length, 1);
  await applyFolderLibrarySync(f.root, plan.revision);
  const snapshot = await readFolderLibrary(f.root);
  assert.equal(snapshot.items.length, 2);
  assert.equal(snapshot.items[0].itemUuid, 'uuid');
  assert.ok(snapshot.items[0].syncDeletedAt);
  assert.equal(snapshot.inventory.itemCount, 1);
  assert.ok(snapshot.warnings.some((warning) => warning.code === 'UNRESOLVED_BOARD_REFERENCE'));
  assert.equal((await scanFolderLibrary(f.root)).removals.length, 0);
});

test('synced catalogues reject corrupt data, missing baseline IDs, changed baselines and unsafe paths', async (t) => {
  const f = await fixture(t); await f.add();
  await applyFolderLibrarySync(f.root, (await scanFolderLibrary(f.root)).revision);
  const filename = path.join(f.root, 'metadata/catalogue.json');
  const original = await readFile(filename, 'utf8'); const parsed = JSON.parse(original);
  for (const value of [null, { ...parsed, version: 2 }, { ...parsed, items: parsed.items.slice(1) }, { ...parsed, items: [...parsed.items, parsed.items[0]] }]) {
    await writeFile(filename, JSON.stringify(value)); await assert.rejects(readFolderLibrary(f.root));
  }
  const unsafe = structuredClone(parsed); unsafe.items[1].assets.image.path = '../outside.png';
  await writeFile(filename, JSON.stringify(unsafe)); await assert.rejects(readFolderLibrary(f.root), /Unsafe/);
  await writeFile(filename, original);
  const base = path.join(f.root, 'metadata/items.ndjson'); await writeFile(base, JSON.stringify({ ...f.item, name: 'Changed baseline' }));
  await assert.rejects(readFolderLibrary(f.root), /changed baseline/);
});

test('UUID filenames resolve identical moved duplicates and remove only the deleted record', async (t) => {
  const f = await fixture(t);
  const duplicate = structuredClone(f.item);
  duplicate.itemUuid = 'duplicate'; duplicate.legacyId = 'duplicate-legacy';
  duplicate.sourceMetadata.itemUuid = 'duplicate'; duplicate.sourceMetadata.id = 'duplicate-legacy';
  duplicate.assets.image.path = 'public/images/Inbox/Copy--duplicate.png';
  await writeFile(path.join(f.root, 'manifest.json'), JSON.stringify({ version: 1, itemCount: 2 }));
  await writeFile(path.join(f.root, 'metadata/items.ndjson'), [duplicate, f.item].map(JSON.stringify).join('\n'));
  await mkdir(path.join(f.root, 'public/images/Vintage/EU/France'), { recursive: true });
  const destination = 'public/images/Vintage/EU/France/Photo--uuid.png';
  await rename(path.join(f.root, f.item.assets.image.path), path.join(f.root, destination));
  const before = await readFolderLibrary(f.root);
  const metadata = { name: 'Preserve deleted edits', description: 'Recoverable', tags: ['tag'], favorite: true };
  await saveFolderLibraryMetadata(before, 'duplicate', { revision: effectiveMetadata(duplicate, await readFolderLibraryEdits(before)).metadataRevision, metadata });
  const plan = await scanFolderLibrary(f.root);
  assert.deepEqual(plan.moves.map((move) => move.itemUuid), ['uuid']);
  assert.deepEqual(plan.removals.map((item) => item.itemUuid), ['duplicate']);
  assert.equal(plan.additions.length, 0); assert.equal(plan.issues.length, 0);
  await applyFolderLibrarySync(f.root, plan.revision);
  let snapshot = await readFolderLibrary(f.root);
  assert.equal(snapshot.items.find((item) => item.itemUuid === 'uuid').folder, 'Vintage/EU/France');
  assert.ok(snapshot.items.find((item) => item.itemUuid === 'duplicate').syncDeletedAt);
  assert.equal(snapshot.inventory.itemCount, 1);
  assert.equal((await readFolderLibraryEdits(snapshot)).items[0].metadata.name, metadata.name);
  await writeFile(path.join(f.root, duplicate.assets.image.path), f.bytes);
  const restored = await scanFolderLibrary(f.root); assert.deepEqual(restored.restores, ['duplicate']);
  await applyFolderLibrarySync(f.root, restored.revision);
  snapshot = await readFolderLibrary(f.root); assert.equal(snapshot.inventory.itemCount, 2);
  assert.ok(!snapshot.items.find((item) => item.itemUuid === 'duplicate').syncDeletedAt);
});

test('missing image root cannot delete a library; changed UUID contents are reviewed as edits', async (t) => {
  const f = await fixture(t);
  await rename(path.join(f.root, 'public/images'), path.join(f.root, 'public/offline-images'));
  await assert.rejects(scanFolderLibrary(f.root));
  await rename(path.join(f.root, 'public/offline-images'), path.join(f.root, 'public/images'));
  await rm(path.join(f.root, f.item.assets.image.path));
  await f.add('public/images/Inbox/Changed--uuid.png');
  const plan = await scanFolderLibrary(f.root);
  assert.equal(plan.removals.length, 0); assert.equal(plan.moves.length, 0); assert.equal(plan.additions.length, 0);
  assert.equal(plan.updates.length, 1);
});

test('crops in place and moved crops refresh both thumbnails while preserving metadata and boards', async (t) => {
  for (const moved of [false, true]) {
    const f = await fixture(t);
    const before = await readFolderLibrary(f.root);
    const edited = { name: 'Saved name', description: 'Keep description', tags: ['multiple', 'tags'], favorite: true };
    await saveFolderLibraryMetadata(before, 'uuid', { revision: effectiveMetadata(f.item, await readFolderLibraryEdits(before)).metadataRevision, metadata: edited });
    const edits = await readFile(path.join(f.root, 'metadata/edits.json'));
    const board = await readFile(path.join(f.root, 'metadata/appState.json'));
    const destination = moved ? 'public/images/People/Celebrities/Cropped--uuid.png' : f.item.assets.image.path;
    const cropped = await sharp(f.bytes).extract({ left: 50, top: 20, width: 600, height: 800 }).png().toBuffer();
    await mkdir(path.dirname(path.join(f.root, destination)), { recursive: true });
    if (moved) await rm(path.join(f.root, f.item.assets.image.path));
    await writeFile(path.join(f.root, destination), cropped);
    const plan = await scanFolderLibrary(f.root);
    assert.equal(plan.updates.length, 1); assert.equal(plan.additions.length, 0); assert.equal(plan.removals.length, 0); assert.deepEqual(plan.issues, []);
    await applyFolderLibrarySync(f.root, plan.revision);
    const snapshot = await readFolderLibrary(f.root); const item = snapshot.items[0];
    assert.equal(item.itemUuid, 'uuid'); assert.deepEqual(item.sourceMetadata, f.item.sourceMetadata);
    assert.equal(item.assets.image.path, destination); assert.equal(item.assets.image.sha256, hash(cropped));
    assert.equal(item.assets.image.width, 600); assert.equal(item.assets.image.height, 800);
    for (const variant of ['image-thumbs', 'image-thumbs-mobile']) {
      assert.notEqual(item.assets[variant].path, f.item.assets[variant].path);
      const info = await sharp(path.join(f.root, item.assets[variant].path)).metadata();
      assert.equal(info.width / info.height, 600 / 800);
      assert.deepEqual(await readFile(path.join(f.root, f.item.assets[variant].path)), f.bytes);
    }
    assert.deepEqual(await readFile(path.join(f.root, 'metadata/edits.json')), edits);
    assert.deepEqual(await readFile(path.join(f.root, 'metadata/appState.json')), board);
    const again = await scanFolderLibrary(f.root); assert.equal(again.updates.length, 0);
    assert.equal(again.additions.length, 0); assert.equal(again.removals.length, 0);
  }
});

test('invalid edited images and duplicate UUID candidates do not replace existing assets', async (t) => {
  const f = await fixture(t); await rm(path.join(f.root, f.item.assets.image.path));
  await writeFile(path.join(f.root, 'public/images/Inbox/Edited--uuid.png'), 'corrupt image');
  let plan = await scanFolderLibrary(f.root);
  assert.equal(plan.updates.length, 0); assert.equal(plan.removals.length, 0); assert.ok(plan.issues.some((issue) => issue.code === 'INVALID_IMAGE'));
  await f.add('public/images/Inbox/Edited--uuid.png'); await f.add('public/images/Inbox/Another--uuid.png', '#00ff00');
  plan = await scanFolderLibrary(f.root);
  assert.equal(plan.updates.length, 0); assert.equal(plan.removals.length, 0); assert.equal(plan.moves.length, 0);
  assert.ok(plan.issues.some((issue) => issue.code === 'AMBIGUOUS_MOVE'));
});

test('failed edited-image commit retains previous thumbnails and catalogue', async (t) => {
  const f = await fixture(t);
  await f.add(f.item.assets.image.path);
  await writeFile(path.join(f.root, 'metadata/sync-backups'), 'blocked');
  const before = await files(f.root); const plan = await scanFolderLibrary(f.root);
  assert.equal(plan.updates.length, 1);
  await assert.rejects(applyFolderLibrarySync(f.root, plan.revision));
  assert.deepEqual(await files(f.root), before);
});
