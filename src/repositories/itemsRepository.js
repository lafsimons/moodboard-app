import {
  createMetadataSnapshot,
  deleteItem as deleteStoredItem,
  deleteItems as deleteStoredItems,
  deleteOriginalImageBlob,
  loadItemMediaAssetById as loadStoredItemMediaAssetById,
  loadMediaIntegritySnapshot as loadStoredMediaIntegritySnapshot,
  loadItems as loadStoredItems,
  loadOriginalImageBlobEntry,
  loadStartupAppState as loadStoredStartupAppState,
  loadStartupItemMetadata as loadStoredStartupItemMetadata,
  saveOriginalImageBlob,
  saveItem as saveStoredItem
} from "../lib/storage.js";
import { runMediaIntegrityCheck as analyzeStoredMediaIntegrity } from "../lib/mediaIntegrity.js";
import { normalizeItemImages } from "../lib/itemImages.js";
import {
  appendOriginalReconnectionAlias,
  buildOriginalReconnectionReview,
  classifyOriginalAvailability as classifyOriginalAvailabilityState
} from "../lib/originalReconnection.js";

export async function loadItems() {
  return loadStoredItems();
}

export async function loadStartupItemMetadata(options = {}) {
  return loadStoredStartupItemMetadata(options);
}

export async function loadItemMediaAssetById(itemId, variant = "preview") {
  const asset = await loadStoredItemMediaAssetById(itemId, variant);

  if (!asset) {
    return null;
  }

  return {
    ...asset,
    resolvedFromVariant: variant === "original" ? "original" : variant === "thumbnail" ? "thumbnail" : "preview",
    missingOriginal: false
  };
}

