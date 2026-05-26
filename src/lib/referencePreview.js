export const REFERENCE_PREVIEW_ZOOM_SCALE = 2;

export function createDefaultReferencePreviewZoomState() {
  return {
    isZoomed: false,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    contentWidth: 0,
    contentHeight: 0,
    viewportWidth: 0,
    viewportHeight: 0
  };
}

export function getReferencePreviewNavigation(items, activeId) {
  const orderedItems = Array.isArray(items) ? items : [];
  const activeIndex = orderedItems.findIndex((item) => item?.id === activeId);

  if (activeIndex < 0) {
    return {
      activeIndex: -1,
      total: orderedItems.length,
      previousItem: null,
      nextItem: null,
      hasPrevious: false,
      hasNext: false
    };
  }

  const previousItem = activeIndex > 0 ? orderedItems[activeIndex - 1] : null;
  const nextItem = activeIndex < orderedItems.length - 1 ? orderedItems[activeIndex + 1] : null;

  return {
    activeIndex,
    total: orderedItems.length,
    previousItem,
    nextItem,
    hasPrevious: Boolean(previousItem),
    hasNext: Boolean(nextItem)
  };
}

function normalizePositiveNumber(value) {
  return Math.max(Number(value) || 0, 0);
}

export function getReferencePreviewPanLimits({
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  scale
}) {
  const normalizedContentWidth = normalizePositiveNumber(contentWidth);
  const normalizedContentHeight = normalizePositiveNumber(contentHeight);
  const normalizedViewportWidth = normalizePositiveNumber(viewportWidth);
  const normalizedViewportHeight = normalizePositiveNumber(viewportHeight);
  const normalizedScale = Math.max(Number(scale) || 1, 1);
  const scaledWidth = normalizedContentWidth * normalizedScale;
  const scaledHeight = normalizedContentHeight * normalizedScale;

  return {
    maxOffsetX: Math.max(0, (scaledWidth - normalizedViewportWidth) / 2),
    maxOffsetY: Math.max(0, (scaledHeight - normalizedViewportHeight) / 2)
  };
}

export function clampReferencePreviewPan({
  offsetX,
  offsetY,
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  scale
}) {
  const { maxOffsetX, maxOffsetY } = getReferencePreviewPanLimits({
    contentWidth,
    contentHeight,
    viewportWidth,
    viewportHeight,
    scale
  });

  return {
    offsetX: Math.max(-maxOffsetX, Math.min(maxOffsetX, Number(offsetX) || 0)),
    offsetY: Math.max(-maxOffsetY, Math.min(maxOffsetY, Number(offsetY) || 0))
  };
}

export function createReferencePreviewZoomState({
  clientX,
  clientY,
  viewportRect,
  contentRect,
  scale = REFERENCE_PREVIEW_ZOOM_SCALE
}) {
  const viewportWidth = normalizePositiveNumber(viewportRect?.width);
  const viewportHeight = normalizePositiveNumber(viewportRect?.height);
  const contentWidth = normalizePositiveNumber(contentRect?.width);
  const contentHeight = normalizePositiveNumber(contentRect?.height);
  const normalizedScale = Math.max(Number(scale) || 1, 1);

  if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight) {
    return {
      isZoomed: true,
      scale: normalizedScale,
      offsetX: 0,
      offsetY: 0,
      contentWidth,
      contentHeight,
      viewportWidth,
      viewportHeight
    };
  }

  const localX = Math.max(0, Math.min(contentWidth, (Number(clientX) || 0) - Number(contentRect.left || 0)));
  const localY = Math.max(0, Math.min(contentHeight, (Number(clientY) || 0) - Number(contentRect.top || 0)));
  const unclampedOffsetX = (contentWidth / 2 - localX) * normalizedScale;
  const unclampedOffsetY = (contentHeight / 2 - localY) * normalizedScale;
  const clampedOffsets = clampReferencePreviewPan({
    offsetX: unclampedOffsetX,
    offsetY: unclampedOffsetY,
    contentWidth,
    contentHeight,
    viewportWidth,
    viewportHeight,
    scale: normalizedScale
  });

  return {
    isZoomed: true,
    scale: normalizedScale,
    offsetX: clampedOffsets.offsetX,
    offsetY: clampedOffsets.offsetY,
    contentWidth,
    contentHeight,
    viewportWidth,
    viewportHeight
  };
}

export function panReferencePreview(currentZoomState, deltaX, deltaY, viewportRect = null) {
  const nextViewportWidth = normalizePositiveNumber(viewportRect?.width) || normalizePositiveNumber(currentZoomState?.viewportWidth);
  const nextViewportHeight = normalizePositiveNumber(viewportRect?.height) || normalizePositiveNumber(currentZoomState?.viewportHeight);
  const nextOffsets = clampReferencePreviewPan({
    offsetX: (Number(currentZoomState?.offsetX) || 0) + (Number(deltaX) || 0),
    offsetY: (Number(currentZoomState?.offsetY) || 0) + (Number(deltaY) || 0),
    contentWidth: currentZoomState?.contentWidth,
    contentHeight: currentZoomState?.contentHeight,
    viewportWidth: nextViewportWidth,
    viewportHeight: nextViewportHeight,
    scale: currentZoomState?.scale
  });

  return {
    ...currentZoomState,
    viewportWidth: nextViewportWidth,
    viewportHeight: nextViewportHeight,
    offsetX: nextOffsets.offsetX,
    offsetY: nextOffsets.offsetY
  };
}
