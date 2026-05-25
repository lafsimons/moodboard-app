import defaultWardrobe from "../data/defaultWardrobe.js";
import defaultAppState from "../data/defaultAppState.js";
import {
  BACKUP_SOURCE,
  INDEXED_DB_NAME,
  LEGACY_INDEXED_DB_NAME,
  SUPPORTED_BACKUP_SOURCES,
  SUPPORTED_BACKUP_VERSIONS
} from "./appIdentity.js";
import { ensureBoardUuid, ensureSavedBoardUuid } from "./boardIdentity.js";
import { createImageAsset, normalizeItemImages } from "./itemImages.js";
import { migrateReferenceMetadataToTags, sanitizeBackupReference } from "./metadata.js";
import { stripItemMediaPayloads } from "./startupItemMetadata.js";

const DB_VERSION = 3;
export const BACKUP_VERSION = 2;
const ITEM_STORE = "items";
const APP_STORE = "appState";
const ORIGINAL_STORE = "originalImageBlobs";
const SYNC_STATE_STORE = "syncState";
const SYNC_METADATA_STORE = "syncMetadata";
const SYNC_STATE_KEY = "state";
const MIGRATED_STORES = [ITEM_STORE, APP_STORE, ORIGINAL_STORE];
const PERSISTED_APP_STATE_MAX_BYTES = 1024 * 1024;
const SYNC_BACKFILL_BATCH_SIZE = 100;

let indexedDbFactory = () => globalThis.indexedDB;
let databaseReadyPromise = null;

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePersistedId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePersistedBoardImage(image, index = 0) {
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    return null;
  }

  const sanitizedImage = {
    id: normalizePersistedId(image.id) || `board_image_${index}`,
    referenceId: normalizePersistedId(image.referenceId),
    referenceItemUuid: normalizePersistedId(image.referenceItemUuid),
    x: Math.round(Number(image.x) || 0),
    y: Math.round(Number(image.y) || 0),
    width: Math.max(0, Math.round(Number(image.width) || 0)),
    height: Math.max(0, Math.round(Number(image.height) || 0)),
    rotation: Math.round((Number(image.rotation) || 0) * 10) / 10,
    zIndex: Math.max(1, Math.round(Number(image.zIndex) || index + 1)),
    generationSlot: normalizePersistedId(image.generationSlot)
  };
  const referenceSourceKey = normalizePersistedId(image.referenceSourceKey).toLowerCase();

  if (referenceSourceKey) {
    sanitizedImage.referenceSourceKey = referenceSourceKey;
  }

  return sanitizedImage.referenceId ? sanitizedImage : null;
}

function sanitizePersistedBoard(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) {
    return null;
  }

  const images = (Array.isArray(board.images) ? board.images : [])
    .map((image, index) => sanitizePersistedBoardImage(image, index))
    .filter(Boolean);

  if (!images.length) {
    return null;
  }

  return {
    id: normalizePersistedId(board.id) || `board_${Date.now()}`,
    boardUuid: normalizePersistedId(board.boardUuid),
    width: Math.max(0, Math.round(Number(board.width) || 0)),
    height: Math.max(0, Math.round(Number(board.height) || 0)),
    images
  };
}

function sanitizePersistedOutfit(outfit) {
  return Object.fromEntries(
    Object.entries(outfit && typeof outfit === "object" && !Array.isArray(outfit) ? outfit : {}).map(
      ([slot, itemId]) => [slot, normalizePersistedId(itemId) || null]
    )
  );
}

function sanitizePersistedSavedOutfit(savedOutfit, index = 0) {
  if (!savedOutfit || typeof savedOutfit !== "object" || Array.isArray(savedOutfit)) {
    return null;
  }

  const sanitizedOutfit = sanitizePersistedOutfit(savedOutfit.outfit);
  const sanitizedSavedOutfit = {
    id: normalizePersistedId(savedOutfit.id) || `saved_outfit_${index}`,
    name: typeof savedOutfit.name === "string" ? savedOutfit.name : "Saved board",
    description: typeof savedOutfit.description === "string" ? savedOutfit.description : "",
    board: sanitizePersistedBoard(savedOutfit.board)
  };

  if (Object.keys(sanitizedOutfit).length) {
    sanitizedSavedOutfit.outfit = sanitizedOutfit;
  }

  if (savedOutfit.layering) {
    sanitizedSavedOutfit.layering = true;
  }

  return sanitizedSavedOutfit;
}

