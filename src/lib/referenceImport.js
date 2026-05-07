import * as exifr from "exifr";

import { replaceItemImageSet } from "./itemImages.js";
import { createImportedSourceIdentity } from "./itemIdentity.js";
import { emptyForm } from "./typeDefaults.js";
import { uniqueTags } from "./metadata.js";

const CATEGORY_KEYWORDS = [
  { keywords: ["interior", "room", "furniture"], tag: "interior" },
  { keywords: ["texture", "fabric", "material"], tag: "texture" },
  { keywords: ["portrait", "person"], tag: "portrait" }
];

const PRODUCT_TYPE_KEYWORDS = [
  { keywords: ["texture", "fabric", "material"], tag: "material" },
  { keywords: ["shoe", "boot", "sneaker", "footwear"], tag: "footwear" }
];

const SOURCE_TAG_MATCHERS = [
  { pattern: "august sander", tag: "august sander" },
  { pattern: "paul harnden", tag: "paul harnden" },
  { pattern: "john alexander skelton", tag: "john alexander skelton" },
  { pattern: "taiga takahashi", tag: "taiga takahashi" },
  { pattern: "guidi rossellini", tag: "guidi rossellini" },
  { pattern: "guidi", tag: "guidi" },
  { pattern: "grenson", tag: "grenson / skelton" },
  { pattern: "william lennon", tag: "william lennon" },
  { pattern: "brass", tag: "brass" }
];

function getFileStem(fileName = "") {
  return fileName.replace(/\.[^.]+$/, "").trim();
}

function normalizeFilenameForInference(fileName = "") {
  return getFileStem(fileName)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesKeyword(text, keyword) {
  return text.includes(keyword);
}

export function getFileExtension(filename = "") {
  const trimmedFilename = String(filename ?? "").trim();
  const extensionIndex = trimmedFilename.lastIndexOf(".");

  if (extensionIndex <= 0 || extensionIndex === trimmedFilename.length - 1) {
    return "";
  }

  return trimmedFilename.slice(extensionIndex + 1).toLowerCase();
}

function roundAspectRatio(width, height) {
  if (!width || !height) {
    return 0;
  }

  return Math.round((width / height) * 10000) / 10000;
}

export function getOrientation(width, height) {
  const normalizedWidth = Math.max(0, Math.round(Number(width) || 0));
  const normalizedHeight = Math.max(0, Math.round(Number(height) || 0));

  if (!normalizedWidth || !normalizedHeight) {
    return "";
  }

  const ratio = roundAspectRatio(normalizedWidth, normalizedHeight);
  if (Math.abs(ratio - 1) <= 0.05) {
    return "square";
  }

  return normalizedWidth > normalizedHeight ? "landscape" : "portrait";
}

function normalizeEmbeddedTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedValue = Date.parse(value);
  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

export function getImageDimensions(fileOrDataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let objectUrl = "";

    image.onload = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      resolve({
        imageWidth: Math.max(1, Math.round(image.naturalWidth || image.width || 0)),
        imageHeight: Math.max(1, Math.round(image.naturalHeight || image.height || 0))
      });
    };

    image.onerror = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      reject(new Error("Image metadata could not be read."));
    };

    if (typeof fileOrDataUrl === "string") {
      image.src = fileOrDataUrl;
      return;
    }

    if (fileOrDataUrl instanceof Blob) {
      objectUrl = URL.createObjectURL(fileOrDataUrl);
      image.src = objectUrl;
      return;
    }

    reject(new Error("Unsupported image source."));
  });
}

export function sanitizeEmbeddedMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const capturedAt = metadata.DateTimeOriginal ?? metadata.CreateDate ?? metadata.ModifyDate ?? null;
  const sanitizedMetadata = {
    capturedAt: normalizeEmbeddedTimestamp(capturedAt),
    originalCreatedAt: normalizeEmbeddedTimestamp(capturedAt),
    cameraMake: metadata.Make?.trim?.() ?? "",
    cameraModel: metadata.Model?.trim?.() ?? "",
    lensModel: metadata.LensModel?.trim?.() ?? "",
    focalLength: metadata.FocalLength ? String(metadata.FocalLength) : "",
    fNumber: metadata.FNumber ? String(metadata.FNumber) : "",
    exposureTime: metadata.ExposureTime ? String(metadata.ExposureTime) : "",
    iso: metadata.ISO ? String(metadata.ISO) : "",
    colorSpace: metadata.ColorSpace ? String(metadata.ColorSpace) : "",
    colorProfile: metadata.ProfileName?.trim?.() ?? metadata.ICCProfileName?.trim?.() ?? ""
  };

  return Object.fromEntries(
    Object.entries(sanitizedMetadata).filter(([, value]) => value !== "" && value !== 0 && value !== null && value !== undefined)
  );
}

export async function extractEmbeddedImageMetadata(file) {
  const parsedMetadata = await exifr.parse(file, {
    pick: [
      "DateTimeOriginal",
      "CreateDate",
      "ModifyDate",
      "Make",
      "Model",
      "LensModel",
      "FocalLength",
      "FNumber",
      "ExposureTime",
      "ISO",
      "ColorSpace",
      "ProfileName",
      "ICCProfileName"
    ],
    gps: false
  });

  return sanitizeEmbeddedMetadata(parsedMetadata);
}

