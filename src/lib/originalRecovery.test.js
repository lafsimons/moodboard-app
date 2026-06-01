import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOriginalRecoverySession,
  buildOriginalRecoverySessionExhaustive,
  mergeOriginalRecoveryApplyResults
} from "./originalRecovery.js";

function summarizeSessionForComparison(session) {
  return {
    summary: session.summary,
    matches: session.matches.map((match) => ({
      itemId: match.itemId,
      outcome: match.outcome,
      decision: match.decision,
      selectedCandidateId: match.selectedCandidateId,
      candidateIds: match.candidates.map((candidate) => candidate.id),
      candidateClassifications: match.candidates.map((candidate) => [candidate.id, candidate.match.classification]),
      candidateReasons: match.candidates.map((candidate) => [candidate.id, candidate.reasons])
    }))
  };
}

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

test("buildOriginalRecoverySession prefers namespace-aligned legacy archive aliases", () => {
  const session = buildOriginalRecoverySession({
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        sourceRelativePath: "vintage/images-050.jpg",
        sourceOriginalFilename: "images-050.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        originalPreserved: false
      }
    ],
    candidates: [
      {
        id: "candidate-1",
        relativePath: "archives/vintage-images-050.jpg",
        fileName: "vintage-images-050.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      },
      {
        id: "candidate-2",
        relativePath: "archives/moodboard-images-050.jpg",
        fileName: "moodboard-images-050.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      }
    ]
  });

  assert.equal(session.matches[0].outcome, "strong_single");
  assert.equal(session.matches[0].decision, "accepted");
  assert.equal(session.matches[0].selectedCandidateId, "candidate-1");
});

