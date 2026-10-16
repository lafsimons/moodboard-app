import { buildBoardRenderMetadata, getBoardItemRenderedBounds } from './boardBounds.js';

const text = (value) => typeof value === 'string' ? value : '';
const number = (value, fallback) => Number.isFinite(value) ? value : fallback;

// A separate allowlist avoids exposing arbitrary fields from private appState.
export function projectFolderBoard(board) {
  if (!board) return null;
  return {
    id: text(board.id), boardUuid: text(board.boardUuid),
    width: number(board.width, 0), height: number(board.height, 0),
    images: board.images.map((image, index) => ({
      id: text(image.id) || `placement-${index}`,
      referenceId: text(image.referenceId), referenceItemUuid: text(image.referenceItemUuid),
      x: number(image.x, 0), y: number(image.y, 0),
      width: number(image.width, 220), height: number(image.height, 220),
      rotation: number(image.rotation, 0), zIndex: number(image.zIndex, index + 1)
    }))
  };
}

export function resolveFolderBoardPlacements(board, items) {
  const byUuid = new Map(items.map((item) => [item.itemUuid, item]));
  const byId = new Map(items.map((item) => [item.id, item]));
  return (board?.images ?? []).map((placement) => {
    const uuidMatch = byUuid.get(placement.referenceItemUuid);
    const idMatch = byId.get(placement.referenceId);
    const conflict = uuidMatch && idMatch && uuidMatch !== idMatch;
    const item = conflict ? null : uuidMatch || idMatch || null;
    const media = item?.assets['image-thumbs'] || item?.assets.image || item?.assets['image-thumbs-mobile'];
    let rect = { left: placement.x, top: placement.y, width: placement.width, height: placement.height };
    let render = null;
    if (item && media) {
      render = buildBoardRenderMetadata({ ...item.presentation, rotation: placement.rotation }, {
        naturalWidth: media.width || 1, naturalHeight: media.height || 1
      });
      rect = getBoardItemRenderedBounds(placement, render).visibleRect;
    }
    return { placement, item, media, rect, render,
      missingReason: conflict ? 'Conflicting image references' : !item ? 'Image reference missing' : !media ? 'Image unavailable' : '' };
  });
}

export function fitFolderBoard(board, size) {
  if (!(board?.width > 0 && board?.height > 0 && size.width > 0 && size.height > 0)) return { x: 0, y: 0, zoom: 1 };
  const zoom = Math.max(0.02, Math.min(4, (size.width - 32) / board.width, (size.height - 32) / board.height));
  return { zoom, x: (size.width - board.width * zoom) / 2, y: (size.height - board.height * zoom) / 2 };
}

export function zoomFolderBoard(view, factor, anchor) {
  const zoom = Math.max(0.02, Math.min(6, view.zoom * factor));
  return { zoom, x: anchor.x - (anchor.x - view.x) * zoom / view.zoom,
    y: anchor.y - (anchor.y - view.y) * zoom / view.zoom };
}
