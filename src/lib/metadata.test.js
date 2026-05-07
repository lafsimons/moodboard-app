import test from "node:test";
import assert from "node:assert/strict";

import {
  getAllTags,
  getTagSuggestions,
  migrateReferenceMetadataToTags,
  normalizeTag,
  renameNestedTagPath,
  sanitizeBackupReference,
  sanitizeExportedReference,
  uniqueTags
} from "./metadata.js";

test("normalizeTag lowercases, trims, and normalizes nested tag separators", () => {
  assert.equal(normalizeTag("  Black  "), "black");
  assert.equal(normalizeTag(" Style / Vintage   American "), "style/vintage american");
  assert.equal(normalizeTag("source//movie "), "source/movie");
  assert.equal(normalizeTag(""), "");
  assert.equal(normalizeTag(null), "");
});

test("uniqueTags removes duplicates and empty values", () => {
  assert.deepEqual(uniqueTags([" Black ", "black", "", null, "blue"]), ["black", "blue"]);
});

test("renameNestedTagPath cascades parent tag renames to nested tags only", () => {
  assert.equal(renameNestedTagPath("movie", "movie", "movies"), "movies");
  assert.equal(renameNestedTagPath("movie/french", "movie", "movies"), "movies/french");
  assert.equal(renameNestedTagPath("movie/french/new-wave", "movie", "movies"), "movies/french/new-wave");
  assert.equal(renameNestedTagPath("movie-night", "movie", "movies"), "movie-night");
});

test("migrateReferenceMetadataToTags preserves tags and merges legacy metadata", () => {
  const migrated = migrateReferenceMetadataToTags({
    id: "1",
    tags: ["Existing", "black"],
    imageUrl: "data:image/webp;base64,legacy",
    imageWidth: 1200,
    imageHeight: 800,
    category: " Portrait ",
    collection: "",
    productType: "Footwear",
    sourceTags: ["Guidi", "black", null],
    brand: "Taiga Takahashi",
    favorite: 1,
    importedAt: 100,
    capturedAt: 200,
    originalFilename: "photo.jpg"
  });

  assert.deepEqual(migrated.tags, ["existing", "black", "portrait", "footwear", "guidi", "taiga takahashi"]);
  assert.equal(migrated.favorite, true);
  assert.equal(migrated.images.preview.src, "data:image/webp;base64,legacy");
  assert.equal(migrated.originalPreserved, false);
  assert.equal("category" in migrated, false);
  assert.equal("collection" in migrated, false);
  assert.equal("productType" in migrated, false);
  assert.equal("sourceTags" in migrated, false);
  assert.equal(migrated.importedAt, 100);
  assert.equal(migrated.capturedAt, 200);
  assert.equal(migrated.originalFilename, "photo.jpg");
});

test("sanitizeExportedReference emits simplified metadata shape", () => {
  const exported = sanitizeExportedReference({
    id: "1",
    imageUrl: "x",
    images: {
      original: {
        src: "orig",
        mimeType: "image/png",
        width: 3000,
        height: 2400,
        fileSize: 9000,
        originalFilename: "photo.jpg"
      },
      preview: {
        src: "prev",
        mimeType: "image/webp",
        width: 1000,
        height: 800,
        fileSize: 1234,
        originalFilename: "photo.jpg"
      },
      thumbnail: {
        src: "thumb",
        mimeType: "image/webp",
        width: 480,
        height: 384,
        fileSize: 300,
        originalFilename: "photo.jpg"
      }
    },
    originalPreserved: true,
    category: "Interior",
    sourceTags: ["Archive"],
    brand: "Studio",
    favorite: false,
    importedAt: 100,
    updatedAt: 101,
    originalFilename: "photo.jpg",
    fileExtension: "jpg",
    fileSize: 1234,
    mimeType: "image/jpeg",
    imageWidth: 1000,
    imageHeight: 800,
    aspectRatio: 1.25,
    orientation: "landscape",
    capturedAt: 99,
    cameraMake: "Canon"
  });

  assert.deepEqual(exported.tags, ["interior", "archive", "studio"]);
  assert.equal("category" in exported, false);
  assert.equal("sourceTags" in exported, false);
  assert.equal("brand" in exported, false);
  assert.equal(exported.importedAt, 100);
  assert.equal(exported.updatedAt, 101);
  assert.equal(exported.originalFilename, "photo.jpg");
  assert.equal(exported.fileExtension, "jpg");
  assert.equal(exported.fileSize, 1234);
  assert.equal(exported.mimeType, "image/jpeg");
  assert.equal(exported.imageWidth, 1000);
  assert.equal(exported.imageHeight, 800);
  assert.equal(exported.originalPreserved, true);
  assert.equal(exported.images.original.src, "orig");
  assert.equal(exported.images.preview.src, "prev");
  assert.equal(exported.images.thumbnail.src, "thumb");
  assert.equal(exported.aspectRatio, 1.25);
  assert.equal(exported.orientation, "landscape");
  assert.equal(exported.capturedAt, 99);
  assert.equal(exported.cameraMake, "Canon");
});

test("sanitizeBackupReference strips embedded backups down to one thumbnail legacy image", () => {
  const exported = sanitizeBackupReference({
    id: "1",
    imageUrl: "data:image/webp;base64,preview",
    images: {
      original: {
        src: "data:image/jpeg;base64,very-large-original",
        mimeType: "image/jpeg",
        width: 3000,
        height: 2400,
        fileSize: 9000,
        originalFilename: "photo.jpg"
      },
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 1200,
        height: 960,
        fileSize: 1200,
        originalFilename: "photo.jpg"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb",
        mimeType: "image/webp",
        width: 480,
        height: 384,
        fileSize: 300,
        originalFilename: "photo.jpg"
      }
    },
    originalPreserved: true
  });

  assert.equal(exported.originalPreserved, false);
  assert.equal(exported.imageUrl, "data:image/webp;base64,thumb");
  assert.equal(exported.mimeType, "image/webp");
  assert.equal(exported.imageWidth, 480);
  assert.equal(exported.imageHeight, 384);
  assert.equal(exported.fileSize, 300);
  assert.equal(exported.originalFilename, "photo.jpg");
  assert.equal(exported.images.original.src, "");
  assert.equal(exported.images.preview.src, "");
  assert.equal(exported.images.thumbnail.src, "");
});

test("getAllTags returns sorted unique library tags", () => {
  assert.deepEqual(
    getAllTags([{ tags: ["black", "blue"] }, { tags: ["blue", "archive"] }]),
    ["archive", "black", "blue"]
  );
});

test("getTagSuggestions prioritizes prefix matches then substring matches", () => {
  assert.deepEqual(
    getTagSuggestions("bl", ["blue", "black", "off black", "cobalt"], []),
    ["black", "blue", "off black"]
  );
});
