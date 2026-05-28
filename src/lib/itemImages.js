function normalizeImageText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImageNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
}

function roundAspectRatio(width, height) {
  if (!width || !height) {
    return 0;
  }

  return Math.round((width / height) * 10000) / 10000;
}

function getOrientation(width, height) {
  if (!width || !height) {
    return "";
  }

  const ratio = roundAspectRatio(width, height);
  if (Math.abs(ratio - 1) <= 0.05) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

export function createImageAsset(asset = {}) {
  const {
    src,
    mimeType,
    width,
    height,
    fileSize,
    originalFilename,
    ...rest
  } = asset && typeof asset === "object" && !Array.isArray(asset) ? asset : {};

  return {
    ...rest,
    src: normalizeImageText(src),
    mimeType: normalizeImageText(mimeType),
    width: normalizeImageNumber(width),
    height: normalizeImageNumber(height),
    fileSize: normalizeImageNumber(fileSize),
    originalFilename: normalizeImageText(originalFilename)
  };
}

function mergeImageAssets(primary = {}, fallback = {}) {
  const normalizedPrimary = createImageAsset(primary);
  const normalizedFallback = createImageAsset(fallback);

  return {
    ...normalizedFallback,
    ...normalizedPrimary,
    src: normalizedPrimary.src || normalizedFallback.src || "",
    mimeType: normalizedPrimary.mimeType || normalizedFallback.mimeType || "",
    width: normalizedPrimary.width || normalizedFallback.width || 0,
    height: normalizedPrimary.height || normalizedFallback.height || 0,
    fileSize: normalizedPrimary.fileSize || normalizedFallback.fileSize || 0,
    originalFilename: normalizedPrimary.originalFilename || normalizedFallback.originalFilename || ""
  };
}

function getLegacyPreviewAsset(item) {
  return createImageAsset({
    src: item?.imageUrl ?? item?.img ?? "",
    mimeType: item?.mimeType ?? "",
    width: item?.imageWidth ?? 0,
    height: item?.imageHeight ?? 0,
    fileSize: item?.fileSize ?? 0,
    originalFilename: item?.originalFilename ?? ""
  });
}

export function normalizeItemImages(item) {
  const legacyPreview = getLegacyPreviewAsset(item);
  const preview = mergeImageAssets(createImageAsset(item?.images?.preview), legacyPreview);
  const thumbnail = createImageAsset(item?.images?.thumbnail);
  const original = createImageAsset(item?.images?.original);
  const originalPreserved = typeof item?.originalPreserved === "boolean"
    ? item.originalPreserved
    : false;

  return {
    original,
    preview,
    thumbnail,
    originalPreserved
  };
}

export function itemHasImagePayload(item) {
  const normalizedImages = normalizeItemImages(item);

  return [
    item?.imageUrl,
    normalizedImages.preview?.src,
    normalizedImages.thumbnail?.src,
    normalizedImages.original?.src
  ].some((value) => typeof value === "string" && value.trim());
}

export function mergeItemImageState(existingItem, item) {
  if (!existingItem || itemHasImagePayload(item)) {
    return item;
  }

  const existingImages = normalizeItemImages(existingItem);
  const incomingImages = normalizeItemImages(item);

  return {
    ...existingItem,
    ...item,
    imageUrl: item?.imageUrl || existingItem.imageUrl,
    mimeType: item?.mimeType || existingItem.mimeType,
    imageWidth: Number(item?.imageWidth) > 0 ? item.imageWidth : existingItem.imageWidth,
    imageHeight: Number(item?.imageHeight) > 0 ? item.imageHeight : existingItem.imageHeight,
    fileSize: Number(item?.fileSize) > 0 ? item.fileSize : existingItem.fileSize,
    originalFilename: item?.originalFilename || existingItem.originalFilename,
    aspectRatio: Number(item?.aspectRatio) > 0 ? item.aspectRatio : existingItem.aspectRatio,
    orientation: item?.orientation || existingItem.orientation,
    images: {
      ...existingItem?.images,
      ...item?.images,
      original: createImageAsset({
        ...existingImages.original,
        ...incomingImages.original
      }),
      preview: createImageAsset({
        ...existingImages.preview,
        ...incomingImages.preview
      }),
      thumbnail: createImageAsset({
        ...existingImages.thumbnail,
        ...incomingImages.thumbnail
      })
    },
    originalPreserved:
      typeof item?.originalPreserved === "boolean"
        ? item.originalPreserved
        : existingItem.originalPreserved
  };
}

function materializeAssets(item) {
  const normalized = normalizeItemImages(item);
  const legacyPreview = getLegacyPreviewAsset(item);
  const preview = mergeImageAssets(normalized.preview, mergeImageAssets(normalized.original, legacyPreview));
  const original = mergeImageAssets(normalized.original, preview);
  const thumbnail = mergeImageAssets(normalized.thumbnail, preview);

  return {
    ...normalized,
    original,
    preview,
    thumbnail
  };
}

export function getOriginalImageAsset(item) {
  return materializeAssets(item).original;
}

export function getPreviewImageAsset(item) {
  return materializeAssets(item).preview;
}

export function getThumbnailImageAsset(item) {
  return materializeAssets(item).thumbnail;
}

export function getOriginalImageSrc(item) {
  return getOriginalImageAsset(item).src;
}

export function getPreviewImageSrc(item) {
  return getPreviewImageAsset(item).src;
}

export function getThumbnailImageSrc(item) {
  return getThumbnailImageAsset(item).src;
}

export function materializeItemImagesForExport(item) {
  const { original, preview, thumbnail } = materializeAssets(item);

  return {
    original,
    preview,
    thumbnail
  };
}

export function applyPreviewImageFields(item, previewAsset) {
  const normalizedPreview = createImageAsset(previewAsset);
  const imageWidth = normalizedPreview.width;
  const imageHeight = normalizedPreview.height;

  return {
    ...item,
    imageUrl: normalizedPreview.src,
    mimeType: normalizedPreview.mimeType,
    imageWidth,
    imageHeight,
    fileSize: normalizedPreview.fileSize,
    originalFilename: normalizedPreview.originalFilename,
    aspectRatio: roundAspectRatio(imageWidth, imageHeight),
    orientation: getOrientation(imageWidth, imageHeight)
  };
}

export function replaceItemImageSet(item, imageSet) {
  const nextImages = {
    original: createImageAsset(imageSet?.original),
    preview: createImageAsset(imageSet?.preview),
    thumbnail: createImageAsset(imageSet?.thumbnail)
  };
  const withPreviewFields = applyPreviewImageFields(
    {
      ...item,
      images: nextImages,
      originalPreserved: true
    },
    nextImages.preview
  );

  return {
    ...withPreviewFields,
    images: nextImages
  };
}

export function replaceItemOriginalImage(item, originalAsset, options = {}) {
  const normalized = normalizeItemImages(item);
  const nextImages = {
    original: createImageAsset(originalAsset),
    preview: normalized.preview,
    thumbnail: normalized.thumbnail
  };

  if (options.regenerateOptimizedAssets) {
    nextImages.preview = createImageAsset(options.previewAsset);
    nextImages.thumbnail = createImageAsset(options.thumbnailAsset);
  }

  const nextItem = {
    ...item,
    images: nextImages,
    originalPreserved: true
  };

  return options.regenerateOptimizedAssets
    ? {
        ...applyPreviewImageFields(nextItem, nextImages.preview),
        images: nextImages
      }
    : nextItem;
}
