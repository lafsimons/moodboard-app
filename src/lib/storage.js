import defaultWardrobe from "../data/defaultWardrobe.js";
import defaultAppState from "../data/defaultAppState.js";
import {
  BACKUP_SOURCE,
  INDEXED_DB_NAME,
  LEGACY_INDEXED_DB_NAME,
  SUPPORTED_BACKUP_SOURCES,
  SUPPORTED_BACKUP_VERSIONS
} from "./appIdentity.js";
import { migrateReferenceMetadataToTags, sanitizeBackupReference } from "./metadata.js";

const DB_VERSION = 2;
export const BACKUP_VERSION = 2;
const ITEM_STORE = "items";
const APP_STORE = "appState";
const ORIGINAL_STORE = "originalImageBlobs";
const MIGRATED_STORES = [ITEM_STORE, APP_STORE, ORIGINAL_STORE];

let indexedDbFactory = () => globalThis.indexedDB;
let databaseReadyPromise = null;

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
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

async function withStores(storeNames, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]));

    try {
      run(stores);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resolve();
      db.close();
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
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
  await withStore(ITEM_STORE, "readwrite", (store) => store.put(item));
}

export async function deleteItem(id) {
  await withStore(ITEM_STORE, "readwrite", (store) => store.delete(id));
}

export async function loadAppState() {
  const entry = await withStore(APP_STORE, "readonly", (store) => store.get("state"));
  return entry?.value ?? null;
}

export async function saveAppState(value) {
  await withStore(APP_STORE, "readwrite", (store) =>
    store.put({
      key: "state",
      value
    })
  );
}

function normalizeBackupAppState(appState) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    throw new Error("Backup app state is invalid.");
  }

  return {
    ...appState,
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
  await withStores([ITEM_STORE, APP_STORE, ORIGINAL_STORE], "readwrite", ({ items, appState, originalImageBlobs }) => {
    items.clear();
    appState.clear();
    originalImageBlobs.clear();

    backup.items.forEach((item) => items.put(item));
    appState.put({
      key: "state",
      value: backup.appState
    });
  });
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
