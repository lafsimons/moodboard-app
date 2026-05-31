import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  __setIndexedDbFactoryForTests,
  backfillLocalSyncMetadata,
  clearSyncMetadata,
  createMetadataOnlyBackupData,
  createMetadataSnapshot,
  createLightweightBackupData,
  deleteOriginalImageBlob,
  deleteItems,
  exportBackup,
  getOrCreateDeviceId,
  loadLatestMetadataSnapshotInfo,
  loadMetadataSnapshots,
  getSyncMetadata,
  hasOriginalImageBlob,
  loadAppState,
  loadItemMediaAssetById,
  loadItems,
  markFullBackupExported,
  markMetadataChanged,
  loadOriginalImageBlob,
  loadOriginalImageBlobEntry,
  loadStartupAppState,
  loadStartupItemMetadata,
  prepareBackupImport,
  pruneMetadataSnapshots,
  requestMetadataSnapshot,
  replaceWithBackup,
  replaceWithPreparedBackupPackage,
  replaceWithPreparedBackup,
  resetToDefaults,
  saveAppState,
  saveItem,
  saveOriginalImageBlob,
  deleteItem,
  upsertSyncMetadata
} from "./storage.js";
import { INDEXED_DB_NAME } from "./appIdentity.js";
import {
  pruneBoardForDeletedReferences,
  pruneOutfitForDeletedReferences,
  pruneSavedOutfitsForDeletedReferences
} from "./deleteStatePruning.js";
import {
  formatImportSourceFormatLabel,
  markBackupExported,
  markMetadataExported
} from "./appStateModel.js";
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
      records: new Map(),
      putCount: 0,
      deleteCount: 0,
      clearCount: 0
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

function seedDatabase(indexedDb, databaseName, version = 2) {
  const database = indexedDb.getDatabase(databaseName) ?? new FakeDatabase(version);

  if (!indexedDb.getDatabase(databaseName)) {
    indexedDb.databases.set(databaseName, database);
  } else {
    database.version = version;
  }

  return database;
}

