import test from "node:test";
import assert from "node:assert/strict";

import {
  getApprovedOriginalRecoveryMatches,
  hasUnappliedApprovedOriginalRecoveryMatches,
  isOriginalRecoverySessionResumable,
  reconcileOriginalRecoverySessionWithItems,
  reconcileOriginalRecoverySessionWithItemsResult
} from "./originalRecovery.js";

test("detects persisted session with unapplied approved matches", () => {
  const session = {
    matches: [
      { itemId: "item-a", decision: "accepted", applyResult: null },
      { itemId: "item-b", decision: "accepted", applyResult: { status: "recovered" } },
      { itemId: "item-c", decision: "rejected", applyResult: null }
    ]
  };

  assert.equal(hasUnappliedApprovedOriginalRecoveryMatches(session), true);
  assert.deepEqual(
    getApprovedOriginalRecoveryMatches(session).map((match) => match.itemId),
    ["item-a"]
  );
});

test("reconcileOriginalRecoverySessionWithItems marks linked preserved items as already applied", () => {
  const session = {
    summary: {
      scannedFileCount: 10
    },
    matches: [
      {
        itemId: "item-a",
        decision: "accepted",
        relinkStatus: "pending",
        selectedCandidateId: "candidate-a",
        knownOriginalRelativePath: "",
        sourceFilenameAliases: [],
        candidates: [
          { id: "candidate-a", relativePath: "moodboard/a.jpg" }
        ],
        applyResult: null
      },
      {
        itemId: "item-b",
        decision: "accepted",
        relinkStatus: "pending",
        selectedCandidateId: "candidate-b",
        knownOriginalRelativePath: "",
        sourceFilenameAliases: [],
        candidates: [
          { id: "candidate-b", relativePath: "moodboard/b.jpg" }
        ],
        applyResult: null
      }
    ]
  };

  const reconciled = reconcileOriginalRecoverySessionWithItems(session, [
    {
      id: "item-a",
      originalPreserved: true,
      relinkStatus: "linked",
      knownOriginalRelativePath: "moodboard/a.jpg"
    }
  ]);

  assert.equal(reconciled.summary.approvedCount, 1);
  assert.equal(reconciled.summary.alreadyAppliedCount, 1);
  assert.deepEqual(
    getApprovedOriginalRecoveryMatches(reconciled).map((match) => match.itemId),
    ["item-b"]
  );
  assert.equal(reconciled.matches.find((match) => match.itemId === "item-a")?.applyResult?.status, "recovered");
});

test("reconcileOriginalRecoverySessionWithItemsResult reports unchanged when session is already reconciled", () => {
  const session = reconcileOriginalRecoverySessionWithItems(
    {
      summary: {
        scannedFileCount: 10
      },
      matches: [
        {
          itemId: "item-a",
          decision: "accepted",
          relinkStatus: "linked",
          selectedCandidateId: "candidate-a",
          knownOriginalRelativePath: "moodboard/a.jpg",
          sourceOriginalFilename: "a.jpg",
          sourceFilenameAliases: [],
          candidates: [
            { id: "candidate-a", relativePath: "moodboard/a.jpg" }
          ],
          applyResult: {
            status: "recovered",
            message: "Original already applied.",
            appliedAt: ""
          }
        }
      ]
    },
    [
      {
        id: "item-a",
        originalPreserved: true,
        relinkStatus: "linked",
        knownOriginalRelativePath: "moodboard/a.jpg",
        sourceOriginalFilename: "a.jpg",
        sourceFilenameAliases: []
      }
    ]
  );

  const result = reconcileOriginalRecoverySessionWithItemsResult(session, [
    {
      id: "item-a",
      originalPreserved: true,
      relinkStatus: "linked",
      knownOriginalRelativePath: "moodboard/a.jpg",
      sourceOriginalFilename: "a.jpg",
      sourceFilenameAliases: []
    }
  ]);

  assert.equal(result.changed, false);
  assert.equal(result.session, session);
});

test("reconcileOriginalRecoverySessionWithItemsResult reports changed when current items mark a match recovered", () => {
  const session = {
    summary: {
      scannedFileCount: 10
    },
    matches: [
      {
        itemId: "item-a",
        decision: "accepted",
        relinkStatus: "pending",
        selectedCandidateId: "candidate-a",
        knownOriginalRelativePath: "",
        sourceOriginalFilename: "",
        sourceFilenameAliases: [],
        candidates: [
          { id: "candidate-a", relativePath: "moodboard/a.jpg" }
        ],
        applyResult: null
      }
    ]
  };

  const result = reconcileOriginalRecoverySessionWithItemsResult(session, [
    {
      id: "item-a",
      originalPreserved: true,
      relinkStatus: "linked",
      knownOriginalRelativePath: "moodboard/a.jpg"
    }
  ]);

  assert.equal(result.changed, true);
  assert.equal(result.session.matches[0].applyResult?.status, "recovered");
});

test("completed session is not resumable when no unapplied approved matches remain", () => {
  const session = {
    summary: {
      approvedCount: 0,
      alreadyAppliedCount: 1
    },
    matches: [
      {
        itemId: "item-a",
        decision: "accepted",
        applyResult: {
          status: "recovered"
        }
      }
    ]
  };

  assert.equal(hasUnappliedApprovedOriginalRecoveryMatches(session), false);
  assert.equal(isOriginalRecoverySessionResumable(session), false);
});

test("TT-style linked state without originalPreserved does not mark recovered or keep changing", () => {
  const session = {
    summary: {
      scannedFileCount: 10,
      approvedCount: 1
    },
    matches: [
      {
        itemId: "item-a",
        decision: "accepted",
        relinkStatus: "pending",
        selectedCandidateId: "candidate-a",
        knownOriginalRelativePath: "",
        sourceOriginalFilename: "",
        sourceFilenameAliases: [],
        candidates: [
          { id: "candidate-a", relativePath: "moodboard/a.jpg" }
        ],
        applyResult: null
      }
    ]
  };
  const items = [
    {
      id: "item-a",
      originalPreserved: false,
      relinkStatus: "linked",
      knownOriginalRelativePath: "",
      sourceOriginalFilename: "",
      sourceFilenameAliases: []
    }
  ];

  const first = reconcileOriginalRecoverySessionWithItemsResult(session, items);
  const second = reconcileOriginalRecoverySessionWithItemsResult(first.session, items);

  assert.equal(first.changed, true);
  assert.equal(first.session.matches[0].relinkStatus, "linked");
  assert.equal(first.session.matches[0].applyResult, null);
  assert.equal(first.session.summary.approvedCount, 1);
  assert.equal(first.session.summary.alreadyAppliedCount, 0);
  assert.equal(second.changed, false);
});
