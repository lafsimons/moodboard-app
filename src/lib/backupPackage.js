import { createMetadataOnlyBackupData } from "./storage.js";
import { migrateReferenceMetadataToTags, sanitizeBackupReference } from "./metadata.js";
import { createImageAsset, normalizeItemImages } from "./itemImages.js";
import { stripItemMediaPayloads } from "./startupItemMetadata.js";

export const PACKAGE_SOURCE = "moodboard-app-package";
export const PACKAGE_VERSION = 1;
export const PACKAGE_FORMAT = "directory";
export const PACKAGE_ASSET_POLICY = "preview-only";
export const PACKAGE_MANIFEST_FILE = "manifest.json";
export const PACKAGE_APP_STATE_FILE = "appState.json";
export const PACKAGE_ITEMS_FILE = "items.ndjson";
export const PACKAGE_MEDIA_DIR = "media";
export const PACKAGE_PREVIEWS_DIR = "media/previews";
export const PACKAGE_WARNINGS_FILE = "export-warnings.json";

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

function getExtensionFromAssetType(type = "") {
  return getExtensionFromMimeType(type);
}

function getExtensionFromDataUrl(dataUrl = "") {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return "";
  }

  const mimeType = dataUrl.match(/^data:([^;,]+)/i)?.[1] ?? "";
  return getExtensionFromMimeType(mimeType);
}

function getExtensionFromFileExtension(fileExtension = "") {
  const normalized = typeof fileExtension === "string" ? fileExtension.trim().toLowerCase() : "";
  if (!normalized) {
    return "";
  }

  const candidate = normalized.startsWith(".") ? normalized : `.${normalized}`;
  return /^\.[a-z0-9]{1,8}$/.test(candidate) ? candidate : "";
}

function resolvePreviewFileExtension(item, previewAsset) {
  const normalizedItem = item && typeof item === "object" ? item : {};
  const normalizedPreviewAsset = createImageAsset(previewAsset);

  return (
    getExtensionFromMimeType(normalizedPreviewAsset.mimeType)
    || getExtensionFromAssetType(normalizedPreviewAsset.type)
    || getExtensionFromMimeType(normalizedItem?.images?.preview?.mimeType)
    || getExtensionFromMimeType(normalizedItem.mimeType)
    || getExtensionFromDataUrl(normalizedPreviewAsset.src)
    || getExtensionFromFileExtension(normalizedItem.fileExtension)
    || getExtensionFromFilename(normalizedPreviewAsset.originalFilename)
    || getExtensionFromFilename(normalizedItem.originalFilename)
    || ".bin"
  );
}

function createJsonBlob(value) {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
}

function createTextBlob(value) {
  return new Blob([value], { type: "application/x-ndjson" });
}

function normalizeWarningMessage(value, fallback = "Unknown export warning.") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function createExportWarning(item, message) {
  return {
    id: typeof item?.id === "string" ? item.id.trim() : "",
    itemUuid: typeof item?.itemUuid === "string" ? item.itemUuid.trim() : "",
    name: typeof item?.name === "string" ? item.name.trim() : "",
    message: normalizeWarningMessage(message)
  };
}

function createExportMediaAsset(asset = {}) {
  const normalizedAsset = createImageAsset(asset);
  const { packagePath: _packagePath, ...rest } = normalizedAsset;
  return {
    ...rest,
    src: ""
  };
}

function buildBackupPackageWarningReport({
  exportedAt = new Date().toISOString(),
  warnings = []
} = {}) {
  const normalizedWarnings = Array.isArray(warnings)
    ? warnings.filter((warning) => warning && typeof warning === "object")
    : [];

  return {
    source: PACKAGE_SOURCE,
    version: PACKAGE_VERSION,
    exportedAt,
    warningCount: normalizedWarnings.length,
    warnings: normalizedWarnings
  };
}

async function readJsonFile(fileHandle, errorMessage) {
  if (!fileHandle || typeof fileHandle.getFile !== "function") {
    throw new Error(errorMessage);
  }

  const file = await fileHandle.getFile();

  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error(errorMessage);
  }
}

async function readManifestFile(rootHandle) {
  try {
    const fileHandle = await rootHandle.getFileHandle(PACKAGE_MANIFEST_FILE);
    return validateBackupPackageManifest(await readJsonFile(fileHandle, "Backup package manifest is invalid."));
  } catch (error) {
    if (error?.message === "Backup package manifest is invalid.") {
      throw error;
    }

    throw new Error("Backup package manifest is missing.");
  }
}