function getStoreStats(indexedDb, storeName) {
  return indexedDb.getDatabase(INDEXED_DB_NAME)?.stores.get(storeName) ?? null;
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
  assert.equal("imageUrl" in backup.items[0], false);
  assert.equal("imageWidth" in backup.items[0], false);
  assert.equal("imageHeight" in backup.items[0], false);
  assert.equal("mimeType" in backup.items[0], false);
  assert.equal("fileSize" in backup.items[0], false);
  assert.equal("originalFilename" in backup.items[0], false);
  assert.equal(backup.items[0].originalPreserved, false);
  assert.equal(backup.items[0].images.original.src, "");
  assert.equal(backup.items[0].images.original.checksum, "orig-checksum");
  assert.equal(backup.items[0].images.preview.src, "data:image/webp;base64,preview");
  assert.equal(backup.items[0].images.preview.cdnPath, "/portable/preview.webp");
  assert.equal(backup.items[0].images.thumbnail.src, "");
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

test("createMetadataOnlyBackupData strips embedded media while preserving metadata and sanitized boards", () => {
  const backup = createMetadataOnlyBackupData([
    {
      id: "item-1",
      itemUuid: "uuid-1",
      sourceFilenameAliases: ["legacy-alt.jpg"],
      imageUrl: "data:image/webp;base64,preview",
      imageWidth: 1400,
      imageHeight: 933,
      mimeType: "image/webp",
      fileSize: 1500,
      originalFilename: "look.jpg",
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
      tags: ["archive/look"]
    }
  ], {
    board: {
      id: "board-1",
      boardUuid: "board-uuid-1",
      images: [
        {
          id: "board-image-1",
          referenceId: "item-1",
          imageUrl: "data:image/png;base64,large"
        }
      ]
    },
    savedOutfits: [
      {
        id: "saved-1",
        board: {
          id: "saved-board-1",
          boardUuid: "saved-board-uuid-1",
          images: [
            {
              id: "saved-board-image-1",
              referenceId: "item-1",
              embeddedItem: {
                imageUrl: "data:image/png;base64,large"
              }
            }
          ]
        }
      }
    ],
    recentOutfits: [{ id: "drop-me" }]
  });

  assert.equal(backup.items[0].imageUrl, "");
  assert.equal(backup.items[0].images.original.src, "");
  assert.equal(backup.items[0].images.preview.src, "");
  assert.equal(backup.items[0].images.thumbnail.src, "");
  assert.deepEqual(backup.items[0].tags, ["archive/look"]);
  assert.equal("imageUrl" in backup.appState.board.images[0], false);
  assert.equal("embeddedItem" in backup.appState.savedOutfits[0].board.images[0], false);
  assert.equal("recentOutfits" in backup.appState, false);
  assert.equal("localSafety" in backup.appState, false);
});

test("createMetadataSnapshot stores a complete metadata-only state using the metadata backup serialization path", async () => {
  installFakeIndexedDb();

  const appState = {
    savedOutfits: [],
    board: {
      id: "board-1",
      boardUuid: "board-uuid-1",
      images: [
        {
          id: "board-image-1",
          referenceId: "item-1"
        }
      ]
    },
    localSafety: {
      metadataDirtySinceSnapshot: true,
      metadataDirtySinceFullBackup: true,
      changedItemIdsSinceSnapshot: ["item-1"],
      changedItemIdsSinceFullBackup: ["item-1"]
    }
  };
  const items = [
    {
      id: "item-1",
      itemUuid: "uuid-1",
      sourceFilenameAliases: ["legacy-alt.jpg"],
      imageUrl: "data:image/webp;base64,preview",
      imageWidth: 1400,
      imageHeight: 933,
      mimeType: "image/webp",
      fileSize: 1500,
      originalFilename: "look.jpg",
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
      tags: ["archive/look"]
    }
  ];

  const metadataBackup = createMetadataOnlyBackupData(items, appState);
  const result = await createMetadataSnapshot({
    reason: "before-import",
    items,
    appState,
    appVersion: "test-build",
    changedItemIds: ["item-1"]
  });

  assert.deepEqual(result.snapshot.items, metadataBackup.items);
  assert.deepEqual(result.snapshot.appState, metadataBackup.appState);
  assert.equal(result.snapshot.reason, "before-import");
  assert.equal(result.snapshot.itemCount, 1);
  assert.equal(result.snapshot.boardCount, 1);
  assert.equal(result.snapshot.changedItemCount, 1);
  assert.equal(result.snapshot.items[0].images.preview.src, "");
  assert.equal(result.snapshot.items[0].images.original.src, "");
  assert.deepEqual(result.snapshot.items[0].sourceFilenameAliases, ["legacy-alt.jpg"]);
  assert.equal(result.localSafety.metadataDirtySinceSnapshot, false);
  assert.deepEqual(result.localSafety.changedItemIdsSinceSnapshot, []);
});

test("metadata snapshot retention pruning keeps the most recent snapshots deterministically", async () => {
  installFakeIndexedDb();

  for (let index = 0; index < 45; index += 1) {
    await createMetadataSnapshot({
      reason: "autosnapshot",
      createdAt: `2026-05-31T10:${String(index).padStart(2, "0")}:00.000Z`,
      items: [],
      appState: {
        savedOutfits: [],
        localSafety: {
          metadataDirtySinceSnapshot: true
        }
      }
    });
  }

  const snapshots = await loadMetadataSnapshots();
  assert.equal(snapshots.length, 40);
  assert.equal(snapshots[0].createdAt, "2026-05-31T10:44:00.000Z");
  assert.equal(snapshots.at(-1)?.createdAt, "2026-05-31T10:05:00.000Z");

  const pruneResult = await pruneMetadataSnapshots({ retainCount: 10 });
  assert.equal(pruneResult.deletedCount, 30);
  assert.equal((await loadMetadataSnapshots()).length, 10);
});

test("metadata dirty tracking updates and full backup reset is separated from snapshot reset", () => {
  const changedLocalSafety = markMetadataChanged(undefined, {
    changedItemIds: ["item-1", "item-2"]
  });

  assert.equal(changedLocalSafety.metadataDirtySinceSnapshot, true);
  assert.equal(changedLocalSafety.metadataDirtySinceFullBackup, true);
  assert.deepEqual(changedLocalSafety.changedItemIdsSinceSnapshot, ["item-1", "item-2"]);
  assert.deepEqual(changedLocalSafety.changedItemIdsSinceFullBackup, ["item-1", "item-2"]);

  const resetForFullBackup = markFullBackupExported(changedLocalSafety);
  assert.equal(resetForFullBackup.metadataDirtySinceSnapshot, true);
  assert.equal(resetForFullBackup.metadataDirtySinceFullBackup, false);
  assert.deepEqual(resetForFullBackup.changedItemIdsSinceSnapshot, ["item-1", "item-2"]);
  assert.deepEqual(resetForFullBackup.changedItemIdsSinceFullBackup, []);
});

test("metadata-only export updates metadata export provenance without clearing the full-backup dirty baseline", () => {
  const changedLocalSafety = markMetadataChanged(undefined, {
    changedItemIds: ["item-1"]
  });
  const nextProvenance = markMetadataExported(undefined, {
    exportedAt: "2026-05-31T12:00:00.000Z",
    itemCountSnapshot: 1
  });

  assert.equal(nextProvenance.lastMetadataExportAt, "2026-05-31T12:00:00.000Z");
  assert.equal(nextProvenance.lastBackupExportAt, "");
  assert.equal(changedLocalSafety.metadataDirtySinceFullBackup, true);
  assert.deepEqual(changedLocalSafety.changedItemIdsSinceFullBackup, ["item-1"]);
});

test("full JSON backup export clears the full-backup dirty baseline and updates last backup export provenance", () => {
  const changedLocalSafety = markMetadataChanged(undefined, {
    changedItemIds: ["item-1", "item-2"]
  });
  const nextProvenance = markBackupExported(undefined, {
    exportedAt: "2026-05-31T13:00:00.000Z",
    itemCountSnapshot: 2
  });
  const nextLocalSafety = markFullBackupExported(changedLocalSafety);

  assert.equal(nextProvenance.lastBackupExportAt, "2026-05-31T13:00:00.000Z");
  assert.equal(nextProvenance.lastMetadataExportAt, "");
  assert.equal(nextLocalSafety.metadataDirtySinceFullBackup, false);
  assert.deepEqual(nextLocalSafety.changedItemIdsSinceFullBackup, []);
});

test("scalable package export uses the same full-backup provenance and dirty-baseline reset semantics", () => {
  const changedLocalSafety = markMetadataChanged(undefined, {
    changedItemIds: ["item-9"]
  });
  const nextProvenance = markBackupExported(undefined, {
    exportedAt: "2026-05-31T14:00:00.000Z",
    itemCountSnapshot: 1
  });
  const nextLocalSafety = markFullBackupExported(changedLocalSafety);

  assert.equal(nextProvenance.lastBackupExportAt, "2026-05-31T14:00:00.000Z");
  assert.equal(nextLocalSafety.metadataDirtySinceFullBackup, false);
  assert.deepEqual(nextLocalSafety.changedItemIdsSinceFullBackup, []);
});

test("requestMetadataSnapshot serializes overlapping autosnapshot requests into at most one follow-up write", async () => {
  installFakeIndexedDb();

  const appState = {
    savedOutfits: [],
    localSafety: {
      metadataDirtySinceSnapshot: true,
      changedItemIdsSinceSnapshot: ["item-1"]
    }
  };

  await Promise.all([
    requestMetadataSnapshot({
      reason: "autosnapshot",
      items: [{ id: "item-1", itemUuid: "uuid-1" }],
      appState,
      changedItemIds: ["item-1"]
    }),
    requestMetadataSnapshot({
      reason: "autosnapshot",
      items: [{ id: "item-2", itemUuid: "uuid-2" }],
      appState,
      changedItemIds: ["item-2"]
    }),
    requestMetadataSnapshot({
      reason: "autosnapshot",
      items: [{ id: "item-3", itemUuid: "uuid-3" }],
      appState,
      changedItemIds: ["item-3"]
    })
  ]);

  const snapshots = await loadMetadataSnapshots();
  assert.equal(snapshots.length <= 2, true);
  assert.deepEqual(
    [...new Set(snapshots.flatMap((snapshot) => snapshot.changedItemIds))].sort(),
    ["item-1", "item-2", "item-3"]
  );
});

test("loadLatestMetadataSnapshotInfo returns the latest snapshot summary", async () => {
  installFakeIndexedDb();

  await createMetadataSnapshot({
    reason: "before-delete",
    createdAt: "2026-05-31T10:00:00.000Z",
    items: [{ id: "item-1", itemUuid: "uuid-1" }],
    appState: { savedOutfits: [] },
    changedItemIds: ["item-1"]
  });
  await createMetadataSnapshot({
    reason: "before-import",
    createdAt: "2026-05-31T11:00:00.000Z",
    items: [{ id: "item-2", itemUuid: "uuid-2" }],
    appState: { savedOutfits: [] },
    changedItemIds: ["item-2"]
  });

  assert.deepEqual(await loadLatestMetadataSnapshotInfo(), {
    id: (await loadMetadataSnapshots({ limit: 1 }))[0].id,
    createdAt: "2026-05-31T11:00:00.000Z",
    reason: "before-import",
    appVersion: "",
    appBuildTime: "",
    itemCount: 1,
    boardCount: 0,
    changedItemCount: 1
  });
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
  assert.equal(database.version, 6);
  assert.equal(database.stores.has("itemMediaAssets"), true);
  assert.equal(database.stores.has("syncState"), true);
  assert.equal(database.stores.has("syncMetadata"), true);
  assert.equal(database.stores.has("metadataSnapshots"), true);
});

test("startup loaders upgrade an older database and create metadataSnapshots without losing stored library data", async () => {
  const indexedDb = installFakeIndexedDb();
  const database = seedDatabase(indexedDb, INDEXED_DB_NAME, 4);

  database.createObjectStore("items", { keyPath: "id" });
  database.createObjectStore("appState", { keyPath: "key" });
  database.createObjectStore("originalImageBlobs", { keyPath: "itemUuid" });
  database.stores.get("items").records.set("item-1", {
    id: "item-1",
    itemUuid: "uuid-1",
    title: "Imported item"
  });
  database.stores.get("appState").records.set("state", {
    key: "state",
    value: {
      savedOutfits: [],
      provenance: {
        source: "backup-import",
        importedAt: "2026-05-31T10:00:00.000Z"
      }
    }
  });

  const [appState, items, snapshotInfo] = await Promise.all([
    loadStartupAppState(),
    loadStartupItemMetadata(),
    loadLatestMetadataSnapshotInfo()
  ]);

  assert.equal(indexedDb.getDatabase(INDEXED_DB_NAME).version, 6);
  assert.equal(indexedDb.getDatabase(INDEXED_DB_NAME).stores.has("metadataSnapshots"), true);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Imported item");
  assert.equal(appState?.provenance?.source, "backup-import");
  assert.equal(snapshotInfo, null);
});

test("missing metadataSnapshots store returns empty snapshot info without breaking persisted startup library loads", async () => {
  const indexedDb = installFakeIndexedDb();
  const database = seedDatabase(indexedDb, INDEXED_DB_NAME, 6);

  database.createObjectStore("items", { keyPath: "id" });
  database.createObjectStore("appState", { keyPath: "key" });
  database.createObjectStore("originalImageBlobs", { keyPath: "itemUuid" });
  database.stores.get("items").records.set("item-1", {
    id: "item-1",
    itemUuid: "uuid-1",
    title: "Persisted item"
  });
  database.stores.get("appState").records.set("state", {
    key: "state",
    value: {
      savedOutfits: [],
      localSafety: {
        metadataDirtySinceSnapshot: true,
        changedItemIdsSinceSnapshot: ["item-1"]
      }
    }
  });

  const snapshotInfo = await loadLatestMetadataSnapshotInfo();
  const [items, appState] = await Promise.all([loadStartupItemMetadata(), loadStartupAppState()]);

  assert.equal(snapshotInfo, null);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Persisted item");
  assert.equal(appState?.localSafety?.metadataDirtySinceSnapshot, true);
  assert.deepEqual(appState?.localSafety?.changedItemIdsSinceSnapshot, ["item-1"]);
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

test("bulk delete removes multiple distinct items and writes tombstones once per itemUuid", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        imageUrl: "data:image/webp;base64,preview-1"
      },
      {
        id: "item-2",
        itemUuid: "uuid-2",
        imageUrl: "data:image/webp;base64,preview-2"
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: []
    }
  });

  await deleteItems(["item-1", "item-2"]);

  const persistedItems = await loadItems();
  const metadata = await getSyncMetadata();

  assert.equal(persistedItems.some((item) => item.id === "item-1"), false);
  assert.equal(persistedItems.some((item) => item.id === "item-2"), false);
  assert.deepEqual(
    metadata.map((entry) => entry.key).sort(),
    ["mba:reference:uuid-1", "mba:reference:uuid-2"]
  );
  assert.equal(metadata.every((entry) => entry.pendingDelete), true);
});

