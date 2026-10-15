import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream';
import { readFolderLibrary, inspectPath } from './folderLibraryReader.node.js';

export const FOLDER_LIBRARY_PREFIX = '/__folder-library';
const renderVariants = new Set(['image', 'image-thumbs', 'image-thumbs-mobile']);
const imageTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif' };
const presentationFields = ['imageScale', 'imageFrameScale', 'imageOffsetX', 'imageOffsetY', 'imageCropX', 'imageCropY', 'imageCropWidth', 'imageCropHeight'];
const assetKey = (id, variant) => JSON.stringify([id, variant]);

// Deliberate allowlist: never serialize sourceMetadata, filesystem paths, raw
// warnings, or appState into the browser response. Full records stay on disk.
export function folderLibraryClientSnapshot(snapshot) {
  const indexed = new Map(snapshot.assets.map((asset) => [assetKey(asset.itemUuid, asset.variant), asset]));
  return {
    inventory: snapshot.inventory,
    warningCounts: snapshot.warnings.reduce((counts, warning) => {
      counts[warning.code] = (counts[warning.code] ?? 0) + 1;
      return counts;
    }, {}),
    items: snapshot.items.map((record) => {
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
        name: typeof record.name === 'string' ? record.name : '',
        description: typeof source.description === 'string' ? source.description : '',
        tags: Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === 'string') : [],
        folder: typeof record.folder === 'string' ? record.folder : '',
        favorite: Boolean(source.favorite),
        createdAt: typeof source.createdAt === 'number' || typeof source.createdAt === 'string' ? source.createdAt : null,
        imageKind: record.assets.image?.kind ?? 'metadata-only',
        presentation: Object.fromEntries(presentationFields.filter((field) => Number.isFinite(source[field])).map((field) => [field, source[field]])),
        assets
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
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return fail(405, 'Folder library is read-only.');
    }
    try {
      if (pathname === `${FOLDER_LIBRARY_PREFIX}/catalog`) {
        const snapshot = await load(true);
        const body = JSON.stringify(folderLibraryClientSnapshot(snapshot));
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
    } catch {
      // Do not disclose local filesystem paths in HTTP errors.
      fail(503, 'The folder library could not be read. Check its location and run npm run library:check.');
    }
  };
}

export function folderLibraryPlugin() {
  const root = process.env.MOODBOARD_LIBRARY_ROOT
    ? path.resolve(process.env.MOODBOARD_LIBRARY_ROOT)
    : fileURLToPath(new URL('../../library-exports/moodboard-library-2026-09-21/', import.meta.url));
  const install = (server) => { server.middlewares.use(createFolderLibraryMiddleware(root)); };
  return { name: 'local-read-only-folder-library', configureServer: install, configurePreviewServer: install };
}
