import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  __setIndexedDbFactoryForTests,
  backfillLocalSyncMetadata,
  clearSyncMetadata,
  createLightweightBackupData,
  deleteOriginalImageBlob,
  getOrCreateDeviceId,
  getSyncMetadata,
  hasOriginalImageBlob,
  loadAppState,
  loadItems,
  loadOriginalImageBlob,
  loadOriginalImageBlobEntry,
  prepareBackupImport,
  replaceWithBackup,
  replaceWithPreparedBackup,
  resetToDefaults,
  saveAppState,
  saveItem,
  saveOriginalImageBlob,
  deleteItem,
  upsertSyncMetadata
} from "./storage.js";
import defaultWardrobe from "../data/defaultWardrobe.js";

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
  return indexedDb;
}

function seedStore(indexedDb, databaseName, storeName, keyPath, records) {
  const database = indexedDb.getDatabase(databaseName) ?? new FakeDatabase(2);

  if (!indexedDb.getDatabase(databaseName)) {
    indexedDb.databases.set(databaseName, database);
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

test("createLightweightBackupData preserves preview as the portable render asset and leaves sync state out of backup exports", () => {
  const backup = createLightweightBackupData([
    {
      id: "item-1",
      itemUuid: "uuid-1",
      importSource: "oa-backup",
      relinkStatus: "hub-awaiting-rebind",
      styleTags: ["Smart Casual"],
      climateTags: ["Cold"],
      imageUrl: "data:image/webp;base64,legacy-preview",
      images: {
        original: {
          src: "data:image/jpeg;base64,original",
          mimeType: "image/jpeg",
          width: 3000,
          height: 2000,
          fileSize: 9000,
          originalFilename: "look.jpg",
          checksum: "orig-checksum"
        },
        preview: {
          src: "data:image/webp;base64,preview",
          mimeType: "image/webp",
          width: 1400,
          height: 933,
          fileSize: 1500,
          originalFilename: "look.jpg",
          cdnPath: "/portable/preview.webp"
        },
        thumbnail: {
          src: "data:image/webp;base64,thumb",
          mimeType: "image/webp",
          width: 520,
          height: 346,
          fileSize: 300,
          originalFilename: "look.jpg",
          blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj"
        }
      },
      originalPreserved: true
    }
  ], {
    recentOutfits: [{ id: "ignore" }],
    savedOutfits: []
  });

  assert.equal(backup.source, "moodboard-app");
  assert.equal(backup.items[0].imageUrl, "data:image/webp;base64,preview");
  assert.equal(backup.items[0].imageWidth, 1400);
  assert.equal(backup.items[0].originalPreserved, false);
  assert.equal(backup.items[0].images.original.src, "");
  assert.equal(backup.items[0].images.original.checksum, "orig-checksum");
  assert.equal(backup.items[0].images.preview.src, "data:image/webp;base64,preview");
  assert.equal(backup.items[0].images.preview.cdnPath, "/portable/preview.webp");
  assert.equal(backup.items[0].images.thumbnail.src, "data:image/webp;base64,thumb");
  assert.equal(backup.items[0].images.thumbnail.blurHash, "LEHV6nWB2yk8pyo0adR*.7kCMdnj");
  assert.equal(backup.items[0].importSource, "oa-backup");
  assert.equal(backup.items[0].relinkStatus, "hub-awaiting-rebind");
  assert.deepEqual(backup.items[0].styleTags, ["Smart Casual"]);
  assert.deepEqual(backup.items[0].climateTags, ["Cold"]);
  assert.deepEqual(backup.appState, {
    savedOutfits: []
  });
  assert.equal("syncState" in backup, false);
  assert.equal("syncMetadata" in backup, false);
});

test("default wardrobe demo references point at bundled working image assets", () => {
  assert.equal(defaultWardrobe.length, 34);
  assert.equal(new Set(defaultWardrobe.map((item) => item.orientation)).size >= 3, true);
  assert.equal(new Set(defaultWardrobe.map((item) => item.fileExtension)).size >= 2, true);

  defaultWardrobe.forEach((item) => {
    assert.match(item.imageUrl, /^\/images\/tt-1-aw21-image/);
    assert.equal(item.imageUrl, item.images.preview.src);
    assert.equal(item.imageUrl, item.images.original.src);
    assert.equal(item.imageUrl, item.images.thumbnail.src);
    assert.equal(item.originalPreserved, true);
    assert.equal(item.imageWidth > 0, true);
    assert.equal(item.imageHeight > 0, true);
    assert.equal(item.tags.includes("demo"), true);

    const absoluteImagePath = path.resolve(process.cwd(), item.imageUrl.slice(1));
    assert.equal(existsSync(absoluteImagePath), true, `${item.id} is missing ${item.imageUrl}`);
  });
});

test("db upgrade creates sync stores", async () => {
  const indexedDb = installFakeIndexedDb();

  await getOrCreateDeviceId();

  const database = indexedDb.getDatabase("moodboard-app-db");
  assert.equal(database.version, 3);
  assert.equal(database.stores.has("syncState"), true);
  assert.equal(database.stores.has("syncMetadata"), true);
});

test("getOrCreateDeviceId creates and reuses a stable local device id", async () => {
  const indexedDb = installFakeIndexedDb();

  const firstDeviceId = await getOrCreateDeviceId();
  const secondDeviceId = await getOrCreateDeviceId();
  const syncStateStore = indexedDb.getDatabase("moodboard-app-db").stores.get("syncState");
  const syncState = syncStateStore.records.get("state");

  assert.equal(firstDeviceId.length > 0, true);
  assert.equal(secondDeviceId, firstDeviceId);
  assert.equal(syncStateStore.records.size, 1);
  assert.equal(syncState.deviceId, firstDeviceId);
  assert.equal(typeof syncState.createdAt, "string");
  assert.equal(typeof syncState.updatedAt, "string");
  assert.equal(syncState.createdAt.length > 0, true);
  assert.equal(syncState.updatedAt.length > 0, true);
  assert.equal(syncState.lastPushCursor, "");
  assert.equal(syncState.lastPullCursor, "");
});

test("getOrCreateDeviceId migrates an existing minimal sync state row to the full shared shape", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "moodboard-app-db", "syncState", "key", [
    {
      key: "state",
      deviceId: "device-existing"
    }
  ]);

  const deviceId = await getOrCreateDeviceId();
  const syncState = indexedDb.getDatabase("moodboard-app-db").stores.get("syncState").records.get("state");

  assert.equal(deviceId, "device-existing");
  assert.deepEqual(syncState, {
    key: "state",
    deviceId: "device-existing",
    createdAt: syncState.createdAt,
    updatedAt: syncState.updatedAt,
    lastPushCursor: "",
    lastPullCursor: ""
  });
  assert.equal(syncState.createdAt.length > 0, true);
  assert.equal(syncState.updatedAt.length > 0, true);
});