test("bulk delete writes one tombstone when deleting multiple items sharing an itemUuid", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-shared",
        imageUrl: "data:image/webp;base64,preview-1"
      },
      {
        id: "item-2",
        itemUuid: "uuid-shared",
        imageUrl: "data:image/webp;base64,preview-2"
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: []
    }
  });

  await deleteItems(["item-1", "item-2"]);

  const metadata = await getSyncMetadata();

  assert.deepEqual(metadata.map((entry) => entry.key), ["mba:reference:uuid-shared"]);
  assert.equal(metadata[0].pendingDelete, true);
  assert.equal(metadata[0].recordVersion, 1);
});

test("bulk delete preserves shared media when another itemUuid owner remains", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveItem({
    id: "item-1",
    itemUuid: "uuid-shared",
    imageUrl: "data:image/webp;base64,preview-1",
    images: {
      preview: { src: "data:image/webp;base64,preview-1" },
      thumbnail: { src: "data:image/webp;base64,thumb-1" },
      original: { src: "data:image/jpeg;base64,original-1" }
    },
    originalPreserved: true
  });
  await saveItem({
    id: "item-2",
    itemUuid: "uuid-shared",
    imageUrl: "data:image/webp;base64,preview-2"
  });

  await saveOriginalImageBlob("uuid-shared", new Blob(["original-shared"], { type: "image/jpeg" }), {
    mimeType: "image/jpeg",
    width: 1200,
    height: 1600,
    originalFilename: "shared.jpg"
  });

  await deleteItems(["item-1"]);

  const database = indexedDb.getDatabase("moodboard-app-db");

  assert.equal(database.stores.get("itemMediaAssets").records.has("item-1:preview"), true);
  assert.equal(database.stores.get("itemMediaAssets").records.has("item-1:thumbnail"), true);
  assert.equal(await hasOriginalImageBlob("uuid-shared"), true);
  assert.equal((await getSyncMetadata("mba:reference:uuid-shared"))?.pendingDelete, false);
});

test("bulk delete removes preview thumbnail and original media when last itemUuid owner is deleted", async () => {
  const indexedDb = installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        imageUrl: "data:image/webp;base64,preview-1"
      },
      {
        id: "item-2",
        itemUuid: "uuid-2",
        imageUrl: "data:image/webp;base64,preview-2"
      }
    ],
    appState: {
      savedOutfits: [],
      recentOutfits: []
    }
  });

  await saveOriginalImageBlob("uuid-1", new Blob(["original-1"], { type: "image/jpeg" }), {
    mimeType: "image/jpeg",
    width: 900,
    height: 1200,
    originalFilename: "one.jpg"
  });

  await deleteItems(["item-1"]);

  const database = indexedDb.getDatabase("moodboard-app-db");

  assert.equal(database.stores.get("itemMediaAssets").records.has("item-1:preview"), false);
  assert.equal(database.stores.get("itemMediaAssets").records.has("item-1:thumbnail"), false);
  assert.equal(await hasOriginalImageBlob("uuid-1"), false);
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

test("saved boards persist across app state save and load", async () => {
  installFakeIndexedDb();

  const savedBoardState = {
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "Persistent board",
        board: {
          id: "board-1",
          boardUuid: "board-uuid-1",
          width: 1600,
          height: 1200,
          images: [
            {
              id: "board-image-1",
              referenceId: "item-1",
              referenceItemUuid: "uuid-1",
              x: 10,
              y: 20,
              width: 220,
              height: 260,
              rotation: 0,
              zIndex: 1,
              generationSlot: "TopInner"
            }
          ]
        }
      }
    ],
    recentOutfits: []
  };

  await saveAppState(savedBoardState);

  const restoredAppState = await loadAppState();

  assert.deepEqual(restoredAppState.savedOutfits, savedBoardState.savedOutfits);
  assert.deepEqual(restoredAppState.recentOutfits, []);
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

test("duplicate saveAppState with equivalent sanitized payload skips rewrite", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveAppState({
    board: {
      id: "board-1",
      boardUuid: "board-uuid-1",
      images: [
        {
          id: "board-image-1",
          referenceId: "item-1",
          referenceItemUuid: "uuid-1",
          imageUrl: "data:image/webp;base64,preview"
        }
      ]
    },
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "",
        board: {
          id: "saved-board-1",
          boardUuid: "saved-board-uuid-1",
          images: [
            {
              id: "saved-image-1",
              referenceId: "item-1",
              referenceItemUuid: "uuid-1",
              embeddedItem: {
                imageUrl: "data:image/png;base64,large"
              }
            }
          ]
        }
      }
    ]
  });

  const appStore = getStoreStats(indexedDb, "appState");
  assert.equal(appStore.putCount, 1);

  await saveAppState({
    board: {
      id: "board-1",
      boardUuid: "board-uuid-1",
      images: [
        {
          id: "board-image-1",
          referenceId: "item-1",
          referenceItemUuid: "uuid-1"
        }
      ]
    },
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "",
        board: {
          id: "saved-board-1",
          boardUuid: "saved-board-uuid-1",
          images: [
            {
              id: "saved-image-1",
              referenceId: "item-1",
              referenceItemUuid: "uuid-1"
            }
          ]
        }
      }
    ]
  });

  assert.equal(appStore.putCount, 1);
});

test("deleting unused reference does not cause effective app state rewrite", async () => {
  const indexedDb = installFakeIndexedDb();
  const persistedState = {
    outfit: {
      TopInner: "item-1"
    },
    board: {
      id: "board-1",
      boardUuid: "board-uuid-1",
      images: [{ id: "board-image-1", referenceId: "item-1", referenceItemUuid: "uuid-1" }]
    },
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "",
        outfit: {
          TopInner: "item-1"
        },
        board: {
          id: "saved-board-1",
          boardUuid: "saved-board-uuid-1",
          images: [{ id: "saved-image-1", referenceId: "item-1", referenceItemUuid: "uuid-1" }]
        }
      }
    ]
  };

  await saveAppState(persistedState);

  const deletedReferenceIdSet = new Set(["item-2"]);
  const nextOutfit = pruneOutfitForDeletedReferences(persistedState.outfit, deletedReferenceIdSet);
  const nextBoard = pruneBoardForDeletedReferences(persistedState.board, deletedReferenceIdSet);
  const nextSavedOutfits = pruneSavedOutfitsForDeletedReferences(persistedState.savedOutfits, deletedReferenceIdSet);

  assert.equal(nextOutfit, persistedState.outfit);
  assert.equal(nextBoard, persistedState.board);
  assert.equal(nextSavedOutfits, persistedState.savedOutfits);

  await saveAppState({
    ...persistedState,
    outfit: nextOutfit,
    board: nextBoard,
    savedOutfits: nextSavedOutfits
  });

  assert.equal(getStoreStats(indexedDb, "appState").putCount, 1);
});

test("deleting reference used by current board and saved board still persists exactly once", async () => {
  const indexedDb = installFakeIndexedDb();
  const persistedState = {
    outfit: {
      TopInner: "item-1"
    },
    board: {
      id: "board-1",
      boardUuid: "board-uuid-1",
      images: [{ id: "board-image-1", referenceId: "item-1", referenceItemUuid: "uuid-1" }]
    },
    savedOutfits: [
      {
        id: "saved-1",
        name: "Saved board",
        description: "",
        outfit: {
          TopInner: "item-1"
        },
        board: {
          id: "saved-board-1",
          boardUuid: "saved-board-uuid-1",
          images: [{ id: "saved-image-1", referenceId: "item-1", referenceItemUuid: "uuid-1" }]
        }
      }
    ]
  };

  await saveAppState(persistedState);

  const deletedReferenceIdSet = new Set(["item-1"]);
  const nextState = {
    ...persistedState,
    outfit: pruneOutfitForDeletedReferences(persistedState.outfit, deletedReferenceIdSet),
    board: pruneBoardForDeletedReferences(persistedState.board, deletedReferenceIdSet),
    savedOutfits: pruneSavedOutfitsForDeletedReferences(persistedState.savedOutfits, deletedReferenceIdSet)
  };

  await saveAppState(nextState);
  await saveAppState(nextState);

  assert.equal(getStoreStats(indexedDb, "appState").putCount, 2);

  const metadata = await getSyncMetadata("mba:board:saved-board-uuid-1");
  assert.equal(metadata.recordVersion, 2);
  assert.equal(metadata.syncStatus, "pending_upload");
});