function sanitizePersistedAppState(value = {}) {
  return {
    ...value,
    itemDefaultsMigrationVersion: Math.max(0, Math.round(Number(value.itemDefaultsMigrationVersion) || 0)),
    imagePresentationMigrationVersion: Math.max(0, Math.round(Number(value.imagePresentationMigrationVersion) || 0)),
    outfit: sanitizePersistedOutfit(value.outfit),
    board: sanitizePersistedBoard(value.board),
    savedOutfits: (Array.isArray(value.savedOutfits) ? value.savedOutfits : [])
      .map((savedOutfit, index) => sanitizePersistedSavedOutfit(savedOutfit, index))
      .filter(Boolean)
  };
}

function getApproxSerializedBytes(value) {
  const serialized = JSON.stringify(value);
  const approxBytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(serialized).length
    : serialized.length * 2;

  return {
    serialized,
    approxBytes
  };
}

function createDeviceId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeSyncText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSyncBoolean(value) {
  return Boolean(value);
}

function normalizeSyncNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Math.round(numericValue) : fallback;
}

function normalizeSyncTimestamp(value) {
  const trimmedValue = normalizeSyncText(value);

  if (!trimmedValue) {
    return "";
  }

  const parsedValue = Date.parse(trimmedValue);
  return Number.isFinite(parsedValue) ? new Date(parsedValue).toISOString() : "";
}

function normalizeSyncState(record, fallbackDeviceId = "", now = getCurrentSyncTimestamp()) {
  const normalizedDeviceId = normalizeSyncText(record?.deviceId) || normalizeSyncText(fallbackDeviceId);
  const normalizedCreatedAt = normalizeSyncTimestamp(record?.createdAt);
  const normalizedUpdatedAt = normalizeSyncTimestamp(record?.updatedAt);
  const createdAt = normalizedCreatedAt || normalizedUpdatedAt || now;
  const updatedAt = normalizedUpdatedAt || normalizedCreatedAt || createdAt;

  return {
    key: SYNC_STATE_KEY,
    deviceId: normalizedDeviceId,
    createdAt,
    updatedAt,
    lastPushCursor: normalizeSyncText(record?.lastPushCursor),
    lastPullCursor: normalizeSyncText(record?.lastPullCursor)
  };
}

function getCurrentSyncTimestamp() {
  return new Date().toISOString();
}

function normalizeSyncMetadataKey(value) {
  return normalizeSyncText(value);
}

function createReferenceSyncMetadataKey(itemUuid) {
  const stableKey = normalizeSyncText(itemUuid);
  return stableKey ? `mba:reference:${stableKey}` : "";
}

function createBoardSyncMetadataKey(boardUuid) {
  const stableKey = normalizeSyncText(boardUuid);
  return stableKey ? `mba:board:${stableKey}` : "";
}

function normalizeSyncMetadataRecord(record) {
  const key = normalizeSyncMetadataKey(record?.key);

  if (!key) {
    throw new Error("Sync metadata entry is missing a key.");
  }

  return {
    key,
    entityType: normalizeSyncText(record?.entityType),
    stableKey: normalizeSyncText(record?.stableKey),
    localId: normalizeSyncText(record?.localId),
    recordVersion: normalizeSyncNumber(record?.recordVersion),
    syncStatus: normalizeSyncText(record?.syncStatus),
    lastSyncedAt: normalizeSyncTimestamp(record?.lastSyncedAt),
    lastModifiedByDevice: normalizeSyncText(record?.lastModifiedByDevice),
    pendingDelete: normalizeSyncBoolean(record?.pendingDelete),
    lastSyncError: normalizeSyncText(record?.lastSyncError),
    lastLocalChangeAt: normalizeSyncTimestamp(record?.lastLocalChangeAt)
  };
}

function createNextDirtySyncMetadataRecord({
  key,
  entityType,
  stableKey,
  localId,
  existingRecord = null,
  deviceId = "",
  pendingDelete = false,
  now = getCurrentSyncTimestamp()
}) {
  return normalizeSyncMetadataRecord({
    key,
    entityType,
    stableKey,
    localId,
    recordVersion: normalizeSyncNumber(existingRecord?.recordVersion) + 1,
    syncStatus: "pending_upload",
    lastSyncedAt: normalizeSyncTimestamp(existingRecord?.lastSyncedAt),
    lastModifiedByDevice: normalizeSyncText(deviceId),
    pendingDelete,
    lastSyncError: "",
    lastLocalChangeAt: now
  });
}

