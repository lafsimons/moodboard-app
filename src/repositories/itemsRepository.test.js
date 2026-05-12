import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { __setIndexedDbFactoryForTests } from "../lib/storage.js";
import { loadItems, prepareLoadedItems, saveItem } from "./itemsRepository.js";

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

function createDependencies(overrides = {}) {
  return {
    normalizeItem: (item) => ({ ...item, normalized: true }),
    restoreLegacyBakedImageScale: (item) => ({ ...item, restored: true }),
    applyMappedStyleWeightDefaults: (item) => ({ ...item, mapped: true }),
    bakeItemImagePresentation: async (item) => ({ ...item, baked: true }),
    itemDefaultsMigrationVersion: 2,
    imagePresentationMigrationVersion: 3,
    itemNeedsRetailMigration: () => false,
    itemNeedsImageFrameScaleMigration: () => false,
    itemNeedsImageScaleMigration: () => false,
    itemNeedsImageOffsetMigration: () => false,
    itemNeedsImageCropMigration: () => false,
    itemNeedsFavoriteMigration: () => false,
    itemNeedsQuantityMigration: () => false,
    itemNeedsColorMigration: () => false,
    itemNeedsWeightMigration: () => false,
    itemNeedsGarmentTypeMigration: () => false,
    itemNeedsTagMigration: () => false,
    itemNeedsClimateTagMigration: () => false,
    itemNeedsDefaultMetadataMigration: () => false,
    itemNeedsMoodboardMetadataMigration: () => false,
    itemNeedsImageAssetMigration: () => false,
    itemNeedsStyleWeightMappingMigration: (originalItem, normalizedItem) =>
      !originalItem.mapped && Boolean(normalizedItem.mapped),
    ...overrides
  };
}

test("prepareLoadedItems applies bootstrap migrations and persists migrated items", async () => {
  installFakeIndexedDb();
  await saveItem({ id: "item-1", mapped: false });

  const result = await prepareLoadedItems(
    [{ id: "item-1", mapped: false }],
    {
      itemDefaultsMigrationVersion: 0,
      imagePresentationMigrationVersion: 0
    },
    createDependencies(),
    {
      includeWeightMigration: false,
      includeTagMigration: false,
      includeStyleWeightMappingMigration: true
    }
  );

  assert.deepEqual(result.items[0], {
    id: "item-1",
    mapped: true,
    normalized: true,
    restored: true,
    baked: true
  });

  const [persistedItem] = await loadItems();
  assert.equal(persistedItem.id, "item-1");
  assert.equal(persistedItem.mapped, true);
  assert.equal(persistedItem.normalized, true);
  assert.equal(persistedItem.restored, true);
  assert.equal(persistedItem.baked, true);
});

test("prepareLoadedItems can persist import-time image asset migrations without style-weight remapping", async () => {
  installFakeIndexedDb();
  await saveItem({ id: "item-2", assetState: "legacy" });

  const result = await prepareLoadedItems(
    [{ id: "item-2", assetState: "legacy" }],
    {
      itemDefaultsMigrationVersion: 2,
      imagePresentationMigrationVersion: 3
    },
    createDependencies({
      normalizeItem: (item) => ({ ...item, assetState: "fixed" }),
      restoreLegacyBakedImageScale: (item) => item,
      applyMappedStyleWeightDefaults: (item) => ({ ...item, mapped: true }),
      bakeItemImagePresentation: async (item) => item,
      itemNeedsImageAssetMigration: (originalItem, normalizedItem) =>
        originalItem.assetState !== normalizedItem.assetState
    }),
    {
      includeImageAssetMigration: true
    }
  );

  assert.equal(result.items[0].assetState, "fixed");
  assert.equal(result.items[0].mapped, undefined);

  const [persistedItem] = await loadItems();
  assert.equal(persistedItem.id, "item-2");
  assert.equal(persistedItem.assetState, "fixed");
  assert.equal(persistedItem.mapped, undefined);
});
