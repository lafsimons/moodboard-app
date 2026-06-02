import test from "node:test";
import assert from "node:assert/strict";

import {
  buildControlledVintageProvenanceBackfillResult,
  buildLegacyProvenanceBackfillResult,
  createControlledVintageProvenanceBackfillReport,
  createLegacyArchiveCandidateIndex,
  createLegacyProvenanceBackfillReport
} from "./legacyProvenanceBackfill.js";

test("buildLegacyProvenanceBackfillResult backfills vintage namespace from flat tags and sourceOriginalFilename", () => {
  const result = buildLegacyProvenanceBackfillResult({
    id: "vintage-1",
    itemUuid: "uuid-vintage-1",
    name: "Vintage",
    tags: ["folder/vintage", "summer"],
    sourceNamespace: "",
    sourceRelativePath: "",
    sourceOriginalFilename: "images-050.jpg",
    sourceFilenameAliases: []
  });

  assert.equal(result.status, "affected");
  assert.equal(result.nextItem.name, "Vintage");
  assert.equal(result.nextItem.id, "vintage-1");
  assert.equal(result.nextItem.itemUuid, "uuid-vintage-1");
  assert.equal(result.nextItem.sourceNamespace, "vintage");
  assert.equal(result.nextItem.sourceRelativePath, "vintage/images-050.jpg");
  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["vintage-images-050.jpg"]);
  assert.equal(result.preview.legacyFilenameField, "sourceOriginalFilename");
});

test("buildLegacyProvenanceBackfillResult falls back to originalFilename for moodboard items", () => {
  const result = buildLegacyProvenanceBackfillResult({
    id: "moodboard-1",
    itemUuid: "uuid-moodboard-1",
    name: "Moodboard",
    tags: ["folder/moodboard"],
    sourceNamespace: "",
    sourceRelativePath: "",
    sourceOriginalFilename: "",
    originalFilename: "images-002.png",
    sourceFilenameAliases: ["preview.webp"]
  });

  assert.equal(result.status, "affected");
  assert.equal(result.nextItem.sourceNamespace, "moodboard");
  assert.equal(result.nextItem.sourceRelativePath, "moodboard/images-002.png");
  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["preview.webp", "moodboard-images-002.png"]);
  assert.equal(result.preview.legacyFilenameField, "originalFilename");
});

test("buildLegacyProvenanceBackfillResult falls back to images.preview.originalFilename for wishlist items", () => {
  const result = buildLegacyProvenanceBackfillResult({
    id: "wishlist-1",
    itemUuid: "uuid-wishlist-1",
    name: "Wishlist",
    tags: ["folder/wishlist"],
    sourceNamespace: "",
    sourceRelativePath: "",
    sourceOriginalFilename: "",
    originalFilename: "",
    images: {
      preview: {
        originalFilename: "images-168.jpg"
      }
    },
    sourceFilenameAliases: []
  });

  assert.equal(result.status, "affected");
  assert.equal(result.nextItem.sourceNamespace, "wishlist");
  assert.equal(result.nextItem.sourceRelativePath, "wishlist/images-168.jpg");
  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["wishlist-images-168.jpg"]);
  assert.equal(result.preview.legacyFilenameField, "images.preview.originalFilename");
});

test("buildLegacyProvenanceBackfillResult deduplicates namespaced aliases case-insensitively", () => {
  const result = buildLegacyProvenanceBackfillResult({
    id: "moodboard-2",
    itemUuid: "uuid-moodboard-2",
    name: "Moodboard Alias",
    tags: ["folder/moodboard"],
    sourceNamespace: "moodboard",
    sourceRelativePath: "",
    sourceOriginalFilename: "images-010.png",
    sourceFilenameAliases: ["Moodboard-images-010.png", "preview.webp"]
  });

  assert.equal(result.status, "affected");
  assert.deepEqual(result.changedFields, ["sourceRelativePath"]);
  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["Moodboard-images-010.png", "preview.webp"]);
});