test("rapid distinct app state changes still persist", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveAppState({
    librarySearch: "alpha",
    savedOutfits: []
  });
  await saveAppState({
    librarySearch: "beta",
    savedOutfits: []
  });
  await saveAppState({
    librarySearch: "gamma",
    savedOutfits: []
  });

  assert.equal(getStoreStats(indexedDb, "appState").putCount, 3);
  assert.equal((await loadAppState()).librarySearch, "gamma");
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

test("saveAppState sanitizes embedded board payloads before persisting", async () => {
  installFakeIndexedDb();

  await saveAppState({
    board: {
      id: "board-1",
      boardUuid: "board-uuid-1",
      width: 1600,
      height: 1200,
      images: [
        {
          id: "board-image-1",
          referenceId: "item-1",
          referenceItemUuid: "uuid-1",
          x: 10,
          y: 20,
          width: 220,
          height: 260,
          rotation: 12.34,
          zIndex: 0,
          embeddedItem: {
            id: "item-1",
            imageUrl: "data:image/png;base64,large"
          }
        }
      ]
    },
    savedOutfits: [
      {
        id: "saved-1",
        board: {
          id: "saved-board-1",
          boardUuid: "saved-board-uuid-1",
          images: [
            {
              referenceId: "item-1",
              imageUrl: "data:image/png;base64,large"
            }
          ]
        }
      }
    ]
  });

  const persistedAppState = await loadAppState();

  assert.deepEqual(persistedAppState.board.images[0], {
    id: "board-image-1",
    referenceId: "item-1",
    referenceItemUuid: "uuid-1",
    x: 10,
    y: 20,
    width: 220,
    height: 260,
    rotation: 12.3,
    zIndex: 1,
    generationSlot: ""
  });
  assert.equal("embeddedItem" in persistedAppState.board.images[0], false);
  assert.equal("imageUrl" in persistedAppState.savedOutfits[0].board.images[0], false);
});

test("saveAppState skips oversized persisted payloads", async () => {
  installFakeIndexedDb();

  await saveAppState({
    savedOutfits: []
  });

  const saved = await saveAppState({
    notes: "x".repeat(1_200_000),
    savedOutfits: []
  });

  assert.equal(saved, false);
  assert.deepEqual(await loadAppState(), {
    savedOutfits: [],
    itemDefaultsMigrationVersion: 0,
    imagePresentationMigrationVersion: 0,
    provenance: {
      lastLibraryEditAt: "",
      lastBackupExportAt: "",
      lastMetadataExportAt: "",
      lastBackupImportAt: "",
      lastImportedBackupName: "",
      lastImportedBackupSource: "",
      lastImportedBackupSchemaVersion: "",
      itemCountSnapshot: 0,
      appVersion: ""
    },
    localSafety: {
      lastMetadataSnapshotAt: "",
      lastMetadataSnapshotReason: "",
      lastMetadataSnapshotError: "",
      metadataDirtySinceSnapshot: false,
      metadataDirtySinceFullBackup: false,
      changedItemIdsSinceSnapshot: [],
      changedItemIdsSinceFullBackup: []
    },
    outfit: {},
    board: null
  });
});

test("loadStartupAppState bypasses migration gating and returns persisted state", async () => {
  installFakeIndexedDb();

  await saveAppState({
    savedOutfits: [],
    librarySearch: "coat"
  });

  const appState = await loadStartupAppState();

  assert.equal(appState.librarySearch, "coat");
});

test("localSafety persists through local app-state save and startup load", async () => {
  installFakeIndexedDb();

  const nextLocalSafety = markMetadataChanged(undefined, {
    changedItemIds: ["item-1"]
  });

  await saveAppState({
    savedOutfits: [],
    localSafety: nextLocalSafety
  });

  const loadedAppState = await loadAppState();
  const startupAppState = await loadStartupAppState();

  assert.equal(loadedAppState.localSafety.metadataDirtySinceSnapshot, true);
  assert.equal(loadedAppState.localSafety.metadataDirtySinceFullBackup, true);
  assert.deepEqual(loadedAppState.localSafety.changedItemIdsSinceSnapshot, ["item-1"]);
  assert.deepEqual(loadedAppState.localSafety.changedItemIdsSinceFullBackup, ["item-1"]);
  assert.deepEqual(startupAppState.localSafety, loadedAppState.localSafety);
});

test("portable backup export excludes localSafety while local persistence keeps it", () => {
  const backup = createLightweightBackupData([], {
    savedOutfits: [],
    localSafety: {
      metadataDirtySinceSnapshot: true,
      metadataDirtySinceFullBackup: true,
      changedItemIdsSinceSnapshot: ["item-1"],
      changedItemIdsSinceFullBackup: ["item-1"]
    }
  });

  assert.equal("localSafety" in backup.appState, false);
});

test("saveAppState and startup load preserve saved library views through local app-state persistence", async () => {
  installFakeIndexedDb();

  await saveAppState({
    savedOutfits: [],
    savedLibraryViews: [
      {
        id: "view-1",
        name: "Archive",
        searchQuery: "coat",
        filters: {
          tags: ["wool"],
          excludedTags: ["damaged"],
          tagMatchMode: "grouped",
          favorite: "yes",
          laundry: "hide"
        },
        sort: "favorites"
      }
    ],
    unknownFutureField: {
      enabled: true
    }
  });

  const appState = await loadStartupAppState();
  assert.deepEqual(appState.savedLibraryViews, [
    {
      id: "view-1",
      name: "Archive",
      searchQuery: "coat",
      filters: {
        tags: ["wool"],
        excludedTags: ["damaged"],
        tagMatchMode: "grouped",
        favorite: "yes",
        laundry: "hide"
      },
      sort: "favorites"
    }
  ]);
  assert.deepEqual(appState.unknownFutureField, {
    enabled: true
  });
});

test("loadStartupItemMetadata strips inline image payloads but preserves metadata", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-startup",
    itemUuid: "uuid-startup",
    imageUrl: "data:image/png;base64,preview",
    imageWidth: 1024,
    imageHeight: 768,
    originalFilename: "startup.png",
    images: {
      preview: {
        src: "data:image/png;base64,preview",
        width: 1024,
        height: 768
      }
    }
  });

  const [item] = await loadStartupItemMetadata();

  assert.equal(item.id, "item-startup");
  assert.equal(item.imageUrl, "");
  assert.equal(item.images.preview.src, "");
  assert.equal(item.imageWidth, 1024);
  assert.equal(item.imageHeight, 768);
  assert.equal(item.originalFilename, "startup.png");
});

test("loadItemMediaAssetById returns persisted media for metadata-only startup items", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-media",
    itemUuid: "uuid-media",
    images: {
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 400,
        height: 300
      }
    }
  });

  const asset = await loadItemMediaAssetById("item-media");

  assert.equal(asset.src, "data:image/webp;base64,preview");
  assert.equal(asset.mimeType, "image/webp");
  assert.equal(asset.width, 400);
  assert.equal(asset.height, 300);
});