function buildReferenceSyncMetadata(item, deviceId, existingRecord = null) {
  const stableKey = normalizeSyncText(item?.itemUuid);
  const key = createReferenceSyncMetadataKey(stableKey);

  if (!key) {
    return null;
  }

  if (existingRecord) {
    return null;
  }

  return normalizeSyncMetadataRecord({
    key,
    entityType: "mbaReference",
    stableKey,
    localId: normalizeSyncText(item?.id),
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: normalizeSyncText(deviceId),
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
}

function buildSavedBoardSyncMetadata(savedOutfit, deviceId, existingRecord = null) {
  const normalizedSavedOutfit = ensureSavedBoardUuid(savedOutfit);
  const stableKey = normalizeSyncText(normalizedSavedOutfit?.board?.boardUuid);
  const key = createBoardSyncMetadataKey(stableKey);

  if (!key) {
    return null;
  }

  if (existingRecord) {
    return null;
  }

  return normalizeSyncMetadataRecord({
    key,
    entityType: "mbaBoard",
    stableKey,
    localId: normalizeSyncText(normalizedSavedOutfit?.id),
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: normalizeSyncText(deviceId),
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
}

function getSavedBoardSyncableRecord(savedOutfit) {
  const normalizedSavedOutfit = ensureSavedBoardUuid(savedOutfit);
  const boardUuid = normalizeSyncText(normalizedSavedOutfit?.board?.boardUuid);

  if (!boardUuid) {
    return null;
  }

  return {
    ...normalizedSavedOutfit,
    board: normalizedSavedOutfit.board
  };
}

function createSavedBoardMetadataByStableKey(savedOutfits = []) {
  return (Array.isArray(savedOutfits) ? savedOutfits : []).reduce((lookup, savedOutfit) => {
    const syncableSavedOutfit = getSavedBoardSyncableRecord(savedOutfit);

    if (!syncableSavedOutfit) {
      return lookup;
    }

    lookup[syncableSavedOutfit.board.boardUuid] = syncableSavedOutfit;
    return lookup;
  }, {});
}

function haveSavedBoardRecordsChanged(previousSavedOutfit, nextSavedOutfit) {
  return JSON.stringify(previousSavedOutfit) !== JSON.stringify(nextSavedOutfit);
}

function stripLocalOnlyAppState(appState) {
  if (!appState || typeof appState !== "object") {
    return {};
  }

  const { recentOutfits, ...rest } = appState;
  return rest;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getIndexedDb() {
  const indexedDb = indexedDbFactory();

  if (!indexedDb) {
    throw new Error("IndexedDB is not available in this environment.");
  }

  return indexedDb;
}

function openDatabaseByName(name) {
  return new Promise((resolve, reject) => {
    const request = getIndexedDb().open(name, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        db.createObjectStore(ITEM_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(APP_STORE)) {
        db.createObjectStore(APP_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(ORIGINAL_STORE)) {
        db.createObjectStore(ORIGINAL_STORE, { keyPath: "itemUuid" });
      }

      if (!db.objectStoreNames.contains(SYNC_STATE_STORE)) {
        db.createObjectStore(SYNC_STATE_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(SYNC_METADATA_STORE)) {
        db.createObjectStore(SYNC_METADATA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readAllStoreRecords(database, storeNames) {
  const transaction = database.transaction(storeNames, "readonly");
  const transactionDone = transactionToPromise(transaction);
  const stores = Object.fromEntries(storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]));
  const recordsByStore = await Promise.all(
    storeNames.map(async (storeName) => [storeName, await requestToPromise(stores[storeName].getAll())])
  );
  await transactionDone;
  return Object.fromEntries(recordsByStore);
}

function hasAnyMigratableData(recordsByStore) {
  return MIGRATED_STORES.some((storeName) => Array.isArray(recordsByStore[storeName]) && recordsByStore[storeName].length > 0);
}

async function copyStoreRecords(database, recordsByStore) {
  const transaction = database.transaction(MIGRATED_STORES, "readwrite");
  const transactionDone = transactionToPromise(transaction);
  const stores = Object.fromEntries(MIGRATED_STORES.map((storeName) => [storeName, transaction.objectStore(storeName)]));

  MIGRATED_STORES.forEach((storeName) => {
    (recordsByStore[storeName] ?? []).forEach((record) => stores[storeName].put(record));
  });

  await transactionDone;
}

async function migrateLegacyDataIfNeeded() {
  const currentDatabase = await openDatabaseByName(INDEXED_DB_NAME);

  try {
    const currentRecords = await readAllStoreRecords(currentDatabase, MIGRATED_STORES);

    if (hasAnyMigratableData(currentRecords)) {
      return;
    }

    const legacyDatabase = await openDatabaseByName(LEGACY_INDEXED_DB_NAME);

    try {
      const legacyRecords = await readAllStoreRecords(legacyDatabase, MIGRATED_STORES);

      if (!hasAnyMigratableData(legacyRecords)) {
        return;
      }

      await copyStoreRecords(currentDatabase, legacyRecords);
    } finally {
      legacyDatabase.close();
    }
  } finally {
    currentDatabase.close();
  }
}

async function ensureDatabaseReady() {
  if (!databaseReadyPromise) {
    databaseReadyPromise = migrateLegacyDataIfNeeded().catch((error) => {
      databaseReadyPromise = null;
      throw error;
    });
  }

  await databaseReadyPromise;
}

async function openDatabase() {
  await ensureDatabaseReady();
  return openDatabaseByName(INDEXED_DB_NAME);
}

async function openDatabaseWithoutMigration() {
  return openDatabaseByName(INDEXED_DB_NAME);
}

async function withStore(storeName, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let resultPromise;

    try {
      const result = run(store);
      const isIdbRequest = typeof IDBRequest !== "undefined" && result instanceof IDBRequest;
      resultPromise = isIdbRequest ? requestToPromise(result) : Promise.resolve(result);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resultPromise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          db.close();
        });
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

async function withStoreWithoutMigration(storeName, mode, run) {
  const db = await openDatabaseWithoutMigration();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let resultPromise;

    try {
      const result = run(store);
      const isIdbRequest = typeof IDBRequest !== "undefined" && result instanceof IDBRequest;
      resultPromise = isIdbRequest ? requestToPromise(result) : Promise.resolve(result);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resultPromise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          db.close();
        });
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

async function withStores(storeNames, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]));
    let resultPromise;

    try {
      resultPromise = Promise.resolve(run(stores));
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resultPromise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          db.close();
        });
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

function normalizeMetadataOnlyText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMetadataOnlyNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function normalizeMetadataOnlyTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 0;
    }

    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return Math.round(numericValue);
    }

    const parsedDate = Date.parse(trimmedValue);
    return Number.isFinite(parsedDate) ? parsedDate : 0;
  }

  return 0;
}

function normalizeMetadataOnlyTags(value) {
  return Array.isArray(value)
    ? value.map((tag) => normalizeMetadataOnlyText(tag)).filter(Boolean)
    : [];
}

function createMetadataOnlyItem(record, excludedById = {}) {
  const strippedRecord = stripItemMediaPayloads(record);
  const id = normalizeMetadataOnlyText(strippedRecord?.id);

  return {
    ...strippedRecord,
    id,
    name: normalizeMetadataOnlyText(strippedRecord?.name || strippedRecord?.title),
    tags: normalizeMetadataOnlyTags(strippedRecord?.tags),
    favorite: Boolean(strippedRecord?.favorite),
    excluded: Boolean(id && excludedById[id]),
    originalFilename: normalizeMetadataOnlyText(strippedRecord?.originalFilename),
    importedAt: normalizeMetadataOnlyTimestamp(strippedRecord?.importedAt),
    createdAt: normalizeMetadataOnlyTimestamp(strippedRecord?.createdAt),
    updatedAt: normalizeMetadataOnlyTimestamp(strippedRecord?.updatedAt),
    fileSize: normalizeMetadataOnlyNumber(strippedRecord?.fileSize),
    mimeType: normalizeMetadataOnlyText(strippedRecord?.mimeType),
    imageWidth: normalizeMetadataOnlyNumber(strippedRecord?.imageWidth),
    imageHeight: normalizeMetadataOnlyNumber(strippedRecord?.imageHeight)
  };
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

async function readMetadataOnlyItemBatch(startAfterKey = undefined, batchSize = 50, excludedById = {}) {
  const db = await openDatabaseWithoutMigration();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ITEM_STORE, "readonly");
    const store = transaction.objectStore(ITEM_STORE);

    if (typeof store.openCursor !== "function") {
      requestToPromise(store.getAll())
        .then((records) => {
          const normalizedRecords = Array.isArray(records) ? records : [];
          const startIndex = startAfterKey === undefined
            ? 0
            : normalizedRecords.findIndex((record) => record?.id === startAfterKey) + 1;
          const batchRecords = normalizedRecords.slice(Math.max(0, startIndex), Math.max(0, startIndex) + batchSize);
          const items = batchRecords.map((record) => createMetadataOnlyItem(record, excludedById)).filter((item) => item.id);
          const lastRecord = batchRecords.at(-1);

          resolve({
            items,
            lastKey: lastRecord?.id ?? startAfterKey,
            hasMore: startIndex + batchSize < normalizedRecords.length
          });
        })
        .catch(reject)
        .finally(() => {
          db.close();
        });
      return;
    }

    const keyRange =
      startAfterKey === undefined ? undefined : IDBKeyRange.lowerBound(startAfterKey, true);
    const request = store.openCursor(keyRange);
    const items = [];
    let lastKey = startAfterKey;

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve({
          items,
          lastKey,
          hasMore: false
        });
        db.close();
        return;
      }

      lastKey = cursor.primaryKey;
      const item = createMetadataOnlyItem(cursor.value, excludedById);

      if (item.id) {
        items.push(item);
      }

      if (items.length >= batchSize) {
        resolve({
          items,
          lastKey,
          hasMore: true
        });
        db.close();
        return;
      }

      cursor.continue();
    };

    request.onerror = () => {
      reject(request.error);
      db.close();
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

async function loadMetadataOnlyItems({
  batchSize = 50,
  excludedById = {},
  onBatch = null
} = {}) {
  const normalizedBatchSize = Math.max(1, Math.round(Number(batchSize) || 50));
  const items = [];
  let lastKey;
  let hasMore = true;

  while (hasMore) {
    const batchResult = await readMetadataOnlyItemBatch(lastKey, normalizedBatchSize, excludedById);
    const batchItems = batchResult.items;

    items.push(...batchItems);
    lastKey = batchResult.lastKey;
    hasMore = batchResult.hasMore;

    if (batchItems.length) {
      await Promise.resolve(
        onBatch?.({
          items: batchItems,
          loaded: items.length,
          hasMore
        })
      );
    }

    if (hasMore) {
      await yieldToBrowser();
    }
  }

  return items;
}

export async function loadStartupItemMetadata(options = {}) {
  return loadMetadataOnlyItems(options);
}

export async function loadSafeModeItemMetadata(options = {}) {
  return loadMetadataOnlyItems(options);
}

export async function loadStartupAppState() {
  const entry = await withStoreWithoutMigration(APP_STORE, "readonly", (store) => store.get("state"));
  return entry?.value ?? null;
}

export async function loadSafeModeAppState() {
  return loadStartupAppState();
}

export async function saveSafeModeAppState(value) {
  await withStoreWithoutMigration(APP_STORE, "readwrite", (store) =>
    store.put({
      key: "state",
      value
    })
  );
}

export async function deleteSafeModeItems(ids = []) {
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];

  if (!normalizedIds.length) {
    return;
  }

  await withStoreWithoutMigration(ITEM_STORE, "readwrite", (store) => {
    normalizedIds.forEach((id) => store.delete(id));
  });
}

export async function loadItemMediaAssetById(itemId, variant = "preview") {
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";

  if (!normalizedItemId) {
    return null;
  }

  const item = await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.get(normalizedItemId));

  if (!item || typeof item !== "object") {
    return null;
  }

  const normalizedImages = normalizeItemImages(item);
  const selectedAsset =
    variant === "original"
      ? normalizedImages.original
      : variant === "thumbnail"
        ? normalizedImages.thumbnail
        : normalizedImages.preview;

  if (selectedAsset?.src) {
    return {
      ...createImageAsset(selectedAsset),
      blob: null
    };
  }

  if (variant === "original" && normalizedImages.originalPreserved && item.itemUuid) {
    const blobEntry = await loadOriginalImageBlobEntry(item.itemUuid);

    if (blobEntry?.blob instanceof Blob) {
      return {
        src: "",
        mimeType: blobEntry.mimeType ?? "",
        width: Math.max(0, Math.round(Number(blobEntry.width) || 0)),
        height: Math.max(0, Math.round(Number(blobEntry.height) || 0)),
        fileSize: Math.max(0, Math.round(Number(blobEntry.fileSize) || 0)),
        originalFilename: typeof blobEntry.originalFilename === "string" ? blobEntry.originalFilename.trim() : "",
        blob: blobEntry.blob
      };
    }
  }

  return null;
}

export async function loadItems() {
  const items = await withStore(ITEM_STORE, "readonly", (store) => store.getAll());

  if (items.length > 0) {
    return items.map(migrateReferenceMetadataToTags);
  }

  await withStore(ITEM_STORE, "readwrite", (store) => {
    defaultWardrobe.map(migrateReferenceMetadataToTags).forEach((item) => store.put(item));
  });

  return defaultWardrobe.map(migrateReferenceMetadataToTags);
}

export async function saveItem(item) {
  const existingItem = typeof item?.id === "string" && item.id.trim()
    ? await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.get(item.id.trim()))
    : null;
  const normalizedIncomingImages = normalizeItemImages(item);
  const hasIncomingMediaPayload = [
    item?.imageUrl,
    normalizedIncomingImages.preview?.src,
    normalizedIncomingImages.thumbnail?.src,
    normalizedIncomingImages.original?.src
  ].some((value) => typeof value === "string" && value.trim());
  const mergedItem =
    existingItem && !hasIncomingMediaPayload
      ? {
          ...existingItem,
          ...item,
          imageUrl: item?.imageUrl || existingItem.imageUrl,
          images: {
            ...existingItem.images,
            ...item?.images,
            original: createImageAsset({
              ...existingItem?.images?.original,
              ...item?.images?.original
            }),
            preview: createImageAsset({
              ...existingItem?.images?.preview,
              ...item?.images?.preview
            }),
            thumbnail: createImageAsset({
              ...existingItem?.images?.thumbnail,
              ...item?.images?.thumbnail
            })
          },
          originalPreserved:
            typeof item?.originalPreserved === "boolean"
              ? item.originalPreserved
              : existingItem.originalPreserved
        }
      : item;

  await withStore(ITEM_STORE, "readwrite", (store) => store.put(mergedItem));

  const stableKey = normalizeSyncText(mergedItem?.itemUuid);

  if (!stableKey) {
    return;
  }

  const [deviceId, existingRecord] = await Promise.all([
    getOrCreateDeviceId(),
    getSyncMetadata(createReferenceSyncMetadataKey(stableKey))
  ]);

  await upsertSyncMetadata(
    createNextDirtySyncMetadataRecord({
      key: createReferenceSyncMetadataKey(stableKey),
      entityType: "mbaReference",
      stableKey,
      localId: normalizeSyncText(mergedItem?.id),
      existingRecord,
      deviceId,
      pendingDelete: false
    })
  );
}

export async function deleteItem(id) {
  const existingItem = await withStore(ITEM_STORE, "readonly", (store) => store.get(id));
  await withStore(ITEM_STORE, "readwrite", (store) => store.delete(id));

  const stableKey = normalizeSyncText(existingItem?.itemUuid);

  if (!stableKey) {
    return;
  }

  const remainingItems = await withStore(ITEM_STORE, "readonly", (store) => store.getAll());
  const matchingItem = (Array.isArray(remainingItems) ? remainingItems : []).find(
    (item) => item?.id !== id && normalizeSyncText(item?.itemUuid) === stableKey
  );

  if (matchingItem) {
    return;
  }

  const [deviceId, existingRecord] = await Promise.all([
    getOrCreateDeviceId(),
    getSyncMetadata(createReferenceSyncMetadataKey(stableKey))
  ]);

  await upsertSyncMetadata(
    createNextDirtySyncMetadataRecord({
      key: createReferenceSyncMetadataKey(stableKey),
      entityType: "mbaReference",
      stableKey,
      localId: normalizeSyncText(existingRecord?.localId) || normalizeSyncText(existingItem?.id),
      existingRecord,
      deviceId,
      pendingDelete: true
    })
  );
}

export async function loadAppState() {
  const entry = await withStore(APP_STORE, "readonly", (store) => store.get("state"));
  return entry?.value ?? null;
}

export async function saveAppState(value, options = {}) {
  const sanitizedValue = sanitizePersistedAppState(value);
  const { approxBytes } = getApproxSerializedBytes(sanitizedValue);

  if (approxBytes > PERSISTED_APP_STATE_MAX_BYTES) {
    return false;
  }

  const hasPreviousAppStateOverride = Object.prototype.hasOwnProperty.call(options, "previousAppState");
  const previousAppState = hasPreviousAppStateOverride
    ? options.previousAppState
    : await loadAppState();

  await withStore(APP_STORE, "readwrite", (store) =>
    store.put({
      key: "state",
      value: sanitizedValue
    })
  );

  const previousSavedBoardsByStableKey = createSavedBoardMetadataByStableKey(previousAppState?.savedOutfits);
  const nextSavedBoardsByStableKey = createSavedBoardMetadataByStableKey(sanitizedValue?.savedOutfits);
  const affectedStableKeys = new Set([
    ...Object.keys(previousSavedBoardsByStableKey),
    ...Object.keys(nextSavedBoardsByStableKey)
  ]);

  if (!affectedStableKeys.size) {
    return true;
  }

  const deviceId = await getOrCreateDeviceId();
  const nextMetadataEntries = await Promise.all(
    [...affectedStableKeys].map(async (stableKey) => {
      const previousSavedBoard = previousSavedBoardsByStableKey[stableKey] ?? null;
      const nextSavedBoard = nextSavedBoardsByStableKey[stableKey] ?? null;

      if (previousSavedBoard && nextSavedBoard && !haveSavedBoardRecordsChanged(previousSavedBoard, nextSavedBoard)) {
        return null;
      }

      const metadataKey = createBoardSyncMetadataKey(stableKey);
      const existingRecord = await getSyncMetadata(metadataKey);

      if (nextSavedBoard) {
        return createNextDirtySyncMetadataRecord({
          key: metadataKey,
          entityType: "mbaBoard",
          stableKey,
          localId: normalizeSyncText(nextSavedBoard.id),
          existingRecord,
          deviceId,
          pendingDelete: false
        });
      }

      return createNextDirtySyncMetadataRecord({
        key: metadataKey,
        entityType: "mbaBoard",
        stableKey,
        localId: normalizeSyncText(previousSavedBoard?.id) || normalizeSyncText(existingRecord?.localId),
        existingRecord,
        deviceId,
        pendingDelete: true
      });
    })
  );

  await Promise.all(nextMetadataEntries.filter(Boolean).map((entry) => upsertSyncMetadata(entry)));
  return true;
}

export async function getOrCreateDeviceId() {
  const existingState = await withStore(SYNC_STATE_STORE, "readonly", (store) => store.get(SYNC_STATE_KEY));
  const normalizedExistingState = normalizeSyncState(existingState);

  if (normalizedExistingState.deviceId) {
    if (JSON.stringify(existingState) !== JSON.stringify(normalizedExistingState)) {
      await withStore(SYNC_STATE_STORE, "readwrite", (store) => store.put(normalizedExistingState));
    }

    return normalizedExistingState.deviceId;
  }

  const nextDeviceId = createDeviceId();
  const nextState = normalizeSyncState(existingState, nextDeviceId);
  await withStore(SYNC_STATE_STORE, "readwrite", (store) =>
    store.put(nextState)
  );
  return nextDeviceId;
}

export async function getSyncMetadata(key = null) {
  if (typeof key === "string") {
    const normalizedKey = normalizeSyncMetadataKey(key);

    if (!normalizedKey) {
      return null;
    }

    const entry = await withStore(SYNC_METADATA_STORE, "readonly", (store) => store.get(normalizedKey));
    return entry ? normalizeSyncMetadataRecord(entry) : null;
  }

  const entries = await withStore(SYNC_METADATA_STORE, "readonly", (store) => store.getAll());
  return entries.map((entry) => normalizeSyncMetadataRecord(entry));
}

export async function upsertSyncMetadata(record) {
  const normalizedRecord = normalizeSyncMetadataRecord(record);
  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.put(normalizedRecord));
  return normalizedRecord;
}