test("getOrCreateDeviceId preserves an existing device id while normalizing sync state", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "moodboard-app-db", "syncState", "key", [
    {
      key: "state",
      deviceId: "device-preserved",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-02T11:30:00.000Z",
      lastPushCursor: " push-1 ",
      lastPullCursor: "pull-1"
    }
  ]);

  const deviceId = await getOrCreateDeviceId();
  const syncState = indexedDb.getDatabase("moodboard-app-db").stores.get("syncState").records.get("state");

  assert.equal(deviceId, "device-preserved");
  assert.deepEqual(syncState, {
    key: "state",
    deviceId: "device-preserved",
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-02T11:30:00.000Z",
    lastPushCursor: "push-1",
    lastPullCursor: "pull-1"
  });
});

test("getOrCreateDeviceId safely normalizes invalid or missing sync state fields", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "moodboard-app-db", "syncState", "key", [
    {
      key: "state",
      deviceId: "device-normalized",
      createdAt: "not-a-date",
      updatedAt: 123,
      lastPushCursor: null,
      lastPullCursor: 42
    }
  ]);

  const deviceId = await getOrCreateDeviceId();
  const syncState = indexedDb.getDatabase("moodboard-app-db").stores.get("syncState").records.get("state");

  assert.equal(deviceId, "device-normalized");
  assert.equal(syncState.key, "state");
  assert.equal(syncState.deviceId, "device-normalized");
  assert.equal(syncState.createdAt.length > 0, true);
  assert.equal(syncState.updatedAt.length > 0, true);
  assert.equal(syncState.createdAt, syncState.updatedAt);
  assert.equal(syncState.lastPushCursor, "");
  assert.equal(syncState.lastPullCursor, "");
});

