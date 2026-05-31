import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __setIndexedDbFactoryForTests,
  replaceWithPreparedBackupPackage
} from "../lib/storage.js";
import { INDEXED_DB_NAME } from "../lib/appIdentity.js";
import {
  loadItemMediaAssetById,
  loadItems,
  loadStartupItemMetadata,
  prepareLoadedItems,
  resolveItemMediaSource,
  saveItem
} from "./itemsRepository.js";

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

function seedStore(indexedDb, storeName, keyPath, records) {
  const database = indexedDb.database ?? new FakeDatabase(4);

  if (!indexedDb.database) {
    indexedDb.database = database;
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

test("prepareLoadedItems disables automatic migrations when requested", async () => {
  installFakeIndexedDb();
  await saveItem({ id: "item-3", mapped: false });

  let bakedCallCount = 0;

  const result = await prepareLoadedItems(
    [{ id: "item-3", mapped: false }],
    {
      itemDefaultsMigrationVersion: 0,
      imagePresentationMigrationVersion: 0
    },
    createDependencies({
      restoreLegacyBakedImageScale: (item) => ({ ...item, restored: true }),
      applyMappedStyleWeightDefaults: (item) => ({ ...item, mapped: true }),
      bakeItemImagePresentation: async (item) => {
        bakedCallCount += 1;
        return { ...item, baked: true };
      },
      itemNeedsImageFrameScaleMigration: () => true
    }),
    {
      disableAutoMigrations: true,
      includeStyleWeightMappingMigration: true,
      includeImageAssetMigration: true
    }
  );

  assert.deepEqual(result.items[0], {
    id: "item-3",
    mapped: false,
    normalized: true
  });
  assert.equal(result.migratedItems.length, 1);
  assert.equal(bakedCallCount, 0);

  const [persistedItem] = await loadItems();
  assert.equal(persistedItem.id, "item-3");
  assert.equal(persistedItem.mapped, false);
  assert.equal(persistedItem.baked, undefined);
  assert.equal(persistedItem.restored, undefined);
});

test("loadStartupItemMetadata strips image payloads while keeping image metadata available", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-4",
    itemUuid: "uuid-4",
    name: "Item 4",
    imageUrl: "data:image/png;base64,preview",
    imageWidth: 1200,
    imageHeight: 800,
    originalFilename: "look.png",
    images: {
      preview: {
        src: "data:image/png;base64,preview",
        width: 1200,
        height: 800
      },
      thumbnail: {
        src: "data:image/png;base64,thumb",
        width: 300,
        height: 200
      }
    }
  });

  const [item] = await loadStartupItemMetadata();

  assert.equal(item.id, "item-4");
  assert.equal(item.imageUrl, "");
  assert.equal(item.images.preview.src, "");
  assert.equal(item.images.thumbnail.src, "");
  assert.equal(item.imageWidth, 1200);
  assert.equal(item.imageHeight, 800);
  assert.equal(item.originalFilename, "look.png");
});

test("loadItemMediaAssetById reads persisted media payloads for metadata-only startup items", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-5",
    itemUuid: "uuid-5",
    imageUrl: "",
    images: {
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 640,
        height: 480
      }
    }
  });

  const asset = await loadItemMediaAssetById("item-5", "preview");

  assert.equal(asset.src, "data:image/webp;base64,preview");
  assert.equal(asset.mimeType, "image/webp");
  assert.equal(asset.width, 640);
  assert.equal(asset.height, 480);
});

test("resolveItemMediaSource resolves out-of-line media for metadata-only items", async () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let revokedUrl = "";
  URL.createObjectURL = () => "blob:resolved-original";
  URL.revokeObjectURL = (value) => {
    revokedUrl = value;
  };

  try {
    installFakeIndexedDb();
    await saveItem({
      id: "item-6",
      itemUuid: "uuid-6",
      originalPreserved: true,
      images: {
        original: {
          src: "data:image/png;base64,b3JpZw==",
          mimeType: "image/png",
          width: 1200,
          height: 800,
          originalFilename: "look.png"
        },
        preview: {
          src: "data:image/webp;base64,cHJldmlldw==",
          mimeType: "image/webp",
          width: 640,
          height: 480,
          originalFilename: "look.png"
        }
      }
    });

    const [metadataOnlyItem] = await loadStartupItemMetadata();
    const previewMedia = await resolveItemMediaSource(metadataOnlyItem, "preview");
    const originalMedia = await resolveItemMediaSource(metadataOnlyItem, "original");
    const originalDataUrlMedia = await resolveItemMediaSource(metadataOnlyItem, "original", { preferDataUrl: true });

    assert.equal(previewMedia.src, "data:image/webp;base64,cHJldmlldw==");
    assert.equal(previewMedia.width, 640);
    assert.equal(previewMedia.revoke, null);
    assert.equal(originalMedia.src, "blob:resolved-original");
    assert.equal(originalMedia.blob instanceof Blob, true);
    assert.equal(typeof originalMedia.revoke, "function");
    originalMedia.revoke();
    assert.equal(revokedUrl, "blob:resolved-original");
    assert.equal(originalDataUrlMedia.src, "data:image/png;base64,b3JpZw==");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});