async function readAppStateFile(rootHandle) {
  try {
    const fileHandle = await rootHandle.getFileHandle(PACKAGE_APP_STATE_FILE);
    return buildBackupPackageAppState(await readJsonFile(fileHandle, "Backup package app state is invalid."));
  } catch (error) {
    if (error?.message === "Backup package app state is invalid.") {
      throw error;
    }

    throw new Error("Backup package app state is missing.");
  }
}

function containsEmbeddedDataImagePayload(record) {
  const normalizedImages = normalizeItemImages(record);

  return [
    record?.imageUrl,
    normalizedImages.original?.src,
    normalizedImages.preview?.src,
    normalizedImages.thumbnail?.src
  ].some((value) => typeof value === "string" && value.startsWith("data:image/"));
}

function validatePreviewPackagePath(value, options = {}) {
  const {
    allowEmpty = false
  } = options;
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    if (allowEmpty) {
      return "";
    }

    throw new Error("Backup package item preview path is invalid.");
  }

  if (!/^media\/previews\/[^/]+$/.test(normalized)) {
    throw new Error(`Backup package preview path "${normalized}" is invalid.`);
  }

  return normalized;
}

function createPreparedPackageItem(record) {
  const migratedRecord = migrateReferenceMetadataToTags(record);
  const metadataOnlyRecord = stripItemMediaPayloads(migratedRecord);
  const normalizedImages = normalizeItemImages(migratedRecord);
  const previewAsset = {
    ...createImageAsset(normalizedImages.preview),
    src: ""
  };
  const originalAsset = {
    ...createImageAsset(normalizedImages.original),
    src: ""
  };
  const thumbnailAsset = {
    ...createImageAsset(normalizedImages.thumbnail),
    src: ""
  };

  delete previewAsset.packagePath;

  return {
    ...migratedRecord,
    ...metadataOnlyRecord,
    imageUrl: "",
    originalPreserved: false,
    images: {
      original: originalAsset,
      preview: previewAsset,
      thumbnail: thumbnailAsset
    }
  };
}

