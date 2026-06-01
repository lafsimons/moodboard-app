import test from "node:test";
import assert from "node:assert/strict";

import {
  appendOriginalReconnectionAlias,
  buildOriginalReconnectionReview,
  classifyOriginalAvailability,
  createOriginalReconnectionCandidate
} from "./originalReconnection.js";

test("createOriginalReconnectionCandidate builds comparable provenance from file metadata", () => {
  const file = new File(["1234"], "coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });

  assert.deepEqual(
    createOriginalReconnectionCandidate(file, {
      width: 1200,
      height: 800
    }),
    {
      sourceOriginalFilename: "coat.jpg",
      sourceFilenameAliases: [],
      sourceFileSize: 4,
      sourceImageWidth: 1200,
      sourceImageHeight: 800,
      sourceLastModified: 1717236000000,
      mimeType: "image/jpeg"
    }
  );
});

test("buildOriginalReconnectionReview exposes confidence and reasons", () => {
  const file = new File(["1234"], "coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });

  const review = buildOriginalReconnectionReview(
    {
      sourceOriginalFilename: "coat.jpg",
      sourceFileSize: 4,
      sourceImageWidth: 1200,
      sourceImageHeight: 800,
      sourceLastModified: 1717236000000,
      mimeType: "image/jpeg"
    },
    file,
    {
      width: 1200,
      height: 800
    }
  );

  assert.equal(review.match.classification, "exact");
  assert.equal(review.canConfirm, true);
  assert.equal(review.requiresExplicitOverride, false);
  assert.deepEqual(review.reasons, [
    "Filename matches stored provenance",
    "File size matches",
    "Dimensions match",
    "Last modified timestamp matches",
    "MIME type matches"
  ]);
});

test("classifyOriginalAvailability keeps missing distinct from attention", () => {
  assert.equal(classifyOriginalAvailability({ originalPreserved: true }, { hasStoredOriginal: true }), "preserved");
  assert.equal(classifyOriginalAvailability({ originalPreserved: true }, { hasStoredOriginal: false }), "missing");
  assert.equal(classifyOriginalAvailability({ originalPreserved: false, relinkStatus: "missing" }), "missing");
  assert.equal(classifyOriginalAvailability({ originalPreserved: false, relinkStatus: "hub-awaiting-rebind" }), "attention");
});

test("appendOriginalReconnectionAlias preserves distinct aliases without duplicating canonical source filename", () => {
  assert.deepEqual(
    appendOriginalReconnectionAlias(
      {
        sourceOriginalFilename: "coat.jpg",
        sourceFilenameAliases: ["archive-copy.jpg"]
      },
      "coat.jpg"
    ),
    ["archive-copy.jpg"]
  );

  assert.deepEqual(
    appendOriginalReconnectionAlias(
      {
        sourceOriginalFilename: "coat.jpg",
        sourceFilenameAliases: ["archive-copy.jpg"]
      },
      "edited-export.jpg"
    ),
    ["archive-copy.jpg", "edited-export.jpg"]
  );
});
