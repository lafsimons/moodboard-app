import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { __setIndexedDbFactoryForTests } from "../lib/storage.js";
import { saveItem } from "./itemsRepository.js";
import {
  applyOriginalRecoverySession,
  loadLatestOriginalRecoverySession,
  saveOriginalRecoverySession,
  scanOriginalRecoverySource,
  updateOriginalRecoveryDecision
} from "./originalRecoveryRepository.js";

class FakeIDBRequest {
  constructor(result, error = null) {
    this.result = result;
    this.error = error;

    queueMicrotask(() => {
      if (this.error) {
        this.onerror?.();
        return;
      }

      this.onsuccess?.();
    });
  }
}

class FakeObjectStore {
  constructor(store) {
    this.store = store;
  }

  put(value) {
    const key = value?.[this.store.keyPath];
    this.store.records.set(key, value);
    return new FakeIDBRequest(key);
  }

  get(key) {
    return new FakeIDBRequest(this.store.records.get(key));
  }

  getAll() {
    return new FakeIDBRequest([...this.store.records.values()]);
  }

  delete(key) {
    this.store.records.delete(key);
    return new FakeIDBRequest(undefined);
  }

  clear() {
    this.store.records.clear();
    return new FakeIDBRequest(undefined);
  }
}

class FakeTransaction {
  constructor(database) {
    this.database = database;

    queueMicrotask(() => {
      this.oncomplete?.();
    });
  }

  objectStore(name) {
    const store = this.database.stores.get(name);

    if (!store) {
      throw new Error(`Missing object store: ${name}`);
    }

    return new FakeObjectStore(store);
  }
}

class FakeDatabase {
  constructor(version = 0) {
    this.version = version;
    this.stores = new Map();
    this.objectStoreNames = {
      contains: (name) => this.stores.has(name)
    };
  }

  createObjectStore(name, options = {}) {
    const store = {
      keyPath: options.keyPath ?? "id",
      records: new Map()
    };

    this.stores.set(name, store);
    return new FakeObjectStore(store);
  }

  transaction() {
    return new FakeTransaction(this);
  }

  close() {}
}

class FakeOpenRequest {
  constructor(database, needsUpgrade) {
    this.result = database;

    queueMicrotask(() => {
      if (needsUpgrade) {
        this.onupgradeneeded?.();
      }

      this.onsuccess?.();
    });
  }
}

class FakeIndexedDb {
  constructor() {
    this.database = null;
  }

  open(_name, version) {
    const needsUpgrade = !this.database || version > this.database.version;

    if (!this.database) {
      this.database = new FakeDatabase(version);
    } else if (version > this.database.version) {
      this.database.version = version;
    }

    return new FakeOpenRequest(this.database, needsUpgrade);
  }

  deleteDatabase() {
    this.database = null;
    return new FakeIDBRequest(undefined);
  }
}

const originalIdbRequest = globalThis.IDBRequest;

function installFakeIndexedDb() {
  const fakeIndexedDb = new FakeIndexedDb();
  globalThis.IDBRequest = FakeIDBRequest;
  __setIndexedDbFactoryForTests(() => fakeIndexedDb);
  return fakeIndexedDb;
}

afterEach(async () => {
  __setIndexedDbFactoryForTests();

  if (originalIdbRequest === undefined) {
    delete globalThis.IDBRequest;
  } else {
    globalThis.IDBRequest = originalIdbRequest;
  }
});