async function streamNdjsonFileLines(file, onLine) {
  if (!file || typeof file.stream !== "function") {
    throw new Error("Backup package items file is invalid.");
  }

  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let lineNumber = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();

      buffered += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? "";

      for (const line of lines) {
        lineNumber += 1;
        await onLine(line, lineNumber);
      }

      if (done) {
        break;
      }
    }

    buffered += decoder.decode();

    if (buffered.length > 0) {
      lineNumber += 1;
      await onLine(buffered, lineNumber);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function getPreviewsDirectoryHandle(rootHandle) {
  try {
    const mediaDirectoryHandle = await rootHandle.getDirectoryHandle(PACKAGE_MEDIA_DIR);
    return await mediaDirectoryHandle.getDirectoryHandle("previews");
  } catch {
    throw new Error("Backup package previews directory is missing.");
  }
}

async function readItemsFile(rootHandle) {
  try {
    const itemsFileHandle = await rootHandle.getFileHandle(PACKAGE_ITEMS_FILE);
    return itemsFileHandle.getFile();
  } catch {
    throw new Error("Backup package items file is missing.");
  }
}

function publishPackageImportProgress(onProgress, nextProgress) {
  if (typeof onProgress === "function") {
    onProgress(nextProgress);
  }
}

export async function prepareBackupPackageImportFromDirectory(rootHandle, options = {}) {
  if (!rootHandle || typeof rootHandle.getDirectoryHandle !== "function" || typeof rootHandle.getFileHandle !== "function") {
    throw new Error("Backup package import requires a readable directory handle.");
  }

  const { onProgress } = options;
  publishPackageImportProgress(onProgress, { phase: "reading-manifest", completed: 0, total: 0 });
  const manifest = await readManifestFile(rootHandle);

  publishPackageImportProgress(onProgress, { phase: "reading-app-state", completed: 0, total: 0 });
  const appState = await readAppStateFile(rootHandle);

  publishPackageImportProgress(onProgress, {
    phase: "validating-items",
    completed: 0,
    total: manifest.itemCount
  });

  const [itemsFile, previewsDirectoryHandle] = await Promise.all([
    readItemsFile(rootHandle),
    getPreviewsDirectoryHandle(rootHandle)
  ]);

  const stagedItems = [];
  const stagedPreviewFiles = [];
  const seenIds = new Set();

  await streamNdjsonFileLines(itemsFile, async (line, lineNumber) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return;
    }

    let record;

    try {
      record = JSON.parse(trimmedLine);
    } catch {
      throw new Error(`Backup package item line ${lineNumber} is invalid JSON.`);
    }

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`Backup package item line ${lineNumber} is invalid.`);
    }

    const itemId = typeof record.id === "string" ? record.id.trim() : "";

    if (!itemId) {
      throw new Error(`Backup package item line ${lineNumber} is missing an id.`);
    }

    if (seenIds.has(itemId)) {
      throw new Error(`Backup package item id "${itemId}" is duplicated.`);
    }

    if (containsEmbeddedDataImagePayload(record)) {
      throw new Error(`Backup package item "${itemId}" contains embedded image data.`);
    }

    const previewPackagePath = validatePreviewPackagePath(record?.images?.preview?.packagePath, { allowEmpty: true });
    const previewFileName = previewPackagePath ? previewPackagePath.slice(`${PACKAGE_PREVIEWS_DIR}/`.length) : "";
    let previewFile = null;

    if (previewFileName) {
      let previewFileHandle;

      try {
        previewFileHandle = await previewsDirectoryHandle.getFileHandle(previewFileName);
      } catch {
        throw new Error(`Backup package preview file "${previewFileName}" is missing.`);
      }

      previewFile = await previewFileHandle.getFile();
    }
    const normalizedImages = normalizeItemImages(record);
    const previewImage = createImageAsset(normalizedImages.preview);

    seenIds.add(itemId);
    stagedItems.push(createPreparedPackageItem(record));
    if (previewFile) {
      stagedPreviewFiles.push({
        itemId,
        variant: "preview",
        asset: {
          ...previewImage,
          src: "",
          blob: previewFile,
          fileSize: previewImage.fileSize || previewFile.size || 0,
          mimeType: previewImage.mimeType || previewFile.type || ""
        }
      });
    }

    publishPackageImportProgress(onProgress, {
      phase: "validating-items",
      completed: stagedItems.length,
      total: manifest.itemCount
    });
  });

  if (stagedItems.length !== manifest.itemCount) {
    throw new Error("Backup package item count does not match the manifest.");
  }

  publishPackageImportProgress(onProgress, {
    phase: "verifying-previews",
    completed: stagedPreviewFiles.length,
    total: manifest.previewFileCount
  });

  if (stagedPreviewFiles.length !== manifest.previewFileCount) {
    throw new Error("Backup package preview file count does not match the manifest.");
  }

  publishPackageImportProgress(onProgress, {
    phase: "preparing-import",
    completed: stagedItems.length,
    total: stagedItems.length
  });

  return {
    source: manifest.source,
    version: manifest.version,
    exportedAt: manifest.exportedAt,
    backupName: typeof rootHandle?.name === "string" ? rootHandle.name.trim() : "",
    appState,
    items: stagedItems,
    itemMediaAssets: stagedPreviewFiles
  };
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
  const baseName = sanitizeFileSegment(
    normalizedItem.itemUuid
    || normalizedItem.id
    || "reference"
  );
  const extension = resolvePreviewFileExtension(normalizedItem, previewAsset);

  return `${baseName}${extension}`;
}