export async function clearSyncMetadata() {
  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.clear());
}

export async function backfillLocalSyncMetadata(items = [], savedOutfits = []) {
  const deviceId = await getOrCreateDeviceId();
  const itemList = Array.isArray(items) ? items : [];
  const savedOutfitList = Array.isArray(savedOutfits) ? savedOutfits : [];
  const existingKeys = new Set();

  await withStore(SYNC_METADATA_STORE, "readonly", async (store) => {
    if (typeof store.openCursor !== "function") {
      const entries = await requestToPromise(store.getAll());
      entries.forEach((entry) => {
        existingKeys.add(normalizeSyncMetadataKey(entry?.key));
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        existingKeys.add(normalizeSyncMetadataKey(cursor.primaryKey));
        cursor.continue();
      };
    });
  });

  const nextMetadataEntries = [];

  for (const item of itemList) {
    const key = createReferenceSyncMetadataKey(item?.itemUuid);

    if (!key || existingKeys.has(key)) {
      continue;
    }

    const nextEntry = buildReferenceSyncMetadata(item, deviceId, null);

    if (!nextEntry) {
      continue;
    }

    existingKeys.add(key);
    nextMetadataEntries.push(nextEntry);
  }

  for (const savedOutfit of savedOutfitList) {
    const boardUuid = normalizeSyncText(savedOutfit?.board?.boardUuid)
      || normalizeSyncText(ensureSavedBoardUuid(savedOutfit)?.board?.boardUuid);
    const key = createBoardSyncMetadataKey(boardUuid);

    if (!key || existingKeys.has(key)) {
      continue;
    }

    const nextEntry = buildSavedBoardSyncMetadata(savedOutfit, deviceId, null);

    if (!nextEntry) {
      continue;
    }

    existingKeys.add(key);
    nextMetadataEntries.push(nextEntry);
  }

  if (!nextMetadataEntries.length) {
    return {
      deviceId,
      createdCount: 0
    };
  }

  let createdCount = 0;

  for (let index = 0; index < nextMetadataEntries.length; index += SYNC_BACKFILL_BATCH_SIZE) {
    const batch = nextMetadataEntries.slice(index, index + SYNC_BACKFILL_BATCH_SIZE);

    await withStore(SYNC_METADATA_STORE, "readwrite", (store) => {
      batch.forEach((entry) => store.put(entry));
    });

    createdCount += batch.length;

    if (index + SYNC_BACKFILL_BATCH_SIZE < nextMetadataEntries.length) {
      await yieldToBrowser();
    }
  }

  return {
    deviceId,
    createdCount
  };
}

