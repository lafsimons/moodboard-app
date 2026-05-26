function normalizePositiveNumber(value) {
  return Math.max(Number(value) || 0, 0);
}

function clampNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
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

export function getReferencePreviewClickFocus({ clientX, clientY, contentRect }) {
  const contentWidth = normalizePositiveNumber(contentRect?.width);
  const contentHeight = normalizePositiveNumber(contentRect?.height);

  if (!contentWidth || !contentHeight) {
    return {
      xRatio: 0.5,
      yRatio: 0.5
    };
  }

  const localX = clampNumber((Number(clientX) || 0) - Number(contentRect?.left || 0), 0, contentWidth);
  const localY = clampNumber((Number(clientY) || 0) - Number(contentRect?.top || 0), 0, contentHeight);

  return {
    xRatio: clampNumber(localX / contentWidth, 0, 1),
    yRatio: clampNumber(localY / contentHeight, 0, 1)
  };
}

export function getReferencePreviewCenteredScrollPosition({
  focusRatio,
  containerWidth,
  containerHeight,
  contentWidth,
  contentHeight
}) {
  const normalizedContainerWidth = normalizePositiveNumber(containerWidth);
  const normalizedContainerHeight = normalizePositiveNumber(containerHeight);
  const normalizedContentWidth = normalizePositiveNumber(contentWidth);
  const normalizedContentHeight = normalizePositiveNumber(contentHeight);
  const xRatio = clampNumber(focusRatio?.xRatio ?? 0.5, 0, 1);
  const yRatio = clampNumber(focusRatio?.yRatio ?? 0.5, 0, 1);
  const maxScrollLeft = Math.max(0, normalizedContentWidth - normalizedContainerWidth);
  const maxScrollTop = Math.max(0, normalizedContentHeight - normalizedContainerHeight);
  const targetScrollLeft = normalizedContentWidth * xRatio - normalizedContainerWidth / 2;
  const targetScrollTop = normalizedContentHeight * yRatio - normalizedContainerHeight / 2;

  return {
    scrollLeft: clampNumber(targetScrollLeft, 0, maxScrollLeft),
    scrollTop: clampNumber(targetScrollTop, 0, maxScrollTop)
  };
}
