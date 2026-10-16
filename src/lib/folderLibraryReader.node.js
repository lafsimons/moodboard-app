import { readFile, realpath, lstat, readlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = (value) => typeof value === 'string' && value.trim().length > 0;
const variants = ['image', 'image-thumbs', 'image-thumbs-mobile'];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

// Walk symlinks explicitly, including dangling links, so a missing outside target
// cannot be mistaken for an ordinary missing library asset. No files are opened.
export async function inspectPath(root, relative) {
  requireValue(identity(relative) && !relative.includes('\\') && !relative.includes('\0') &&
    !path.posix.isAbsolute(relative) && !/^[a-z]:/i.test(relative) &&
    !relative.split('/').includes('..'), `Unsafe library path: ${relative}`);
  let parts = relative.split('/').filter((part) => part && part !== '.');
  let current = root;
  let links = 0;
  while (parts.length) {
    current = path.join(current, parts.shift());
    let info;
    try { info = await lstat(current); }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        return { absolutePath: path.join(current, ...parts), exists: false, actualByteSize: null };
      }
      throw error;
    }
    if (info.isSymbolicLink()) {
      requireValue(++links <= 40, `Symlink loop in library path: ${relative}`);
      const target = path.resolve(path.dirname(current), await readlink(current));
      requireValue(inside(root, target), `Symlink escapes library root: ${relative}`);
      parts = [...path.relative(root, target).split(path.sep).filter(Boolean), ...parts];
      current = root;
    } else if (!parts.length) {
      return { absolutePath: current, exists: true, isFile: info.isFile(), actualByteSize: info.size };
    }
  }
  return { absolutePath: current, exists: true, isFile: false, actualByteSize: null };
}

async function requiredText(root, relative) {
  const file = await inspectPath(root, relative);
  requireValue(file.exists && file.isFile, `Required library file missing or not a file: ${relative}`);
  return readFile(file.absolutePath, 'utf8');
}

function parse(text, location) {
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`Malformed JSON in ${location}: ${error.message}`); }
}

/** Node-only read-only snapshot. Absolute asset paths must never be sent to clients.
 * items/appState retain their original shape; assets are resolved separately.
 * Inventory describes registered assets, availableAssets describes files on disk.
 */
