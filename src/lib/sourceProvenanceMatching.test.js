import test from "node:test";
import assert from "node:assert/strict";

import {
  classifySourceProvenanceMatch,
  collectSourceFilenameCandidates,
  normalizeComparableFilename
} from "./sourceProvenanceMatching.js";

test("normalizeComparableFilename lowercases and trims comparable filenames", () => {
  assert.equal(normalizeComparableFilename("  Preview.WEBP "), "preview.webp");
});

test("collectSourceFilenameCandidates treats sourceOriginalFilename as implicit canonical candidate", () => {
  assert.deepEqual(
    collectSourceFilenameCandidates({
      sourceOriginalFilename: "canonical.jpg",
      sourceFilenameAliases: [],
      originalFilename: "",
      images: {
        preview: {
          originalFilename: ""
        }
      }
    }),
    ["canonical.jpg"]
  );
});

test("collectSourceFilenameCandidates deduplicates canonical, compatibility, and alias filenames", () => {
  assert.deepEqual(
    collectSourceFilenameCandidates({
      sourceOriginalFilename: "canonical.jpg",
      originalFilename: "preview.webp",
      sourceFilenameAliases: ["Preview.webp", "alias.png"],
      images: {
        preview: {
          originalFilename: "preview.webp"
        }
      }
    }),
    ["canonical.jpg", "preview.webp", "alias.png"]
  );
});

test("collectSourceFilenameCandidates adds namespace-aware aliases for legacy numbered imports", () => {
  assert.deepEqual(
    collectSourceFilenameCandidates({
      sourceRelativePath: "vintage/images-050.jpg",
      sourceOriginalFilename: "images-050.jpg",
      sourceFilenameAliases: []
    }),
    ["images-050.jpg", "vintage/images-050.jpg", "vintage-images-050.jpg"]
  );
});

test("classifySourceProvenanceMatch returns exact for canonical filename with full source metadata alignment", () => {
  assert.equal(
    classifySourceProvenanceMatch(
      {
        sourceOriginalFilename: "canonical.jpg",
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200,
        sourceLastModified: 12345,
        mimeType: "image/jpeg"
      },
      {
        sourceOriginalFilename: "CANONICAL.JPG",
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200,
        sourceLastModified: 12345,
        mimeType: "image/jpeg"
      }
    ),
    "exact"
  );
});

test("classifySourceProvenanceMatch returns strong for filename plus size and dimensions without last-modified support", () => {
  assert.equal(
    classifySourceProvenanceMatch(
      {
        sourceOriginalFilename: "canonical.jpg",
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200
      },
      {
        sourceFilenameAliases: ["canonical.jpg"],
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200
      }
    ),
    "strong"
  );
});

test("classifySourceProvenanceMatch returns possible for alias plus one supporting attribute", () => {
  assert.equal(
    classifySourceProvenanceMatch(
      {
        sourceOriginalFilename: "canonical.jpg",
        sourceFilenameAliases: ["archive-copy.jpg"],
        sourceFileSize: 2048
      },
      {
        sourceOriginalFilename: "archive-copy.jpg",
        sourceFileSize: 2048
      }
    ),
    "possible"
  );
});

test("classifySourceProvenanceMatch treats namespaced legacy archive filenames as strong matches", () => {
  assert.equal(
    classifySourceProvenanceMatch(
      {
        sourceRelativePath: "vintage/images-050.jpg",
        sourceOriginalFilename: "images-050.jpg",
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200
      },
      {
        sourceOriginalFilename: "vintage-images-050.jpg",
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200
      }
    ),
    "strong"
  );
});

test("classifySourceProvenanceMatch blocks cross-namespace legacy number matches from becoming strong", () => {
  assert.equal(
    classifySourceProvenanceMatch(
      {
        sourceRelativePath: "vintage/images-050.jpg",
        sourceOriginalFilename: "images-050.jpg",
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200
      },
      {
        relativePath: "moodboard/images-050.jpg",
        sourceOriginalFilename: "images-050.jpg",
        sourceFileSize: 2048,
        sourceImageWidth: 1600,
        sourceImageHeight: 1200
      }
    ),
    "weak"
  );
});

test("classifySourceProvenanceMatch returns weak for filename-only matches", () => {
  assert.equal(
    classifySourceProvenanceMatch(
      {
        sourceOriginalFilename: "canonical.jpg"
      },
      {
        sourceFilenameAliases: ["canonical.jpg"]
      }
    ),
    "weak"
  );
});

test("classifySourceProvenanceMatch returns none when filename candidates do not match", () => {
  assert.equal(
    classifySourceProvenanceMatch(
      {
        sourceOriginalFilename: "canonical.jpg",
        sourceFileSize: 2048
      },
      {
        sourceOriginalFilename: "other.jpg",
        sourceFileSize: 2048
      }
    ),
    "none"
  );
});