test("backfillLocalSyncMetadata creates local-only reference metadata keyed by itemUuid", async () => {
  installFakeIndexedDb();

  const result = await backfillLocalSyncMetadata([
    {
      id: "item-1",
      itemUuid: "uuid-1",
      imageUrl: "data:image/webp;base64,preview",
      imageWidth: 1200,
      imageHeight: 800,
      mimeType: "image/webp",
      fileSize: 1111,
      originalFilename: "ref.png"
    }
  ], []);

  const metadata = await getSyncMetadata("mba:reference:uuid-1");

  assert.equal(result.createdCount, 1);
  assert.equal(metadata.entityType, "mbaReference");
  assert.equal(metadata.stableKey, "uuid-1");
  assert.equal(metadata.localId, "item-1");
  assert.equal(metadata.recordVersion, 0);
  assert.equal(metadata.syncStatus, "local_only");
  assert.equal(metadata.pendingDelete, false);
  assert.equal(metadata.lastModifiedByDevice, result.deviceId);
});

test("backfillLocalSyncMetadata creates local-only saved-board metadata keyed by boardUuid", async () => {
  installFakeIndexedDb();

  const result = await backfillLocalSyncMetadata([], [
    {
      id: "saved-1",
      name: "Saved board",
      board: {
        id: "board-1",
        boardUuid: "board-uuid-1",
        images: [{ referenceId: "item-1" }]
      }
    }
  ]);

  const metadata = await getSyncMetadata("mba:board:board-uuid-1");

  assert.equal(result.createdCount, 1);
  assert.equal(metadata.entityType, "mbaBoard");
  assert.equal(metadata.stableKey, "board-uuid-1");
  assert.equal(metadata.localId, "saved-1");
  assert.equal(metadata.recordVersion, 0);
  assert.equal(metadata.syncStatus, "local_only");
  assert.equal(metadata.pendingDelete, false);
  assert.equal(metadata.lastModifiedByDevice, result.deviceId);
});

test("backfillLocalSyncMetadata keeps the current working board unsynced", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        imageUrl: "data:image/webp;base64,preview",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "ref.png"
      }
    ],
    appState: {
      board: {
        id: "working-board",
        boardUuid: "working-board-uuid",
        images: [{ referenceId: "item-1" }]
      },
      savedOutfits: [],
      recentOutfits: []
    }
  });

  const allMetadata = await getSyncMetadata();

  assert.deepEqual(
    allMetadata.map((entry) => entry.key).sort(),
    ["mba:reference:uuid-1"]
  );
  assert.equal(await getSyncMetadata("mba:board:working-board-uuid"), null);
});

test("reference create and update mark metadata pending upload", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    imageUrl: "data:image/webp;base64,preview",
    imageWidth: 1200,
    imageHeight: 800,
    mimeType: "image/webp",
    fileSize: 1111,
    originalFilename: "ref.png"
  });

  const createdMetadata = await getSyncMetadata("mba:reference:uuid-1");
  assert.equal(createdMetadata.syncStatus, "pending_upload");
  assert.equal(createdMetadata.recordVersion, 1);
  assert.equal(createdMetadata.pendingDelete, false);
  assert.equal(createdMetadata.lastLocalChangeAt.length > 0, true);

  await upsertSyncMetadata({
    ...createdMetadata,
    syncStatus: "synced",
    recordVersion: 4,
    lastSyncedAt: "2026-05-18T12:00:00.000Z",
    lastSyncError: "old-error"
  });

  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    imageUrl: "data:image/webp;base64,preview-2",
    imageWidth: 1200,
    imageHeight: 800,
    mimeType: "image/webp",
    fileSize: 1111,
    originalFilename: "ref.png"
  });

  const updatedMetadata = await getSyncMetadata("mba:reference:uuid-1");
  assert.equal(updatedMetadata.syncStatus, "pending_upload");
  assert.equal(updatedMetadata.recordVersion, 5);
  assert.equal(updatedMetadata.lastSyncedAt, "2026-05-18T12:00:00.000Z");
  assert.equal(updatedMetadata.lastSyncError, "");
  assert.equal(updatedMetadata.pendingDelete, false);
});

test("reference delete preserves metadata as a tombstone pending upload", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        imageUrl: "data:image/webp;base64,preview",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "ref.png"
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: []
    }
  });

  await deleteItem("item-1");

  const metadata = await getSyncMetadata("mba:reference:uuid-1");
  assert.equal(metadata.pendingDelete, true);
  assert.equal(metadata.syncStatus, "pending_upload");
  assert.equal(metadata.recordVersion, 1);
  assert.equal(metadata.lastLocalChangeAt.length > 0, true);
});

