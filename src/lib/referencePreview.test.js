import test from "node:test";
import assert from "node:assert/strict";

import {
  getReferencePreviewCenteredScrollPosition,
  getReferencePreviewClickFocus,
  getReferencePreviewNavigation
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

test("getReferencePreviewClickFocus calculates the clicked point as a ratio within the displayed image", () => {
  const focusRatio = getReferencePreviewClickFocus({
    clientX: 250,
    clientY: 170,
    contentRect: { left: 100, top: 50, width: 300, height: 240 }
  });

  assert.deepEqual(focusRatio, {
    xRatio: 0.5,
    yRatio: 0.5
  });
});

test("getReferencePreviewClickFocus clamps ratios safely near the image bounds", () => {
  const focusRatio = getReferencePreviewClickFocus({
    clientX: 600,
    clientY: -20,
    contentRect: { left: 100, top: 50, width: 300, height: 240 }
  });

  assert.deepEqual(focusRatio, {
    xRatio: 1,
    yRatio: 0
  });
});

test("getReferencePreviewCenteredScrollPosition centers the clicked point where possible", () => {
  const scrollPosition = getReferencePreviewCenteredScrollPosition({
    focusRatio: { xRatio: 0.75, yRatio: 0.25 },
    containerWidth: 500,
    containerHeight: 300,
    contentWidth: 1200,
    contentHeight: 900
  });

  assert.deepEqual(scrollPosition, {
    scrollLeft: 650,
    scrollTop: 75
  });
});

test("getReferencePreviewCenteredScrollPosition clamps scroll positions to container bounds", () => {
  const scrollPosition = getReferencePreviewCenteredScrollPosition({
    focusRatio: { xRatio: 1, yRatio: 1 },
    containerWidth: 500,
    containerHeight: 300,
    contentWidth: 700,
    contentHeight: 450
  });

  assert.deepEqual(scrollPosition, {
    scrollLeft: 200,
    scrollTop: 150
  });
});
