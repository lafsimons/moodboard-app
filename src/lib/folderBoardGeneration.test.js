import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBoard } from './generation.js';
import { folderBoardPool, generateFolderBoard, folderBoardLayoutOptions, folderBoardSettings, defaultFolderBoardFilters } from './folderBoardGeneration.js';
import { buildBoardRenderMetadata, getItemPresentationAspectRatio } from './boardBounds.js';

function item(index, overrides = {}) {
  return { id: `legacy-${index}`, itemUuid: `uuid-${index}`, name: `Photo ${index}`, tags: ['brand/tt'], description: '', folder: 'Brands/TT', favorite: false,
    presentation: {}, imageKind: 'original', assets: { image: { url: `/media/${index}`, width: 500, height: 1000 } }, ...overrides };
}

test('generation uses the entire shared pool, hierarchical folders, all/any tags and availability', () => {
  const items = Array.from({ length: 100 }, (_, index) => item(index));
  items.push(item('other', { folder: 'People/Aapo', tags: ['people/aapo'] }), item('missing', { assets: {} }), item('metadata', { imageKind: 'metadata-only' }), item('deleted', { syncDeletedAt: 'deleted' }));
  items[0].imageKind = 'preview-fallback';
  assert.equal(folderBoardPool(items, { ...defaultFolderBoardFilters, folder: 'Brands' }).length, 100);
  const any = { ...defaultFolderBoardFilters, tags: ['brand', 'people'], tagMode: 'any' };
  assert.equal(folderBoardPool(items, any).length, 101);
  assert.equal(folderBoardPool(items, { ...any, tagMode: 'all' }).length, 0);
  const board = generateFolderBoard(items, { ...defaultFolderBoardFilters, search: 'Photo 99' }, { imageCount: 30 });
  assert.deepEqual(board.images.map((image) => image.referenceId), ['legacy-99']);
  assert.equal(board.images[0].referenceItemUuid, 'uuid-99'); assert.ok(board.boardUuid);
  assert.throws(() => generateFolderBoard(items, { ...any, tagMode: 'all' }, {}), /current board is unchanged/);
});

test('already-filtered generator input bypasses filtering only when explicitly enabled', () => {
  const items = [item(1, { tags: ['brand/tt'] }), item(2, { tags: ['people/aapo'] })];
  const options = { items, imageCount: 2, boardFilters: { tags: ['brand/tt', 'people/aapo'], tagMatchMode: 'all' } };
  assert.equal(generateBoard(options).board.images.length, 0);
  assert.equal(generateBoard({ ...options, itemsAreFiltered: true }).board.images.length, 2);
});

test('adapter preserves both generation modes and existing render/layout metadata', () => {
  const record = item(1, { presentation: { imageScale: 140, imageFrameScale: 120, imageCropX: 10, imageCropWidth: 70, imageOffsetY: 12 }, favorite: true });
  const before = structuredClone(record);
  const metrics = { naturalWidth: 500, naturalHeight: 1000 };
  const layout = folderBoardLayoutOptions([record]);
  assert.deepEqual(layout.renderMetadataByReferenceId[record.id], buildBoardRenderMetadata(record.presentation, metrics));
  assert.equal(layout.aspectRatiosByReferenceId[record.id], getItemPresentationAspectRatio(record.presentation, metrics));
  for (const generationMode of ['random', 'guided']) {
    const board = generateFolderBoard([record], defaultFolderBoardFilters, { generationMode, imageCount: 15 });
    assert.equal(board.images.length, 1); assert.ok(board.width > 0 && board.height > 0);
    assert.ok(board.images.every((image) => Number.isFinite(image.x) && image.width > 0));
  }
  assert.deepEqual(record, before);
  assert.deepEqual(folderBoardSettings({ imageCount: 5, generationMode: 'random' }), { imageCount: 5, generationMode: 'random' });
  assert.deepEqual(folderBoardSettings({ imageCount: 31, generationMode: 'bad' }), { imageCount: 15, generationMode: 'guided' });
});