test("buildLegacyProvenanceBackfillResult skips items with no legacy filename after setting no fields", () => {
  const result = buildLegacyProvenanceBackfillResult({
    id: "wishlist-2",
    itemUuid: "uuid-wishlist-2",
    name: "Wishlist Existing",
    tags: ["folder/wishlist"],
    sourceNamespace: "wishlist",
    sourceRelativePath: "",
    sourceOriginalFilename: "wishlist-cover.jpg",
    sourceFilenameAliases: []
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "no_legacy_numbered_filename");
});

test("buildLegacyProvenanceBackfillResult reports namespace conflicts without overwriting existing provenance", () => {
  const result = buildLegacyProvenanceBackfillResult({
    id: "conflict-1",
    itemUuid: "uuid-conflict-1",
    name: "Conflict",
    tags: ["folder/vintage"],
    sourceNamespace: "moodboard",
    sourceRelativePath: "",
    sourceOriginalFilename: "images-010.jpg",
    sourceFilenameAliases: []
  });

  assert.equal(result.status, "conflict");
  assert.equal(result.reason, "existing_namespace_conflict");
  assert.equal(result.nextItem, null);
});

test("buildLegacyProvenanceBackfillResult reports conflicting folder tags", () => {
  const result = buildLegacyProvenanceBackfillResult({
    id: "conflict-2",
    itemUuid: "uuid-conflict-2",
    name: "Multi Folder",
    tags: ["folder/vintage", "folder/moodboard"],
    sourceOriginalFilename: "images-010.jpg",
    sourceFilenameAliases: []
  });

  assert.equal(result.status, "conflict");
  assert.equal(result.reason, "conflicting_folder_tags");
});

test("createLegacyProvenanceBackfillReport scopes to folder-tagged items and groups examples", () => {
  const report = createLegacyProvenanceBackfillReport([
    {
      id: "item-1",
      itemUuid: "uuid-1",
      name: "Vintage",
      tags: ["folder/vintage"],
      sourceOriginalFilename: "images-050.jpg",
      sourceFilenameAliases: []
    },
    {
      id: "item-2",
      itemUuid: "uuid-2",
      name: "Moodboard",
      tags: ["folder/moodboard"],
      originalFilename: "images-002.png",
      sourceFilenameAliases: []
    },
    {
      id: "item-3",
      itemUuid: "uuid-3",
      name: "Wishlist Conflict",
      tags: ["folder/wishlist"],
      sourceNamespace: "moodboard",
      sourceOriginalFilename: "images-168.jpg",
      sourceFilenameAliases: []
    },
    {
      id: "item-4",
      itemUuid: "uuid-4",
      name: "Other",
      tags: ["casual"],
      sourceOriginalFilename: "images-010.jpg",
      sourceFilenameAliases: []
    }
  ], { exampleLimit: 2 });

  assert.equal(report.scopedItemCount, 3);
  assert.equal(report.affectedCount, 2);
  assert.equal(report.skippedCount, 0);
  assert.equal(report.conflictCount, 1);
  assert.equal(report.affectedItems.length, 2);
  assert.deepEqual(report.changedItemIds, ["item-1", "item-2"]);
  assert.equal(report.examples.byNamespace.vintage[0].sourceRelativePath, "vintage/images-050.jpg");
  assert.equal(report.examples.byNamespace.moodboard[0].sourceRelativePath, "moodboard/images-002.png");
  assert.equal(report.examples.byNamespace.wishlist.length, 0);
  assert.equal(report.examples.conflicts[0].reason, "existing_namespace_conflict");
});

function createVintageCandidateIndex(entries = []) {
  return createLegacyArchiveCandidateIndex(entries);
}

test("controlled vintage backfill fills path and alias from matching vintage candidate", () => {
  const candidateIndex = createVintageCandidateIndex([
    {
      fileName: "vintage-images-050.jpg",
      relativePath: "vintage/vintage-images-050.jpg"
    }
  ]);
  const result = buildControlledVintageProvenanceBackfillResult({
    id: "vintage-unlinked-1",
    itemUuid: "uuid-vintage-unlinked-1",
    name: "images-050",
    tags: ["folder/vintage"],
    originalPreserved: false,
    sourceNamespace: "vintage",
    sourceRelativePath: "",
    sourceOriginalFilename: "",
    sourceFilenameAliases: []
  }, { candidateIndex });

  assert.equal(result.status, "affected");
  assert.equal(result.nextItem.sourceRelativePath, "vintage/images-050.jpg");
  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["vintage-images-050.jpg"]);
});

test("controlled vintage backfill takes the extension from the candidate file", () => {
  const candidateIndex = createVintageCandidateIndex([
    {
      fileName: "vintage-images-056.png",
      relativePath: "vintage/vintage-images-056.png"
    }
  ]);
  const result = buildControlledVintageProvenanceBackfillResult({
    id: "vintage-unlinked-2",
    itemUuid: "uuid-vintage-unlinked-2",
    name: "images-056",
    tags: ["folder/vintage"],
    originalPreserved: false,
    sourceNamespace: "vintage",
    sourceRelativePath: "",
    sourceOriginalFilename: "",
    sourceFilenameAliases: []
  }, { candidateIndex });

  assert.equal(result.status, "affected");
  assert.equal(result.nextItem.sourceRelativePath, "vintage/images-056.png");
  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["vintage-images-056.png"]);
});

