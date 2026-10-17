import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { readFolderBoards, saveFolderBoards } from './folderBoards.node.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'folder-boards-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'metadata'));
  const board = { id: 'exported', boardUuid: 'exported-uuid', width: 1800, height: 1200, secretPath: '/Users/private',
    images: [{ id: 'placement', referenceId: 'legacy', referenceItemUuid: 'uuid', x: 12.25, y: -8.5, width: 120, height: 240, rotation: 12.3, zIndex: 2 }] };
  const appState = { board, imageCount: 5, generationMode: 'random', savedOutfits: [] };
  await writeFile(path.join(root, 'metadata/appState.json'), JSON.stringify(appState));
  return { root, appState, items: [{ legacyId: 'legacy', itemUuid: 'uuid' }, { legacyId: 'other', itemUuid: 'other-uuid' }] };
}
const changedState = (current) => { const state = structuredClone(current.state); state.current.board.images[0].x += 100; return state; };
const savedCopy = (current, uuid = 'saved-uuid') => ({ ...structuredClone(current), id: uuid, name: 'A board', createdAt: new Date().toISOString(), board: { ...structuredClone(current.board), boardUuid: uuid } });

test('first read preserves exported geometry/settings without creating files or exposing provenance', async (t) => {
  const f = await fixture(t); const before = await readdir(path.join(f.root, 'metadata'));
  const loaded = await readFolderBoards(f);
  assert.equal(loaded.state.current.board.images[0].x, 12.25);
  assert.deepEqual(loaded.state.current.settings, { imageCount: 5, generationMode: 'random' });
  assert.ok(!JSON.stringify(loaded).includes('/Users/'));
  assert.deepEqual(await readdir(path.join(f.root, 'metadata')), before);
  assert.equal((await readFolderBoards(f)).revision, loaded.revision);
});

test('current/saved boards roundtrip exactly, with exact backups and unchanged exported state', async (t) => {
  const f = await fixture(t); const appState = await readFile(path.join(f.root, 'metadata/appState.json'));
  const initial = await readFolderBoards(f); const state = changedState(initial);
  state.current.filters = { search: 'coat', folder: 'Vintage/EU', tags: ['vintage', 'workwear'], tagMode: 'any', sort: 'favorites' };
  state.saved.push(savedCopy(state.current));
  const saved = await saveFolderBoards(f, { revision: initial.revision, state });
  assert.deepEqual((await readFolderBoards(f)).state, state);
  const previous = await readFile(path.join(f.root, 'metadata/boards.json'));
  const next = changedState(saved); next.current.board.boardUuid = 'next-board';
  await saveFolderBoards(f, { revision: saved.revision, state: next });
  const restored = await readFolderBoards(f);
  assert.deepEqual(restored.state.saved[0], state.saved[0]);
  const backups = await readdir(path.join(f.root, 'metadata/board-backups'));
  assert.equal(backups.length, 2);
  const bytes = await Promise.all(backups.map((file) => readFile(path.join(f.root, 'metadata/board-backups', file))));
  assert.ok(bytes.some((buffer) => buffer.equals(previous)));
  assert.deepEqual(await readFile(path.join(f.root, 'metadata/appState.json')), appState);
});

test('stale tabs cannot overwrite, identical retries are idempotent, and the shared lock excludes saves', async (t) => {
  const f = await fixture(t); const initial = await readFolderBoards(f); const state = changedState(initial);
  const first = await saveFolderBoards(f, { revision: initial.revision, state });
  await assert.rejects(saveFolderBoards(f, { revision: initial.revision, state: { ...state, saved: [savedCopy(state.current)] } }), { status: 409 });
  assert.deepEqual(await saveFolderBoards(f, { revision: initial.revision, state }), first);
  assert.equal((await readdir(path.join(f.root, 'metadata/board-backups'))).length, 1);
  await writeFile(path.join(f.root, 'metadata/edits.lock'), 'sync in progress');
  await assert.rejects(saveFolderBoards(f, { revision: first.revision, state: changedState(first) }), { status: 423 });
});

test('invalid geometry, duplicate IDs, mismatched references and unsafe paths cannot be saved', async (t) => {
  const f = await fixture(t); const initial = await readFolderBoards(f);
  for (const mutate of [
    (s) => { s.current.board.images[0].width = -1; },
    (s) => { s.current.board.images.push(s.current.board.images[0]); },
    (s) => { s.current.board.images[0].referenceItemUuid = 'other-uuid'; },
    (s) => { s.current.settings.imageCount = 31; },
    (s) => { const copy = savedCopy(s.current); s.saved = [copy, copy]; }
  ]) {
    const state = changedState(initial); mutate(state);
    await assert.rejects(saveFolderBoards(f, { revision: initial.revision, state }), { status: 400 });
  }
  await symlink('/tmp', path.join(f.root, 'metadata/board-backups'));
  await assert.rejects(saveFolderBoards(f, { revision: initial.revision, state: changedState(initial) }), /Unsafe/);
  assert.equal((await readFolderBoards(f)).revision, initial.revision);
  assert.ok(!(await readdir(path.join(f.root, 'metadata'))).includes('edits.lock'));
});

test('unknown and deleted image references remain placeholders; corrupt board files are never reset', async (t) => {
  const f = await fixture(t); const initial = await readFolderBoards(f); const state = changedState(initial);
  state.current.board.images.push({ ...state.current.board.images[0], id: 'missing', referenceId: 'gone', referenceItemUuid: 'gone-uuid' });
  f.items[0].syncDeletedAt = new Date().toISOString();
  await saveFolderBoards(f, { revision: initial.revision, state });
  assert.equal((await readFolderBoards(f)).state.current.board.images.length, 2);
  await writeFile(path.join(f.root, 'metadata/boards.json'), '{broken');
  await assert.rejects(readFolderBoards(f));
  await assert.rejects(saveFolderBoards(f, { revision: initial.revision, state }));
  assert.equal(await readFile(path.join(f.root, 'metadata/boards.json'), 'utf8'), '{broken');
});

test('a failed backup keeps the previous board bytes intact', async (t) => {
  const f = await fixture(t); const initial = await readFolderBoards(f);
  const saved = await saveFolderBoards(f, { revision: initial.revision, state: changedState(initial) });
  const before = await readFile(path.join(f.root, 'metadata/boards.json'));
  await rm(path.join(f.root, 'metadata/board-backups'), { recursive: true });
  await writeFile(path.join(f.root, 'metadata/board-backups'), 'blocked');
  await assert.rejects(saveFolderBoards(f, { revision: saved.revision, state: changedState(saved) }));
  assert.deepEqual(await readFile(path.join(f.root, 'metadata/boards.json')), before);
});