test("scanOriginalRecoverySource persists a report and skips non-image files", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Camel Coat",
    sourceOriginalFilename: "camel-coat.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-1",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });
  await saveItem({
    id: "item-2",
    itemUuid: "uuid-2",
    name: "Linked",
    originalPreserved: true
  });

  const exactFile = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const textFile = new File(["ignore"], "notes.txt", {
    type: "text/plain",
    lastModified: 1717236000000
  });
  const result = await scanOriginalRecoverySource({
    adapter: {
      scan: async () => ({
        sourceLabel: "Archive",
        entries: [
          { id: "candidate-1", sourceLabel: "Archive", relativePath: "archive/camel-coat.jpg", file: exactFile },
          { id: "candidate-2", sourceLabel: "Archive", relativePath: "archive/notes.txt", file: textFile }
        ]
      })
    },
    createOriginalImageAsset: async (file) => ({
      src: `data:${file.type};base64,ZmFrZQ==`,
      mimeType: file.type,
      width: 100,
      height: 50,
      fileSize: file.size,
      originalFilename: file.name
    }),
    now: () => "2026-06-01T12:00:00.000Z"
  });

  assert.equal(result.persisted, true);
  assert.equal(result.session.summary.scannedFileCount, 1);
  assert.equal(result.session.summary.eligibleItemCount, 1);
  assert.equal(result.session.summary.excludedItemCount, 1);
  assert.equal(result.instrumentation.descriptorCount, 1);
  assert.equal(result.instrumentation.fileObjectsRetainedCount, 0);
  assert.equal(result.instrumentation.plausibleCandidateCount, 1);
  assert.equal(result.instrumentation.decodedCandidateCount, 1);
  assert.equal(result.instrumentation.getFileCallCount, 2);
  assert.equal(result.session.matches.find((match) => match.itemId === "item-1").decision, "accepted");

  const latestSession = await loadLatestOriginalRecoverySession();
  assert.equal(latestSession.id, result.session.id);
});

test("scanOriginalRecoverySource separates traversal metadata and decode phases and only decodes plausible candidates", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Camel Coat",
    sourceOriginalFilename: "camel-coat.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-1",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });

  const matchingFile = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const unrelatedFile = new File(["1234"], "totally-unrelated.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const phases = [];
  const decodedFiles = [];

  const result = await scanOriginalRecoverySource({
    adapter: {
      scan: async (options = {}) => {
        options.onProgress?.({
          phase: "traversal",
          traversedFileCount: 1,
          currentPath: "archive/camel-coat.jpg"
        });
        options.onProgress?.({
          phase: "traversal",
          traversedFileCount: 2,
          currentPath: "archive/totally-unrelated.jpg"
        });

        return {
          sourceLabel: "Archive",
          entries: [
            { id: "candidate-1", sourceLabel: "Archive", relativePath: "archive/camel-coat.jpg", file: matchingFile },
            { id: "candidate-2", sourceLabel: "Archive", relativePath: "archive/totally-unrelated.jpg", file: unrelatedFile }
          ]
        };
      }
    },
    createOriginalImageAsset: async (file) => {
      decodedFiles.push(file.name);

      return {
        src: `data:${file.type};base64,ZmFrZQ==`,
        mimeType: file.type,
        width: 100,
        height: 50,
        fileSize: file.size,
        originalFilename: file.name
      };
    },
    onProgress: (event) => {
      phases.push(event.phase);
    },
    now: () => "2026-06-01T12:00:00.000Z"
  });

  assert.deepEqual(decodedFiles, ["camel-coat.jpg"]);
  assert.equal(result.session.summary.scannedFileCount, 2);
  assert.equal(result.instrumentation.descriptorCount, 2);
  assert.equal(result.instrumentation.fileObjectsRetainedCount, 0);
  assert.equal(result.instrumentation.plausibleCandidateCount, 1);
  assert.equal(result.instrumentation.decodedCandidateCount, 1);
  assert.equal(result.instrumentation.getFileCallCount, 2);
  assert.equal(result.session.matches.find((match) => match.itemId === "item-1").selectedCandidateId, "candidate-1");
  assert.equal(phases.includes("traversal"), true);
  assert.equal(phases.includes("matching-filenames"), true);
  assert.equal(phases.includes("reading-candidate-metadata"), true);
  assert.equal(phases.includes("decoding-candidate-images"), true);
  assert.equal(phases.includes("final-scoring"), true);
  assert.equal(phases.includes("saving"), true);
});

