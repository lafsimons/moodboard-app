import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __setIndexedDbFactoryForTests,
  createLightweightBackupData,
  deleteOriginalImageBlob,
  hasOriginalImageBlob,
  loadItems,
  loadOriginalImageBlob,
  loadOriginalImageBlobEntry,
  prepareBackupImport,
  replaceWithBackup,
  replaceWithPreparedBackup,
  saveOriginalImageBlob
} from "./storage.js";

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
  constructor(database, storeNames) {
    this.database = database;
    this.storeNames = storeNames;

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

  transaction(storeNames) {
    const normalizedStoreNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new FakeTransaction(this, normalizedStoreNames);
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
  return indexedDb;
}

test("createLightweightBackupData preserves preview as the portable render asset", () => {
  const backup = createLightweightBackupData([
    {
      id: "item-1",
      itemUuid: "uuid-1",
      imageUrl: "data:image/webp;base64,legacy-preview",
      images: {
        original: {
          src: "data:image/jpeg;base64,original",
          mimeType: "image/jpeg",
          width: 3000,
          height: 2000,
          fileSize: 9000,
          originalFilename: "look.jpg"
        },
        preview: {
          src: "data:image/webp;base64,preview",
          mimeType: "image/webp",
          width: 1400,
          height: 933,
          fileSize: 1500,
          originalFilename: "look.jpg"
        },
        thumbnail: {
          src: "data:image/webp;base64,thumb",
          mimeType: "image/webp",
          width: 520,
          height: 346,
          fileSize: 300,
          originalFilename: "look.jpg"
        }
      },
      originalPreserved: true
    }
  ], {
    recentOutfits: [{ id: "ignore" }],
    savedOutfits: []
  });

  assert.equal(backup.items[0].imageUrl, "data:image/webp;base64,preview");
  assert.equal(backup.items[0].imageWidth, 1400);
  assert.equal(backup.items[0].originalPreserved, false);
  assert.equal(backup.items[0].images.preview.src, "");
  assert.deepEqual(backup.appState, {
    savedOutfits: []
  });
});

test("prepareBackupImport normalizes legacy backups and fills source identity defaults", () => {
  const prepared = prepareBackupImport({
    source: "outfit-app",
    version: 1,
    exportedAt: "2026-05-07T12:00:00.000Z",
    items: [
      {
        id: "item-1",
        imageUrl: "data:image/webp;base64,preview-only",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "legacy.png",
        tags: ["archive"]
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: [{ id: "drop-me" }]
    }
  });

  assert.equal(prepared.items[0].images.preview.src, "data:image/webp;base64,preview-only");
  assert.equal(prepared.items[0].sourceOriginalFilename, "legacy.png");
  assert.equal(prepared.items[0].relinkStatus, "pending");
  assert.ok(prepared.items[0].itemUuid);
  assert.deepEqual(prepared.appState, {
    savedOutfits: [],
    recentOutfits: []
  });
});

test("prepareBackupImport rejects invalid payloads before replacement", () => {
  assert.throws(
    () => prepareBackupImport({
      source: "outfit-app",
      version: 2,
      items: [{ id: "" }],
      appState: {}
    }),
    /missing an id/i
  );
});

test("replaceWithBackup leaves existing items untouched when validation fails", async () => {
  installFakeIndexedDb();

  const validPreparedBackup = prepareBackupImport({
    source: "outfit-app",
    version: 2,
    exportedAt: "2026-05-07T12:00:00.000Z",
    items: [
      {
        id: "existing-item",
        imageUrl: "data:image/webp;base64,preview",
        imageWidth: 1000,
        imageHeight: 700,
        mimeType: "image/webp",
        fileSize: 1200,
        originalFilename: "existing.png"
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: []
    }
  });

  await replaceWithPreparedBackup(validPreparedBackup);

  await assert.rejects(
    () => replaceWithBackup({
      source: "outfit-app",
      version: 2,
      items: [{ id: "" }],
      appState: {}
    }),
    /missing an id/i
  );

  const persistedItems = await loadItems();
  assert.equal(persistedItems.length, 1);
  assert.equal(persistedItems[0].id, "existing-item");
});

test("original image blob helpers save load and delete entries", async () => {
  installFakeIndexedDb();

  const blob = new Blob(["future-original"], { type: "image/jpeg" });
  await saveOriginalImageBlob("uuid-1", blob, {
    mimeType: "image/jpeg",
    width: 2400,
    height: 1800,
    fileSize: 1024,
    originalFilename: "future.jpg"
  });

  assert.equal(await hasOriginalImageBlob("uuid-1"), true);

  const storedBlob = await loadOriginalImageBlob("uuid-1");
  assert.equal(await storedBlob.text(), "future-original");

  const entry = await loadOriginalImageBlobEntry("uuid-1");
  assert.equal(entry.originalFilename, "future.jpg");
  assert.equal(entry.width, 2400);

  await deleteOriginalImageBlob("uuid-1");
  assert.equal(await hasOriginalImageBlob("uuid-1"), false);
});