test("saveItem stores new image payloads out-of-line while keeping the item record metadata-only", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveItem({
    id: "item-split",
    itemUuid: "uuid-split",
    imageUrl: "data:image/webp;base64,preview-inline",
    imageWidth: 1200,
    imageHeight: 800,
    mimeType: "image/webp",
    fileSize: 1111,
    originalFilename: "split.png",
    images: {
      original: {
        src: "data:image/png;base64,b3JpZ2luYWwtaW5saW5l",
        mimeType: "image/png",
        width: 2400,
        height: 1600,
        fileSize: 3333,
        originalFilename: "split.png"
      },
      preview: {
        src: "data:image/webp;base64,preview-inline",
        mimeType: "image/webp",
        width: 1200,
        height: 800,
        fileSize: 1111,
        originalFilename: "split.png"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb-inline",
        mimeType: "image/webp",
        width: 320,
        height: 213,
        fileSize: 222,
        originalFilename: "split.png"
      }
    },
    originalPreserved: true
  });

  const database = indexedDb.getDatabase("moodboard-app-db");
  const storedItem = database.stores.get("items").records.get("item-split");
  const previewRecord = database.stores.get("itemMediaAssets").records.get("item-split:preview");
  const thumbnailRecord = database.stores.get("itemMediaAssets").records.get("item-split:thumbnail");
  const originalRecord = database.stores.get("originalImageBlobs").records.get("uuid-split");

  assert.equal(storedItem.imageUrl, "");
  assert.equal(storedItem.images.preview.src, "");
  assert.equal(storedItem.images.thumbnail.src, "");
  assert.equal(storedItem.images.original.src, "");
  assert.equal(previewRecord.asset.src, "data:image/webp;base64,preview-inline");
  assert.equal(thumbnailRecord.asset.src, "data:image/webp;base64,thumb-inline");
  assert.equal(originalRecord.mimeType, "image/png");
  assert.equal(await originalRecord.blob.text(), "original-inline");
});

test("legacy inline-media records still resolve through loadItemMediaAssetById", async () => {
  const indexedDb = installFakeIndexedDb();

  seedStore(indexedDb, "moodboard-app-db", "items", "id", [
    {
      id: "legacy-inline",
      itemUuid: "legacy-inline-uuid",
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

  const asset = await loadItemMediaAssetById("legacy-inline", "preview");

  assert.equal(asset.src, "data:image/webp;base64,legacy-preview");
  assert.equal(asset.mimeType, "image/webp");
  assert.equal(asset.width, 900);
  assert.equal(asset.height, 600);
});

test("metadata-only edits preserve out-of-line media assets", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-preserve",
    itemUuid: "uuid-preserve",
    name: "Before",
    imageUrl: "data:image/webp;base64,preview-preserve",
    images: {
      preview: {
        src: "data:image/webp;base64,preview-preserve",
        mimeType: "image/webp",
        width: 640,
        height: 480
      }
    }
  });

  await saveItem({
    id: "item-preserve",
    itemUuid: "uuid-preserve",
    name: "After",
    imageUrl: "",
    images: {
      preview: {
        src: "",
        mimeType: "image/webp",
        width: 640,
        height: 480
      }
    }
  });

  const [persistedItem] = await loadItems();
  const asset = await loadItemMediaAssetById("item-preserve", "preview");

  assert.equal(persistedItem.name, "After");
  assert.equal(persistedItem.imageUrl, "");
  assert.equal(persistedItem.images.preview.src, "");
  assert.equal(asset.src, "data:image/webp;base64,preview-preserve");
  assert.equal(asset.width, 640);
});

test("metadata-only rename of blob-backed imported items preserves identity and media ownership", async () => {
  const indexedDb = installFakeIndexedDb();

  await replaceWithPreparedBackupPackage({
    source: "moodboard-app-package",
    version: 1,
    exportedAt: "2026-05-31T10:00:00.000Z",
    items: [
      {
        id: "item-blob",
        itemUuid: "uuid-blob",
        name: "Before",
        sourceOriginalFilename: "imported.png",
        sourceFilenameAliases: ["scan-imported.png", "IMPORTED.PNG"],
        originalFilename: "imported.webp",
        originalPreserved: true,
        images: {
          original: {
            src: "",
            mimeType: "image/png",
            width: 1800,
            height: 1200,
            originalFilename: "imported.png"
          },
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            originalFilename: "imported.webp"
          },
          thumbnail: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0,
            originalFilename: ""
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    itemMediaAssets: [
      {
        itemId: "item-blob",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 640,
          height: 480,
          originalFilename: "imported.webp",
          blob: new Blob(["blob-preview"], { type: "image/webp" })
        }
      }
    ]
  });
  await saveOriginalImageBlob("uuid-blob", new Blob(["blob-original"], { type: "image/png" }), {
    mimeType: "image/png",
    width: 1800,
    height: 1200,
    originalFilename: "imported.png"
  });

  await saveItem({
    id: "item-blob",
    itemUuid: "uuid-blob",
    name: "After",
    tags: ["renamed"],
    imageUrl: "",
    images: {
      preview: {
        src: "",
        mimeType: "image/webp",
        width: 640,
        height: 480
      }
    }
  });

  const [savedMetadata] = await loadStartupItemMetadata();
  const previewAsset = await loadItemMediaAssetById("item-blob", "preview");
  const originalBlob = await loadOriginalImageBlobEntry("uuid-blob");
  const mediaStore = getStoreStats(indexedDb, "itemMediaAssets");

  assert.equal(savedMetadata.id, "item-blob");
  assert.equal(savedMetadata.itemUuid, "uuid-blob");
  assert.equal(savedMetadata.sourceOriginalFilename, "imported.png");
  assert.deepEqual(savedMetadata.sourceFilenameAliases, ["scan-imported.png", "imported.webp"]);
  assert.equal(savedMetadata.originalFilename, "imported.webp");
  assert.equal(mediaStore.records.size, 1);
  assert.equal(mediaStore.records.has("item-blob:preview"), true);
  assert.equal(previewAsset.blob instanceof Blob, true);
  assert.equal(await previewAsset.blob.text(), "blob-preview");
  assert.equal(originalBlob.itemUuid, "uuid-blob");
  assert.equal(await originalBlob.blob.text(), "blob-original");
});

test("repeated metadata-only saves keep preview and thumbnail asset counts stable", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveItem({
    id: "item-stable",
    itemUuid: "uuid-stable",
    name: "Stable",
    imageUrl: "data:image/webp;base64,c3RhYmxlLXByZXZpZXc=",
    originalFilename: "stable.webp",
    originalPreserved: true,
    images: {
      original: {
        src: "data:image/png;base64,c3RhYmxlLW9yaWdpbmFs",
        mimeType: "image/png",
        width: 1800,
        height: 1200,
        originalFilename: "stable.png"
      },
      preview: {
        src: "data:image/webp;base64,c3RhYmxlLXByZXZpZXc=",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        originalFilename: "stable.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,c3RhYmxlLXRodW1i",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        originalFilename: "stable-thumb.webp"
      }
    }
  });

  await saveItem({
    id: "item-stable",
    itemUuid: "uuid-stable",
    name: "Stable 2",
    tags: ["one"]
  });
  await saveItem({
    id: "item-stable",
    itemUuid: "uuid-stable",
    name: "Stable 3",
    tags: ["one", "two"],
    description: "metadata only"
  });

  const mediaStore = getStoreStats(indexedDb, "itemMediaAssets");
  const originalStore = getStoreStats(indexedDb, "originalImageBlobs");

  assert.equal(mediaStore.records.size, 2);
  assert.equal(mediaStore.putCount, 2);
  assert.equal(originalStore.records.size, 1);
  assert.equal(originalStore.putCount, 1);
});

test("explicit media replacement updates stored assets without changing ownership keys", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveItem({
    id: "item-replace",
    itemUuid: "uuid-replace",
    name: "Before",
    imageUrl: "data:image/webp;base64,b2xkLXByZXZpZXc=",
    originalFilename: "before.webp",
    originalPreserved: true,
    images: {
      original: {
        src: "data:image/png;base64,b2xkLW9yaWdpbmFs",
        mimeType: "image/png",
        width: 1800,
        height: 1200,
        originalFilename: "before.png"
      },
      preview: {
        src: "data:image/webp;base64,b2xkLXByZXZpZXc=",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        originalFilename: "before.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,b2xkLXRodW1i",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        originalFilename: "before-thumb.webp"
      }
    }
  });

  await saveItem({
    id: "item-replace",
    itemUuid: "uuid-replace",
    name: "After",
    mediaUpdateIntent: "replace",
    imageUrl: "data:image/webp;base64,bmV3LXByZXZpZXc=",
    originalFilename: "after.webp",
    originalPreserved: true,
    images: {
      original: {
        src: "data:image/png;base64,bmV3LW9yaWdpbmFs",
        mimeType: "image/png",
        width: 2000,
        height: 1400,
        originalFilename: "after.png"
      },
      preview: {
        src: "data:image/webp;base64,bmV3LXByZXZpZXc=",
        mimeType: "image/webp",
        width: 800,
        height: 560,
        originalFilename: "after.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,bmV3LXRodW1i",
        mimeType: "image/webp",
        width: 320,
        height: 224,
        originalFilename: "after-thumb.webp"
      }
    }
  });

  const mediaStore = getStoreStats(indexedDb, "itemMediaAssets");
  const previewRecord = mediaStore.records.get("item-replace:preview");
  const thumbnailRecord = mediaStore.records.get("item-replace:thumbnail");
  const originalEntry = await loadOriginalImageBlobEntry("uuid-replace");

  assert.equal(mediaStore.records.size, 2);
  assert.equal(previewRecord.asset.src, "data:image/webp;base64,bmV3LXByZXZpZXc=");
  assert.equal(thumbnailRecord.asset.src, "data:image/webp;base64,bmV3LXRodW1i");
  assert.equal(await originalEntry.blob.text(), "new-original");
});

