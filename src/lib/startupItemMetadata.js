import { createImageAsset } from "./itemImages.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function normalizeFilenameAlias(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFilenameAliasKey(value) {
  return normalizeFilenameAlias(value).toLowerCase();
}

function normalizeFilenameAliases(value) {
  const seen = new Set();

  return (Array.isArray(value) ? value : [])
    .map(normalizeFilenameAlias)
    .filter((alias) => {
      if (!alias) {
        return false;
      }

      const aliasKey = normalizeFilenameAliasKey(alias);

      if (seen.has(aliasKey)) {
        return false;
      }

      seen.add(aliasKey);
      return true;
    });
}

function createMetadataOnlyAsset(asset = {}) {
  const normalizedAsset = createImageAsset(asset);

  return {
    ...normalizedAsset,
    src: ""
  };
}

export function stripItemMediaPayloads(record = {}) {
  const previewAsset = createMetadataOnlyAsset(record?.images?.preview);
  const thumbnailAsset = createMetadataOnlyAsset(record?.images?.thumbnail);
  const originalAsset = createMetadataOnlyAsset(record?.images?.original);
  const existingImages =
    record?.images && typeof record.images === "object" && !Array.isArray(record.images)
      ? record.images
      : {};

  return {
    ...record,
    imageUrl: "",
    images: {
      ...existingImages,
      original: originalAsset,
      preview: {
        ...(existingImages.preview && typeof existingImages.preview === "object" && !Array.isArray(existingImages.preview)
          ? existingImages.preview
          : {}),
        ...previewAsset,
        width: previewAsset.width || Math.max(0, Math.round(normalizeNumber(record?.imageWidth))),
        height: previewAsset.height || Math.max(0, Math.round(normalizeNumber(record?.imageHeight))),
        fileSize: previewAsset.fileSize || Math.max(0, Math.round(normalizeNumber(record?.fileSize))),
        mimeType: previewAsset.mimeType || normalizeText(record?.mimeType),
        originalFilename: previewAsset.originalFilename || normalizeText(record?.originalFilename)
      },
      thumbnail: thumbnailAsset
    },
    originalPreserved: normalizeBoolean(record?.originalPreserved),
    id: normalizeText(record?.id),
    name: normalizeText(record?.name || record?.title),
    description: normalizeText(record?.description),
    imageScale: normalizeNumber(record?.imageScale),
    imageFrameScale: normalizeNumber(record?.imageFrameScale),
    imageOffsetX: normalizeNumber(record?.imageOffsetX),
    imageOffsetY: normalizeNumber(record?.imageOffsetY),
    imageCropX: normalizeNumber(record?.imageCropX),
    imageCropY: normalizeNumber(record?.imageCropY),
    imageCropWidth: normalizeNumber(record?.imageCropWidth),
    imageCropHeight: normalizeNumber(record?.imageCropHeight),
    value: record?.value ?? "",
    retailValue: record?.retailValue ?? "",
    brand: normalizeText(record?.brand),
    tags: normalizeArray(record?.tags),
    type: normalizeText(record?.type),
    createdAt: record?.createdAt ?? 0,
    importedAt: record?.importedAt ?? 0,
    updatedAt: record?.updatedAt ?? 0,
    itemUuid: normalizeText(record?.itemUuid),
    sourceNamespace: normalizeText(record?.sourceNamespace),
    sourceRelativePath: normalizeText(record?.sourceRelativePath),
    sourceOriginalFilename: normalizeText(record?.sourceOriginalFilename),
    sourceFilenameAliases: normalizeFilenameAliases(record?.sourceFilenameAliases),
    sourceFileSize: normalizeNumber(record?.sourceFileSize),
    sourceImageWidth: normalizeNumber(record?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(record?.sourceImageHeight),
    sourceLastModified: record?.sourceLastModified ?? 0,
    relinkStatus: normalizeText(record?.relinkStatus),
    originalLinkedAt: normalizeText(record?.originalLinkedAt),
    originalRelinkedFrom: normalizeText(record?.originalRelinkedFrom),
    originalRelinkedFilename: normalizeText(record?.originalRelinkedFilename),
    originalRelinkedRelativePath: normalizeText(record?.originalRelinkedRelativePath),
    originalFilename: normalizeText(record?.originalFilename),
    fileExtension: normalizeText(record?.fileExtension),
    fileSize: normalizeNumber(record?.fileSize),
    mimeType: normalizeText(record?.mimeType),
    imageWidth: normalizeNumber(record?.imageWidth),
    imageHeight: normalizeNumber(record?.imageHeight),
    aspectRatio: normalizeNumber(record?.aspectRatio),
    orientation: normalizeText(record?.orientation),
    capturedAt: record?.capturedAt ?? 0,
    originalCreatedAt: record?.originalCreatedAt ?? 0,
    cameraMake: normalizeText(record?.cameraMake),
    cameraModel: normalizeText(record?.cameraModel),
    lensModel: normalizeText(record?.lensModel),
    focalLength: normalizeText(record?.focalLength),
    fNumber: normalizeText(record?.fNumber),
    exposureTime: normalizeText(record?.exposureTime),
    iso: normalizeText(record?.iso),
    colorSpace: normalizeText(record?.colorSpace),
    colorProfile: normalizeText(record?.colorProfile),
    size: normalizeText(record?.size),
    favorite: normalizeBoolean(record?.favorite),
    garmentType: normalizeText(record?.garmentType),
    layerType: normalizeText(record?.layerType),
    accessorySlot: normalizeText(record?.accessorySlot),
    color: normalizeText(record?.color),
    weight: normalizeText(record?.weight),
    showTitleOnCard: normalizeBoolean(record?.showTitleOnCard),
    list: normalizeText(record?.list),
    quantity: normalizeNumber(record?.quantity),
    styleTags: normalizeArray(record?.styleTags),
    climateTags: normalizeArray(record?.climateTags)
  };
}
