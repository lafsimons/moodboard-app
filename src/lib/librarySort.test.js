import test from "node:test";
import assert from "node:assert/strict";

import { compareNaturalLibraryText, sortLibraryItems } from "./librarySort.js";

function createItem(id, overrides = {}) {
  return {
    id,
    name: id,
    tags: [],
    favorite: false,
    createdAt: 0,
    ...overrides
  };
}

function getDisplayName(item) {
  return item.name;
}

function compareCreatedAt(leftItem, rightItem, direction = "desc") {
  return direction === "asc"
    ? leftItem.createdAt - rightItem.createdAt
    : rightItem.createdAt - leftItem.createdAt;
}

test("compareNaturalLibraryText keeps locale-aware numeric ordering case-insensitive", () => {
  const values = ["10", "beta", "2", "Alpha", "100", "1", "alpha"];

  assert.deepEqual(values.sort(compareNaturalLibraryText), ["1", "2", "10", "100", "Alpha", "alpha", "beta"]);
});

test("sortLibraryItems applies natural Name A-Z ordering", () => {
  const items = [
    createItem("ten", { name: "Look 10" }),
    createItem("two", { name: "look 2" }),
    createItem("hundred", { name: "Look 100" }),
    createItem("one", { name: "look 1" })
  ];

  assert.deepEqual(
    sortLibraryItems(items, "name", { getDisplayName, compareCreatedAt }).map((item) => item.name),
    ["look 1", "look 2", "Look 10", "Look 100"]
  );
});

test("sortLibraryItems applies natural Name Z-A ordering", () => {
  const items = [
    createItem("one", { name: "Look 1" }),
    createItem("hundred", { name: "Look 100" }),
    createItem("two", { name: "look 2" }),
    createItem("ten", { name: "Look 10" })
  ];

  assert.deepEqual(
    sortLibraryItems(items, "name-desc", { getDisplayName, compareCreatedAt }).map((item) => item.name),
    ["Look 100", "Look 10", "look 2", "Look 1"]
  );
});

test("sortLibraryItems applies natural Tag A-Z ordering from each item's sorted tags", () => {
  const items = [
    createItem("ten", { name: "Ten", tags: ["look 10", "zebra"] }),
    createItem("two", { name: "Two", tags: ["Look 2"] }),
    createItem("hundred", { name: "Hundred", tags: ["look 100"] }),
    createItem("one", { name: "One", tags: ["look 1"] })
  ];

  assert.deepEqual(
    sortLibraryItems(items, "tag", { getDisplayName, compareCreatedAt }).map((item) => item.name),
    ["One", "Two", "Ten", "Hundred"]
  );
});

test("sortLibraryItems preserves existing non-name sort semantics", () => {
  const items = [
    createItem("first", { name: "b", favorite: false, createdAt: 100 }),
    createItem("second", { name: "a", favorite: true, createdAt: 300 }),
    createItem("third", { name: "c", favorite: true, createdAt: 200 })
  ];

  assert.deepEqual(
    sortLibraryItems(items, "favorites", { getDisplayName, compareCreatedAt }).map((item) => item.id),
    ["third", "second", "first"]
  );
  assert.deepEqual(
    sortLibraryItems(items, "newest", { getDisplayName, compareCreatedAt }).map((item) => item.id),
    ["second", "third", "first"]
  );
  assert.deepEqual(
    sortLibraryItems(items, "oldest", { getDisplayName, compareCreatedAt }).map((item) => item.id),
    ["first", "third", "second"]
  );
});
