import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __setIndexedDbFactoryForTests,
  saveItem,
  saveOriginalImageBlob
} from "./storage.js";
import { INDEXED_DB_NAME } from "./appIdentity.js";
import { runMediaIntegrityCheck } from "./mediaIntegrity.js";

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
    this.store.putCount += 1;
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
    this.store.deleteCount += 1;
    this.store.records.delete(key);
    return new FakeIDBRequest(undefined);
  }

  clear() {
    this.store.clearCount += 1;
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
      records: new Map(),
      putCount: 0,
      deleteCount: 0,
      clearCount: 0
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

class FakeIndexedDB {
  constructor() {
    this.databases = new Map();
  }

  open(name, version) {
    const database = this.databases.get(name) ?? null;
    const needsUpgrade = !database || version > database.version;

    if (!database) {
      this.databases.set(name, new FakeDatabase(version));
    } else if (version > database.version) {
      database.version = version;
    }

    return new FakeOpenRequest(this.databases.get(name), needsUpgrade);
  }

  getDatabase(name) {
    return this.databases.get(name) ?? null;
  }
}

const originalIdbRequest = globalThis.IDBRequest;

afterEach(() => {
  __setIndexedDbFactoryForTests();

  if (originalIdbRequest === undefined) {
    delete globalThis.IDBRequest;
  } else {
    globalThis.IDBRequest = originalIdbRequest;
  }
});

function installFakeIndexedDb() {
  const indexedDb = new FakeIndexedDB();
  globalThis.IDBRequest = FakeIDBRequest;
  __setIndexedDbFactoryForTests(() => indexedDb);
  const database = indexedDb.open(INDEXED_DB_NAME, 4).result;

  [
    ["items", "id"],
    ["appState", "key"],
    ["itemMediaAssets", "key"],
    ["originalImageBlobs", "itemUuid"],
    ["syncState", "key"],
    ["syncMetadata", "key"]
  ].forEach(([storeName, keyPath]) => {
    if (!database.stores.has(storeName)) {
      database.createObjectStore(storeName, { keyPath });
    }
  });

  return indexedDb;
}

function seedStore(indexedDb, storeName, keyPath, records) {
  const database = indexedDb.getDatabase(INDEXED_DB_NAME) ?? new FakeDatabase(4);

  if (!indexedDb.getDatabase(INDEXED_DB_NAME)) {
    indexedDb.databases.set(INDEXED_DB_NAME, database);
  }

  const store =
    database.stores.get(storeName) ??
    (() => {
      database.createObjectStore(storeName, { keyPath });
      return database.stores.get(storeName);
    })();

  records.forEach((record) => {
    store.records.set(record[keyPath], record);
  });
}

test("healthy library returns no media integrity warnings", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-healthy",
    itemUuid: "uuid-healthy",
    name: "Healthy reference",
    images: {
      original: {
        src: "data:image/png;base64,b3JpZw==",
        mimeType: "image/png",
        width: 2400,
        height: 1800,
        originalFilename: "healthy.png"
      },
      preview: {
        src: "data:image/webp;base64,cHJldmlldw==",
        mimeType: "image/webp",
        width: 1200,
        height: 900,
        originalFilename: "healthy.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,dGh1bWI=",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        originalFilename: "healthy-thumb.webp"
      }
    },
    originalPreserved: true
  });

  const report = await runMediaIntegrityCheck();

  assert.equal(report.warningsFound, false);
  assert.equal(report.status, "healthy");
  assert.equal(report.summary.items, 1);
  assert.equal(report.summary.previewAssets, 1);
  assert.equal(report.summary.thumbnailAssets, 1);
  assert.equal(report.summary.originalBlobs, 1);
  assert.equal(report.summary.orphanedRecords, 0);
  assert.equal(report.summary.missingPreviewMediaItems, 0);
});

test("orphaned itemMediaAssets are detected", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "items", "id", [
    { id: "item-1", itemUuid: "uuid-1", name: "Reference 1", images: { preview: { src: "" } } }
  ]);
  seedStore(indexedDb, "itemMediaAssets", "key", [
    {
      key: "orphan-preview",
      itemId: "missing-item",
      variant: "preview",
      asset: {
        src: "",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        blob: new Blob(["preview"], { type: "image/webp" })
      }
    }
  ]);

  const report = await runMediaIntegrityCheck();

  assert.equal(report.issues.orphanedItemMediaAssets.count, 1);
  assert.equal(report.issues.orphanedItemMediaAssets.samples[0].itemId, "missing-item");
});

