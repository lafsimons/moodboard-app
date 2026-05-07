import defaultWardrobe from "../data/defaultWardrobe";
import defaultAppState from "../data/defaultAppState";
import { migrateReferenceMetadataToTags, sanitizeExportedReference } from "./metadata";

const DB_NAME = "outfit-app-db";
const DB_VERSION = 1;
export const BACKUP_VERSION = 2;
const ITEM_STORE = "items";
const APP_STORE = "appState";

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

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        db.createObjectStore(ITEM_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(APP_STORE)) {
        db.createObjectStore(APP_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let resultPromise;

    try {
      const result = run(store);
      resultPromise = result instanceof IDBRequest ? requestToPromise(result) : Promise.resolve(result);
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

export async function exportBackup() {
  const [items, appState] = await Promise.all([loadItems(), loadAppState()]);

  return {
    source: "outfit-app",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map(sanitizeExportedReference),
    appState: stripLocalOnlyAppState(appState)
  };
}

export async function replaceWithBackup(backup) {
  await withStores([ITEM_STORE, APP_STORE], "readwrite", ({ items, appState }) => {
    items.clear();
    appState.clear();

    backup.items.map(migrateReferenceMetadataToTags).forEach((item) => items.put(item));
    appState.put({
      key: "state",
      value: {
        ...(backup.appState ?? {}),
        recentOutfits: []
      }
    });
  });
}

export function getDefaultData() {
  return {
    items: cloneData(defaultWardrobe).map(migrateReferenceMetadataToTags),
    appState: cloneData(defaultAppState)
  };
}

export async function resetToDefaults() {
  await replaceWithBackup(getDefaultData());
  return getDefaultData();
}