test("scanOriginalRecoverySource does not call getFile during traversal and skips getFile for non-plausible candidates", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Camel Coat",
    sourceOriginalFilename: "camel-coat.jpg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-1",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });

  let getFileCount = 0;
  let decodeCount = 0;
  const createEntry = (id, relativePath) => ({
    id,
    sourceLabel: "Archive",
    relativePath,
    fileName: relativePath.split("/").at(-1),
    handle: {
      async getFile() {
        getFileCount += 1;
        return new File(["1234567890"], relativePath.split("/").at(-1), {
          type: "image/jpeg",
          lastModified: 1717236000000
        });
      }
    }
  });

  const result = await scanOriginalRecoverySource({
    adapter: {
      scan: async (options = {}) => {
        options.onProgress?.({ phase: "traversal", traversedFileCount: 1, currentPath: "archive/camel-coat.jpg" });
        assert.equal(getFileCount, 0);
        options.onProgress?.({ phase: "traversal", traversedFileCount: 2, currentPath: "archive/other.jpg" });
        assert.equal(getFileCount, 0);

        return {
          sourceLabel: "Archive",
          entries: [
            createEntry("candidate-1", "archive/camel-coat.jpg"),
            createEntry("candidate-2", "archive/other.jpg")
          ]
        };
      },
      getFile(entry) {
        return entry.handle.getFile();
      }
    },
    createOriginalImageAsset: async (file) => {
      decodeCount += 1;
      return {
        src: `data:${file.type};base64,ZmFrZQ==`,
        mimeType: file.type,
        width: 100,
        height: 50,
        fileSize: file.size,
        originalFilename: file.name
      };
    }
  });

  assert.equal(result.instrumentation.descriptorCount, 2);
  assert.equal(result.instrumentation.plausibleCandidateCount, 1);
  assert.equal(result.instrumentation.getFileCallCount, 2);
  assert.equal(result.instrumentation.decodedCandidateCount, 1);
  assert.equal(decodeCount, 1);
  assert.equal(getFileCount, 2);
});

test("applyOriginalRecoverySession preserves partial progress and marks missing runtime files for re-scan", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-good",
    itemUuid: "uuid-good",
    name: "Good",
    sourceOriginalFilename: "good.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-good",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });
  await saveItem({
    id: "item-bad",
    itemUuid: "uuid-bad",
    name: "Bad",
    sourceOriginalFilename: "bad.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-bad",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });

  const goodFile = new File(["1234567890"], "good.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const badFile = new File(["1234567890"], "bad.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const scanResult = await scanOriginalRecoverySource({
    adapter: {
      scan: async () => ({
        sourceLabel: "Archive",
        entries: [
          { id: "candidate-good", sourceLabel: "Archive", relativePath: "archive/good.jpg", file: goodFile },
          { id: "candidate-bad", sourceLabel: "Archive", relativePath: "archive/bad.jpg", file: badFile }
        ]
      })
    },
    createOriginalImageAsset: async (file) => ({
      src: `data:${file.type};base64,ZmFrZQ==`,
      mimeType: file.type,
      width: 100,
      height: 50,
      fileSize: file.size,
      originalFilename: file.name
    })
  });

  const applyResult = await applyOriginalRecoverySession(scanResult.session.id, {
    candidateEntriesById: {
      "candidate-good": { file: goodFile }
    },
    createOriginalImageAsset: async (file) => {
      if (file.name === "bad.jpg") {
        throw new Error("Decoder failed.");
      }

      return {
        src: `data:${file.type};base64,ZmFrZQ==`,
        mimeType: file.type,
        width: 100,
        height: 50,
        fileSize: file.size,
        originalFilename: file.name
      };
    },
    now: () => "2026-06-01T12:34:56.000Z"
  });

  assert.equal(applyResult.recoveredItems.length, 1);
  assert.equal(applyResult.session.summary.recoveredCount, 1);
  assert.equal(applyResult.session.summary.needsRescanCount, 1);
  assert.equal(
    applyResult.session.matches.find((match) => match.itemId === "item-bad").decision,
    "needs_rescan"
  );
});