test("orphaned originalImageBlobs are detected", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "items", "id", []);
  seedStore(indexedDb, "originalImageBlobs", "itemUuid", [
    {
      itemUuid: "missing-uuid",
      blob: new Blob(["original"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
      width: 1800,
      height: 1200,
      originalFilename: "missing.jpg"
    }
  ]);

  const report = await runMediaIntegrityCheck();

  assert.equal(report.issues.orphanedOriginalImageBlobs.count, 1);
  assert.equal(report.issues.orphanedOriginalImageBlobs.samples[0].itemUuid, "missing-uuid");
});

test("items missing preview media are detected", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-no-preview",
    itemUuid: "uuid-no-preview",
    name: "No preview"
  });

  const report = await runMediaIntegrityCheck();

  assert.equal(report.issues.itemsMissingPreviewMedia.count, 1);
  assert.equal(report.issues.itemsMissingAnyMediaSource.count, 1);
  assert.equal(report.issues.itemsMissingPreviewMedia.samples[0].id, "item-no-preview");
});

test("duplicate itemId and variant media rows are detected", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "items", "id", [
    { id: "item-dup", itemUuid: "uuid-dup", name: "Duplicate media target" }
  ]);
  seedStore(indexedDb, "itemMediaAssets", "key", [
    {
      key: "duplicate-a",
      itemId: "item-dup",
      variant: "preview",
      asset: {
        src: "data:image/webp;base64,aaaa",
        mimeType: "image/webp",
        width: 640,
        height: 480
      }
    },
    {
      key: "duplicate-b",
      itemId: "item-dup",
      variant: "preview",
      asset: {
        src: "",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        blob: new Blob(["preview"], { type: "image/webp" })
      }
    }
  ]);

  const report = await runMediaIntegrityCheck();

  assert.equal(report.issues.duplicateItemMediaAssetEntries.count, 1);
  assert.equal(report.issues.duplicateItemMediaAssetEntries.rowCount, 2);
  assert.equal(report.issues.duplicateItemMediaAssetEntries.samples[0].itemId, "item-dup");
  assert.equal(report.summary.packageImportedBlobPreviewAssets, 1);
});

test("inline media payloads persisted in item rows are detected", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "items", "id", [
    {
      id: "item-inline",
      itemUuid: "uuid-inline",
      name: "Inline payload",
      imageUrl: "data:image/webp;base64,legacy-preview",
      images: {
        preview: {
          src: "data:image/webp;base64,legacy-preview",
          mimeType: "image/webp",
          width: 900,
          height: 600
        }
      }
    }
  ]);

  const report = await runMediaIntegrityCheck();

  assert.equal(report.issues.itemsWithInlineMediaPayloads.count, 1);
  assert.equal(report.issues.itemsWithInlineMediaPayloads.samples[0].id, "item-inline");
});

test("media integrity diagnostics are read-only and do not mutate stores", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveItem({
    id: "item-read-only",
    itemUuid: "uuid-read-only",
    name: "Read only",
    images: {
      preview: {
        src: "data:image/webp;base64,cHJldmlldw==",
        mimeType: "image/webp",
        width: 640,
        height: 480
      }
    }
  });
  await saveOriginalImageBlob("uuid-read-only", new Blob(["original"], { type: "image/jpeg" }), {
    mimeType: "image/jpeg",
    width: 1800,
    height: 1200,
    originalFilename: "readonly.jpg"
  });

  const database = indexedDb.getDatabase(INDEXED_DB_NAME);
  const itemStore = database.stores.get("items");
  const mediaStore = database.stores.get("itemMediaAssets");
  const originalStore = database.stores.get("originalImageBlobs");
  const itemPutCount = itemStore.putCount;
  const mediaPutCount = mediaStore.putCount;
  const originalPutCount = originalStore.putCount;
  const itemDeleteCount = itemStore.deleteCount;
  const mediaDeleteCount = mediaStore.deleteCount;
  const originalDeleteCount = originalStore.deleteCount;

  await runMediaIntegrityCheck();

  assert.equal(itemStore.putCount, itemPutCount);
  assert.equal(mediaStore.putCount, mediaPutCount);
  assert.equal(originalStore.putCount, originalPutCount);
  assert.equal(itemStore.deleteCount, itemDeleteCount);
  assert.equal(mediaStore.deleteCount, mediaDeleteCount);
  assert.equal(originalStore.deleteCount, originalDeleteCount);
});
