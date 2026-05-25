import {
  deleteItem as deleteStoredItem,
  deleteItems as deleteStoredItems,
  loadItemMediaAssetById as loadStoredItemMediaAssetById,
  loadItems as loadStoredItems,
  loadStartupItemMetadata as loadStoredStartupItemMetadata,
  saveItem as saveStoredItem
} from "../lib/storage.js";
import { normalizeItemImages } from "../lib/itemImages.js";

export async function loadItems() {
  return loadStoredItems();
}

export async function loadStartupItemMetadata(options = {}) {
  return loadStoredStartupItemMetadata(options);
}

export async function loadItemMediaAssetById(itemId, variant = "preview") {
  return loadStoredItemMediaAssetById(itemId, variant);
}

function readBlobAsDataUrl(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const base64Payload =
      typeof Buffer !== "undefined"
        ? Buffer.from(buffer).toString("base64")
        : globalThis.btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeType = typeof blob.type === "string" ? blob.type : "application/octet-stream";

    return `data:${mimeType};base64,${base64Payload}`;
  });
}

function getRequestedAsset(images, variant = "preview") {
  if (variant === "original") {
    return images.original;
  }

  if (variant === "thumbnail") {
    return images.thumbnail;
  }

  return images.preview;
}

export async function resolveItemMediaSource(itemOrId, variant = "preview", options = {}) {
  const normalizedVariant = variant === "original" ? "original" : variant === "thumbnail" ? "thumbnail" : "preview";
  const item = itemOrId && typeof itemOrId === "object" ? itemOrId : null;
  const itemId = typeof itemOrId === "string"
    ? itemOrId.trim()
    : typeof item?.id === "string"
      ? item.id.trim()
      : "";
  const {
    preferDataUrl = false
  } = options;
  const normalizedImages = normalizeItemImages(item);
  const selectedAsset = getRequestedAsset(normalizedImages, normalizedVariant);

  if (selectedAsset?.src) {
    return {
      ...selectedAsset,
      src: selectedAsset.src,
      blob: null,
      revoke: null
    };
  }

  if (!itemId) {
    return {
      src: "",
      blob: null,
      revoke: null,
      width: 0,
      height: 0,
      fileSize: 0,
      mimeType: "",
      originalFilename: ""
    };
  }

  const asset = await loadStoredItemMediaAssetById(itemId, normalizedVariant);

  if (!asset) {
    return {
      src: "",
      blob: null,
      revoke: null,
      width: 0,
      height: 0,
      fileSize: 0,
      mimeType: "",
      originalFilename: ""
    };
  }

  if (asset.src) {
    return {
      ...asset,
      src: asset.src,
      revoke: null
    };
  }

  if (!(asset.blob instanceof Blob)) {
    return {
      ...asset,
      src: "",
      revoke: null
    };
  }

  if (preferDataUrl) {
    return {
      ...asset,
      src: await readBlobAsDataUrl(asset.blob),
      revoke: null
    };
  }

  if (typeof URL?.createObjectURL === "function") {
    const objectUrl = URL.createObjectURL(asset.blob);

    return {
      ...asset,
      src: objectUrl,
      revoke: () => {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }

  return {
    ...asset,
    src: "",
    revoke: null
  };
}

export async function saveItem(item) {
  return saveStoredItem(item);
}

export async function saveItems(items) {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  await Promise.all(normalizedItems.map((item) => saveStoredItem(item)));
}

export async function deleteItem(id) {
  return deleteStoredItem(id);
}

export async function deleteItems(ids) {
  return deleteStoredItems(ids);
}

function getMigrationState(appState, dependencies) {
  return {
    shouldApplyStyleWeightMigration:
      (appState?.itemDefaultsMigrationVersion ?? 0) < dependencies.itemDefaultsMigrationVersion,
    shouldApplyImagePresentationMigration:
      (appState?.imagePresentationMigrationVersion ?? 0) < dependencies.imagePresentationMigrationVersion
  };
}

function getMigrationPredicate(originalItem, normalizedItem, options, dependencies, migrationState) {
  return (
    dependencies.itemNeedsRetailMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageFrameScaleMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageScaleMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageOffsetMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageCropMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsFavoriteMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsQuantityMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsColorMigration(originalItem, normalizedItem) ||
    (options.includeWeightMigration && dependencies.itemNeedsWeightMigration(originalItem, normalizedItem)) ||
    dependencies.itemNeedsGarmentTypeMigration(originalItem, normalizedItem) ||
    (options.includeTagMigration && dependencies.itemNeedsTagMigration(originalItem, normalizedItem)) ||
    dependencies.itemNeedsClimateTagMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsDefaultMetadataMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsMoodboardMetadataMigration(originalItem, normalizedItem) ||
    (options.includeImageAssetMigration && dependencies.itemNeedsImageAssetMigration(originalItem, normalizedItem)) ||
    (migrationState.shouldApplyStyleWeightMigration &&
      options.includeStyleWeightMappingMigration &&
      dependencies.itemNeedsStyleWeightMappingMigration(originalItem, normalizedItem))
  );
}

export async function prepareLoadedItems(items, appState, dependencies, options = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedOptions = {
    includeWeightMigration: true,
    includeTagMigration: true,
    includeImageAssetMigration: false,
    includeStyleWeightMappingMigration: false,
    disableAutoMigrations: false,
    ...options
  };
  const migrationState = normalizedOptions.disableAutoMigrations
    ? {
        shouldApplyStyleWeightMigration: false,
        shouldApplyImagePresentationMigration: false
      }
    : getMigrationState(appState, dependencies);

  const itemsAfterNormalization = normalizedItems
    .map(dependencies.normalizeItem)
    .map((item) =>
      migrationState.shouldApplyImagePresentationMigration ? dependencies.restoreLegacyBakedImageScale(item) : item
    );
  const itemsAfterDefaults =
    migrationState.shouldApplyStyleWeightMigration && normalizedOptions.includeStyleWeightMappingMigration
      ? itemsAfterNormalization.map(dependencies.applyMappedStyleWeightDefaults)
      : itemsAfterNormalization;
  const preparedItems = migrationState.shouldApplyImagePresentationMigration
    ? await Promise.all(itemsAfterDefaults.map((item) => dependencies.bakeItemImagePresentation(item)))
    : itemsAfterDefaults;
  const migratedItems = preparedItems.filter((item, index) =>
    getMigrationPredicate(normalizedItems[index], item, normalizedOptions, dependencies, migrationState)
  );

  if (migratedItems.length && !normalizedOptions.disableAutoMigrations) {
    await saveItems(migratedItems);
  }

  return {
    items: preparedItems,
    migratedItems,
    migrationState
  };
}
