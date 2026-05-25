import { createMetadataOnlyBackupData } from "./storage.js";
import { sanitizeBackupReference } from "./metadata.js";
import { createImageAsset, normalizeItemImages } from "./itemImages.js";

export const PACKAGE_SOURCE = "moodboard-app-package";
export const PACKAGE_VERSION = 1;
export const PACKAGE_FORMAT = "directory";
export const PACKAGE_ASSET_POLICY = "preview-only";
export const PACKAGE_MANIFEST_FILE = "manifest.json";
export const PACKAGE_APP_STATE_FILE = "appState.json";
export const PACKAGE_ITEMS_FILE = "items.ndjson";
export const PACKAGE_MEDIA_DIR = "media";
export const PACKAGE_PREVIEWS_DIR = "media/previews";

const MIME_EXTENSION_MAP = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

function normalizePackageCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function sanitizeFileSegment(value) {
  const normalized = typeof value === "string" ? value.normalize("NFKD") : "";
  const ascii = normalized.replace(/[^\x00-\x7F]/g, "");
  const safe = ascii
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || "reference";
}

function getExtensionFromFilename(filename = "") {
  const normalized = typeof filename === "string" ? filename.trim().toLowerCase() : "";
  if (!normalized.includes(".")) {
    return "";
  }

  const extension = normalized.slice(normalized.lastIndexOf("."));
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

function getExtensionFromMimeType(mimeType = "") {
  const normalized = typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";
  return MIME_EXTENSION_MAP[normalized] ?? "";
}

function createJsonBlob(value) {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
}

function createTextBlob(value) {
  return new Blob([value], { type: "application/x-ndjson" });
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return null;
  }

  const [header, payload = ""] = dataUrl.split(",", 2);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const binary =
    typeof Buffer !== "undefined"
      ? Buffer.from(payload, "base64")
      : Uint8Array.from(globalThis.atob(payload), (character) => character.charCodeAt(0));

  return new Blob([binary], { type: mimeType });
}

async function writeBlobToFile(directoryHandle, fileName, blob) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function ensurePackageDirectories(rootHandle) {
  const mediaDirectoryHandle = await rootHandle.getDirectoryHandle(PACKAGE_MEDIA_DIR, { create: true });
  const previewsDirectoryHandle = await mediaDirectoryHandle.getDirectoryHandle("previews", { create: true });

  return {
    mediaDirectoryHandle,
    previewsDirectoryHandle
  };
}

function createUniquePreviewFileName(item, previewAsset, usedFileNames) {
  const baseFileName = getBackupPackagePreviewFileName(item, previewAsset);

  if (!usedFileNames.has(baseFileName)) {
    usedFileNames.add(baseFileName);
    return baseFileName;
  }

  const extension = getExtensionFromFilename(baseFileName);
  const stem = extension ? baseFileName.slice(0, -extension.length) : baseFileName;
  let suffix = 2;
  let candidate = `${stem}-${suffix}${extension}`;

  while (usedFileNames.has(candidate)) {
    suffix += 1;
    candidate = `${stem}-${suffix}${extension}`;
  }

  usedFileNames.add(candidate);
  return candidate;
}

async function createPreviewBlob(previewAsset) {
  if (previewAsset?.blob instanceof Blob) {
    return previewAsset.blob;
  }

  if (previewAsset?.src) {
    const blob = dataUrlToBlob(previewAsset.src);

    if (blob) {
      return blob;
    }
  }

  return null;
}

export function isFileSystemAccessSupported(target = globalThis) {
  return typeof target?.showDirectoryPicker === "function";
}

export function buildBackupPackageManifest({
  exportedAt = new Date().toISOString(),
  itemCount = 0,
  previewFileCount = 0
} = {}) {
  return {
    source: PACKAGE_SOURCE,
    version: PACKAGE_VERSION,
    exportedAt,
    format: PACKAGE_FORMAT,
    assetPolicy: PACKAGE_ASSET_POLICY,
    itemCount: normalizePackageCount(itemCount),
    previewFileCount: normalizePackageCount(previewFileCount),
    files: {
      appState: PACKAGE_APP_STATE_FILE,
      items: PACKAGE_ITEMS_FILE,
      previewsDir: PACKAGE_PREVIEWS_DIR
    }
  };
}

