import test from "node:test";
import assert from "node:assert/strict";

import {
  clampReferencePreviewPan,
  createDefaultReferencePreviewZoomState,
  createReferencePreviewZoomState,
  getReferencePreviewNavigation,
  getReferencePreviewPanLimits,
  panReferencePreview,
  REFERENCE_PREVIEW_ZOOM_SCALE
} from "./referencePreview.js";

test("getReferencePreviewNavigation follows the current visible library order", () => {
  const items = [
    { id: "look-3" },
    { id: "look-1" },
    { id: "look-2" }
  ];

  const navigation = getReferencePreviewNavigation(items, "look-1");

  assert.equal(navigation.activeIndex, 1);
  assert.equal(navigation.total, 3);
  assert.equal(navigation.previousItem.id, "look-3");
  assert.equal(navigation.nextItem.id, "look-2");
  assert.equal(navigation.hasPrevious, true);
  assert.equal(navigation.hasNext, true);
});

test("getReferencePreviewNavigation safely handles the first and last visible items", () => {
  const items = [
    { id: "first" },
    { id: "middle" },
    { id: "last" }
  ];

  const firstNavigation = getReferencePreviewNavigation(items, "first");
  const lastNavigation = getReferencePreviewNavigation(items, "last");

  assert.equal(firstNavigation.previousItem, null);
  assert.equal(firstNavigation.nextItem.id, "middle");
  assert.equal(firstNavigation.hasPrevious, false);
  assert.equal(firstNavigation.hasNext, true);

  assert.equal(lastNavigation.previousItem.id, "middle");
  assert.equal(lastNavigation.nextItem, null);
  assert.equal(lastNavigation.hasPrevious, true);
  assert.equal(lastNavigation.hasNext, false);
});

test("getReferencePreviewNavigation returns a safe empty state when the previewed item is outside the visible list", () => {
  const navigation = getReferencePreviewNavigation([{ id: "visible" }], "hidden");

  assert.equal(navigation.activeIndex, -1);
  assert.equal(navigation.total, 1);
  assert.equal(navigation.previousItem, null);
  assert.equal(navigation.nextItem, null);
  assert.equal(navigation.hasPrevious, false);
  assert.equal(navigation.hasNext, false);
});

test("createReferencePreviewZoomState uses the click point to center the zoom where possible", () => {
  const zoomState = createReferencePreviewZoomState({
    clientX: 340,
    clientY: 180,
    viewportRect: { width: 420, height: 320 },
    contentRect: { left: 100, top: 40, width: 300, height: 240 }
  });

  assert.equal(zoomState.isZoomed, true);
  assert.equal(zoomState.scale, REFERENCE_PREVIEW_ZOOM_SCALE);
  assert.equal(zoomState.contentWidth, 300);
  assert.equal(zoomState.contentHeight, 240);
  assert.equal(zoomState.offsetX, -90);
  assert.equal(zoomState.offsetY, -40);
});

test("createReferencePreviewZoomState clamps click-centered zoom offsets at the image bounds", () => {
  const zoomState = createReferencePreviewZoomState({
    clientX: 100,
    clientY: 40,
    viewportRect: { width: 280, height: 220 },
    contentRect: { left: 100, top: 40, width: 300, height: 240 }
  });

  assert.equal(zoomState.offsetX, 160);
  assert.equal(zoomState.offsetY, 130);
});

test("panReferencePreview updates offsets and clamps panning so the image cannot disappear", () => {
  const nextZoomState = panReferencePreview({
    isZoomed: true,
    scale: 2,
    offsetX: -80,
    offsetY: -20,
    contentWidth: 300,
    contentHeight: 240,
    viewportWidth: 600,
    viewportHeight: 400
  }, 400, -300);

  assert.equal(nextZoomState.offsetX, 0);
  assert.equal(nextZoomState.offsetY, -40);
});

test("getReferencePreviewPanLimits reports available pan range from scaled image overflow", () => {
  const limits = getReferencePreviewPanLimits({
    contentWidth: 320,
    contentHeight: 200,
    viewportWidth: 400,
    viewportHeight: 240,
    scale: 2
  });

  assert.deepEqual(limits, {
    maxOffsetX: 120,
    maxOffsetY: 80
  });
});

test("clampReferencePreviewPan constrains offsets to the available pan range", () => {
  const clampedOffsets = clampReferencePreviewPan({
    offsetX: 500,
    offsetY: -500,
    contentWidth: 320,
    contentHeight: 200,
    viewportWidth: 400,
    viewportHeight: 240,
    scale: 2
  });

  assert.deepEqual(clampedOffsets, {
    offsetX: 120,
    offsetY: -80
  });
});

test("createDefaultReferencePreviewZoomState resets preview zoom back to fit mode", () => {
  assert.deepEqual(createDefaultReferencePreviewZoomState(), {
    isZoomed: false,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    contentWidth: 0,
    contentHeight: 0,
    viewportWidth: 0,
    viewportHeight: 0
  });
});
