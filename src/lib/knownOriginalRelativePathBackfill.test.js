import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKnownOriginalRelativePathBackfillResult,
  createKnownOriginalRelativePathBackfillReport
} from "./knownOriginalRelativePathBackfill.js";

function createItem(overrides = {}) {
  return {
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Item 1",
    originalPreserved: true,
    knownOriginalRelativePath: "",
    originalRelinkedRelativePath: "archive/accepted-path.jpg",
    sourceRelativePath: "source/layout-path.jpg",
    favorite: true,
    tags: ["archive/source"],
    ...overrides
  };
}

test("backfills from valid originalRelinkedRelativePath", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem());

  assert.equal(result.status, "affected");
  assert.equal(result.nextItem.knownOriginalRelativePath, "archive/accepted-path.jpg");
});

test("skips when originalPreserved is false", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem({
    originalPreserved: false
  }));

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "not_preserved");
});

test("skips when knownOriginalRelativePath already exists", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem({
    knownOriginalRelativePath: "existing/known.jpg"
  }));

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "already_backfilled");
});

test("skips invalid absolute path", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem({
    originalRelinkedRelativePath: "/Users/example/absolute.jpg"
  }));

  assert.equal(result.status, "invalid");
  assert.equal(result.reason, "invalid_original_relinked_relative_path");
});

test("skips parent-directory path", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem({
    originalRelinkedRelativePath: "../escape.jpg"
  }));

  assert.equal(result.status, "invalid");
  assert.equal(result.reason, "invalid_original_relinked_relative_path");
});

test("does not use sourceRelativePath", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem({
    originalRelinkedRelativePath: "",
    sourceRelativePath: "source/should-not-be-used.jpg"
  }));

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "missing_original_relinked_relative_path");
});

test("does not overwrite conflicts", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem({
    knownOriginalRelativePath: "trusted/existing.jpg",
    originalRelinkedRelativePath: "archive/different.jpg"
  }));

  assert.equal(result.status, "skipped");
  assert.equal(result.nextItem, null);
});

test("preserves unrelated metadata", () => {
  const result = buildKnownOriginalRelativePathBackfillResult(createItem({
    favorite: false,
    tags: ["one", "two"]
  }));

  assert.equal(result.nextItem.favorite, false);
  assert.deepEqual(result.nextItem.tags, ["one", "two"]);
});

test("report counts eligible affected skipped and invalid items", () => {
  const report = createKnownOriginalRelativePathBackfillReport([
    createItem(),
    createItem({
      id: "item-2",
      itemUuid: "uuid-2",
      knownOriginalRelativePath: "existing/known.jpg"
    }),
    createItem({
      id: "item-3",
      itemUuid: "uuid-3",
      originalRelinkedRelativePath: "/Users/example/absolute.jpg"
    }),
    createItem({
      id: "item-4",
      itemUuid: "uuid-4",
      originalPreserved: false
    })
  ], { exampleLimit: 10 });

  assert.equal(report.totalPreservedItemCount, 3);
  assert.equal(report.eligiblePreservedItemCount, 2);
  assert.equal(report.affectedCount, 1);
  assert.equal(report.skippedCount, 2);
  assert.equal(report.invalidPathCount, 1);
});
