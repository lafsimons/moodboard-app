import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFolderBoard, resolveFolderBoardPlacements, fitFolderBoard, zoomFolderBoard } from './folderBoardView.js';
import { buildBoardRenderMetadata, getBoardItemRenderedBounds } from './boardBounds.js';

const board = { id: 'board', boardUuid: 'stable-board', width: 1710, height: 1300, privatePath: '/Users/private',
  images: [{ id: 'placement', referenceId: 'legacy', referenceItemUuid: 'uuid', x: 1042, y: 524,
    width: 266, height: 266, rotation: 25, zIndex: 3, sourcePath: '/Users/private.jpg' }] };
const item = { id: 'legacy', itemUuid: 'uuid', name: 'Photo', presentation: { imageScale: 130, imageFrameScale: 110,
  imageCropX: 10, imageCropY: 20, imageCropWidth: 70, imageCropHeight: 65, imageOffsetX: 10 },
  assets: { 'image-thumbs': { url: '/media/uuid/thumb', width: 500, height: 1000 } } };

test('projects current board with original geometry and references, excluding private fields', () => {
  const projected = projectFolderBoard(board);
  assert.equal(projected.boardUuid, board.boardUuid);
  assert.equal(projected.images[0].x, 1042);
  assert.equal(projected.images[0].rotation, 25);
  assert.equal(projected.images[0].zIndex, 3);
  assert.ok(!JSON.stringify(projected).includes('/Users'));
  assert.equal(projectFolderBoard(null), null);
});

test('uses the existing board geometry for crop, scaling, rotation and visible bounds without mutating records', () => {
  const before = JSON.stringify({ board, item });
  const [entry] = resolveFolderBoardPlacements(board, [item]);
  const render = buildBoardRenderMetadata({ ...item.presentation, rotation: 25 }, { naturalWidth: 500, naturalHeight: 1000 });
  assert.deepEqual(entry.rect, getBoardItemRenderedBounds(board.images[0], render).visibleRect);
  assert.deepEqual(entry.render.crop, { x: 10, y: 20, width: 70, height: 65 });
  assert.equal(entry.missingReason, '');
  assert.equal(JSON.stringify({ board, item }), before);
});

test('resolves UUID or legacy references, keeps duplicate placements and does not discard missing media', () => {
  const b = { ...board, images: [board.images[0], { ...board.images[0], referenceId: 'stale' },
    { ...board.images[0], referenceItemUuid: '' }, { ...board.images[0], referenceId: 'absent', referenceItemUuid: 'absent' }] };
  const entries = resolveFolderBoardPlacements(b, [item]);
  assert.equal(entries.length, 4);
  assert.ok(entries.slice(0, 3).every((entry) => entry.item === item));
  assert.equal(entries[3].missingReason, 'Image reference missing');
  assert.equal(entries[3].rect.left, 1042);
  assert.equal(resolveFolderBoardPlacements(board, [{ ...item, assets: {} }])[0].missingReason, 'Image unavailable');
});

test('conflicting identities get placeholders instead of a guessed image', () => {
  const other = { ...item, id: 'other', itemUuid: 'uuid2' };
  const b = { ...board, images: [{ ...board.images[0], referenceId: 'other' }] };
  assert.equal(resolveFolderBoardPlacements(b, [item, other])[0].missingReason, 'Conflicting image references');
});

test('empty or absent boards do not generate placements', () => {
  assert.deepEqual(resolveFolderBoardPlacements(null, []), []);
  assert.deepEqual(resolveFolderBoardPlacements({ ...board, images: [] }, []), []);
});

test('fit contains the full board and zoom preserves the world point under the anchor', () => {
  const view = fitFolderBoard(board, { width: 390, height: 600 });
  assert.ok(view.x >= 0 && view.y >= 0);
  assert.ok(board.width * view.zoom <= 390 && board.height * view.zoom <= 600);
  const anchor = { x: 180, y: 250 };
  const next = zoomFolderBoard(view, 1.2, anchor);
  assert.ok(Math.abs((anchor.x - view.x) / view.zoom - (anchor.x - next.x) / next.zoom) < 1e-8);
  assert.ok(Math.abs((anchor.y - view.y) / view.zoom - (anchor.y - next.y) / next.zoom) < 1e-8);
  assert.equal(zoomFolderBoard(view, 1000, anchor).zoom, 6);
  assert.equal(zoomFolderBoard(view, 0.00001, anchor).zoom, 0.02);
});