export function validateBackupPackageManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Backup package manifest is invalid.");
  }

  if (manifest.source !== PACKAGE_SOURCE) {
    throw new Error("Backup package source is invalid.");
  }

  if (manifest.version !== PACKAGE_VERSION) {
    throw new Error("Backup package version is not supported.");
  }

  if (manifest.format !== PACKAGE_FORMAT) {
    throw new Error("Backup package format is invalid.");
  }

  if (manifest.assetPolicy !== PACKAGE_ASSET_POLICY) {
    throw new Error("Backup package asset policy is invalid.");
  }

  if (manifest?.files?.appState !== PACKAGE_APP_STATE_FILE) {
    throw new Error("Backup package app state file is invalid.");
  }

  if (manifest?.files?.items !== PACKAGE_ITEMS_FILE) {
    throw new Error("Backup package items file is invalid.");
  }

  if (manifest?.files?.previewsDir !== PACKAGE_PREVIEWS_DIR) {
    throw new Error("Backup package previews directory is invalid.");
  }

  if (normalizePackageCount(manifest.itemCount) !== manifest.itemCount) {
    throw new Error("Backup package item count is invalid.");
  }

  if (normalizePackageCount(manifest.previewFileCount) !== manifest.previewFileCount) {
    throw new Error("Backup package preview file count is invalid.");
  }

  return manifest;
}

export function buildBackupPackageAppState(appState) {
  return createMetadataOnlyBackupData([], appState).appState;
}

export function getBackupPackagePreviewFileName(item, previewAsset = {}) {
  const normalizedItem = item && typeof item === "object" ? item : {};
  const normalizedPreviewAsset = createImageAsset(previewAsset);
  const baseName = sanitizeFileSegment(
    normalizedItem.itemUuid
    || normalizedItem.id
    || "reference"
  );
  const extension =
    getExtensionFromMimeType(normalizedPreviewAsset.mimeType)
    || getExtensionFromFilename(normalizedPreviewAsset.originalFilename)
    || getExtensionFromFilename(normalizedItem.originalFilename)
    || ".bin";

  return `${baseName}${extension}`;
}

export function buildBackupPackageItemRecord(item, previewFileName) {
  const exportedReference = sanitizeBackupReference(item);
  const previewPackagePath = `${PACKAGE_PREVIEWS_DIR}/${previewFileName}`;

  return {
    ...exportedReference,
    originalPreserved: false,
    images: {
      ...(exportedReference?.images && typeof exportedReference.images === "object" && !Array.isArray(exportedReference.images)
        ? exportedReference.images
        : {}),
      original: {
        ...createImageAsset(exportedReference?.images?.original),
        src: ""
      },
      preview: {
        ...createImageAsset(exportedReference?.images?.preview),
        src: "",
        packagePath: previewPackagePath
      },
      thumbnail: {
        ...createImageAsset(exportedReference?.images?.thumbnail),
        src: ""
      }
    }
  };
}

export function serializeBackupPackageItemRecord(record) {
  return `${JSON.stringify(record)}\n`;
}

export async function exportBackupPackageToDirectory({
  rootHandle,
  items,
  appState,
  resolvePreviewAsset
}) {
  if (!rootHandle || typeof rootHandle.getDirectoryHandle !== "function" || typeof rootHandle.getFileHandle !== "function") {
    throw new Error("Backup package export requires a writable directory handle.");
  }

  if (typeof resolvePreviewAsset !== "function") {
    throw new Error("Backup package export requires a preview asset resolver.");
  }

  const itemList = Array.isArray(items) ? items : [];
  const exportedAt = new Date().toISOString();
  const packageAppState = buildBackupPackageAppState(appState);
  const { previewsDirectoryHandle } = await ensurePackageDirectories(rootHandle);
  const itemsFileHandle = await rootHandle.getFileHandle(PACKAGE_ITEMS_FILE, { create: true });
  const itemsWritable = await itemsFileHandle.createWritable();
  const usedFileNames = new Set();
  let previewFileCount = 0;

  try {
    for (const item of itemList) {
      const normalizedImages = normalizeItemImages(item);
      const previewAsset = normalizedImages.preview?.src
        ? createImageAsset(normalizedImages.preview)
        : createImageAsset(await resolvePreviewAsset(item, "preview"));
      const previewBlob = await createPreviewBlob(previewAsset);

      if (!previewBlob) {
        throw new Error(`Reference "${item?.id || "unknown"}" is missing an exportable preview asset.`);
      }

      const previewFileName = createUniquePreviewFileName(item, previewAsset, usedFileNames);
      const itemRecord = buildBackupPackageItemRecord(item, previewFileName);

      await writeBlobToFile(previewsDirectoryHandle, previewFileName, previewBlob);
      await itemsWritable.write(createTextBlob(serializeBackupPackageItemRecord(itemRecord)));
      previewFileCount += 1;
    }
  } finally {
    await itemsWritable.close();
  }

  await writeBlobToFile(rootHandle, PACKAGE_APP_STATE_FILE, createJsonBlob(packageAppState));

  const manifest = buildBackupPackageManifest({
    exportedAt,
    itemCount: itemList.length,
    previewFileCount
  });
  validateBackupPackageManifest(manifest);
  await writeBlobToFile(rootHandle, PACKAGE_MANIFEST_FILE, createJsonBlob(manifest));

  return {
    manifest,
    itemCount: itemList.length,
    previewFileCount
  };
}
