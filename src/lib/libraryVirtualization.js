export function getVirtualizedGridLayout({
  itemCount,
  viewportWidth,
  viewportHeight,
  scrollTop,
  gridOffsetTop,
  minColumnWidth,
  gap,
  estimatedRowHeight,
  overscanRows
}) {
  const normalizedItemCount = Math.max(0, Math.round(Number(itemCount) || 0));

  if (!normalizedItemCount) {
    return {
      columns: 1,
      columnWidth: Math.max(Number(minColumnWidth) || 0, 0),
      rowStride: Math.max((Number(estimatedRowHeight) || 0) + (Number(gap) || 0), 0),
      startIndex: 0,
      endIndex: 0,
      totalRows: 0,
      totalHeight: 0
    };
  }

  const normalizedMinColumnWidth = Math.max(Number(minColumnWidth) || 1, 1);
  const normalizedGap = Math.max(Number(gap) || 0, 0);
  const normalizedEstimatedRowHeight = Math.max(Number(estimatedRowHeight) || 1, 1);
  const normalizedOverscanRows = Math.max(0, Math.round(Number(overscanRows) || 0));
  const availableWidth = Math.max(Number(viewportWidth) || 0, normalizedMinColumnWidth);
  const columns = Math.max(
    1,
    Math.floor((availableWidth + normalizedGap) / (normalizedMinColumnWidth + normalizedGap))
  );
  const columnWidth = Math.max(
    normalizedMinColumnWidth,
    Math.floor((availableWidth - normalizedGap * (columns - 1)) / columns)
  );
  const rowStride = normalizedEstimatedRowHeight + normalizedGap;
  const normalizedGridOffsetTop = Math.max(Number(gridOffsetTop) || 0, 0);
  const normalizedScrollTop = Math.max(Number(scrollTop) || 0, 0);
  const gridViewportTop = normalizedScrollTop - normalizedGridOffsetTop;
  const normalizedViewportHeight = Math.max(Number(viewportHeight) || 0, rowStride);
  const startRow = Math.max(0, Math.floor(gridViewportTop / rowStride) - normalizedOverscanRows);
  const endRow = Math.max(
    startRow,
    Math.ceil((gridViewportTop + normalizedViewportHeight) / rowStride) + normalizedOverscanRows
  );
  const startIndex = Math.min(normalizedItemCount, startRow * columns);
  const endIndex = Math.min(normalizedItemCount, endRow * columns);
  const totalRows = Math.ceil(normalizedItemCount / columns);
  const totalHeight = Math.max(
    0,
    totalRows * normalizedEstimatedRowHeight + Math.max(0, totalRows - 1) * normalizedGap
  );

  return {
    columns,
    columnWidth,
    rowStride,
    startIndex,
    endIndex,
    totalRows,
    totalHeight
  };
}