test("reference legacy id rename preserves one metadata row keyed by itemUuid", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-old",
        itemUuid: "uuid-1",
        imageUrl: "data:image/webp;base64,preview",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "ref.png"
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: []
    }
  });

  await saveItem({
    id: "item-new",
    itemUuid: "uuid-1",
    imageUrl: "data:image/webp;base64,preview",
    imageWidth: 1200,
    imageHeight: 800,
    mimeType: "image/webp",
    fileSize: 1111,
    originalFilename: "ref.png"
  });
  await deleteItem("item-old");

  const metadata = await getSyncMetadata();

  assert.deepEqual(metadata.map((entry) => entry.key), ["mba:reference:uuid-1"]);
  assert.equal(metadata[0].localId, "item-new");
  assert.equal(metadata[0].pendingDelete, false);
  assert.equal(metadata[0].recordVersion, 1);
});

test("saved board create edit and delete mark metadata pending upload", async () => {
  installFakeIndexedDb();

  await saveAppState({
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "",
        board: {
          id: "board-1",
          boardUuid: "board-uuid-1",
          images: [{ referenceId: "item-1" }]
        }
      }
    ]
  });

  const createdMetadata = await getSyncMetadata("mba:board:board-uuid-1");
  assert.equal(createdMetadata.syncStatus, "pending_upload");
  assert.equal(createdMetadata.recordVersion, 1);
  assert.equal(createdMetadata.pendingDelete, false);

  await upsertSyncMetadata({
    ...createdMetadata,
    syncStatus: "synced",
    recordVersion: 3,
    lastSyncedAt: "2026-05-18T12:00:00.000Z"
  });

  await saveAppState({
    savedOutfits: [
      {
        id: "saved-1",
        name: "Renamed board",
        description: "",
        board: {
          id: "board-1",
          boardUuid: "board-uuid-1",
          images: [{ referenceId: "item-1" }]
        }
      }
    ]
  });

  const updatedMetadata = await getSyncMetadata("mba:board:board-uuid-1");
  assert.equal(updatedMetadata.syncStatus, "pending_upload");
  assert.equal(updatedMetadata.recordVersion, 4);
  assert.equal(updatedMetadata.lastSyncedAt, "2026-05-18T12:00:00.000Z");

  await saveAppState({
    savedOutfits: []
  });

  const deletedMetadata = await getSyncMetadata("mba:board:board-uuid-1");
  assert.equal(deletedMetadata.pendingDelete, true);
  assert.equal(deletedMetadata.syncStatus, "pending_upload");
  assert.equal(deletedMetadata.recordVersion, 5);
});

test("saved boards dirty when reference id rewrites change persisted payload", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [],
    appState: {
      savedOutfits: [
        {
          id: "saved-1",
          name: "Saved board",
          description: "",
          board: {
            id: "board-1",
            boardUuid: "board-uuid-1",
            images: [{ referenceId: "item-old", referenceItemUuid: "uuid-1" }]
          },
          outfit: {
            TopInner: "item-old"
          }
        }
      ],
      recentOutfits: []
    }
  });

  await saveAppState({
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "",
        board: {
          id: "board-1",
          boardUuid: "board-uuid-1",
          images: [{ referenceId: "item-new", referenceItemUuid: "uuid-1" }]
        },
        outfit: {
          TopInner: "item-new"
        }
      }
    ]
  });

  const metadata = await getSyncMetadata("mba:board:board-uuid-1");
  assert.equal(metadata.recordVersion, 1);
  assert.equal(metadata.syncStatus, "pending_upload");
  assert.equal(metadata.pendingDelete, false);
});

test("saved boards dirty when reference delete changes persisted payload", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [],
    appState: {
      savedOutfits: [
        {
          id: "saved-1",
          name: "Saved board",
          description: "",
          board: {
            id: "board-1",
            boardUuid: "board-uuid-1",
            images: [{ referenceId: "item-1", referenceItemUuid: "uuid-1" }]
          },
          outfit: {
            TopInner: "item-1"
          }
        }
      ],
      recentOutfits: []
    }
  });

  await saveAppState({
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "",
        board: {
          id: "board-1",
          boardUuid: "board-uuid-1",
          images: []
        },
        outfit: {
          TopInner: null
        }
      }
    ]
  });

  const metadata = await getSyncMetadata("mba:board:board-uuid-1");
  assert.equal(metadata.recordVersion, 1);
  assert.equal(metadata.syncStatus, "pending_upload");
});