export async function readFolderLibrary(directory) {
  const root = await realpath(path.resolve(directory));
  const manifestText = await requiredText(root, 'manifest.json');
  const baseManifest = parse(manifestText, 'manifest.json');
  let manifest = baseManifest;
  const appState = parse(await requiredText(root, 'metadata/appState.json'), 'metadata/appState.json');
  requireValue(object(manifest) && manifest.version === 1 && Number.isSafeInteger(manifest.itemCount) && manifest.itemCount >= 0,
    'Invalid library manifest: expected version 1 and nonnegative itemCount');
  requireValue(object(appState), 'Invalid appState: expected an object');
  const itemsText = await requiredText(root, 'metadata/items.ndjson');
  const lines = itemsText.split(/\r?\n/);
  let items = lines.flatMap((line, index) => line.trim() ? [parse(line, `metadata/items.ndjson line ${index + 1}`)] : []);
  requireValue(items.length === manifest.itemCount, `Record count mismatch: manifest ${manifest.itemCount}, records ${items.length}`);
  const baselineUuids = new Set(), baselineIds = new Set();
  for (const item of items) {
    requireValue(object(item) && identity(item.itemUuid) && identity(item.legacyId) && object(item.sourceMetadata) && object(item.assets), 'Invalid baseline item identity or record');
    requireValue(!baselineUuids.has(item.itemUuid) && !baselineIds.has(item.legacyId), 'Duplicate baseline identity');
    requireValue(item.sourceMetadata.id === item.legacyId && item.sourceMetadata.itemUuid === item.itemUuid, 'Conflicting baseline source identity');
    baselineUuids.add(item.itemUuid); baselineIds.add(item.legacyId);
  }
  const baseRevision = createHash('sha256').update(manifestText + '\n' + itemsText).digest('hex');
  // Keep the original export immutable. A single atomic catalogue file contains
  // synced records, avoiding a partially updated manifest/items pair on crashes.
  const baseItems = items;
  const countRecords = (allRecords) => { const records = allRecords.filter((item) => !item.syncDeletedAt); return ({
    itemCount: records.length,
    originals: records.filter((item) => item.assets?.image?.kind === 'original').length,
    previewFallbacks: records.filter((item) => item.assets?.image?.kind === 'preview-fallback').length,
    metadataOnly: records.filter((item) => !item.assets?.image).length,
    desktopThumbnails: records.filter((item) => item.assets?.['image-thumbs']).length,
    mobileThumbnails: records.filter((item) => item.assets?.['image-thumbs-mobile']).length
  }); };
  for (const [key, count] of Object.entries(countRecords(baseItems))) {
    if (baseManifest[key] !== undefined) requireValue(baseManifest[key] === count, `Manifest ${key} count mismatch`);
  }
  const catalogueFile = await inspectPath(root, 'metadata/catalogue.json');
  let catalogueRevision = 'none';
  if (catalogueFile.exists) {
    requireValue(catalogueFile.isFile, 'Synced catalogue must be a file');
    const text = await readFile(catalogueFile.absolutePath, 'utf8');
    const catalogue = parse(text, 'metadata/catalogue.json');
    requireValue(object(catalogue) && catalogue.version === 1 && catalogue.baseRevision === baseRevision && Array.isArray(catalogue.items), 'Invalid synced catalogue or changed baseline export');
    const indexed = new Map(catalogue.items.map((item) => [item?.itemUuid, item]));
    requireValue(baseItems.every((item) => indexed.get(item.itemUuid)?.legacyId === item.legacyId), 'Synced catalogue cannot remove or change baseline identities');
    items = catalogue.items;
    requireValue(items.every((item) => object(item)), 'Invalid synced item record');
    manifest = { ...baseManifest, ...countRecords(items), folders: Object.fromEntries([...new Set(items.map((item) => item.folder))].map((folder) => [folder, items.filter((item) => !item.syncDeletedAt && item.folder === folder).length])) };
    catalogueRevision = createHash('sha256').update(text).digest('hex');
  }
  const byUuid = new Map();
  const byId = new Map();
  for (const [index, item] of items.entries()) {
    requireValue(object(item) && identity(item.itemUuid) && identity(item.legacyId), `Missing item identity at record ${index + 1}`);
    requireValue(!byUuid.has(item.itemUuid) && !byId.has(item.legacyId), `Duplicate item identity at record ${index + 1}`);
    requireValue(object(item.sourceMetadata) && object(item.assets), `Invalid item record: ${item.itemUuid}`);
    requireValue(item.sourceMetadata.id === item.legacyId && item.sourceMetadata.itemUuid === item.itemUuid,
      `Conflicting source identity: ${item.itemUuid}`);
    byUuid.set(item.itemUuid, item);
    byId.set(item.legacyId, item);
  }
  const warnings = [];
  const assets = [];
  const inventory = { itemCount: items.filter((item) => !item.syncDeletedAt).length, originals: 0, previewFallbacks: 0, metadataOnly: 0,
    desktopThumbnails: 0, mobileThumbnails: 0 };
  const availableAssets = { image: 0, 'image-thumbs': 0, 'image-thumbs-mobile': 0 };
  const warn = (code, message, context = {}) => warnings.push({ code, message, ...context });
  for (const item of items) {
    if (item.syncDeletedAt) { byUuid.delete(item.itemUuid); byId.delete(item.legacyId); continue; }
    const context = { itemUuid: item.itemUuid, legacyId: item.legacyId };
    if (!item.assets.image) {
      inventory.metadataOnly++;
      warn('NO_MAIN_IMAGE', 'Record has no registered main image', context);
    }
    for (const variant of variants) {
      const asset = item.assets[variant];
      if (asset === undefined) {
        if (variant !== 'image') warn('NO_THUMBNAIL', `No registered ${variant}`, { ...context, variant });
        continue;
      }
      requireValue(object(asset) && identity(asset.path) && Number.isSafeInteger(asset.byteSize) && asset.byteSize >= 0,
        `Invalid ${variant} descriptor: ${item.itemUuid}`);
      if (variant === 'image') {
        requireValue(['original', 'preview-fallback'].includes(asset.kind), `Invalid image kind: ${item.itemUuid}`);
        inventory[asset.kind === 'original' ? 'originals' : 'previewFallbacks']++;
        if (asset.kind === 'preview-fallback') warn('ORIGINAL_UNRESOLVED', 'Using a preview fallback, not an original', context);
      } else inventory[variant === 'image-thumbs' ? 'desktopThumbnails' : 'mobileThumbnails']++;
      const file = await inspectPath(root, asset.path);
      assets.push({ ...context, variant, descriptor: asset, ...file });
      if (!file.exists) warn('MISSING_ASSET', 'Registered asset file is missing', { ...context, variant, path: asset.path });
      else if (!file.isFile) warn('ASSET_NOT_FILE', 'Registered asset is not a regular file', { ...context, variant, path: asset.path });
      else {
        availableAssets[variant]++;
        if (file.actualByteSize !== asset.byteSize) warn('ASSET_SIZE_MISMATCH', 'Recorded and actual byte sizes differ',
          { ...context, variant, path: asset.path, expected: asset.byteSize, actual: file.actualByteSize });
      }
    }
    // This is a registered preservation asset too; sourcePath inside raw metadata
    // is provenance only and is deliberately never followed.
    if (item.preservedPreview !== undefined) {
      const file = await inspectPath(root, item.preservedPreview);
      assets.push({ ...context, variant: 'preserved-preview', descriptor: { path: item.preservedPreview }, ...file });
      if (!file.exists || !file.isFile) warn('MISSING_PRESERVED_PREVIEW', 'Preserved preview is unavailable', context);
    }
    for (const [variant, asset] of Object.entries(item.assets)) {
      if (!variants.includes(variant)) {
        requireValue(object(asset) && identity(asset.path), `Invalid extra asset: ${item.itemUuid}/${variant}`);
        const file = await inspectPath(root, asset.path);
        assets.push({ ...context, variant, descriptor: asset, ...file });
        warn('UNKNOWN_ASSET_VARIANT', 'Unrecognized asset variant retained', { ...context, variant });
      }
    }
  }
  for (const [key, actual] of Object.entries(inventory)) {
    if (manifest[key] !== undefined) requireValue(Number.isSafeInteger(manifest[key]) && manifest[key] === actual,
      `Manifest ${key} count mismatch: declared ${manifest[key]}, records ${actual}`);
  }
  function checkBoard(board, location) {
    if (board == null) return;
    requireValue(object(board) && Array.isArray(board.images), `Invalid board structure: ${location}`);
    for (const [index, placement] of board.images.entries()) {
      requireValue(object(placement), `Invalid board placement: ${location}.images[${index}]`);
      const uuid = byUuid.get(placement.referenceItemUuid);
      const legacy = byId.get(placement.referenceId);
      const context = { board: location, placementIndex: index, referenceId: placement.referenceId,
        referenceItemUuid: placement.referenceItemUuid };
      if (!uuid && !legacy) warn('UNRESOLVED_BOARD_REFERENCE', 'Board placement does not resolve to an item', context);
      else if (uuid && legacy && uuid !== legacy) warn('CONFLICTING_BOARD_REFERENCE', 'Board IDs resolve to different items', context);
      else if ((identity(placement.referenceItemUuid) && !uuid) || (identity(placement.referenceId) && !legacy)) {
        warn('STALE_BOARD_REFERENCE', 'Only one of the board placement identities resolves', context);
      }
    }
  }
  checkBoard(appState.board, 'board');
  if (appState.savedOutfits !== undefined) {
    requireValue(Array.isArray(appState.savedOutfits), 'Invalid savedOutfits: expected an array');
    appState.savedOutfits.forEach((saved, index) => {
      requireValue(object(saved), `Invalid savedOutfits[${index}]`);
      checkBoard(saved.board, `savedOutfits[${index}].board`);
    });
  }
  return { root, manifest, baseManifest, baseRevision, catalogueRevision, items, appState, assets, inventory, availableAssets, warnings };
}
