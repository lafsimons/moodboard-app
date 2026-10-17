import { generateBoard, resolveBoardLayoutViewportClass } from './generation.js';
import { buildBoardRenderMetadata, getItemPresentationAspectRatio } from './boardBounds.js';
import { createBoardUuid } from './boardIdentity.js';
import { selectFolderLibraryItems } from './folderLibraryView.js';

export const defaultFolderBoardFilters = { search: '', folder: '', tags: [], tagMode: 'all', sort: 'name' };
export function folderBoardSettings(value = {}) {
  return {
    imageCount: Number.isInteger(value.imageCount) && value.imageCount >= 1 && value.imageCount <= 30 ? value.imageCount : 15,
    generationMode: ['guided', 'random'].includes(value.generationMode) ? value.generationMode : 'guided'
  };
}

export function folderBoardPool(items, filters) {
  return selectFolderLibraryItems(items, filters).filter((item) => !item.syncDeletedAt && item.imageKind !== 'metadata-only' &&
    ['image', 'image-thumbs', 'image-thumbs-mobile'].some((variant) => item.assets?.[variant]?.url));
}

export function folderBoardLayoutOptions(items, viewport = {}) {
  const aspectRatiosByReferenceId = {}, sizeMultipliersByReferenceId = {}, renderMetadataByReferenceId = {};
  for (const item of items) {
    const media = [item.assets.image, item.assets['image-thumbs'], item.assets['image-thumbs-mobile']].find((asset) => asset?.width > 0 && asset?.height > 0);
    const metrics = { naturalWidth: media?.width ?? 1, naturalHeight: media?.height ?? 1 };
    const render = buildBoardRenderMetadata(item.presentation, metrics);
    aspectRatiosByReferenceId[item.id] = getItemPresentationAspectRatio(item.presentation, metrics);
    sizeMultipliersByReferenceId[item.id] = render.sizeMultiplier;
    renderMetadataByReferenceId[item.id] = render;
  }
  return { aspectRatiosByReferenceId, sizeMultipliersByReferenceId, renderMetadataByReferenceId,
    viewportClass: resolveBoardLayoutViewportClass(viewport) };
}

export function generateFolderBoard(items, filters, settings, viewport = {}) {
  const pool = folderBoardPool(items, filters);
  if (!pool.length) throw new Error('No available images match these filters. Your current board is unchanged.');
  const result = generateBoard({
    items: pool.map((item) => ({ ...item.generation, id: item.id, itemUuid: item.itemUuid, tags: item.tags, favorite: item.favorite })),
    ...folderBoardSettings(settings),
    itemsAreFiltered: true,
    boardFilters: { tags: filters.tags, tagMatchMode: filters.tagMode },
    layoutOptions: folderBoardLayoutOptions(pool, viewport)
  });
  if (!result.board?.images?.length) throw new Error('The generator returned no images. Your current board is unchanged.');
  return { ...result.board, boardUuid: createBoardUuid() };
}
