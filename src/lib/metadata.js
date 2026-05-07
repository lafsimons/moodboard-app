import { materializeItemImagesForExport, normalizeItemImages } from "./itemImages.js";

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

  return {
    ...rest,
    images: {
      original: normalizedImages.original,
      preview: normalizedImages.preview,
      thumbnail: normalizedImages.thumbnail
    },
    originalPreserved: normalizedImages.originalPreserved,
    tags,
    favorite: Boolean(reference.favorite)
  };
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

export function sanitizeBackupReference(reference) {
  const exported = sanitizeExportedReference(reference);

  if (!exported || typeof exported !== "object") {
    return exported;
  }

  const originalAsset = exported.images?.original ?? {};
  const previewAsset = exported.images?.preview ?? {};
  const thumbnailAsset = exported.images?.thumbnail ?? previewAsset;
  const backupPreviewAsset = thumbnailAsset.src ? thumbnailAsset : previewAsset.src ? previewAsset : originalAsset;

  if (!isEmbeddedImageDataUrl(originalAsset.src) && !isEmbeddedImageDataUrl(previewAsset.src)) {
    return exported;
  }

  return {
    ...exported,
    imageUrl: backupPreviewAsset.src ?? "",
    mimeType: backupPreviewAsset.mimeType ?? "",
    imageWidth: backupPreviewAsset.width ?? 0,
    imageHeight: backupPreviewAsset.height ?? 0,
    fileSize: backupPreviewAsset.fileSize ?? 0,
    originalFilename: backupPreviewAsset.originalFilename ?? exported.originalFilename ?? "",
    originalPreserved: false,
    images: {
      original: {
        src: "",
        mimeType: "",
        width: 0,
        height: 0,
        fileSize: 0,
        originalFilename: ""
      },
      preview: {
        src: "",
        mimeType: "",
        width: 0,
        height: 0,
        fileSize: 0,
        originalFilename: ""
      },
      thumbnail: {
        src: "",
        mimeType: "",
        width: 0,
        height: 0,
        fileSize: 0,
        originalFilename: ""
      }
    }
  };
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
