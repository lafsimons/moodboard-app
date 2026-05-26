import test from "node:test";
import assert from "node:assert/strict";

import { getReferencePreviewNavigation } from "./referencePreview.js";

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
