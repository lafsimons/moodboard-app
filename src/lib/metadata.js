import { applyPreviewImageFields, materializeItemImagesForExport, normalizeItemImages } from "./itemImages.js";
import { normalizeItemSourceIdentity } from "./itemIdentity.js";

const LEGACY_METADATA_FIELDS = ["category", "collection", "productType", "sourceTags", "brand"];

export function normalizeTag(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\s*\/+\s*/g, "/")
    .replace(/\s+/g, " ")
    .replace(/^\/+|\/+$/g, "");
}

export function uniqueTags(tags) {
  const seen = new Set();

  return (Array.isArray(tags) ? tags : [])
    .map(normalizeTag)
    .filter((tag) => {
      if (!tag || seen.has(tag)) {
        return false;
      }

      seen.add(tag);
      return true;
    });
}

export function renameNestedTagPath(tag, sourceTag, targetTag) {
  const normalizedTag = normalizeTag(tag);
  const normalizedSourceTag = normalizeTag(sourceTag);
  const normalizedTargetTag = normalizeTag(targetTag);

  if (!normalizedTag || !normalizedSourceTag || !normalizedTargetTag) {
    return normalizedTag;
  }

  if (normalizedTag === normalizedSourceTag) {
    return normalizedTargetTag;
  }

  const nestedPrefix = `${normalizedSourceTag}/`;
  if (normalizedTag.startsWith(nestedPrefix)) {
    return `${normalizedTargetTag}${normalizedTag.slice(normalizedSourceTag.length)}`;
  }

  return normalizedTag;
}

function collectFieldTags(reference, field) {
  const value = reference?.[field];

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

export function migrateReferenceMetadataToTags(reference) {
  if (!reference || typeof reference !== "object") {
    return reference;
  }

  const legacyTags = LEGACY_METADATA_FIELDS.flatMap((field) => collectFieldTags(reference, field));
  const tags = uniqueTags([...(Array.isArray(reference.tags) ? reference.tags : []), ...legacyTags]);
  const {
    category,
    collection,
    productType,
    sourceTags,
    ...rest
  } = reference;
  const normalizedImages = normalizeItemImages(reference);
  const sourceIdentity = normalizeItemSourceIdentity(reference, {
    fallbackSourceOriginalFilename:
      reference?.originalFilename ??
      normalizedImages.original.originalFilename ??
      normalizedImages.preview.originalFilename
  });

  const normalizedReference = {
    ...rest,
    images: {
      original: normalizedImages.original,
      preview: normalizedImages.preview,
      thumbnail: normalizedImages.thumbnail
    },
    originalPreserved: normalizedImages.originalPreserved,
    ...sourceIdentity,
    tags,
    favorite: Boolean(reference.favorite)
  };

  const exportablePreview = materializeItemImagesForExport(normalizedReference).preview;
  return applyPreviewImageFields(normalizedReference, exportablePreview);
}

export function sanitizeExportedReference(reference) {
  const migrated = migrateReferenceMetadataToTags(reference);

  if (!migrated || typeof migrated !== "object") {
    return migrated;
  }

  const { brand, ...rest } = migrated;
  return {
    ...rest,
    images: materializeItemImagesForExport(migrated)
  };
}

function isEmbeddedImageDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function stripEmbeddedImageAssetSrc(asset = {}) {
  const normalizedAsset = createPortableBackupAsset(asset);
  return isEmbeddedImageDataUrl(normalizedAsset.src)
    ? {
        ...normalizedAsset,
        src: ""
      }
    : normalizedAsset;
}

function stripImageAssetSrc(asset = {}) {
  const normalizedAsset = createPortableBackupAsset(asset);
  return {
    ...normalizedAsset,
    src: ""
  };
}

function createPortableBackupAsset(asset = {}) {
  return {
    ...asset
  };
}

function omitPreviewMirrorFields(reference, previewAsset) {
  const nextReference = { ...reference };

  if (nextReference.imageUrl === previewAsset.src) {
    delete nextReference.imageUrl;
  }

  if (nextReference.mimeType === previewAsset.mimeType) {
    delete nextReference.mimeType;
  }

  if (nextReference.imageWidth === previewAsset.width) {
    delete nextReference.imageWidth;
  }

  if (nextReference.imageHeight === previewAsset.height) {
    delete nextReference.imageHeight;
  }

  if (nextReference.fileSize === previewAsset.fileSize) {
    delete nextReference.fileSize;
  }

  if (nextReference.originalFilename === previewAsset.originalFilename) {
    delete nextReference.originalFilename;
  }

  return nextReference;
}

export function sanitizeBackupReference(reference) {
  const exported = sanitizeExportedReference(reference);

  if (!exported || typeof exported !== "object") {
    return exported;
  }

  const originalAsset = exported.images?.original ?? {};
  const previewAsset = exported.images?.preview ?? {};
  const thumbnailAsset = exported.images?.thumbnail ?? previewAsset;
  const hasEmbeddedOriginal = isEmbeddedImageDataUrl(originalAsset.src);
  const hasEmbeddedPreview = isEmbeddedImageDataUrl(previewAsset.src);
  const hasEmbeddedThumbnail = isEmbeddedImageDataUrl(thumbnailAsset.src);

  if (
    !hasEmbeddedOriginal &&
    !hasEmbeddedPreview &&
    !hasEmbeddedThumbnail
  ) {
    return omitPreviewMirrorFields({
      ...exported,
      images: {
        ...exported.images,
        thumbnail: previewAsset.src ? stripImageAssetSrc(thumbnailAsset) : createPortableBackupAsset(thumbnailAsset)
      }
    }, previewAsset);
  }

  return omitPreviewMirrorFields({
    ...exported,
    originalPreserved: hasEmbeddedOriginal ? false : exported.originalPreserved,
    images: {
      original: stripEmbeddedImageAssetSrc(originalAsset),
      preview: createPortableBackupAsset(previewAsset),
      thumbnail: previewAsset.src ? stripImageAssetSrc(thumbnailAsset) : createPortableBackupAsset(thumbnailAsset)
    }
  }, previewAsset);
}

export function getAllTags(references) {
  return uniqueTags(
    (Array.isArray(references) ? references : []).flatMap((reference) =>
      Array.isArray(reference?.tags) ? reference.tags : []
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function getTagSuggestions(input, allTags, excludedTags = [], limit = 8) {
  const normalizedInput = normalizeTag(input);

  if (!normalizedInput) {
    return [];
  }

  const excluded = new Set(uniqueTags(excludedTags));
  const candidates = uniqueTags(allTags).filter((tag) => !excluded.has(tag) && tag.includes(normalizedInput));
  const startsWithMatches = [];
  const includesMatches = [];

  candidates.forEach((tag) => {
    if (tag.startsWith(normalizedInput)) {
      startsWithMatches.push(tag);
    } else {
      includesMatches.push(tag);
    }
  });

  startsWithMatches.sort((left, right) => left.localeCompare(right));
  includesMatches.sort((left, right) => left.localeCompare(right));

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}