test("applyOriginalRecoverySession reports per-item progress stages and report persistence", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Camel Coat",
    sourceOriginalFilename: "camel-coat.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-1",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });

  const file = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const scanResult = await scanOriginalRecoverySource({
    adapter: {
      scan: async () => ({
        sourceLabel: "Archive",
        entries: [
          { id: "candidate-1", sourceLabel: "Archive", relativePath: "archive/camel-coat.jpg", file }
        ]
      })
    },
    createOriginalImageAsset: async (selectedFile) => ({
      src: `data:${selectedFile.type};base64,ZmFrZQ==`,
      mimeType: selectedFile.type,
      width: 100,
      height: 50,
      fileSize: selectedFile.size,
      originalFilename: selectedFile.name
    }),
    now: () => "2026-06-01T12:00:00.000Z"
  });
  const phases = [];

  const applyResult = await applyOriginalRecoverySession(scanResult.session.id, {
    currentSession: scanResult.session,
    candidateEntriesById: scanResult.candidateEntriesById,
    createOriginalImageAsset: async (selectedFile) => ({
      src: `data:${selectedFile.type};base64,ZmFrZQ==`,
      mimeType: selectedFile.type,
      width: 100,
      height: 50,
      fileSize: selectedFile.size,
      originalFilename: selectedFile.name
    }),
    onProgress: (event) => {
      phases.push(event.phase);
    },
    now: () => "2026-06-01T12:34:56.000Z"
  });

  assert.equal(applyResult.session.summary.recoveredCount, 1);
  assert.equal(phases.includes("apply-start"), true);
  assert.equal(phases.includes("candidate-lookup"), true);
  assert.equal(phases.includes("file-read"), true);
  assert.equal(phases.includes("decoded"), true);
  assert.equal(phases.includes("blob-write"), true);
  assert.equal(phases.includes("item-save"), true);
  assert.equal(phases.includes("item-recovered"), true);
  assert.equal(phases.includes("report-persistence"), true);
  assert.equal(phases.includes("apply-complete"), true);
});

test("scan approve and apply still work with in-memory session when persistence is unavailable", async () => {
  const indexedDb = installFakeIndexedDb();
  indexedDb.open("ignored", 8);
  const database = indexedDb.database;
  database.createObjectStore("items", { keyPath: "id" });
  database.createObjectStore("appState", { keyPath: "key" });
  database.createObjectStore("originalImageBlobs", { keyPath: "itemUuid" });
  database.createObjectStore("itemMediaAssets", { keyPath: "key" });
  database.createObjectStore("syncState", { keyPath: "key" });
  database.createObjectStore("syncMetadata", { keyPath: "key" });
  database.createObjectStore("metadataSnapshots", { keyPath: "id" });

  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Camel Coat",
    sourceOriginalFilename: "camel-coat.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-1",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });

  const exactFile = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const scanResult = await scanOriginalRecoverySource({
    adapter: {
      scan: async () => ({
        sourceLabel: "Archive",
        entries: [
          { id: "candidate-1", sourceLabel: "Archive", relativePath: "archive/camel-coat.jpg", file: exactFile }
        ]
      })
    },
    createOriginalImageAsset: async (file) => ({
      src: `data:${file.type};base64,ZmFrZQ==`,
      mimeType: file.type,
      width: 100,
      height: 50,
      fileSize: file.size,
      originalFilename: file.name
    })
  });

  assert.equal(scanResult.persisted, false);

  const approvedResult = await updateOriginalRecoveryDecision(scanResult.session.id, "item-1", "accepted", {
    currentSession: scanResult.session
  });

  assert.equal(approvedResult.persisted, false);
  assert.equal(approvedResult.session.matches[0].decision, "accepted");

  const applyResult = await applyOriginalRecoverySession(scanResult.session.id, {
    currentSession: approvedResult.session,
    candidateEntriesById: scanResult.candidateEntriesById,
    createOriginalImageAsset: async (file) => ({
      src: `data:${file.type};base64,ZmFrZQ==`,
      mimeType: file.type,
      width: 100,
      height: 50,
      fileSize: file.size,
      originalFilename: file.name
    }),
    now: () => "2026-06-01T12:34:56.000Z"
  });

  assert.equal(applyResult.persisted, false);
  assert.equal(applyResult.recoveredItems.length, 1);
  assert.equal(applyResult.session.summary.recoveredCount, 1);
});

