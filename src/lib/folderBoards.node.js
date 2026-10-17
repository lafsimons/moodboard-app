import { createHash, randomUUID } from 'node:crypto';
import { readFile, open, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { inspectPath } from './folderLibraryReader.node.js';
import { MetadataEditError, safeTarget, writeExclusive, syncDirectory } from './folderLibraryEdits.node.js';
import { projectFolderBoard } from './folderBoardView.js';
import { defaultFolderBoardFilters, folderBoardSettings } from './folderBoardGeneration.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 200) => typeof value === 'string' && value.length <= max;
const identity = (value) => text(value) && Boolean(value.trim());
const finite = (value) => Number.isFinite(value) && Math.abs(value) <= 10000000;
const requireValue = (condition, message) => { if (!condition) throw new MetadataEditError(400, message); };

export function validateFolderBoardState(value, snapshot) {
  requireValue(object(value) && value.version === 1 && object(value.current) && Array.isArray(value.saved) && value.saved.length <= 500, 'Invalid board state.');
  const byUuid = new Map(snapshot.items.map((item) => [item.itemUuid, item]));
  const byId = new Map(snapshot.items.map((item) => [item.legacyId, item]));
  function board(input) {
    if (input === null) return null;
    requireValue(object(input) && identity(input.id) && identity(input.boardUuid) && finite(input.width) && input.width > 0 && finite(input.height) && input.height > 0 && Array.isArray(input.images) && input.images.length <= 1000, 'Invalid board identity, dimensions or placements.');
    const seen = new Set();
    const images = input.images.map((image) => {
      requireValue(object(image) && identity(image.id) && !seen.has(image.id), 'Invalid or duplicate placement identity.'); seen.add(image.id);
      requireValue(text(image.referenceId) && text(image.referenceItemUuid) && (identity(image.referenceId) || identity(image.referenceItemUuid)), 'A placement needs an image reference.');
      requireValue(['x', 'y', 'width', 'height', 'rotation', 'zIndex'].every((key) => finite(image[key])) && image.width > 0 && image.height > 0, 'Invalid placement geometry.');
      const uuid = byUuid.get(image.referenceItemUuid), legacy = byId.get(image.referenceId);
      requireValue(!(uuid && legacy && uuid !== legacy), 'Conflicting placement image identities.');
      // Unknown/deleted references are valid placeholders, never discarded.
      return { id: image.id, referenceId: image.referenceId, referenceItemUuid: image.referenceItemUuid,
        x: image.x, y: image.y, width: image.width, height: image.height, rotation: image.rotation, zIndex: image.zIndex };
    });
    return { id: input.id, boardUuid: input.boardUuid, width: input.width, height: input.height, images };
  }
  function entry(input) {
    requireValue(object(input) && object(input.settings) && object(input.filters), 'Invalid board settings or filters.');
    requireValue(Number.isInteger(input.settings.imageCount) && input.settings.imageCount >= 1 && input.settings.imageCount <= 30 && ['guided', 'random'].includes(input.settings.generationMode), 'Invalid generator settings.');
    const f = input.filters;
    requireValue(text(f.search, 20000) && text(f.folder, 4096) && Array.isArray(f.tags) && f.tags.length <= 1000 && f.tags.every((tag) => text(tag, 1000)) && ['all', 'any'].includes(f.tagMode) && ['name', 'name-desc', 'newest', 'oldest', 'favorites'].includes(f.sort), 'Invalid library filter snapshot.');
    return { board: board(input.board), settings: { imageCount: input.settings.imageCount, generationMode: input.settings.generationMode },
      filters: { search: f.search, folder: f.folder, tags: [...f.tags], tagMode: f.tagMode, sort: f.sort } };
  }
  const savedIds = new Set();
  const saved = value.saved.map((saved) => {
    requireValue(object(saved) && identity(saved.id) && text(saved.name, 200) && saved.name.trim() && text(saved.createdAt) && Number.isFinite(Date.parse(saved.createdAt)), 'Invalid saved board details.');
    const result = entry(saved);
    requireValue(result.board && !savedIds.has(result.board.boardUuid) && saved.id === result.board.boardUuid, 'Saved boards need distinct board UUIDs.');
    savedIds.add(result.board.boardUuid);
    return { id: saved.id, name: saved.name, createdAt: saved.createdAt, ...result };
  });
  return { version: 1, current: entry(value.current), saved };
}

function exportedBoard(input, snapshot) {
  if (!input) return null;
  const board = projectFolderBoard(input);
  const fallback = `export-${hash(JSON.stringify(board)).slice(0, 24)}`;
  board.id ||= fallback; board.boardUuid ||= fallback;
  for (const image of board.images) {
    const item = snapshot.items.find((item) => item.itemUuid === image.referenceItemUuid) ?? snapshot.items.find((item) => item.legacyId === image.referenceId);
    if (item) { image.referenceItemUuid ||= item.itemUuid; image.referenceId ||= item.legacyId; }
  }
  return board;
}

export async function readFolderBoards(snapshot) {
  const file = await inspectPath(snapshot.root, 'metadata/boards.json');
  let state, raw;
  if (file.exists) {
    if (!file.isFile) throw new Error('Board state must be a file.');
    raw = await readFile(file.absolutePath, 'utf8');
    state = JSON.parse(raw);
  } else {
    const settings = folderBoardSettings(snapshot.appState);
    const filters = { ...defaultFolderBoardFilters, tags: [] };
    state = { version: 1, current: { board: exportedBoard(snapshot.appState.board, snapshot), settings, filters },
      saved: (snapshot.appState.savedOutfits ?? []).filter((entry) => entry.board).map((entry) => {
        const board = exportedBoard(entry.board, snapshot);
        return { id: board.boardUuid, name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.slice(0, 200) : 'Exported board',
          createdAt: Number.isFinite(Date.parse(entry.createdAt)) ? new Date(entry.createdAt).toISOString() : '1970-01-01T00:00:00.000Z', board, settings, filters };
      }) };
    raw = JSON.stringify(state);
  }
  return { state: validateFolderBoardState(state, snapshot), revision: hash(raw) };
}

export async function saveFolderBoards(snapshot, request) {
  requireValue(object(request) && text(request.revision, 128), 'A board revision is required.');
  const state = validateFolderBoardState(request.state, snapshot);
  await safeTarget(snapshot.root, 'metadata', true);
  const lockPath = await safeTarget(snapshot.root, 'metadata/edits.lock', false, true);
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') throw new MetadataEditError(423, 'Another save or sync is running. Your board is still here; retry shortly.');
    throw error;
  }
  let temporary;
  try {
    const target = await safeTarget(snapshot.root, 'metadata/boards.json', false, true);
    const current = await readFolderBoards(snapshot);
    // Retrying the identical state after a lost response must not create duplicates.
    if (JSON.stringify(current.state) === JSON.stringify(state)) return current;
    if (current.revision !== request.revision) throw new MetadataEditError(409, 'Boards changed in another tab. Your unsaved board is still here. Load saved boards or keep this board as a new copy.');
    const backups = await safeTarget(snapshot.root, 'metadata/board-backups', true, true);
    await mkdir(backups, { recursive: true }); await safeTarget(snapshot.root, 'metadata/board-backups', true);
    let previous;
    try { previous = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; previous = JSON.stringify(current.state, null, 2) + '\n'; }
    const suffix = `${Date.now()}-${randomUUID()}`;
    await writeExclusive(path.join(backups, `boards-${suffix}.json`), previous); await syncDirectory(backups);
    const body = JSON.stringify(state, null, 2) + '\n';
    temporary = path.join(snapshot.root, 'metadata', `.boards-${suffix}.tmp`);
    await writeExclusive(temporary, body); await safeTarget(snapshot.root, 'metadata/boards.json', false, true);
    await rename(temporary, target); temporary = null; await syncDirectory(path.dirname(target));
    return { state, revision: hash(body) };
  } finally {
    try { if (temporary) await unlink(temporary).catch(() => {}); } finally { await lock.close(); await unlink(lockPath); }
  }
}
