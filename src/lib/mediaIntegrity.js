import { createImageAsset } from "./itemImages.js";
import { loadMediaIntegritySnapshot } from "./storage.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeVariant(value) {
  const normalizedValue = normalizeText(value).toLowerCase();
  return normalizedValue === "thumbnail" ? "thumbnail" : normalizedValue === "preview" ? "preview" : "";
}

function hasInlinePayload(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUsableAssetPayload(asset) {
  return hasInlinePayload(asset?.src) || asset?.blob instanceof Blob;
}

function isBlobBackedPreviewAssetValid(asset) {
  if (!(asset?.blob instanceof Blob)) {
    return false;
  }

  const mimeType = normalizeText(asset?.mimeType || asset.blob.type);
  return asset.blob.size > 0 || mimeType.startsWith("image/") || Number(asset?.width) > 0 || Number(asset?.height) > 0;
}

function createItemSample(item) {
  return {
    id: normalizeText(item?.id),
    name: normalizeText(item?.name || item?.title)
  };
}

function createAssetSample(record) {
  return {
    key: normalizeText(record?.key),
    itemId: normalizeText(record?.itemId),
    variant: normalizeVariant(record?.variant)
  };
}

function createOriginalBlobSample(record) {
  return {
    itemUuid: normalizeText(record?.itemUuid),
    originalFilename: normalizeText(record?.originalFilename)
  };
}

function createResultEntry(samples, limit = 10, extras = {}) {
  return {
    count: samples.length,
    samples: samples.slice(0, limit),
    ...extras
  };
}

export function detectInlineMediaPayload(item) {
  return hasInlinePayload(item?.imageUrl)
    || hasInlinePayload(item?.images?.preview?.src)
    || hasInlinePayload(item?.images?.thumbnail?.src)
    || hasInlinePayload(item?.images?.original?.src);
}

export function analyzeMediaIntegritySnapshot(snapshot = {}) {
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const itemMediaAssets = Array.isArray(snapshot.itemMediaAssets) ? snapshot.itemMediaAssets : [];
  const originalImageBlobs = Array.isArray(snapshot.originalImageBlobs) ? snapshot.originalImageBlobs : [];
  const itemIds = new Set();
  const itemUuids = new Set();
  const previewAssetsByItemId = new Map();
  const thumbnailAssetsByItemId = new Map();
  const originalBlobsByItemUuid = new Map();
  const duplicateGroupsByCompositeKey = new Map();
  const orphanedItemMediaAssets = [];
  const orphanedOriginalImageBlobs = [];
  const inlinePayloadItems = [];
  const missingPreviewItems = [];
  const missingMediaSourceItems = [];
  let previewAssetCount = 0;
  let thumbnailAssetCount = 0;
  let packageImportedBlobPreviewAssetCount = 0;

  items.forEach((item) => {
    const itemId = normalizeText(item?.id);
    const itemUuid = normalizeText(item?.itemUuid);

    if (itemId) {
      itemIds.add(itemId);
    }

    if (itemUuid) {
      itemUuids.add(itemUuid);
    }
  });

  itemMediaAssets.forEach((record) => {
    const itemId = normalizeText(record?.itemId);
    const variant = normalizeVariant(record?.variant);
    const asset = createImageAsset(record?.asset);
    const compositeKey = itemId && variant ? `${itemId}:${variant}` : "";

    if (variant === "preview") {
      previewAssetCount += 1;

      if (!previewAssetsByItemId.has(itemId)) {
        previewAssetsByItemId.set(itemId, []);
      }

      previewAssetsByItemId.get(itemId).push(asset);

      if (isBlobBackedPreviewAssetValid(asset)) {
        packageImportedBlobPreviewAssetCount += 1;
      }
    }

    if (variant === "thumbnail") {
      thumbnailAssetCount += 1;

      if (!thumbnailAssetsByItemId.has(itemId)) {
        thumbnailAssetsByItemId.set(itemId, []);
      }

      thumbnailAssetsByItemId.get(itemId).push(asset);
    }

    if (compositeKey) {
      const records = duplicateGroupsByCompositeKey.get(compositeKey) ?? [];
      records.push(record);
      duplicateGroupsByCompositeKey.set(compositeKey, records);
    }

    if (itemId && !itemIds.has(itemId)) {
      orphanedItemMediaAssets.push(createAssetSample(record));
    }
  });

  originalImageBlobs.forEach((record) => {
    const itemUuid = normalizeText(record?.itemUuid);

    if (itemUuid) {
      originalBlobsByItemUuid.set(itemUuid, record);
    }

    if (itemUuid && !itemUuids.has(itemUuid)) {
      orphanedOriginalImageBlobs.push(createOriginalBlobSample(record));
    }
  });

  items.forEach((item) => {
    const itemId = normalizeText(item?.id);
    const itemUuid = normalizeText(item?.itemUuid);
    const normalizedPreview = createImageAsset(item?.images?.preview);
    const normalizedThumbnail = createImageAsset(item?.images?.thumbnail);
    const normalizedOriginal = createImageAsset(item?.images?.original);
    const hasUsablePreviewMedia = hasInlinePayload(item?.imageUrl)
      || hasUsableAssetPayload(normalizedPreview)
      || (previewAssetsByItemId.get(itemId) ?? []).some((asset) => hasUsableAssetPayload(asset));
    const hasAnyMediaReference = hasInlinePayload(item?.imageUrl)
      || hasUsableAssetPayload(normalizedPreview)
      || hasUsableAssetPayload(normalizedThumbnail)
      || hasUsableAssetPayload(normalizedOriginal)
      || (previewAssetsByItemId.get(itemId) ?? []).length > 0
      || (thumbnailAssetsByItemId.get(itemId) ?? []).length > 0
      || Boolean(itemUuid && originalBlobsByItemUuid.has(itemUuid));

    if (detectInlineMediaPayload(item)) {
      inlinePayloadItems.push(createItemSample(item));
    }

    if (!hasUsablePreviewMedia) {
      missingPreviewItems.push(createItemSample(item));
    }

    if (!hasAnyMediaReference) {
      missingMediaSourceItems.push(createItemSample(item));
    }
  });

  const duplicateItemMediaAssetEntries = [...duplicateGroupsByCompositeKey.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([compositeKey, records]) => ({
      compositeKey,
      itemId: normalizeText(records[0]?.itemId),
      variant: normalizeVariant(records[0]?.variant),
      count: records.length,
      keys: records.map((record) => normalizeText(record?.key)).filter(Boolean).slice(0, 10)
    }));
  const duplicateRowCount = duplicateItemMediaAssetEntries.reduce((total, group) => total + group.count, 0);
  const warningsFound = orphanedItemMediaAssets.length > 0
    || orphanedOriginalImageBlobs.length > 0
    || missingPreviewItems.length > 0
    || missingMediaSourceItems.length > 0
    || duplicateItemMediaAssetEntries.length > 0
    || inlinePayloadItems.length > 0;

  return {
    status: warningsFound ? "warnings" : "healthy",
    warningsFound,
    summary: {
      items: items.length,
      previewAssets: previewAssetCount,
      thumbnailAssets: thumbnailAssetCount,
      originalBlobs: originalImageBlobs.length,
      packageImportedBlobPreviewAssets: packageImportedBlobPreviewAssetCount,
      orphanedRecords: orphanedItemMediaAssets.length + orphanedOriginalImageBlobs.length,
      missingPreviewMediaItems: missingPreviewItems.length,
      missingAnyMediaSourceItems: missingMediaSourceItems.length,
      duplicateMediaAssetGroups: duplicateItemMediaAssetEntries.length,
      duplicateMediaAssetRows: duplicateRowCount,
      inlineMediaPayloadItems: inlinePayloadItems.length
    },
    issues: {
      itemsMissingPreviewMedia: createResultEntry(missingPreviewItems),
      itemsMissingAnyMediaSource: createResultEntry(missingMediaSourceItems),
      orphanedItemMediaAssets: createResultEntry(orphanedItemMediaAssets),
      orphanedOriginalImageBlobs: createResultEntry(orphanedOriginalImageBlobs),
      duplicateItemMediaAssetEntries: createResultEntry(
        duplicateItemMediaAssetEntries,
        10,
        { rowCount: duplicateRowCount }
      ),
      itemsWithInlineMediaPayloads: createResultEntry(inlinePayloadItems)
    }
  };
}

export async function runMediaIntegrityCheck(loadSnapshot = loadMediaIntegritySnapshot) {
  const snapshot = await loadSnapshot();
  return analyzeMediaIntegritySnapshot(snapshot);
}