test("explicit remove-image deletes owned media rows and original blob", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveItem({
    id: "item-remove",
    itemUuid: "uuid-remove",
    name: "Before",
    imageUrl: "data:image/webp;base64,cmVtb3ZlLXByZXZpZXc=",
    originalFilename: "remove.webp",
    originalPreserved: true,
    images: {
      original: {
        src: "data:image/png;base64,cmVtb3ZlLW9yaWdpbmFs",
        mimeType: "image/png",
        width: 1800,
        height: 1200,
        originalFilename: "remove.png"
      },
      preview: {
        src: "data:image/webp;base64,cmVtb3ZlLXByZXZpZXc=",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        originalFilename: "remove.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,cmVtb3ZlLXRodW1i",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        originalFilename: "remove-thumb.webp"
      }
    }
  });

  await saveItem({
    id: "item-remove",
    itemUuid: "uuid-remove",
    name: "Removed",
    imageUrl: "",
    mediaUpdateIntent: "remove",
    originalPreserved: false,
    images: {
      original: { src: "" },
      preview: { src: "" },
      thumbnail: { src: "" }
    }
  });

  const mediaStore = getStoreStats(indexedDb, "itemMediaAssets");

  assert.equal(mediaStore.records.size, 0);
  assert.equal(await hasOriginalImageBlob("uuid-remove"), false);
});

test("loadItems keeps visible-card records metadata-only while media resolves through the helper", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-visible",
    itemUuid: "uuid-visible",
    name: "Visible",
    imageUrl: "data:image/webp;base64,visible-preview",
    images: {
      preview: {
        src: "data:image/webp;base64,visible-preview",
        mimeType: "image/webp",
        width: 500,
        height: 400
      }
    }
  });

  const [item] = await loadItems();
  const asset = await loadItemMediaAssetById(item.id, "preview");

  assert.equal(item.imageUrl, "");
  assert.equal(item.images.preview.src, "");
  assert.equal(asset.src, "data:image/webp;base64,visible-preview");
  assert.equal(asset.width, 500);
  assert.equal(asset.height, 400);
});

test("exportBackup materializes out-of-line preview media for new records", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-export",
    itemUuid: "uuid-export",
    name: "Export",
    imageUrl: "data:image/webp;base64,export-preview",
    images: {
      preview: {
        src: "data:image/webp;base64,export-preview",
        mimeType: "image/webp",
        width: 720,
        height: 540
      }
    }
  });

  await saveAppState({
    savedOutfits: []
  });

  const backup = await exportBackup();

  assert.equal(backup.items[0].images.preview.src, "data:image/webp;base64,export-preview");
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
  assert.equal(prepared.items[0].imageUrl, "data:image/webp;base64,preview-only");
  assert.equal(prepared.items[0].sourceOriginalFilename, "legacy.png");
  assert.deepEqual(prepared.items[0].sourceFilenameAliases, []);
  assert.equal(prepared.items[0].relinkStatus, "pending");
  assert.ok(prepared.items[0].itemUuid);
  assert.deepEqual(prepared.appState, {
    savedOutfits: [],
    provenance: {
      lastLibraryEditAt: "",
      lastBackupExportAt: "",
      lastMetadataExportAt: "",
      lastBackupImportAt: "",
      lastImportedBackupName: "",
      lastImportedBackupSource: "",
      lastImportedBackupSchemaVersion: "",
      itemCountSnapshot: 0,
      appVersion: ""
    },
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
    provenance: {
      lastLibraryEditAt: "",
      lastBackupExportAt: "",
      lastMetadataExportAt: "",
      lastBackupImportAt: "",
      lastImportedBackupName: "",
      lastImportedBackupSource: "",
      lastImportedBackupSchemaVersion: "",
      itemCountSnapshot: 0,
      appVersion: ""
    },
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

test("prepareBackupImport strips embedded payload fields from imported app state boards", () => {
  const prepared = prepareBackupImport({
    source: "moodboard-app",
    version: 2,
    exportedAt: "2026-05-25T12:00:00.000Z",
    items: [],
    appState: {
      board: {
        id: "active-board",
        boardUuid: "board-uuid-active",
        images: [
          {
            id: "board-image-1",
            referenceId: "item-1",
            imageUrl: "data:image/png;base64,large",
            embeddedItem: {
              imageUrl: "data:image/png;base64,large"
            }
          }
        ]
      },
      savedOutfits: [
        {
          id: "saved-1",
          board: {
            id: "saved-board-1",
            images: [
              {
                id: "saved-board-image-1",
                referenceId: "item-1",
                imageUrl: "data:image/png;base64,large"
              }
            ]
          }
        }
      ]
    }
  });

  assert.equal("imageUrl" in prepared.appState.board.images[0], false);
  assert.equal("embeddedItem" in prepared.appState.board.images[0], false);
  assert.equal("imageUrl" in prepared.appState.savedOutfits[0].board.images[0], false);
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
        sourceFilenameAliases: ["portable-alias.jpg", "preview.webp"],
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
  assert.deepEqual(prepared.items[0].sourceFilenameAliases, ["portable-alias.jpg", "preview.webp"]);
  assert.deepEqual(prepared.items[0].styleTags, ["Formal"]);
  assert.deepEqual(prepared.items[0].climateTags, ["Rain"]);
  assert.deepEqual(prepared.items[0].tags, ["archive/source"]);
  assert.equal(prepared.items[0].images.original.src, "");
  assert.equal(prepared.items[0].images.original.checksum, "orig-checksum");
  assert.equal(prepared.items[0].images.preview.src, "data:image/webp;base64,preview");
  assert.equal(prepared.items[0].images.preview.cdnPath, "/portable/preview.webp");
  assert.equal(prepared.items[0].images.thumbnail.src, "");
  assert.equal(prepared.items[0].images.thumbnail.blurHash, "thumb-hash");
  assert.equal(prepared.items[0].originalPreserved, false);
  assert.equal(prepared.items[0].imageUrl, "data:image/webp;base64,preview");
  assert.equal(prepared.items[0].mimeType, "image/webp");
  assert.equal(prepared.items[0].imageWidth, 1200);
  assert.equal(prepared.items[0].imageHeight, 800);

  assert.equal(reExported.items[0].importSource, "oa-backup");
  assert.equal(reExported.items[0].relinkStatus, "hub-awaiting-rebind");
  assert.deepEqual(reExported.items[0].sourceFilenameAliases, ["portable-alias.jpg", "preview.webp"]);
  assert.deepEqual(reExported.items[0].styleTags, ["Formal"]);
  assert.deepEqual(reExported.items[0].climateTags, ["Rain"]);
  assert.deepEqual(reExported.items[0].tags, ["archive/source"]);
  assert.equal(reExported.items[0].images.original.src, "");
  assert.equal(reExported.items[0].images.original.checksum, "orig-checksum");
  assert.equal(reExported.items[0].images.preview.src, "data:image/webp;base64,preview");
  assert.equal(reExported.items[0].images.thumbnail.src, "");
  assert.equal("imageUrl" in reExported.items[0], false);
  assert.equal("mimeType" in reExported.items[0], false);
  assert.equal("imageWidth" in reExported.items[0], false);
  assert.equal("imageHeight" in reExported.items[0], false);
  assert.equal("fileSize" in reExported.items[0], false);
});

test("slim backup exports keep saved boards free of embedded image blobs", () => {
  const backup = createLightweightBackupData(
    [
      {
        id: "item-1",
        imageUrl: "data:image/webp;base64,preview",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "backup.png",
        images: {
          preview: {
            src: "data:image/webp;base64,preview",
            mimeType: "image/webp",
            width: 1200,
            height: 800,
            fileSize: 1111,
            originalFilename: "backup.png"
          },
          thumbnail: {
            src: "data:image/webp;base64,thumb",
            mimeType: "image/webp",
            width: 480,
            height: 320,
            fileSize: 222,
            originalFilename: "backup.png"
          }
        }
      }
    ],
    {
      savedOutfits: [
        {
          id: "saved-1",
          board: {
            id: "board-1",
            boardUuid: "board-uuid-1",
            images: [{ id: "board-image-1", referenceId: "item-1", x: 0, y: 0, width: 200, height: 300 }]
          }
        }
      ],
      recentOutfits: []
    }
  );

  const serialized = JSON.stringify(backup.appState.savedOutfits);
  assert.equal(serialized.includes("data:image/"), false);
});

test("demo backup round-trip rebuilds imageUrl and keeps saved boards importable", () => {
  const backup = createLightweightBackupData(defaultWardrobe, {
    savedOutfits: [
      {
        id: "saved-1",
        name: "Board 1",
        board: {
          id: "board-1",
          boardUuid: "board-uuid-1",
          images: [
            { id: "image-1", referenceId: defaultWardrobe[0].id, x: 10, y: 20, width: 220, height: 300 }
          ]
        }
      }
    ],
    recentOutfits: []
  });

  const prepared = prepareBackupImport(backup);

  assert.equal("imageUrl" in backup.items[0], false);
  assert.equal(prepared.items[0].imageUrl, defaultWardrobe[0].imageUrl);
  assert.equal(prepared.items[0].images.preview.src, defaultWardrobe[0].images.preview.src);
  assert.equal(prepared.appState.savedOutfits[0].board.images[0].referenceId, defaultWardrobe[0].id);
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

test("replaceWithPreparedBackup validates payload before clearing existing data", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    imageUrl: "data:image/webp;base64,preview",
    images: {
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 400,
        height: 300
      }
    }
  });
  await saveAppState({
    savedOutfits: []
  });

  await assert.rejects(
    () => replaceWithPreparedBackup({
      source: "moodboard-app",
      version: 2,
      exportedAt: "2026-05-25T12:00:00.000Z",
      items: null,
      appState: {}
    }),
    /backup items are invalid/i
  );

  const persistedItems = await loadItems();
  const persistedAppState = await loadAppState();

  assert.equal(persistedItems.length, 1);
  assert.equal(persistedItems[0].id, "item-1");
  assert.deepEqual(persistedAppState.savedOutfits, []);
});