export async function buildImportedReferenceMetadata(file, now, dependencies = {}) {
  const {
    getDimensions = getImageDimensions,
    extractMetadata = extractEmbeddedImageMetadata
  } = dependencies;
  const importedAt = now();
  const { imageWidth, imageHeight } = await getDimensions(file);
  const embeddedMetadata = await extractMetadata(file).catch(() => ({}));

  return {
    createdAt: importedAt,
    importedAt,
    updatedAt: importedAt,
    originalFilename: file?.name ?? "",
    fileExtension: getFileExtension(file?.name ?? ""),
    fileSize: Math.max(0, Number(file?.size) || 0),
    mimeType: file?.type ?? "",
    imageWidth,
    imageHeight,
    aspectRatio: roundAspectRatio(imageWidth, imageHeight),
    orientation: getOrientation(imageWidth, imageHeight),
    ...embeddedMetadata
  };
}

export function inferReferenceTagsFromFilename(fileName = "") {
  const normalizedName = normalizeFilenameForInference(fileName);
  if (!normalizedName) {
    return [];
  }

  return uniqueTags([
    ...CATEGORY_KEYWORDS
      .filter(({ keywords }) => keywords.some((keyword) => includesKeyword(normalizedName, keyword)))
      .map(({ tag }) => tag),
    ...PRODUCT_TYPE_KEYWORDS
      .filter(({ keywords }) => keywords.some((keyword) => includesKeyword(normalizedName, keyword)))
      .map(({ tag }) => tag),
    ...SOURCE_TAG_MATCHERS
      .filter(({ pattern }) => includesKeyword(normalizedName, pattern))
      .map(({ tag }) => tag)
  ]);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function isSupportedReferenceImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

export async function createReferenceFromFile(file, existingItems, dependencies) {
  const {
    bakeItemImagePresentation,
    createOriginalImageAsset,
    createPreviewImageAsset,
    createThumbnailImageAsset,
    createUniqueItemId,
    getImportedReferenceMetadata = buildImportedReferenceMetadata,
    now = Date.now,
    saveItem
  } = dependencies;

  if (!isSupportedReferenceImageFile(file)) {
    throw new Error("Selected file is not an image.");
  }

  const [originalImage, previewImage, thumbnailImage] = await Promise.all([
    createOriginalImageAsset(file),
    createPreviewImageAsset(file),
    createThumbnailImageAsset(file)
  ]);
  const inferredTags = inferReferenceTagsFromFilename(file.name);
  const importedMetadata = await getImportedReferenceMetadata(file, now);
  const nextItemDraft = await bakeItemImagePresentation(replaceItemImageSet({
    ...emptyForm,
    name: getFileStem(file.name),
    tags: inferredTags,
    ...createImportedSourceIdentity(file, originalImage),
    ...importedMetadata
  }, {
    original: {
      ...originalImage,
      originalFilename: originalImage.originalFilename || importedMetadata.originalFilename
    },
    preview: {
      ...previewImage,
      originalFilename: previewImage.originalFilename || importedMetadata.originalFilename
    },
    thumbnail: {
      ...thumbnailImage,
      originalFilename: thumbnailImage.originalFilename || importedMetadata.originalFilename
    }
  }));
  const nextItem = {
    ...nextItemDraft,
    id: createUniqueItemId(nextItemDraft, existingItems)
  };

  await saveItem(nextItem);

  return nextItem;
}

export async function importReferenceFiles(files, existingItems, dependencies) {
  const successfulItems = [];
  const ignoredFiles = [];
  const failedFiles = [];
  const normalizedFiles = Array.from(files ?? []);
  const nextItems = [...existingItems];

  for (const file of normalizedFiles) {
    if (!isSupportedReferenceImageFile(file)) {
      ignoredFiles.push(file);
      continue;
    }

    try {
      const nextItem = await createReferenceFromFile(file, nextItems, dependencies);
      successfulItems.push(nextItem);
      nextItems.push(nextItem);
    } catch (error) {
      failedFiles.push({ file, error });
    }
  }

  return {
    successfulItems,
    ignoredFiles,
    failedFiles
  };
}

export function getReferenceImportMessage({ successfulItems, ignoredFiles, failedFiles }) {
  const successCount = successfulItems.length;
  const ignoredCount = ignoredFiles.length;
  const failedCount = failedFiles.length;

  if (!successCount && !ignoredCount && !failedCount) {
    return "";
  }

  if (!successCount && ignoredCount && !failedCount) {
    return "No supported image files were selected.";
  }

  const parts = [];

  if (successCount > 0) {
    parts.push(`Imported ${pluralize(successCount, "reference")}.`);
  } else {
    parts.push("No references were imported.");
  }

  if (ignoredCount > 0) {
    parts.push(`Ignored ${pluralize(ignoredCount, "unsupported file")}.`);
  }

  if (failedCount > 0) {
    parts.push(`${pluralize(failedCount, "image file")} failed to import.`);
  }

  return parts.join(" ");
}