test("persisted session missing but current in-memory session exists still applies successfully", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Camel Coat",
    sourceOriginalFilename: "camel-coat.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-1",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });

  const file = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const scanResult = await scanOriginalRecoverySource({
    adapter: {
      scan: async () => ({
        sourceLabel: "Archive",
        entries: [
          { id: "candidate-1", sourceLabel: "Archive", relativePath: "archive/camel-coat.jpg", file }
        ]
      })
    },
    createOriginalImageAsset: async (selectedFile) => ({
      src: `data:${selectedFile.type};base64,ZmFrZQ==`,
      mimeType: selectedFile.type,
      width: 100,
      height: 50,
      fileSize: selectedFile.size,
      originalFilename: selectedFile.name
    })
  });

  const applyResult = await applyOriginalRecoverySession("missing-session-id", {
    currentSession: scanResult.session,
    candidateEntriesById: scanResult.candidateEntriesById,
    createOriginalImageAsset: async (selectedFile) => ({
      src: `data:${selectedFile.type};base64,ZmFrZQ==`,
      mimeType: selectedFile.type,
      width: 100,
      height: 50,
      fileSize: selectedFile.size,
      originalFilename: selectedFile.name
    })
  });

  assert.equal(applyResult.recoveredItems.length, 1);
  assert.equal(applyResult.session.summary.recoveredCount, 1);
});

test("persisted session missing and no current in-memory session requires rescan", async () => {
  installFakeIndexedDb();

  await assert.rejects(
    applyOriginalRecoverySession("missing-session-id", {
      candidateEntriesById: {},
      createOriginalImageAsset: async () => ({
        src: "",
        mimeType: "image/jpeg",
        width: 0,
        height: 0,
        fileSize: 0,
        originalFilename: ""
      })
    }),
    /Re-scan the source before applying/
  );
});

test("after recovery-store availability save load and apply from persisted session works", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    name: "Camel Coat",
    sourceOriginalFilename: "camel-coat.jpg",
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 1717236000000,
    mimeType: "image/jpeg",
    originalPreserved: false,
    images: {
      preview: {
        src: "data:image/webp;base64,preview-1",
        mimeType: "image/webp",
        width: 100,
        height: 50
      }
    }
  });

  const file = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  const scanResult = await scanOriginalRecoverySource({
    adapter: {
      scan: async () => ({
        sourceLabel: "Archive",
        entries: [
          { id: "candidate-1", sourceLabel: "Archive", relativePath: "archive/camel-coat.jpg", file }
        ]
      })
    },
    createOriginalImageAsset: async (selectedFile) => ({
      src: `data:${selectedFile.type};base64,ZmFrZQ==`,
      mimeType: selectedFile.type,
      width: 100,
      height: 50,
      fileSize: selectedFile.size,
      originalFilename: selectedFile.name
    })
  });

  assert.equal(scanResult.persisted, true);

  const saveResult = await saveOriginalRecoverySession(scanResult.session);
  assert.equal(saveResult.persisted, true);

  const latestSession = await loadLatestOriginalRecoverySession();
  assert.equal(latestSession.id, scanResult.session.id);

  const applyResult = await applyOriginalRecoverySession(scanResult.session.id, {
    candidateEntriesById: scanResult.candidateEntriesById,
    createOriginalImageAsset: async (selectedFile) => ({
      src: `data:${selectedFile.type};base64,ZmFrZQ==`,
      mimeType: selectedFile.type,
      width: 100,
      height: 50,
      fileSize: selectedFile.size,
      originalFilename: selectedFile.name
    })
  });

  assert.equal(applyResult.persisted, true);
  assert.equal(applyResult.recoveredItems.length, 1);
});
