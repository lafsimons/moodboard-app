import test from "node:test";
import assert from "node:assert/strict";

import { resolveRecoverySelectedCandidateHandles } from "./originalRecoveryFileSystemAdapter.js";

function createFileHandle(name) {
  return {
    kind: "file",
    name,
    async getFile() {
      return new File(["1234567890"], name, {
        type: "image/jpeg",
        lastModified: 1717236000000
      });
    }
  };
}

function createDirectoryHandle(name, children = {}) {
  return {
    kind: "directory",
    name,
    async getDirectoryHandle(childName) {
      const child = children[childName];

      if (!child || child.kind !== "directory") {
        const error = new Error(`Missing directory ${childName}`);
        error.name = "NotFoundError";
        throw error;
      }

      return child;
    },
    async getFileHandle(childName) {
      const child = children[childName];

      if (!child || child.kind !== "file") {
        const error = new Error(`Missing file ${childName}`);
        error.name = "NotFoundError";
        throw error;
      }

      return child;
    }
  };
}

test("resolveRecoverySelectedCandidateHandles resolves only unapplied approved selected candidates", async () => {
  const moodboardDir = createDirectoryHandle("moodboard", {
    "a.jpg": createFileHandle("a.jpg"),
    "b.jpg": createFileHandle("b.jpg")
  });
  const rootHandle = createDirectoryHandle("ArchiveRoot", {
    moodboard: moodboardDir
  });
  const session = {
    matches: [
      {
        itemId: "item-approved",
        decision: "accepted",
        selectedCandidateId: "candidate-a",
        candidates: [
          { id: "candidate-a", relativePath: "moodboard/a.jpg", fileName: "a.jpg", lookupStrategy: "scan" }
        ]
      },
      {
        itemId: "item-recovered",
        decision: "accepted",
        applyResult: { status: "recovered" },
        selectedCandidateId: "candidate-b",
        candidates: [
          { id: "candidate-b", relativePath: "moodboard/b.jpg", fileName: "b.jpg", lookupStrategy: "scan" }
        ]
      },
      {
        itemId: "item-skipped",
        decision: "rejected",
        selectedCandidateId: "candidate-c",
        candidates: [
          { id: "candidate-c", relativePath: "moodboard/c.jpg", fileName: "c.jpg", lookupStrategy: "scan" }
        ]
      }
    ]
  };

  const result = await resolveRecoverySelectedCandidateHandles(rootHandle, session);

  assert.equal(result.approvedMatchCount, 1);
  assert.equal(result.resolvedCount, 1);
  assert.equal(result.missingCount, 0);
  assert.equal(result.invalidPathCount, 0);
  assert.deepEqual(Object.keys(result.candidateEntriesById), ["candidate-a"]);
  assert.equal("file" in result.candidateEntriesById["candidate-a"], false);
  assert.equal(typeof result.candidateEntriesById["candidate-a"].handle.getFile, "function");
});

test("resolveRecoverySelectedCandidateHandles rejects unsafe paths and reports missing files", async () => {
  const rootHandle = createDirectoryHandle("ArchiveRoot", {
    moodboard: createDirectoryHandle("moodboard", {})
  });
  const session = {
    matches: [
      {
        itemId: "item-invalid",
        decision: "accepted",
        selectedCandidateId: "candidate-invalid",
        candidates: [
          { id: "candidate-invalid", relativePath: "../escape.jpg", fileName: "escape.jpg", lookupStrategy: "scan" }
        ]
      },
      {
        itemId: "item-missing",
        decision: "accepted",
        selectedCandidateId: "candidate-missing",
        candidates: [
          { id: "candidate-missing", relativePath: "moodboard/missing.jpg", fileName: "missing.jpg", lookupStrategy: "scan" }
        ]
      }
    ]
  };

  const result = await resolveRecoverySelectedCandidateHandles(rootHandle, session);

  assert.equal(result.resolvedCount, 0);
  assert.equal(result.invalidPathCount, 1);
  assert.equal(result.missingCount, 1);
  assert.equal(result.invalidMatches[0].itemId, "item-invalid");
  assert.equal(result.missingMatches[0].itemId, "item-missing");
});

test("resolveRecoverySelectedCandidateHandles skips already recovered items from current metadata", async () => {
  const rootHandle = createDirectoryHandle("ArchiveRoot", {
    moodboard: createDirectoryHandle("moodboard", {
      "pending.jpg": createFileHandle("pending.jpg"),
      "linked.jpg": createFileHandle("linked.jpg")
    })
  });
  const session = {
    matches: [
      {
        itemId: "item-linked",
        decision: "accepted",
        selectedCandidateId: "candidate-linked",
        knownOriginalRelativePath: "",
        sourceFilenameAliases: [],
        candidates: [
          { id: "candidate-linked", relativePath: "moodboard/linked.jpg", fileName: "linked.jpg", lookupStrategy: "scan" }
        ]
      },
      {
        itemId: "item-pending",
        decision: "accepted",
        selectedCandidateId: "candidate-pending",
        knownOriginalRelativePath: "",
        sourceFilenameAliases: [],
        candidates: [
          { id: "candidate-pending", relativePath: "moodboard/pending.jpg", fileName: "pending.jpg", lookupStrategy: "scan" }
        ]
      }
    ]
  };

  const result = await resolveRecoverySelectedCandidateHandles(rootHandle, session, {
    currentItems: [
      {
        id: "item-linked",
        originalPreserved: true,
        relinkStatus: "linked",
        knownOriginalRelativePath: "moodboard/linked.jpg"
      }
    ]
  });

  assert.equal(result.approvedMatchCount, 1);
  assert.deepEqual(Object.keys(result.candidateEntriesById), ["candidate-pending"]);
});
