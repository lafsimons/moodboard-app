import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __setIndexedDbFactoryForTests,
  loadItemById,
  saveItem,
  saveOriginalImageBlob,
  saveOriginalRecoverySession
} from "../lib/storage.js";
import {
  applyLinkedOriginalMetadataEnrichmentReport,
  buildLinkedOriginalMetadataEnrichmentReport
} from "./originalMetadataEnrichmentRepository.js";

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
        this.onupgradeneeded?.({
          target: {
            result: database
          }
        });
      }

      this.onsuccess?.();
    });
  }
}

class FakeIndexedDB {
  constructor() {
    this.database = null;
  }

  open(_name, version) {
    const needsUpgrade = !this.database || this.database.version < version;

    if (!this.database) {
      this.database = new FakeDatabase(version);
    } else if (needsUpgrade) {
      this.database.version = version;
    }

    return new FakeOpenRequest(this.database, needsUpgrade);
  }
}

const originalIdbRequest = globalThis.IDBRequest;

function installFakeIndexedDb() {
  const indexedDb = new FakeIndexedDB();
  globalThis.IDBRequest = FakeIDBRequest;
  __setIndexedDbFactoryForTests(() => indexedDb);
  return indexedDb;
}

afterEach(() => {
  __setIndexedDbFactoryForTests(null);

  if (originalIdbRequest === undefined) {
    delete globalThis.IDBRequest;
  } else {
    globalThis.IDBRequest = originalIdbRequest;
  }
});

test("linked original metadata enrichment dry run and apply produce expected counts", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-enrich",
    itemUuid: "uuid-enrich",
    name: "Needs Enrichment",
    originalPreserved: true,
    sourceFileSize: 0,
    sourceImageWidth: 0,
    sourceImageHeight: 0,
    sourceLastModified: 0,
    mimeType: "",
    sourceOriginalFilename: "",
    sourceFilenameAliases: [],
    originalRelinkedFilename: "",
    originalLinkedAt: "",
    images: {
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        fileSize: 100,
        originalFilename: "preview.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        fileSize: 50,
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
    }
  });

  await saveItem({
    id: "item-skip",
    itemUuid: "uuid-skip",
    name: "Already Enriched",
    originalPreserved: true,
    sourceFileSize: 10,
    sourceImageWidth: 100,
    sourceImageHeight: 50,
    sourceLastModified: 0,
    mimeType: "image/png",
    sourceOriginalFilename: "existing.png",
    sourceFilenameAliases: [],
    originalRelinkedFilename: "existing.png",
    originalLinkedAt: "2026-06-01T00:00:00.000Z",
    images: {
      preview: {
        src: "data:image/webp;base64,preview2",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        fileSize: 100,
        originalFilename: "preview2.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb2",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        fileSize: 50,
        originalFilename: "thumb2.webp"
      },
      original: {
        src: "",
        mimeType: "image/png",
        width: 100,
        height: 50,
        fileSize: 10,
        originalFilename: "existing.png"
      }
    }
  });

  await saveItem({
    id: "item-unlinked",
    itemUuid: "uuid-unlinked",
    name: "Unlinked",
    originalPreserved: false
  });

  await saveOriginalImageBlob("uuid-enrich", new Blob(["original-enrich"], { type: "image/jpeg" }), {
    mimeType: "image/jpeg",
    width: 1600,
    height: 1200,
    fileSize: 2048,
    originalFilename: "linked-original.jpg"
  });
  await saveOriginalImageBlob("uuid-skip", new Blob(["original-skip"], { type: "image/png" }), {
    mimeType: "image/png",
    width: 100,
    height: 50,
    fileSize: 10,
    originalFilename: "existing.png"
  });

  await saveOriginalRecoverySession({
    id: "session-1",
    updatedAt: "2026-06-02T12:00:00.000Z",
    matches: [
      {
        itemId: "item-enrich",
        selectedCandidateId: "candidate-1",
        applyResult: {
          status: "recovered",
          appliedAt: "2026-06-02T12:00:00.000Z"
        },
        candidates: [
          {
            id: "candidate-1",
            relativePath: "archive/linked-original.jpg"
          }
        ]
      }
    ]
  });

  const storedItems = await Promise.all([
    loadItemById("item-enrich"),
    loadItemById("item-skip"),
    loadItemById("item-unlinked")
  ]);
  const report = await buildLinkedOriginalMetadataEnrichmentReport(storedItems, { exampleLimit: 20 });

  assert.equal(report.eligibleLinkedItemCount, 2);
  assert.equal(report.updatedItemCount, 1);
  assert.equal(report.skippedItemCount, 1);
  assert.equal(report.fieldCounts.sourceFileSize, 1);
  assert.equal(report.fieldCounts.sourceImageWidth, 1);
  assert.equal(report.fieldCounts.sourceImageHeight, 1);

  const applyResult = await applyLinkedOriginalMetadataEnrichmentReport(report);

  assert.equal(applyResult.updatedItemCount, 1);
  assert.equal(applyResult.skippedItemCount, 1);

  const enrichedItem = await loadItemById("item-enrich");
  assert.equal(enrichedItem.id, "item-enrich");
  assert.equal(enrichedItem.itemUuid, "uuid-enrich");
  assert.equal(enrichedItem.sourceFileSize, 2048);
  assert.equal(enrichedItem.sourceImageWidth, 1600);
  assert.equal(enrichedItem.sourceImageHeight, 1200);
  assert.equal(enrichedItem.mimeType, "image/webp");
  assert.equal(enrichedItem.sourceOriginalFilename, "linked-original.jpg");
  assert.equal(enrichedItem.originalRelinkedFilename, "linked-original.jpg");
  assert.equal(enrichedItem.originalRelinkedRelativePath, "archive/linked-original.jpg");
  assert.deepEqual(enrichedItem.sourceFilenameAliases, ["preview.webp"]);
  assert.equal(enrichedItem.images.preview.originalFilename, "preview.webp");
  assert.equal(enrichedItem.images.thumbnail.originalFilename, "thumb.webp");
});