test("metadata-only edited references stay metadata-only and still resolve preview media after save", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-save-tags",
    itemUuid: "uuid-save-tags",
    name: "Before",
    tags: [],
    imageUrl: "data:image/webp;base64,preview-save-tags",
    images: {
      preview: {
        src: "data:image/webp;base64,preview-save-tags",
        mimeType: "image/webp",
        width: 640,
        height: 480
      }
    }
  });

  await saveItem({
    id: "item-save-tags",
    itemUuid: "uuid-save-tags",
    name: "Before",
    tags: ["archive"],
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

  const [metadataOnlyItem] = await loadStartupItemMetadata();
  const resolvedPreviewMedia = await resolveItemMediaSource(metadataOnlyItem, "preview");
  const [runtimeItem] = await loadItems();

  assert.deepEqual(metadataOnlyItem.tags, ["archive"]);
  assert.equal(metadataOnlyItem.imageUrl, "");
  assert.equal(metadataOnlyItem.images.preview.src, "");
  assert.deepEqual(runtimeItem.tags, ["archive"]);
  assert.equal(runtimeItem.imageUrl, "");
  assert.equal(runtimeItem.images.preview.src, "");
  assert.equal(resolvedPreviewMedia.src, "data:image/webp;base64,preview-save-tags");
  assert.equal(resolvedPreviewMedia.width, 640);
  assert.equal(resolvedPreviewMedia.height, 480);
});