test("controlled vintage backfill preserves an existing matching vintage path", () => {
  const candidateIndex = createVintageCandidateIndex([
    {
      fileName: "vintage-images-050.jpg",
      relativePath: "vintage/vintage-images-050.jpg"
    }
  ]);
  const result = buildControlledVintageProvenanceBackfillResult({
    id: "vintage-unlinked-3",
    itemUuid: "uuid-vintage-unlinked-3",
    name: "images-050",
    tags: ["folder/vintage"],
    originalPreserved: false,
    sourceNamespace: "vintage",
    sourceRelativePath: "vintage/images-050.jpg",
    sourceOriginalFilename: "",
    sourceFilenameAliases: []
  }, { candidateIndex });

  assert.equal(result.status, "affected");
  assert.deepEqual(result.changedFields, ["sourceFilenameAliases"]);
  assert.equal(result.nextItem.sourceRelativePath, "vintage/images-050.jpg");
});

test("controlled vintage backfill conflicts on mismatched existing path", () => {
  const candidateIndex = createVintageCandidateIndex([
    {
      fileName: "vintage-images-050.jpg",
      relativePath: "vintage/vintage-images-050.jpg"
    }
  ]);
  const result = buildControlledVintageProvenanceBackfillResult({
    id: "vintage-unlinked-4",
    itemUuid: "uuid-vintage-unlinked-4",
    name: "images-050",
    tags: ["folder/vintage"],
    originalPreserved: false,
    sourceNamespace: "vintage",
    sourceRelativePath: "vintage/images-050.png",
    sourceOriginalFilename: "",
    sourceFilenameAliases: []
  }, { candidateIndex });

  assert.equal(result.status, "conflict");
  assert.equal(result.reason, "existing_relative_path_conflict");
});

test("controlled vintage backfill ignores non-vintage items and linked items", () => {
  const candidateIndex = createVintageCandidateIndex([
    {
      fileName: "vintage-images-050.jpg",
      relativePath: "vintage/vintage-images-050.jpg"
    }
  ]);
  const nonVintage = buildControlledVintageProvenanceBackfillResult({
    id: "moodboard-ignored",
    itemUuid: "uuid-moodboard-ignored",
    name: "images-050",
    tags: ["folder/moodboard"],
    originalPreserved: false
  }, { candidateIndex });
  const linked = buildControlledVintageProvenanceBackfillResult({
    id: "vintage-linked",
    itemUuid: "uuid-vintage-linked",
    name: "images-050",
    tags: ["folder/vintage"],
    originalPreserved: true
  }, { candidateIndex });

  assert.equal(nonVintage.status, "skipped");
  assert.equal(nonVintage.reason, "not_folder_vintage");
  assert.equal(linked.status, "skipped");
  assert.equal(linked.reason, "already_linked");
});

test("controlled vintage backfill deduplicates aliases and does not overwrite sourceOriginalFilename", () => {
  const candidateIndex = createVintageCandidateIndex([
    {
      fileName: "vintage-images-050.jpg",
      relativePath: "vintage/vintage-images-050.jpg"
    }
  ]);
  const result = buildControlledVintageProvenanceBackfillResult({
    id: "vintage-unlinked-5",
    itemUuid: "uuid-vintage-unlinked-5",
    name: "images-050",
    tags: ["folder/vintage"],
    originalPreserved: false,
    sourceNamespace: "",
    sourceRelativePath: "",
    sourceOriginalFilename: "existing-original.jpg",
    sourceFilenameAliases: ["Vintage-images-050.jpg", "other.jpg"]
  }, { candidateIndex });

  assert.equal(result.status, "affected");
  assert.equal(result.nextItem.sourceOriginalFilename, "existing-original.jpg");
  assert.deepEqual(result.nextItem.sourceFilenameAliases, ["Vintage-images-050.jpg", "other.jpg"]);
});

test("controlled vintage report counts candidate-backed affected and skipped items", () => {
  const report = createControlledVintageProvenanceBackfillReport([
    {
      id: "item-1",
      itemUuid: "uuid-1",
      name: "images-050",
      tags: ["folder/vintage"],
      originalPreserved: false,
      sourceNamespace: "vintage",
      sourceRelativePath: "",
      sourceFilenameAliases: []
    },
    {
      id: "item-2",
      itemUuid: "uuid-2",
      name: "images-999",
      tags: ["folder/vintage"],
      originalPreserved: false,
      sourceNamespace: "vintage",
      sourceRelativePath: "",
      sourceFilenameAliases: []
    }
  ], {
    exampleLimit: 2,
    candidateEntries: [
      {
        fileName: "vintage-images-050.jpg",
        relativePath: "vintage/vintage-images-050.jpg"
      }
    ]
  });

  assert.equal(report.scopedItemCount, 2);
  assert.equal(report.affectedCount, 1);
  assert.equal(report.skippedCount, 1);
  assert.equal(report.conflictCount, 0);
  assert.equal(report.candidateFoundCount, 1);
  assert.equal(report.examples.affected[0].candidateRelativePath, "vintage/vintage-images-050.jpg");
  assert.equal(report.examples.skipped[0].reason, "candidate_not_found");
});
