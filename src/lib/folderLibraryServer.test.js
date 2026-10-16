import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, get } from 'node:http';
import { createFolderLibraryMiddleware } from './folderLibraryServer.node.js';
import { selectFolderLibraryItems, folderLibraryTagOptions } from './folderLibraryView.js';

async function serve(t) {
  const base = await mkdtemp(path.join(tmpdir(), 'folder-server-'));
  const root = path.join(base, 'library');
  await mkdir(path.join(root, 'metadata'), { recursive: true });
  await mkdir(path.join(root, 'public/images'), { recursive: true });
  const file = path.join(root, 'public/images/Été photo.jpg');
  await writeFile(file, 'abc');
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, itemCount: 1 }));
  await writeFile(path.join(root, 'metadata/appState.json'), JSON.stringify({ private: '/Users/private/board' }));
  await writeFile(path.join(root, 'metadata/items.ndjson'), JSON.stringify({
    itemUuid: 'uuid one', legacyId: 'legacy', name: 'Photo', folder: 'People/Aapo', tags: ['people/aapo'],
    sourceMetadata: { id: 'legacy', itemUuid: 'uuid one', description: 'Description', imageScale: 130,
      secret: '/Users/private/secret', sourceOriginalFilename: 'secret.jpg' },
    assets: { image: { kind: 'original', path: 'public/images/Été photo.jpg', byteSize: 3, width: 12, height: 20,
      sourcePath: '/Users/private/source.jpg' } }
  }));
  const middleware = createFolderLibraryMiddleware(root);
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(base, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${server.address().port}`;
  return { root, base, file, url, request: (pathname, options) => fetch(url + '/__folder-library' + pathname, options) };
}

test('catalogue uses a client-safe allowlist and registered media URLs', async (t) => {
  const f = await serve(t);
  const response = await f.request('/catalog');
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(!body.includes('/Users/') && !body.includes(f.root) && !body.includes('sourceMetadata') && !body.includes('appState'));
  const item = JSON.parse(body).items[0];
  assert.equal(item.id, 'legacy'); assert.deepEqual(item.tags, ['people/aapo']);
  assert.equal(item.presentation.imageScale, 130);
  const media = await fetch(f.url + item.assets.image.url);
  assert.equal(media.headers.get('content-type'), 'image/jpeg');
  assert.equal(media.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(await media.text(), 'abc');
  const head = await fetch(f.url + item.assets.image.url, { method: 'HEAD' });
  assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), '3');
});

test('denies writes, cross-origin requests and arbitrary files', async (t) => {
  const f = await serve(t);
  assert.equal((await f.request('/catalog', { method: 'POST' })).status, 405);
  assert.equal((await f.request('/catalog', { headers: { Origin: 'https://example.com' } })).status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    get(f.url + '/__folder-library/catalog', { headers: { Host: 'evil.example' } }, (response) => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await f.request('/metadata/items.ndjson')).status, 404);
  assert.equal((await f.request('/media/unregistered/image')).status, 404);
  assert.equal((await f.request('/media/uuid%20one/preserved-preview')).status, 404);
});

test('rechecks media symlinks after catalogue load without disclosing paths', async (t) => {
  const f = await serve(t);
  await f.request('/catalog');
  const outside = path.join(f.base, 'private.jpg'); await writeFile(outside, 'secret');
  await rm(f.file); await symlink(outside, f.file);
  const response = await f.request('/media/uuid%20one/image');
  assert.equal(response.status, 503);
  const text = await response.text(); assert.ok(!text.includes('secret') && !text.includes(f.base));
});

test('missing library recovers on retry and missing media returns 404', async (t) => {
  const f = await serve(t);
  const manifest = path.join(f.root, 'manifest.json'); await rm(manifest);
  assert.equal((await f.request('/catalog')).status, 503);
  await writeFile(manifest, JSON.stringify({ version: 1, itemCount: 1 }));
  assert.equal((await f.request('/catalog')).status, 200);
  await rm(f.file);
  assert.equal((await f.request('/media/uuid%20one/image')).status, 404);
});

test('filtering keeps multiple tags, parent matching, all/any and metadata-only items', () => {
  const items = [
    { id: 'a', name: 'Alpha', tags: ['people/aapo', 'brand/tt'], folder: 'People/Aapo', description: 'coat', createdAt: 1 },
    { id: 'b', name: 'Beta', tags: ['brand/tt'], folder: 'Brands/TT', description: '', createdAt: 2 },
    { id: 'c', name: 'Missing image', tags: ['people/philip'], folder: 'People/Philip', description: '', createdAt: 3 }
  ];
  assert.deepEqual(selectFolderLibraryItems(items, { tags: ['people', 'brand/tt'] }).map((i) => i.id), ['a']);
  assert.equal(selectFolderLibraryItems(items, { tags: ['people', 'brand/tt'], tagMode: 'any' }).length, 3);
  assert.deepEqual(selectFolderLibraryItems(items, { search: 'aapo coat' }).map((i) => i.id), ['a']);
  assert.deepEqual(selectFolderLibraryItems(items, { folder: 'People', sort: 'newest' }).map((i) => i.id), ['c', 'a']);
  assert.ok(folderLibraryTagOptions(items).includes('people'));
  assert.equal(items[0].id, 'a');
});

test('same-origin metadata PATCH persists through catalogue reload and rejects stale drafts', async (t) => {
  const f = await serve(t);
  const item = (await (await f.request('/catalog')).json()).items[0];
  const metadata = { name: 'Edited 日本', description: 'Saved description', tags: ['media/film', 'people/aapo'], favorite: true };
  const options = { method: 'PATCH', headers: { Origin: f.url, 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: item.metadataRevision, metadata }) };
  const response = await f.request('/items/uuid%20one/metadata', options);
  assert.equal(response.status, 200);
  const saved = await response.json(); assert.notEqual(saved.metadataRevision, item.metadataRevision);
  const reloaded = (await (await f.request('/catalog')).json()).items[0];
  for (const [field, value] of Object.entries(metadata)) assert.deepEqual(reloaded[field], value);
  assert.equal(reloaded.folder, item.folder); assert.deepEqual(reloaded.assets, item.assets); assert.equal(reloaded.id, item.id);
  assert.equal((await f.request('/items/uuid%20one/metadata', options)).status, 409);
  assert.equal((await f.request('/items/unknown/metadata', options)).status, 404);
});

test('metadata writes require a matching origin and JSON, with bounded payloads', async (t) => {
  const f = await serve(t);
  const endpoint = '/items/uuid%20one/metadata';
  assert.equal((await f.request(endpoint, { method: 'PATCH' })).status, 403);
  assert.equal((await f.request(endpoint, { method: 'PATCH', headers: { Origin: 'https://elsewhere.test', 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await f.request(endpoint, { method: 'PATCH', headers: { Origin: f.url, 'Content-Type': 'text/plain' } })).status, 415);
  const options = { method: 'PATCH', headers: { Origin: f.url, 'Content-Type': 'application/json' } };
  assert.equal((await f.request(endpoint, { ...options, body: '{broken' })).status, 400);
  assert.equal((await f.request(endpoint, { ...options, body: '{}' })).status, 400);
  assert.equal((await f.request(endpoint, { ...options, body: JSON.stringify({ value: 'x'.repeat(300000) }) })).status, 413);
  assert.equal((await f.request('/metadata/edits.json')).status, 404);
});
