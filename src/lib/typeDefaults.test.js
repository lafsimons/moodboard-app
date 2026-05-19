import test from "node:test";
import assert from "node:assert/strict";

import { normalizeList } from "./typeDefaults.js";

test("normalizeList defaults missing and empty values to Wardrobe", () => {
  assert.equal(normalizeList(), "Wardrobe");
  assert.equal(normalizeList(null), "Wardrobe");
  assert.equal(normalizeList(""), "Wardrobe");
  assert.equal(normalizeList("   "), "Wardrobe");
});

test("normalizeList preserves Wardrobe and Wishlist", () => {
  assert.equal(normalizeList("Wardrobe"), "Wardrobe");
  assert.equal(normalizeList("Wishlist"), "Wishlist");
});

test("normalizeList preserves unknown non-empty values", () => {
  assert.equal(normalizeList("Incoming"), "Incoming");
  assert.equal(normalizeList(" Archive "), "Archive");
});
