import { readFile, open, lstat, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { inspectPath } from './folderLibraryReader.node.js';

const editsPath = 'metadata/edits.json';
const fields = ['name', 'description', 'tags', 'favorite'];
export class MetadataEditError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateMetadataFields(value) {
  const invalid = (message = 'Use a name, description, a list of tags, and a favorite checkbox only.') => { throw new MetadataEditError(400, message); };
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== fields.length || fields.some((key) => !Object.hasOwn(value, key))) invalid();
  if (typeof value.name !== 'string' || value.name.length > 1000) invalid('Name must be text of at most 1,000 characters.');
  if (typeof value.description !== 'string' || value.description.length > 20000) invalid('Description must be text of at most 20,000 characters.');
  if (typeof value.favorite !== 'boolean') invalid('Favorite must be true or false.');
  if (!Array.isArray(value.tags) || value.tags.length > 200 || value.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 200 || /[\r\n\0]/.test(tag))) invalid('Use at most 200 nonempty tags, each on one line and at most 200 characters long.');
  return { name: value.name, description: value.description, tags: [...value.tags], favorite: value.favorite };
}

export function effectiveMetadata(record, edits) {
  const value = edits.items.find((item) => item.itemUuid === record.itemUuid)?.metadata ?? {
    name: typeof record.name === 'string' ? record.name : '',
    description: typeof record.sourceMetadata.description === 'string' ? record.sourceMetadata.description : '',
    tags: Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === 'string') : [],
    favorite: Boolean(record.sourceMetadata.favorite)
  };
  // Content-based revisions also detect manual edits to the baseline or overlay.
  const revision = createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return { ...value, metadataRevision: revision };
}

export async function readFolderLibraryEdits(snapshot) {
  const file = await inspectPath(snapshot.root, editsPath);
  if (!file.exists) return { version: 1, items: [] };
  if (!file.isFile) throw new Error('Metadata edits must be a regular file.');
  const value = JSON.parse(await readFile(file.absolutePath, 'utf8'));
  if (value?.version !== 1 || !Array.isArray(value.items)) throw new Error('Invalid metadata edits file.');
  const known = new Set(snapshot.items.map((item) => item.itemUuid));
  const seen = new Set();
  for (const item of value.items) {
    if (!item || !known.has(item.itemUuid) || seen.has(item.itemUuid)) throw new Error('Unknown or duplicate metadata edit identity.');
    seen.add(item.itemUuid);
    validateMetadataFields(item.metadata);
  }
  return value;
}

// Writes deliberately disallow symlinked metadata directories and files, even
// inside the root. No user-supplied path is ever used for a write destination.
export async function safeTarget(root, relative, directory = false, optional = false) {
  const parts = relative.split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = await lstat(current); } catch (error) {
      if (error.code === 'ENOENT' && optional && i === parts.length - 1) return current;
      throw error;
    }
    if (stat.isSymbolicLink() || ((i < parts.length - 1 || directory) ? !stat.isDirectory() : !stat.isFile())) throw new Error('Unsafe metadata write target.');
  }
  return current;
}

export async function writeExclusive(filename, content) {
  const file = await open(filename, 'wx', 0o600);
  try { await file.writeFile(content); await file.sync(); } finally { await file.close(); }
}

export async function syncDirectory(directory) {
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function saveFolderLibraryMetadata(snapshot, itemUuid, request) {
  if (!request || Object.keys(request).length !== 2 || typeof request.revision !== 'string' || !Object.hasOwn(request, 'metadata')) throw new MetadataEditError(400, 'A metadata revision and editable fields are required.');
  const metadata = validateMetadataFields(request.metadata);
  const record = snapshot.items.find((item) => item.itemUuid === itemUuid);
  if (!record) throw new MetadataEditError(404, 'Image is not registered in this library.');
  if (record.syncDeletedAt) throw new MetadataEditError(409, 'This image was removed by folder sync. Reload the library.');
  await safeTarget(snapshot.root, 'metadata', true);
  const lockPath = await safeTarget(snapshot.root, 'metadata/edits.lock', false, true);
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') throw new MetadataEditError(423, 'Another metadata save is in progress. Retry shortly; if this persists, check metadata/edits.lock after stopping the local servers.');
    throw error;
  }
  let temporary;
  try {
    const target = await safeTarget(snapshot.root, editsPath, false, true);
    const edits = await readFolderLibraryEdits(snapshot);
    if (effectiveMetadata(record, edits).metadataRevision !== request.revision) throw new MetadataEditError(409, 'This image changed since you opened it. Your draft is still here. Load the saved version before editing again.');
    const existing = edits.items.find((item) => item.itemUuid === itemUuid);
    const updated = { ...existing, itemUuid, metadata, updatedAt: new Date().toISOString() };
    const next = { ...edits, items: existing ? edits.items.map((item) => item === existing ? updated : item) : [...edits.items, updated] };
    const backups = await safeTarget(snapshot.root, 'metadata/edit-backups', true, true);
    await mkdir(backups, { recursive: true });
    await safeTarget(snapshot.root, 'metadata/edit-backups', true);
    let previous;
    try { previous = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; previous = JSON.stringify(edits, null, 2) + '\n'; }
    const suffix = `${Date.now()}-${randomUUID()}`;
    await writeExclusive(path.join(backups, `edits-${suffix}.json`), previous);
    await syncDirectory(backups);
    temporary = path.join(snapshot.root, 'metadata', `.edits-${suffix}.tmp`);
    await writeExclusive(temporary, JSON.stringify(next, null, 2) + '\n');
    await safeTarget(snapshot.root, editsPath, false, true);
    await rename(temporary, target);
    temporary = null;
    // Persist directory entries as well as file contents before reporting success.
    await syncDirectory(path.dirname(target));
    return effectiveMetadata(record, next);
  } finally {
    try { if (temporary) await unlink(temporary); } finally {
      await lock.close(); await unlink(lockPath);
    }
  }
}