export function buildBackupPackageItemRecord(item, previewFileName = "", options = {}) {
  const exportedReference = sanitizeBackupReference(item);
  const previewPackagePath = previewFileName ? `${PACKAGE_PREVIEWS_DIR}/${previewFileName}` : "";
  const normalizedImages = normalizeItemImages(exportedReference);
  const previewAsset = options.previewAsset ? createExportMediaAsset(options.previewAsset) : createExportMediaAsset(normalizedImages.preview);
  const thumbnailAsset = options.thumbnailAsset ? createExportMediaAsset(options.thumbnailAsset) : createExportMediaAsset(normalizedImages.thumbnail);
  const originalAsset = options.originalAsset ? createExportMediaAsset(options.originalAsset) : createExportMediaAsset(normalizedImages.original);

  return {
    ...exportedReference,
    originalPreserved: false,
    images: {
      ...(exportedReference?.images && typeof exportedReference.images === "object" && !Array.isArray(exportedReference.images)
        ? exportedReference.images
        : {}),
      original: originalAsset,
      preview: {
        ...previewAsset,
        ...(previewPackagePath ? { packagePath: previewPackagePath } : {})
      },
      thumbnail: thumbnailAsset
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
  resolvePreviewAsset,
  createPreviewAsset,
  createThumbnailAsset,
  onProgress
}) {
  if (!rootHandle || typeof rootHandle.getDirectoryHandle !== "function" || typeof rootHandle.getFileHandle !== "function") {
    throw new Error("Backup package export requires a writable directory handle.");
  }

  if (typeof resolvePreviewAsset !== "function") {
    throw new Error("Backup package export requires a preview asset resolver.");
  }

  const itemList = Array.isArray(items) ? items : [];
  const exportedAt = new Date().toISOString();
  const total = itemList.length;
  if (typeof onProgress === "function") {
    onProgress({ phase: "preparing", completed: 0, total });
  }
  const packageAppState = buildBackupPackageAppState(appState);
  const { previewsDirectoryHandle } = await ensurePackageDirectories(rootHandle);
  const itemsFileHandle = await rootHandle.getFileHandle(PACKAGE_ITEMS_FILE, { create: true });
  const itemsWritable = await itemsFileHandle.createWritable();
  const usedFileNames = new Set();
  let previewFileCount = 0;
  const warnings = [];

  try {
    for (const item of itemList) {
      let previewFileName = "";
      let exportedPreviewAsset = null;
      let exportedThumbnailAsset = null;
      let exportedOriginalAsset = null;

      try {
        const normalizedImages = normalizeItemImages(item);
        const resolvedPreviewAsset = normalizedImages.preview?.src
          ? createImageAsset(normalizedImages.preview)
          : createImageAsset(await resolvePreviewAsset(item, "preview"));
        exportedPreviewAsset = resolvedPreviewAsset;
        exportedThumbnailAsset = createImageAsset(normalizedImages.thumbnail);
        exportedOriginalAsset = createImageAsset(normalizedImages.original);
        let previewBlob = await createPreviewBlob(resolvedPreviewAsset);

        if (!previewBlob) {
          const resolvedOriginalAsset = normalizedImages.original?.src
            ? createImageAsset(normalizedImages.original)
            : createImageAsset(await resolvePreviewAsset(item, "original"));
          exportedOriginalAsset = resolvedOriginalAsset;
          const originalBlob = await createPreviewBlob(resolvedOriginalAsset);

          if (originalBlob && typeof createPreviewAsset === "function") {
            const repairedPreviewAsset = createImageAsset(await createPreviewAsset(originalBlob, item));
            const repairedThumbnailAsset = typeof createThumbnailAsset === "function"
              ? createImageAsset(await createThumbnailAsset(originalBlob, item))
              : exportedThumbnailAsset;
            const repairedPreviewBlob = await createPreviewBlob(repairedPreviewAsset);

            if (repairedPreviewBlob) {
              exportedPreviewAsset = repairedPreviewAsset;
              exportedThumbnailAsset = repairedThumbnailAsset;
              previewBlob = repairedPreviewBlob;
              warnings.push(
                createExportWarning(item, `Repaired missing preview media from the preserved original for export.`)
              );
            }
          }
        }

        if (!previewBlob) {
          exportedPreviewAsset = createExportMediaAsset(exportedPreviewAsset ?? normalizedImages.preview);
          exportedThumbnailAsset = createExportMediaAsset({});
          warnings.push(
            createExportWarning(item, `Omitted broken preview media from export because no resolvable preview or original was available.`)
          );
        } else {
          previewFileName = createUniquePreviewFileName(item, exportedPreviewAsset, usedFileNames);
          await writeBlobToFile(previewsDirectoryHandle, previewFileName, previewBlob);
          previewFileCount += 1;
        }
      } catch (error) {
        exportedPreviewAsset = createExportMediaAsset(normalizeItemImages(item).preview);
        exportedThumbnailAsset = createExportMediaAsset({});
        exportedOriginalAsset = createExportMediaAsset(normalizeItemImages(item).original);
        warnings.push(
          createExportWarning(
            item,
            error?.message || `Reference "${item?.id || "unknown"}" preview export failed.`
          )
        );
      }

      const itemRecord = buildBackupPackageItemRecord(item, previewFileName, {
        previewAsset: exportedPreviewAsset,
        thumbnailAsset: exportedThumbnailAsset,
        originalAsset: exportedOriginalAsset
      });
      await itemsWritable.write(createTextBlob(serializeBackupPackageItemRecord(itemRecord)));
      if (typeof onProgress === "function") {
        onProgress({ phase: "writing-previews", completed: Math.min(previewFileCount + warnings.length, total), total });
      }
    }
  } finally {
    await itemsWritable.close();
  }

  if (typeof onProgress === "function") {
    onProgress({ phase: "finalizing", completed: total, total });
  }
  await writeBlobToFile(rootHandle, PACKAGE_APP_STATE_FILE, createJsonBlob(packageAppState));
  const warningReport = buildBackupPackageWarningReport({
    exportedAt,
    warnings
  });

  if (warningReport.warningCount > 0) {
    await writeBlobToFile(rootHandle, PACKAGE_WARNINGS_FILE, createJsonBlob(warningReport));
  }

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
    previewFileCount,
    warningCount: warningReport.warningCount,
    warnings,
    warningReportFileName: warningReport.warningCount > 0 ? PACKAGE_WARNINGS_FILE : ""
  };
}