export async function runMediaIntegrityCheck() {
  return analyzeStoredMediaIntegrity(loadStoredMediaIntegritySnapshot);
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

async function materializeResolvedAsset(asset, options = {}) {
  const normalizedAsset = asset && typeof asset === "object"
    ? asset
    : {
        src: "",
        blob: null,
        width: 0,
        height: 0,
        fileSize: 0,
        mimeType: "",
        originalFilename: ""
      };
  const {
    preferDataUrl = false,
    missingOriginal = false,
    resolvedFromVariant = "preview"
  } = options;

  if (normalizedAsset.src) {
    return {
      ...normalizedAsset,
      src: normalizedAsset.src,
      revoke: null,
      missingOriginal,
      resolvedFromVariant
    };
  }

  if (!(normalizedAsset.blob instanceof Blob)) {
    return {
      ...normalizedAsset,
      src: "",
      revoke: null,
      missingOriginal,
      resolvedFromVariant
    };
  }

  if (preferDataUrl) {
    return {
      ...normalizedAsset,
      src: await readBlobAsDataUrl(normalizedAsset.blob),
      revoke: null,
      missingOriginal,
      resolvedFromVariant
    };
  }

  if (typeof URL?.createObjectURL === "function") {
    const objectUrl = URL.createObjectURL(normalizedAsset.blob);

    return {
      ...normalizedAsset,
      src: objectUrl,
      missingOriginal,
      resolvedFromVariant,
      revoke: () => {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }

  return {
    ...normalizedAsset,
    src: "",
    revoke: null,
    missingOriginal,
    resolvedFromVariant
  };
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

  if (normalizedVariant === "original") {
    const sourceItem = item ?? await loadItemById(itemId);
    const hasStoredOriginal = Boolean(sourceItem?.itemUuid && await loadOriginalImageBlobEntry(sourceItem.itemUuid));

    if (!hasStoredOriginal) {
      const fallbackAsset = await loadStoredItemMediaAssetById(itemId, "preview");

      if (fallbackAsset) {
        return materializeResolvedAsset(fallbackAsset, {
          preferDataUrl,
          missingOriginal: true,
          resolvedFromVariant: "preview"
        });
      }
    }
  }

  if (!asset) {
    if (normalizedVariant === "original") {
      const fallbackAsset = await loadStoredItemMediaAssetById(itemId, "preview");

      if (fallbackAsset) {
        return materializeResolvedAsset(fallbackAsset, {
          preferDataUrl,
          missingOriginal: true,
          resolvedFromVariant: "preview"
        });
      }
    }

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
      revoke: null,
      missingOriginal: false,
      resolvedFromVariant: normalizedVariant
    };
  }

  return materializeResolvedAsset(asset, {
    preferDataUrl,
    missingOriginal: false,
    resolvedFromVariant: normalizedVariant
  });
}

async function loadItemById(itemId) {
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";

  if (!normalizedItemId) {
    return null;
  }

  const items = await loadStoredItems();
  return (Array.isArray(items) ? items : []).find((item) => item?.id === normalizedItemId) ?? null;
}

export async function scanOriginalReconnectionCandidates(item, files = [], options = {}) {
  const normalizedItem = item && typeof item === "object" ? item : null;
  const normalizedFiles = Array.from(files ?? []).filter(Boolean);
  const {
    createOriginalImageAsset
  } = options;

  if (typeof createOriginalImageAsset !== "function") {
    throw new Error("Original reconnection requires an original image asset decoder.");
  }

  return Promise.all(
    normalizedFiles.map(async (file) => {
      if (!file?.type?.startsWith("image/")) {
        throw new Error("Selected file is not an image.");
      }

      const originalAsset = await createOriginalImageAsset(file);
      return {
        file,
        originalAsset,
        review: buildOriginalReconnectionReview(normalizedItem ?? {}, file, originalAsset)
      };
    })
  );
}

export async function classifyOriginalAvailability(itemOrId) {
  const item = itemOrId && typeof itemOrId === "object"
    ? itemOrId
    : await loadItemById(itemOrId);

  if (!item) {
    return {
      item: null,
      state: "attention",
      hasStoredOriginal: false
    };
  }

  const hasStoredOriginal = Boolean(item?.itemUuid && await loadOriginalImageBlobEntry(item.itemUuid));

  return {
    item,
    state: classifyOriginalAvailabilityState(item, { hasStoredOriginal }),
    hasStoredOriginal
  };
}

export async function createOriginalReconnectionSnapshot(itemId, options = {}) {
  const item = await loadItemById(itemId);

  if (!item?.id) {
    throw new Error("Reference could not be found.");
  }

  const [items, appState] = await Promise.all([loadStoredItems(), loadStoredStartupAppState()]);

  return createMetadataSnapshot({
    reason: options.reason || "before-repair",
    items,
    appState: appState ?? {},
    changedItemIds: [item.id],
    appVersion: options.appVersion,
    appBuildTime: options.appBuildTime
  });
}

export async function reconnectOriginalForItem(itemId, file, expectedMatchContext = null, options = {}) {
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";
  const item = await loadItemById(normalizedItemId);
  const {
    createOriginalImageAsset,
    now = () => new Date().toISOString()
  } = options;

  if (!normalizedItemId || !item?.id) {
    throw new Error("Reference could not be found.");
  }

  if (typeof createOriginalImageAsset !== "function") {
    throw new Error("Original reconnection requires an original image asset decoder.");
  }

  if (!file?.type?.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  const originalAsset = await createOriginalImageAsset(file);
  const review = buildOriginalReconnectionReview(item, file, originalAsset);
  const expectedClassification = typeof expectedMatchContext?.classification === "string"
    ? expectedMatchContext.classification
    : typeof expectedMatchContext?.match?.classification === "string"
      ? expectedMatchContext.match.classification
      : "";

  if (expectedClassification && review.match.classification !== expectedClassification) {
    throw new Error("Original reconnection candidate changed during review.");
  }

  if (!review.canConfirm) {
    throw new Error("Selected file does not match stored provenance strongly enough to reconnect.");
  }

  const originalBlob = file instanceof Blob
    ? file
    : new Blob([file], { type: file?.type || originalAsset?.mimeType || "application/octet-stream" });
  const linkedAt = typeof now === "function" ? now() : new Date().toISOString();
  const nextItem = {
    ...item,
    originalPreserved: true,
    relinkStatus: "linked",
    sourceFilenameAliases: appendOriginalReconnectionAlias(item, file?.name || originalAsset?.originalFilename),
    originalLinkedAt: linkedAt,
    originalRelinkedFrom: "file-picker",
    originalRelinkedFilename: typeof file?.name === "string" ? file.name.trim() : "",
    updatedAt: linkedAt,
    images: {
      ...(item?.images && typeof item.images === "object" ? item.images : {}),
      original: originalAsset
    },
    mediaUpdateIntent: "replace"
  };

  await saveOriginalImageBlob(item.itemUuid, originalBlob, originalAsset);

  try {
    const savedItem = await saveStoredItem(nextItem);
    return {
      item: savedItem ?? nextItem,
      review,
      replacedExistingOriginal: Boolean(item?.originalPreserved)
    };
  } catch (error) {
    await deleteOriginalImageBlob(item.itemUuid);
    throw error;
  }
}

export async function markOriginalMissing(itemId) {
  const item = await loadItemById(itemId);

  if (!item?.id) {
    throw new Error("Reference could not be found.");
  }

  if (item.itemUuid) {
    await deleteOriginalImageBlob(item.itemUuid);
  }

  const nextItem = {
    ...item,
    originalPreserved: false,
    relinkStatus: "missing",
    updatedAt: new Date().toISOString(),
    images: {
      ...(item?.images && typeof item.images === "object" ? item.images : {}),
      original: {
        ...(item?.images?.original && typeof item.images.original === "object" ? item.images.original : {}),
        src: ""
      }
    },
    mediaUpdateIntent: "replace"
  };

  await saveStoredItem(nextItem);
  return {
    ...item,
    ...nextItem
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