test("metadata-only edits return a saved item with preserved image-bearing fields", async () => {
  installFakeIndexedDb();
  await saveItem({
    id: "item-preserve-fields",
    itemUuid: "uuid-preserve-fields",
    name: "Before",
    description: "Old",
    tags: ["one"],
    imageUrl: "data:image/webp;base64,preview-preserve-fields",
    mimeType: "image/webp",
    imageWidth: 640,
    imageHeight: 480,
    fileSize: 1234,
    originalFilename: "preserve.webp",
    originalPreserved: true,
    images: {
      original: {
        src: "data:image/jpeg;base64,original-preserve-fields",
        mimeType: "image/jpeg",
        width: 2000,
        height: 1500,
        originalFilename: "preserve-original.jpg"
      },
      preview: {
        src: "data:image/webp;base64,preview-preserve-fields",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        fileSize: 1234,
        originalFilename: "preserve.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb-preserve-fields",
        mimeType: "image/webp",
        width: 320,
        height: 240,
        fileSize: 345,
        originalFilename: "preserve-thumb.webp"
      }
    }
  });

  const savedItem = await saveItem({
    id: "item-preserve-fields",
    itemUuid: "uuid-preserve-fields",
    name: "After",
    description: "New",
    tags: ["one", "two"],
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

  assert.equal(savedItem.name, "After");
  assert.equal(savedItem.description, "New");
  assert.deepEqual(savedItem.tags, ["one", "two"]);
  assert.equal(savedItem.imageUrl, "data:image/webp;base64,preview-preserve-fields");
  assert.equal(savedItem.mimeType, "image/webp");
  assert.equal(savedItem.imageWidth, 640);
  assert.equal(savedItem.imageHeight, 480);
  assert.equal(savedItem.fileSize, 1234);
  assert.equal(savedItem.originalFilename, "preserve.webp");
  assert.equal(savedItem.originalPreserved, true);
  assert.equal(savedItem.images.original.src, "");
  assert.equal(savedItem.images.original.mimeType, "image/jpeg");
  assert.equal(savedItem.images.original.width, 2000);
  assert.equal(savedItem.images.original.height, 1500);
  assert.equal(savedItem.images.original.originalFilename, "preserve-original.jpg");
  assert.equal(savedItem.images.preview.src, "data:image/webp;base64,preview-preserve-fields");
  assert.equal(savedItem.images.thumbnail.src, "data:image/webp;base64,thumb-preserve-fields");
  assert.equal(savedItem.images.thumbnail.originalFilename, "preserve-thumb.webp");
});

test("rename plus tag edit preserves resolved blob-backed preview media for imported items", async () => {
  const indexedDb = installFakeIndexedDb();

  await replaceWithPreparedBackupPackage({
    source: "moodboard-app-package",
    version: 1,
    exportedAt: "2026-05-31T10:00:00.000Z",
    items: [
      {
        id: "item-imported",
        itemUuid: "uuid-imported",
        name: "Before",
        tags: [],
        originalFilename: "imported.webp",
        images: {
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            originalFilename: "imported.webp"
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    itemMediaAssets: [
      {
        itemId: "item-imported",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 640,
          height: 480,
          originalFilename: "imported.webp",
          blob: new Blob(["repo-preview"], { type: "image/webp" })
        }
      }
    ]
  });

  await saveItem({
    id: "item-imported",
    itemUuid: "uuid-imported",
    name: "After",
    tags: ["archive"]
  });

  const [metadataOnlyItem] = await loadStartupItemMetadata();
  const [runtimeItem] = await loadItems();
  const resolvedPreviewMedia = await resolveItemMediaSource(metadataOnlyItem, "preview", { preferDataUrl: true });

  assert.equal(metadataOnlyItem.id, "item-imported");
  assert.equal(metadataOnlyItem.itemUuid, "uuid-imported");
  assert.equal(metadataOnlyItem.originalFilename, "imported.webp");
  assert.deepEqual(metadataOnlyItem.tags, ["archive"]);
  assert.equal(runtimeItem.name, "After");
  assert.deepEqual(runtimeItem.tags, ["archive"]);
  assert.equal(resolvedPreviewMedia.src, "data:image/webp;base64,cmVwby1wcmV2aWV3");
  assert.equal(indexedDb.database.stores.get("itemMediaAssets").records.size, 1);
});

test("repeated metadata-only repository saves keep blob-backed preview ownership stable", async () => {
  const indexedDb = installFakeIndexedDb();

  await replaceWithPreparedBackupPackage({
    source: "moodboard-app-package",
    version: 1,
    exportedAt: "2026-05-31T10:00:00.000Z",
    items: [
      {
        id: "item-repeat",
        itemUuid: "uuid-repeat",
        name: "Before",
        originalFilename: "repeat.webp",
        images: {
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            originalFilename: "repeat.webp"
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    itemMediaAssets: [
      {
        itemId: "item-repeat",
        variant: "preview",
        asset: {
          src: "",
          mimeType: "image/webp",
          width: 640,
          height: 480,
          originalFilename: "repeat.webp",
          blob: new Blob(["repeat-preview"], { type: "image/webp" })
        }
      }
    ]
  });

  await saveItem({
    id: "item-repeat",
    itemUuid: "uuid-repeat",
    name: "First rename"
  });
  await saveItem({
    id: "item-repeat",
    itemUuid: "uuid-repeat",
    name: "Second rename",
    description: "metadata only"
  });

  const [metadataOnlyItem] = await loadStartupItemMetadata();
  const resolvedPreviewMedia = await resolveItemMediaSource(metadataOnlyItem, "preview", { preferDataUrl: true });

  assert.equal(metadataOnlyItem.id, "item-repeat");
  assert.equal(metadataOnlyItem.itemUuid, "uuid-repeat");
  assert.equal(indexedDb.database.stores.get("itemMediaAssets").records.size, 1);
  assert.equal(resolvedPreviewMedia.src, "data:image/webp;base64,cmVwZWF0LXByZXZpZXc=");
});

test("resolveItemMediaSource creates an object URL for blob-backed preview assets restored by scalable package import", async () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let revokedUrl = "";
  URL.createObjectURL = () => "blob:resolved-package-preview";
  URL.revokeObjectURL = (value) => {
    revokedUrl = value;
  };

  try {
    installFakeIndexedDb();

    await replaceWithPreparedBackupPackage({
      source: "moodboard-app-package",
      version: 1,
      exportedAt: "2026-05-25T12:00:00.000Z",
      items: [
        {
          id: "item-package",
          itemUuid: "uuid-package",
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
          itemId: "item-package",
          variant: "preview",
          asset: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            originalFilename: "preview.webp",
            blob: new Blob(["package-preview"], { type: "image/webp" })
          }
        }
      ]
    });

    const [metadataOnlyItem] = await loadStartupItemMetadata();
    const previewMedia = await resolveItemMediaSource(metadataOnlyItem, "preview");

    assert.equal(previewMedia.src, "blob:resolved-package-preview");
    assert.equal(previewMedia.blob instanceof Blob, true);
    assert.equal(typeof previewMedia.revoke, "function");
    previewMedia.revoke();
    assert.equal(revokedUrl, "blob:resolved-package-preview");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});

test("resolveItemMediaSource preserves legacy inline media fallback", async () => {
  const indexedDb = installFakeIndexedDb();
  indexedDb.open(INDEXED_DB_NAME, 4);
  seedStore(indexedDb, "items", "id", [
    {
      id: "legacy-inline",
      imageUrl: "data:image/png;base64,bGVnYWN5",
      mimeType: "image/png",
      imageWidth: 900,
      imageHeight: 600,
      originalFilename: "legacy.png"
    }
  ]);

  const media = await resolveItemMediaSource({ id: "legacy-inline" }, "preview");

  assert.equal(media.src, "data:image/png;base64,bGVnYWN5");
  assert.equal(media.mimeType, "image/png");
  assert.equal(media.width, 900);
  assert.equal(media.height, 600);
});
