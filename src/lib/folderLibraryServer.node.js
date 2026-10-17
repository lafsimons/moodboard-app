import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream';
import { readFolderLibrary, inspectPath } from './folderLibraryReader.node.js';
import { projectFolderBoard } from './folderBoardView.js';
import { readFolderLibraryEdits, effectiveMetadata, saveFolderLibraryMetadata, MetadataEditError } from './folderLibraryEdits.node.js';
import { scanFolderLibrary, syncPreview, applyFolderLibrarySync } from './folderLibrarySync.node.js';
import { readFolderBoards, saveFolderBoards } from './folderBoards.node.js';

export const FOLDER_LIBRARY_PREFIX = '/__folder-library';
const renderVariants = new Set(['image', 'image-thumbs', 'image-thumbs-mobile']);
const imageTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif' };
const presentationFields = ['imageScale', 'imageFrameScale', 'imageOffsetX', 'imageOffsetY', 'imageCropX', 'imageCropY', 'imageCropWidth', 'imageCropHeight'];
const assetKey = (id, variant) => JSON.stringify([id, variant]);

// Deliberate allowlist: never serialize sourceMetadata, filesystem paths, raw
// warnings, or appState into the browser response. Full records stay on disk.
export function folderLibraryClientSnapshot(snapshot, edits = { version: 1, items: [] }) {
  const indexed = new Map(snapshot.assets.map((asset) => [assetKey(asset.itemUuid, asset.variant), asset]));
  return {
    inventory: snapshot.inventory,
    currentBoard: projectFolderBoard(snapshot.appState.board),
    warningCounts: snapshot.warnings.reduce((counts, warning) => {
      counts[warning.code] = (counts[warning.code] ?? 0) + 1;
      return counts;
    }, {}),
    items: snapshot.items.filter((record) => !record.syncDeletedAt).map((record) => {
      const source = record.sourceMetadata;
      const assets = {};
      for (const variant of renderVariants) {
        const asset = indexed.get(assetKey(record.itemUuid, variant));
        if (asset?.exists && asset.isFile && imageTypes[path.extname(asset.descriptor.path).toLowerCase()]) {
          const descriptor = asset.descriptor;
          assets[variant] = {
            url: `${FOLDER_LIBRARY_PREFIX}/media/${encodeURIComponent(record.itemUuid)}/${variant}`,
            width: Number(descriptor.width) || 0, height: Number(descriptor.height) || 0,
            byteSize: asset.actualByteSize
          };
        }
      }
      return {
        id: record.legacyId, itemUuid: record.itemUuid,
        folder: typeof record.folder === 'string' ? record.folder : '',
        createdAt: typeof source.createdAt === 'number' || typeof source.createdAt === 'string' ? source.createdAt : null,
        imageKind: record.assets.image?.kind ?? 'metadata-only',
        presentation: Object.fromEntries(presentationFields.filter((field) => Number.isFinite(source[field])).map((field) => [field, source[field]])),
        generation: Object.fromEntries(['list', 'type', 'garmentType', 'layerType', 'accessorySlot', 'weight', 'styleTags', 'climateTags'].flatMap((field) =>
          typeof source[field] === 'string' ? [[field, source[field]]] : Array.isArray(source[field]) ? [[field, source[field].filter((value) => typeof value === 'string')]] : [])),
        assets,
        ...effectiveMetadata(record, edits)
      };
    })
  };
}

function localRequest(req) {
  const address = req.socket.remoteAddress ?? '';
  if (!(address === '::1' || /^127\./.test(address) || /^::ffff:127\./.test(address))) return false;
  const host = req.headers.host;
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)) return false;
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return false;
  if (req.headers.origin && ![`http://${host}`, `https://${host}`].includes(req.headers.origin)) return false;
  return true;
}

