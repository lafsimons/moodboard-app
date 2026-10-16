import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFolderLibraryEdits, effectiveMetadata, saveFolderLibraryMetadata } from './folderLibraryEdits.node.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'metadata-edits-'));
  await mkdir(path.join(root, 'metadata'));
  const items = ['one', 'two'].map((itemUuid) => ({ itemUuid, legacyId: itemUuid + '-legacy', name: 'Été original', tags: ['People/Aapo', 'Brands/TT'], folder: 'People/Aapo', sourceMetadata: { description: 'Before', favorite: false, unknown: { retained: true } }, assets: {} }));
  const snapshot = { root, items };
  await writeFile(path.join(root, 'metadata/items.ndjson'), items.map((item) => JSON.stringify(item)).join('\n'));
  await writeFile(path.join(root, 'metadata/appState.json'), '{"board":{"images":[{"itemUuid":"one"}]}}');
  t.after(() => rm(root, { recursive: true, force: true }));
  return snapshot;
}
const changed = { name: 'New name 日本', description: 'Several\nlines', tags: ['People/Aapo', 'Vintage/France'], favorite: true };
async function request(snapshot, id = 'one', metadata = changed) {
  return { revision: effectiveMetadata(snapshot.items.find((item) => item.itemUuid === id), await readFolderLibraryEdits(snapshot)).metadataRevision, metadata };
}

test('edits survive rereading, preserve source and board bytes, and create exact previous versions', async (t) => {
  const s = await fixture(t);
  const baseline = await readFile(path.join(s.root, 'metadata/items.ndjson'));
  const board = await readFile(path.join(s.root, 'metadata/appState.json'));
  const original = structuredClone(s.items);
  const first = await saveFolderLibraryMetadata(s, 'one', await request(s));
  const previous = await readFile(path.join(s.root, 'metadata/edits.json'));
  assert.equal(first.favorite, true);
  assert.deepEqual(effectiveMetadata(s.items[0], await readFolderLibraryEdits(s)), first);
  await saveFolderLibraryMetadata(s, 'two', await request(s, 'two', { ...changed, name: 'Second' }));
  assert.equal((await readFolderLibraryEdits(s)).items.length, 2);
  const backups = await readdir(path.join(s.root, 'metadata/edit-backups'));
  const bytes = await Promise.all(backups.map((file) => readFile(path.join(s.root, 'metadata/edit-backups', file))));
  assert.equal(bytes.length, 2);
  assert.ok(bytes.some((file) => file.equals(previous)));
  assert.ok(bytes.some((file) => JSON.parse(file).items.length === 0));
  assert.deepEqual(await readFile(path.join(s.root, 'metadata/items.ndjson')), baseline);
  assert.deepEqual(await readFile(path.join(s.root, 'metadata/appState.json')), board);
  assert.deepEqual(s.items, original);
  assert.ok(!(await readdir(path.join(s.root, 'metadata'))).some((file) => file.endsWith('.tmp') || file.endsWith('.lock')));
});

test('stale edits and simultaneous writers never overwrite newer metadata', async (t) => {
  const s = await fixture(t); const stale = await request(s);
  const results = await Promise.allSettled([saveFolderLibraryMetadata(s, 'one', stale), saveFolderLibraryMetadata(s, 'one', { ...stale, metadata: { ...changed, name: 'Other tab' } })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.ok([409, 423].includes(results.find((result) => result.status === 'rejected').reason.status));
  await assert.rejects(saveFolderLibraryMetadata(s, 'one', stale), { status: 409 });
  assert.equal((await readdir(path.join(s.root, 'metadata/edit-backups'))).length, 1);
});

test('unrelated item saves are preserved and unknown overlay fields survive', async (t) => {
  const s = await fixture(t); const second = await request(s, 'two');
  await saveFolderLibraryMetadata(s, 'one', await request(s));
  const overlay = await readFolderLibraryEdits(s); overlay.custom = { future: true }; overlay.items[0].future = 'keep';
  await writeFile(path.join(s.root, 'metadata/edits.json'), JSON.stringify(overlay));
  await saveFolderLibraryMetadata(s, 'two', second);
  const next = await readFolderLibraryEdits(s);
  assert.deepEqual(next.custom, { future: true }); assert.equal(next.items[0].future, 'keep');
  assert.equal(next.items.length, 2);
});

test('invalid fields and unknown identities cannot create edits', async (t) => {
  const s = await fixture(t); const req = await request(s);
  for (const metadata of [{ ...changed, folder: 'Elsewhere' }, { ...changed, tags: 'bad' }, { ...changed, tags: ['line\nbreak'] }, { ...changed, name: 'x'.repeat(1001) }, { ...changed, favorite: 'true' }]) {
    await assert.rejects(saveFolderLibraryMetadata(s, 'one', { ...req, metadata }), { status: 400 });
  }
  await assert.rejects(saveFolderLibraryMetadata(s, 'unknown', req), { status: 404 });
  assert.deepEqual((await readdir(path.join(s.root, 'metadata'))).sort(), ['appState.json', 'items.ndjson']);
});

test('corrupt or unrecognized edits are not overwritten and release the write lock', async (t) => {
  const s = await fixture(t); const req = await request(s);
  for (const content of ['{broken', JSON.stringify({ version: 99, items: [] }), JSON.stringify({ version: 1, items: [{ itemUuid: 'lost', metadata: changed }] }), JSON.stringify({ version: 1, items: [1, 2].map(() => ({ itemUuid: 'one', metadata: changed })) })]) {
    await writeFile(path.join(s.root, 'metadata/edits.json'), content);
    await assert.rejects(saveFolderLibraryMetadata(s, 'one', req));
    assert.equal(await readFile(path.join(s.root, 'metadata/edits.json'), 'utf8'), content);
    assert.ok(!(await readdir(path.join(s.root, 'metadata'))).includes('edits.lock'));
  }
});

test('unsafe overlay, backup, and metadata symlinks are rejected before changing outside files', async (t) => {
  for (const relative of ['metadata/edits.json', 'metadata/edit-backups', 'metadata']) {
    const s = await fixture(t); const req = await request(s);
    const outside = await mkdtemp(path.join(tmpdir(), 'metadata-outside-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    const marker = path.join(outside, 'edits.json'); await writeFile(marker, 'secret');
    const target = path.join(s.root, relative);
    if (relative === 'metadata') await rm(target, { recursive: true });
    await symlink(relative.endsWith('edits.json') ? marker : outside, target);
    await assert.rejects(saveFolderLibraryMetadata(s, 'one', req));
    assert.equal(await readFile(marker, 'utf8'), 'secret');
    assert.deepEqual(await readdir(outside), ['edits.json']);
  }
});

test('a blocked backup prevents saving and leaves existing metadata intact', async (t) => {
  const s = await fixture(t); await saveFolderLibraryMetadata(s, 'one', await request(s));
  const before = await readFile(path.join(s.root, 'metadata/edits.json'));
  await rm(path.join(s.root, 'metadata/edit-backups'), { recursive: true });
  await writeFile(path.join(s.root, 'metadata/edit-backups'), 'not a directory');
  await assert.rejects(saveFolderLibraryMetadata(s, 'one', await request(s, 'one', { ...changed, name: 'Must not save' })));
  assert.deepEqual(await readFile(path.join(s.root, 'metadata/edits.json')), before);
  assert.ok(!(await readdir(path.join(s.root, 'metadata'))).includes('edits.lock'));
});