test("current working board changes stay unsynced", async () => {
  installFakeIndexedDb();

  await saveAppState({
    board: {
      id: "working-board",
      boardUuid: "working-board-uuid",
      images: [{ referenceId: "item-1" }]
    },
    savedOutfits: []
  });

  assert.deepEqual(await getSyncMetadata(), []);

  await saveAppState({
    board: {
      id: "working-board",
      boardUuid: "working-board-uuid",
      images: [{ referenceId: "item-2" }]
    },
    savedOutfits: []
  });

  assert.deepEqual(await getSyncMetadata(), []);
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

test("prepareBackupImport accepts moodboard-app backups", () => {
  const prepared = prepareBackupImport({
    source: "moodboard-app",
    version: 2,
    exportedAt: "2026-05-18T12:00:00.000Z",
    items: [
      {
        id: "item-1",
        imageUrl: "data:image/webp;base64,preview-only",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "backup.png"
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: [{ id: "drop-me" }]
    }
  });

  assert.equal(prepared.source, "moodboard-app");
  assert.equal(prepared.version, 2);
  assert.equal(prepared.items[0].id, "item-1");
  assert.equal(prepared.appState.board, undefined);
  assert.deepEqual(prepared.appState, {
    savedOutfits: [],
    recentOutfits: []
  });
});

test("prepareBackupImport preserves and backfills boardUuid for persisted boards and saved boards", () => {
  const prepared = prepareBackupImport({
    source: "moodboard-app",
    version: 2,
    exportedAt: "2026-05-18T12:00:00.000Z",
    items: [],
    appState: {
      board: {
        id: "active-board",
        boardUuid: "board-uuid-active",
        images: [{ referenceId: "item-1" }]
      },
      savedOutfits: [
        {
          id: "saved-legacy",
          board: {
            id: "legacy-board",
            images: [{ referenceId: "item-1" }]
          }
        },
        {
          id: "saved-current",
          board: {
            id: "current-board",
            boardUuid: "board-uuid-saved",
            images: [{ referenceId: "item-2" }]
          }
        }
      ],
      recentOutfits: [{ id: "drop-me" }]
    }
  });

  assert.equal(prepared.appState.board.boardUuid, "board-uuid-active");
  assert.ok(prepared.appState.savedOutfits[0].board.boardUuid);
  assert.equal(prepared.appState.savedOutfits[0].board.id, "legacy-board");
  assert.equal(prepared.appState.savedOutfits[1].board.boardUuid, "board-uuid-saved");
  assert.deepEqual(prepared.appState.recentOutfits, []);
});

test("backup import export round-trip preserves unknown list values", () => {
  const backup = createLightweightBackupData(
    [
      {
        id: "item-1",
        list: "Incoming",
        imageUrl: "data:image/webp;base64,preview-only",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "backup.png",
        images: {
          original: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0,
            fileSize: 0,
            originalFilename: ""
          },
          preview: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0,
            fileSize: 0,
            originalFilename: ""
          },
          thumbnail: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0,
            fileSize: 0,
            originalFilename: ""
          }
        }
      }
    ],
    {
      savedOutfits: [],
      recentOutfits: []
    }
  );

  const prepared = prepareBackupImport(backup);

  assert.equal(backup.items[0].list, "Incoming");
  assert.equal(prepared.items[0].list, "Incoming");
});