test("buildOriginalRecoverySession does not auto-select legacy numbers without namespace certainty", () => {
  const session = buildOriginalRecoverySession({
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        sourceOriginalFilename: "images-050.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        originalPreserved: false
      }
    ],
    candidates: [
      {
        id: "candidate-1",
        relativePath: "vintage/images-050.jpg",
        fileName: "images-050.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      },
      {
        id: "candidate-2",
        relativePath: "moodboard/images-050.jpg",
        fileName: "images-050.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      }
    ]
  });

  assert.equal(session.matches[0].outcome, "ambiguous_multiple");
  assert.equal(session.matches[0].decision, "undecided");
  assert.equal(session.matches[0].selectedCandidateId, "");
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

test("indexed recovery matcher returns the same results as the exhaustive matcher on representative fixtures", () => {
  const fixture = {
    app: "mba",
    sourceLabel: "Archive",
    items: [
      {
        id: "exact-1",
        itemUuid: "uuid-exact-1",
        name: "Exact",
        sourceOriginalFilename: "camel-coat.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        sourceLastModified: 1234,
        mimeType: "image/jpeg",
        originalPreserved: false
      },
      {
        id: "support-only-weak",
        itemUuid: "uuid-support-only-weak",
        name: "Support only",
        sourceOriginalFilename: "missing-name.jpg",
        sourceFileSize: 2000,
        sourceImageWidth: 200,
        sourceImageHeight: 100,
        mimeType: "image/png",
        originalPreserved: false
      },
      {
        id: "legacy-namespace",
        itemUuid: "uuid-legacy-namespace",
        name: "Legacy namespace",
        sourceRelativePath: "moodboard/images-050.jpg",
        sourceOriginalFilename: "images-050.jpg",
        sourceFileSize: 3000,
        sourceImageWidth: 300,
        sourceImageHeight: 150,
        mimeType: "image/jpeg",
        originalPreserved: false
      },
      {
        id: "cross-namespace",
        itemUuid: "uuid-cross-namespace",
        name: "Cross namespace",
        sourceOriginalFilename: "images-051.jpg",
        sourceFileSize: 3500,
        sourceImageWidth: 350,
        sourceImageHeight: 175,
        mimeType: "image/jpeg",
        originalPreserved: false
      },
      {
        id: "no-match",
        itemUuid: "uuid-no-match",
        name: "No match",
        sourceOriginalFilename: "totally-missing.jpg",
        sourceFileSize: 9000,
        sourceImageWidth: 900,
        sourceImageHeight: 450,
        mimeType: "image/webp",
        originalPreserved: false
      }
    ],
    candidates: [
      {
        id: "candidate-exact",
        relativePath: "archive/camel-coat.jpg",
        fileName: "camel-coat.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        sourceLastModified: 1234,
        mimeType: "image/jpeg"
      },
      {
        id: "candidate-support-only",
        relativePath: "archive/not-the-same-name.png",
        fileName: "not-the-same-name.png",
        sourceFileSize: 2000,
        sourceImageWidth: 200,
        sourceImageHeight: 100,
        mimeType: "image/png"
      },
      {
        id: "candidate-moodboard-050",
        relativePath: "moodboard/moodboard-images-050.jpg",
        fileName: "moodboard-images-050.jpg",
        sourceFileSize: 3000,
        sourceImageWidth: 300,
        sourceImageHeight: 150,
        mimeType: "image/jpeg"
      },
      {
        id: "candidate-vintage-051",
        relativePath: "vintage/vintage-images-051.jpg",
        fileName: "vintage-images-051.jpg",
        sourceFileSize: 3500,
        sourceImageWidth: 350,
        sourceImageHeight: 175,
        mimeType: "image/jpeg"
      },
      {
        id: "candidate-moodboard-051",
        relativePath: "moodboard/moodboard-images-051.jpg",
        fileName: "moodboard-images-051.jpg",
        sourceFileSize: 3500,
        sourceImageWidth: 350,
        sourceImageHeight: 175,
        mimeType: "image/jpeg"
      }
    ]
  };

  const indexedSession = buildOriginalRecoverySession(fixture);
  const exhaustiveSession = buildOriginalRecoverySessionExhaustive(fixture);

  assert.deepEqual(
    summarizeSessionForComparison(indexedSession),
    summarizeSessionForComparison(exhaustiveSession)
  );
});

test("indexed recovery matcher keeps cross-namespace legacy collisions ambiguous and not auto-selected", () => {
  const session = buildOriginalRecoverySession({
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        sourceOriginalFilename: "images-168.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg",
        originalPreserved: false
      }
    ],
    candidates: [
      {
        id: "candidate-1",
        relativePath: "vintage/vintage-images-168.jpg",
        fileName: "vintage-images-168.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      },
      {
        id: "candidate-2",
        relativePath: "wishlist/wishlist-images-168.jpg",
        fileName: "wishlist-images-168.jpg",
        sourceFileSize: 1000,
        sourceImageWidth: 100,
        sourceImageHeight: 50,
        mimeType: "image/jpeg"
      }
    ]
  });

  assert.equal(session.matches[0].outcome, "ambiguous_multiple");
  assert.equal(session.matches[0].decision, "undecided");
  assert.equal(session.matches[0].selectedCandidateId, "");
});

test("indexed recovery matcher returns no_match when no indexed candidates exist", () => {
  const session = buildOriginalRecoverySession({
    items: [
      {
        id: "missing-1",
        itemUuid: "uuid-missing-1",
        sourceOriginalFilename: "totally-missing.jpg",
        sourceFileSize: 1111,
        sourceImageWidth: 222,
        sourceImageHeight: 111,
        mimeType: "image/jpeg",
        originalPreserved: false
      }
    ],
    candidates: [
      {
        id: "candidate-1",
        relativePath: "archive/another-file.png",
        fileName: "another-file.png",
        sourceFileSize: 9999,
        sourceImageWidth: 333,
        sourceImageHeight: 222,
        mimeType: "image/png"
      }
    ]
  });

  assert.equal(session.matches[0].outcome, "no_match");
  assert.equal(session.matches[0].decision, "undecided");
  assert.deepEqual(session.matches[0].candidates, []);
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
