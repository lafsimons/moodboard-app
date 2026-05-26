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
