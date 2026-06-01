import {
  createMetadataSnapshot,
  deleteItem as deleteStoredItem,
  deleteItems as deleteStoredItems,
  deleteOriginalImageBlob,
  loadItemById as loadStoredItemById,
  loadItemMediaAssetById as loadStoredItemMediaAssetById,
  loadMediaIntegritySnapshot as loadStoredMediaIntegritySnapshot,
  loadItems as loadStoredItems,
  loadOriginalImageBlobEntry,
  loadStartupAppState as loadStoredStartupAppState,
  markItemOriginalRecovered as markStoredItemOriginalRecovered,
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

  return loadStoredItemById(normalizedItemId);
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

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
}

function normalizeTimestamp(value) {
  const parsedValue = normalizeNumber(value);

  if (parsedValue) {
    return parsedValue;
  }

  if (typeof value === "string") {
    const dateValue = Date.parse(value);
    return Number.isFinite(dateValue) && dateValue > 0 ? Math.round(dateValue) : 0;
  }

  return 0;
}

function buildRecoveryOriginalMetadata(file, candidate = {}) {
  return {
    src: "",
    mimeType: normalizeText(candidate?.mimeType) || normalizeText(file?.type),
    width: normalizeNumber(candidate?.sourceImageWidth),
    height: normalizeNumber(candidate?.sourceImageHeight),
    fileSize: normalizeNumber(candidate?.sourceFileSize) || normalizeNumber(file?.size),
    originalFilename: normalizeText(candidate?.fileName) || normalizeText(file?.name)
  };
}

function verifyRecoveredOriginalCandidate(file, candidate = {}) {
  const expectedFilename = normalizeText(candidate?.fileName);
  const actualFilename = normalizeText(file?.name);
  const expectedSize = normalizeNumber(candidate?.sourceFileSize);
  const actualSize = normalizeNumber(file?.size);
  const expectedMimeType = normalizeText(candidate?.mimeType).toLowerCase();
  const actualMimeType = normalizeText(file?.type).toLowerCase();
  const expectedLastModified = normalizeTimestamp(candidate?.sourceLastModified);
  const actualLastModified = normalizeTimestamp(file?.lastModified);
  const hasDimensions = Boolean(
    normalizeNumber(candidate?.sourceImageWidth) && normalizeNumber(candidate?.sourceImageHeight)
  );
  const scalarMismatch = (
    (expectedFilename && actualFilename && expectedFilename !== actualFilename)
    || (expectedSize && actualSize && expectedSize !== actualSize)
    || (expectedMimeType && actualMimeType && expectedMimeType !== actualMimeType)
    || (expectedLastModified && actualLastModified && expectedLastModified !== actualLastModified)
  );

  return {
    verified: hasDimensions && !scalarMismatch,
    scalarMismatch,
    missingDimensions: !hasDimensions,
    incompleteCandidate:
      !normalizeText(candidate?.id)
      || !normalizeText(candidate?.fileName)
      || !normalizeText(candidate?.match?.classification),
    expectedFilename,
    actualFilename
  };
}