test("backup import export round-trip preserves OA-shaped portable fields except stripped original binary src", () => {
  const backup = createLightweightBackupData(
    [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        importSource: "oa-backup",
        relinkStatus: "hub-awaiting-rebind",
        styleTags: ["Formal"],
        climateTags: ["Rain"],
        tags: ["archive/source"],
        imageUrl: "data:image/webp;base64,preview",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "backup.png",
        images: {
          original: {
            src: "data:image/png;base64,original",
            mimeType: "image/png",
            width: 3000,
            height: 2000,
            fileSize: 9999,
            originalFilename: "backup.png",
            checksum: "orig-checksum"
          },
          preview: {
            src: "data:image/webp;base64,preview",
            mimeType: "image/webp",
            width: 1200,
            height: 800,
            fileSize: 1111,
            originalFilename: "backup.png",
            cdnPath: "/portable/preview.webp"
          },
          thumbnail: {
            src: "data:image/webp;base64,thumb",
            mimeType: "image/webp",
            width: 480,
            height: 320,
            fileSize: 222,
            originalFilename: "backup.png",
            blurHash: "thumb-hash"
          }
        },
        originalPreserved: true
      }
    ],
    {
      savedOutfits: [],
      recentOutfits: []
    }
  );

  const prepared = prepareBackupImport(backup);
  const reExported = createLightweightBackupData(prepared.items, prepared.appState);

  assert.equal(prepared.items[0].importSource, "oa-backup");
  assert.equal(prepared.items[0].relinkStatus, "hub-awaiting-rebind");
  assert.deepEqual(prepared.items[0].styleTags, ["Formal"]);
  assert.deepEqual(prepared.items[0].climateTags, ["Rain"]);
  assert.deepEqual(prepared.items[0].tags, ["archive/source"]);
  assert.equal(prepared.items[0].images.original.src, "");
  assert.equal(prepared.items[0].images.original.checksum, "orig-checksum");
  assert.equal(prepared.items[0].images.preview.src, "data:image/webp;base64,preview");
  assert.equal(prepared.items[0].images.preview.cdnPath, "/portable/preview.webp");
  assert.equal(prepared.items[0].images.thumbnail.src, "data:image/webp;base64,thumb");
  assert.equal(prepared.items[0].images.thumbnail.blurHash, "thumb-hash");
  assert.equal(prepared.items[0].originalPreserved, false);

  assert.equal(reExported.items[0].importSource, "oa-backup");
  assert.equal(reExported.items[0].relinkStatus, "hub-awaiting-rebind");
  assert.deepEqual(reExported.items[0].styleTags, ["Formal"]);
  assert.deepEqual(reExported.items[0].climateTags, ["Rain"]);
  assert.deepEqual(reExported.items[0].tags, ["archive/source"]);
  assert.equal(reExported.items[0].images.original.src, "");
  assert.equal(reExported.items[0].images.original.checksum, "orig-checksum");
  assert.equal(reExported.items[0].images.preview.src, "data:image/webp;base64,preview");
  assert.equal(reExported.items[0].images.thumbnail.src, "data:image/webp;base64,thumb");
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

test("replaceWithPreparedBackup clears stale sync metadata and rebuilds local-only records", async () => {
  installFakeIndexedDb();

  await getOrCreateDeviceId();
  await upsertSyncMetadata({
    key: "mba:reference:stale-uuid",
    entityType: "mbaReference",
    stableKey: "stale-uuid",
    localId: "stale-item",
    recordVersion: 4,
    syncStatus: "error",
    lastSyncedAt: "2026-05-18T12:00:00.000Z",
    lastModifiedByDevice: "device-stale",
    pendingDelete: false,
    lastSyncError: "stale",
    lastLocalChangeAt: "2026-05-18T12:00:00.000Z"
  });

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        imageUrl: "data:image/webp;base64,preview",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "ref.png"
      }
    ],
    appState: {
      savedOutfits: [
        {
          id: "saved-1",
          board: {
            id: "board-1",
            boardUuid: "board-uuid-1",
            images: [{ referenceId: "item-1" }]
          }
        }
      ],
      recentOutfits: []
    }
  });

  const metadata = await getSyncMetadata();

  assert.deepEqual(
    metadata.map((entry) => entry.key).sort(),
    ["mba:board:board-uuid-1", "mba:reference:uuid-1"]
  );
  assert.equal(await getSyncMetadata("mba:reference:stale-uuid"), null);
  assert.equal(metadata.every((entry) => entry.syncStatus === "local_only"), true);
});

