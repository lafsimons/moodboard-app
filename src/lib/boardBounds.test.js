import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBoardRenderMetadata,
  getBoardItemRenderedBounds,
  rectanglesIntersect
} from "./boardBounds.js";

test("getBoardItemRenderedBounds matches contained visible image edges after crop and scale metadata", () => {
  const item = {
    imageWidth: 1200,
    imageHeight: 1600,
    imageScale: 138,
    imageFrameScale: 118,
    imageOffsetX: 12,
    imageOffsetY: -8,
    imageCropX: 10,
    imageCropY: 6,
    imageCropWidth: 72,
    imageCropHeight: 84,
    rotation: 0
  };
  const renderMetadata = buildBoardRenderMetadata(item);
  const bounds = getBoardItemRenderedBounds(
    {
      x: 120,
      y: 80,
      width: 260,
      height: 360,
      rotation: 0
    },
    renderMetadata
  );

  assert.ok(bounds.visibleRect.left > bounds.frameRect.left);
  assert.equal(Math.round(bounds.visibleRect.top), bounds.frameRect.top);
  assert.ok(bounds.visibleRect.width < bounds.frameRect.width);
  assert.equal(Math.round(bounds.visibleRect.height), bounds.frameRect.height);
  assert.deepEqual(bounds.collisionRect, bounds.visibleRect);
});

test("getBoardItemRenderedBounds expands collision box for rotation", () => {
  const renderMetadata = {
    aspectRatio: 1,
    rotation: 8
  };
  const bounds = getBoardItemRenderedBounds(
    {
      x: 200,
      y: 140,
      width: 240,
      height: 240,
      rotation: 8
    },
    renderMetadata
  );

  assert.ok(bounds.collisionRect.width > bounds.visibleRect.width);
  assert.ok(bounds.collisionRect.height > bounds.visibleRect.height);
});

test("rendered collision rectangles report gutter intersections consistently", () => {
  const renderMetadata = {
    aspectRatio: 0.8,
    rotation: 6
  };
  const leftBounds = getBoardItemRenderedBounds(
    {
      x: 0,
      y: 0,
      width: 240,
      height: 300,
      rotation: 6
    },
    renderMetadata
  );
  const rightBounds = getBoardItemRenderedBounds(
    {
      x: 360,
      y: 0,
      width: 240,
      height: 300,
      rotation: -6
    },
    {
      ...renderMetadata,
      rotation: -6
    }
  );

  assert.equal(rectanglesIntersect(leftBounds.collisionRect, rightBounds.collisionRect, 20), false);
  assert.equal(rectanglesIntersect(leftBounds.collisionRect, rightBounds.collisionRect, 0), false);
});

test("buildBoardRenderMetadata uses resolved media dimensions to preserve aspect ratio for metadata-only items", () => {
  const metadataOnlyItem = {
    imageWidth: 1,
    imageHeight: 1,
    imageCropWidth: 100,
    imageCropHeight: 100
  };

  const fallbackMetadata = buildBoardRenderMetadata(metadataOnlyItem);
  const resolvedMetadata = buildBoardRenderMetadata(metadataOnlyItem, {
    naturalWidth: 800,
    naturalHeight: 1200
  });

  assert.equal(fallbackMetadata.aspectRatio, 1);
  assert.equal(Math.round(resolvedMetadata.aspectRatio * 1000) / 1000, 0.667);
});