export async function attachRecoveredOriginalForItem(itemId, file, candidate = {}, options = {}) {
  const normalizedItemId = normalizeText(itemId);
  const item = await loadItemById(normalizedItemId);
  const {
    createOriginalImageAsset,
    now = () => new Date().toISOString(),
    onProgress = null
  } = options;
  const timings = {
    blobWriteMs: 0,
    itemMetadataSaveMs: 0
  };

  if (!normalizedItemId || !item?.id) {
    throw new Error("Reference could not be found.");
  }

  if (!file?.type?.startsWith?.("image/")) {
    throw new Error("Selected file is not an image.");
  }

  onProgress?.({
    phase: "file-read",
    itemId: normalizedItemId,
    fileName: file?.name ?? ""
  });

  const verification = verifyRecoveredOriginalCandidate(file, candidate);

  if (verification.scalarMismatch || verification.missingDimensions || verification.incompleteCandidate) {
    if (typeof createOriginalImageAsset !== "function") {
      throw new Error("Recovered original candidate metadata could not be verified. Re-scan before applying.");
    }

    return reconnectOriginalForItem(
      normalizedItemId,
      file,
      null,
      {
        createOriginalImageAsset,
        now,
        onProgress
      }
    );
  }

  const originalMetadata = buildRecoveryOriginalMetadata(file, candidate);
  const linkedAt = typeof now === "function" ? now() : new Date().toISOString();
  const recoveredFilename = normalizeText(file?.name) || normalizeText(originalMetadata.originalFilename);
  const nextItem = {
    ...item,
    originalPreserved: true,
    relinkStatus: "linked",
    sourceOriginalFilename: normalizeText(item?.sourceOriginalFilename) || recoveredFilename,
    sourceFilenameAliases: appendOriginalReconnectionAlias(item, recoveredFilename),
    originalLinkedAt: linkedAt,
    originalRelinkedFrom: "original-recovery",
    originalRelinkedFilename: recoveredFilename,
    updatedAt: linkedAt,
    images: {
      ...(item?.images && typeof item.images === "object" ? item.images : {}),
      original: originalMetadata
    },
    mediaUpdateIntent: "replace"
  };

  onProgress?.({
    phase: "blob-write",
    itemId: normalizedItemId,
    fileName: recoveredFilename
  });
  const blobWriteStartedAtMs = typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
  await saveOriginalImageBlob(item.itemUuid, file, originalMetadata);
  timings.blobWriteMs = Math.max(
    0,
    Math.round((((typeof performance !== "undefined" && typeof performance.now === "function")
      ? performance.now()
      : Date.now()) - blobWriteStartedAtMs) * 100) / 100
  );

  try {
    onProgress?.({
      phase: "item-save",
      itemId: normalizedItemId,
      fileName: recoveredFilename
    });
    const itemSaveStartedAtMs = typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
    const savedItem = await markStoredItemOriginalRecovered(item, nextItem);
    timings.itemMetadataSaveMs = Math.max(
      0,
      Math.round((((typeof performance !== "undefined" && typeof performance.now === "function")
        ? performance.now()
        : Date.now()) - itemSaveStartedAtMs) * 100) / 100
    );
    onProgress?.({
      phase: "completed",
      itemId: normalizedItemId,
      fileName: recoveredFilename
    });
    const resultItem = {
      ...(savedItem ?? nextItem),
      mediaUpdateIntent: "replace",
      originalPreserved: true,
      relinkStatus: "linked",
      sourceOriginalFilename: nextItem.sourceOriginalFilename,
      sourceFilenameAliases: nextItem.sourceFilenameAliases,
      originalLinkedAt: nextItem.originalLinkedAt,
      originalRelinkedFrom: nextItem.originalRelinkedFrom,
      originalRelinkedFilename: nextItem.originalRelinkedFilename,
      images: {
        ...((savedItem ?? nextItem)?.images && typeof (savedItem ?? nextItem).images === "object"
          ? (savedItem ?? nextItem).images
          : {}),
        original: {
          ...(((savedItem ?? nextItem)?.images?.original && typeof (savedItem ?? nextItem).images.original === "object")
            ? (savedItem ?? nextItem).images.original
            : {}),
          ...originalMetadata,
          src: ""
        }
      }
    };

    return {
      item: resultItem,
      review: {
        candidate: {
          sourceOriginalFilename: recoveredFilename,
          sourceFilenameAliases: [],
          sourceFileSize: originalMetadata.fileSize,
          sourceImageWidth: originalMetadata.width,
          sourceImageHeight: originalMetadata.height,
          sourceLastModified: normalizeTimestamp(file?.lastModified),
          mimeType: originalMetadata.mimeType
        },
        match: candidate?.match ?? { classification: normalizeText(candidate?.match?.classification) || "strong" },
        reasons: Array.isArray(candidate?.reasons) ? candidate.reasons : [],
        canConfirm: true,
        requiresExplicitOverride: false
      },
      replacedExistingOriginal: Boolean(item?.originalPreserved),
      timings
    };
  } catch (error) {
    await deleteOriginalImageBlob(item.itemUuid);
    throw error;
  }
}

export async function reconnectOriginalForItem(itemId, file, expectedMatchContext = null, options = {}) {
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";
  const item = await loadItemById(normalizedItemId);
  const {
    createOriginalImageAsset,
    now = () => new Date().toISOString(),
    onProgress = null
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

  onProgress?.({
    phase: "file-read",
    itemId: normalizedItemId,
    fileName: file?.name ?? ""
  });
  const originalAsset = await createOriginalImageAsset(file);
  onProgress?.({
    phase: "decoded",
    itemId: normalizedItemId,
    fileName: file?.name ?? "",
    width: originalAsset?.width ?? 0,
    height: originalAsset?.height ?? 0
  });
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

  onProgress?.({
    phase: "blob-write",
    itemId: normalizedItemId,
    fileName: file?.name ?? ""
  });
  await saveOriginalImageBlob(item.itemUuid, originalBlob, originalAsset);

  try {
    onProgress?.({
      phase: "item-save",
      itemId: normalizedItemId,
      fileName: file?.name ?? ""
    });
    const savedItem = await saveStoredItem(nextItem);
    onProgress?.({
      phase: "completed",
      itemId: normalizedItemId,
      fileName: file?.name ?? ""
    });
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
