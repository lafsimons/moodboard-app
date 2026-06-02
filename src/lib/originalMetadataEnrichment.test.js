import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLinkedOriginalMetadataEnrichmentResult,
  createLinkedOriginalMetadataEnrichmentReport
} from "./originalMetadataEnrichment.js";

function createLinkedItem(overrides = {}) {
  return {
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Linked Item",
    originalPreserved: true,
    sourceFileSize: 0,
    sourceImageWidth: 0,
    sourceImageHeight: 0,
    sourceLastModified: 0,
    mimeType: "",
    sourceOriginalFilename: "",
    sourceFilenameAliases: [],
    originalRelinkedFilename: "",
    originalRelinkedRelativePath: "",
    originalLinkedAt: "",
    images: {
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        fileSize: 123,
        originalFilename: "preview.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        fileSize: 45,
        originalFilename: "thumb.webp"
      },
      original: {
        src: "",
        mimeType: "",
        width: 0,
        height: 0,
        fileSize: 0,
        originalFilename: ""
      }
    },
    ...overrides
  };
}

function createOriginalEntry(overrides = {}) {
  return {
    itemUuid: "uuid-1",
    fileSize: 2048,
    width: 1600,
    height: 1200,
    mimeType: "image/jpeg",
    originalFilename: "linked-original.jpg",
    savedAt: Date.parse("2026-06-02T12:00:00.000Z"),
    ...overrides
  };
}

test("linked item with zero sourceFileSize gets original blob fileSize", () => {
  const result = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem(),
    createOriginalEntry()
  );

  assert.equal(result.status, "update");
  assert.equal(result.nextItem.sourceFileSize, 2048);
});

test("linked item with zero dimensions gets original blob width and height", () => {
  const result = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem(),
    createOriginalEntry()
  );

  assert.equal(result.nextItem.sourceImageWidth, 1600);
  assert.equal(result.nextItem.sourceImageHeight, 1200);
});

test("non-empty sourceOriginalFilename is not overwritten", () => {
  const result = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem({
      sourceOriginalFilename: "existing.jpg"
    }),
    createOriginalEntry()
  );

  assert.equal(result.nextItem.sourceOriginalFilename, "existing.jpg");
  assert.equal(result.changedFields.includes("sourceOriginalFilename"), false);
});

test("empty sourceOriginalFilename can be filled", () => {
  const result = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem(),
    createOriginalEntry()
  );

  assert.equal(result.nextItem.sourceOriginalFilename, "linked-original.jpg");
});

test("alias is appended and deduped", () => {
  const result = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem({
      sourceFilenameAliases: ["Linked-Original.jpg", "another.jpg"],
      sourceOriginalFilename: ""
    }),
    createOriginalEntry()
  );

  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["Linked-Original.jpg", "another.jpg"]);
});

test("unlinked and missing-original items are skipped", () => {
  const unlinked = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem({ originalPreserved: false }),
    createOriginalEntry()
  );
  const missingBlob = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem(),
    null
  );

  assert.equal(unlinked.status, "skipped");
  assert.equal(unlinked.reason, "not_linked");
  assert.equal(missingBlob.status, "skipped");
  assert.equal(missingBlob.reason, "missing_original_blob");
});

test("preview and thumbnail data remain unchanged", () => {
  const item = createLinkedItem();
  const result = buildLinkedOriginalMetadataEnrichmentResult(item, createOriginalEntry());

  assert.equal(result.nextItem.images.preview.src, item.images.preview.src);
  assert.equal(result.nextItem.images.thumbnail.src, item.images.thumbnail.src);
});

test("item id and itemUuid remain unchanged", () => {
  const result = buildLinkedOriginalMetadataEnrichmentResult(
    createLinkedItem(),
    createOriginalEntry()
  );

  assert.equal(result.nextItem.id, "item-1");
  assert.equal(result.nextItem.itemUuid, "uuid-1");
});

test("report tracks dry-run counts and field updates", () => {
  const report = createLinkedOriginalMetadataEnrichmentReport({
    items: [
      createLinkedItem(),
      createLinkedItem({
        id: "item-2",
        itemUuid: "uuid-2",
        sourceFileSize: 10,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/png",
        sourceOriginalFilename: "existing.png",
        originalRelinkedFilename: "existing.png",
        originalLinkedAt: "2026-06-01T00:00:00.000Z"
      }),
      createLinkedItem({
        id: "item-3",
        itemUuid: "uuid-3",
        originalPreserved: false
      })
    ],
    originalEntriesByItemUuid: {
      "uuid-1": createOriginalEntry(),
      "uuid-2": createOriginalEntry({
        itemUuid: "uuid-2",
        originalFilename: "existing.png",
        mimeType: "image/png",
        fileSize: 10,
        width: 100,
        height: 50
      })
    },
    recoverySessions: [
      {
        updatedAt: "2026-06-02T12:01:00.000Z",
        matches: [
          {
            itemId: "item-1",
            selectedCandidateId: "candidate-1",
            applyResult: { status: "recovered", appliedAt: "2026-06-02T12:01:00.000Z" },
            candidates: [
              {
                id: "candidate-1",
                relativePath: "archive/linked-original.jpg"
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(report.linkedItemCount, 2);
  assert.equal(report.eligibleLinkedItemCount, 2);
  assert.equal(report.updatedItemCount, 1);
  assert.equal(report.skippedItemCount, 1);
  assert.equal(report.fieldCounts.sourceFileSize, 1);
  assert.equal(report.fieldCounts.sourceImageWidth, 1);
  assert.equal(report.fieldCounts.sourceImageHeight, 1);
  assert.equal(report.fieldCounts.originalRelinkedRelativePath, 1);
  assert.equal(report.examples.updated.length, 1);
});
