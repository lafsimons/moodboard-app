import test from "node:test";
import assert from "node:assert/strict";

import { getVirtualizedGridLayout } from "./libraryVirtualization.js";

test("getVirtualizedGridLayout renders the first visible rows across every measured column", () => {
  const layout = getVirtualizedGridLayout({
    itemCount: 240,
    viewportWidth: 720,
    viewportHeight: 600,
    scrollTop: 0,
    gridOffsetTop: 0,
    minColumnWidth: 164,
    gap: 12,
    estimatedRowHeight: 222,
    overscanRows: 2
  });

  assert.equal(layout.columns, 4);
  assert.equal(layout.columnWidth, 171);
  assert.equal(layout.startIndex, 0);
  assert.equal(layout.endIndex, 20);
  assert.equal(layout.totalRows, 60);
  assert.equal(layout.totalHeight, 14028);
});

test("getVirtualizedGridLayout keeps row math stable when the grid starts below sticky controls", () => {
  const layout = getVirtualizedGridLayout({
    itemCount: 240,
    viewportWidth: 720,
    viewportHeight: 600,
    scrollTop: 620,
    gridOffsetTop: 180,
    minColumnWidth: 164,
    gap: 12,
    estimatedRowHeight: 222,
    overscanRows: 2
  });

  assert.equal(layout.columns, 4);
  assert.equal(layout.startIndex, 0);
  assert.equal(layout.endIndex, 28);
});