test("replaceWithPreparedBackupPackage validates payload before clearing existing data", async () => {
  installFakeIndexedDb();

  await saveItem({
    id: "item-1",
    itemUuid: "uuid-1",
    imageUrl: "data:image/webp;base64,preview",
    images: {
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 400,
        height: 300
      }
    }
  });
  await saveAppState({
    savedOutfits: []
  });

  await assert.rejects(
    () => replaceWithPreparedBackupPackage({
      source: "moodboard-app-package",
      version: 1,
      exportedAt: "2026-05-25T12:00:00.000Z",
      items: [
        {
          id: "item-2",
          itemUuid: "uuid-2",
          images: {
            preview: {
              src: "",
              mimeType: "image/webp",
              width: 640,
              height: 480
            }
          }
        }
      ],
      appState: {
        savedOutfits: []
      },
      itemMediaAssets: [
        {
          itemId: "item-2",
          variant: "preview",
          asset: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            blob: null
          }
        }
      ]
    }),
    /missing preview data/i
  );

  const persistedItems = await loadItems();
  const persistedAppState = await loadAppState();

  assert.equal(persistedItems.length, 1);
  assert.equal(persistedItems[0].id, "item-1");
  assert.deepEqual(persistedAppState.savedOutfits, []);
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

test("replaceWithPreparedBackupPackage stores preview media, clears originals, and rebuilds sync metadata", async () => {
  const indexedDb = installFakeIndexedDb();

  await saveItem({
    id: "stale-item",
    itemUuid: "stale-uuid",
    originalPreserved: true,
    images: {
      original: {
        src: "data:image/png;base64,b3JpZw==",
        mimeType: "image/png",
        width: 1200,
        height: 800,
        originalFilename: "orig.png"
      },
      preview: {
        src: "data:image/webp;base64,cHJldmlldw==",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        originalFilename: "preview.webp"
      }
    }
  });
  await upsertSyncMetadata({
    key: "mba:reference:stale-uuid",
    entityType: "mbaReference",
    stableKey: "stale-uuid",
    localId: "stale-item",
    recordVersion: 2,
    syncStatus: "error",
    lastSyncedAt: "",
    lastModifiedByDevice: "device-stale",
    pendingDelete: false,
    lastSyncError: "stale",
    lastLocalChangeAt: ""
  });

  await replaceWithPreparedBackupPackage({
    source: "moodboard-app-package",
    version: 1,
    exportedAt: "2026-05-25T12:00:00.000Z",
    items: [
      {
        id: "item-2",
        itemUuid: "uuid-2",
        originalPreserved: false,
        images: {
          original: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0
          },
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            originalFilename: "preview.webp"
          },
          thumbnail: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    itemMediaAssets: [
      {
        itemId: "item-2",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 640,
          height: 480,
          originalFilename: "preview.webp",
          blob: new Blob(["preview-binary"], { type: "image/webp" })
        }
      }
    ]
  });

  const persistedItems = await loadItems();
  const metadata = await getSyncMetadata();
  const itemMediaStore = indexedDb.getDatabase(INDEXED_DB_NAME).stores.get("itemMediaAssets");
  const storedPreviewRecord = itemMediaStore.records.get("item-2:preview");

  assert.equal(persistedItems.length, 1);
  assert.equal(persistedItems[0].id, "item-2");
  assert.equal(persistedItems[0].imageUrl, "");
  assert.equal(persistedItems[0].images.preview.src, "");
  assert.equal(storedPreviewRecord.asset.mimeType, "image/webp");
  assert.equal(storedPreviewRecord.asset.blob instanceof Blob, true);
  assert.equal(await hasOriginalImageBlob("stale-uuid"), false);
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0].key, "mba:reference:uuid-2");
  assert.equal(await getSyncMetadata("mba:reference:stale-uuid"), null);
});

test("replaceWithPreparedBackup persists imported items and app state across startup reloads", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackup({
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        imageUrl: "data:image/webp;base64,preview-1",
        imageWidth: 1200,
        imageHeight: 800,
        mimeType: "image/webp",
        fileSize: 1111,
        originalFilename: "ref-1.webp"
      },
      {
        id: "item-2",
        itemUuid: "uuid-2",
        imageUrl: "data:image/webp;base64,preview-2",
        imageWidth: 900,
        imageHeight: 600,
        mimeType: "image/webp",
        fileSize: 999,
        originalFilename: "ref-2.webp"
      }
    ],
    appState: {
      savedOutfits: [
        {
          id: "saved-1",
          board: {
            id: "board-1",
            boardUuid: "board-uuid-1",
            images: [{ id: "board-image-1", referenceId: "item-1" }]
          }
        }
      ],
      librarySearch: "imported-library",
      provenance: {
        lastImportedBackupName: "backup.json",
        lastImportedBackupSource: "moodboard-app",
        lastImportedBackupSchemaVersion: 2,
        itemCountSnapshot: 2
      }
    }
  });

  const startupItems = await loadStartupItemMetadata();
  const loadedItems = await loadItems();
  const startupAppState = await loadStartupAppState();

  assert.equal(startupItems.length, 2);
  assert.equal(loadedItems.length, 2);
  assert.equal(startupAppState.librarySearch, "imported-library");
  assert.equal(startupAppState.savedOutfits.length, 1);
  assert.equal(startupAppState.provenance.lastImportedBackupName, "backup.json");
  assert.equal(formatImportSourceFormatLabel(startupAppState.provenance), "moodboard-app v2");
});