export function createFolderLibraryMiddleware(root) {
  let current = null;
  let pending = null;
  let scanRevision = null;
  async function load(refresh = false) {
    if (pending) return pending;
    if (current && !refresh) return current;
    pending = readFolderLibrary(root).then((snapshot) => {
      current = snapshot;
      return snapshot;
    }).catch((error) => { current = null; throw error; }).finally(() => { pending = null; });
    return pending;
  }
  return async (req, res, next) => {
    const pathname = (req.url ?? '').split('?')[0];
    if (!(pathname === FOLDER_LIBRARY_PREFIX || pathname.startsWith(`${FOLDER_LIBRARY_PREFIX}/`))) return next();
    const fail = (status, message) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: message }));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (!localRequest(req)) return fail(403, 'Folder library access is local and same-origin only.');
    const editMatch = pathname.match(/^\/__folder-library\/items\/([^/]+)\/metadata$/);
    const boardsRoute = pathname === `${FOLDER_LIBRARY_PREFIX}/boards`;
    const syncAction = pathname === `${FOLDER_LIBRARY_PREFIX}/sync/scan` ? 'scan' : pathname === `${FOLDER_LIBRARY_PREFIX}/sync/apply` ? 'apply' : null;
    if (!['GET', 'HEAD'].includes(req.method) && !(editMatch && req.method === 'PATCH') && !(syncAction && req.method === 'POST') && !(boardsRoute && req.method === 'PUT')) {
      res.setHeader('Allow', 'GET, HEAD');
      return fail(405, 'This resource does not accept that method.');
    }
    try {
      if (boardsRoute) {
        let request;
        if (req.method === 'PUT') {
          if (!req.headers.origin) return fail(403, 'Board saves require a same-origin request.');
          if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return fail(415, 'Board saves require JSON.');
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 8 * 1024 * 1024) return fail(413, 'Board state is too large.');
            chunks.push(chunk);
          }
          try { request = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail(400, 'Invalid board JSON.'); }
        }
        const snapshot = await load(true);
        const result = req.method === 'PUT' ? await saveFolderBoards(snapshot, request) : await readFolderBoards(snapshot);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(result));
      }
      if (syncAction && req.method === 'POST') {
        if (!req.headers.origin) return fail(403, 'Folder sync requires a same-origin request.');
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return fail(415, 'Folder sync requires JSON.');
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4096) return fail(413, 'Sync request is too large.');
          chunks.push(chunk);
        }
        let request;
        try { request = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail(400, 'Invalid sync JSON.'); }
        let result;
        if (syncAction === 'scan') {
          scanRevision = null;
          result = syncPreview(await scanFolderLibrary(root));
          scanRevision = result.revision;
        } else {
          if (!scanRevision || request?.revision !== scanRevision) return fail(409, 'Scan folders and review the changes before applying.');
          result = await applyFolderLibrarySync(root, scanRevision);
          scanRevision = null;
          // A catalogue read started before the commit must not repopulate the
          // media cache with old paths after this invalidation.
          if (pending) await pending.catch(() => {});
          current = null;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(result));
      }
      if (editMatch && req.method === 'PATCH') {
        // JSON + a mandatory matching Origin prevent cross-site form writes.
        if (!req.headers.origin) return fail(403, 'Metadata saves require a same-origin request.');
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return fail(415, 'Metadata saves require JSON.');
        let uuid;
        try { uuid = decodeURIComponent(editMatch[1]); } catch { return fail(400, 'Invalid image identity.'); }
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 256 * 1024) return fail(413, 'Metadata request is too large.');
          chunks.push(chunk);
        }
        let request;
        try { request = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail(400, 'Invalid metadata JSON.'); }
        const snapshot = await load(true);
        const metadata = await saveFolderLibraryMetadata(snapshot, uuid, request);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ itemUuid: uuid, ...metadata }));
      }
      if (pathname === `${FOLDER_LIBRARY_PREFIX}/catalog`) {
        const snapshot = await load(true);
        const body = JSON.stringify(folderLibraryClientSnapshot(snapshot, await readFolderLibraryEdits(snapshot)));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      const match = pathname.match(/^\/__folder-library\/media\/([^/]+)\/(image|image-thumbs|image-thumbs-mobile)$/);
      if (!match) return fail(404, 'Unknown folder library resource.');
      let uuid;
      try { uuid = decodeURIComponent(match[1]); } catch { return fail(400, 'Invalid media identity.'); }
      const snapshot = await load();
      const asset = snapshot.assets.find((entry) => entry.itemUuid === uuid && entry.variant === match[2]);
      if (!asset) return fail(404, 'Image is not registered in this library.');
      // Recheck each request: a file may have moved or become a symlink since catalog loading.
      const file = await inspectPath(snapshot.root, asset.descriptor.path);
      const contentType = imageTypes[path.extname(asset.descriptor.path).toLowerCase()];
      if (!file.exists || !file.isFile || !contentType) return fail(404, 'Image is unavailable.');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', file.actualByteSize);
      if (req.method === 'HEAD') return res.end();
      pipeline(createReadStream(file.absolutePath), res, () => {});
    } catch (error) {
      if (error instanceof MetadataEditError) return fail(error.status, error.message);
      if (boardsRoute) return fail(503, 'Board storage is unavailable. Check the library files and permissions. Your unsaved board can be retried.');
      if (syncAction) return fail(503, 'Folder sync could not finish. Check the library files and permissions, then scan again. Existing records are retained.');
      // Do not disclose local filesystem paths in HTTP errors.
      fail(503, req.method === 'PATCH' ? 'Metadata save could not be confirmed. Your draft is still here. Check the library files and permissions, then load the saved version before retrying.' : 'The folder library could not be read. Check its location and run npm run library:check.');
    }
  };
}

export function folderLibraryPlugin() {
  const root = process.env.MOODBOARD_LIBRARY_ROOT
    ? path.resolve(process.env.MOODBOARD_LIBRARY_ROOT)
    : fileURLToPath(new URL('../../library-exports/moodboard-library-2026-09-21/', import.meta.url));
  const install = (server) => { server.middlewares.use(createFolderLibraryMiddleware(root)); };
  return { name: 'local-folder-library', configureServer: install, configurePreviewServer: install };
}
