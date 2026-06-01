import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOriginalRecoverySession,
  mergeOriginalRecoveryApplyResults
} from "./originalRecovery.js";

test("buildOriginalRecoverySession auto-approves exact matches and excludes already linked items", () => {
  const session = buildOriginalRecoverySession({
    app: "mba",
    sourceLabel: "Archive",
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        name: "Camel Coat",
        sourceOriginalFilename: "camel-coat.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        sourceLastModified: 1234,
        mimeType: "image/jpeg",
        originalPreserved: false
      },
      {
        id: "linked-1",
        itemUuid: "uuid-linked-1",
        name: "Already linked",
        originalPreserved: true
      }
    ],
    candidates: [
      {
        id: "candidate-1",
        relativePath: "archive/camel-coat.jpg",
        fileName: "camel-coat.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        sourceLastModified: 1234,
        mimeType: "image/jpeg"
      }
    ]
  });

  assert.equal(session.summary.scannedFileCount, 1);
  assert.equal(session.summary.eligibleItemCount, 1);
  assert.equal(session.summary.excludedItemCount, 1);

  const approvedMatch = session.matches.find((match) => match.itemId === "missing-1");
  assert.equal(approvedMatch.outcome, "exact_single");
  assert.equal(approvedMatch.decision, "accepted");
  assert.equal(approvedMatch.selectedCandidateId, "candidate-1");

  const excludedMatch = session.matches.find((match) => match.itemId === "linked-1");
  assert.equal(excludedMatch.outcome, "excluded");
  assert.equal(excludedMatch.decision, "skipped");
});

test("buildOriginalRecoverySession marks ambiguous top-rank matches as undecided", () => {
  const session = buildOriginalRecoverySession({
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        sourceOriginalFilename: "camel-coat.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        originalPreserved: false
      }
    ],
    candidates: [
      {
        id: "candidate-1",
        relativePath: "archive/a/camel-coat.jpg",
        fileName: "camel-coat.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      },
      {
        id: "candidate-2",
        relativePath: "archive/b/camel-coat.jpg",
        fileName: "camel-coat.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      }
    ]
  });

  assert.equal(session.matches[0].outcome, "ambiguous_multiple");
  assert.equal(session.matches[0].decision, "undecided");
});

test("buildOriginalRecoverySession preserves prior accepted decisions only when selected candidate still exists", () => {
  const previousSession = {
    id: "session-1",
    createdAt: "2026-06-01T00:00:00.000Z",
    matches: [
      {
        itemId: "missing-1",
        decision: "accepted",
        selectedCandidateId: "candidate-1"
      }
    ]
  };
  const session = buildOriginalRecoverySession({
    previousSession,
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        sourceOriginalFilename: "camel-coat.jpg",
        originalPreserved: false
      }
    ],
    candidates: []
  });

  assert.equal(session.matches[0].decision, "needs_rescan");
});

test("mergeOriginalRecoveryApplyResults updates summary counts", () => {
  const session = buildOriginalRecoverySession({
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        sourceOriginalFilename: "camel-coat.jpg",
        originalPreserved: false
      }
    ],
    candidates: [
      {
        id: "candidate-1",
        relativePath: "archive/camel-coat.jpg",
        fileName: "camel-coat.jpg",
        sourceFileSize: 1000
      }
    ]
  });
  const merged = mergeOriginalRecoveryApplyResults(session, [
    {
      itemId: "missing-1",
      status: "recovered",
      message: "Recovered",
      appliedAt: "2026-06-01T10:00:00.000Z",
      decision: "accepted"
    }
  ]);

  assert.equal(merged.status, "completed");
  assert.equal(merged.summary.recoveredCount, 1);
  assert.equal(merged.matches[0].applyResult.status, "recovered");
});