test("resetToDefaults clears stale sync metadata and rebuilds metadata for default references", async () => {
  installFakeIndexedDb();

  await upsertSyncMetadata({
    key: "mba:reference:stale-uuid",
    entityType: "mbaReference",
    stableKey: "stale-uuid",
    localId: "stale-item",
    recordVersion: 1,
    syncStatus: "error",
    lastSyncedAt: "",
    lastModifiedByDevice: "device-stale",
    pendingDelete: false,
    lastSyncError: "stale",
    lastLocalChangeAt: ""
  });

  const defaultData = await resetToDefaults();
  const metadata = await getSyncMetadata();

  assert.equal(await getSyncMetadata("mba:reference:stale-uuid"), null);
  assert.equal(metadata.length, defaultData.items.length);
  assert.equal(metadata.every((entry) => entry.entityType === "mbaReference"), true);
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

test("loadItems migrates legacy outfit-app-db data into moodboard-app-db when the new database is empty", async () => {
  const indexedDb = installFakeIndexedDb();
  const legacyItem = {
    id: "legacy-item",
    itemUuid: "legacy-uuid",
    imageUrl: "data:image/webp;base64,preview-only",
    imageWidth: 1200,
    imageHeight: 800,
    mimeType: "image/webp",
    fileSize: 1111,
    originalFilename: "legacy.png",
    tags: ["archive"]
  };
  const legacyAppState = {
    savedOutfits: [{ id: "saved-1" }],
    recentOutfits: [{ id: "recent-1" }]
  };
  const legacyBlob = new Blob(["legacy-original"], { type: "image/jpeg" });

  seedStore(indexedDb, "outfit-app-db", "items", "id", [legacyItem]);
  seedStore(indexedDb, "outfit-app-db", "appState", "key", [{ key: "state", value: legacyAppState }]);
  seedStore(indexedDb, "outfit-app-db", "originalImageBlobs", "itemUuid", [
    {
      itemUuid: "legacy-uuid",
      blob: legacyBlob,
      mimeType: "image/jpeg",
      width: 2400,
      height: 1800,
      fileSize: 1024,
      originalFilename: "legacy.jpg",
      savedAt: 1
    }
  ]);

  const migratedItems = await loadItems();
  const migratedAppState = await loadAppState();
  const migratedBlobEntry = await loadOriginalImageBlobEntry("legacy-uuid");
  const newDatabase = indexedDb.getDatabase("moodboard-app-db");
  const legacyDatabase = indexedDb.getDatabase("outfit-app-db");

  assert.equal(migratedItems.length, 1);
  assert.equal(migratedItems[0].id, "legacy-item");
  assert.deepEqual(migratedAppState, legacyAppState);
  assert.equal(await migratedBlobEntry.blob.text(), "legacy-original");
  assert.equal(newDatabase.stores.get("items").records.size, 1);
  assert.equal(newDatabase.stores.get("appState").records.size, 1);
  assert.equal(newDatabase.stores.get("originalImageBlobs").records.size, 1);
  assert.equal(legacyDatabase.stores.get("items").records.size, 1);
});

test("clearSyncMetadata clears metadata records without affecting the device id", async () => {
  installFakeIndexedDb();

  const deviceId = await getOrCreateDeviceId();
  await backfillLocalSyncMetadata([
    {
      id: "item-1",
      itemUuid: "uuid-1",
      imageUrl: "data:image/webp;base64,preview",
      imageWidth: 1200,
      imageHeight: 800,
      mimeType: "image/webp",
      fileSize: 1111,
      originalFilename: "ref.png"
    }
  ], []);

  await clearSyncMetadata();

  assert.deepEqual(await getSyncMetadata(), []);
  assert.equal(await getOrCreateDeviceId(), deviceId);
});

test("loadItems does not overwrite moodboard-app-db when the new database already has data", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "outfit-app-db", "items", "id", [
    {
      id: "legacy-item",
      itemUuid: "legacy-uuid",
      imageUrl: "data:image/webp;base64,legacy-preview",
      imageWidth: 1200,
      imageHeight: 800,
      mimeType: "image/webp",
      fileSize: 1111,
      originalFilename: "legacy.png"
    }
  ]);
  seedStore(indexedDb, "moodboard-app-db", "items", "id", [
    {
      id: "current-item",
      itemUuid: "current-uuid",
      imageUrl: "data:image/webp;base64,current-preview",
      imageWidth: 1200,
      imageHeight: 800,
      mimeType: "image/webp",
      fileSize: 1111,
      originalFilename: "current.png"
    }
  ]);
  seedStore(indexedDb, "moodboard-app-db", "appState", "key", []);
  seedStore(indexedDb, "moodboard-app-db", "originalImageBlobs", "itemUuid", []);

  const items = await loadItems();
  const newDatabase = indexedDb.getDatabase("moodboard-app-db");

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "current-item");
  assert.equal(newDatabase.stores.get("items").records.size, 1);
  assert.equal(newDatabase.stores.get("items").records.has("legacy-item"), false);
});