function normalizeBackupAppState(appState) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    throw new Error("Backup app state is invalid.");
  }

  const normalizedBoard = ensureBoardUuid(appState.board);

  return {
    ...appState,
    ...(normalizedBoard === undefined ? {} : { board: normalizedBoard }),
    savedOutfits: Array.isArray(appState.savedOutfits) ? appState.savedOutfits.map(ensureSavedBoardUuid) : appState.savedOutfits,
    recentOutfits: []
  };
}

function prepareBackupItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Backup items are invalid.");
  }

  const seenIds = new Set();

  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Backup item ${index + 1} is invalid.`);
    }

    if (typeof item.id !== "string" || !item.id.trim()) {
      throw new Error(`Backup item ${index + 1} is missing an id.`);
    }

    if (seenIds.has(item.id)) {
      throw new Error(`Backup item id "${item.id}" is duplicated.`);
    }

    seenIds.add(item.id);
    return migrateReferenceMetadataToTags(item);
  });
}

export function createLightweightBackupData(items, appState) {
  return {
    source: BACKUP_SOURCE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: (Array.isArray(items) ? items : []).map((item) => sanitizeBackupReference(item)),
    appState: stripLocalOnlyAppState(appState)
  };
}

export function prepareBackupImport(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    throw new Error("Backup payload is invalid.");
  }

  if (!SUPPORTED_BACKUP_SOURCES.includes(backup.source)) {
    throw new Error("Backup source is invalid.");
  }

  if (!SUPPORTED_BACKUP_VERSIONS.includes(backup.version)) {
    throw new Error("Backup version is not supported.");
  }

  return {
    source: backup.source,
    version: backup.version,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "",
    items: prepareBackupItems(backup.items),
    appState: normalizeBackupAppState(backup.appState)
  };
}

export async function exportBackup() {
  const [items, appState] = await Promise.all([loadItems(), loadAppState()]);
  return createLightweightBackupData(items, appState);
}

export async function replaceWithPreparedBackup(backup) {
  await withStores(
    [ITEM_STORE, APP_STORE, ORIGINAL_STORE, SYNC_METADATA_STORE],
    "readwrite",
    ({ items, appState, originalImageBlobs, syncMetadata }) => {
    items.clear();
    appState.clear();
    originalImageBlobs.clear();
    syncMetadata.clear();

    backup.items.forEach((item) => items.put(item));
    appState.put({
      key: "state",
      value: backup.appState
    });
    }
  );

  await backfillLocalSyncMetadata(backup.items, backup.appState?.savedOutfits ?? []);
}

export async function replaceWithBackup(backup) {
  return replaceWithPreparedBackup(prepareBackupImport(backup));
}

export async function saveOriginalImageBlob(itemUuid, blob, metadata = {}) {
  if (typeof itemUuid !== "string" || !itemUuid.trim()) {
    throw new Error("Original image blob is missing an itemUuid.");
  }

  if (!(blob instanceof Blob)) {
    throw new Error("Original image blob is invalid.");
  }

  const entry = {
    itemUuid: itemUuid.trim(),
    blob,
    mimeType: typeof metadata.mimeType === "string" ? metadata.mimeType.trim() : "",
    width: Math.max(0, Math.round(Number(metadata.width) || 0)),
    height: Math.max(0, Math.round(Number(metadata.height) || 0)),
    fileSize: Math.max(0, Math.round(Number(metadata.fileSize) || blob.size || 0)),
    originalFilename: typeof metadata.originalFilename === "string" ? metadata.originalFilename.trim() : "",
    savedAt: Date.now()
  };

  await withStore(ORIGINAL_STORE, "readwrite", (store) => store.put(entry));
  return entry;
}

export async function loadOriginalImageBlobEntry(itemUuid) {
  if (typeof itemUuid !== "string" || !itemUuid.trim()) {
    return null;
  }

  return withStore(ORIGINAL_STORE, "readonly", (store) => store.get(itemUuid.trim()));
}

export async function loadOriginalImageBlob(itemUuid) {
  const entry = await loadOriginalImageBlobEntry(itemUuid);
  return entry?.blob ?? null;
}

export async function hasOriginalImageBlob(itemUuid) {
  return Boolean(await loadOriginalImageBlob(itemUuid));
}

export async function deleteOriginalImageBlob(itemUuid) {
  if (typeof itemUuid !== "string" || !itemUuid.trim()) {
    return;
  }

  await withStore(ORIGINAL_STORE, "readwrite", (store) => store.delete(itemUuid.trim()));
}

export async function loadOriginalImageBlobUrl(itemUuid) {
  const blob = await loadOriginalImageBlob(itemUuid);

  if (!blob || typeof URL?.createObjectURL !== "function") {
    return "";
  }

  return URL.createObjectURL(blob);
}

export function getDefaultData() {
  return {
    items: cloneData(defaultWardrobe).map(migrateReferenceMetadataToTags),
    appState: cloneData(defaultAppState)
  };
}

export async function resetToDefaults() {
  const defaultData = getDefaultData();
  await replaceWithPreparedBackup({
    items: defaultData.items,
    appState: {
      ...defaultData.appState,
      recentOutfits: []
    }
  });
  return defaultData;
}

export function __setIndexedDbFactoryForTests(factory) {
  indexedDbFactory = typeof factory === "function" ? factory : () => globalThis.indexedDB;
  databaseReadyPromise = null;
}