test("imported items remain present after subsequent localSafety persistence", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackupPackage({
    source: "moodboard-app-package",
    version: 1,
    exportedAt: "2026-05-25T12:00:00.000Z",
    items: [
      {
        id: "item-a",
        itemUuid: "uuid-a",
        originalPreserved: false,
        images: {
          original: { src: "", mimeType: "", width: 0, height: 0 },
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 600,
            height: 400,
            fileSize: 321,
            originalFilename: "preview-a.webp"
          },
          thumbnail: {
            src: "",
            mimeType: "image/webp",
            width: 300,
            height: 200
          }
        }
      },
      {
        id: "item-b",
        itemUuid: "uuid-b",
        originalPreserved: false,
        images: {
          original: { src: "", mimeType: "", width: 0, height: 0 },
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 500,
            height: 500,
            fileSize: 222,
            originalFilename: "preview-b.webp"
          },
          thumbnail: {
            src: "",
            mimeType: "image/webp",
            width: 250,
            height: 250
          }
        }
      }
    ],
    appState: {
      savedOutfits: [],
      librarySearch: "package-import",
      provenance: {
        lastImportedBackupName: "package-dir",
        lastImportedBackupSource: "moodboard-app-package",
        lastImportedBackupSchemaVersion: 1,
        itemCountSnapshot: 2
      }
    },
    itemMediaAssets: [
      {
        itemId: "item-a",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 600,
          height: 400,
          originalFilename: "preview-a.webp",
          blob: new Blob(["preview-a"], { type: "image/webp" })
        }
      },
      {
        itemId: "item-b",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 500,
          height: 500,
          originalFilename: "preview-b.webp",
          blob: new Blob(["preview-b"], { type: "image/webp" })
        }
      }
    ]
  });

  const persistedAfterImport = await loadAppState();
  const nextLocalSafety = markMetadataChanged(persistedAfterImport.localSafety, {
    changedItemIds: ["item-a"]
  });

  await saveAppState({
    ...persistedAfterImport,
    localSafety: nextLocalSafety
  });

  const startupItems = await loadStartupItemMetadata();
  const startupAppState = await loadStartupAppState();

  assert.equal(startupItems.length, 2);
  assert.equal(startupAppState.librarySearch, "package-import");
  assert.equal(startupAppState.provenance.lastImportedBackupName, "package-dir");
  assert.equal(startupAppState.provenance.lastImportedBackupSource, "moodboard-app-package");
  assert.equal(startupAppState.provenance.lastImportedBackupSchemaVersion, "1");
  assert.equal(formatImportSourceFormatLabel(startupAppState.provenance), "moodboard-app-package v1");
  assert.equal(startupAppState.localSafety.metadataDirtySinceSnapshot, true);
  assert.deepEqual(startupAppState.localSafety.changedItemIdsSinceSnapshot, ["item-a"]);
});

test("replaceWithPreparedBackupPackage preserves provenance through startup reload when present", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackupPackage({
    source: "moodboard-app-package",
    version: 1,
    exportedAt: "2026-05-25T12:00:00.000Z",
    items: [
      {
        id: "item-provenance",
        itemUuid: "uuid-provenance",
        sourceOriginalFilename: "source-photo.jpg",
        sourceFilenameAliases: ["alt-photo.jpg", "preview.webp"],
        originalPreserved: false,
        images: {
          original: { src: "", mimeType: "", width: 0, height: 0 },
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            originalFilename: "preview.webp"
          },
          thumbnail: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0
          }
        }
      }
    ],
    appState: {
      savedOutfits: [],
      provenance: {
        lastImportedBackupName: "package-dir",
        lastImportedBackupSource: "moodboard-app-package",
        lastImportedBackupSchemaVersion: 1,
        itemCountSnapshot: 1
      }
    },
    itemMediaAssets: [
      {
        itemId: "item-provenance",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 640,
          height: 480,
          originalFilename: "preview.webp",
          blob: new Blob(["preview-provenance"], { type: "image/webp" })
        }
      }
    ]
  });

  const startupAppState = await loadStartupAppState();
  const [startupItem] = await loadStartupItemMetadata();

  assert.equal(startupAppState.provenance.lastImportedBackupName, "package-dir");
  assert.equal(startupAppState.provenance.lastImportedBackupSource, "moodboard-app-package");
  assert.equal(startupAppState.provenance.lastImportedBackupSchemaVersion, "1");
  assert.equal(startupItem.sourceOriginalFilename, "source-photo.jpg");
  assert.deepEqual(startupItem.sourceFilenameAliases, ["alt-photo.jpg", "preview.webp"]);
});

test("replaceWithPreparedBackupPackage does not require provenance to persist imported items", async () => {
  installFakeIndexedDb();

  await replaceWithPreparedBackupPackage({
    source: "moodboard-app-package",
    version: 1,
    exportedAt: "2026-05-25T12:00:00.000Z",
    items: [
      {
        id: "item-no-provenance",
        itemUuid: "uuid-no-provenance",
        originalPreserved: false,
        images: {
          original: { src: "", mimeType: "", width: 0, height: 0 },
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 500,
            height: 300,
            originalFilename: "preview.webp"
          },
          thumbnail: {
            src: "",
            mimeType: "",
            width: 0,
            height: 0
          }
        }
      }
    ],
    appState: {
      savedOutfits: [],
      librarySearch: "no-provenance"
    },
    itemMediaAssets: [
      {
        itemId: "item-no-provenance",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 500,
          height: 300,
          originalFilename: "preview.webp",
          blob: new Blob(["preview-no-provenance"], { type: "image/webp" })
        }
      }
    ]
  });

  const startupItems = await loadStartupItemMetadata();
  const startupAppState = await loadStartupAppState();

  assert.equal(startupItems.length, 1);
  assert.equal(startupAppState.librarySearch, "no-provenance");
  assert.equal(startupAppState.provenance.lastImportedBackupName, "");
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

test("saveAppState persists provenance metadata and loadStartupAppState returns it", async () => {
  installFakeIndexedDb();

  await saveAppState({
    savedOutfits: [],
    provenance: {
      lastLibraryEditAt: "2026-05-26T11:00:00.000Z",
      lastBackupExportAt: "2026-05-26T12:00:00.000Z",
      lastMetadataExportAt: "2026-05-26T12:30:00.000Z",
      lastBackupImportAt: "2026-05-26T13:00:00.000Z",
      lastImportedBackupName: "mba-package",
      lastImportedBackupSource: "moodboard-app-package",
      lastImportedBackupSchemaVersion: 1,
      itemCountSnapshot: 4
    }
  });

  const loaded = await loadAppState();
  const startupLoaded = await loadStartupAppState();

  assert.deepEqual(loaded.provenance, {
    lastLibraryEditAt: "2026-05-26T11:00:00.000Z",
    lastBackupExportAt: "2026-05-26T12:00:00.000Z",
    lastMetadataExportAt: "2026-05-26T12:30:00.000Z",
    lastBackupImportAt: "2026-05-26T13:00:00.000Z",
    lastImportedBackupName: "mba-package",
    lastImportedBackupSource: "moodboard-app-package",
    lastImportedBackupSchemaVersion: "1",
    itemCountSnapshot: 4,
    appVersion: ""
  });
  assert.deepEqual(startupLoaded.provenance, loaded.provenance);
});

test("replaceWithPreparedBackup preserves imported provenance metadata and old app states still load", async () => {
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
        originalFilename: "ref.webp"
      }
    ],
    appState: {
      savedOutfits: [],
      provenance: {
        lastBackupImportAt: "2026-05-26T13:00:00.000Z",
        lastImportedBackupName: "backup.json",
        lastImportedBackupSource: "moodboard-app",
        lastImportedBackupSchemaVersion: 2,
        itemCountSnapshot: 1
      }
    }
  });

  const importedState = await loadAppState();
  assert.equal(importedState.provenance.lastBackupImportAt, "2026-05-26T13:00:00.000Z");
  assert.equal(importedState.provenance.lastImportedBackupName, "backup.json");
  assert.equal(importedState.provenance.lastImportedBackupSource, "moodboard-app");
  assert.equal(importedState.provenance.lastImportedBackupSchemaVersion, "2");
  assert.equal(importedState.provenance.itemCountSnapshot, 1);

  await saveAppState({
    savedOutfits: []
  });
  const oldState = await loadAppState();
  assert.deepEqual(oldState.provenance, {
    lastLibraryEditAt: "",
    lastBackupExportAt: "",
    lastMetadataExportAt: "",
    lastBackupImportAt: "",
    lastImportedBackupName: "",
    lastImportedBackupSource: "",
    lastImportedBackupSchemaVersion: "",
    itemCountSnapshot: 0,
    appVersion: ""
  });
});
