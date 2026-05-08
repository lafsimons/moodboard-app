import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createLightweightBackupData,
  deleteItem,
  getDefaultData,
  loadAppState,
  loadItems,
  prepareBackupImport,
  replaceWithBackup,
  replaceWithPreparedBackup,
  resetToDefaults,
  saveAppState,
  saveItem
} from "./lib/storage";
import {
  applyMappedStyleWeightDefaults,
  defaultTypeSuggestions,
  emptyForm,
  getTypeMatchKeys,
  hasTypeDefaults,
  itemLists,
  layerTypes,
  normalizeItemType,
  normalizeList,
  normalizeTagList,
  normalizeType,
  normalizeWeight,
  resolveTypeDefaults,
  styleTagOptions,
  typeDerivedFields,
  weightOptions
} from "./lib/typeDefaults";
import {
  accessorySlots,
  applyOutfitAffinityDelta,
  applyContextValidityRulesToPool,
  boardToSyntheticOutfit,
  buildNextOutfit,
  buildNextOutfitWithDebug,
  climateTagOptions,
  createBoardFromReferenceIds,
  DEFAULT_BOARD_IMAGE_COUNT,
  defaultGenerationLists,
  defaultGenerationMode,
  editableClimateTagOptions,
  emptyOutfitFilters,
  filterPoolForCompatibilityRules,
  filterPoolForLayeringRules,
  generateBoard,
  generationModes,
  getBoardKey,
  getCurrentOutfitClimateChip,
  getCurrentOutfitStyleChip,
  getEligibleSlotPool,
  getItemStyleTags,
  getOtherTopSlot,
  getOutfitDominantStyle,
  getOutfitKey,
  getPool,
  getGuidedBreakdownDisplayEntries,
  hasActiveOutfitFilters,
  isEligibleForGeneration,
  isNonStackableTopType,
  normalizeGenerationMode,
  normalizeLikedOutfitKeys,
  normalizeOutfitAffinity,
  normalizeOutfitFilters,
  normalizeRecentOutfits,
  outfitFilterOptions,
  pickNextItemForGeneration,
  pickRandom,
  relayoutBoardImages,
  rememberRecentOutfit,
  rerollBoardImage,
  summarizeGuidedDebugPayload,
  visibleSlots
} from "./lib/generation";
import {
  getReferenceImportMessage,
  importReferenceFiles
} from "./lib/referenceImport";
import {
  applyPreviewImageFields,
  createImageAsset,
  getOriginalImageSrc,
  getPreviewImageAsset,
  getPreviewImageSrc,
  getThumbnailImageSrc,
  normalizeItemImages,
  replaceItemImageSet,
  replaceItemOriginalImage
} from "./lib/itemImages";
import { normalizeItemSourceIdentity } from "./lib/itemIdentity";
import TagInput from "./components/TagInput";
import {
  getAllTags,
  migrateReferenceMetadataToTags,
  normalizeTag,
  renameNestedTagPath,
  uniqueTags
} from "./lib/metadata";
import {
  getCommonTagsForItems,
  getNextLibrarySelection,
  matchesTagFilter,
  matchesLibrarySearch,
  getTotalUniqueTagCount
} from "./lib/taggingUx";
import {
  buildBoardRenderMetadata,
  getBoardItemRenderedBounds
} from "./lib/boardBounds.js";

const imageAssets = import.meta.glob("../images/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default"
});

const imageAssetEntries = Object.entries(imageAssets)
  .map(([path, imageUrl]) => {
    const filename = path.split("/").pop();

    return filename && !filename.startsWith(".")
      ? {
          filename,
          imageUrl
        }
      : null;
  })
  .filter(Boolean);
const imageUrlByFilename = Object.fromEntries(
  imageAssetEntries.map((image) => [image.filename, image.imageUrl])
);
const imageMetricsCache = new Map();
const BOARD_ZOOM_MIN = 0.1;
const BOARD_ZOOM_MAX = 6;
const GENERATE_PERF_DEBUG_FLAG = "debug:generate-perf";
const LIBRARY_PERF_DEBUG_FLAG = "debug:library-perf";
const LIBRARY_GRID_MIN_COLUMN_WIDTH = 150;
const LIBRARY_GRID_GAP = 12;
const LIBRARY_GRID_ESTIMATED_ROW_HEIGHT = 196;
const LIBRARY_GRID_OVERSCAN_ROWS = 2;
const LIBRARY_VIRTUALIZATION_THRESHOLD = 120;
const BOARD_PICKER_GRID_COLUMNS = 3;
const BOARD_PICKER_GRID_GAP = 8;
const BOARD_PICKER_ESTIMATED_ROW_HEIGHT = 126;
const BOARD_PICKER_OVERSCAN_ROWS = 2;
const NESTED_TAG_DEBUG_FLAG = "debug:nested-tags";
const NESTED_TAG_DEBUG_ITEMS = [
  {
    id: "__debug-nested-tag-parent-child-a",
    name: "Debug Nested Tag Parent Child A",
    tags: ["parent/child a"]
  },
  {
    id: "__debug-nested-tag-parent-child-b",
    name: "Debug Nested Tag Parent Child B",
    tags: ["parent/child b"]
  },
  {
    id: "__debug-nested-tag-another-parent-child-c",
    name: "Debug Nested Tag Another Parent Child C",
    tags: ["another parent/child c"]
  }
];

function isNestedTagDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("debugNestedTags") === "1") {
      return true;
    }

    return window.localStorage.getItem(NESTED_TAG_DEBUG_FLAG) === "1";
  } catch {
    return false;
  }
}

function describeDebugNode(node) {
  if (!(node instanceof Element)) {
    return String(node ?? "null");
  }

  const tagName = node.tagName.toLowerCase();
  const id = node.id ? `#${node.id}` : "";
  const className = typeof node.className === "string"
    ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 4).join(".")
    : "";
  const classSuffix = className ? `.${className}` : "";
  const role = node.getAttribute("role");
  const name =
    node.getAttribute("aria-label") ||
    node.getAttribute("data-debug-id") ||
    node.textContent?.trim?.()?.slice(0, 60) ||
    "";

  return [tagName + id + classSuffix, role ? `role=${role}` : "", name ? `name=${name}` : ""]
    .filter(Boolean)
    .join(" ");
}

function getEventPhaseName(eventPhase) {
  switch (eventPhase) {
    case 1:
      return "capture";
    case 2:
      return "target";
    case 3:
      return "bubble";
    default:
      return "unknown";
  }
}

function recordNestedTagDebugMessage(enabled, scope, label, details) {
  if (!enabled || typeof window === "undefined") {
    return;
  }

  const summary = `[${scope}] ${label} ${JSON.stringify(details)}`;
  const currentLogs = Array.isArray(window.__nestedTagDebugLogs) ? window.__nestedTagDebugLogs : [];
  window.__nestedTagDebugLogs = [...currentLogs.slice(-79), summary];
}

function logNestedTagDebug(enabled, scope, label, event, extras = {}) {
  if (!enabled || typeof console === "undefined") {
    return;
  }

  const details = {
    type: event?.type ?? null,
    eventPhase: getEventPhaseName(event?.eventPhase),
    defaultPrevented: Boolean(event?.defaultPrevented),
    currentTarget: describeDebugNode(event?.currentTarget),
    target: describeDebugNode(event?.target),
    ...extras
  };

  console.log(`[nested-tag-debug] ${scope} ${label}`, details);
  recordNestedTagDebugMessage(enabled, scope, label, details);
}

function isGeneratePerfDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("debugGeneratePerf") === "1") {
      return true;
    }

    return window.localStorage.getItem(GENERATE_PERF_DEBUG_FLAG) === "1";
  } catch {
    return false;
  }
}

function createGeneratePerfSession(enabled) {
  if (!enabled || typeof performance === "undefined") {
    return null;
  }

  const startedAt = performance.now();
  const marks = [];

  return {
    expectedBoardId: null,
    mark(label, extra = null) {
      marks.push({
        label,
        extra,
        time: performance.now()
      });
    },
    flush() {
      if (!marks.length) {
        return;
      }

      const totalDuration = Math.round((marks.at(-1).time - startedAt) * 100) / 100;
      console.groupCollapsed(`[perf] generate board ${totalDuration}ms`);

      marks.forEach((entry, index) => {
        const previousTime = index === 0 ? startedAt : marks[index - 1].time;
        const delta = Math.round((entry.time - previousTime) * 100) / 100;
        const total = Math.round((entry.time - startedAt) * 100) / 100;

        if (entry.extra) {
          console.log(`${entry.label} +${delta}ms (${total}ms total)`, entry.extra);
        } else {
          console.log(`${entry.label} +${delta}ms (${total}ms total)`);
        }
      });

      console.groupEnd();
    }
  };
}

function isLibraryPerfDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("debugLibraryPerf") === "1") {
      return true;
    }

    return window.localStorage.getItem(LIBRARY_PERF_DEBUG_FLAG) === "1";
  } catch {
    return false;
  }
}

function createLibraryPerfSession(enabled) {
  if (!enabled || typeof performance === "undefined") {
    return null;
  }

  const startedAt = performance.now();
  const marks = [];

  return {
    imageRenderStarted: false,
    renderCompleted: false,
    mark(label, extra = null) {
      marks.push({
        label,
        extra,
        time: performance.now()
      });
    },
    flush() {
      if (!marks.length) {
        return;
      }

      const totalDuration = Math.round((marks.at(-1).time - startedAt) * 100) / 100;
      console.groupCollapsed(`[perf] library open ${totalDuration}ms`);
      marks.forEach((entry, index) => {
        const previousTime = index === 0 ? startedAt : marks[index - 1].time;
        const delta = Math.round((entry.time - previousTime) * 100) / 100;
        const total = Math.round((entry.time - startedAt) * 100) / 100;
        if (entry.extra) {
          console.log(`${entry.label} +${delta}ms (${total}ms total)`, entry.extra);
        } else {
          console.log(`${entry.label} +${delta}ms (${total}ms total)`);
        }
      });
      console.groupEnd();
    }
  };
}

function getImageFilename(imageUrl) {
  const pathname = imageUrl.split("?")[0].split("#")[0];
  const filename = pathname.split("/").pop() ?? "";

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

function stripViteHash(filename) {
  const extensionIndex = filename.lastIndexOf(".");

  if (extensionIndex === -1) {
    return filename;
  }

  const stem = filename.slice(0, extensionIndex);
  const extension = filename.slice(extensionIndex);
  const hashSeparatorIndex = stem.lastIndexOf("-");

  if (hashSeparatorIndex === -1) {
    return filename;
  }

  return `${stem.slice(0, hashSeparatorIndex)}${extension}`;
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl || imageUrl.startsWith("data:") || /^https?:\/\//.test(imageUrl)) {
    return imageUrl;
  }

  if (!imageUrl.startsWith("/images/") && !imageUrl.startsWith("/assets/")) {
    return imageUrl;
  }

  const filename = getImageFilename(imageUrl);
  return imageUrlByFilename[filename] ?? imageUrlByFilename[stripViteHash(filename)] ?? imageUrl;
}

function resolveImageUrlCandidates(imageUrl) {
  const rawImageUrl = imageUrl?.trim?.() ?? imageUrl ?? "";

  if (!rawImageUrl) {
    return [];
  }

  const candidates = [
    resolveImageUrl(rawImageUrl),
    rawImageUrl
  ];

  try {
    candidates.push(encodeURI(rawImageUrl));
  } catch {
    // Keep existing candidates only.
  }

  try {
    candidates.push(decodeURI(rawImageUrl));
  } catch {
    // Keep existing candidates only.
  }

  return [...new Set(candidates.filter(Boolean))];
}

function getManagedItemImageSrc(item, variant = "preview") {
  if (variant === "original") {
    return getOriginalImageSrc(item);
  }

  if (variant === "thumbnail") {
    return getThumbnailImageSrc(item);
  }

  return getPreviewImageSrc(item);
}

function normalizeMoodboardText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCreatedAt(value) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.round(numericValue);
  }

  if (typeof value === "string") {
    const parsedValue = Date.parse(value);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return 0;
}

function formatCreatedAt(value) {
  const normalizedValue = normalizeCreatedAt(value);

  if (!normalizedValue) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(normalizedValue));
}

function normalizeFileMetadataText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWholeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeAspectRatioValue(value, width = 0, height = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed * 10000) / 10000;
  }

  if (width > 0 && height > 0) {
    return Math.round((width / height) * 10000) / 10000;
  }

  return 0;
}

function normalizeOrientation(value, width = 0, height = 0) {
  if (["square", "portrait", "landscape"].includes(value)) {
    return value;
  }

  const ratio = normalizeAspectRatioValue(0, width, height);
  if (!ratio) {
    return "";
  }

  if (Math.abs(ratio - 1) <= 0.05) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

function formatFileSize(bytes) {
  const normalizedBytes = normalizeWholeNumber(bytes);
  if (!normalizedBytes) {
    return "";
  }

  if (normalizedBytes < 1024) {
    return `${normalizedBytes} B`;
  }

  if (normalizedBytes < 1024 * 1024) {
    return `${(normalizedBytes / 1024).toFixed(1)} KB`;
  }

  return `${(normalizedBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAspectRatio(value) {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue.toFixed(2) : "";
}

function getBestTimestamp(item, keys) {
  for (const key of keys) {
    const normalizedValue = normalizeCreatedAt(item?.[key]);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return 0;
}

function getItemSystemMetadata(item) {
  const capturedAt = getBestTimestamp(item, ["capturedAt", "originalCreatedAt"]);
  const importedAt = getBestTimestamp(item, ["importedAt", "createdAt", "addedAt", "timestamp"]);
  const updatedAt = getBestTimestamp(item, ["updatedAt", "modifiedAt", "timestamp", "createdAt", "addedAt", "importedAt"]);

  return {
    capturedAt,
    importedAt,
    updatedAt
  };
}

function getIsMobileViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(max-width: 960px)").matches;
}

function getCanUseDebugPopout() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(min-width: 1180px)").matches;
}

const garmentTypes = [
  "Headwear",
  "Top",
  "Outerwear",
  "Bottom",
  "Footwear",
  "Dresses/Jumpsuits",
  "Accessory"
];
const ITEM_DEFAULTS_MIGRATION_VERSION = 3;
const IMAGE_PRESENTATION_MIGRATION_VERSION = 2;
const emptyWardrobeFilters = {
  tags: [],
  excludedTags: [],
  tagMatchMode: "any",
  laundry: "",
  favorite: ""
};
const emptyGenerationMetadataFilters = {
  tags: [],
  excludedTags: [],
  tagMatchMode: "any",
  favorite: ""
};
const NO_TAGS_FILTER = "__no_tags__";
const outfitLayout = ["Headwear", "TopGroup", "Bottom", "Footwear"];
const advancedTrackedFields = [
  "name",
  "brand",
  "size",
  "weight",
  "list",
  "quantity",
  "value",
  "retailValue",
  "styleTags",
  "climateTags",
  "favorite",
  "garmentType",
  "layerType",
  "accessorySlot"
];

function isWishlistItem(item) {
  const searchableMetadata = `${item.id ?? ""} ${item.name ?? ""}`.toLowerCase();
  return normalizeList(item.list) === "Wishlist" || searchableMetadata.includes("wishlist");
}

function normalizeImageScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.min(180, Math.max(50, Math.round(parsed)));
}

function normalizeImageFrameScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.min(300, Math.max(20, Math.round(parsed)));
}

function normalizeImageOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(50, Math.max(-50, Math.round(parsed)));
}

function normalizeImageCropSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.min(100, Math.max(1, Math.round(parsed)));
}

function normalizeImageCropStart(value, size) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100 - size, Math.max(0, Math.round(parsed)));
}

function getNormalizedImageCrop(item) {
  const width = normalizeImageCropSize(item?.imageCropWidth);
  const height = normalizeImageCropSize(item?.imageCropHeight);
  const x = normalizeImageCropStart(item?.imageCropX, width);
  const y = normalizeImageCropStart(item?.imageCropY, height);

  return { x, y, width, height };
}

const MIN_CROP_SIZE = 5;

function normalizeCropRect(crop) {
  const width = Math.max(MIN_CROP_SIZE, Math.min(100, Number(crop?.width) || 100));
  const height = Math.max(MIN_CROP_SIZE, Math.min(100, Number(crop?.height) || 100));
  const x = Math.min(100 - width, Math.max(0, Number(crop?.x) || 0));
  const y = Math.min(100 - height, Math.max(0, Number(crop?.y) || 0));

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.round(parsed));
}

function normalizeImageCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_BOARD_IMAGE_COUNT;
  }

  return Math.min(30, Math.max(1, Math.round(parsed)));
}

function resolvePersistedImageCount(value) {
  const normalizedCount = normalizeImageCount(value);

  if (normalizedCount === 5 || normalizedCount === 8) {
    return DEFAULT_BOARD_IMAGE_COUNT;
  }

  return normalizedCount;
}

function shouldRegenerateLegacyBoardForImageCount(board, imageCount) {
  const boardImageCount = Array.isArray(board?.images) ? board.images.length : 0;

  return imageCount === DEFAULT_BOARD_IMAGE_COUNT && (boardImageCount === 5 || boardImageCount === 8);
}

function sanitizeImageCountDraft(value) {
  return String(value ?? "").replace(/[^\d]/g, "").slice(0, 2);
}

function getBoardImageCount(board) {
  if (!Array.isArray(board?.images) || !board.images.length) {
    return DEFAULT_BOARD_IMAGE_COUNT;
  }

  return normalizeImageCount(board.images.length);
}


function areEditorValuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftList = (Array.isArray(left) ? left : []).slice().sort();
    const rightList = (Array.isArray(right) ? right : []).slice().sort();

    return leftList.length === rightList.length && leftList.every((value, index) => value === rightList[index]);
  }

  return left === right;
}

function itemNeedsImageBake(item) {
  const imageUrl = item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "";

  return Boolean(imageUrl) && (
    normalizeImageScale(item?.imageScale) !== normalizeImageFrameScale(item?.imageFrameScale) ||
    normalizeImageOffset(item?.imageOffsetX) !== 0 ||
    normalizeImageOffset(item?.imageOffsetY) !== 0
  );
}

function getVisibleAlphaBounds(imageData, width, height, alphaThreshold = 16) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = imageData[(y * width + x) * 4 + 3];
      if (alpha < alphaThreshold) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    left: minX,
    top: minY,
    right: maxX + 1,
    bottom: maxY + 1
  };
}

async function getAutoImageCrop(item) {
  const imageUrl = item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "";
  if (!imageUrl) {
    return getNormalizedImageCrop(item);
  }

  try {
    const image = await loadImage(resolveImageUrl(imageUrl));
    const sourceRect = getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight, { useCrop: true });
    const width = Math.max(1, Math.round(sourceRect.width));
    const height = Math.max(1, Math.round(sourceRect.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      return getNormalizedImageCrop(item);
    }

    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(
      image,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      0,
      0,
      width,
      height
    );

    const bounds = getVisibleAlphaBounds(context.getImageData(0, 0, width, height).data, width, height);
    if (!bounds) {
      return getNormalizedImageCrop(item);
    }

    const currentCrop = getNormalizedImageCrop(item);
    const nextX = currentCrop.x + (bounds.left / width) * currentCrop.width;
    const nextY = currentCrop.y + (bounds.top / height) * currentCrop.height;
    const nextWidth = ((bounds.right - bounds.left) / width) * currentCrop.width;
    const nextHeight = ((bounds.bottom - bounds.top) / height) * currentCrop.height;

    return {
      x: normalizeImageCropStart(nextX, normalizeImageCropSize(nextWidth)),
      y: normalizeImageCropStart(nextY, normalizeImageCropSize(nextHeight)),
      width: normalizeImageCropSize(nextWidth),
      height: normalizeImageCropSize(nextHeight)
    };
  } catch {
    return getNormalizedImageCrop(item);
  }
}

function restoreLegacyBakedImageScale(item) {
  const frameScale = normalizeImageFrameScale(item?.imageFrameScale);
  const scale = normalizeImageScale(item?.imageScale);

  if (frameScale === 100 || scale !== 100) {
    return item;
  }

  return {
    ...item,
    imageScale: frameScale
  };
}

async function bakeItemImagePresentation(item) {
  const normalizedCrop = getNormalizedImageCrop(item);

  if (!itemNeedsImageBake(item)) {
    const autoCrop = await getAutoImageCrop(item);
    return {
      ...item,
      imageFrameScale: normalizeImageFrameScale(item?.imageFrameScale),
      imageScale: normalizeImageScale(item?.imageScale),
      imageOffsetX: normalizeImageOffset(item?.imageOffsetX),
      imageOffsetY: normalizeImageOffset(item?.imageOffsetY),
      imageCropX: autoCrop.x,
      imageCropY: autoCrop.y,
      imageCropWidth: autoCrop.width,
      imageCropHeight: autoCrop.height
    };
  }

  const autoCrop = await getAutoImageCrop({
    ...item,
    imageCropX: normalizedCrop.x,
    imageCropY: normalizedCrop.y,
    imageCropWidth: normalizedCrop.width,
    imageCropHeight: normalizedCrop.height
  });

  return {
    ...item,
    imageFrameScale: normalizeImageFrameScale(item?.imageScale),
    imageScale: normalizeImageScale(item?.imageScale),
    imageOffsetX: normalizeImageOffset(item?.imageOffsetX),
    imageOffsetY: normalizeImageOffset(item?.imageOffsetY),
    imageCropX: autoCrop.x,
    imageCropY: autoCrop.y,
    imageCropWidth: autoCrop.width,
    imageCropHeight: autoCrop.height
  };
}

function getItemImageStyle(item, { useFrameScale = false, normalizeToFrameScale = false, usePresentation = false } = {}) {
  const frameScale = useFrameScale && usePresentation ? normalizeImageFrameScale(item?.imageFrameScale) : 100;
  const transformFrameScale = normalizeToFrameScale && usePresentation ? normalizeImageFrameScale(item?.imageFrameScale) : 100;
  const scale = usePresentation ? normalizeImageScale(item?.imageScale) : 100;
  const offsetX = usePresentation ? normalizeImageOffset(item?.imageOffsetX) : 0;
  const offsetY = usePresentation ? normalizeImageOffset(item?.imageOffsetY) : 0;
  const effectiveScale = scale / transformFrameScale;

  return {
    "--managed-frame-scale": frameScale / 100,
    "--managed-scale": effectiveScale,
    "--managed-offset-x": `${offsetX}%`,
    "--managed-offset-y": `${offsetY}%`
  };
}

function getManagedImageSourceRect(item, naturalWidth, naturalHeight, { useCrop = false } = {}) {
  const crop = useCrop ? getNormalizedImageCrop(item) : { x: 0, y: 0, width: 100, height: 100 };
  const sourceX = (crop.x / 100) * naturalWidth;
  const sourceY = (crop.y / 100) * naturalHeight;
  const sourceWidth = (crop.width / 100) * naturalWidth;
  const sourceHeight = (crop.height / 100) * naturalHeight;

  return {
    x: sourceX,
    y: sourceY,
    width: Math.max(sourceWidth, 1),
    height: Math.max(sourceHeight, 1)
  };
}

function getManagedImageFrameStyle(item, metrics, options = {}) {
  const crop = options.useCrop && options.usePresentation ? getNormalizedImageCrop(item) : { x: 0, y: 0, width: 100, height: 100 };
  const cropWidth = crop.width / 100;
  const cropHeight = crop.height / 100;
  const naturalWidth = Math.max(metrics?.naturalWidth ?? 1, 1);
  const naturalHeight = Math.max(metrics?.naturalHeight ?? 1, 1);
  const cropAspectRatio = (naturalWidth * cropWidth) / (naturalHeight * cropHeight);

  return {
    aspectRatio: `${cropAspectRatio || 1}`,
    "--managed-crop-aspect": `${cropAspectRatio || 1}`,
    "--managed-base-width": `${100 / cropWidth}%`,
    "--managed-base-height": `${100 / cropHeight}%`,
    "--managed-base-left": `${(-crop.x / crop.width) * 100}%`,
    "--managed-base-top": `${(-crop.y / crop.height) * 100}%`,
    ...getItemImageStyle(item, options)
  };
}

function getManagedImageDrawBox(item, image, frameX, frameY, frameWidth, frameHeight, { useFrameScale = false, useCrop = false, usePresentation = false } = {}) {
  const crop = useCrop && usePresentation ? getNormalizedImageCrop(item) : { x: 0, y: 0, width: 100, height: 100 };
  const scale = (usePresentation ? normalizeImageScale(item?.imageScale) : 100) / (usePresentation ? normalizeImageFrameScale(item?.imageFrameScale) : 100);
  // Match the DOM crop model: keep drawing the full image, then clip the frame.
  // Cropping is expressed through the transformed destination box, not by stretching a pre-cropped source.
  const sourceRect = getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight, { useCrop: false });
  const drawCropWidth = image.naturalWidth * (crop.width / 100);
  const drawCropHeight = image.naturalHeight * (crop.height / 100);
  const cropScale = Math.min(frameWidth / drawCropWidth, frameHeight / drawCropHeight, 1_000);
  const visibleWidth = drawCropWidth * cropScale;
  const visibleHeight = drawCropHeight * cropScale;
  const baseWidth = visibleWidth / (crop.width / 100);
  const baseHeight = visibleHeight / (crop.height / 100);
  const baseX = frameX - (crop.x / 100) * baseWidth;
  const baseY = frameY - (crop.y / 100) * baseHeight;
  const scaledWidth = baseWidth * scale;
  const scaledHeight = baseHeight * scale;
  const offsetX = ((usePresentation ? normalizeImageOffset(item?.imageOffsetX) : 0) / 100) * scaledWidth;
  const offsetY = ((usePresentation ? normalizeImageOffset(item?.imageOffsetY) : 0) / 100) * scaledHeight;

  return {
    sourceRect,
    drawX: baseX + offsetX - (scaledWidth - baseWidth) / 2,
    drawY: baseY + offsetY - (scaledHeight - baseHeight) / 2,
    drawWidth: scaledWidth,
    drawHeight: scaledHeight
  };
}

function drawManagedImageToCanvas(context, item, image, frameX, frameY, frameWidth, frameHeight, options = {}) {
  const { sourceRect, drawX, drawY, drawWidth, drawHeight } = getManagedImageDrawBox(
    item,
    image,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    options
  );
  const rotation = Math.round((Number(options.rotation) || 0) * 10) / 10;

  context.save();
  if (rotation) {
    context.translate(frameX + frameWidth / 2, frameY + frameHeight / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.translate(-(frameX + frameWidth / 2), -(frameY + frameHeight / 2));
  }
  context.beginPath();
  context.rect(frameX, frameY, frameWidth, frameHeight);
  context.clip();
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  context.restore();
}

function getStoredImageMetrics(item) {
  const naturalWidth = Math.max(Number(item?.imageWidth) || 0, 0);
  const naturalHeight = Math.max(Number(item?.imageHeight) || 0, 0);

  if (!naturalWidth || !naturalHeight) {
    return null;
  }

  return {
    naturalWidth,
    naturalHeight
  };
}

function useImageMetrics(imageUrl, initialMetrics = null) {
  const imageUrlCandidates = useMemo(
    () => resolveImageUrlCandidates(imageUrl),
    [imageUrl]
  );
  const cacheKey = imageUrlCandidates.join("|");
  const [metrics, setMetrics] = useState(() => imageMetricsCache.get(cacheKey) ?? initialMetrics ?? null);

  useEffect(() => {
    if (!imageUrlCandidates.length) {
      setMetrics(null);
      return undefined;
    }

    const cached = imageMetricsCache.get(cacheKey);
    if (cached) {
      setMetrics(cached);
      return undefined;
    }

    if (initialMetrics?.naturalWidth && initialMetrics?.naturalHeight) {
      const seededMetrics = {
        ...initialMetrics,
        resolvedSrc: imageUrlCandidates[0]
      };
      imageMetricsCache.set(cacheKey, seededMetrics);
      setMetrics(seededMetrics);
    }

    let cancelled = false;
    const tryLoadCandidate = (candidateIndex) => {
      if (candidateIndex >= imageUrlCandidates.length) {
        const fallbackMetrics = {
          naturalWidth: 1,
          naturalHeight: 1,
          resolvedSrc: imageUrlCandidates[0] ?? ""
        };
        imageMetricsCache.set(cacheKey, fallbackMetrics);

        if (!cancelled) {
          setMetrics(fallbackMetrics);
        }
        return;
      }

      const image = new Image();

      image.onload = () => {
        const nextMetrics = {
          naturalWidth: Math.max(image.naturalWidth || 1, 1),
          naturalHeight: Math.max(image.naturalHeight || 1, 1),
          resolvedSrc: imageUrlCandidates[candidateIndex]
        };

        imageMetricsCache.set(cacheKey, nextMetrics);

        if (!cancelled) {
          setMetrics(nextMetrics);
        }
      };

      image.onerror = () => {
        tryLoadCandidate(candidateIndex + 1);
      };

      image.src = imageUrlCandidates[candidateIndex];
    };

    tryLoadCandidate(0);

    return () => {
      cancelled = true;
    };
  }, [cacheKey, imageUrlCandidates, initialMetrics]);

  return metrics ?? { naturalWidth: 1, naturalHeight: 1, resolvedSrc: imageUrlCandidates[0] ?? "" };
}

function getItemPresentationAspectRatio(item, metricsOverride = null) {
  const resolvedImageUrl = resolveImageUrl(getManagedItemImageSrc(item, "preview"));
  const cachedMetrics = metricsOverride ?? getStoredImageMetrics(item) ?? (resolvedImageUrl ? imageMetricsCache.get(resolvedImageUrl) : null);
  const naturalWidth = Math.max(cachedMetrics?.naturalWidth ?? 1, 1);
  const naturalHeight = Math.max(cachedMetrics?.naturalHeight ?? 1, 1);
  const crop = getNormalizedImageCrop(item);
  const cropWidth = Math.max(crop.width / 100, 0.01);
  const cropHeight = Math.max(crop.height / 100, 0.01);

  return Math.max(0.55, Math.min(1.7, (naturalWidth * cropWidth) / (naturalHeight * cropHeight)));
}

function getBoardAspectSizeBoost(aspectRatio) {
  const normalizedAspectRatio = Math.max(0.55, Math.min(1.7, Number(aspectRatio) || 1));

  if (normalizedAspectRatio < 0.85) {
    return Math.min(1.32, 1 + (0.85 - normalizedAspectRatio) * 0.9);
  }

  if (normalizedAspectRatio > 1.35) {
    return Math.min(1.16, 1 + (normalizedAspectRatio - 1.35) * 0.25);
  }

  return 1;
}

function getItemPresentationSizeMultiplier(item) {
  const frameScale = normalizeImageFrameScale(item?.imageFrameScale);
  const scale = normalizeImageScale(item?.imageScale);
  const aspectRatio = getItemPresentationAspectRatio(item);

  return Math.max(0.82, Math.min(1.32, (Math.max(frameScale, scale) / 100) * getBoardAspectSizeBoost(aspectRatio)));
}

function buildBoardLayoutMetadataByReferenceId(items, metricsByItemId = {}) {
  return Object.fromEntries(
    (Array.isArray(items) ? items : [])
      .filter((item) => item?.id)
      .map((item) => [
        item.id,
        (() => {
          const metricsOverride = metricsByItemId[item.id] ?? null;
          const renderMetadata = buildBoardRenderMetadata(item, metricsOverride);

          return {
            aspectRatio: getItemPresentationAspectRatio(item, metricsOverride),
            sizeMultiplier: renderMetadata.sizeMultiplier,
            renderMetadata
          };
        })()
      ])
  );
}

function getBoardLayoutSignatureEntry(image, item) {
  if (!image?.id || !image?.referenceId) {
    return null;
  }

  const crop = getNormalizedImageCrop(item);

  return {
    id: image.id,
    referenceId: image.referenceId,
    rotation: Math.round((Number(image.rotation) || 0) * 10) / 10,
    imageWidth: Math.max(Number(item?.imageWidth) || 0, 0),
    imageHeight: Math.max(Number(item?.imageHeight) || 0, 0),
    imageScale: normalizeImageScale(item?.imageScale),
    imageFrameScale: normalizeImageFrameScale(item?.imageFrameScale),
    imageOffsetX: normalizeImageOffset(item?.imageOffsetX),
    imageOffsetY: normalizeImageOffset(item?.imageOffsetY),
    imageCropX: crop.x,
    imageCropY: crop.y,
    imageCropWidth: crop.width,
    imageCropHeight: crop.height
  };
}

function getBoardImageDimensionsForItem(item, targetWidth = 220) {
  const width = Math.max(80, Math.round((Number(targetWidth) || 220) * getItemPresentationSizeMultiplier(item)));
  const aspectRatio = getItemPresentationAspectRatio(item);

  return {
    width,
    height: Math.max(80, Math.round(width / aspectRatio))
  };
}

const ManagedItemImage = memo(function ManagedItemImage({
  item,
  alt = "",
  className = "",
  frameRef = null,
  imageRef = null,
  dataItemId = "",
  useFrameScale = false,
  normalizeToFrameScale = false,
  useCrop = false,
  usePresentation = false,
  onMetrics = null,
  variant = "preview",
  loadingStrategy = "lazy",
  decodingStrategy = "async"
}) {
  const resolvedImageUrl = resolveImageUrl(getManagedItemImageSrc(item, variant));
  const seedMetrics = useMemo(() => getStoredImageMetrics(item), [item]);
  const metrics = useImageMetrics(resolvedImageUrl, seedMetrics);
  const displayImageUrl = metrics?.resolvedSrc || resolveImageUrlCandidates(resolvedImageUrl)[0] || "";
  const [isLoaded, setIsLoaded] = useState(() => Boolean(seedMetrics) || Boolean(metrics?.resolvedSrc));
  const frameStyle = useMemo(
    () => getManagedImageFrameStyle(item, metrics, { useFrameScale, normalizeToFrameScale, useCrop, usePresentation }),
    [item, metrics, useFrameScale, normalizeToFrameScale, useCrop, usePresentation]
  );

  useEffect(() => {
    if (typeof onMetrics === "function" && resolvedImageUrl) {
      onMetrics(metrics);
    }
  }, [metrics.naturalHeight, metrics.naturalWidth, onMetrics, resolvedImageUrl]);

  useEffect(() => {
    setIsLoaded(Boolean(seedMetrics) || Boolean(metrics?.resolvedSrc));
  }, [displayImageUrl, metrics?.resolvedSrc, seedMetrics]);

  if (!displayImageUrl) {
    return null;
  }

  if (!usePresentation) {
    return (
      <img
        key={displayImageUrl}
        ref={imageRef}
        src={displayImageUrl}
        alt={alt}
        className={`managed-image managed-image-plain ${!isLoaded ? "is-loading" : ""} ${className}`.trim()}
        data-item-id={dataItemId || item?.id || ""}
        loading={loadingStrategy}
        decoding={decodingStrategy}
        onLoad={() => setIsLoaded(true)}
      />
    );
  }

  return (
      <span
        ref={frameRef}
        className={`managed-image ${!isLoaded ? "is-loading" : ""} ${className}`.trim()}
      style={frameStyle}
      data-item-id={dataItemId || item?.id || ""}
    >
      <img
        key={displayImageUrl}
        ref={imageRef}
        src={displayImageUrl}
        alt={alt}
        className="managed-image-content"
        loading={loadingStrategy}
        decoding={decodingStrategy}
        onLoad={() => setIsLoaded(true)}
      />
    </span>
  );
});

const BoardCanvasImage = memo(function BoardCanvasImage({
  image,
  item,
  isActive,
  onImagePointerDown,
  onImageDoubleClick,
  onEditImage,
  onSelectImage,
  onMetrics
}) {
  const resolvedImageUrl = resolveImageUrl(getManagedItemImageSrc(item, "preview"));
  const seedMetrics = useMemo(() => getStoredImageMetrics(item), [item]);
  const metrics = useImageMetrics(resolvedImageUrl, seedMetrics);
  const lastMetricsKeyRef = useRef("");
  const renderMetadata = useMemo(
    () => buildBoardRenderMetadata({ ...item, rotation: image.rotation }, metrics),
    [image.rotation, item, metrics]
  );
  const renderedBounds = useMemo(
    () => getBoardItemRenderedBounds(image, renderMetadata),
    [image, renderMetadata]
  );
  const imageStyle = useMemo(
    () => ({
      left: `${renderedBounds.collisionRect.left}px`,
      top: `${renderedBounds.collisionRect.top}px`,
      width: `${renderedBounds.collisionRect.width}px`,
      height: `${renderedBounds.collisionRect.height}px`,
      zIndex: image.zIndex
    }),
    [image.zIndex, renderedBounds.collisionRect.height, renderedBounds.collisionRect.left, renderedBounds.collisionRect.top, renderedBounds.collisionRect.width]
  );
  const imageVisualStyle = useMemo(
    () => ({
      left: `${renderedBounds.visibleRect.left - renderedBounds.collisionRect.left}px`,
      top: `${renderedBounds.visibleRect.top - renderedBounds.collisionRect.top}px`,
      width: `${renderedBounds.visibleRect.width}px`,
      height: `${renderedBounds.visibleRect.height}px`,
      transform: `rotate(${renderMetadata.rotation}deg)`
    }),
    [
      renderMetadata.rotation,
      renderedBounds.collisionRect.left,
      renderedBounds.collisionRect.top,
      renderedBounds.visibleRect.height,
      renderedBounds.visibleRect.left,
      renderedBounds.visibleRect.top,
      renderedBounds.visibleRect.width
    ]
  );

  useEffect(() => {
    const metricsKey = `${resolvedImageUrl}:${metrics.naturalWidth}:${metrics.naturalHeight}`;

    if (
      typeof onMetrics === "function" &&
      resolvedImageUrl &&
      lastMetricsKeyRef.current !== metricsKey
    ) {
      lastMetricsKeyRef.current = metricsKey;
      onMetrics(metrics);
    }
  }, [metrics.naturalHeight, metrics.naturalWidth, onMetrics, resolvedImageUrl]);

  return (
    <div
      className={`board-image ${isActive ? "is-active" : ""}`}
      style={imageStyle}
    >
      <button
        type="button"
        className="board-image-hit-area"
        onPointerDown={(event) => onImagePointerDown(event, image)}
        onDoubleClick={() => onImageDoubleClick(image, item)}
        aria-label={`${buildDisplayName(item)} preview`}
      >
        <span
          className={`board-image-visual ${isActive ? "is-active" : ""}`}
          style={imageVisualStyle}
        >
          <ManagedItemImage
            item={item}
            alt={item.name}
            className="board-image-managed"
            dataItemId={item.id}
            useCrop
            usePresentation
          />
        </span>
      </button>
      <div className="board-image-actions">
        <button
          type="button"
          className="board-image-picker-button"
          onClick={(event) => {
            event.stopPropagation();
            onEditImage(item);
          }}
          aria-label={`Edit ${buildDisplayName(item)}`}
        >
          Edit
        </button>
        <button
          type="button"
          className="board-image-picker-button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectImage(image);
          }}
          aria-label={`Select ${buildDisplayName(item)}`}
        >
          Select
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) =>
  prevProps.image === nextProps.image &&
  prevProps.item === nextProps.item &&
  prevProps.isActive === nextProps.isActive
);

const LibraryGridCard = memo(function LibraryGridCard({
  item,
  isSelected,
  isExcluded,
  cardStyle = null,
  onSelectReference,
  onOpenReferencePreview,
  onVisibleImageMount
}) {
  const itemName = useMemo(() => buildDisplayName(item), [item]);
  const itemTagsLabel = useMemo(() => {
    const normalizedTags = uniqueTags(item.tags);
    return normalizedTags.length ? normalizedTags.map((tag) => getLeafTagLabel(tag)).join(", ") : "No tags";
  }, [item]);

  useEffect(() => {
    onVisibleImageMount?.();
  }, [onVisibleImageMount]);

  return (
    <article
      className={`wardrobe-card ${isExcluded ? "is-excluded" : ""} ${isSelected ? "is-selected" : ""}`}
      style={cardStyle ?? undefined}
    >
      <button
        type="button"
        className="wardrobe-preview"
        onClick={(event) => onSelectReference(item.id, event)}
        onDoubleClick={() => onOpenReferencePreview(item)}
        aria-pressed={isSelected}
      >
        <ManagedItemImage
          item={item}
          alt={item.name}
          dataItemId={item.id}
          variant="thumbnail"
          loadingStrategy="eager"
          decodingStrategy="sync"
        />
      </button>

      <div className="wardrobe-meta">
        <strong title={itemName}>
          <span>{itemName}</span>
          {item.favorite ? <span className="wardrobe-meta-favorite" aria-label="Favorite">♥</span> : null}
        </strong>
        <span title={itemTagsLabel}>{itemTagsLabel}</span>
      </div>
    </article>
  );
}, (prevProps, nextProps) =>
  prevProps.item === nextProps.item &&
  prevProps.isSelected === nextProps.isSelected &&
  prevProps.isExcluded === nextProps.isExcluded &&
  prevProps.cardStyle?.top === nextProps.cardStyle?.top &&
  prevProps.cardStyle?.left === nextProps.cardStyle?.left &&
  prevProps.cardStyle?.width === nextProps.cardStyle?.width &&
  prevProps.cardStyle?.height === nextProps.cardStyle?.height
);

function itemNeedsStyleWeightMappingMigration(originalItem, nextItem) {
  return (
    normalizeWeight(originalItem.weight) !== nextItem.weight ||
    !areEditorValuesEqual(normalizeTagList(originalItem.styleTags, styleTagOptions), nextItem.styleTags)
  );
}

function getAdvancedOverrideFields(item, defaults) {
  return advancedTrackedFields.filter((field) => !areEditorValuesEqual(item[field], defaults[field]));
}

function applyGarmentRules(nextDraft, defaults) {
  const resolvedDraft = { ...nextDraft };

  if (resolvedDraft.garmentType !== "Top" && resolvedDraft.garmentType !== "Outerwear") {
    resolvedDraft.layerType = "Both";
  } else if (!layerTypes.includes(resolvedDraft.layerType)) {
    resolvedDraft.layerType = defaults.layerType;
  }

  if (resolvedDraft.garmentType !== "Accessory") {
    resolvedDraft.accessorySlot = "";
  } else if (!resolvedDraft.accessorySlot) {
    resolvedDraft.accessorySlot = defaults.accessorySlot;
  }

  if (resolvedDraft.garmentType === "Accessory" && !resolvedDraft.size.trim()) {
    resolvedDraft.size = defaults.size || "OS";
  }

  return resolvedDraft;
}

function applyTypeDefaultsToDraft(current, nextType) {
  const currentDefaults = resolveTypeDefaults(current.type);
  const nextDefaults = resolveTypeDefaults(nextType);
  const nextDraft = {
    ...current,
    type: nextDefaults.type
  };

  typeDerivedFields.forEach((field) => {
    nextDraft[field] = areEditorValuesEqual(current[field], currentDefaults[field]) ? nextDefaults[field] : current[field];
  });

  return applyGarmentRules(nextDraft, nextDefaults);
}

const namedColorHex = {
  black: "#171717",
  gray: "#777777",
  grey: "#777777",
  charcoal: "#333333",
  sumi: "#363432",
  white: "#f1f0eb",
  beige: "#cbb995",
  cream: "#e8dcc5",
  brown: "#6d4a2f",
  indigo: "#263f6a",
  blue: "#3f6da8",
  navy: "#1e2e4d",
  red: "#a43d35",
  green: "#4d6f45",
  olive: "#6b7147",
  yellow: "#d7b44a",
  orange: "#c66d35",
  purple: "#6b4f8f",
  pink: "#c98098"
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) {
    return null;
  }

  const value = Number.parseInt(clean, 16);
  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getColorRgb(item) {
  const color = normalizeType(item.color);
  if (!color) {
    return null;
  }

  const namedMatch = Object.entries(namedColorHex).find(([name]) => color.includes(name));
  return namedMatch ? hexToRgb(namedMatch[1]) : null;
}

function slugPart(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildBaseItemId(item) {
  const segments = [item.garmentType];

  if (item.garmentType === "Top" || item.garmentType === "Outerwear") {
    segments.push(item.layerType);
  }

  if (item.garmentType === "Accessory" && item.accessorySlot) {
    segments.push(item.accessorySlot);
  }

  if (item.type) {
    segments.push(item.type);
  }

  if (item.brand) {
    segments.push(item.brand);
  }

  if (item.name) {
    segments.push(item.name);
  }

  if (item.size) {
    segments.push(item.size);
  }

  if (item.color) {
    segments.push(item.color);
  }

  return segments
    .map((segment) => slugPart(segment || ""))
    .filter(Boolean)
    .join("_");
}

function createUniqueItemId(item, items, currentId = null) {
  const baseId = buildBaseItemId(item) || "item";
  let candidateId = baseId;
  let counter = 2;

  while (items.some((existing) => existing.id === candidateId && existing.id !== currentId)) {
    candidateId = `${baseId}_${counter}`;
    counter += 1;
  }

  return candidateId;
}

function createUniqueItemName(name, items, currentId = null) {
  const trimmedName = String(name ?? "").trim();

  if (!trimmedName) {
    return "";
  }

  const normalizedBaseName = trimmedName.toLowerCase();
  const existingNames = new Set(
    items
      .filter((item) => item?.id !== currentId)
      .map((item) => String(item?.name ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  if (!existingNames.has(normalizedBaseName)) {
    return trimmedName;
  }

  let suffix = 2;
  let candidateName = `${trimmedName} ${suffix}`;

  while (existingNames.has(candidateName.toLowerCase())) {
    suffix += 1;
    candidateName = `${trimmedName} ${suffix}`;
  }

  return candidateName;
}

function buildDisplayName(item) {
  const parts = [item.brand, item.name]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length) {
    return parts.join(" ");
  }

  return item.garmentType || "Untitled reference";
}

function hasNamingMetadata(item) {
  return [item.name, item.brand, item.type, item.color].some((value) => value?.trim());
}

function getAccessoryLabel(slot) {
  const labels = {
    Glasses: "Glasses",
    Neck: "Neck",
    LeftHand: "Left hand",
    RightHand: "Right hand",
    Bag: "Bag",
    Belt: "Belt"
  };

  return labels[slot] ?? slot;
}

function getSlotLabel(slot) {
  const labels = {
    Headwear: "Headwear",
    TopInner: "Top",
    TopOuter: "Outer layer",
    Bottom: "Bottom",
    Footwear: "Footwear"
  };

  return labels[slot] ?? slot;
}

function hasAccessoryItems(outfit) {
  return accessorySlots.some((slot) => Boolean(outfit?.[slot]));
}

function getUniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function normalizeMetadataFilterState(filters) {
  return {
    tags: uniqueTags(filters?.tags),
    excludedTags: uniqueTags(filters?.excludedTags),
    tagMatchMode: filters?.tagMatchMode === "all" ? "all" : "any",
    favorite: filters?.favorite === "yes" || filters?.favorite === "no" ? filters.favorite : ""
  };
}

function normalizeWardrobeFilterState(filters) {
  return {
    tags: uniqueTags(filters?.tags),
    excludedTags: uniqueTags(filters?.excludedTags),
    tagMatchMode: filters?.tagMatchMode === "all" ? "all" : "any",
    laundry: filters?.laundry === "show" || filters?.laundry === "hide" ? filters.laundry : "",
    favorite: filters?.favorite === "yes" || filters?.favorite === "no" ? filters.favorite : ""
  };
}

function splitGroupedTag(tag, nestedParentGroups = new Set()) {
  const [parent, ...rest] = String(tag ?? "").split("/");
  const child = rest.join("/").trim();

  if (!child) {
    const normalizedParent = parent?.trim?.() ?? String(tag ?? "");

    if (nestedParentGroups.has(normalizedParent.toUpperCase())) {
      return {
        group: normalizedParent.toUpperCase(),
        label: normalizedParent
      };
    }

    return {
      group: "UNGROUPED",
      label: normalizedParent
    };
  }

  return {
    group: (parent?.trim?.() ?? "").toUpperCase(),
    label: child
  };
}

function getBoardTagParentGroup(tag) {
  const [parent, child] = String(tag ?? "").split("/");
  return child ? normalizeTag(parent) : "";
}

function splitTagPath(tag) {
  return String(tag ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getLeafTagLabel(tag) {
  const parts = splitTagPath(tag);
  return parts[parts.length - 1] ?? String(tag ?? "").trim();
}

function buildNestedTagNodes(entries = []) {
  const root = {
    key: "root",
    path: "",
    label: "",
    ownEntry: null,
    children: new Map()
  };

  entries.forEach((entry) => {
    const parts = splitTagPath(entry.tag);

    if (!parts.length) {
      return;
    }

    let currentNode = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, {
          key: currentPath,
          path: currentPath,
          label: part,
          ownEntry: null,
          children: new Map()
        });
      }

      currentNode = currentNode.children.get(part);

      if (index === parts.length - 1) {
        currentNode.ownEntry = entry;
      }
    });
  });

  return root;
}

function finalizeNestedTagNodes(node, sortMode = "count") {
  const childNodes = [...node.children.values()].map((child) => finalizeNestedTagNodes(child, sortMode));
  const ownCount = node.ownEntry?.count ?? 0;
  const descendantCount = childNodes.reduce((sum, child) => sum + child.totalCount, 0);
  const totalCount = ownCount + descendantCount;
  const tagTargets = uniqueTags([
    ...(node.ownEntry ? [node.ownEntry.tag] : []),
    ...childNodes.flatMap((child) => child.tagTargets)
  ]);
  const compareNodes = (leftNode, rightNode) => (
    sortMode === "alpha"
      ? leftNode.label.localeCompare(rightNode.label)
      : rightNode.totalCount - leftNode.totalCount || leftNode.label.localeCompare(rightNode.label)
  );

  return {
    ...node,
    ownCount,
    totalCount,
    tagTargets,
    childNodes: childNodes.sort(compareNodes),
    isLeaf: childNodes.length === 0
  };
}

function stopNestedTagTreeEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

function ExpandArrow({
  className,
  isExpanded,
  label,
  onToggle,
  debugEnabled = false,
  debugScope = "tag-tree",
  debugId = label
}) {
  return (
    <button
      type="button"
      className={className}
      data-debug-id={`${debugScope}:arrow:${debugId}`}
      onMouseDown={(event) => {
        logNestedTagDebug(debugEnabled, debugScope, "ExpandArrow.onMouseDown", event, {
          debugId,
          isExpanded
        });
      }}
      onPointerDown={(event) => {
        logNestedTagDebug(debugEnabled, debugScope, "ExpandArrow.onPointerDown", event, {
          debugId,
          isExpanded
        });
        stopNestedTagTreeEvent(event);
      }}
      onClick={(event) => {
        logNestedTagDebug(debugEnabled, debugScope, "ExpandArrow.onClick", event, {
          debugId,
          isExpanded,
          nextExpanded: !isExpanded
        });
        stopNestedTagTreeEvent(event);
        onToggle();
      }}
      onFocus={(event) => {
        logNestedTagDebug(debugEnabled, debugScope, "ExpandArrow.onFocus", event, {
          debugId,
          isExpanded
        });
      }}
      aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
      aria-expanded={isExpanded}
    >
      {isExpanded ? "▾" : "▸"}
    </button>
  );
}

function TagTree({
  entries = [],
  selectedTags = [],
  excludedTags = [],
  onToggleTag,
  onToggleGroup,
  storageKey = "default",
  noTagsCount = 0,
  variant = "default",
  headerActions = null,
  debugEnabled = false,
  debugScope = "tag-tree"
}) {
  const [sortMode, setSortMode] = useState("count");
  const [collapsedGroups, setCollapsedGroups] = useState({});

  if (!entries.length && !noTagsCount) {
    return null;
  }

  const normalizedSelectedTags = uniqueTags(selectedTags);
  const normalizedExcludedTags = uniqueTags(excludedTags);
  const noTagsSelected = normalizedSelectedTags.includes(NO_TAGS_FILTER);
  const noTagsExcluded = normalizedExcludedTags.includes(NO_TAGS_FILTER);
  const sortedEntries = [...entries].sort((left, right) =>
    sortMode === "alpha"
      ? left.tag.localeCompare(right.tag)
      : right.count - left.count || left.tag.localeCompare(right.tag)
  );
  const rootNode = finalizeNestedTagNodes(buildNestedTagNodes(sortedEntries), sortMode);

  function toggleCollapsedGroup(groupKey) {
    const collapsedKey = `${storageKey}:${groupKey}`;
    const nextCollapsed = !(collapsedGroups[collapsedKey] ?? true);

    if (debugEnabled) {
      const details = {
        groupKey,
        collapsedKey,
        nextCollapsed,
        nextExpanded: !nextCollapsed
      };
      console.log(`[nested-tag-debug] ${debugScope} toggleCollapsedGroup`, details);
      recordNestedTagDebugMessage(debugEnabled, debugScope, "toggleCollapsedGroup", details);
    }

    setCollapsedGroups((current) => ({
      ...current,
      [collapsedKey]: nextCollapsed
    }));
  }

  function activateTag(event, tag) {
    const mode = event.shiftKey ? "exclude" : "include";
    onToggleTag(tag, mode);
  }

  function activateTagGroup(event, tags) {
    const mode = event.shiftKey ? "exclude" : "include";

    if (onToggleGroup) {
      onToggleGroup(tags, mode);
      return;
    }

    tags.forEach((tag) => onToggleTag(tag, mode));
  }

  function getGroupVisualState(tagTargets) {
    const includedCount = tagTargets.filter((tag) => normalizedSelectedTags.includes(tag)).length;
    const excludedCount = tagTargets.filter((tag) => normalizedExcludedTags.includes(tag)).length;

    return {
      isActive: includedCount === tagTargets.length && tagTargets.length > 0,
      isExcluded: excludedCount === tagTargets.length && tagTargets.length > 0,
      isPartial:
        (includedCount > 0 && includedCount < tagTargets.length) ||
        (excludedCount > 0 && excludedCount < tagTargets.length) ||
        (includedCount > 0 && excludedCount > 0)
    };
  }

  function renderTagNode(node, depth = 0) {
    const isSelected = normalizedSelectedTags.includes(node.path);
    const isExcluded = normalizedExcludedTags.includes(node.path);
    const collapsedKey = `${storageKey}:${node.key}`;
    const isCollapsed = collapsedGroups[collapsedKey] ?? true;
    const hasChildren = node.childNodes.length > 0;
    const groupState = hasChildren ? getGroupVisualState(node.tagTargets) : null;
    const rowClassName = hasChildren
      ? `tag-tree-row tag-tree-row-parent ${groupState.isActive ? "is-active" : ""} ${groupState.isExcluded ? "is-excluded" : ""} ${groupState.isPartial ? "is-partial" : ""}`
      : `tag-tree-row tag-tree-row-leaf ${isSelected ? "is-active" : ""} ${isExcluded ? "is-excluded" : ""}`;
    const leafIndent = depth > 0 ? depth * 10 : 0;
    const rowStyle = {
      "--tag-tree-indent": `${hasChildren ? depth * 10 : leafIndent}px`
    };
    const label = node.label;
    const debugId = node.path;

    if (!hasChildren) {
      const leafClassName = `${rowClassName} ${depth > 0 ? "tag-tree-row-leaf-nested" : "tag-tree-row-leaf-top"}`;
      const leafMainClassName = depth > 0
        ? "tag-tree-row-main tag-tree-row-main-leaf-nested"
        : "tag-tree-row-main tag-tree-row-main-leaf-top";

      return (
        <button
          key={node.key}
          type="button"
          className={leafClassName}
          data-debug-id={`${debugScope}:row:${debugId}`}
          style={rowStyle}
          onMouseDown={(event) => {
            logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowLeaf.onMouseDown", event, { debugId });
          }}
          onPointerDown={(event) => {
            logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowLeaf.onPointerDown", event, { debugId });
          }}
          onClick={(event) => {
            logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowLeaf.onClick", event, { debugId });
            stopNestedTagTreeEvent(event);
            activateTag(event, node.path);
          }}
          onFocus={(event) => {
            logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowLeaf.onFocus", event, { debugId });
          }}
          aria-pressed={isSelected || isExcluded}
          title="Click to include. Shift-click to exclude."
        >
          <span className={leafMainClassName}>
            <span className="tag-tree-row-indent" aria-hidden="true" />
            <span className="tag-tree-row-prefix" aria-hidden="true" />
            <span className="tag-tree-row-label">{label}</span>
          </span>
          <small className="tag-tree-row-count">{node.ownCount}</small>
        </button>
      );
    }

    return (
      <section key={node.key} className="tag-tree-group">
        <div
          className={rowClassName}
          style={rowStyle}
          data-debug-id={`${debugScope}:row-wrapper:${debugId}`}
          onPointerDownCapture={(event) => {
            logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowWrapper.onPointerDownCapture", event, {
              debugId,
              isCollapsed
            });
          }}
          onClickCapture={(event) => {
            logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowWrapper.onClickCapture", event, {
              debugId,
              isCollapsed
            });
          }}
          onFocusCapture={(event) => {
            logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowWrapper.onFocusCapture", event, {
              debugId,
              isCollapsed
            });
          }}
        >
          <ExpandArrow
            className="tag-tree-chevron"
            isExpanded={!isCollapsed}
            label={label}
            onToggle={() => toggleCollapsedGroup(node.key)}
            debugEnabled={debugEnabled}
            debugScope={debugScope}
            debugId={debugId}
          />
          <button
            type="button"
            className="tag-tree-row-main tag-tree-row-main-button tag-tree-row-main-button-parent"
            data-debug-id={`${debugScope}:row-main:${debugId}`}
            onMouseDown={(event) => {
              logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowMain.onMouseDown", event, {
                debugId,
                isCollapsed
              });
            }}
            onPointerDown={(event) => {
              logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowMain.onPointerDown", event, {
                debugId,
                isCollapsed
              });
            }}
            onClick={(event) => {
              logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowMain.onClick", event, {
                debugId,
                isCollapsed
              });
              stopNestedTagTreeEvent(event);
              activateTagGroup(event, node.tagTargets);
            }}
            onFocus={(event) => {
              logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowMain.onFocus", event, {
                debugId,
                isCollapsed
              });
            }}
            aria-pressed={groupState.isActive || groupState.isExcluded || groupState.isPartial}
            title="Click to include all children. Shift-click to exclude all children."
          >
            <span className="tag-tree-row-indent" aria-hidden="true" />
            <span className="tag-tree-row-label">{label}</span>
          </button>
          <small className="tag-tree-row-count">{node.totalCount}</small>
        </div>

        {!isCollapsed ? (
          <div className="tag-tree-children" data-debug-id={`${debugScope}:children:${debugId}`}>
            {node.childNodes.map((childNode) => renderTagNode(childNode, depth + 1))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div
      className={`tag-tree ${variant === "compact" ? "is-compact" : ""}`.trim()}
      data-debug-id={`${debugScope}:root`}
      onPointerDownCapture={(event) => {
        logNestedTagDebug(debugEnabled, debugScope, "TagTree.onPointerDownCapture", event);
      }}
      onClickCapture={(event) => {
        logNestedTagDebug(debugEnabled, debugScope, "TagTree.onClickCapture", event);
      }}
      onFocusCapture={(event) => {
        logNestedTagDebug(debugEnabled, debugScope, "TagTree.onFocusCapture", event);
      }}
    >
      {variant === "compact" ? (
        <div className="tag-tree-header tag-tree-header-compact">
          <div className="tag-tree-meta">
            <button
              type="button"
              className="tag-tree-sort-button"
              onClick={(event) => {
                logNestedTagDebug(debugEnabled, debugScope, "TagTreeSort.onClick", event);
                stopNestedTagTreeEvent(event);
                setSortMode((current) => (current === "count" ? "alpha" : "count"));
              }}
            >
              {sortMode === "count" ? "COUNT" : "A-Z"}
            </button>
            {headerActions}
          </div>
        </div>
      ) : (
        <div className="tag-tree-header tag-tree-header-default">
          <button
            type="button"
            className="tag-tree-sort-button"
            onClick={(event) => {
              logNestedTagDebug(debugEnabled, debugScope, "TagTreeSort.onClick", event);
              stopNestedTagTreeEvent(event);
              setSortMode((current) => (current === "count" ? "alpha" : "count"));
            }}
          >
            {sortMode === "count" ? "COUNT" : "A-Z"}
          </button>
        </div>
      )}

      <div className="tag-tree-list" aria-label="Tag filters">
        {noTagsCount ? (
          <button
            type="button"
            className={`tag-tree-row tag-tree-row-leaf tag-tree-row-untagged ${noTagsSelected ? "is-active" : ""} ${noTagsExcluded ? "is-excluded" : ""}`}
            data-debug-id={`${debugScope}:row:untagged`}
            onClick={(event) => {
              logNestedTagDebug(debugEnabled, debugScope, "TagTreeRowUntagged.onClick", event, {
                debugId: "untagged"
              });
              stopNestedTagTreeEvent(event);
              activateTag(event, NO_TAGS_FILTER);
            }}
            aria-pressed={noTagsSelected || noTagsExcluded}
            title="Click to include. Shift-click to exclude."
          >
            <span className="tag-tree-row-main tag-tree-row-main-leaf tag-tree-row-main-untagged">
              <span className="tag-tree-row-label is-untagged">Untagged</span>
            </span>
            <small className="tag-tree-row-count">{noTagsCount}</small>
          </button>
        ) : null}

        {rootNode.childNodes.map((node) => renderTagNode(node))}
      </div>
    </div>
  );
}

function hasActiveFilterValue(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function countActiveFilterValues(filters) {
  return Object.entries(filters ?? {}).filter(([key, value]) => {
    if (key === "tagMatchMode") {
      return value === "all";
    }

    return hasActiveFilterValue(value);
  }).length;
}

function getTagFrequencyEntries(items) {
  const counts = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    uniqueTags(item?.tags).forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

function matchesMetadataTagFilter(itemTags, selectedTags, excludedTags = [], matchMode = "all") {
  return matchesTagFilter(itemTags, {
    includeTags: selectedTags,
    excludeTags: excludedTags,
    matchMode,
    noTagsToken: NO_TAGS_FILTER
  });
}

function toggleTagFilterSelection(currentTags, opposingTagsOrTag, maybeTag) {
  const isLegacyCall = typeof maybeTag === "undefined";
  const tag = maybeTag ?? opposingTagsOrTag;
  const opposingTags = Array.isArray(opposingTagsOrTag) && !isLegacyCall ? opposingTagsOrTag : [];
  const normalizedCurrentTags = uniqueTags(currentTags);
  const normalizedOpposingTags = uniqueTags(opposingTags);
  const nextCurrentTags = normalizedCurrentTags.includes(tag)
    ? normalizedCurrentTags.filter((selectedTag) => selectedTag !== tag)
    : [...normalizedCurrentTags, tag];
  const normalizedNextCurrentTags = uniqueTags(nextCurrentTags);

  if (isLegacyCall) {
    return normalizedNextCurrentTags;
  }

  return {
    current: normalizedNextCurrentTags,
    opposing: normalizedOpposingTags.filter((selectedTag) => selectedTag !== tag)
  };
}

function matchesMoodboardMetadataFilters(item, filters) {
  const normalizedFilters = normalizeMetadataFilterState(filters);

  return (
    matchesMetadataTagFilter(
      item.tags,
      normalizedFilters.tags,
      normalizedFilters.excludedTags,
      normalizedFilters.tagMatchMode
    ) &&
    (!normalizedFilters.favorite ||
      (normalizedFilters.favorite === "yes" ? Boolean(item.favorite) : !item.favorite))
  );
}

function getMetadataFilteredItems(items, filters) {
  const normalizedFilters = normalizeMetadataFilterState(filters);

  if (!countActiveFilterValues(normalizedFilters)) {
    return items;
  }

  return items.filter((item) => matchesMoodboardMetadataFilters(item, normalizedFilters));
}

function matchesWardrobeFilters(item, filters, ignoredKeys = []) {
  const ignored = new Set(ignoredKeys);
  const normalizedFilters = normalizeWardrobeFilterState(filters);
  const ignoreTagFilters =
    ignored.has("tags") || ignored.has("excludedTags") || ignored.has("tagMatchMode");

  return (
    (ignoreTagFilters ||
      matchesMetadataTagFilter(
        item.tags,
        normalizedFilters.tags,
        normalizedFilters.excludedTags,
        normalizedFilters.tagMatchMode
      )) &&
    (ignored.has("favorite") ||
      !normalizedFilters.favorite ||
      (normalizedFilters.favorite === "yes" ? Boolean(item.favorite) : !item.favorite))
  );
}

function matchesMetadataFilter(value, filterValue) {
  if (!filterValue) {
    return true;
  }

  if (filterValue === "__none__") {
    return !value;
  }

  return value === filterValue;
}

function normalizeItemColor(value) {
  const trimmed = value?.trim?.() ?? "";

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("#")) {
    return trimmed.toUpperCase();
  }

  return trimmed
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getNumericValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareItemsByCreatedAt(leftItem, rightItem, direction = "desc") {
  const leftCreatedAt = normalizeCreatedAt(leftItem?.createdAt);
  const rightCreatedAt = normalizeCreatedAt(rightItem?.createdAt);

  if (leftCreatedAt && rightCreatedAt && leftCreatedAt !== rightCreatedAt) {
    return direction === "asc" ? leftCreatedAt - rightCreatedAt : rightCreatedAt - leftCreatedAt;
  }

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt ? -1 : 1;
  }

  return 0;
}

const defaultMetadataCorrections = {
  headwear_cap_beige: {
    name: "R18C1 Shallow Cap Reed Linen",
    retailValue: "94",
    brand: "Man-tle",
    type: "Cap",
    size: "OS",
    garmentType: "Headwear",
    layerType: "Both",
    accessorySlot: "",
    color: "Beige",
    list: "Wardrobe"
  },
  top_shirt_111: {
    name: "Lot.111 Work Shirt",
    retailValue: "263",
    brand: "Taiga Takahashi",
    type: "Shirt",
    size: "16",
    garmentType: "Top",
    layerType: "Inner",
    accessorySlot: "",
    color: "Indigo",
    list: "Wardrobe"
  },
  top_jacket_303sumi: {
    name: "Lot.303 Coverall",
    retailValue: "316",
    brand: "Taiga Takahashi",
    type: "Jacket",
    size: "40",
    garmentType: "Top",
    layerType: "Outer",
    accessorySlot: "",
    color: "Sumi",
    list: "Wardrobe"
  },
  bottom_204_brown: {
    name: "Lot.204 Engineer Trousers",
    retailValue: "228",
    brand: "Taiga Takahashi",
    type: "Trousers",
    size: "34",
    garmentType: "Bottom",
    layerType: "Both",
    accessorySlot: "",
    color: "Brown",
    list: "Wardrobe"
  },
  footwear_sneaker_gat: {
    name: "GAT",
    retailValue: "30",
    brand: "Vintage",
    type: "Sneakers",
    size: "45",
    garmentType: "Footwear",
    layerType: "Both",
    accessorySlot: "",
    color: "White",
    list: "Wardrobe"
  }
};

const defaultMetadataCorrectionById = {
  headwear_cap_default_beige_os_beige: defaultMetadataCorrections.headwear_cap_beige,
  headwear_cap_man_tle_r18c1_shallow_cap_reed_linen_os_beige: defaultMetadataCorrections.headwear_cap_beige,
  top_inner_shirt_default_white_size_m: defaultMetadataCorrections.top_shirt_111,
  top_inner_shirt_taiga_takahashi_lot_111_work_shirt_16_indigo: defaultMetadataCorrections.top_shirt_111,
  top_outer_jacket_default_sumi_size_m: defaultMetadataCorrections.top_jacket_303sumi,
  top_outer_jacket_taiga_takahashi_lot_303_coverall_40_sumi: defaultMetadataCorrections.top_jacket_303sumi,
  bottom_trousers_default_brown_size_m: defaultMetadataCorrections.bottom_204_brown,
  bottom_trousers_brown_trousers_m_brown: defaultMetadataCorrections.bottom_204_brown,
  bottom_trousers_taiga_takahashi_lot_204_engineer_trousers_34_brown: defaultMetadataCorrections.bottom_204_brown,
  footwear_sneakers_default_gat_size_42: defaultMetadataCorrections.footwear_sneaker_gat,
  footwear_sneakers_vintage_gat_45_white: defaultMetadataCorrections.footwear_sneaker_gat
};

function getImageStem(imageUrl) {
  const filename = stripViteHash(getImageFilename(imageUrl));
  const extensionIndex = filename.lastIndexOf(".");
  return extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
}

function getDefaultMetadataCorrection(item) {
  return defaultMetadataCorrectionById[item.id] ?? defaultMetadataCorrections[getImageStem(item.imageUrl)];
}

function normalizeGarmentType(item) {
  if (item.garmentType === "Top" && item.layerType === "Outer") {
    return "Outerwear";
  }

  return garmentTypes.includes(item.garmentType) ? item.garmentType : "Top";
}

function normalizeItem(item) {
  const migratedItem = migrateReferenceMetadataToTags(item);
  const value = item.value ?? "";
  const retailValue = item.retailValue ?? "";
  const normalizedImages = normalizeItemImages(item);
  const previewImage = createImageAsset({
    ...getPreviewImageAsset(item),
    src: resolveImageUrl(getPreviewImageSrc(item))
  });
  const imageUrl = previewImage.src;
  const correction = getDefaultMetadataCorrection({ ...item, imageUrl });
  const { tags } = migratedItem;
  const imageWidth = normalizeWholeNumber(previewImage.width || item.imageWidth);
  const imageHeight = normalizeWholeNumber(previewImage.height || item.imageHeight);
  const sourceIdentity = normalizeItemSourceIdentity(item, {
    fallbackSourceOriginalFilename: normalizeFileMetadataText(item.sourceOriginalFilename || item.originalFilename || previewImage.originalFilename),
    defaultRelinkStatus: normalizedImages.originalPreserved ? "linked" : "pending"
  });

  const normalizedItem = {
    ...emptyForm,
    ...migratedItem,
    ...correction,
    value,
    retailValue: correction?.retailValue ?? retailValue,
    imageUrl,
    imageFrameScale: normalizeImageFrameScale(item.imageFrameScale),
    imageScale: normalizeImageScale(item.imageScale),
    imageOffsetX: normalizeImageOffset(item.imageOffsetX),
    imageOffsetY: normalizeImageOffset(item.imageOffsetY),
    imageCropX: getNormalizedImageCrop(item).x,
    imageCropY: getNormalizedImageCrop(item).y,
    imageCropWidth: getNormalizedImageCrop(item).width,
    imageCropHeight: getNormalizedImageCrop(item).height,
    favorite: Boolean(item.favorite),
    quantity: normalizeQuantity(item.quantity),
    garmentType: normalizeGarmentType({ ...emptyForm, ...item, ...correction }),
    weight: normalizeWeight(item.weight),
    styleTags: normalizeTagList(item.styleTags, styleTagOptions),
    climateTags: normalizeTagList(item.climateTags, editableClimateTagOptions),
    type: normalizeItemType(correction?.type ?? item.type ?? ""),
    tags: uniqueTags(tags),
    images: {
      original: normalizedImages.original,
      preview: previewImage,
      thumbnail: normalizedImages.thumbnail
    },
    originalPreserved: normalizedImages.originalPreserved,
    ...sourceIdentity,
    createdAt: normalizeCreatedAt(item.createdAt),
    importedAt: normalizeCreatedAt(item.importedAt),
    updatedAt: normalizeCreatedAt(item.updatedAt),
    originalFilename: normalizeFileMetadataText(previewImage.originalFilename || item.originalFilename),
    fileExtension: normalizeFileMetadataText(item.fileExtension).toLowerCase(),
    fileSize: normalizeWholeNumber(previewImage.fileSize || item.fileSize),
    mimeType: normalizeFileMetadataText(previewImage.mimeType || item.mimeType),
    imageWidth,
    imageHeight,
    aspectRatio: normalizeAspectRatioValue(item.aspectRatio, imageWidth, imageHeight),
    orientation: normalizeOrientation(item.orientation, imageWidth, imageHeight),
    capturedAt: normalizeCreatedAt(item.capturedAt),
    originalCreatedAt: normalizeCreatedAt(item.originalCreatedAt),
    cameraMake: normalizeFileMetadataText(item.cameraMake),
    cameraModel: normalizeFileMetadataText(item.cameraModel),
    lensModel: normalizeFileMetadataText(item.lensModel),
    focalLength: normalizeFileMetadataText(item.focalLength),
    fNumber: normalizeFileMetadataText(item.fNumber),
    exposureTime: normalizeFileMetadataText(item.exposureTime),
    iso: normalizeFileMetadataText(item.iso),
    colorSpace: normalizeFileMetadataText(item.colorSpace),
    colorProfile: normalizeFileMetadataText(item.colorProfile),
    description: normalizeFileMetadataText(item.description),
    color: normalizeItemColor(correction?.color ?? item.color ?? ""),
    list: normalizeList(correction?.list ?? item.list)
  };

  return normalizedItem;
}

function itemNeedsColorMigration(originalItem, normalizedItem) {
  return normalizeItemColor(originalItem.color) !== normalizedItem.color;
}

function itemNeedsRetailMigration(originalItem, normalizedItem) {
  return originalItem.retailValue !== normalizedItem.retailValue;
}

function itemNeedsImageScaleMigration(originalItem, normalizedItem) {
  return originalItem.imageScale === undefined || normalizeImageScale(originalItem.imageScale) !== normalizedItem.imageScale;
}

function itemNeedsImageFrameScaleMigration(originalItem, normalizedItem) {
  return (
    originalItem.imageFrameScale === undefined ||
    normalizeImageFrameScale(originalItem.imageFrameScale) !== normalizedItem.imageFrameScale
  );
}

function itemNeedsImageOffsetMigration(originalItem, normalizedItem) {
  return (
    originalItem.imageOffsetX === undefined ||
    originalItem.imageOffsetY === undefined ||
    normalizeImageOffset(originalItem.imageOffsetX) !== normalizedItem.imageOffsetX ||
    normalizeImageOffset(originalItem.imageOffsetY) !== normalizedItem.imageOffsetY
  );
}

function itemNeedsImageCropMigration(originalItem, normalizedItem) {
  const originalCrop = getNormalizedImageCrop(originalItem);

  return (
    originalItem.imageCropX === undefined ||
    originalItem.imageCropY === undefined ||
    originalItem.imageCropWidth === undefined ||
    originalItem.imageCropHeight === undefined ||
    originalCrop.x !== normalizedItem.imageCropX ||
    originalCrop.y !== normalizedItem.imageCropY ||
    originalCrop.width !== normalizedItem.imageCropWidth ||
    originalCrop.height !== normalizedItem.imageCropHeight
  );
}

function itemNeedsFavoriteMigration(originalItem, normalizedItem) {
  return originalItem.favorite === undefined && normalizedItem.favorite === false;
}

function itemNeedsQuantityMigration(originalItem, normalizedItem) {
  return originalItem.quantity === undefined || normalizeQuantity(originalItem.quantity) !== normalizedItem.quantity;
}

function itemNeedsWeightMigration(originalItem, normalizedItem) {
  return originalItem.weight === undefined || normalizeWeight(originalItem.weight) !== normalizedItem.weight;
}

function itemNeedsGarmentTypeMigration(originalItem, normalizedItem) {
  return originalItem.garmentType !== normalizedItem.garmentType;
}

function itemNeedsTagMigration(originalItem, normalizedItem) {
  return (
    !Array.isArray(originalItem.styleTags) ||
    normalizeTagList(originalItem.styleTags, styleTagOptions).length !== normalizedItem.styleTags.length
  );
}

function itemNeedsClimateTagMigration(originalItem, normalizedItem) {
  return (
    !Array.isArray(originalItem.climateTags) ||
    normalizeTagList(originalItem.climateTags, editableClimateTagOptions).length !== normalizedItem.climateTags.length
  );
}

function itemNeedsDefaultMetadataMigration(originalItem, normalizedItem) {
  const correction = getDefaultMetadataCorrection(normalizedItem);

  if (!correction) {
    return false;
  }

  return Object.keys(correction).some((key) => originalItem[key] !== normalizedItem[key]);
}

function itemNeedsMoodboardMetadataMigration(originalItem, normalizedItem) {
  return (
    !areEditorValuesEqual(uniqueTags(migrateReferenceMetadataToTags(originalItem)?.tags), normalizedItem.tags) ||
    normalizeFileMetadataText(originalItem.itemUuid) !== normalizedItem.itemUuid ||
    normalizeFileMetadataText(originalItem.sourceNamespace) !== normalizedItem.sourceNamespace ||
    normalizeFileMetadataText(originalItem.sourceRelativePath) !== normalizedItem.sourceRelativePath ||
    normalizeFileMetadataText(originalItem.sourceOriginalFilename) !== normalizedItem.sourceOriginalFilename ||
    normalizeWholeNumber(originalItem.sourceFileSize) !== normalizedItem.sourceFileSize ||
    normalizeWholeNumber(originalItem.sourceImageWidth) !== normalizedItem.sourceImageWidth ||
    normalizeWholeNumber(originalItem.sourceImageHeight) !== normalizedItem.sourceImageHeight ||
    normalizeCreatedAt(originalItem.sourceLastModified) !== normalizedItem.sourceLastModified ||
    normalizeFileMetadataText(originalItem.relinkStatus).toLowerCase() !== normalizedItem.relinkStatus ||
    normalizeCreatedAt(originalItem.createdAt) !== normalizedItem.createdAt ||
    normalizeCreatedAt(originalItem.importedAt) !== normalizedItem.importedAt ||
    normalizeCreatedAt(originalItem.updatedAt) !== normalizedItem.updatedAt ||
    normalizeCreatedAt(originalItem.capturedAt) !== normalizedItem.capturedAt ||
    normalizeCreatedAt(originalItem.originalCreatedAt) !== normalizedItem.originalCreatedAt ||
    normalizeFileMetadataText(originalItem.originalFilename) !== normalizedItem.originalFilename ||
    normalizeFileMetadataText(originalItem.fileExtension).toLowerCase() !== normalizedItem.fileExtension ||
    normalizeWholeNumber(originalItem.fileSize) !== normalizedItem.fileSize ||
    normalizeFileMetadataText(originalItem.mimeType) !== normalizedItem.mimeType ||
    normalizeWholeNumber(originalItem.imageWidth) !== normalizedItem.imageWidth ||
    normalizeWholeNumber(originalItem.imageHeight) !== normalizedItem.imageHeight ||
    normalizeAspectRatioValue(originalItem.aspectRatio, originalItem.imageWidth, originalItem.imageHeight) !== normalizedItem.aspectRatio ||
    normalizeOrientation(originalItem.orientation, originalItem.imageWidth, originalItem.imageHeight) !== normalizedItem.orientation ||
    normalizeFileMetadataText(originalItem.cameraMake) !== normalizedItem.cameraMake ||
    normalizeFileMetadataText(originalItem.cameraModel) !== normalizedItem.cameraModel ||
    normalizeFileMetadataText(originalItem.lensModel) !== normalizedItem.lensModel ||
    normalizeFileMetadataText(originalItem.focalLength) !== normalizedItem.focalLength ||
    normalizeFileMetadataText(originalItem.fNumber) !== normalizedItem.fNumber ||
    normalizeFileMetadataText(originalItem.exposureTime) !== normalizedItem.exposureTime ||
    normalizeFileMetadataText(originalItem.iso) !== normalizedItem.iso ||
    normalizeFileMetadataText(originalItem.colorSpace) !== normalizedItem.colorSpace ||
    normalizeFileMetadataText(originalItem.colorProfile) !== normalizedItem.colorProfile
  );
}

function itemNeedsImageAssetMigration(originalItem, normalizedItem) {
  const originalImages = normalizeItemImages(originalItem);
  const normalizedPreviewSrc = normalizedItem.images?.preview?.src ?? "";

  return (
    originalImages.originalPreserved !== normalizedItem.originalPreserved ||
    originalImages.preview.src !== normalizedPreviewSrc ||
    originalImages.original.src !== (normalizedItem.images?.original?.src ?? "") ||
    originalImages.thumbnail.src !== (normalizedItem.images?.thumbnail?.src ?? "")
  );
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined) {
    return "No value";
  }

  return `${new Intl.NumberFormat("de-DE").format(getNumericValue(value))} €`;
}

function createSavedOutfitName(savedOutfits) {
  return `Moodboard ${savedOutfits.length + 1}`;
}

function normalizeBoardImage(image, index = 0) {
  if (!image || typeof image !== "object") {
    return null;
  }

  const width = Math.max(80, Math.round(Number(image.width) || 220));
  const height = Math.max(80, Math.round(Number(image.height) || 260));

  return {
    id: typeof image.id === "string" ? image.id : `board_image_${index}`,
    referenceId: typeof image.referenceId === "string" ? image.referenceId : "",
    x: Math.round(Number(image.x) || 0),
    y: Math.round(Number(image.y) || 0),
    width,
    height,
    rotation: Math.round((Number(image.rotation) || 0) * 10) / 10,
    zIndex: Math.max(1, Math.round(Number(image.zIndex) || index + 1)),
    generationSlot: typeof image.generationSlot === "string" ? image.generationSlot : visibleSlots[index % visibleSlots.length]
  };
}

function normalizeBoard(board) {
  if (!board || typeof board !== "object") {
    return null;
  }

  const images = Array.isArray(board.images)
    ? board.images.map(normalizeBoardImage).filter((image) => image?.referenceId)
    : [];

  if (!images.length) {
    return null;
  }

  return {
    id: typeof board.id === "string" ? board.id : `board_${Date.now()}`,
    width: Math.max(800, Math.round(Number(board.width) || 1600)),
    height: Math.max(600, Math.round(Number(board.height) || 1200)),
    images
  };
}

function getBoardReferenceIds(board) {
  return Array.isArray(board?.images) ? board.images.map((image) => image.referenceId).filter(Boolean) : [];
}

function getSavedOutfitPreviewSlots(savedOutfit) {
  return savedOutfit.layering
    ? ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"]
    : ["Headwear", "TopInner", "Bottom", "Footwear"];
}

function sanitizeOutfitForExistingItems(outfit, itemsById) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId && itemsById[itemId] ? itemId : null
    ])
  );
}

function savedOutfitHasMissingItems(savedOutfit, itemsById) {
  if (savedOutfit.board?.images?.length) {
    return savedOutfit.board.images.some((image) => image.referenceId && !itemsById[image.referenceId]);
  }

  return Object.values(savedOutfit.outfit ?? {}).some((itemId) => itemId && !itemsById[itemId]);
}

function replaceItemIdInOutfit(outfit, oldItemId, newItemId) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId === oldItemId ? newItemId : itemId
    ])
  );
}

function clearItemIdFromOutfit(outfit, itemIdToClear) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId === itemIdToClear ? null : itemId
    ])
  );
}

function normalizeGenerationLists(generationLists) {
  return {
    ...defaultGenerationLists,
    ...(generationLists ?? {})
  };
}

function normalizeSavedOutfit(savedOutfit) {
  return {
    id: savedOutfit.id,
    name: savedOutfit.name ?? "Saved board",
    description: savedOutfit.description ?? "",
    board: normalizeBoard(savedOutfit.board),
    outfit: savedOutfit.outfit ?? {},
    layering: Boolean(savedOutfit.layering)
  };
}

function normalizeSavedOutfits(savedOutfits) {
  if (!Array.isArray(savedOutfits)) {
    return [];
  }

  const seenOutfitKeys = new Set();

  return savedOutfits.reduce((normalized, savedOutfit) => {
    const nextSavedOutfit = normalizeSavedOutfit(savedOutfit);
    const outfitKey = nextSavedOutfit.board ? getBoardKey(nextSavedOutfit.board) : getOutfitKey(nextSavedOutfit.outfit, nextSavedOutfit.layering);

    if (seenOutfitKeys.has(outfitKey)) {
      return normalized;
    }

    seenOutfitKeys.add(outfitKey);
    normalized.push(nextSavedOutfit);
    return normalized;
  }, []);
}

function getWorthCategory(item) {
  return garmentTypes.includes(item.garmentType) ? item.garmentType : "Accessory";
}

function createFitpicId() {
  return `fitpic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const candidates = Array.isArray(dataUrl) ? dataUrl.filter(Boolean) : resolveImageUrlCandidates(dataUrl);

    if (!candidates.length) {
      reject(new Error("Image could not be loaded."));
      return;
    }

    const tryLoadCandidate = (candidateIndex) => {
      if (candidateIndex >= candidates.length) {
        reject(new Error("Image could not be loaded."));
        return;
      }

      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => tryLoadCandidate(candidateIndex + 1);
      image.src = candidates[candidateIndex];
    };

    tryLoadCandidate(0);
  });
}

function getFallbackPaletteColor(item) {
  const rgb = getColorRgb(item);
  return rgb ? rgbToHex(rgb) : "#8c8c8c";
}

function extractDominantColorsFromImage(image, maxColors = 3) {
  const sampleSize = 96;
  const scale = Math.min(1, sampleSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return [];
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];
    if (alpha < 96) {
      continue;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const brightness = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);

    if (brightness > 238 && spread < 18) {
      continue;
    }

    const key = [r, g, b].map((value) => Math.round(value / 32) * 32).join(",");
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((bucket) =>
      rgbToHex({
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count
      })
    );
}

async function extractItemPalette(item) {
  try {
    const image = await loadImage(resolveImageUrl(getManagedItemImageSrc(item, "preview")));
    const colors = extractDominantColorsFromImage(image);
    return colors.length ? colors : [getFallbackPaletteColor(item)];
  } catch {
    return [getFallbackPaletteColor(item)];
  }
}

function mergePaletteColors(itemPalettes, maxColors = 7) {
  const colors = itemPalettes.flatMap(({ item, colors }) =>
    colors.map((color) => ({ color, label: buildDisplayName(item) }))
  );
  const merged = [];

  colors.forEach((entry) => {
    if (!merged.some((existing) => existing.color.toLowerCase() === entry.color.toLowerCase())) {
      merged.push(entry);
    }
  });

  return merged.slice(0, maxColors);
}

function canvasToDataUrl(canvas, type, quality) {
  const dataUrl = canvas.toDataURL(type, quality);
  return dataUrl.startsWith(`data:${type}`) ? dataUrl : "";
}

function isLocalDataImage(imageUrl) {
  return imageUrl.trim().startsWith("data:image/");
}

function getDataUrlFileSize(dataUrl) {
  const payload = String(dataUrl ?? "").split(",")[1] ?? "";
  if (!payload) {
    return 0;
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

async function createOriginalImageAsset(source) {
  if (!source.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  const dataUrl = await readFileAsDataUrl(source);
  const image = await loadImage(dataUrl);
  return createImageAsset({
    src: dataUrl,
    mimeType: source.type,
    width: image.naturalWidth,
    height: image.naturalHeight,
    fileSize: Math.max(0, Number(source.size) || getDataUrlFileSize(dataUrl)),
    originalFilename: source.name ?? ""
  });
}

async function createOptimizedImageAsset(source, maxDimension = 1400, quality = 0.86) {
  if (!source.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  const dataUrl = await readFileAsDataUrl(source);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image could not be processed.");
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const optimizedSrc = canvasToDataUrl(canvas, "image/webp", quality) || canvas.toDataURL("image/png");
  return createImageAsset({
    src: optimizedSrc,
    mimeType: optimizedSrc.startsWith("data:image/webp") ? "image/webp" : "image/png",
    width,
    height,
    fileSize: getDataUrlFileSize(optimizedSrc),
    originalFilename: source.name ?? ""
  });
}

async function createPreviewImageAsset(source) {
  return createOptimizedImageAsset(source, 1400, 0.86);
}

async function createThumbnailImageAsset(source) {
  return createOptimizedImageAsset(source, 520, 0.8);
}

async function compressImageSource(source, maxDimension = 1400, quality = 0.86) {
  const optimizedImage = await createOptimizedImageAsset(source, maxDimension, quality);
  return optimizedImage.src;
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function getRemoveBackgroundExport(module) {
  const removeBackground = module.removeBackground ?? module.default;

  if (typeof removeBackground !== "function") {
    throw new Error("Background removal module did not load correctly.");
  }

  return removeBackground;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function downloadBlobFile(blob, fileName, options = {}) {
  const suggestedMimeType = options.mimeType ?? blob?.type ?? "application/octet-stream";

  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: suggestedMimeType,
            accept: {
              [suggestedMimeType]: [fileName.includes(".") ? `.${fileName.split(".").pop()}` : ""].filter(Boolean)
            }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error?.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);

  return "downloaded";
}

async function copyTextToClipboard(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function buildBackupExportData(items, appState) {
  return createLightweightBackupData(items, appState);
}

function createBackupExportBlob(backup) {
  const parts = [
    "{",
    `"source":${JSON.stringify(backup.source)}`,
    `,"version":${JSON.stringify(backup.version)}`,
    `,"exportedAt":${JSON.stringify(backup.exportedAt)}`,
    ',"items":['
  ];

  backup.items.forEach((item, index) => {
    if (index > 0) {
      parts.push(",");
    }
    parts.push(JSON.stringify(item));
  });

  parts.push(`],"appState":${JSON.stringify(backup.appState)}}`);

  return new Blob(parts, { type: "application/json" });
}

const emptyWeatherSettings = {
  locationName: "",
  latitude: null,
  longitude: null
};

function normalizeWeatherSettings(settings) {
  const latitude = Number(settings?.latitude);
  const longitude = Number(settings?.longitude);

  return {
    locationName: settings?.locationName ?? "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

function getWeatherConditionLabel(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Weather";
}

function getWeatherClimateFilters(temperature, code) {
  const filters = [];

  if (Number.isFinite(temperature)) {
    if (temperature >= 21) {
      filters.push("Hot");
    } else if (temperature >= 16) {
      filters.push("Warm");
    } else if (temperature >= 8) {
      filters.push("Transitional");
    } else {
      filters.push("Cold");
    }
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    filters.push("Rain");
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    filters.push("Snow");
  }

  return [...new Set(filters)];
}

function getCompactWeatherLocationName(locationName) {
  const parts = String(locationName ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return parts.join(", ");
  }

  const city = parts[0];
  const country = parts.at(-1);
  return city === country ? city : `${city}, ${country}`;
}

async function fetchWeatherForecast(latitude, longitude) {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", latitude);
  weatherUrl.searchParams.set("longitude", longitude);
  weatherUrl.searchParams.set("current", "temperature_2m,weather_code");
  weatherUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  weatherUrl.searchParams.set("timezone", "auto");
  weatherUrl.searchParams.set("forecast_days", "1");

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error("Weather could not be loaded.");
  }

  const weatherData = await weatherResponse.json();
  const temperature = weatherData.current?.temperature_2m;
  const code = weatherData.current?.weather_code;

  return {
    temperature,
    code,
    condition: getWeatherConditionLabel(code),
    high: weatherData.daily?.temperature_2m_max?.[0],
    low: weatherData.daily?.temperature_2m_min?.[0],
    suggestedFilters: getWeatherClimateFilters(temperature, code),
    updatedAt: new Date().toISOString()
  };
}

async function fetchWeatherForLocation(query) {
  const searchUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  searchUrl.searchParams.set("name", query);
  searchUrl.searchParams.set("count", "1");
  searchUrl.searchParams.set("language", "en");
  searchUrl.searchParams.set("format", "json");

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error("Location search failed.");
  }

  const searchData = await searchResponse.json();
  const [location] = searchData.results ?? [];
  if (!location) {
    throw new Error("Location was not found.");
  }

  const weather = await fetchWeatherForecast(location.latitude, location.longitude);

  return {
    settings: {
      locationName: [location.name, location.admin1, location.country].filter(Boolean).join(", "),
      latitude: location.latitude,
      longitude: location.longitude
    },
    weather
  };
}

async function fetchWeatherForSavedLocation(settings) {
  const normalizedSettings = normalizeWeatherSettings(settings);

  if (!Number.isFinite(normalizedSettings.latitude) || !Number.isFinite(normalizedSettings.longitude)) {
    throw new Error("Location was not found.");
  }

  return {
    settings: normalizedSettings,
    weather: await fetchWeatherForecast(normalizedSettings.latitude, normalizedSettings.longitude)
  };
}

export default function App() {
  const editorRef = useRef(null);
  const importBackupRef = useRef(null);
  const outfitStageRef = useRef(null);
  const boardViewportRef = useRef(null);
  const pickerOverlayRef = useRef(null);
  const outfitDebugRef = useRef(null);
  const editorImageFrameRef = useRef(null);
  const editorImageRef = useRef(null);
  const cropEditorFrameRef = useRef(null);
  const boardInteractionRef = useRef(null);
  const boardGenerationFrameRef = useRef(null);
  const boardGenerationIndicatorTimeoutRef = useRef(null);
  const boardGenerationPerfRef = useRef(null);
  const boardGenerationInFlightRef = useRef(false);
  const boardRelayoutFrameRef = useRef(null);
  const wardrobePanelScrollRef = useRef(null);
  const wardrobeGridRef = useRef(null);
  const boardPickerListRef = useRef(null);
  const generationMetadataFiltersPanelRef = useRef(null);
  const libraryPerfRef = useRef(null);
  const saveAppStateTimeoutRef = useRef(null);
  const saveAppStateIdleCallbackRef = useRef(null);
  const cropInteractionRef = useRef(null);
  const librarySelectionActionsRef = useRef(null);
  const wardrobeFiltersPanelRef = useRef(null);
  const bulkMetadataFeedbackTimeoutRef = useRef(null);
  const backupExportFeedbackTimeoutRef = useRef(null);
  const paletteCacheRef = useRef(new Map());
  const boardRenderLayoutSignatureRef = useRef("");
  const pendingRestoredBoardFitRef = useRef(false);
  const nestedTagDebugEnabled = isNestedTagDebugEnabled();
  const [nestedTagDebugTick, setNestedTagDebugTick] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layering, setLayering] = useState(false);
  const [accessoriesEnabled, setAccessoriesEnabled] = useState(true);
  const [locked, setLocked] = useState({});
  const [excluded, setExcluded] = useState({});
  const [outfit, setOutfit] = useState({});
  const [board, setBoard] = useState(null);
  const [ignoredImportImages, setIgnoredImportImages] = useState([]);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [likedOutfitKeys, setLikedOutfitKeys] = useState({});
  const [outfitAffinity, setOutfitAffinity] = useState({});
  const [recentOutfits, setRecentOutfits] = useState([]);
  const [generateCount, setGenerateCount] = useState(0);
  const [imageCount, setImageCount] = useState(DEFAULT_BOARD_IMAGE_COUNT);
  const [imageCountDraft, setImageCountDraft] = useState(() => String(DEFAULT_BOARD_IMAGE_COUNT));
  const [fitpics, setFitpics] = useState([]);
  const [generationLists, setGenerationLists] = useState(defaultGenerationLists);
  const [generationMode, setGenerationMode] = useState(defaultGenerationMode);
  const [generationMetadataFilters, setGenerationMetadataFilters] = useState(emptyGenerationMetadataFilters);
  const [outfitFilters, setOutfitFilters] = useState(emptyOutfitFilters);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [editingSavedOutfitId, setEditingSavedOutfitId] = useState(null);
  const [savedOutfitDraft, setSavedOutfitDraft] = useState({ name: "", description: "" });
  const [activeBoardImageId, setActiveBoardImageId] = useState(null);
  const [pickerBoardImageId, setPickerBoardImageId] = useState(null);
  const [activeAccessorySlot, setActiveAccessorySlot] = useState(null);
  const [activeOutfitSlot, setActiveOutfitSlot] = useState(null);
  const [pickerAnchorSlot, setPickerAnchorSlot] = useState(null);
  const [fitpicPreview, setFitpicPreview] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [wardrobeFiltersOpen, setWardrobeFiltersOpen] = useState(false);
  const [wardrobeWorthOpen, setWardrobeWorthOpen] = useState(false);
  const [wardrobeSavedOpen, setWardrobeSavedOpen] = useState(false);
  const [wardrobeManageOpen, setWardrobeManageOpen] = useState(false);
  const [wardrobeAddOpen, setWardrobeAddOpen] = useState(false);
  const [manageStatsOpen, setManageStatsOpen] = useState(false);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [backupExportFeedback, setBackupExportFeedback] = useState("");
  const [tagManagerSearch, setTagManagerSearch] = useState("");
  const [tagManagerDrafts, setTagManagerDrafts] = useState({});
  const [expandedTagManagerTags, setExpandedTagManagerTags] = useState({});
  const [tagManagerFeedback, setTagManagerFeedback] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editorReturnTarget, setEditorReturnTarget] = useState(null);
  const [selectionEditorActive, setSelectionEditorActive] = useState(false);
  const [editorAdvancedOpen, setEditorAdvancedOpen] = useState(false);
  const [draft, setDraft] = useState(emptyForm);
  const [cropEditorState, setCropEditorState] = useState(null);
  const [imageUploadError, setImageUploadError] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [itemImporting, setItemImporting] = useState(false);
  const [replaceOriginalShouldRegenerate, setReplaceOriginalShouldRegenerate] = useState(false);
  const [itemImageDragActive, setItemImageDragActive] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState({});
  const [selectedReferenceAnchorId, setSelectedReferenceAnchorId] = useState(null);
  const [bulkMetadataDraft, setBulkMetadataDraft] = useState({
    addTags: [],
    removeTags: [],
    favorite: ""
  });
  const [bulkMetadataFeedback, setBulkMetadataFeedback] = useState("");
  const [wardrobeFilters, setWardrobeFilters] = useState(emptyWardrobeFilters);
  const [librarySearch, setLibrarySearch] = useState("");
  const [wardrobeSort, setWardrobeSort] = useState("newest");
  const [libraryTagActionMode, setLibraryTagActionMode] = useState(null);
  const [outfitPalette, setOutfitPalette] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [boardView, setBoardView] = useState({ x: 0, y: 0, zoom: 1 });
  const [isBoardGenerating, setIsBoardGenerating] = useState(false);
  const [showBoardGenerationBusy, setShowBoardGenerationBusy] = useState(false);
  const [runtimeImageMetricsByItemId, setRuntimeImageMetricsByItemId] = useState({});
  const [libraryGridViewport, setLibraryGridViewport] = useState({
    width: 0,
    height: 0,
    scrollTop: 0,
    gridOffsetTop: 0
  });
  const [boardPickerViewport, setBoardPickerViewport] = useState({
    width: 0,
    height: 0,
    scrollTop: 0
  });
  const [dockExpanded, setDockExpanded] = useState(getIsMobileViewport);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [outfitFiltersOpen, setOutfitFiltersOpen] = useState(false);
  const [generationMetadataFiltersOpen, setGenerationMetadataFiltersOpen] = useState(false);
  const [weatherSettings, setWeatherSettings] = useState(emptyWeatherSettings);
  const [weatherLocationDraft, setWeatherLocationDraft] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [outfitDebugOpen, setOutfitDebugOpen] = useState(false);
  const [guidedDebugPayload, setGuidedDebugPayload] = useState([]);
  const [canUseDebugPopout, setCanUseDebugPopout] = useState(getCanUseDebugPopout);
  const [, startBoardTransition] = useTransition();
  const isGeneratePerfDebug = useMemo(() => isGeneratePerfDebugEnabled(), []);
  const isLibraryPerfDebug = useMemo(() => isLibraryPerfDebugEnabled(), []);

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items]
  );
  const isDockExpanded = isMobileViewport ? dockExpanded : true;
  const currentBoardItems = useMemo(() => {
    const seen = new Set();

    return (board?.images ?? [])
      .map((image) => itemsById[image.referenceId])
      .filter((item) => {
        if (!item || seen.has(item.id)) {
          return false;
        }

        seen.add(item.id);
        return true;
      });
  }, [board, itemsById]);
  const boardCanvasImages = useMemo(
    () =>
      (board?.images ?? [])
        .slice()
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((image) => ({
          image,
          item: itemsById[image.referenceId] ?? null
        }))
        .filter(({ item }) => Boolean(item)),
    [board?.images, itemsById]
  );
  const boardSurfaceStyle = useMemo(
    () =>
      board
        ? {
            width: `${board.width}px`,
            height: `${board.height}px`,
            left: `calc(50% - ${board.width / 2}px)`,
            top: `calc(50% - ${board.height / 2}px)`,
            transform: `translate(${boardView.x}px, ${boardView.y}px) scale(${boardView.zoom})`
          }
        : null,
    [board, boardView.x, boardView.y, boardView.zoom]
  );
  const currentOutfitKey = useMemo(() => getBoardKey(board), [board]);
  const currentSavedOutfit = useMemo(
    () => savedOutfits.find((savedOutfit) => savedOutfit.board && getBoardKey(savedOutfit.board) === currentOutfitKey) ?? null,
    [savedOutfits, currentOutfitKey]
  );
  const isCurrentOutfitSaved = Boolean(currentSavedOutfit);
  const isCurrentOutfitLiked = Boolean(likedOutfitKeys[currentOutfitKey]);
  const guidedDebugPayloadMatchesOutfit = useMemo(
    () =>
      guidedDebugPayload.length > 0 &&
      guidedDebugPayload.every((entry) =>
        (board?.images ?? []).some((image) => image.referenceId === entry.itemId && image.generationSlot === entry.slot)
      ),
    [guidedDebugPayload, board]
  );
  const pickerBoardImage = useMemo(
    () => board?.images?.find((image) => image.id === pickerBoardImageId) ?? null,
    [board, pickerBoardImageId]
  );
  const compactWeatherLocationName = useMemo(
    () => getCompactWeatherLocationName(weatherSettings.locationName),
    [weatherSettings.locationName]
  );
  const currentBoardTagSummary = useMemo(
    () =>
      getTagFrequencyEntries(currentBoardItems)
        .slice(0, 3)
        .map(({ tag }) => tag),
    [currentBoardItems]
  );
  const currentBoardParentGroupSummary = useMemo(() => {
    const counts = new Map();

    currentBoardItems.forEach((item) => {
      uniqueTags(item?.tags).forEach((tag) => {
        const group = getBoardTagParentGroup(tag);
        if (group) {
          counts.set(group, (counts.get(group) ?? 0) + 1);
        }
      });
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([group]) => group);
  }, [currentBoardItems]);
  const guidedDebugDetails = useMemo(
    () => (generationMode === "guided" && guidedDebugPayloadMatchesOutfit ? guidedDebugPayload : []),
    [generationMode, guidedDebugPayload, guidedDebugPayloadMatchesOutfit]
  );
  const showDebugPopout = outfitDebugOpen && canUseDebugPopout && !isMobileViewport;
  const currentOutfitDebugReasons = useMemo(
    () =>
      generationMode === "guided" && guidedDebugPayloadMatchesOutfit
        ? summarizeGuidedDebugPayload(guidedDebugPayload)
        : [],
    [generationMode, guidedDebugPayload, guidedDebugPayloadMatchesOutfit]
  );

  function renderTagManagerNode(node, depth = 0) {
    const drafts = tagManagerDrafts[node.path] ?? {};
    const isExpanded = Boolean(expandedTagManagerTags[node.path]);
    const isEditorOpen = Boolean(expandedTagManagerTags[`edit:${node.path}`]);
    const hasChildren = node.childNodes.length > 0;

    return (
      <div
        key={node.key}
        className={`tag-manager-row ${isEditorOpen ? "is-expanded" : ""}`}
        style={{ "--tag-manager-depth": depth }}
      >
        <div className="tag-manager-row-header">
          <div className="tag-manager-tag">
            <div className="tag-manager-tag-main">
              {hasChildren ? (
                <ExpandArrow
                  className="tag-manager-chevron"
                  isExpanded={isExpanded}
                  label={node.path}
                  onToggle={() => toggleTagManagerExpanded(node.path)}
                  debugEnabled={nestedTagDebugEnabled}
                  debugScope="manage-tags"
                  debugId={node.path}
                />
              ) : (
                <span className="tag-manager-chevron tag-manager-chevron-placeholder" aria-hidden="true" />
              )}
              <span className="tag-manager-tag-name">{node.label}</span>
              <span className="tag-manager-tag-count">{node.totalCount}</span>
            </div>
          </div>
          <button
            type="button"
            className="ghost-button tag-manager-expand"
            onClick={() => toggleTagManagerExpanded(`edit:${node.path}`)}
            aria-expanded={isEditorOpen}
          >
            {isEditorOpen ? "Hide" : "Edit"}
          </button>
        </div>

        {isEditorOpen ? (
          <div className="tag-manager-actions">
            <div className="tag-manager-action">
              <input
                type="text"
                value={drafts.rename ?? ""}
                onChange={(event) => updateTagManagerDraft(node.path, "rename", event.target.value)}
                placeholder="Rename to"
                aria-label={`Rename ${node.path}`}
                list="tag-manager-targets"
              />
              <button type="button" className="ghost-button" onClick={() => void handleRenameTagEverywhere(node.path)}>
                Rename
              </button>
            </div>

            <div className="tag-manager-action">
              <input
                type="text"
                value={drafts.merge ?? ""}
                onChange={(event) => updateTagManagerDraft(node.path, "merge", event.target.value)}
                placeholder="Merge into"
                aria-label={`Merge ${node.path} into`}
                list="tag-manager-targets"
              />
              <button type="button" className="ghost-button" onClick={() => void handleMergeTagEverywhere(node.path)}>
                Merge
              </button>
            </div>

            <button type="button" className="ghost-button danger tag-manager-delete" onClick={() => void handleDeleteTagEverywhere(node.path)}>
              Delete
            </button>
          </div>
        ) : null}

        {hasChildren && isExpanded ? (
          <div className="tag-manager-children">
            {node.childNodes.map((childNode) => renderTagManagerNode(childNode, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const handleChange = (event) => {
      setIsMobileViewport(event.matches);
      setDockExpanded(event.matches ? controlsOpen || activePanel === "wardrobe" : true);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [activePanel, controlsOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 1180px)");
    const handleChange = (event) => {
      setCanUseDebugPopout(event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const activeOutfitFilterCount = Object.values(outfitFilters).reduce(
    (sum, values) => sum + (Array.isArray(values) ? values.length : 0),
    0
  );
  const compatibleAccessoryOptions = useMemo(() => {
    if (!activeAccessorySlot) {
      return [];
    }

    return getAccessoryOptions(activeAccessorySlot);
  }, [activeAccessorySlot, items, excluded, generationLists]);
  const typeSuggestions = useMemo(() => {
    const seen = new Set();
    return [...defaultTypeSuggestions, ...items.map((item) => item.type).filter(Boolean)].filter((value) => {
      const key = value.trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [items]);
  const tagDebugItems = useMemo(
    () => (nestedTagDebugEnabled ? NESTED_TAG_DEBUG_ITEMS : []),
    [nestedTagDebugEnabled]
  );
  const tagDebugSourceItems = useMemo(
    () => (tagDebugItems.length ? [...items, ...tagDebugItems] : items),
    [items, tagDebugItems]
  );
  const allLibraryTags = useMemo(() => getAllTags(tagDebugSourceItems), [tagDebugSourceItems]);
  const cropEditorImageMetrics = useImageMetrics(draft.imageUrl);
  const nestedTagDebugLogs = useMemo(() => {
    if (!nestedTagDebugEnabled || typeof window === "undefined") {
      return [];
    }

    return Array.isArray(window.__nestedTagDebugLogs) ? window.__nestedTagDebugLogs.slice(-18) : [];
  }, [nestedTagDebugEnabled, nestedTagDebugTick]);

  function renderOutfitDebugPanel(panelClassName = "") {
    const className = ["outfit-debug-panel", panelClassName].filter(Boolean).join(" ");

    return (
      <div className={className}>
        {generationMode === "guided" ? (
          <>
            <div className="outfit-debug-context">
              <div className="outfit-debug-row">
                <span>Mode</span>
                <strong>Guided</strong>
              </div>
              <div className="outfit-debug-row">
                <span>Direction tags</span>
                <strong>{currentBoardTagSummary.length ? currentBoardTagSummary.join(", ") : "Unspecified"}</strong>
              </div>
              <div className="outfit-debug-row">
                <span>Parent groups</span>
                <strong>{currentBoardParentGroupSummary.length ? currentBoardParentGroupSummary.join(", ") : "None"}</strong>
              </div>
            </div>

            {guidedDebugDetails.length ? (
              <div className="outfit-debug-slot-grid">
                {guidedDebugDetails.map((entry, index) => {
                  const selectedItem = itemsById[entry.itemId];
                  const reasons = getGuidedBreakdownDisplayEntries(entry.breakdown, 3);
                  const topCandidates = (entry.topCandidates ?? []).slice(0, 5);

                  return (
                    <section key={entry.slot} className="outfit-debug-slot">
                      <h4 className="outfit-debug-slot-title">{`Image ${index + 1}`}</h4>
                      <div className="outfit-debug-slot-block">
                        <span className="outfit-debug-label">Selected</span>
                        <div className="outfit-debug-value-list">
                          <div className="outfit-debug-value-row">
                            <span>{selectedItem?.name ?? entry.itemId}</span>
                            <strong>{entry.score.toFixed(1)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="outfit-debug-slot-block">
                        <span className="outfit-debug-label">Reasons</span>
                        <div className="outfit-debug-value-list">
                          {reasons.map((reason) => (
                            <div key={`${entry.slot}-${reason.key}`} className="outfit-debug-value-row">
                              <span>{reason.label}</span>
                              <strong>{reason.value > 0 ? `+${reason.value.toFixed(1)}` : reason.value.toFixed(1)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {topCandidates.length ? (
                        <div className="outfit-debug-slot-block">
                          <span className="outfit-debug-label">Top alternatives</span>
                          <div className="outfit-debug-value-list">
                            {topCandidates.map((candidate) => (
                              <div key={`${entry.slot}-${candidate.itemId}`} className="outfit-debug-value-row">
                                <span>{itemsById[candidate.itemId]?.name ?? candidate.itemId}</span>
                                <strong>{candidate.score.toFixed(1)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            ) : currentOutfitDebugReasons.length ? (
              <>
                <p className="outfit-debug-note">
                  Detailed board rankings are only available for the exact generated board. This view is showing a summary.
                </p>
                {currentOutfitDebugReasons.map((reason) => (
                  <div key={reason.key} className="outfit-debug-row">
                    <span>{reason.label}</span>
                    <strong>{reason.value > 0 ? `+${reason.value.toFixed(1)}` : reason.value.toFixed(1)}</strong>
                  </div>
                ))}
              </>
            ) : (
              <p className="outfit-debug-empty">No guided scoring reasons available.</p>
            )}
          </>
        ) : (
          <p className="outfit-debug-empty">Guided scoring is disabled in Random mode.</p>
        )}
      </div>
    );
  }
  const colorSuggestions = useMemo(() => {
    const seen = new Set();
    return items.map((item) => item.color).filter((value) => {
      const key = value?.trim?.().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [items]);
  const nameSuggestions = useMemo(() => {
    const seen = new Set();
    return items.map((item) => item.name).filter((value) => {
      const key = value?.trim?.().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [items]);
  const resolvedTypeDefaults = useMemo(() => resolveTypeDefaults(draft.type), [draft.type]);
  const advancedOverrideFields = useMemo(
    () => getAdvancedOverrideFields(draft, resolvedTypeDefaults),
    [draft, resolvedTypeDefaults]
  );
  const advancedOverrideSet = useMemo(() => new Set(advancedOverrideFields), [advancedOverrideFields]);
  const canRemoveDraftBackground = isLocalDataImage(draft.imageUrl);
  const normalizedWardrobeFilters = normalizeWardrobeFilterState(wardrobeFilters);
  const activeWardrobeFilterCount =
    countActiveFilterValues({
      tags: normalizedWardrobeFilters.tags,
      excludedTags: normalizedWardrobeFilters.excludedTags,
      laundry: normalizedWardrobeFilters.laundry,
      favorite: normalizedWardrobeFilters.favorite,
      tagMatchMode:
        normalizedWardrobeFilters.tags.length > 1 && normalizedWardrobeFilters.tagMatchMode === "any"
          ? normalizedWardrobeFilters.tagMatchMode
          : ""
    });
  const hasActiveWardrobeFilters = activeWardrobeFilterCount > 0;
  const activeGenerationMetadataFilterCount = countActiveFilterValues(generationMetadataFilters);
  const hasActiveGenerationMetadataFilters = activeGenerationMetadataFilterCount > 0;
  const selectedReferenceIdList = Object.entries(selectedReferenceIds)
    .filter(([, isSelected]) => isSelected)
    .map(([itemId]) => itemId);
  const selectedReferenceItems = selectedReferenceIdList
    .map((itemId) => itemsById[itemId])
    .filter(Boolean);
  const selectedReferenceSelectionKey = selectedReferenceIdList.join("|");
  const selectedReferenceCount = Object.values(selectedReferenceIds).filter(Boolean).length;
  const hasSelectedReferences = selectedReferenceCount > 0;
  const canEditSelectedReference = selectedReferenceCount === 1;
  const isBulkSelectionEditing = selectionEditorActive && selectedReferenceCount > 1;
  const isSingleSelectionEditing = selectionEditorActive && selectedReferenceCount === 1;
  const includedWardrobeFilterChips = [
    ...normalizedWardrobeFilters.tags.map((tag) => ({
      key: `include:${tag}`,
      label: tag === NO_TAGS_FILTER ? "Untagged" : getLeafTagLabel(tag),
      prefix: "",
      isNegative: false,
      onClear: () =>
        setWardrobeFilters((current) => ({
          ...current,
          tags: uniqueTags(current.tags).filter((selectedTag) => selectedTag !== tag)
        }))
    })),
    ...(librarySearch.trim()
      ? [{
          key: "search",
          label: librarySearch.trim(),
          prefix: "Search:",
          isNegative: false,
          onClear: clearLibrarySearch
        }]
      : []),
    ...(normalizedWardrobeFilters.favorite
      ? [{
          key: "favorite",
          label: normalizedWardrobeFilters.favorite === "yes" ? "Favorites" : "Not favorites",
          prefix: "Favorite:",
          isNegative: false,
          onClear: () => setWardrobeFilters((current) => ({ ...current, favorite: "" }))
        }]
      : [])
  ];
  const excludedWardrobeFilterChips = [
    ...normalizedWardrobeFilters.excludedTags.map((tag) => ({
      key: `exclude:${tag}`,
      label: `not: ${tag === NO_TAGS_FILTER ? "untagged" : getLeafTagLabel(tag)}`,
      prefix: "",
      isNegative: true,
      onClear: () =>
        setWardrobeFilters((current) => ({
          ...current,
          excludedTags: uniqueTags(current.excludedTags).filter((selectedTag) => selectedTag !== tag)
        }))
    })),
    ...(normalizedWardrobeFilters.laundry
      ? [{
          key: "exclude-state",
          label: normalizedWardrobeFilters.laundry === "show" ? "Show excluded" : "Hide excluded",
          prefix: "Excluded:",
          isNegative: false,
          onClear: () => setWardrobeFilters((current) => ({ ...current, laundry: "" }))
        }]
      : [])
  ];
  const allLibraryTagEntries = useMemo(() => getTagFrequencyEntries(tagDebugSourceItems), [tagDebugSourceItems]);
  const allLibraryNoTagsCount = useMemo(
    () => tagDebugSourceItems.filter((item) => uniqueTags(item.tags).length === 0).length,
    [tagDebugSourceItems]
  );
  const tagCountBaseItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesLibrarySearch(item, librarySearch) &&
          matchesWardrobeFilters(item, wardrobeFilters, ["tags", "excludedTags", "tagMatchMode"]) &&
          (!normalizedWardrobeFilters.laundry ||
            (normalizedWardrobeFilters.laundry === "show" ? Boolean(excluded[item.id]) : !excluded[item.id]))
      ),
    [items, librarySearch, wardrobeFilters, normalizedWardrobeFilters.laundry, excluded]
  );
  const tagCountItemsWithDebug = useMemo(
    () => (tagDebugItems.length ? [...tagCountBaseItems, ...tagDebugItems] : tagCountBaseItems),
    [tagCountBaseItems, tagDebugItems]
  );
  const libraryTagEntries = useMemo(() => getTagFrequencyEntries(tagCountItemsWithDebug), [tagCountItemsWithDebug]);
  const libraryNoTagsCount = useMemo(
    () => tagCountItemsWithDebug.filter((item) => uniqueTags(item.tags).length === 0).length,
    [tagCountItemsWithDebug]
  );

  useEffect(() => {
    if (!selectionEditorActive) {
      return;
    }

    if (selectedReferenceCount <= 1) {
      setBulkMetadataDraft({
        addTags: [],
        removeTags: [],
        favorite: ""
      });
      return;
    }

    const favoriteValues = [...new Set(selectedReferenceItems.map((item) => Boolean(item.favorite)))];

    setBulkMetadataDraft({
      addTags: [],
      removeTags: [],
      favorite: favoriteValues.length === 1 ? (favoriteValues[0] ? "yes" : "no") : ""
    });
  }, [selectedReferenceCount, selectedReferenceSelectionKey, items, selectionEditorActive]);

  useEffect(() => {
    setBulkMetadataFeedback("");
  }, [selectedReferenceSelectionKey]);

  useEffect(() => {
    if (!selectionEditorActive) {
      setBulkMetadataFeedback("");
    }
  }, [selectionEditorActive]);

  useEffect(() => {
    if (!selectedReferenceCount) {
      setLibraryTagActionMode(null);
    }
  }, [selectedReferenceCount]);

  useEffect(() => {
    if (!nestedTagDebugEnabled || typeof document === "undefined") {
      return undefined;
    }

    const createDocumentLogger = (label) => (event) => {
      const details = {
        type: event.type,
        eventPhase: getEventPhaseName(event.eventPhase),
        defaultPrevented: event.defaultPrevented,
        currentTarget: describeDebugNode(event.currentTarget),
        target: describeDebugNode(event.target),
        insideLibraryFilter: Boolean(wardrobeFiltersPanelRef.current?.contains(event.target)),
        insideControlsFilter: Boolean(generationMetadataFiltersPanelRef.current?.contains(event.target)),
        insideManageWindow: Boolean(event.target instanceof Element && event.target.closest(".wardrobe-manage-window")),
        wardrobeFiltersOpen,
        generationMetadataFiltersOpen,
        manageTagsOpen,
        activePanel,
        controlsOpen
      };
      console.log(`[nested-tag-debug] document ${label}`, details);
      recordNestedTagDebugMessage(nestedTagDebugEnabled, "document", label, details);
    };

    const documentPointerDownCapture = createDocumentLogger("pointerdown capture");
    const documentPointerDownBubble = createDocumentLogger("pointerdown bubble");
    const documentMouseDownCapture = createDocumentLogger("mousedown capture");
    const documentMouseDownBubble = createDocumentLogger("mousedown bubble");
    const documentClickCapture = createDocumentLogger("click capture");
    const documentClickBubble = createDocumentLogger("click bubble");
    const documentFocusCapture = createDocumentLogger("focusin capture");
    const documentFocusBubble = createDocumentLogger("focusin bubble");

    document.addEventListener("pointerdown", documentPointerDownCapture, true);
    document.addEventListener("pointerdown", documentPointerDownBubble);
    document.addEventListener("mousedown", documentMouseDownCapture, true);
    document.addEventListener("mousedown", documentMouseDownBubble);
    document.addEventListener("click", documentClickCapture, true);
    document.addEventListener("click", documentClickBubble);
    document.addEventListener("focusin", documentFocusCapture, true);
    document.addEventListener("focusin", documentFocusBubble);

    return () => {
      document.removeEventListener("pointerdown", documentPointerDownCapture, true);
      document.removeEventListener("pointerdown", documentPointerDownBubble);
      document.removeEventListener("mousedown", documentMouseDownCapture, true);
      document.removeEventListener("mousedown", documentMouseDownBubble);
      document.removeEventListener("click", documentClickCapture, true);
      document.removeEventListener("click", documentClickBubble);
      document.removeEventListener("focusin", documentFocusCapture, true);
      document.removeEventListener("focusin", documentFocusBubble);
    };
  }, [
    activePanel,
    controlsOpen,
    generationMetadataFiltersOpen,
    manageTagsOpen,
    nestedTagDebugEnabled,
    wardrobeFiltersOpen
  ]);

  useEffect(() => {
    if (!nestedTagDebugEnabled || typeof window === "undefined") {
      return undefined;
    }

    window.__nestedTagDebugLogs = [];
    const frame = window.setInterval(() => {
      setNestedTagDebugTick((current) => current + 1);
    }, 150);

    return () => window.clearInterval(frame);
  }, [nestedTagDebugEnabled]);

  useEffect(() => {
    if (!nestedTagDebugEnabled) {
      return;
    }

    const details = {
      wardrobeFiltersOpen,
      generationMetadataFiltersOpen,
      manageTagsOpen,
      activePanel,
      controlsOpen
    };
    console.log("[nested-tag-debug] panel state", details);
    recordNestedTagDebugMessage(nestedTagDebugEnabled, "app", "panel-state", details);
  }, [
    activePanel,
    controlsOpen,
    generationMetadataFiltersOpen,
    manageTagsOpen,
    nestedTagDebugEnabled,
    wardrobeFiltersOpen
  ]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!libraryTagActionMode) {
        return;
      }

      if (nestedTagDebugEnabled) {
        const details = {
          type: event.type,
          target: describeDebugNode(event.target),
          insideSelectionActions: Boolean(librarySelectionActionsRef.current?.contains(event.target))
        };
        console.log("[nested-tag-debug] libraryTagAction document pointerdown", details);
        recordNestedTagDebugMessage(nestedTagDebugEnabled, "library-tag-action", "document-pointerdown", details);
      }

      if (!librarySelectionActionsRef.current?.contains(event.target)) {
        setLibraryTagActionMode(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [libraryTagActionMode, nestedTagDebugEnabled]);

  useEffect(() => {
    return () => {
      if (bulkMetadataFeedbackTimeoutRef.current) {
        clearTimeout(bulkMetadataFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activePanel !== "wardrobe" || wardrobeSavedOpen) {
      libraryPerfRef.current = null;
      return undefined;
    }

    libraryPerfRef.current = createLibraryPerfSession(isLibraryPerfDebug);
    libraryPerfRef.current?.mark("library mount start", {
      totalCount: items.length
    });

    return () => {
      libraryPerfRef.current = null;
    };
  }, [activePanel, isLibraryPerfDebug, items.length, wardrobeSavedOpen]);

  function requestConfirmation({ title, message, confirmLabel = "Confirm" }) {
    return new Promise((resolve) => {
      setConfirmation({
        title,
        message,
        confirmLabel,
        onCancel: () => {
          setConfirmation(null);
          resolve(false);
        },
        onConfirm: () => {
          setConfirmation(null);
          resolve(true);
        }
      });
    });
  }
  const visibleWardrobeItems = useMemo(() => {
    const startedAt = isLibraryPerfDebug ? performance.now() : 0;
    const filtered = items.filter((item) =>
      matchesLibrarySearch(item, librarySearch) &&
      matchesWardrobeFilters(item, wardrobeFilters) &&
      (!wardrobeFilters.laundry ||
        (wardrobeFilters.laundry === "show" ? Boolean(excluded[item.id]) : !excluded[item.id]))
    );

    const sortedItems = filtered
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (wardrobeSort === "favorites") {
          return Number(Boolean(b.item.favorite)) - Number(Boolean(a.item.favorite)) || b.index - a.index;
        }

        if (wardrobeSort === "name") {
          return buildDisplayName(a.item).localeCompare(buildDisplayName(b.item)) || a.index - b.index;
        }

        if (wardrobeSort === "newest") {
          return compareItemsByCreatedAt(a.item, b.item, "desc") || b.index - a.index;
        }

        if (wardrobeSort === "oldest") {
          return compareItemsByCreatedAt(a.item, b.item, "asc") || a.index - b.index;
        }

        return a.index - b.index;
      })
      .map(({ item }) => item);

    if (isLibraryPerfDebug && activePanel === "wardrobe" && !wardrobeSavedOpen) {
      libraryPerfRef.current?.mark("data preparation", {
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        visibleCount: sortedItems.length,
        totalCount: items.length
      });
    }

    return sortedItems;
  }, [activePanel, excluded, isLibraryPerfDebug, items, librarySearch, wardrobeFilters, wardrobeSort, wardrobeSavedOpen]);
  const visibleWardrobeItemIds = useMemo(
    () => visibleWardrobeItems.map((item) => item.id),
    [visibleWardrobeItems]
  );
  const visibleBoardPickerItems = useMemo(
    () => getMetadataFilteredItems(items, generationMetadataFilters),
    [items, generationMetadataFilters]
  );
  const visibleLibraryTagEntries = useMemo(() => getTagFrequencyEntries(visibleWardrobeItems), [visibleWardrobeItems]);
  const libraryStats = useMemo(() => ({
    totalImages: items.length,
    visibleImages: visibleWardrobeItems.length,
    selectedImages: selectedReferenceCount,
    favoriteImages: visibleWardrobeItems.filter((item) => item.favorite).length,
    totalTags: visibleLibraryTagEntries.length,
    topTags: visibleLibraryTagEntries.slice(0, 5)
  }), [items.length, selectedReferenceCount, visibleLibraryTagEntries, visibleWardrobeItems]);
  const selectedReferenceIdSet = useMemo(
    () => new Set(selectedReferenceIdList),
    [selectedReferenceIdList]
  );
  const shouldVirtualizeWardrobeGrid = visibleWardrobeItems.length >= LIBRARY_VIRTUALIZATION_THRESHOLD;
  const virtualizedWardrobeGrid = useMemo(() => {
    if (!shouldVirtualizeWardrobeGrid) {
      return {
        totalHeight: 0,
        virtualItems: visibleWardrobeItems.map((item) => ({ item, style: null }))
      };
    }

    const availableWidth = Math.max(libraryGridViewport.width, LIBRARY_GRID_MIN_COLUMN_WIDTH);
    const columns = Math.max(
      1,
      Math.floor((availableWidth + LIBRARY_GRID_GAP) / (LIBRARY_GRID_MIN_COLUMN_WIDTH + LIBRARY_GRID_GAP))
    );
    const columnWidth = Math.max(
      LIBRARY_GRID_MIN_COLUMN_WIDTH,
      Math.floor((availableWidth - LIBRARY_GRID_GAP * (columns - 1)) / columns)
    );
    const rowStride = LIBRARY_GRID_ESTIMATED_ROW_HEIGHT + LIBRARY_GRID_GAP;
    const gridViewportTop = libraryGridViewport.scrollTop - libraryGridViewport.gridOffsetTop;
    const viewportHeight = Math.max(libraryGridViewport.height, rowStride);
    const startRow = Math.max(0, Math.floor(gridViewportTop / rowStride) - LIBRARY_GRID_OVERSCAN_ROWS);
    const endRow = Math.max(
      startRow,
      Math.ceil((gridViewportTop + viewportHeight) / rowStride) + LIBRARY_GRID_OVERSCAN_ROWS
    );
    const startIndex = Math.min(visibleWardrobeItems.length, startRow * columns);
    const endIndex = Math.min(visibleWardrobeItems.length, endRow * columns);
    const totalRows = Math.ceil(visibleWardrobeItems.length / columns);
    const totalHeight = Math.max(
      0,
      totalRows * LIBRARY_GRID_ESTIMATED_ROW_HEIGHT + Math.max(0, totalRows - 1) * LIBRARY_GRID_GAP
    );
    const virtualItems = visibleWardrobeItems.slice(startIndex, endIndex).map((item, index) => {
      const absoluteIndex = startIndex + index;
      const rowIndex = Math.floor(absoluteIndex / columns);
      const columnIndex = absoluteIndex % columns;

      return {
        item,
        style: {
          position: "absolute",
          top: `${rowIndex * rowStride}px`,
          left: `${columnIndex * (columnWidth + LIBRARY_GRID_GAP)}px`,
          width: `${columnWidth}px`,
          height: `${LIBRARY_GRID_ESTIMATED_ROW_HEIGHT}px`
        }
      };
    });

    return {
      totalHeight,
      virtualItems
    };
  }, [libraryGridViewport.gridOffsetTop, libraryGridViewport.height, libraryGridViewport.scrollTop, libraryGridViewport.width, shouldVirtualizeWardrobeGrid, visibleWardrobeItems]);
  const shouldVirtualizeBoardPicker = pickerBoardImageId && visibleBoardPickerItems.length >= LIBRARY_VIRTUALIZATION_THRESHOLD;
  const virtualizedBoardPickerItems = useMemo(() => {
    if (!shouldVirtualizeBoardPicker) {
      return {
        totalHeight: 0,
        virtualRows: [{ key: "row-0", style: null, items: visibleBoardPickerItems }]
      };
    }

    const columns = BOARD_PICKER_GRID_COLUMNS;
    const rowStride = BOARD_PICKER_ESTIMATED_ROW_HEIGHT + BOARD_PICKER_GRID_GAP;
    const viewportHeight = Math.max(boardPickerViewport.height, rowStride * 2);
    const startRow = Math.max(0, Math.floor(boardPickerViewport.scrollTop / rowStride) - BOARD_PICKER_OVERSCAN_ROWS);
    const endRow = Math.max(
      startRow,
      Math.ceil((boardPickerViewport.scrollTop + viewportHeight) / rowStride) + BOARD_PICKER_OVERSCAN_ROWS
    );
    const startIndex = Math.min(visibleBoardPickerItems.length, startRow * columns);
    const endIndex = Math.min(visibleBoardPickerItems.length, endRow * columns);
    const totalRows = Math.ceil(visibleBoardPickerItems.length / columns);
    const totalHeight = Math.max(
      0,
      totalRows * BOARD_PICKER_ESTIMATED_ROW_HEIGHT + Math.max(0, totalRows - 1) * BOARD_PICKER_GRID_GAP
    );
    const virtualRows = [];

    for (let rowIndex = startRow; rowIndex < endRow; rowIndex += 1) {
      const rowStartIndex = rowIndex * columns;
      if (rowStartIndex >= visibleBoardPickerItems.length) {
        break;
      }

      virtualRows.push({
        key: `row-${rowIndex}`,
        style: {
          position: "absolute",
          top: `${rowIndex * rowStride}px`,
          left: "0",
          right: "0",
          height: `${BOARD_PICKER_ESTIMATED_ROW_HEIGHT}px`
        },
        items: visibleBoardPickerItems.slice(rowStartIndex, rowStartIndex + columns)
      });
    }

    return {
      totalHeight,
      virtualRows
    };
  }, [boardPickerViewport.height, boardPickerViewport.scrollTop, shouldVirtualizeBoardPicker, visibleBoardPickerItems]);

  useEffect(() => {
    if (activePanel !== "wardrobe" || wardrobeSavedOpen) {
      return undefined;
    }

    const scrollElement = wardrobePanelScrollRef.current;
    const gridElement = wardrobeGridRef.current;

    if (!scrollElement || !gridElement) {
      return undefined;
    }

    let frameId = 0;
    const updateViewport = () => {
      frameId = 0;

      const nextWidth = Math.max(scrollElement.clientWidth - 4, 0);
      const nextHeight = scrollElement.clientHeight;
      const nextScrollTop = scrollElement.scrollTop;
      const scrollBounds = scrollElement.getBoundingClientRect();
      const gridBounds = gridElement.getBoundingClientRect();
      const nextGridOffsetTop = Math.max(0, gridBounds.top - scrollBounds.top + nextScrollTop);

      setLibraryGridViewport((current) => {
        if (
          current.width === nextWidth &&
          current.height === nextHeight &&
          current.scrollTop === nextScrollTop &&
          current.gridOffsetTop === nextGridOffsetTop
        ) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
          scrollTop: nextScrollTop,
          gridOffsetTop: nextGridOffsetTop
        };
      });
    };

    const scheduleViewportUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateViewport);
    };

    scheduleViewportUpdate();
    scrollElement.addEventListener("scroll", scheduleViewportUpdate, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      scheduleViewportUpdate();
    });

    resizeObserver.observe(scrollElement);
    resizeObserver.observe(gridElement);
    window.addEventListener("resize", scheduleViewportUpdate);

    return () => {
      scrollElement.removeEventListener("scroll", scheduleViewportUpdate);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleViewportUpdate);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [activePanel, visibleWardrobeItems.length, wardrobeSavedOpen]);

  useEffect(() => {
    if (!pickerBoardImageId) {
      setBoardPickerViewport({
        width: 0,
        height: 0,
        scrollTop: 0
      });
      return undefined;
    }

    const listElement = boardPickerListRef.current;

    if (!listElement) {
      return undefined;
    }

    let frameId = 0;
    const updateViewport = () => {
      frameId = 0;
      setBoardPickerViewport((current) => {
        const nextViewport = {
          width: listElement.clientWidth,
          height: listElement.clientHeight,
          scrollTop: listElement.scrollTop
        };

        if (
          current.width === nextViewport.width &&
          current.height === nextViewport.height &&
          current.scrollTop === nextViewport.scrollTop
        ) {
          return current;
        }

        return nextViewport;
      });
    };

    const scheduleViewportUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateViewport);
    };

    scheduleViewportUpdate();
    listElement.addEventListener("scroll", scheduleViewportUpdate, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      scheduleViewportUpdate();
    });

    resizeObserver.observe(listElement);
    window.addEventListener("resize", scheduleViewportUpdate);

    return () => {
      listElement.removeEventListener("scroll", scheduleViewportUpdate);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleViewportUpdate);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [pickerBoardImageId]);

  useEffect(() => {
    if (activePanel !== "wardrobe" || wardrobeSavedOpen || !virtualizedWardrobeGrid.virtualItems.length) {
      return undefined;
    }

    const perfSession = libraryPerfRef.current;

    if (!perfSession || perfSession.renderCompleted) {
      return undefined;
    }

    let frameId = window.requestAnimationFrame(() => {
      perfSession.mark("first visible grid render", {
        renderedCount: virtualizedWardrobeGrid.virtualItems.length,
        visibleCount: visibleWardrobeItems.length,
        virtualized: shouldVirtualizeWardrobeGrid
      });
      perfSession.renderCompleted = true;
      perfSession.mark("full grid render complete", {
        renderedCount: virtualizedWardrobeGrid.virtualItems.length,
        visibleCount: visibleWardrobeItems.length,
        virtualized: shouldVirtualizeWardrobeGrid
      });
      perfSession.flush();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activePanel, shouldVirtualizeWardrobeGrid, virtualizedWardrobeGrid.virtualItems.length, visibleWardrobeItems.length, wardrobeSavedOpen]);

  const handleLibraryReferenceSelect = useCallback((itemId, event) => {
    selectReference(itemId, event);
  }, [selectReference]);
  const handleLibraryReferencePreview = useCallback((item) => {
    openReferencePreview(item);
  }, [openReferencePreview]);
  const handleVisibleLibraryImageMount = useCallback(() => {
    const perfSession = libraryPerfRef.current;

    if (!perfSession || perfSession.imageRenderStarted) {
      return;
    }

    perfSession.imageRenderStarted = true;
    perfSession.mark("image render start");
  }, []);
  const boardLayoutMetadataByReferenceId = useMemo(
    () => buildBoardLayoutMetadataByReferenceId(items, runtimeImageMetricsByItemId),
    [items, runtimeImageMetricsByItemId]
  );
  const boardLayoutOptions = useMemo(() => ({
    aspectRatiosByReferenceId: Object.fromEntries(
      Object.entries(boardLayoutMetadataByReferenceId).map(([referenceId, value]) => [referenceId, value.aspectRatio])
    ),
    sizeMultipliersByReferenceId: Object.fromEntries(
      Object.entries(boardLayoutMetadataByReferenceId).map(([referenceId, value]) => [referenceId, value.sizeMultiplier])
    ),
    renderMetadataByReferenceId: Object.fromEntries(
      Object.entries(boardLayoutMetadataByReferenceId).map(([referenceId, value]) => [referenceId, value.renderMetadata])
    )
  }), [boardLayoutMetadataByReferenceId]);
  const boardRenderLayoutSignature = useMemo(
    () =>
      JSON.stringify(
        (board?.images ?? []).map((image) => ({
          ...getBoardLayoutSignatureEntry(image, itemsById[image.referenceId])
        })).filter(Boolean)
      ),
    [board?.images, itemsById]
  );
  const tagManagerEntries = useMemo(() => {
    const query = normalizeTag(tagManagerSearch);

    return getTagFrequencyEntries(tagDebugSourceItems).filter(({ tag }) => !query || tag.includes(query));
  }, [tagDebugSourceItems, tagManagerSearch]);
  const tagManagerTree = useMemo(
    () => finalizeNestedTagNodes(buildNestedTagNodes(tagManagerEntries), "alpha"),
    [tagManagerEntries]
  );

  function relayoutBoardStateImages(boardImages, layoutOptionsOverride = boardLayoutOptions) {
    const nextImages = (Array.isArray(boardImages) ? boardImages : []).filter((image) => image?.referenceId);

    if (!nextImages.length) {
      return null;
    }

    const relaidBoard = relayoutBoardImages(nextImages, layoutOptionsOverride);

    return {
      id: board?.id ?? `board_${Date.now()}`,
      width: relaidBoard.width,
      height: relaidBoard.height,
      images: relaidBoard.images
    };
  }

  function buildGeneratedBoard(sourceItems, options = {}) {
    const perfSession = options.perfSession ?? null;
    const filteredSourceItems = getMetadataFilteredItems(sourceItems, options.metadataFilters);
    perfSession?.mark("metadata filter selection logic done", {
      sourceCount: Array.isArray(sourceItems) ? sourceItems.length : 0,
      filteredCount: filteredSourceItems.length
    });
    const effectiveSourceItems = filteredSourceItems.length ? filteredSourceItems : [];
    perfSession?.mark("image preparation / layout metadata done", {
      metadataEntries: Object.keys(boardLayoutMetadataByReferenceId).length,
      reused: true
    });

    return generateBoard({
      items: effectiveSourceItems,
      imageCount: options.imageCount ?? DEFAULT_BOARD_IMAGE_COUNT,
      excluded: options.excluded ?? {},
      generationLists: options.generationLists ?? defaultGenerationLists,
      outfitFilters: options.outfitFilters ?? emptyOutfitFilters,
      weatherData: options.weatherData ?? null,
      generationMode: options.generationMode ?? defaultGenerationMode,
      outfitAffinity: options.outfitAffinity ?? {},
      recentOutfits: options.recentOutfits ?? [],
      layoutOptions: boardLayoutOptions,
      debugHooks: perfSession,
      boardFilters: options.metadataFilters ?? null,
      boardGuidedOptions: {
        collectTopCandidates: Boolean(options.collectTopCandidates)
      }
    });
  }

  function buildBoardFromLegacyReferences(referenceIds, sourceItems) {
    const filteredSourceItems = getMetadataFilteredItems(sourceItems, generationMetadataFilters);
    const sourceItemsById = Object.fromEntries(filteredSourceItems.map((item) => [item.id, item]));
    const validReferenceIds = referenceIds.filter((referenceId) => sourceItemsById[referenceId]);

    if (validReferenceIds.length) {
      return createBoardFromReferenceIds(validReferenceIds, boardLayoutOptions);
    }

    return buildGeneratedBoard(filteredSourceItems, {
      metadataFilters: generationMetadataFilters
    }).board;
  }

  const clearBoardGenerationFeedback = useCallback(() => {
    if (boardGenerationFrameRef.current) {
      cancelAnimationFrame(boardGenerationFrameRef.current);
      boardGenerationFrameRef.current = null;
    }

    if (boardGenerationIndicatorTimeoutRef.current) {
      clearTimeout(boardGenerationIndicatorTimeoutRef.current);
      boardGenerationIndicatorTimeoutRef.current = null;
    }

    boardGenerationInFlightRef.current = false;
    setIsBoardGenerating(false);
    setShowBoardGenerationBusy(false);
  }, []);

  const applyGeneratedBoardResult = useCallback((result, options = {}) => {
    if (!result) {
      clearBoardGenerationFeedback();
      return;
    }

    const { fitView = true } = options;
    const perfSession = options.perfSession ?? null;
    perfSession?.mark("generation logic done", {
      boardImageCount: result.board?.images?.length ?? 0
    });
    if (perfSession) {
      perfSession.expectedBoardId = result.board?.id ?? null;
    }

    startBoardTransition(() => {
      setBoard(result.board);
      setOutfit(result.syntheticOutfit);
      setGuidedDebugPayload(result.guidedDebugPayload);

      if (fitView) {
        setBoardView(getFittedBoardView(result.board));
      }

      perfSession?.mark("state commit scheduled");
    });

    if (!perfSession) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          clearBoardGenerationFeedback();
        });
      });
    }
  }, [clearBoardGenerationFeedback, startBoardTransition]);

  const scheduleBoardGeneration = useCallback((buildBoard, options = {}) => {
    if (boardGenerationInFlightRef.current) {
      return;
    }

    boardGenerationInFlightRef.current = true;
    clearBoardGenerationFeedback();
    boardGenerationInFlightRef.current = true;
    setIsBoardGenerating(true);
    const perfSession = options.perfSession ?? null;
    boardGenerationPerfRef.current = perfSession;
    perfSession?.mark("generate:start");
    boardGenerationIndicatorTimeoutRef.current = setTimeout(() => {
      setShowBoardGenerationBusy(true);
      boardGenerationIndicatorTimeoutRef.current = null;
    }, 150);

    boardGenerationFrameRef.current = requestAnimationFrame(() => {
      boardGenerationFrameRef.current = null;
      perfSession?.mark("frame start");
      try {
        const result = buildBoard();
        options.onComplete?.(result);
        applyGeneratedBoardResult(result, {
          ...options,
          perfSession
        });
      } catch (error) {
        console.error("Board generation failed.", error);
        clearBoardGenerationFeedback();
      }
    });
  }, [applyGeneratedBoardResult, clearBoardGenerationFeedback]);

  function hydrateSavedBoards(rawSavedOutfits, sourceItems) {
    return normalizeSavedOutfits(rawSavedOutfits)
      .map((savedOutfit) => {
        const boardFromState = normalizeBoard(savedOutfit.board);
        const hydratedBoard = boardFromState
          ? {
              ...boardFromState,
              images: boardFromState.images.filter((image) => itemsById[image.referenceId])
            }
          : buildBoardFromLegacyReferences(Object.values(savedOutfit.outfit ?? {}).filter(Boolean), sourceItems);

        return hydratedBoard?.images?.length
          ? {
              ...savedOutfit,
              board: hydratedBoard
            }
          : null;
      })
      .filter(Boolean);
  }

  function resolveBoardFromAppState(appState, sourceItems) {
    const normalizedBoard = normalizeBoard(appState?.board);

    if (normalizedBoard?.images?.length) {
      const filteredBoard = {
        ...normalizedBoard,
        images: normalizedBoard.images.filter((image) => itemsById[image.referenceId])
      };

      if (filteredBoard.images.length) {
        return filteredBoard;
      }
    }

    const legacyReferenceIds = Object.values(appState?.outfit ?? {}).filter(Boolean);
    return buildBoardFromLegacyReferences(legacyReferenceIds, sourceItems);
  }

  useEffect(() => {
    let cancelled = false;

    async function updateOutfitPalette() {
      if (!currentBoardItems.length) {
        setOutfitPalette([]);
        return;
      }

      const itemPalettes = await Promise.all(
        currentBoardItems.map(async (item) => {
          const cacheKey = `${item.id}:${item.imageUrl}:${item.color}`;
          if (!paletteCacheRef.current.has(cacheKey)) {
            paletteCacheRef.current.set(cacheKey, await extractItemPalette(item));
          }

          return {
            item,
            colors: paletteCacheRef.current.get(cacheKey)
          };
        })
      );

      if (!cancelled) {
        setOutfitPalette(mergePaletteColors(itemPalettes));
      }
    }

    updateOutfitPalette();

    return () => {
      cancelled = true;
    };
  }, [currentBoardItems]);

  useEffect(() => {
    if (!board) {
      return;
    }

    setOutfit(boardToSyntheticOutfit(board));
  }, [board]);

  useEffect(() => {
    if (!pendingRestoredBoardFitRef.current || loading || !board?.images?.length || !boardViewportRef.current) {
      return;
    }

    pendingRestoredBoardFitRef.current = false;
    setBoardView(getFittedBoardView(board));
  }, [board, loading]);

  useEffect(() => {
    setImageCountDraft(String(imageCount));
  }, [imageCount]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [storedItems, storedAppState] = await Promise.all([loadItems(), loadAppState()]);
      const normalizedItems = storedItems
        .map(normalizeItem)
        .map((item) =>
          (storedAppState?.imagePresentationMigrationVersion ?? 0) < IMAGE_PRESENTATION_MIGRATION_VERSION
            ? restoreLegacyBakedImageScale(item)
            : item
        );
      const shouldApplyStyleWeightMigration =
        (storedAppState?.itemDefaultsMigrationVersion ?? 0) < ITEM_DEFAULTS_MIGRATION_VERSION;
      const shouldApplyImagePresentationMigration =
        (storedAppState?.imagePresentationMigrationVersion ?? 0) < IMAGE_PRESENTATION_MIGRATION_VERSION;
      const styleWeightedItems = shouldApplyStyleWeightMigration
        ? normalizedItems.map(applyMappedStyleWeightDefaults)
        : normalizedItems;
      const effectiveItems = shouldApplyImagePresentationMigration
        ? await Promise.all(styleWeightedItems.map((item) => bakeItemImagePresentation(item)))
        : styleWeightedItems;
      const migratedItems = effectiveItems.filter(
        (item, index) =>
          itemNeedsRetailMigration(storedItems[index], item) ||
          itemNeedsImageFrameScaleMigration(storedItems[index], item) ||
          itemNeedsImageScaleMigration(storedItems[index], item) ||
          itemNeedsImageOffsetMigration(storedItems[index], item) ||
          itemNeedsImageCropMigration(storedItems[index], item) ||
          itemNeedsFavoriteMigration(storedItems[index], item) ||
          itemNeedsQuantityMigration(storedItems[index], item) ||
          itemNeedsColorMigration(storedItems[index], item) ||
          (!shouldApplyStyleWeightMigration && itemNeedsWeightMigration(storedItems[index], item)) ||
          itemNeedsGarmentTypeMigration(storedItems[index], item) ||
          (!shouldApplyStyleWeightMigration && itemNeedsTagMigration(storedItems[index], item)) ||
          itemNeedsClimateTagMigration(storedItems[index], item) ||
          itemNeedsDefaultMetadataMigration(storedItems[index], item) ||
          itemNeedsMoodboardMetadataMigration(storedItems[index], item) ||
          (shouldApplyStyleWeightMigration && itemNeedsStyleWeightMappingMigration(storedItems[index], item))
      );

      if (cancelled) {
        return;
      }

      if (migratedItems.length) {
        await Promise.all(migratedItems.map((item) => saveItem(item)));
      }

      setItems(effectiveItems);

      if (storedAppState) {
        const resolvedImageCount = resolvePersistedImageCount(storedAppState.imageCount);
        const normalizedGenerationLists = normalizeGenerationLists(storedAppState.generationLists);
        const normalizedGenerationMode = normalizeGenerationMode(storedAppState.generationMode);
        const normalizedMetadataFilters = normalizeMetadataFilterState(storedAppState.generationMetadataFilters);
        const normalizedOutfitFilters = normalizeOutfitFilters(storedAppState.outfitFilters);
        const normalizedOutfitAffinity = normalizeOutfitAffinity(storedAppState.outfitAffinity);
        const normalizedRecentOutfits = normalizeRecentOutfits(storedAppState.recentOutfits);
        setLayering(Boolean(storedAppState.layering));
        setAccessoriesEnabled(storedAppState.accessoriesEnabled ?? true);
        setLocked(storedAppState.locked ?? {});
        setExcluded(storedAppState.excluded ?? {});
        const restoredBoard = resolveBoardFromAppState(storedAppState, effectiveItems);
        const nextBoard = shouldRegenerateLegacyBoardForImageCount(restoredBoard, resolvedImageCount)
          ? buildGeneratedBoard(effectiveItems, {
              imageCount: resolvedImageCount,
              metadataFilters: normalizedMetadataFilters,
              excluded: storedAppState.excluded ?? {},
              generationLists: normalizedGenerationLists,
              outfitFilters: normalizedOutfitFilters,
              weatherData: storedAppState.weatherData ?? null,
              generationMode: normalizedGenerationMode,
              outfitAffinity: normalizedOutfitAffinity,
              recentOutfits: normalizedRecentOutfits
            }).board
          : restoredBoard;
        pendingRestoredBoardFitRef.current = Boolean(nextBoard?.images?.length);
        setBoard(nextBoard);
        setImageCount(resolvedImageCount);
        setOutfit(boardToSyntheticOutfit(nextBoard));
        setBoardView(nextBoard ? getFittedBoardView(nextBoard) : { x: 0, y: 0, zoom: 1 });
        setGuidedDebugPayload([]);
        setIgnoredImportImages(storedAppState.ignoredImportImages ?? []);
        setSavedOutfits(hydrateSavedBoards(storedAppState.savedOutfits, effectiveItems));
        setLikedOutfitKeys(normalizeLikedOutfitKeys(storedAppState.likedOutfitKeys));
        setOutfitAffinity(normalizedOutfitAffinity);
        setRecentOutfits(normalizedRecentOutfits);
        setGenerateCount(Math.max(0, Math.round(Number(storedAppState.generateCount) || 0)));
        setGenerationLists(normalizedGenerationLists);
        setGenerationMode(normalizedGenerationMode);
        setGenerationMetadataFilters(normalizedMetadataFilters);
        setOutfitFilters(normalizedOutfitFilters);
        setWeatherSettings(normalizeWeatherSettings(storedAppState.weatherSettings));
        setWeatherLocationDraft(storedAppState.weatherSettings?.locationName ?? "");
        setWeatherData(storedAppState.weatherData ?? null);
        setFitpics(storedAppState.fitpics ?? []);
      } else {
        const defaultData = getDefaultData();
        const defaultState = defaultData.appState;
        setLayering(Boolean(defaultState.layering));
        setAccessoriesEnabled(defaultState.accessoriesEnabled ?? true);
        setLocked(defaultState.locked ?? {});
        setExcluded(defaultState.excluded ?? {});
        const generatedBoard = buildGeneratedBoard(effectiveItems, {
          imageCount: normalizeImageCount(defaultState.imageCount),
          excluded: {},
          generationLists: defaultGenerationLists,
          outfitFilters: emptyOutfitFilters,
          generationMode: defaultGenerationMode,
          outfitAffinity: normalizeOutfitAffinity(defaultState.outfitAffinity),
          recentOutfits: normalizeRecentOutfits(defaultState.recentOutfits)
        });
        setBoard(generatedBoard.board);
        setImageCount(resolvePersistedImageCount(defaultState.imageCount));
        setOutfit(generatedBoard.syntheticOutfit);
        setBoardView(getFittedBoardView(generatedBoard.board));
        setGuidedDebugPayload([]);
        setIgnoredImportImages(defaultState.ignoredImportImages ?? []);
        setSavedOutfits(hydrateSavedBoards(defaultState.savedOutfits, effectiveItems));
        setLikedOutfitKeys(normalizeLikedOutfitKeys(defaultState.likedOutfitKeys));
        setOutfitAffinity(normalizeOutfitAffinity(defaultState.outfitAffinity));
        setRecentOutfits(normalizeRecentOutfits(defaultState.recentOutfits));
        setGenerateCount(Math.max(0, Math.round(Number(defaultState.generateCount) || 0)));
        setGenerationLists(normalizeGenerationLists(defaultState.generationLists));
        setGenerationMode(normalizeGenerationMode(defaultState.generationMode));
        setGenerationMetadataFilters(normalizeMetadataFilterState(defaultState.generationMetadataFilters));
        setOutfitFilters(normalizeOutfitFilters(defaultState.outfitFilters));
        setWeatherSettings(normalizeWeatherSettings(defaultState.weatherSettings));
        setWeatherLocationDraft(defaultState.weatherSettings?.locationName ?? "");
        setWeatherData(defaultState.weatherData ?? null);
        setFitpics(defaultState.fitpics ?? []);
      }

      setLoading(false);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => clearBoardGenerationFeedback, [clearBoardGenerationFeedback]);

  useEffect(() => () => {
    if (boardRelayoutFrameRef.current) {
      cancelAnimationFrame(boardRelayoutFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const nextAppState = {
      itemDefaultsMigrationVersion: ITEM_DEFAULTS_MIGRATION_VERSION,
      imagePresentationMigrationVersion: IMAGE_PRESENTATION_MIGRATION_VERSION,
      layering,
      accessoriesEnabled,
      locked,
      excluded,
      outfit,
      board,
      ignoredImportImages,
      savedOutfits,
      likedOutfitKeys,
      outfitAffinity,
      recentOutfits,
      generateCount,
      imageCount,
      generationLists,
      generationMode,
      generationMetadataFilters,
      outfitFilters,
      weatherSettings,
      weatherData,
      fitpics
    };
    const saveStartedAt = isGeneratePerfDebug ? performance.now() : 0;
    if (saveAppStateTimeoutRef.current) {
      clearTimeout(saveAppStateTimeoutRef.current);
      saveAppStateTimeoutRef.current = null;
    }
    if (saveAppStateIdleCallbackRef.current && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(saveAppStateIdleCallbackRef.current);
      saveAppStateIdleCallbackRef.current = null;
    }

    const runSave = () => {
      saveAppState(nextAppState).then(() => {
        if (isGeneratePerfDebug) {
          boardGenerationPerfRef.current?.mark("persistence done", {
            durationMs: Math.round((performance.now() - saveStartedAt) * 100) / 100
          });
        }
      });
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      saveAppStateIdleCallbackRef.current = window.requestIdleCallback(() => {
        saveAppStateIdleCallbackRef.current = null;
        runSave();
      }, { timeout: 400 });
    } else {
      saveAppStateTimeoutRef.current = setTimeout(() => {
        saveAppStateTimeoutRef.current = null;
        runSave();
      }, 120);
    }
  }, [layering, accessoriesEnabled, locked, excluded, outfit, board, ignoredImportImages, savedOutfits, likedOutfitKeys, outfitAffinity, recentOutfits, generateCount, imageCount, generationLists, generationMode, generationMetadataFilters, outfitFilters, weatherSettings, weatherData, fitpics, isGeneratePerfDebug, loading]);

  useEffect(() => () => {
    if (saveAppStateTimeoutRef.current) {
      clearTimeout(saveAppStateTimeoutRef.current);
    }
    if (saveAppStateIdleCallbackRef.current && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(saveAppStateIdleCallbackRef.current);
    }
    if (backupExportFeedbackTimeoutRef.current) {
      clearTimeout(backupExportFeedbackTimeoutRef.current);
    }
  }, []);

  const currentPersistedAppState = useMemo(
    () => ({
      itemDefaultsMigrationVersion: ITEM_DEFAULTS_MIGRATION_VERSION,
      imagePresentationMigrationVersion: IMAGE_PRESENTATION_MIGRATION_VERSION,
      layering,
      accessoriesEnabled,
      locked,
      excluded,
      outfit,
      board,
      ignoredImportImages,
      savedOutfits,
      likedOutfitKeys,
      outfitAffinity,
      recentOutfits,
      generateCount,
      imageCount,
      generationLists,
      generationMode,
      generationMetadataFilters,
      outfitFilters,
      weatherSettings,
      weatherData,
      fitpics
    }),
    [
      layering,
      accessoriesEnabled,
      locked,
      excluded,
      outfit,
      board,
      ignoredImportImages,
      savedOutfits,
      likedOutfitKeys,
      outfitAffinity,
      recentOutfits,
      generateCount,
      imageCount,
      generationLists,
      generationMode,
      generationMetadataFilters,
      outfitFilters,
      weatherSettings,
      weatherData,
      fitpics
    ]
  );

  useEffect(() => {
    const perfSession = boardGenerationPerfRef.current;

    if (!perfSession?.expectedBoardId || board?.id !== perfSession.expectedBoardId) {
      return undefined;
    }

    perfSession.mark("state committed", {
      boardId: board.id,
      imageCount: board.images?.length ?? 0
    });

    let cancelled = false;
    const firstFrameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        perfSession.mark("first board render visible", {
          renderedImages: board.images?.length ?? 0
        });
        perfSession.flush();
        if (boardGenerationPerfRef.current === perfSession) {
          boardGenerationPerfRef.current = null;
        }
        clearBoardGenerationFeedback();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrameId);
    };
  }, [board, clearBoardGenerationFeedback]);

  useEffect(() => {
    if (loading || !items.length) {
      return;
    }

    setBoard((current) => {
      if (!current?.images?.length) {
        const generatedBoard = buildGeneratedBoard(items, {
          imageCount,
          metadataFilters: generationMetadataFilters,
          excluded,
          generationLists,
          outfitFilters,
          weatherData,
          generationMode,
          outfitAffinity,
          recentOutfits
        });
        setOutfit(generatedBoard.syntheticOutfit);
        setGuidedDebugPayload(generatedBoard.guidedDebugPayload);
        setBoardView(getFittedBoardView(generatedBoard.board));
        return generatedBoard.board;
      }

      const nextImages = current.images.filter((image) => itemsById[image.referenceId]);

      if (nextImages.length === current.images.length) {
        return current;
      }

      if (!nextImages.length) {
        const generatedBoard = buildGeneratedBoard(items, {
          imageCount,
          metadataFilters: generationMetadataFilters,
          excluded,
          generationLists,
          outfitFilters,
          weatherData,
          generationMode,
          outfitAffinity,
          recentOutfits
        });
        setOutfit(generatedBoard.syntheticOutfit);
        setGuidedDebugPayload(generatedBoard.guidedDebugPayload);
        setBoardView(getFittedBoardView(generatedBoard.board));
        return generatedBoard.board;
      }

      const nextBoard = {
        ...current,
        images: nextImages.map((image, index) => ({
          ...image,
          zIndex: index + 1
        }))
      };
      setOutfit(boardToSyntheticOutfit(nextBoard));
      setGuidedDebugPayload([]);
      return nextBoard;
    });
  }, [items, itemsById, excluded, imageCount, generationLists, generationMode, generationMetadataFilters, outfitFilters, weatherData, outfitAffinity, recentOutfits, loading]);

  useEffect(() => {
    if (loading || !board?.images?.length) {
      boardRenderLayoutSignatureRef.current = boardRenderLayoutSignature;
      return;
    }

    if (boardGenerationInFlightRef.current) {
      boardRenderLayoutSignatureRef.current = boardRenderLayoutSignature;
      return;
    }

    if (!boardRenderLayoutSignatureRef.current) {
      boardRenderLayoutSignatureRef.current = boardRenderLayoutSignature;
      return;
    }

    if (boardRenderLayoutSignatureRef.current === boardRenderLayoutSignature) {
      return;
    }

    boardRenderLayoutSignatureRef.current = boardRenderLayoutSignature;
    if (boardRelayoutFrameRef.current) {
      cancelAnimationFrame(boardRelayoutFrameRef.current);
    }
    boardRelayoutFrameRef.current = requestAnimationFrame(() => {
      boardRelayoutFrameRef.current = null;
      setBoard((current) => (current?.images?.length ? relayoutBoardStateImages(current.images) : current));
    });
  }, [board?.images?.length, boardRenderLayoutSignature, loading]);

  useEffect(() => {
    if (!pickerBoardImageId) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      if (pickerOverlayRef.current?.contains(event.target)) {
        return;
      }

      closePickerOverlay();
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  }, [pickerBoardImageId]);

  useEffect(() => {
    if (!outfitDebugOpen) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      if (outfitDebugRef.current?.contains(event.target)) {
        return;
      }

      setOutfitDebugOpen(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  }, [outfitDebugOpen]);

  useEffect(() => {
    function handleDocumentKeyDown(event) {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        if (cropEditorState) {
          event.preventDefault();
          applyCropEditor();
          return;
        }

        if (
          editingId &&
          !(event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, .tag-input"))
        ) {
          event.preventDefault();
          void persistDraftItem();
          return;
        }
      }

      if (event.key !== "Escape") {
        return;
      }

      if (cropEditorState) {
        event.preventDefault();
        closeCropEditor();
        return;
      }

      if (confirmation) {
        event.preventDefault();
        confirmation.onCancel();
        return;
      }

      if (fitpicPreview) {
        event.preventDefault();
        setFitpicPreview(null);
        return;
      }

      if (referencePreview) {
        event.preventDefault();
        setReferencePreview(null);
        return;
      }

      if (editingId) {
        event.preventDefault();
        cancelEdit();
        return;
      }

      if (pickerBoardImageId) {
        event.preventDefault();
        closePickerOverlay();
        return;
      }

      if (wardrobeFiltersOpen) {
        event.preventDefault();
        setWardrobeFiltersOpen(false);
        return;
      }

      if (wardrobeWorthOpen) {
        event.preventDefault();
        setWardrobeWorthOpen(false);
        return;
      }

      if (wardrobeSavedOpen) {
        event.preventDefault();
        cancelEditSavedOutfit();
        setWardrobeSavedOpen(false);
        return;
      }

      if (wardrobeManageOpen) {
        event.preventDefault();
        setWardrobeManageOpen(false);
        return;
      }

      if (activePanel) {
        event.preventDefault();
        closeWorkspacePanel();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [
    pickerBoardImageId,
    activePanel,
    confirmation,
    editingId,
    fitpicPreview,
    referencePreview,
    cropEditorState,
    wardrobeFiltersOpen,
    wardrobeWorthOpen,
    wardrobeSavedOpen,
    wardrobeManageOpen
  ]);

  function handleGenerate() {
    if (isBoardGenerating || boardGenerationInFlightRef.current) {
      return;
    }

    const perfSession = createGeneratePerfSession(isGeneratePerfDebug);
    perfSession?.mark("generate button click handler");

    setActivePanel(null);
    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setFitpicPreview(null);
    setReferencePreview(null);
    setEditingId(null);
    setEditorReturnTarget(null);
    setPickerBoardImageId(null);
    scheduleBoardGeneration(
      () =>
        buildGeneratedBoard(items, {
          imageCount,
          metadataFilters: generationMetadataFilters,
          excluded,
          generationLists,
          outfitFilters,
          weatherData,
          generationMode,
          outfitAffinity,
          recentOutfits,
          perfSession,
          collectTopCandidates: outfitDebugOpen
        }),
      {
        perfSession,
        onComplete: (result) => {
          if (generationMode !== "guided") {
            return;
          }

          startTransition(() => {
            setRecentOutfits((currentRecentOutfits) =>
              rememberRecentOutfit(currentRecentOutfits, result.syntheticOutfit, true, { preserveLiked: true })
            );
          });
        }
      }
    );
    setGenerateCount((current) => current + 1);
  }

  function commitImageCountDraft(nextDraft = imageCountDraft) {
    const sanitizedDraft = sanitizeImageCountDraft(nextDraft);
    const nextValue = sanitizedDraft ? normalizeImageCount(sanitizedDraft) : imageCount;

    setImageCount(nextValue);
    setImageCountDraft(String(nextValue));
  }

  function handleReroll(slot) {
    if (locked[slot]) {
      return;
    }

    const pool = getSlotOptions(slot).filter((item) => item.id !== outfit[slot]);

    const nextItem = pickNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering);

    setOutfit((current) => ({
      ...current,
      [slot]: nextItem?.id ?? null
    }));
  }

  function getSlotOptions(slot) {
    return getEligibleSlotPool(items, slot, excluded, generationLists, layering, outfitFilters, weatherData, outfit, itemsById);
  }

  function getSlotPickerOptions(slot) {
    let pool = getPool(items, slot, {}, generationLists, layering);

    if (layering && (slot === "TopInner" || slot === "TopOuter")) {
      const otherTopSlot = getOtherTopSlot(slot);
      const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

      if (otherItem?.layerType === "Both") {
        pool = pool.filter((item) => item.layerType !== "Both");
      }

      pool = filterPoolForLayeringRules(pool, slot, outfit, itemsById);
    }

    return pool;
  }

  function getAccessoryOptions(slot) {
    return items.filter(
      (item) =>
        item.garmentType === "Accessory" &&
        item.accessorySlot === slot &&
        isEligibleForGeneration(item, excluded, generationLists)
    );
  }

  function setOutfitSlot(slot, itemId) {
    setOutfit((current) => ({
      ...current,
      [slot]: itemId
    }));
  }

  function removeOutfitSlot(slot) {
    setOutfitSlot(slot, null);
  }

  function cycleOutfitSlot(slot, direction) {
    const options = getSlotOptions(slot);

    if (!options.length) {
      setOutfitSlot(slot, null);
      return;
    }

    const currentIndex = options.findIndex((item) => item.id === outfit[slot]);
    const fallbackIndex = direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex + direction + options.length) % options.length;

    setOutfitSlot(slot, options[nextIndex].id);
  }

  function cycleAccessorySlot(slot, direction) {
    const options = getAccessoryOptions(slot);

    if (!options.length) {
      removeAccessoryFromSlot(slot);
      return;
    }

    const currentIndex = options.findIndex((item) => item.id === outfit[slot]);
    const fallbackIndex = direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex + direction + options.length) % options.length;

    setOutfit((current) => ({
      ...current,
      [slot]: options[nextIndex].id
    }));
  }

  function toggleLayering() {
    setLayering((current) => {
      const nextValue = !current;

      setOutfit((previous) => transitionLayering(previous, current, nextValue));

      return nextValue;
    });
  }

  function transitionLayering(previous, currentLayering, nextLayering) {
    const nextOutfit = { ...previous };

    if (!currentLayering && nextLayering) {
      const visibleTop = itemsById[nextOutfit.TopInner];

      if (visibleTop?.layerType === "Outer") {
        nextOutfit.TopOuter = nextOutfit.TopOuter || nextOutfit.TopInner;
        nextOutfit.TopInner = null;
      }

      if (nextOutfit.TopInner && nextOutfit.TopOuter === nextOutfit.TopInner) {
        nextOutfit.TopOuter = null;
      }

      if (!nextOutfit.TopInner) {
        nextOutfit.TopInner = pickRandom(getSlotOptionsForOutfit("TopInner", nextOutfit))?.id ?? null;
      }

      if (!nextOutfit.TopOuter) {
        nextOutfit.TopOuter = pickRandom(getSlotOptionsForOutfit("TopOuter", nextOutfit))?.id ?? null;
      }

      return nextOutfit;
    }

    if (currentLayering && !nextLayering && !nextOutfit.TopInner && nextOutfit.TopOuter) {
      nextOutfit.TopInner = nextOutfit.TopOuter;
    }

    return nextOutfit;
  }

  async function applyLoadedData(nextItems, nextAppState) {
    const normalizedItems = nextItems
      .map(normalizeItem)
      .map((item) =>
        (nextAppState?.imagePresentationMigrationVersion ?? 0) < IMAGE_PRESENTATION_MIGRATION_VERSION
          ? restoreLegacyBakedImageScale(item)
          : item
      );
    const effectiveItems =
      (nextAppState?.imagePresentationMigrationVersion ?? 0) < IMAGE_PRESENTATION_MIGRATION_VERSION
        ? await Promise.all(normalizedItems.map((item) => bakeItemImagePresentation(item)))
        : normalizedItems;
    const migratedItems = effectiveItems.filter(
      (item, index) =>
        itemNeedsRetailMigration(nextItems[index], item) ||
        itemNeedsImageFrameScaleMigration(nextItems[index], item) ||
        itemNeedsImageScaleMigration(nextItems[index], item) ||
        itemNeedsImageOffsetMigration(nextItems[index], item) ||
        itemNeedsImageCropMigration(nextItems[index], item) ||
        itemNeedsFavoriteMigration(nextItems[index], item) ||
        itemNeedsQuantityMigration(nextItems[index], item) ||
        itemNeedsColorMigration(nextItems[index], item) ||
        itemNeedsWeightMigration(nextItems[index], item) ||
        itemNeedsGarmentTypeMigration(nextItems[index], item) ||
        itemNeedsTagMigration(nextItems[index], item) ||
        itemNeedsClimateTagMigration(nextItems[index], item) ||
        itemNeedsDefaultMetadataMigration(nextItems[index], item) ||
        itemNeedsMoodboardMetadataMigration(nextItems[index], item) ||
        itemNeedsImageAssetMigration(nextItems[index], item)
    );

    if (migratedItems.length) {
      await Promise.all(migratedItems.map((item) => saveItem(item)));
    }

    setItems(effectiveItems);
    setLayering(Boolean(nextAppState?.layering));
    setAccessoriesEnabled(nextAppState?.accessoriesEnabled ?? true);
    setLocked(nextAppState?.locked ?? {});
    setExcluded(nextAppState?.excluded ?? {});
    const resolvedImageCount = resolvePersistedImageCount(nextAppState?.imageCount);
    const normalizedGenerationLists = normalizeGenerationLists(nextAppState?.generationLists);
    const normalizedGenerationMode = normalizeGenerationMode(nextAppState?.generationMode);
    const normalizedMetadataFilters = normalizeMetadataFilterState(nextAppState?.generationMetadataFilters);
    const normalizedOutfitFilters = normalizeOutfitFilters(nextAppState?.outfitFilters);
    const normalizedOutfitAffinity = normalizeOutfitAffinity(nextAppState?.outfitAffinity);
    const normalizedRecentOutfits = normalizeRecentOutfits(nextAppState?.recentOutfits);
    const restoredBoard = resolveBoardFromAppState(nextAppState, effectiveItems);
    const nextBoard = shouldRegenerateLegacyBoardForImageCount(restoredBoard, resolvedImageCount)
      ? buildGeneratedBoard(effectiveItems, {
          imageCount: resolvedImageCount,
          metadataFilters: normalizedMetadataFilters,
          excluded: nextAppState?.excluded ?? {},
          generationLists: normalizedGenerationLists,
          outfitFilters: normalizedOutfitFilters,
          weatherData: nextAppState?.weatherData ?? null,
          generationMode: normalizedGenerationMode,
          outfitAffinity: normalizedOutfitAffinity,
          recentOutfits: normalizedRecentOutfits
        }).board
      : restoredBoard;
    pendingRestoredBoardFitRef.current = Boolean(nextBoard?.images?.length);
    setBoard(nextBoard);
    setImageCount(resolvedImageCount);
    setOutfit(boardToSyntheticOutfit(nextBoard));
    setBoardView(nextBoard ? getFittedBoardView(nextBoard) : { x: 0, y: 0, zoom: 1 });
    setGuidedDebugPayload([]);
    setIgnoredImportImages(nextAppState?.ignoredImportImages ?? []);
    setSavedOutfits(hydrateSavedBoards(nextAppState?.savedOutfits, effectiveItems));
    setLikedOutfitKeys(normalizeLikedOutfitKeys(nextAppState?.likedOutfitKeys));
    setOutfitAffinity(normalizedOutfitAffinity);
    setRecentOutfits(normalizedRecentOutfits);
    setGenerationLists(normalizedGenerationLists);
    setGenerationMode(normalizedGenerationMode);
    setGenerationMetadataFilters(normalizedMetadataFilters);
    setOutfitFilters(normalizedOutfitFilters);
    setWeatherSettings(normalizeWeatherSettings(nextAppState?.weatherSettings));
    setWeatherLocationDraft(nextAppState?.weatherSettings?.locationName ?? "");
    setWeatherData(nextAppState?.weatherData ?? null);
    setFitpics(nextAppState?.fitpics ?? []);
    setWardrobeFilters(emptyWardrobeFilters);
    setWardrobeSort("newest");
    setEditingId(null);
    setEditorReturnTarget(null);
    setDraft(emptyForm);
    setActivePanel(null);
    setControlsOpen(true);
    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
    setPickerAnchorSlot(null);
    setFitpicPreview(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
  }

  async function handleExportBackup() {
    try {
      const backup = buildBackupExportData(items, currentPersistedAppState);
      const blob = createBackupExportBlob(backup);
      const date = new Date().toISOString().slice(0, 10);
      const downloadStatus = await downloadBlobFile(blob, `moodboard-app-backup-${date}.json`, {
        mimeType: "application/json"
      });

      if (downloadStatus === "cancelled") {
        setBackupExportStatus("Backup export canceled.");
        return;
      }

      if (downloadStatus === "saved") {
        setBackupExportStatus("Backup saved.");
        return;
      }

      setBackupExportStatus("Backup download attempted.");
    } catch {
      const fallbackBackup = buildBackupExportData(items, currentPersistedAppState);
      const copied = await copyTextToClipboard(JSON.stringify({
        source: fallbackBackup.source,
        version: fallbackBackup.version,
        exportedAt: fallbackBackup.exportedAt,
        items: fallbackBackup.items.slice(0, 3),
        appState: fallbackBackup.appState
      }));
      setBackupExportStatus(
        copied
          ? "Backup file export failed. A reduced backup sample was copied to your clipboard."
          : "Backup export failed in this browser."
      );
    }
  }

  async function handleImportBackup(event) {
    const [file] = event.target.files;
    event.target.value = "";

    if (!file) {
      return;
    }

    let backup;

    try {
      backup = JSON.parse(await readFileAsText(file));
    } catch {
      window.alert("This backup file could not be read.");
      return;
    }

    let preparedBackup;

    try {
      preparedBackup = prepareBackupImport(backup);
    } catch {
      window.alert("This is not a valid backup file for this app.");
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Import backup?",
      message: "This will replace all library data in this browser.",
      confirmLabel: "Import"
    });

    if (!confirmed) {
      return;
    }

    await replaceWithPreparedBackup(preparedBackup);
    await applyLoadedData(preparedBackup.items, preparedBackup.appState);
    window.alert("Backup imported.");
  }

  async function handleExportOutfitImage() {
    if (!board?.images?.length) {
      return;
    }

    const exportEntries = (board?.images ?? [])
      .map((image) => {
        const item = itemsById[image.referenceId];

        return item ? { image, item } : null;
      })
      .filter(Boolean);

    if (!exportEntries.length) {
      window.alert("There is no moodboard image to export.");
      return;
    }

    const margin = 24;
    const scale = 2;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      window.alert("The moodboard image could not be exported.");
      return;
    }

    try {
      const loadedEntries = await Promise.all(
        exportEntries.map(async ({ image, item }) => ({
          image,
          item,
          asset: await loadImage(resolveImageUrl(getManagedItemImageSrc(item, "original")))
        }))
      );
      const renderedEntries = loadedEntries.map(({ image: boardImage, item, asset }) => {
        const renderMetadata = buildBoardRenderMetadata(
          {
            ...item,
            rotation: boardImage.rotation
          },
          {
            naturalWidth: Math.max(item.imageWidth || asset.naturalWidth, 1),
            naturalHeight: Math.max(item.imageHeight || asset.naturalHeight, 1)
          }
        );
        const bounds = getBoardItemRenderedBounds(boardImage, renderMetadata);

        return {
          boardImage,
          item,
          asset,
          renderMetadata,
          bounds
        };
      });
      const cropLeft = Math.max(Math.min(...renderedEntries.map(({ bounds }) => bounds.collisionRect.left)) - margin, 0);
      const cropTop = Math.max(Math.min(...renderedEntries.map(({ bounds }) => bounds.collisionRect.top)) - margin, 0);
      const cropRight = Math.min(
        Math.max(...renderedEntries.map(({ bounds }) => bounds.collisionRect.right)) + margin,
        board.width
      );
      const cropBottom = Math.min(
        Math.max(...renderedEntries.map(({ bounds }) => bounds.collisionRect.bottom)) + margin,
        board.height
      );
      const cropWidth = Math.max(cropRight - cropLeft, 1);
      const cropHeight = Math.max(cropBottom - cropTop, 1);

      canvas.width = Math.round(cropWidth * scale);
      canvas.height = Math.round(cropHeight * scale);
      context.scale(scale, scale);
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f7f7f7";
      context.fillRect(0, 0, cropWidth, cropHeight);

      renderedEntries.forEach(({ item, asset, bounds, renderMetadata }) => {
        drawManagedImageToCanvas(
          context,
          item,
          asset,
          bounds.visibleRect.left - cropLeft,
          bounds.visibleRect.top - cropTop,
          bounds.visibleRect.width,
          bounds.visibleRect.height,
          {
            useCrop: true,
            usePresentation: true,
            rotation: renderMetadata.rotation
          }
        );
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `moodboard-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.alert("The moodboard image could not be exported.");
    }
  }

  async function handleExportWardrobeImage() {
    const exportItems = visibleWardrobeItems.filter((item) => !excluded[item.id]);

    if (!exportItems.length) {
      window.alert("There are no filtered references to export.");
      return;
    }

    const shuffledItems = [...exportItems].sort(() => Math.random() - 0.5);
    const cellSize = 190;
    const columns = Math.max(1, Math.ceil(Math.sqrt(shuffledItems.length * 1.18)));
    const rows = Math.ceil(shuffledItems.length / columns);
    const padding = 44;
    const canvasWidth = columns * cellSize + padding * 2;
    const canvasHeight = rows * cellSize + padding * 2;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      window.alert("The library image could not be exported.");
      return;
    }

    canvas.width = canvasWidth * 2;
    canvas.height = canvasHeight * 2;
    context.scale(2, 2);
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f7f7f7";
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    try {
      const loadedItems = await Promise.all(
        shuffledItems.map(async (item) => ({
          item,
          image: await loadImage(resolveImageUrl(getManagedItemImageSrc(item, "original")))
        }))
      );

      loadedItems.forEach(({ item, image }, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const cellLeft = padding + column * cellSize;
        const cellTop = padding + row * cellSize;
        const maxImageSize = cellSize * 0.78;
        const sourceRect = getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight);
        const baseScale = Math.min(maxImageSize / sourceRect.width, maxImageSize / sourceRect.height, 1);
        const frameWidth = sourceRect.width * baseScale;
        const frameHeight = sourceRect.height * baseScale;
        const jitterX = (Math.random() - 0.5) * cellSize * 0.22;
        const jitterY = (Math.random() - 0.5) * cellSize * 0.22;
        const frameX = cellLeft + (cellSize - frameWidth) / 2 + jitterX;
        const frameY = cellTop + (cellSize - frameHeight) / 2 + jitterY;

        drawManagedImageToCanvas(context, item, image, frameX, frameY, frameWidth, frameHeight);
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `library-references-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.alert("The library image could not be exported.");
    }
  }

  async function handleResetToDefault() {
    const confirmed = await requestConfirmation({
      title: "Reset to default?",
      message:
        "This will replace all local library data, saved boards, reference archive images, settings, and imported backup data for this site.",
      confirmLabel: "Reset"
    });

    if (!confirmed) {
      return;
    }

    const defaultData = await resetToDefaults();
    await applyLoadedData(defaultData.items, defaultData.appState);
    window.alert("Default data restored.");
  }

  function getSlotOptionsForOutfit(slot, nextOutfit) {
    return getEligibleSlotPool(items, slot, excluded, generationLists, true, outfitFilters, weatherData, nextOutfit, itemsById)
      .filter((item) => item.id !== nextOutfit[getOtherTopSlot(slot)]);
  }

  function toggleAccessories() {
    setAccessoriesEnabled((current) => {
      const nextValue = !current;

      if (!nextValue) {
        setOutfit((previous) => {
          const nextOutfit = { ...previous };
          accessorySlots.forEach((slot) => {
            nextOutfit[slot] = null;
          });
          return nextOutfit;
        });
        setLocked((previous) => {
          const nextLocked = { ...previous };
          accessorySlots.forEach((slot) => {
            delete nextLocked[slot];
          });
          return nextLocked;
        });
        setActiveAccessorySlot(null);
      }

      return nextValue;
    });
  }

  function toggleLock(slot) {
    setLocked((current) => ({
      ...current,
      [slot]: !current[slot]
    }));
  }

  function equipItem(item) {
    if (activeBoardImageId) {
      replaceBoardImageReference(activeBoardImageId, item.id);
      return;
    }

    const generationSlot = resolveSlotForItem(item) || visibleSlots[0];

    setBoard((current) => {
      if (!current?.images?.length) {
        return createBoardFromReferenceIds([item.id], {
          aspectRatiosByReferenceId: {
            [item.id]: getItemPresentationAspectRatio(item)
          },
          sizeMultipliersByReferenceId: {
            [item.id]: getItemPresentationSizeMultiplier(item)
          },
          renderMetadataByReferenceId: {
            [item.id]: buildBoardRenderMetadata(item)
          }
        });
      }

      const nextImage = {
        id: `board_image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        referenceId: item.id,
        generationSlot,
        zIndex: current.images.length + 1
      };

      return relayoutBoardStateImages([...current.images, nextImage]);
    });
  }

  function resolveSlotForItem(item) {
    if (item.garmentType === "Headwear") {
      return "Headwear";
    }

    if (item.garmentType === "Bottom") {
      return "Bottom";
    }

    if (item.garmentType === "Footwear") {
      return "Footwear";
    }

    if (item.garmentType === "Accessory") {
      return item.accessorySlot || null;
    }

    if (item.garmentType === "Outerwear") {
      return "TopOuter";
    }

    if (item.garmentType !== "Top") {
      return null;
    }

    if (item.layerType === "Outer") {
      return "TopOuter";
    }

    return "TopInner";
  }

  function startCreate() {
    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(true);
    setReferencePreview(null);
    setSelectionEditorActive(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImporting(false);
    setItemImageDragActive(false);
    closeCropEditor();
    setEditingId(null);
    setEditorReturnTarget(null);
    setEditorAdvancedOpen(false);
  }

  function startEdit(item, options = {}) {
    const normalizedItem = normalizeItem(item);
    const shouldOpenAdvanced = getAdvancedOverrideFields(
      normalizedItem,
      resolveTypeDefaults(normalizedItem.type)
    ).length > 0;

    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setReferencePreview(null);
    setSelectionEditorActive(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImporting(false);
    setItemImageDragActive(false);
    setReplaceOriginalShouldRegenerate(false);
    const requestedReturnTarget = options.returnTarget ?? "wardrobe";
    setEditorReturnTarget(isMobileViewport ? "outfit" : requestedReturnTarget);
    setEditorAdvancedOpen(shouldOpenAdvanced);
    setEditingId(item.id);
    setDraft(normalizedItem);
  }

  function syncSelectionEditorToItem(item) {
    if (!item) {
      return;
    }

    const normalizedItem = normalizeItem(item);
    const shouldOpenAdvanced = getAdvancedOverrideFields(
      normalizedItem,
      resolveTypeDefaults(normalizedItem.type)
    ).length > 0;

    closeCropEditor();
    setReferencePreview(null);
    setEditorReturnTarget(isMobileViewport ? "outfit" : "wardrobe");
    setEditorAdvancedOpen(shouldOpenAdvanced);
    setEditingId(item.id);
    setDraft(normalizedItem);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImporting(false);
    setItemImageDragActive(false);
    setReplaceOriginalShouldRegenerate(false);
  }

  function resetEditorState() {
    closeCropEditor();
    setEditingId(null);
    setEditorReturnTarget(null);
    setEditorAdvancedOpen(false);
    setDraft(emptyForm);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImporting(false);
    setItemImageDragActive(false);
    setReplaceOriginalShouldRegenerate(false);
  }

  function cancelEdit() {
    if (selectionEditorActive) {
      setSelectionEditorActive(false);
      setSelectedReferenceIds({});
    }

    resetEditorState();
  }

  function startFloatingEdit(item) {
    startEdit(item, { returnTarget: "outfit" });
    closePickerOverlay();
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
  }

  function excludeReferenceIds(referenceIds) {
    const uniqueReferenceIds = [...new Set((referenceIds ?? []).filter(Boolean))];

    if (!uniqueReferenceIds.length) {
      return;
    }

    setExcluded((current) => {
      const nextExcluded = { ...current };
      let changed = false;

      uniqueReferenceIds.forEach((itemId) => {
        if (!nextExcluded[itemId]) {
          nextExcluded[itemId] = true;
          changed = true;
        }
      });

      if (!changed) {
        return current;
      }

      setOutfit((previous) => {
        const sanitized = Object.fromEntries(
          Object.entries(previous).map(([slot, equippedId]) => [
            slot,
            uniqueReferenceIds.includes(equippedId) ? null : equippedId
          ])
        );

        return buildNextOutfit(
          items,
          sanitized,
          locked,
          layering,
          nextExcluded,
          generationLists,
          outfitFilters,
          weatherData,
          generationMode,
          outfitAffinity,
          recentOutfits
        );
      });

      return nextExcluded;
    });
  }

  function toggleExcluded(itemId) {
    if (excluded[itemId]) {
      setExcluded((current) => ({
        ...current,
        [itemId]: false
      }));
    } else {
      excludeReferenceIds([itemId]);
    }
  }

  function clearExcluded() {
    setExcluded({});
  }

  function syncSelectionEditor(nextSelected) {
    const nextSelectedIds = Object.entries(nextSelected)
      .filter(([, isSelected]) => isSelected)
      .map(([id]) => id);

    if (!nextSelectedIds.length) {
      setSelectionEditorActive(false);
      resetEditorState();
      return;
    }

    if (!selectionEditorActive) {
      return;
    }

    if (nextSelectedIds.length === 1) {
      syncSelectionEditorToItem(itemsById[nextSelectedIds[0]]);
      return;
    }

    closeCropEditor();
    setReferencePreview(null);
    setEditingId(null);
    setEditorReturnTarget(isMobileViewport ? "outfit" : "wardrobe");
    setEditorAdvancedOpen(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImporting(false);
    setItemImageDragActive(false);
  }

  function openSelectionEditor() {
    if (!selectedReferenceCount) {
      return;
    }

    setLibraryTagActionMode(null);
    setSelectionEditorActive(true);

    if (selectedReferenceCount === 1) {
      syncSelectionEditorToItem(selectedReferenceItems[0]);
      return;
    }

    closeCropEditor();
    setReferencePreview(null);
    setEditingId(null);
    setEditorReturnTarget(isMobileViewport ? "outfit" : "wardrobe");
    setEditorAdvancedOpen(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImporting(false);
    setItemImageDragActive(false);
  }

  function selectReference(itemId, event = null) {
    const isToggleSelection = Boolean(event?.metaKey || event?.ctrlKey);
    const isRangeSelection = Boolean(event?.shiftKey);

    setSelectedReferenceIds((current) => {
      const { nextSelection } = getNextLibrarySelection({
        currentSelection: current,
        itemId,
        visibleItemIds: visibleWardrobeItemIds,
        anchorId: selectedReferenceAnchorId,
        isToggleSelection,
        isRangeSelection
      });

      syncSelectionEditor(nextSelection);
      return nextSelection;
    });

    setSelectedReferenceAnchorId(itemId);
  }

  function clearSelectedReferences() {
    setLibraryTagActionMode(null);
    setSelectionEditorActive(false);
    setSelectedReferenceIds({});
    setSelectedReferenceAnchorId(null);
    resetEditorState();
  }

  function selectAllVisibleReferences() {
    if (!visibleWardrobeItemIds.length) {
      return;
    }

    const nextSelected = Object.fromEntries(visibleWardrobeItemIds.map((itemId) => [itemId, true]));
    setLibraryTagActionMode(null);
    setSelectedReferenceIds(nextSelected);
    setSelectedReferenceAnchorId(visibleWardrobeItemIds[0] ?? null);
    syncSelectionEditor(nextSelected);
  }

  function excludeSelectedReferences() {
    setLibraryTagActionMode(null);
    excludeReferenceIds(selectedReferenceIdList);
    setSelectionEditorActive(false);
    setSelectedReferenceIds({});
    setSelectedReferenceAnchorId(null);
    resetEditorState();
  }

  async function deleteSelectedReferences() {
    const deleted = await deleteReferenceIds(selectedReferenceIdList, {
      title: "Delete selected references?",
      message: "These references will be removed from the library, moodboards, and saved boards in this browser.",
      confirmLabel: "Delete"
    });

    if (deleted) {
      setLibraryTagActionMode(null);
      setSelectionEditorActive(false);
      setSelectedReferenceIds({});
      resetEditorState();
    }
  }

  async function applyBulkMetadataUpdate(buildNextItem) {
    if (!selectedReferenceIdList.length) {
      return;
    }

    const selectedReferenceIdSet = new Set(selectedReferenceIdList);
    const updatedItems = items
      .filter((item) => selectedReferenceIdSet.has(item.id))
      .map((item) => {
        const nextItem = normalizeItem(buildNextItem(item));
        return JSON.stringify(nextItem) === JSON.stringify(item) ? null : nextItem;
      })
      .filter(Boolean);

    if (!updatedItems.length) {
      return;
    }

    await Promise.all(updatedItems.map((item) => saveItem(item)));

    const updatedItemsById = Object.fromEntries(updatedItems.map((item) => [item.id, item]));
    setItems((current) => current.map((item) => updatedItemsById[item.id] ?? item));
  }

  async function applyGlobalTagUpdate(buildNextTags) {
    const updatedItems = items
      .map((item) => {
        const currentTags = uniqueTags(item.tags);
        const nextTags = uniqueTags(buildNextTags(currentTags, item));
        const nextItem = normalizeItem({
          ...item,
          tags: nextTags
        });

        return JSON.stringify(nextItem) === JSON.stringify(item) ? null : nextItem;
      })
      .filter(Boolean);

    if (!updatedItems.length) {
      return 0;
    }

    await Promise.all(updatedItems.map((item) => saveItem(item)));

    const updatedItemsById = Object.fromEntries(updatedItems.map((item) => [item.id, item]));
    setItems((current) => current.map((item) => updatedItemsById[item.id] ?? item));
    return updatedItems.length;
  }

  function showTemporaryBulkMetadataFeedback(message) {
    if (bulkMetadataFeedbackTimeoutRef.current) {
      clearTimeout(bulkMetadataFeedbackTimeoutRef.current);
    }

    setBulkMetadataFeedback(message);
    bulkMetadataFeedbackTimeoutRef.current = setTimeout(() => {
      setBulkMetadataFeedback("");
      bulkMetadataFeedbackTimeoutRef.current = null;
    }, 2400);
  }

  function showTemporaryTagManagerFeedback(message) {
    if (bulkMetadataFeedbackTimeoutRef.current) {
      clearTimeout(bulkMetadataFeedbackTimeoutRef.current);
    }

    setTagManagerFeedback(message);
    bulkMetadataFeedbackTimeoutRef.current = setTimeout(() => {
      setTagManagerFeedback("");
      bulkMetadataFeedbackTimeoutRef.current = null;
    }, 2400);
  }

  function updateTagManagerDraft(tag, key, value) {
    setTagManagerDrafts((current) => ({
      ...current,
      [tag]: {
        ...current[tag],
        [key]: value
      }
    }));
  }

  function clearTagManagerDraft(tag, key) {
    setTagManagerDrafts((current) => {
      const nextTagDraft = {
        ...(current[tag] ?? {})
      };

      delete nextTagDraft[key];

      if (!Object.keys(nextTagDraft).length) {
        const nextDrafts = { ...current };
        delete nextDrafts[tag];
        return nextDrafts;
      }

      return {
        ...current,
        [tag]: nextTagDraft
      };
    });
  }

  async function handleRenameTagEverywhere(sourceTag) {
    const targetTag = normalizeTag(tagManagerDrafts[sourceTag]?.rename ?? "");

    if (!targetTag || targetTag === sourceTag) {
      showTemporaryTagManagerFeedback("No changes applied");
      return;
    }

    const affectedReferences = items.filter((item) =>
      uniqueTags(item.tags).some((tag) => tag === sourceTag || tag.startsWith(`${sourceTag}/`))
    ).length;

    if (affectedReferences > 10) {
      const confirmed = await requestConfirmation({
        title: "Rename nested tag everywhere?",
        message: `Rename '${sourceTag}' to '${targetTag}' across ${affectedReferences} references, including nested tags?`,
        confirmLabel: "Rename tag"
      });

      if (!confirmed) {
        return;
      }
    }

    const changedCount = await applyGlobalTagUpdate((currentTags) =>
      currentTags.map((tag) => renameNestedTagPath(tag, sourceTag, targetTag))
    );

    if (!changedCount) {
      showTemporaryTagManagerFeedback("No changes applied");
      return;
    }

    clearTagManagerDraft(sourceTag, "rename");
    showTemporaryTagManagerFeedback(
      `Renamed tag on ${changedCount} ${changedCount === 1 ? "reference" : "references"}`
    );
  }

  async function handleMergeTagEverywhere(sourceTag) {
    const targetTag = normalizeTag(tagManagerDrafts[sourceTag]?.merge ?? "");

    if (!targetTag || targetTag === sourceTag) {
      showTemporaryTagManagerFeedback("No changes applied");
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Merge tag everywhere?",
      message: `Replace '${sourceTag}' with '${targetTag}' on every reference that uses it?`,
      confirmLabel: "Merge tag"
    });

    if (!confirmed) {
      return;
    }

    const changedCount = await applyGlobalTagUpdate((currentTags) =>
      currentTags.includes(sourceTag)
        ? currentTags.map((tag) => (tag === sourceTag ? targetTag : tag))
        : currentTags
    );

    if (!changedCount) {
      showTemporaryTagManagerFeedback("No changes applied");
      return;
    }

    clearTagManagerDraft(sourceTag, "merge");
    showTemporaryTagManagerFeedback(
      `Merged tag into ${changedCount} ${changedCount === 1 ? "reference" : "references"}`
    );
  }

  async function handleDeleteTagEverywhere(sourceTag) {
    const confirmed = await requestConfirmation({
      title: "Delete tag everywhere?",
      message: `Remove '${sourceTag}' from every reference that uses it?`,
      confirmLabel: "Delete tag"
    });

    if (!confirmed) {
      return;
    }

    const changedCount = await applyGlobalTagUpdate((currentTags) =>
      currentTags.includes(sourceTag)
        ? currentTags.filter((tag) => tag !== sourceTag)
        : currentTags
    );

    if (!changedCount) {
      showTemporaryTagManagerFeedback("No changes applied");
      return;
    }

    clearTagManagerDraft(sourceTag, "rename");
    clearTagManagerDraft(sourceTag, "merge");
    showTemporaryTagManagerFeedback(
      `Deleted tag from ${changedCount} ${changedCount === 1 ? "reference" : "references"}`
    );
  }

  async function applyImmediateBulkTagEdit(mode, tag) {
    const normalizedTag = normalizeTag(tag);

    if (!normalizedTag || !selectedReferenceIdList.length) {
      return;
    }

    const changedCount = selectedReferenceItems.reduce((count, item) => {
      const currentTags = uniqueTags(item.tags);
      const willChange = mode === "add"
        ? !currentTags.includes(normalizedTag)
        : currentTags.includes(normalizedTag);
      return count + (willChange ? 1 : 0);
    }, 0);

    if (!changedCount) {
      showTemporaryBulkMetadataFeedback("No changes applied");
      return;
    }

    await applyBulkMetadataUpdate((item) => {
      const currentTags = uniqueTags(item.tags);
      const nextTags = mode === "add"
        ? uniqueTags([...currentTags, normalizedTag])
        : currentTags.filter((currentTag) => currentTag !== normalizedTag);

      return {
        ...item,
        tags: nextTags
      };
    });

    showTemporaryBulkMetadataFeedback(
      `${mode === "add" ? "Added" : "Removed"} '${normalizedTag}' ${mode === "add" ? "to" : "from"} ${changedCount} ${changedCount === 1 ? "item" : "items"}`
    );
  }

  async function applyImmediateBulkFavoriteEdit(nextValue) {
    if (!selectedReferenceIdList.length || !nextValue) {
      return;
    }

    const nextFavorite = nextValue === "yes";
    const changedCount = selectedReferenceItems.reduce(
      (count, item) => count + (Boolean(item.favorite) !== nextFavorite ? 1 : 0),
      0
    );

    if (!changedCount) {
      showTemporaryBulkMetadataFeedback("No changes applied");
      return;
    }

    await applyBulkMetadataUpdate((item) => ({
      ...item,
      favorite: nextFavorite
    }));

    showTemporaryBulkMetadataFeedback(
      `${nextFavorite ? "Favorited" : "Unfavorited"} ${changedCount} ${changedCount === 1 ? "item" : "items"}`
    );
  }

  async function handleImmediateBulkTagDraftChange(mode, nextTags) {
    const draftKey = mode === "add" ? "addTags" : "removeTags";
    const currentTags = bulkMetadataDraft[draftKey];
    const committedTags = nextTags.filter((tag) => !currentTags.includes(tag));

    setBulkMetadataDraft((current) => ({
      ...current,
      [draftKey]: nextTags
    }));

    if (!committedTags.length) {
      return;
    }

    await applyImmediateBulkTagEdit(mode, committedTags[0]);
    setBulkMetadataDraft((current) => ({
      ...current,
      [draftKey]: []
    }));
  }

  function clearWardrobeFilters() {
    setWardrobeFilters(emptyWardrobeFilters);
  }

  function clearLibrarySearch() {
    setLibrarySearch("");
  }

  function toggleOutfitFilter(group, value) {
    setOutfitFilters((current) => {
      const selectedValues = current[group] ?? [];
      const isSelected = selectedValues.includes(value);

      return {
        ...current,
        [group]: isSelected
          ? selectedValues.filter((selectedValue) => selectedValue !== value)
          : [...selectedValues, value]
      };
    });
  }

  function clearOutfitFilters() {
    setOutfitFilters(emptyOutfitFilters);
  }

  function toggleLibraryTagFilter(tag, mode = "include") {
    setWardrobeFilters((current) => {
      const targetKey = mode === "exclude" ? "excludedTags" : "tags";
      const opposingKey = mode === "exclude" ? "tags" : "excludedTags";
      const nextSelection = toggleTagFilterSelection(current[targetKey], current[opposingKey], tag);

      return {
        ...current,
        [targetKey]: nextSelection.current,
        [opposingKey]: nextSelection.opposing
      };
    });
  }

  function toggleLibraryTagGroup(tags, mode = "include") {
    const normalizedTags = uniqueTags(tags).filter((tag) => tag !== NO_TAGS_FILTER);

    if (!normalizedTags.length) {
      return;
    }

    setWardrobeFilters((current) => {
      const targetKey = mode === "exclude" ? "excludedTags" : "tags";
      const opposingKey = mode === "exclude" ? "tags" : "excludedTags";
      const currentTargetTags = uniqueTags(current[targetKey]);
      const allSelected = normalizedTags.every((tag) => currentTargetTags.includes(tag));
      const nextTargetTags = allSelected
        ? currentTargetTags.filter((tag) => !normalizedTags.includes(tag))
        : uniqueTags([...currentTargetTags, ...normalizedTags]);

      return {
        ...current,
        [targetKey]: nextTargetTags,
        [opposingKey]: uniqueTags(current[opposingKey]).filter((tag) => !normalizedTags.includes(tag))
      };
    });
  }

  function toggleGenerationMetadataTagFilter(tag, mode = "include") {
    setGenerationMetadataFilters((current) => {
      const targetKey = mode === "exclude" ? "excludedTags" : "tags";
      const opposingKey = mode === "exclude" ? "tags" : "excludedTags";
      const nextSelection = toggleTagFilterSelection(current[targetKey], current[opposingKey], tag);

      return {
        ...current,
        [targetKey]: nextSelection.current,
        [opposingKey]: nextSelection.opposing
      };
    });
  }

  function toggleGenerationMetadataTagGroup(tags, mode = "include") {
    const normalizedTags = uniqueTags(tags).filter((tag) => tag !== NO_TAGS_FILTER);

    if (!normalizedTags.length) {
      return;
    }

    setGenerationMetadataFilters((current) => {
      const targetKey = mode === "exclude" ? "excludedTags" : "tags";
      const opposingKey = mode === "exclude" ? "tags" : "excludedTags";
      const currentTargetTags = uniqueTags(current[targetKey]);
      const allSelected = normalizedTags.every((tag) => currentTargetTags.includes(tag));
      const nextTargetTags = allSelected
        ? currentTargetTags.filter((tag) => !normalizedTags.includes(tag))
        : uniqueTags([...currentTargetTags, ...normalizedTags]);

      return {
        ...current,
        [targetKey]: nextTargetTags,
        [opposingKey]: uniqueTags(current[opposingKey]).filter((tag) => !normalizedTags.includes(tag))
      };
    });
  }

  function clearGenerationMetadataFilters() {
    setGenerationMetadataFilters(emptyGenerationMetadataFilters);
  }

  async function refreshWeather(locationOverride = weatherLocationDraft) {
    const query = locationOverride.trim();

    if (!query) {
      setWeatherError("Enter a city first.");
      return;
    }

    try {
      setWeatherLoading(true);
      setWeatherError("");
      const currentWeatherSettings = normalizeWeatherSettings(weatherSettings);
      const shouldUseSavedLocation =
        currentWeatherSettings.locationName &&
        query === currentWeatherSettings.locationName &&
        Number.isFinite(currentWeatherSettings.latitude) &&
        Number.isFinite(currentWeatherSettings.longitude);
      const nextWeather = shouldUseSavedLocation
        ? await fetchWeatherForSavedLocation(currentWeatherSettings)
        : await fetchWeatherForLocation(query);
      setWeatherSettings(nextWeather.settings);
      setWeatherLocationDraft(nextWeather.settings.locationName);
      setWeatherData(nextWeather.weather);
    } catch (error) {
      setWeatherError(error?.message || "Weather could not be loaded.");
    } finally {
      setWeatherLoading(false);
    }
  }

  function applyWeatherFilters() {
    if (!weatherData?.suggestedFilters?.length) {
      return;
    }

    closeUtilityWindows();
    setOutfitFilters((current) => ({
      ...current,
      climate: weatherData.suggestedFilters
    }));
    setControlsOpen(true);
  }

  function toggleGenerationList(list) {
    setGenerationLists((current) => ({
      ...current,
      [list]: !current[list]
    }));
  }

  function setAdvancedField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function resetAdvancedField(field) {
    const nextValue = Array.isArray(resolvedTypeDefaults[field])
      ? [...resolvedTypeDefaults[field]]
      : resolvedTypeDefaults[field];

    setDraft((current) => {
      const nextDraft = {
        ...current,
        [field]: nextValue
      };

      if (["garmentType", "layerType", "accessorySlot", "size"].includes(field)) {
        return applyGarmentRules(nextDraft, resolvedTypeDefaults);
      }

      return nextDraft;
    });
  }

  function renderAdvancedLabel(label, field) {
    return (
      <span className="editor-label-row">
        <span>{label}</span>
        {advancedOverrideSet.has(field) ? (
          <span className="editor-label-actions">
            <span className="field-status-badge">Custom</span>
            <button
              type="button"
              className="ghost-button editor-inline-reset"
              onClick={() => resetAdvancedField(field)}
            >
              Reset
            </button>
          </span>
        ) : null}
      </span>
    );
  }

  async function submitItem(event) {
    event.preventDefault();
    await persistDraftItem();
  }

  async function persistDraftItem({ duplicate = false } = {}) {
    const trimmedName = draft.name.trim();
    const uniqueName = createUniqueItemName(trimmedName, items, duplicate || editingId === "new" ? null : draft.id);
    const trimmedDescription = draft.description.trim();
    const trimmedImageUrl = draft.imageUrl.trim();
    const trimmedBrand = draft.brand.trim();
    const trimmedType = draft.type.trim();
    const normalizedTags = uniqueTags(draft.tags);
    const normalizedCreatedAt = normalizeCreatedAt(draft.createdAt) || Date.now();
    const normalizedImportedAt = normalizeCreatedAt(draft.importedAt) || normalizedCreatedAt;
    const normalizedUpdatedAt = new Date().toISOString();
    const trimmedColor = normalizeItemColor(draft.color);
    const trimmedSize = draft.size.trim();
    const normalizedWeight = normalizeWeight(draft.weight);
    const normalizedValue = String(draft.value ?? "").replace(/[^\d]/g, "");
    const normalizedRetailValue = String(draft.retailValue ?? "").replace(/[^\d]/g, "");
    const normalizedImageFrameScale = normalizeImageFrameScale(draft.imageFrameScale);
    const normalizedImageScale = normalizeImageScale(draft.imageScale);
    const normalizedImageOffsetX = normalizeImageOffset(draft.imageOffsetX);
    const normalizedImageOffsetY = normalizeImageOffset(draft.imageOffsetY);
    const normalizedImageCrop = getNormalizedImageCrop(draft);
    const normalizedQuantity = normalizeQuantity(draft.quantity);

    if (!trimmedImageUrl) {
      setEditorAdvancedOpen(true);
      setImageUploadError("Choose an image or enter an image URL before saving this reference.");
      return;
    }

    setImageUploadError("");

    if (
      !duplicate &&
      editingId === "new" &&
      !trimmedName &&
      !trimmedBrand &&
      !trimmedType &&
      !normalizedTags.length &&
      !trimmedColor &&
      !normalizedValue &&
      !normalizedRetailValue
    ) {
      return;
    }

    const normalizedDraft = await bakeItemImagePresentation({
      ...draft,
      name: uniqueName,
      description: trimmedDescription,
      imageUrl: trimmedImageUrl,
      imageFrameScale: normalizedImageFrameScale,
      imageScale: normalizedImageScale,
      imageOffsetX: normalizedImageOffsetX,
      imageOffsetY: normalizedImageOffsetY,
      imageCropX: normalizedImageCrop.x,
      imageCropY: normalizedImageCrop.y,
      imageCropWidth: normalizedImageCrop.width,
      imageCropHeight: normalizedImageCrop.height,
      brand: trimmedBrand,
      type: normalizeItemType(trimmedType),
      tags: normalizedTags,
      createdAt: normalizedCreatedAt,
      importedAt: normalizedImportedAt,
      updatedAt: normalizedUpdatedAt,
      color: trimmedColor,
      weight: normalizedWeight,
      favorite: Boolean(draft.favorite),
      value: normalizedValue,
      retailValue: normalizedRetailValue,
      size: trimmedSize,
      list: normalizeList(draft.list),
      quantity: normalizedQuantity,
      styleTags: normalizeTagList(draft.styleTags, styleTagOptions),
      climateTags: normalizeTagList(draft.climateTags, editableClimateTagOptions)
    });

    const nextItem = {
      ...normalizedDraft,
      id:
        duplicate || editingId === "new"
          ? createUniqueItemId(
              {
                ...normalizedDraft
              },
              items
            )
          : createUniqueItemId(
              {
                ...normalizedDraft
              },
              items,
              draft.id
            ),
      name: uniqueName,
      description: trimmedDescription
    };
    await saveItem(nextItem);

    if (!duplicate && editingId !== "new" && draft.id !== nextItem.id) {
      await deleteItem(draft.id);
    }

    setItems((current) => {
      const existingIndex = current.findIndex((item) =>
        item.id === (duplicate || editingId === "new" ? nextItem.id : draft.id)
      );

      if (existingIndex === -1) {
        return [...current, nextItem];
      }

      const clone = [...current];
      clone[existingIndex] = nextItem;
      return clone;
    });

    if (!duplicate && editingId !== "new" && draft.id !== nextItem.id) {
      setOutfit((current) =>
        replaceItemIdInOutfit(current, draft.id, nextItem.id)
      );
      setBoard((current) => current ? {
        ...current,
        images: current.images.map((image) =>
          image.referenceId === draft.id
            ? { ...image, referenceId: nextItem.id }
            : image
        )
      } : current);
      setSavedOutfits((current) =>
        current.map((savedOutfit) => ({
          ...savedOutfit,
          outfit: replaceItemIdInOutfit(savedOutfit.outfit, draft.id, nextItem.id),
          board: savedOutfit.board
            ? {
                ...savedOutfit.board,
                images: savedOutfit.board.images.map((image) =>
                  image.referenceId === draft.id
                    ? { ...image, referenceId: nextItem.id }
                    : image
                )
              }
            : savedOutfit.board
        }))
      );
    }

    if (duplicate) {
      setEditingId(nextItem.id);
      setDraft(nextItem);
      return nextItem;
    }

    const shouldReturnToWardrobe = editorReturnTarget === "wardrobe" && activePanel !== "wardrobe";
    cancelEdit();

    if (shouldReturnToWardrobe) {
      setActivePanel("wardrobe");
      setControlsOpen(false);
    }

    return nextItem;
  }

  async function duplicateDraftItem() {
    if (editingId === "new") {
      return;
    }

    await persistDraftItem({ duplicate: true });
  }

  async function buildImageSetFromSourceFile(file) {
    const [original, preview, thumbnail] = await Promise.all([
      createOriginalImageAsset(file),
      createPreviewImageAsset(file),
      createThumbnailImageAsset(file)
    ]);

    return {
      original,
      preview,
      thumbnail
    };
  }

  async function importItemImageFiles(files) {
    const selectedFiles = Array.from(files ?? []);

    if (!selectedFiles.length) {
      return;
    }

    try {
      setItemImporting(true);
      setImageUploadError("");
      const result = await importReferenceFiles(selectedFiles, items, {
        bakeItemImagePresentation,
        createOriginalImageAsset,
        createPreviewImageAsset,
        createThumbnailImageAsset,
        createUniqueItemId,
        saveItem
      });

      result.failedFiles.forEach(({ file, error }) => {
        console.error(`Reference import failed for ${file?.name || "unknown file"}.`, error);
      });

    if (result.successfulItems.length) {
      setItems((current) => [...current, ...result.successfulItems]);
    }

      setImageUploadError(getReferenceImportMessage(result));
    } finally {
      setItemImporting(false);
    }
  }

  async function ingestItemImageFile(file, options = {}) {
    if (!file) {
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setImageUploadError("Selected file is not an image.");
      return;
    }

    try {
      setImageUploadError("");
      const nextImageSet = await buildImageSetFromSourceFile(file);
      setDraft((current) => replaceItemImageSet({
        ...current,
        imageFrameScale: 100,
        imageScale: 100,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageCropX: 0,
        imageCropY: 0,
        imageCropWidth: 100,
        imageCropHeight: 100
      }, nextImageSet));
      if (options.ignoredExtraFiles) {
        setImageUploadError("Using the first image only. Additional files were ignored.");
      }
    } catch (error) {
      setImageUploadError(error?.message || "This image could not be processed.");
    }
  }

  async function handleItemImageUpload(event) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (!selectedFiles.length) {
      return;
    }

    try {
      if (wardrobeAddOpen) {
        await importItemImageFiles(selectedFiles);
      } else {
        await ingestItemImageFile(selectedFiles[0], {
          ignoredExtraFiles: selectedFiles.length > 1
        });
      }
    } finally {
      event.target.value = "";
    }
  }

  async function replaceDraftOriginalImageFile(file, options = {}) {
    if (!file) {
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setImageUploadError("Selected file is not an image.");
      return;
    }

    try {
      setImageUploadError("");
      const originalAsset = await createOriginalImageAsset(file);
      const replacementOptions = {
        regenerateOptimizedAssets: Boolean(options.regenerateOptimizedAssets)
      };

      if (replacementOptions.regenerateOptimizedAssets) {
        const { preview, thumbnail } = await buildImageSetFromSourceFile(file);
        replacementOptions.previewAsset = preview;
        replacementOptions.thumbnailAsset = thumbnail;
      }

      setDraft((current) => replaceItemOriginalImage(current, originalAsset, replacementOptions));
      if (options.ignoredExtraFiles) {
        setImageUploadError("Using the first image only. Additional files were ignored.");
      }
    } catch (error) {
      setImageUploadError(error?.message || "This image could not be processed.");
    }
  }

  async function handleReplaceOriginalImageUpload(event) {
    const selectedFiles = Array.from(event.target.files ?? []);

    try {
      if (selectedFiles.length) {
        await replaceDraftOriginalImageFile(selectedFiles[0], {
          regenerateOptimizedAssets: replaceOriginalShouldRegenerate,
          ignoredExtraFiles: selectedFiles.length > 1
        });
      }
    } finally {
      event.target.value = "";
    }
  }

  function handleItemImageDragEnter(event) {
    event.preventDefault();
    if (imageProcessing || itemImporting) {
      return;
    }
    setItemImageDragActive(true);
  }

  function handleItemImageDragOver(event) {
    event.preventDefault();
    if (imageProcessing || itemImporting) {
      return;
    }
    setItemImageDragActive(true);
  }

  function handleItemImageDragLeave(event) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setItemImageDragActive(false);
  }

  async function handleItemImageDrop(event) {
    event.preventDefault();
    setItemImageDragActive(false);

    if (imageProcessing || itemImporting) {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer?.files ?? []);

    if (!droppedFiles.length) {
      return;
    }

    if (wardrobeAddOpen) {
      await importItemImageFiles(droppedFiles);
      return;
    }

    const firstImageFile = droppedFiles.find((file) => file.type?.startsWith("image/"));

    if (!firstImageFile) {
      setImageUploadError("Selected file is not an image.");
      return;
    }

    await ingestItemImageFile(firstImageFile, {
      ignoredExtraFiles: droppedFiles.length > 1
    });
  }

  function removeDraftImage() {
    closeCropEditor();
    setDraft((current) => ({
      ...current,
      imageUrl: "",
      images: emptyForm.images,
      originalPreserved: false,
      imageFrameScale: 100,
      imageScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageCropX: 0,
      imageCropY: 0,
      imageCropWidth: 100,
      imageCropHeight: 100
    }));
    setImageUploadError("");
  }

  function openCropEditor() {
    if (!draft.imageUrl.trim()) {
      return;
    }

    setCropEditorState(normalizeCropRect(getNormalizedImageCrop(draft)));
  }

  function closeCropEditor() {
    cropInteractionRef.current = null;
    setCropEditorState(null);
  }

  function updateExistingDraftItem(nextDraft, { closeEditor = false } = {}) {
    if (!nextDraft?.id || editingId === "new") {
      setDraft(nextDraft);
      if (closeEditor) {
        cancelEdit();
      }
      return nextDraft;
    }

    const persistedDraft = normalizeItem({
      ...nextDraft,
      updatedAt: new Date().toISOString()
    });

    setDraft(persistedDraft);
    setItems((current) => current.map((item) => item.id === persistedDraft.id ? persistedDraft : item));
    setReferencePreview((current) => current?.id === persistedDraft.id ? persistedDraft : current);
    void saveItem(persistedDraft);

    if (closeEditor) {
      cancelEdit();
    }

    return persistedDraft;
  }

  function applyCropEditor() {
    if (!cropEditorState) {
      return;
    }

    const nextCrop = {
      imageCropX: normalizeImageCropStart(cropEditorState.x, normalizeImageCropSize(cropEditorState.width)),
      imageCropY: normalizeImageCropStart(cropEditorState.y, normalizeImageCropSize(cropEditorState.height)),
      imageCropWidth: normalizeImageCropSize(cropEditorState.width),
      imageCropHeight: normalizeImageCropSize(cropEditorState.height)
    };

    const nextDraft = normalizeItem({
      ...draft,
      ...nextCrop
    });
    const shouldCloseEditor = editorReturnTarget === "outfit" && editingId !== "new";

    closeCropEditor();

    if (!draft.id || editingId === "new") {
      setDraft(nextDraft);
      return;
    }

    updateExistingDraftItem(nextDraft, { closeEditor: shouldCloseEditor });
  }

  function resetCropEditor() {
    setCropEditorState({ x: 0, y: 0, width: 100, height: 100 });
  }

  function startCropEdgeDrag(edge, event) {
    if (!cropEditorState || !cropEditorFrameRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const frameRect = cropEditorFrameRef.current.getBoundingClientRect();
    const startingCrop = normalizeCropRect(cropEditorState);
    cropInteractionRef.current = {
      edge,
      startClientX: event.clientX,
      startClientY: event.clientY,
      frameWidth: Math.max(frameRect.width, 1),
      frameHeight: Math.max(frameRect.height, 1),
      crop: startingCrop
    };

    function handlePointerMove(moveEvent) {
      const currentInteraction = cropInteractionRef.current;
      if (!currentInteraction) {
        return;
      }

      const deltaXPct = ((moveEvent.clientX - currentInteraction.startClientX) / currentInteraction.frameWidth) * 100;
      const deltaYPct = ((moveEvent.clientY - currentInteraction.startClientY) / currentInteraction.frameHeight) * 100;
      const nextCrop = { ...currentInteraction.crop };

      if (currentInteraction.edge === "left") {
        const nextX = Math.min(
          currentInteraction.crop.x + currentInteraction.crop.width - MIN_CROP_SIZE,
          Math.max(0, currentInteraction.crop.x + deltaXPct)
        );
        nextCrop.x = nextX;
        nextCrop.width = currentInteraction.crop.width - (nextX - currentInteraction.crop.x);
      }

      if (currentInteraction.edge === "right") {
        nextCrop.width = Math.min(
          100 - currentInteraction.crop.x,
          Math.max(MIN_CROP_SIZE, currentInteraction.crop.width + deltaXPct)
        );
      }

      if (currentInteraction.edge === "top") {
        const nextY = Math.min(
          currentInteraction.crop.y + currentInteraction.crop.height - MIN_CROP_SIZE,
          Math.max(0, currentInteraction.crop.y + deltaYPct)
        );
        nextCrop.y = nextY;
        nextCrop.height = currentInteraction.crop.height - (nextY - currentInteraction.crop.y);
      }

      if (currentInteraction.edge === "bottom") {
        nextCrop.height = Math.min(
          100 - currentInteraction.crop.y,
          Math.max(MIN_CROP_SIZE, currentInteraction.crop.height + deltaYPct)
        );
      }

      setCropEditorState(normalizeCropRect(nextCrop));
    }

    function handlePointerUp() {
      cropInteractionRef.current = null;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }

  function resetDraftImageCrop() {
    setDraft((current) => ({
      ...current,
      imageFrameScale: 100,
      imageScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageCropX: 0,
      imageCropY: 0,
      imageCropWidth: 100,
      imageCropHeight: 100
    }));
  }

  async function removeDraftBackground() {
    const originalImageUrl = draft.imageUrl.trim();

    if (!isLocalDataImage(originalImageUrl) || imageProcessing) {
      return;
    }

    try {
      setImageProcessing(true);
      setImageUploadError("");
      const inputBlob = await dataUrlToBlob(originalImageUrl);
      const backgroundRemovalModule = await import("@imgly/background-removal");
      const removeBackground = getRemoveBackgroundExport(backgroundRemovalModule);
      const transparentBlob = await removeBackground(inputBlob, {
        model: "small",
        output: {
          format: "image/png",
          quality: 0.9
        }
      });
      const [previewAsset, thumbnailAsset] = await Promise.all([
        createPreviewImageAsset(transparentBlob),
        createThumbnailImageAsset(transparentBlob)
      ]);
      setDraft((current) => {
        const currentImages = normalizeItemImages(current);
        const nextPreviewAsset = {
          ...previewAsset,
          originalFilename: current.originalFilename
        };
        const nextThumbnailAsset = {
          ...thumbnailAsset,
          originalFilename: current.originalFilename
        };
        const nextDraft = applyPreviewImageFields(
          {
            ...current,
            images: {
              original: currentImages.original,
              preview: nextPreviewAsset,
              thumbnail: nextThumbnailAsset
            },
            imageFrameScale: 100,
            imageScale: 100,
            imageOffsetX: 0,
            imageOffsetY: 0,
            imageCropX: 0,
            imageCropY: 0,
            imageCropWidth: 100,
            imageCropHeight: 100
          },
          nextPreviewAsset
        );

        return {
          ...nextDraft,
          images: {
            original: currentImages.original,
            preview: nextPreviewAsset,
            thumbnail: nextThumbnailAsset
          }
        };
      });
    } catch (error) {
      setImageUploadError(error?.message || "Background could not be removed.");
    } finally {
      setImageProcessing(false);
    }
  }

  async function deleteReferenceIds(referenceIds, confirmationCopy = {}) {
    const uniqueReferenceIds = [...new Set((referenceIds ?? []).filter(Boolean))];

    if (!uniqueReferenceIds.length) {
      return false;
    }

    const confirmed = await requestConfirmation({
      title: confirmationCopy.title ?? "Delete reference?",
      message: confirmationCopy.message ?? "This reference will be removed from moodboards and saved boards in this browser.",
      confirmLabel: confirmationCopy.confirmLabel ?? "Delete"
    });

    if (!confirmed) {
      return false;
    }

    const deletedReferenceIdSet = new Set(uniqueReferenceIds);

    await Promise.all(uniqueReferenceIds.map((itemId) => deleteItem(itemId)));
    setItems((current) => current.filter((item) => !deletedReferenceIdSet.has(item.id)));
    setSelectedReferenceIds((current) =>
      Object.fromEntries(Object.entries(current).filter(([itemId, isSelected]) => !deletedReferenceIdSet.has(itemId) && isSelected))
    );
    setSelectedReferenceAnchorId((current) => (current && deletedReferenceIdSet.has(current) ? null : current));
    setOutfit((current) =>
      Object.fromEntries(
        Object.entries(current ?? {}).map(([slot, equippedId]) => [
          slot,
          deletedReferenceIdSet.has(equippedId) ? null : equippedId
        ])
      )
    );
    setBoard((current) => current ? {
      ...current,
      images: current.images.filter((image) => !deletedReferenceIdSet.has(image.referenceId))
    } : current);
    setSavedOutfits((current) =>
      current.map((savedOutfit) => ({
        ...savedOutfit,
        outfit: Object.fromEntries(
          Object.entries(savedOutfit.outfit ?? {}).map(([slot, equippedId]) => [
            slot,
            deletedReferenceIdSet.has(equippedId) ? null : equippedId
          ])
        ),
        board: savedOutfit.board
          ? {
              ...savedOutfit.board,
              images: savedOutfit.board.images.filter((image) => !deletedReferenceIdSet.has(image.referenceId))
            }
          : savedOutfit.board
      }))
    );

    if (
      (editingId && deletedReferenceIdSet.has(editingId)) ||
      (selectionEditorActive && uniqueReferenceIds.some((itemId) => selectedReferenceIds[itemId]))
    ) {
      setSelectionEditorActive(false);
      resetEditorState();
    }

    if (referencePreview && deletedReferenceIdSet.has(referencePreview.id)) {
      setReferencePreview(null);
    }

    return true;
  }

  async function handleDelete(itemId) {
    return deleteReferenceIds([itemId]);
  }

  async function handleEditorDelete() {
    if (!draft.id || editingId === "new") {
      return;
    }

    const deleted = await handleDelete(draft.id);

    if (deleted) {
      cancelEdit();
    }
  }

  function replaceBoardImageReference(imageId, referenceId) {
    setGuidedDebugPayload([]);
    setBoard((current) => {
      if (!current) {
        return current;
      }

      return relayoutBoardStateImages(
        current.images.map((image) =>
          image.id === imageId
            ? { ...image, referenceId }
            : image
        )
      );
    });
  }

  function cycleBoardImage(direction) {
    if (!pickerBoardImage) {
      return;
    }

    const options = getPool(items, pickerBoardImage.generationSlot, excluded, generationLists, true)
      .filter((item) => matchesMoodboardMetadataFilters(item, generationMetadataFilters))
      .filter((item) => item.id !== pickerBoardImage.referenceId);

    if (!options.length) {
      return;
    }

    const currentIndex = options.findIndex((item) => item.id === pickerBoardImage.referenceId);
    const fallbackIndex = direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex + direction + options.length) % options.length;
    replaceBoardImageReference(pickerBoardImage.id, options[nextIndex].id);
  }

  function handleBoardImageReroll() {
    if (!pickerBoardImage || !board) {
      return;
    }

    const result = rerollBoardImage({
      board,
      imageId: pickerBoardImage.id,
      items: getMetadataFilteredItems(items, generationMetadataFilters),
      excluded,
      generationLists,
      outfitFilters,
      weatherData,
      generationMode,
      outfitAffinity,
      recentOutfits,
      boardFilters: generationMetadataFilters,
      boardGuidedOptions: {
        collectTopCandidates: outfitDebugOpen
      }
    });

    if (!result?.boardImage) {
      return;
    }

    setBoard((current) => {
      if (!current) {
        return current;
      }

      return relayoutBoardStateImages(
        current.images.map((image) => image.id === result.boardImage.id ? result.boardImage : image)
      );
    });
    setOutfit(boardToSyntheticOutfit({
      ...board,
      images: board.images.map((image) => image.id === result.boardImage.id ? result.boardImage : image)
    }));
  }

  function selectBoardImage(imageId) {
    closeUtilityWindows();
    setActivePanel(null);
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
    setActiveBoardImageId((current) => current === imageId ? null : imageId);
    setPickerBoardImageId(null);
  }

  function openBoardImagePicker(image) {
    closeUtilityWindows();
    setActivePanel(null);
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
    setActiveBoardImageId(image.id);
    setPickerBoardImageId(image.id);
  }

  function updateBoardImagePosition(imageId, x, y) {
    setBoard((current) => current ? {
      ...current,
      images: current.images.map((image) =>
        image.id === imageId
          ? {
              ...image,
              x: Math.round(x),
              y: Math.round(y)
            }
          : image
      )
    } : current);
  }

  function getBoardLayoutOptionsWithMetricOverride(referenceId, metrics) {
    if (!referenceId || !metrics?.naturalWidth || !metrics?.naturalHeight) {
      return boardLayoutOptions;
    }

    const item = itemsById[referenceId];
    if (!item) {
      return boardLayoutOptions;
    }

    const renderMetadata = buildBoardRenderMetadata(item, metrics);

    return {
      aspectRatiosByReferenceId: {
        ...boardLayoutOptions.aspectRatiosByReferenceId,
        [referenceId]: getItemPresentationAspectRatio(item, metrics)
      },
      sizeMultipliersByReferenceId: {
        ...boardLayoutOptions.sizeMultipliersByReferenceId,
        [referenceId]: renderMetadata.sizeMultiplier
      },
      renderMetadataByReferenceId: {
        ...boardLayoutOptions.renderMetadataByReferenceId,
        [referenceId]: renderMetadata
      }
    };
  }

  function syncBoardImageDimensions(imageId, item, metrics) {
    if (!metrics?.naturalWidth || !metrics?.naturalHeight) {
      return;
    }

    setRuntimeImageMetricsByItemId((current) => {
      const previous = current[item.id];

      if (
        previous?.naturalWidth === metrics.naturalWidth &&
        previous?.naturalHeight === metrics.naturalHeight
      ) {
        return current;
      }

      return {
        ...current,
        [item.id]: {
          naturalWidth: metrics.naturalWidth,
          naturalHeight: metrics.naturalHeight
        }
      };
    });
  }

  function startBoardInteraction(event, interaction) {
    event.preventDefault();
    boardInteractionRef.current = interaction;

    function handlePointerMove(moveEvent) {
      const currentInteraction = boardInteractionRef.current;
      if (!currentInteraction) {
        return;
      }

      const deltaX = moveEvent.clientX - currentInteraction.startClientX;
      const deltaY = moveEvent.clientY - currentInteraction.startClientY;

      if (currentInteraction.type === "pan") {
        setBoardView((current) => ({
          ...current,
          x: currentInteraction.originX + deltaX,
          y: currentInteraction.originY + deltaY
        }));
        return;
      }

      updateBoardImagePosition(
        currentInteraction.imageId,
        currentInteraction.originX + deltaX / currentInteraction.zoom,
        currentInteraction.originY + deltaY / currentInteraction.zoom
      );
    }

    function handlePointerUp() {
      boardInteractionRef.current = null;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }

  function handleBoardViewportPointerDown(event) {
    if (event.target instanceof Element && event.target.closest(".board-image")) {
      return;
    }

    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    startBoardInteraction(event, {
      type: "pan",
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: boardView.x,
      originY: boardView.y
    });
  }

  function handleBoardImagePointerDown(event, image) {
    event.stopPropagation();
    selectBoardImage(image.id);
    startBoardInteraction(event, {
      type: "drag",
      imageId: image.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: image.x,
      originY: image.y,
      zoom: boardView.zoom
    });
  }

  function getFittedBoardView(nextBoard) {
    if (!nextBoard?.width || !nextBoard?.height || !boardViewportRef.current) {
      return { x: 0, y: 0, zoom: 1 };
    }

    const viewportRect = boardViewportRef.current.getBoundingClientRect();
    const viewportWidth = Math.max(1, viewportRect.width - 24);
    const viewportHeight = Math.max(1, viewportRect.height - 24);
    const widthZoom = viewportWidth / nextBoard.width;
    const heightZoom = viewportHeight / nextBoard.height;
    const fittedZoom = Math.min(widthZoom, heightZoom);
    const boardImageCount = Array.isArray(nextBoard.images) ? nextBoard.images.length : 0;
    const relaxedZoom =
      boardImageCount >= 12 && boardImageCount <= 15
        ? Math.min(0.62, Math.max(0.6, fittedZoom * 1.55))
        : boardImageCount > 15
        ? fittedZoom >= 0.34
          ? Math.min(0.62, Math.max(0.52, fittedZoom * 1.46))
          : fittedZoom * 1.22
        : fittedZoom >= 0.82
          ? 1
          : fittedZoom >= 0.62
            ? fittedZoom * 1.12
            : fittedZoom * 1.05;
    const nextZoom = Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, Math.round(relaxedZoom * 1000) / 1000));

    return {
      x: Math.round((nextBoard.width * (1 - nextZoom) * 0.5) * 1000) / 1000,
      y: Math.round((nextBoard.height * (1 - nextZoom) * 0.5) * 1000) / 1000,
      zoom: nextZoom
    };
  }

  function zoomBoardView(nextZoomOrUpdater, anchor = null) {
    if (!boardViewportRef.current || !board) {
      setBoardView((current) => {
        const rawZoom = typeof nextZoomOrUpdater === "function" ? nextZoomOrUpdater(current.zoom) : nextZoomOrUpdater;
        const nextZoom = Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, Math.round(rawZoom * 1000) / 1000));

        return {
          ...current,
          zoom: nextZoom
        };
      });
      return;
    }

    const viewportRect = boardViewportRef.current.getBoundingClientRect();
    const baseLeft = viewportRect.width / 2 - board.width / 2;
    const baseTop = viewportRect.height / 2 - board.height / 2;
    const anchorX = anchor?.x ?? viewportRect.width / 2;
    const anchorY = anchor?.y ?? viewportRect.height / 2;

    setBoardView((current) => {
      const rawZoom = typeof nextZoomOrUpdater === "function" ? nextZoomOrUpdater(current.zoom) : nextZoomOrUpdater;
      const nextZoom = Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, Math.round(rawZoom * 1000) / 1000));

      if (nextZoom === current.zoom) {
        return current;
      }

      const contentX = (anchorX - baseLeft - current.x) / current.zoom;
      const contentY = (anchorY - baseTop - current.y) / current.zoom;

      return {
        x: Math.round((anchorX - baseLeft - contentX * nextZoom) * 1000) / 1000,
        y: Math.round((anchorY - baseTop - contentY * nextZoom) * 1000) / 1000,
        zoom: nextZoom
      };
    });
  }

  function handleBoardViewportWheel(event) {
    event.preventDefault();
    const viewportRect = boardViewportRef.current?.getBoundingClientRect();
    const anchor = viewportRect
      ? {
          x: event.clientX - viewportRect.left,
          y: event.clientY - viewportRect.top
        }
      : null;
    const zoomFactor = Math.exp(-event.deltaY * 0.0012);
    zoomBoardView((currentZoom) => currentZoom * zoomFactor, anchor);
  }

  function saveCurrentOutfit() {
    if (!board?.images?.length) {
      return;
    }

    setSavedOutfits((current) => {
      const existingSavedOutfit = current.find(
        (savedOutfit) => savedOutfit.board && getBoardKey(savedOutfit.board) === currentOutfitKey
      );

      if (existingSavedOutfit) {
        if (editingSavedOutfitId === existingSavedOutfit.id) {
          cancelEditSavedOutfit();
        }

        return current.filter((savedOutfit) => savedOutfit.id !== existingSavedOutfit.id);
      }

      return [
        normalizeSavedOutfit({
          id: `saved_outfit_${Date.now()}`,
          name: createSavedOutfitName(current),
          description: "",
          board: {
            ...board,
            images: board.images.map((image) => ({ ...image }))
          }
        }),
        ...current
      ];
    });
  }

  function toggleOutfitLike(boardToToggle) {
    if (!boardToToggle?.images?.length) {
      return;
    }

    const outfitKey = getBoardKey(boardToToggle);
    const isLiked = Boolean(likedOutfitKeys[outfitKey]);
    const syntheticOutfit = boardToSyntheticOutfit(boardToToggle);

    setLikedOutfitKeys((current) => {
      const nextLookup = { ...current };

      if (isLiked) {
        delete nextLookup[outfitKey];
      } else {
        nextLookup[outfitKey] = true;
      }

      return nextLookup;
    });

    setOutfitAffinity((current) =>
      applyOutfitAffinityDelta(current, syntheticOutfit, isLiked ? -1 : 1)
    );
    setRecentOutfits((current) => rememberRecentOutfit(current, syntheticOutfit, true, { liked: !isLiked }));
  }

  function toggleCurrentOutfitLike() {
    toggleOutfitLike(board);
  }

  function toggleSavedOutfitLike(savedOutfit) {
    toggleOutfitLike(savedOutfit.board);
  }

  function loadSavedOutfit(savedOutfit) {
    const nextBoard = normalizeBoard(savedOutfit.board);

    if (!nextBoard) {
      return;
    }

    setBoard(nextBoard);
    setImageCount(getBoardImageCount(nextBoard));
    setBoardView(getFittedBoardView(nextBoard));
    setOutfit(boardToSyntheticOutfit(nextBoard));
    setRecentOutfits((current) =>
      rememberRecentOutfit(
        current,
        boardToSyntheticOutfit(nextBoard),
        true,
        {
          preserveLiked: true,
          liked: Boolean(likedOutfitKeys[getBoardKey(nextBoard)])
        }
      )
    );
    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
  }

  function renderSavedOutfitPreview(savedOutfit) {
    const previewBoard = savedOutfit.board;

    if (!previewBoard?.images?.length) {
      return null;
    }

    return (
      <div className="saved-preview saved-preview-board" aria-hidden="true">
        {previewBoard.images.map((image) => {
          const item = itemsById[image.referenceId];

          if (!item) {
            return null;
          }

          return (
            <div
              key={image.id}
              className="saved-preview-board-image"
              style={{
                left: `${(image.x / previewBoard.width) * 100}%`,
                top: `${(image.y / previewBoard.height) * 100}%`,
                width: `${(image.width / previewBoard.width) * 100}%`,
                height: `${(image.height / previewBoard.height) * 100}%`,
                transform: `rotate(${image.rotation}deg)`,
                zIndex: image.zIndex
              }}
            >
              <ManagedItemImage item={item} alt="" dataItemId={item.id} />
            </div>
          );
        })}
      </div>
    );
  }

  function renderAccessorySlot(slot) {
    const item = itemsById[outfit[slot]];
    const isActive = activeAccessorySlot === slot;

    return (
      <button
        key={slot}
        type="button"
        className={`accessory-slot accessory-slot-${slot.toLowerCase()} ${item ? "has-item" : ""} ${isActive ? "is-active" : ""}`}
        onClick={() => openAccessoryPicker(slot)}
        aria-label={`${getAccessoryLabel(slot)} options`}
      >
        {item ? (
          <span className="item-figure accessory-figure has-item">
            <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} useFrameScale normalizeToFrameScale useCrop usePresentation />
          </span>
        ) : null}
      </button>
    );
  }

  function openAccessoryPicker(slot) {
    closeUtilityWindows();
    setActiveAccessorySlot((current) => {
      const nextSlot = current === slot ? null : slot;
      setPickerAnchorSlot(nextSlot);

      if (nextSlot) {
        setActiveOutfitSlot(null);
        setActivePanel(null);
      }

      return nextSlot;
    });
  }

  function openOutfitSlotPicker(slot) {
    closeUtilityWindows();
    setActiveOutfitSlot((current) => {
      const nextSlot = current === slot ? null : slot;
      setPickerAnchorSlot(nextSlot);

      if (nextSlot) {
        setActiveAccessorySlot(null);
        setActivePanel(null);
      }

      return nextSlot;
    });
  }

  function getPickerPositionClass() {
    if (!pickerAnchorSlot) {
      return "picker-overlay-right";
    }

    if (layering && pickerAnchorSlot === "TopOuter") {
      return "picker-overlay-left";
    }

    if (pickerAnchorSlot === "RightHand" || pickerAnchorSlot === "Bag") {
      return "picker-overlay-left";
    }

    return "picker-overlay-right";
  }

  function closePickerOverlay() {
    setPickerBoardImageId(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
  }

  function closeUtilityWindows() {
    setWeatherOpen(false);
    setLibraryTagActionMode(null);
  }

  function closeWardrobeAdd() {
    setWardrobeAddOpen(false);
    setImageUploadError("");
    setItemImageDragActive(false);
    setItemImporting(false);
  }

  function setBackupExportStatus(message) {
    setBackupExportFeedback(message);

    if (backupExportFeedbackTimeoutRef.current) {
      clearTimeout(backupExportFeedbackTimeoutRef.current);
    }

    if (!message) {
      backupExportFeedbackTimeoutRef.current = null;
      return;
    }

    backupExportFeedbackTimeoutRef.current = setTimeout(() => {
      backupExportFeedbackTimeoutRef.current = null;
      setBackupExportFeedback("");
    }, 6000);
  }

  function toggleWorkspacePanel(panel) {
    setActivePanel((current) => {
      const nextPanel = current === panel ? null : panel;
      if (nextPanel) {
        closeUtilityWindows();
        setControlsOpen(false);
        setDockExpanded(isMobileViewport);
      } else if (!controlsOpen) {
        setDockExpanded(isMobileViewport ? false : true);
      }
      setActiveBoardImageId(null);
      setPickerBoardImageId(null);
      setActiveOutfitSlot(null);
      setActiveAccessorySlot(null);
      setPickerAnchorSlot(null);
      setWardrobeFiltersOpen(false);
      setWardrobeWorthOpen(false);
      setWardrobeSavedOpen(false);
      setWardrobeManageOpen(false);
      setWardrobeAddOpen(false);
      setLibraryTagActionMode(null);
      setFitpicPreview(null);
      cancelEditSavedOutfit();
      setEditingId(null);
      setEditorReturnTarget(null);
      return nextPanel;
    });
  }

  function closeWorkspacePanel() {
    setActivePanel(null);
    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    if (!controlsOpen) {
      setDockExpanded(isMobileViewport ? false : true);
    }
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setLibraryTagActionMode(null);
    setFitpicPreview(null);
    cancelEditSavedOutfit();
    cancelEdit();
  }

  function toggleControlsWindow() {
    if (activePanel) {
      setActivePanel(null);
    }

    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setLibraryTagActionMode(null);
    setFitpicPreview(null);
    cancelEditSavedOutfit();
    setEditingId(null);
    setEditorReturnTarget(null);
    setControlsOpen((current) => {
      const nextOpen = !current;
      setDockExpanded(isMobileViewport ? nextOpen || activePanel === "wardrobe" : true);
      return nextOpen;
    });
  }

  function openWardrobeFilters() {
    closeUtilityWindows();
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    cancelEditSavedOutfit();
    setWardrobeFiltersOpen((current) => !current);
  }

  function toggleWardrobeSaved() {
    closeUtilityWindows();
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setWardrobeSavedOpen((current) => {
      const nextOpen = !current;

      if (!nextOpen) {
        cancelEditSavedOutfit();
      }

      return nextOpen;
    });
  }

  function toggleWardrobeManage() {
    closeUtilityWindows();
    setWardrobeAddOpen(false);
    setWardrobeSavedOpen(false);
    cancelEditSavedOutfit();
    setWardrobeManageOpen((current) => !current);
  }

  function toggleTagManagerExpanded(tag) {
    setExpandedTagManagerTags((current) => ({
      ...current,
      [tag]: !current[tag]
    }));
  }

  function toggleLibraryTagAction(mode) {
    if (!selectedReferenceCount) {
      setLibraryTagActionMode(null);
      return;
    }

    setLibraryTagActionMode((current) => (current === mode ? null : mode));
  }

  function loadAndCloseSavedOutfit(savedOutfit) {
    loadSavedOutfit(savedOutfit);
    cancelEditSavedOutfit();
    setWardrobeSavedOpen(false);
    setActivePanel(null);
  }

  function closeSavedOutfitsView() {
    cancelEditSavedOutfit();
    setWardrobeSavedOpen(false);
  }

  function renderOutfitSlotPicker() {
    if (!activeOutfitSlot) {
      return null;
    }

    const options = getSlotPickerOptions(activeOutfitSlot);
    const isLocked = Boolean(locked[activeOutfitSlot]);
    const currentItem = itemsById[outfit[activeOutfitSlot]];

    return (
      <div className="slot-picker">
        <div className="slot-picker-header">
          <strong>{getSlotLabel(activeOutfitSlot)}</strong>
          <button type="button" className="ghost-button" onClick={closePickerOverlay}>
            Close
          </button>
        </div>

        <div className="slot-picker-actions">
          <button
            type="button"
            className={`ghost-button ${isLocked ? "is-active" : ""}`}
            onClick={() => toggleLock(activeOutfitSlot)}
          >
            {isLocked ? "Unlock" : "Lock"}
          </button>
          <button type="button" className="ghost-button" onClick={() => handleReroll(activeOutfitSlot)}>
            Reroll
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleOutfitSlot(activeOutfitSlot, -1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleOutfitSlot(activeOutfitSlot, 1)}>
            Next
          </button>
          {currentItem ? (
            <button type="button" className="ghost-button" onClick={() => startFloatingEdit(currentItem)}>
              Edit
            </button>
          ) : null}
          <button type="button" className="ghost-button danger" onClick={() => removeOutfitSlot(activeOutfitSlot)}>
            Remove
          </button>
        </div>

        {options.length ? (
          <div className="slot-picker-list">
            {options.map((item) => {
              const isExcluded = Boolean(excluded[item.id]);

              return (
                <article
                  key={item.id}
                  className={`slot-picker-item ${outfit[activeOutfitSlot] === item.id ? "is-current" : ""} ${isExcluded ? "is-excluded" : ""}`}
                >
                  <button
                    type="button"
                    className="slot-picker-select"
                    onClick={() => setOutfitSlot(activeOutfitSlot, item.id)}
                  >
                    <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} />
                    <span>{buildDisplayName(item)}</span>
                  </button>
                  <button
                    type="button"
                    className={`picker-exclude-toggle ${isExcluded ? "is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExcluded(item.id);
                    }}
                    aria-label={isExcluded ? "Include reference in generation" : "Exclude reference from generation"}
                  >
                    {isExcluded ? "×" : "✓"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>No compatible references available for this slot.</p>
          </div>
        )}
      </div>
    );
  }

  function renderAccessoryPicker() {
    if (!activeAccessorySlot) {
      return null;
    }

    const currentItem = itemsById[outfit[activeAccessorySlot]];

    return (
      <div className="accessory-picker">
        <div className="accessory-picker-header">
          <strong>{getAccessoryLabel(activeAccessorySlot)}</strong>
          <button
            type="button"
            className="ghost-button"
            onClick={closePickerOverlay}
          >
            Close
          </button>
        </div>

        <div className="accessory-picker-actions">
          <button type="button" className="ghost-button" onClick={() => cycleAccessorySlot(activeAccessorySlot, -1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleAccessorySlot(activeAccessorySlot, 1)}>
            Next
          </button>
          {currentItem ? (
            <button type="button" className="ghost-button" onClick={() => startFloatingEdit(currentItem)}>
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button"
            onClick={() => removeAccessoryFromSlot(activeAccessorySlot)}
          >
            Remove
          </button>
        </div>

        {compatibleAccessoryOptions.length ? (
          <div className="accessory-picker-list">
            {compatibleAccessoryOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`accessory-picker-item ${outfit[activeAccessorySlot] === item.id ? "is-current" : ""}`}
                onClick={() => swapAccessory(activeAccessorySlot, item.id)}
              >
                <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} />
                <span>{buildDisplayName(item)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>No compatible references available for this slot.</p>
          </div>
        )}
      </div>
    );
  }

  function renderSavedOutfitsContent() {
    return (
      <section className="saved-outfits-page" aria-label="Saved boards">
        {!savedOutfits.length ? (
          <div className="editor-placeholder saved-outfits-empty">
            <p>Save a moodboard you like and it will appear here.</p>
          </div>
        ) : (
          <div className="saved-outfits-list">
            {savedOutfits.map((savedOutfit) => {
              const savedOutfitKey = savedOutfit.board
                ? getBoardKey(savedOutfit.board)
                : getOutfitKey(savedOutfit.outfit, savedOutfit.layering);
              const isSavedOutfitLiked = Boolean(likedOutfitKeys[savedOutfitKey]);

              return (
                <article key={savedOutfit.id} className="saved-outfit-card">
                  {editingSavedOutfitId === savedOutfit.id ? (
                    <form
                      className="saved-outfit-form"
                      onSubmit={(event) => submitSavedOutfit(event, savedOutfit.id)}
                    >
                      <label>
                        Name
                        <input
                          value={savedOutfitDraft.name}
                          onChange={(event) =>
                            setSavedOutfitDraft((current) => ({
                              ...current,
                              name: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          value={savedOutfitDraft.description}
                          onChange={(event) =>
                            setSavedOutfitDraft((current) => ({
                              ...current,
                              description: event.target.value
                            }))
                          }
                          rows="3"
                        />
                      </label>
                      <div className="saved-outfit-actions">
                        <button type="submit" className="primary-button">Save</button>
                        <button type="button" className="ghost-button" onClick={cancelEditSavedOutfit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="saved-outfit-load"
                        onClick={() => loadAndCloseSavedOutfit(savedOutfit)}
                      >
                        {renderSavedOutfitPreview(savedOutfit)}
                        <strong>{savedOutfit.name}</strong>
                        <span>{savedOutfit.description || "No description"}</span>
                        {savedOutfitHasMissingItems(savedOutfit, itemsById) ? (
                          <span className="saved-outfit-warning">Missing reference</span>
                        ) : null}
                      </button>
                      <div className="saved-outfit-actions">
                        <button
                          type="button"
                          className={`ghost-button ${isSavedOutfitLiked ? "is-active" : ""}`}
                          onClick={() => toggleSavedOutfitLike(savedOutfit)}
                        >
                          {isSavedOutfitLiked ? "Liked" : "Like"}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => startEditSavedOutfit(savedOutfit)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => deleteSavedOutfit(savedOutfit.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderBoardPicker() {
    if (!pickerBoardImage) {
      return null;
    }

    const currentItem = itemsById[pickerBoardImage.referenceId];
    return (
      <div className="slot-picker">
        <div className="slot-picker-header">
          <strong>Selected reference</strong>
          <button type="button" className="ghost-button" onClick={closePickerOverlay}>
            Close
          </button>
        </div>

        <div className="slot-picker-actions">
          <button type="button" className="ghost-button" onClick={() => cycleBoardImage(-1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleBoardImage(1)}>
            Next
          </button>
          <button type="button" className="ghost-button" onClick={handleBoardImageReroll}>
            Reroll
          </button>
          {currentItem ? (
            <button type="button" className="ghost-button" onClick={() => startFloatingEdit(currentItem)}>
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button danger"
            onClick={() => {
              setBoard((current) => {
                if (!current) {
                  return current;
                }

                const nextImages = current.images.filter((image) => image.id !== pickerBoardImage.id);

                return nextImages.length ? relayoutBoardStateImages(nextImages) : null;
              });
              setActiveBoardImageId(null);
              setPickerBoardImageId(null);
              setGuidedDebugPayload([]);
            }}
          >
            Remove
          </button>
        </div>

        {visibleBoardPickerItems.length ? (
          <div
            ref={boardPickerListRef}
            className={`slot-picker-list ${shouldVirtualizeBoardPicker ? "is-virtualized" : ""}`.trim()}
          >
            {shouldVirtualizeBoardPicker ? (
              <div
                className="slot-picker-list-virtual-spacer"
                style={{ height: `${virtualizedBoardPickerItems.totalHeight}px` }}
              >
                {virtualizedBoardPickerItems.virtualRows.map((row) => (
                  <div key={row.key} className="slot-picker-list-virtual-row" style={row.style}>
                    {row.items.map((item) => {
                      const isExcluded = Boolean(excluded[item.id]);

                      return (
                        <article
                          key={item.id}
                          className={`slot-picker-item ${pickerBoardImage.referenceId === item.id ? "is-current" : ""} ${isExcluded ? "is-excluded" : ""}`}
                        >
                          <button
                            type="button"
                            className="slot-picker-select"
                            onClick={() => replaceBoardImageReference(pickerBoardImage.id, item.id)}
                          >
                            <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} />
                            <span>{buildDisplayName(item)}</span>
                          </button>
                          <button
                            type="button"
                            className={`picker-exclude-toggle ${isExcluded ? "is-active" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExcluded(item.id);
                            }}
                            aria-label={isExcluded ? "Include reference in generation" : "Exclude reference from generation"}
                          >
                            {isExcluded ? "×" : "✓"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              visibleBoardPickerItems.map((item) => {
                const isExcluded = Boolean(excluded[item.id]);

                return (
                  <article
                    key={item.id}
                    className={`slot-picker-item ${pickerBoardImage.referenceId === item.id ? "is-current" : ""} ${isExcluded ? "is-excluded" : ""}`}
                  >
                    <button
                      type="button"
                      className="slot-picker-select"
                      onClick={() => replaceBoardImageReference(pickerBoardImage.id, item.id)}
                    >
                      <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} />
                      <span>{buildDisplayName(item)}</span>
                    </button>
                    <button
                      type="button"
                      className={`picker-exclude-toggle ${isExcluded ? "is-active" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExcluded(item.id);
                      }}
                      aria-label={isExcluded ? "Include reference in generation" : "Exclude reference from generation"}
                    >
                      {isExcluded ? "×" : "✓"}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>No references match the current controls filters.</p>
          </div>
        )}
      </div>
    );
  }

  function renderBoardCanvas() {
    return (
      <div className="board-stage">
        <div className="board-canvas-toolbar" aria-label="Canvas controls">
          <button
            type="button"
            className="ghost-button"
            onClick={() => zoomBoardView((currentZoom) => currentZoom * 1.08)}
          >
            Zoom in
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => zoomBoardView((currentZoom) => currentZoom / 1.08)}
          >
            Zoom out
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setBoardView(board ? getFittedBoardView(board) : { x: 0, y: 0, zoom: 1 })}
          >
            Reset view
          </button>
          <span className="board-canvas-zoom-readout">{Math.round(boardView.zoom * 100)}%</span>
          {showBoardGenerationBusy ? <span className="board-canvas-generation-status">Generating...</span> : null}
        </div>

        <div className="board-canvas-viewport" ref={boardViewportRef} onPointerDown={handleBoardViewportPointerDown} onWheel={handleBoardViewportWheel}>
          {board?.images?.length ? (
            <div
              className="board-canvas-surface"
              onPointerDown={handleBoardViewportPointerDown}
              style={boardSurfaceStyle}
            >
              {boardCanvasImages.map(({ image, item }) => (
                <BoardCanvasImage
                  key={image.id}
                  image={image}
                  item={item}
                  isActive={activeBoardImageId === image.id}
                  onMetrics={(metrics) => syncBoardImageDimensions(image.id, item, metrics)}
                  onImagePointerDown={handleBoardImagePointerDown}
                  onImageDoubleClick={(boardImage, boardItem) => {
                    selectBoardImage(boardImage.id);
                    openReferencePreview(boardItem);
                  }}
                  onEditImage={startFloatingEdit}
                  onSelectImage={openBoardImagePicker}
                />
              ))}
            </div>
          ) : (
            <div className="board-canvas-empty">
              <p>No board yet. Generate a board to start.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderWardrobeGrid() {
    const gridClassName = `wardrobe-grid ${shouldVirtualizeWardrobeGrid ? "is-virtualized" : ""}`.trim();
    const gridItems = virtualizedWardrobeGrid.virtualItems;

    return (
      <div ref={wardrobeGridRef} className={gridClassName}>
        {shouldVirtualizeWardrobeGrid ? (
          <div
            className="wardrobe-grid-virtual-spacer"
            style={{ height: `${virtualizedWardrobeGrid.totalHeight}px` }}
          >
            {gridItems.map(({ item, style }) => (
              <LibraryGridCard
                key={item.id}
                item={item}
                isSelected={selectedReferenceIdSet.has(item.id)}
                isExcluded={Boolean(excluded[item.id])}
                cardStyle={style}
                onSelectReference={handleLibraryReferenceSelect}
                onOpenReferencePreview={handleLibraryReferencePreview}
                onVisibleImageMount={handleVisibleLibraryImageMount}
              />
            ))}
          </div>
        ) : (
          gridItems.map(({ item, style }) => (
            <LibraryGridCard
              key={item.id}
              item={item}
              isSelected={selectedReferenceIdSet.has(item.id)}
              isExcluded={Boolean(excluded[item.id])}
              cardStyle={style}
              onSelectReference={handleLibraryReferenceSelect}
              onOpenReferencePreview={handleLibraryReferencePreview}
              onVisibleImageMount={handleVisibleLibraryImageMount}
            />
          ))
        )}
      </div>
    );
  }

  function startEditSavedOutfit(savedOutfit) {
    setEditingSavedOutfitId(savedOutfit.id);
    setSavedOutfitDraft({
      name: savedOutfit.name ?? "",
      description: savedOutfit.description ?? ""
    });
  }

  function cancelEditSavedOutfit() {
    setEditingSavedOutfitId(null);
    setSavedOutfitDraft({ name: "", description: "" });
  }

  function submitSavedOutfit(event, savedOutfitId) {
    event.preventDefault();

    const trimmedName = savedOutfitDraft.name.trim();
    const trimmedDescription = savedOutfitDraft.description.trim();

    setSavedOutfits((current) =>
      current.map((savedOutfit) =>
        savedOutfit.id === savedOutfitId
          ? {
              ...savedOutfit,
              name: trimmedName || savedOutfit.name,
              description: trimmedDescription
            }
          : savedOutfit
      )
    );

    cancelEditSavedOutfit();
  }

  async function deleteSavedOutfit(savedOutfitId) {
    const confirmed = await requestConfirmation({
      title: "Delete saved board?",
      message: "This saved board will be removed from this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    setSavedOutfits((current) => current.filter((savedOutfit) => savedOutfit.id !== savedOutfitId));

    if (editingSavedOutfitId === savedOutfitId) {
      cancelEditSavedOutfit();
    }
  }

  async function handleFitpicUpload(event) {
    const files = [...event.target.files];

    if (!files.length) {
      return;
    }

    const nextFitpics = await Promise.all(
      files.map(async (file) => ({
        id: createFitpicId(),
        name: file.name.replace(/\.[^.]+$/, ""),
        imageData: await readFileAsDataUrl(file),
        createdAt: new Date().toISOString()
      }))
    );

    setFitpics((current) => [...nextFitpics, ...current]);
    event.target.value = "";
  }

  async function deleteFitpic(fitpicId) {
    const confirmed = await requestConfirmation({
      title: "Delete archived image?",
      message: "This archived reference image will be removed from this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    setFitpics((current) => current.filter((fitpic) => fitpic.id !== fitpicId));
  }

  function removeAccessoryFromSlot(slot) {
    setOutfit((current) => ({
      ...current,
      [slot]: null
    }));
    setLocked((current) => ({
      ...current,
      [slot]: false
    }));
  }

  function swapAccessory(slot, itemId) {
    setOutfit((current) => ({
      ...current,
      [slot]: itemId
    }));
    setActiveAccessorySlot(null);
  }

  function openReferencePreview(item) {
    setPickerBoardImageId(null);
    setReferencePreview(normalizeItem(item));
  }

  const cropEditorBody = cropEditorState && draft.imageUrl.trim() ? (
    <div className="crop-editor-modal" role="dialog" aria-modal="true" aria-label="Crop reference image">
      <div className="crop-editor-header">
        <strong>Crop reference</strong>
        <button type="button" className="ghost-button" onClick={closeCropEditor}>
          Cancel
        </button>
      </div>
      <div className="crop-editor-stage">
        <div
          ref={cropEditorFrameRef}
          className="crop-editor-frame"
          style={{
            aspectRatio: `${Math.max(
              0.55,
              Math.min(1.8, cropEditorImageMetrics.naturalWidth / Math.max(cropEditorImageMetrics.naturalHeight, 1))
            )}`
          }}
        >
          <img
            src={resolveImageUrl(draft.imageUrl)}
            alt=""
            className="crop-editor-image"
          />
          <div
            className="crop-editor-selection"
            style={{
              left: `${cropEditorState.x}%`,
              top: `${cropEditorState.y}%`,
              width: `${cropEditorState.width}%`,
              height: `${cropEditorState.height}%`
            }}
          >
            <div className="crop-editor-grid" aria-hidden="true" />
            <div className="crop-editor-selection-label">Drag each side to trim the image.</div>
            <button
              type="button"
              className="crop-editor-handle crop-editor-handle-top"
              aria-label="Adjust top crop"
              onPointerDown={(event) => startCropEdgeDrag("top", event)}
            />
            <button
              type="button"
              className="crop-editor-handle crop-editor-handle-right"
              aria-label="Adjust right crop"
              onPointerDown={(event) => startCropEdgeDrag("right", event)}
            />
            <button
              type="button"
              className="crop-editor-handle crop-editor-handle-bottom"
              aria-label="Adjust bottom crop"
              onPointerDown={(event) => startCropEdgeDrag("bottom", event)}
            />
            <button
              type="button"
              className="crop-editor-handle crop-editor-handle-left"
              aria-label="Adjust left crop"
              onPointerDown={(event) => startCropEdgeDrag("left", event)}
            />
          </div>
        </div>
      </div>
      <div className="crop-editor-controls">
        <p className="crop-editor-instructions">
          Pull the top, right, bottom, or left edge inward to cut away that part of the image.
        </p>
      </div>
      <div className="crop-editor-actions">
        <button type="button" className="ghost-button" onClick={resetCropEditor}>
          Reset
        </button>
        <button type="button" className="primary-button" onClick={applyCropEditor}>
          Apply crop
        </button>
      </div>
    </div>
  ) : null;

  if (loading) {
    return <main className="app-shell loading-state">Loading library…</main>;
  }

  const selectedReferenceTags = uniqueTags(selectedReferenceItems.flatMap((item) => item.tags ?? []));
  const selectedReferenceCommonTags = getCommonTagsForItems(selectedReferenceItems);
  const selectedReferenceTotalUniqueTagCount = getTotalUniqueTagCount(selectedReferenceItems);
  const bulkFavoriteValues = [...new Set(selectedReferenceItems.map((item) => Boolean(item.favorite)))];
  const libraryTagActionSuggestions = libraryTagActionMode === "remove" ? selectedReferenceTags : allLibraryTags;
  const libraryTagActionSelectedTags =
    libraryTagActionMode === "remove" ? bulkMetadataDraft.removeTags : bulkMetadataDraft.addTags;
  const editorTitle = isBulkSelectionEditing
    ? `Edit ${selectedReferenceCount} references`
    : editingId
      ? "Edit reference"
      : "Reference editor";
  const isSideEditorOpen = Boolean(isBulkSelectionEditing || (editingId && editorReturnTarget !== "outfit"));
  const isMobileFullscreenEditorOpen = Boolean((editingId || isBulkSelectionEditing) && isMobileViewport);
  const draftSystemMetadata = getItemSystemMetadata(draft);
  const draftSavedMetadataRows = [
    ["Captured", draftSystemMetadata.capturedAt ? formatCreatedAt(draftSystemMetadata.capturedAt) : ""],
    ["Imported", draftSystemMetadata.importedAt ? formatCreatedAt(draftSystemMetadata.importedAt) : ""],
    ["Updated", draftSystemMetadata.updatedAt ? formatCreatedAt(draftSystemMetadata.updatedAt) : ""],
    ["Original file", draft.originalFilename],
    ["MIME type", draft.mimeType],
    ["Size", formatFileSize(draft.fileSize)],
    [
      "Dimensions",
      draft.imageWidth && draft.imageHeight ? `${draft.imageWidth} × ${draft.imageHeight}` : ""
    ],
    ["Aspect ratio", formatAspectRatio(draft.aspectRatio)],
    ["Orientation", draft.orientation],
    ["Camera make", draft.cameraMake],
    ["Camera model", draft.cameraModel],
    ["Lens", draft.lensModel],
    ["Focal length", draft.focalLength],
    ["Aperture", draft.fNumber],
    ["Exposure", draft.exposureTime],
    ["ISO", draft.iso],
    ["Color space", draft.colorSpace],
    ["Color profile", draft.colorProfile]
  ].filter(([, value]) => Boolean(value));

  const editorBody = isBulkSelectionEditing ? (
    <div className="editor-form bulk-editor-form">
      <div className="editor-placeholder bulk-editor-summary">
        <p>{selectedReferenceCount} selected</p>
        <p>Common tags: {selectedReferenceCommonTags.length ? selectedReferenceCommonTags.join(", ") : "none"}</p>
        <p>Total unique tags: {selectedReferenceTotalUniqueTagCount}</p>
        {bulkMetadataFeedback ? <p className="form-success">{bulkMetadataFeedback}</p> : null}
      </div>

      <div className="bulk-editor-toolbar">
        <label>
          <span className="editor-label-row">
            <span>Add tag</span>
          </span>
          <TagInput
            selectedTags={bulkMetadataDraft.addTags}
            allTags={allLibraryTags}
            onChange={(nextTags) => {
              void handleImmediateBulkTagDraftChange("add", nextTags);
            }}
            placeholder="Add tag…"
          />
        </label>

        <label>
          <span className="editor-label-row">
            <span>Remove tag</span>
          </span>
          <TagInput
            selectedTags={bulkMetadataDraft.removeTags}
            allTags={selectedReferenceTags}
            onChange={(nextTags) => {
              void handleImmediateBulkTagDraftChange("remove", nextTags);
            }}
            placeholder="Remove tag…"
          />
        </label>

        <label>
          <span className="editor-label-row">
            <span>Favorite</span>
            {bulkFavoriteValues.length > 1 ? <span className="field-status-badge">Mixed</span> : null}
          </span>
          <select
            value={bulkMetadataDraft.favorite}
            onChange={async (event) => {
              const nextValue = event.target.value;
              setBulkMetadataDraft((current) => ({ ...current, favorite: nextValue }));
              await applyImmediateBulkFavoriteEdit(nextValue);
              setBulkMetadataDraft((current) => ({ ...current, favorite: "" }));
            }}
          >
            <option value="">Keep current values</option>
            <option value="yes">Favorite selected</option>
            <option value="no">Unfavorite selected</option>
          </select>
        </label>
      </div>

      <div className="form-actions bulk-editor-actions">
        <button type="button" className="secondary-button" onClick={clearSelectedReferences}>Clear selection</button>
      </div>
    </div>
  ) : editingId ? (
    <form className="editor-form" onSubmit={submitItem}>
      <div
        className={`item-image-upload ${itemImageDragActive ? "is-drag-active" : ""}`}
        onDragEnter={handleItemImageDragEnter}
        onDragOver={handleItemImageDragOver}
        onDragLeave={handleItemImageDragLeave}
        onDrop={handleItemImageDrop}
      >
        <div className="item-image-preview">
          {draft.imageUrl.trim() ? (
            <ManagedItemImage item={draft} alt="" frameRef={editorImageFrameRef} imageRef={editorImageRef} />
          ) : (
            <span>No image selected</span>
          )}
        </div>
        {!draft.originalPreserved && draft.imageUrl.trim() ? (
          <p className="image-preservation-note">Original not preserved</p>
        ) : null}
        <div className="item-image-actions">
          <label className="upload-button">
            {draft.imageUrl.trim() ? "Change image" : "Choose image"}
            <input type="file" accept="image/*" multiple onChange={handleItemImageUpload} disabled={imageProcessing || itemImporting} />
          </label>
          {draft.imageUrl.trim() ? (
            <>
              <label className="upload-button upload-button-secondary">
                Replace original image
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReplaceOriginalImageUpload}
                  disabled={imageProcessing || itemImporting}
                />
              </label>
              <label className="editor-inline-checkbox">
                <input
                  type="checkbox"
                  checked={replaceOriginalShouldRegenerate}
                  onChange={(event) => setReplaceOriginalShouldRegenerate(event.target.checked)}
                  disabled={imageProcessing || itemImporting}
                />
                <span>Regenerate optimized previews</span>
              </label>
            </>
          ) : null}
          {draft.imageUrl.trim() ? (
            <button type="button" className="secondary-button" onClick={openCropEditor} disabled={imageProcessing || itemImporting}>
              Crop
            </button>
          ) : null}
          {draft.imageUrl.trim() ? (
            <button type="button" className="ghost-button" onClick={resetDraftImageCrop} disabled={imageProcessing || itemImporting}>
              Reset crop
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            onClick={removeDraftBackground}
            disabled={!canRemoveDraftBackground || imageProcessing || itemImporting}
          >
            {imageProcessing ? "Removing..." : "Remove background"}
          </button>
          {draft.imageUrl.trim() ? (
            <button type="button" className="ghost-button" onClick={removeDraftImage} disabled={imageProcessing || itemImporting}>
              Remove image
            </button>
          ) : null}
        </div>
        {imageUploadError ? <p className="form-error">{imageUploadError}</p> : null}
      </div>

      <div className="editor-core-fields">
        <label>
          Name / Title
          <input
            list="item-name-suggestions"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Concrete study, chrome lamp, gallery wall"
          />
        </label>
        <datalist id="item-name-suggestions">
          {nameSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <label>
          Description
          <textarea
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Short notes about the reference"
            rows="3"
          />
        </label>

        <label>
          Tags
          <TagInput
            selectedTags={draft.tags}
            allTags={allLibraryTags}
            onChange={(nextTags) => {
              if (editorReturnTarget === "outfit" && editingId !== "new") {
                updateExistingDraftItem({
                  ...draft,
                  tags: nextTags
                });
                return;
              }

              setDraft((current) => ({ ...current, tags: nextTags }));
            }}
            placeholder="Add tag…"
            showAllSuggestionsOnFocus
          />
        </label>

      </div>

      {draftSavedMetadataRows.length ? (
        <details className="saved-metadata-disclosure">
          <summary>All saved metadata</summary>
          <div className="saved-metadata-list" aria-label="All saved metadata">
            {draftSavedMetadataRows.map(([label, value]) => (
              <div key={label} className="saved-metadata-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="checkbox-field editor-bottom-toggle">
        <span>Favorite</span>
        <input
          type="checkbox"
          checked={Boolean(draft.favorite)}
          onChange={(event) => {
            const nextFavorite = event.target.checked;

            if (editorReturnTarget === "outfit" && editingId !== "new") {
              updateExistingDraftItem({
                ...draft,
                favorite: nextFavorite
              });
              return;
            }

            setDraft((current) => ({ ...current, favorite: nextFavorite }));
          }}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-button">Save reference</button>
        {editingId !== "new" ? (
          <button type="button" className="secondary-button" onClick={duplicateDraftItem}>
            Duplicate
          </button>
        ) : null}
        {editingId !== "new" ? (
          <button type="button" className="ghost-button danger" onClick={handleEditorDelete}>
            Delete
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>
      </div>
    </form>
  ) : (
    <div className="editor-placeholder">
      <p>Select a reference and click Edit to open it here.</p>
      <p>Uploaded reference images are saved in this browser and included in backup JSON.</p>
    </div>
  );

  function renderOutfitSlot(slot) {
    const item = itemsById[outfit[slot]];
    const isActive = activeOutfitSlot === slot;
    return (
      <div key={slot} className="outfit-slot-wrap">
        <article
          className={`outfit-slot outfit-slot-${slot.toLowerCase()} ${locked[slot] ? "is-locked" : ""} ${isActive ? "is-active" : ""}`}
        >
          <button
            type="button"
            className={`item-figure ${item ? "has-item" : "is-empty"}`}
            onClick={() => openOutfitSlotPicker(slot)}
            aria-label={`${getSlotLabel(slot)} options`}
          >
            {item ? <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} useFrameScale normalizeToFrameScale useCrop usePresentation /> : <span aria-hidden="true" />}
          </button>
        </article>
      </div>
    );
  }

  return (
    <main className="app-shell">
      {cropEditorBody ? (
        <>
          <div className="floating-backdrop crop-editor-backdrop" onClick={closeCropEditor} />
          <div className="crop-editor-overlay">{cropEditorBody}</div>
        </>
      ) : null}
      <section className="content-grid">
        <div className="current-outfit-panel">
          <div ref={outfitStageRef} className="outfit-stage">
            {renderBoardCanvas()}
          </div>

        </div>

        {pickerBoardImageId ? (
          <div ref={pickerOverlayRef} className={`picker-overlay ${getPickerPositionClass()}`}>
            {renderBoardPicker()}
          </div>
        ) : null}

        {isMobileFullscreenEditorOpen ? null : (
          <div
            className={`workspace-tabs ${isDockExpanded ? "is-dock-expanded" : ""} ${paletteOpen ? "is-palette-open" : ""}`}
            aria-label="Workspace sections"
          >
            <button
              type="button"
              className="workspace-tab is-active"
              onClick={handleGenerate}
              disabled={isBoardGenerating}
            >
              Generate Board
            </button>
            <button
              type="button"
              className={`workspace-tab ${controlsOpen && !activePanel ? "is-active" : ""}`}
              onClick={toggleControlsWindow}
              aria-pressed={controlsOpen && !activePanel}
            >
              CONTROLS
            </button>
            <div className={`workspace-tab-group ${isDockExpanded ? "is-expanded" : ""}`}>
              {[["wardrobe", "Library"]].map(([panel, label]) => (
                <button
                  key={panel}
                  type="button"
                  className={`workspace-tab ${activePanel === panel ? "is-active" : ""}`}
                  onClick={() => toggleWorkspacePanel(panel)}
                  aria-pressed={activePanel === panel}
                  tabIndex={isDockExpanded ? 0 : -1}
                >
                  {label}
                </button>
              ))}
            </div>
            {outfitPalette.length ? (
              paletteOpen ? (
                <button
                  type="button"
                  className="outfit-palette-inline"
                  onClick={() => setPaletteOpen(false)}
                  aria-label="Hide moodboard color palette"
                  title="Hide color palette"
                >
                  {outfitPalette.map((entry) => (
                    <span
                      key={`${entry.color}-${entry.label}`}
                      className="outfit-palette-swatch"
                      style={{ backgroundColor: entry.color }}
                      title={`${entry.label}: ${entry.color}`}
                    />
                  ))}
                </button>
              ) : (
                <button
                  type="button"
                  className="palette-tab"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Toggle moodboard color palette"
                  aria-expanded={paletteOpen}
                  title="Color palette"
                >
                  <span style={{ backgroundColor: outfitPalette[0].color }} />
                </button>
              )
            ) : null}
          </div>
        )}

        {controlsOpen && !activePanel ? (
          <div className="controls-window" aria-label="Moodboard controls">
            <div className="controls-window-header">
              <p className="eyebrow">Current moodboard</p>
              <button
                type="button"
                className="controls-hide-button"
                onClick={() => setControlsOpen(false)}
                aria-label="Hide controls"
              >
                ×
              </button>
            </div>

            <div className="controls-group controls-group-top">
              <button
                type="button"
                className={`secondary-button ${generationMode === "guided" ? "is-active" : ""}`}
                onClick={() =>
                  setGenerationMode((current) => (current === "guided" ? "random" : "guided"))
                }
              >
                Generation: {generationMode === "guided" ? "Guided" : "Random"}
              </button>
            </div>

            <div className="controls-group controls-group-bottom">
              <button
                type="button"
                className={`ghost-button ${isCurrentOutfitLiked ? "is-active" : ""}`}
                onClick={toggleCurrentOutfitLike}
              >
                {isCurrentOutfitLiked ? "Liked board" : "Like board"}
              </button>
              <button
                type="button"
                className={`ghost-button ${isCurrentOutfitSaved ? "is-active" : ""}`}
                onClick={saveCurrentOutfit}
              >
                {isCurrentOutfitSaved ? "Saved board" : "Save board"}
              </button>
              <button type="button" className="ghost-button" onClick={handleExportOutfitImage}>
                Export moodboard image
              </button>
            </div>

            <div className="controls-group">
              <div
                className={`controls-outfit-filters ${generationMetadataFiltersOpen ? "is-open" : ""}`}
                aria-label="Reference metadata filters"
                data-debug-id="controls-filter-shell"
                onPointerDownCapture={(event) => {
                  logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterShell.onPointerDownCapture", event);
                }}
                onClickCapture={(event) => {
                  logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterShell.onClickCapture", event);
                }}
                onFocusCapture={(event) => {
                  logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterShell.onFocusCapture", event);
                }}
              >
                <button
                  type="button"
                  className={`controls-outfit-filters-toggle ${generationMetadataFiltersOpen || hasActiveGenerationMetadataFilters ? "is-active" : ""}`}
                  data-debug-id="controls-filter-toggle"
                  onClick={(event) => {
                    logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterToggle.onClick", event, {
                      nextOpen: !generationMetadataFiltersOpen
                    });
                    setGenerationMetadataFiltersOpen((current) => !current);
                  }}
                  aria-expanded={generationMetadataFiltersOpen}
                >
                  <span>Reference filters</span>
                  <span>
                    {hasActiveGenerationMetadataFilters
                      ? `${activeGenerationMetadataFilterCount} active`
                      : "None"}
                  </span>
                </button>

                {generationMetadataFiltersOpen ? (
                <div
                  ref={generationMetadataFiltersPanelRef}
                  className="outfit-filters-panel"
                  data-debug-id="controls-filter-panel"
                  onPointerDownCapture={(event) => {
                    logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterPanel.onPointerDownCapture", event);
                  }}
                  onClickCapture={(event) => {
                    logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterPanel.onClickCapture", event);
                  }}
                  onFocusCapture={(event) => {
                    logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterPanel.onFocusCapture", event);
                  }}
                  onPointerDown={(event) => {
                    logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterPanel.onPointerDown", event);
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    logNestedTagDebug(nestedTagDebugEnabled, "controls-filter", "ControlsFilterPanel.onClick", event);
                    event.stopPropagation();
                  }}
                >
                  <div className="outfit-filter-groups">
                    <section className="outfit-filter-group controls-reference-filter-module">
                      <TagTree
                        entries={allLibraryTagEntries}
                        selectedTags={generationMetadataFilters.tags}
                        excludedTags={generationMetadataFilters.excludedTags}
                        onToggleTag={toggleGenerationMetadataTagFilter}
                        onToggleGroup={toggleGenerationMetadataTagGroup}
                        storageKey="controls-reference-filters"
                        noTagsCount={allLibraryNoTagsCount}
                        variant="compact"
                        debugEnabled={nestedTagDebugEnabled}
                        debugScope="controls-filter"
                        headerActions={(
                          <button
                            type="button"
                            className="ghost-button controls-reference-match-button"
                            onClick={() =>
                              setGenerationMetadataFilters((current) => ({
                                ...current,
                                tagMatchMode: current.tagMatchMode === "all" ? "any" : "all"
                              }))
                            }
                            aria-label={
                              generationMetadataFilters.tagMatchMode === "all"
                                ? "Tag matching: all selected tags"
                                : "Tag matching: any selected tag"
                            }
                            title={
                              generationMetadataFilters.tagMatchMode === "all"
                                ? "Require all selected tags."
                                : "Match any selected tag."
                            }
                          >
                            {generationMetadataFilters.tagMatchMode === "all" ? "Match: All" : "Match: Any"}
                          </button>
                        )}
                      />

                      <div className="controls-reference-filter-actions">
                        <button
                          type="button"
                          className={`ghost-button controls-reference-favorite-button ${generationMetadataFilters.favorite === "yes" ? "is-active" : ""}`}
                          onClick={() =>
                            setGenerationMetadataFilters((current) => ({
                              ...current,
                              favorite: current.favorite === "yes" ? "" : "yes"
                            }))
                          }
                          aria-pressed={generationMetadataFilters.favorite === "yes"}
                          aria-label={
                            generationMetadataFilters.favorite === "yes"
                              ? "Show all references"
                              : "Show favorites only"
                          }
                          title={
                            generationMetadataFilters.favorite === "yes"
                              ? "Showing favorites only. Click to clear."
                              : "Show favorites only."
                          }
                        >
                          <span className="controls-reference-favorite-icon" aria-hidden="true">♥</span>
                          <span>Favorites</span>
                        </button>

                        <button
                          type="button"
                          className="ghost-button outfit-filters-clear-button"
                          onClick={clearGenerationMetadataFilters}
                        >
                          Clear filters
                        </button>
                      </div>
                    </section>
                  </div>
                </div>
                ) : null}
              </div>
            </div>

            <div className="controls-group">
              <div ref={outfitDebugRef} className="outfit-feedback-panel">
                <div className="outfit-feedback-header">
                  <button
                    type="button"
                    className={`ghost-button outfit-debug-toggle ${outfitDebugOpen ? "is-active" : ""}`}
                    onClick={() => setOutfitDebugOpen((current) => !current)}
                    aria-expanded={outfitDebugOpen}
                  >
                    {outfitDebugOpen ? "Hide advanced debug" : "Advanced debug"}
                  </button>
                </div>

                {outfitDebugOpen && !showDebugPopout ? renderOutfitDebugPanel("is-inline") : null}
                {showDebugPopout ? renderOutfitDebugPanel("outfit-debug-popout") : null}
              </div>
            </div>

            <div className="controls-group">
              <label className="controls-generate-count-input">
                <span className="controls-generate-count-label">Images</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  max="30"
                  value={imageCountDraft}
                  onChange={(event) => setImageCountDraft(sanitizeImageCountDraft(event.target.value))}
                  onBlur={() => commitImageCountDraft()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitImageCountDraft();
                    }
                  }}
                />
              </label>
            </div>

          </div>
        ) : null}

        {activePanel ? (
          <div
            className="floating-backdrop active-panel-backdrop"
            data-debug-id="active-panel-backdrop"
            onPointerDown={(event) => {
              logNestedTagDebug(nestedTagDebugEnabled, "overlay", "ActivePanelBackdrop.onPointerDown", event);
            }}
            onClick={(event) => {
              logNestedTagDebug(nestedTagDebugEnabled, "overlay", "ActivePanelBackdrop.onClick", event);
              closeWorkspacePanel();
            }}
          >
        <div
          className={`active-panel-overlay ${activePanel === "wardrobe" ? "is-wardrobe-panel" : ""}`}
          data-debug-id="active-panel-overlay"
          onPointerDownCapture={(event) => {
            logNestedTagDebug(nestedTagDebugEnabled, "overlay", "ActivePanelOverlay.onPointerDownCapture", event);
          }}
          onClickCapture={(event) => {
            logNestedTagDebug(nestedTagDebugEnabled, "overlay", "ActivePanelOverlay.onClickCapture", event);
          }}
          onFocusCapture={(event) => {
            logNestedTagDebug(nestedTagDebugEnabled, "overlay", "ActivePanelOverlay.onFocusCapture", event);
          }}
          onClick={(event) => {
            logNestedTagDebug(nestedTagDebugEnabled, "overlay", "ActivePanelOverlay.onClick", event);
            event.stopPropagation();
          }}
        >
        {activePanel === "wardrobe" ? (
        <div className="wardrobe-workspace">
          <div className="panel wardrobe-panel">
          <div className="panel-header">
            {wardrobeSavedOpen ? (
              <div className="wardrobe-subview-header">
                <div>
                  <p className="eyebrow">Library</p>
                  <h2>Saved Boards</h2>
                </div>
                <button type="button" className="ghost-button" onClick={closeSavedOutfitsView}>
                  Back to library
                </button>
              </div>
            ) : (
              <>
                <div className="library-command-bar">
                  <div className="library-command-bar-search">
                    <label className="wardrobe-search-control">
                      <input
                        type="search"
                        aria-label="Search"
                        value={librarySearch}
                        onChange={(event) => setLibrarySearch(event.target.value)}
                        placeholder="Search references"
                      />
                      {librarySearch.trim() ? (
                        <button
                          type="button"
                          className="ghost-button wardrobe-search-clear"
                          onClick={clearLibrarySearch}
                          aria-label="Clear library search"
                        >
                          ×
                        </button>
                      ) : null}
                    </label>
                  </div>

                  <div className="library-command-bar-main-actions">
                    <button
                      type="button"
                      className={`secondary-button filter-button ${wardrobeFiltersOpen || hasActiveWardrobeFilters ? "is-active" : ""}`}
                      data-debug-id="library-filter-toggle"
                      onClick={(event) => {
                        logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterToggle.onClick", event, {
                          nextOpen: !wardrobeFiltersOpen
                        });
                        openWardrobeFilters();
                      }}
                      aria-pressed={wardrobeFiltersOpen}
                      aria-expanded={wardrobeFiltersOpen}
                    >
                      Filter
                    </button>
                    <label className="wardrobe-sort-control">
                      <select value={wardrobeSort} onChange={(event) => setWardrobeSort(event.target.value)}>
                        <option value="favorites">Favorites first</option>
                        <option value="name">Name A-Z</option>
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                      </select>
                    </label>
                    <button type="button" className="primary-button" onClick={startCreate}>
                      Add
                    </button>

                    <div
                      ref={wardrobeFiltersPanelRef}
                      className={`wardrobe-controls ${wardrobeFiltersOpen ? "is-open" : ""}`}
                      aria-label="Library filters"
                      data-debug-id="library-filter-panel"
                      onPointerDownCapture={(event) => {
                        logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterPanel.onPointerDownCapture", event);
                      }}
                      onClickCapture={(event) => {
                        logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterPanel.onClickCapture", event);
                      }}
                      onFocusCapture={(event) => {
                        logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterPanel.onFocusCapture", event);
                      }}
                      onPointerDown={(event) => {
                        logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterPanel.onPointerDown", event);
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterPanel.onClick", event);
                        event.stopPropagation();
                      }}
                    >
                      <div className="wardrobe-controls-inline-row">
                        <label className="wardrobe-inline-filter">
                          <span>Favorite</span>
                          <select
                            value={wardrobeFilters.favorite}
                            onChange={(event) =>
                              setWardrobeFilters((current) => ({ ...current, favorite: event.target.value }))
                            }
                          >
                            <option value="">All</option>
                            <option value="yes">Favorites</option>
                            <option value="no">Not favorites</option>
                          </select>
                        </label>
                        <label className="wardrobe-inline-filter">
                          <span>Exclude</span>
                          <select
                            value={wardrobeFilters.laundry}
                            onChange={(event) =>
                              setWardrobeFilters((current) => ({ ...current, laundry: event.target.value }))
                            }
                          >
                            <option value="">All</option>
                            <option value="show">Show excluded</option>
                            <option value="hide">Hide excluded</option>
                          </select>
                        </label>
                        <label className="wardrobe-inline-filter wardrobe-inline-filter-match">
                          <span>Match</span>
                          <select
                            value={normalizedWardrobeFilters.tagMatchMode}
                            onChange={(event) =>
                              setWardrobeFilters((current) => ({ ...current, tagMatchMode: event.target.value }))
                            }
                          >
                            <option value="all">All tags</option>
                            <option value="any">Any tag</option>
                          </select>
                        </label>
                      </div>

                      {(includedWardrobeFilterChips.length || excludedWardrobeFilterChips.length) ? (
                        <div className="wardrobe-popover-chips" aria-label="Active library filters">
                          {includedWardrobeFilterChips.map((filter) => (
                            <button
                              key={filter.key}
                              type="button"
                              className="active-filter-chip active-filter-chip-button"
                              onClick={filter.onClear}
                            >
                              {filter.prefix ? <span>{filter.prefix}</span> : null}
                              {filter.label}
                              <strong>×</strong>
                            </button>
                          ))}
                          {excludedWardrobeFilterChips.map((filter) => (
                            <button
                              key={filter.key}
                              type="button"
                              className="active-filter-chip active-filter-chip-button is-negative"
                              onClick={filter.onClear}
                            >
                              {filter.prefix ? <span>{filter.prefix}</span> : null}
                              {filter.label}
                              <strong>×</strong>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="filter-summary-actions wardrobe-popover-actions">
                        <button type="button" className="ghost-button clear-filters-button" onClick={clearWardrobeFilters}>
                          Clear filters
                        </button>
                        <button type="button" className="ghost-button clear-excluded-button" onClick={clearExcluded}>
                          Clear excluded
                        </button>
                      </div>

                      <div className="wardrobe-tags-filter">
                        <span>Tags</span>
                        <TagTree
                          entries={libraryTagEntries}
                          selectedTags={wardrobeFilters.tags}
                          excludedTags={wardrobeFilters.excludedTags}
                          onToggleTag={toggleLibraryTagFilter}
                          onToggleGroup={toggleLibraryTagGroup}
                          storageKey="library-filters"
                          noTagsCount={libraryNoTagsCount}
                          debugEnabled={nestedTagDebugEnabled}
                          debugScope="library-filter"
                        />
                      </div>
                    </div>
                  </div>

                  <div ref={librarySelectionActionsRef} className="library-command-bar-context">
                    {hasSelectedReferences ? (
                      <>
                        <span className="wardrobe-selection-chip">
                          {selectedReferenceCount} selected
                          <button
                            type="button"
                            className="wardrobe-selection-chip-clear"
                            onClick={clearSelectedReferences}
                            aria-label="Clear selection"
                          >
                            ×
                          </button>
                        </span>
                        <button
                          type="button"
                          className="primary-button library-context-button"
                          onClick={openSelectionEditor}
                          disabled={!canEditSelectedReference}
                        >
                          Edit
                        </button>
                        <div className="library-tag-action-anchor">
                          <button
                            type="button"
                            className={`ghost-button library-context-button ${libraryTagActionMode === "add" ? "is-active" : ""}`}
                            onClick={() => toggleLibraryTagAction("add")}
                          >
                            +Tag
                          </button>
                          {libraryTagActionMode === "add" ? (
                            <div className="library-tag-action-popover" aria-label="Add tags to selection">
                              <TagInput
                                selectedTags={libraryTagActionSelectedTags}
                                allTags={libraryTagActionSuggestions}
                                onChange={(nextTags) => {
                                  void handleImmediateBulkTagDraftChange("add", nextTags);
                                }}
                                placeholder="Add tag"
                                autoFocus
                                showAllSuggestionsOnFocus
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="library-tag-action-anchor">
                          <button
                            type="button"
                            className={`ghost-button library-context-button ${libraryTagActionMode === "remove" ? "is-active" : ""}`}
                            onClick={() => toggleLibraryTagAction("remove")}
                          >
                            -Tag
                          </button>
                          {libraryTagActionMode === "remove" ? (
                            <div className="library-tag-action-popover" aria-label="Remove tags from selection">
                              <TagInput
                                selectedTags={libraryTagActionSelectedTags}
                                allTags={libraryTagActionSuggestions}
                                onChange={(nextTags) => {
                                  void handleImmediateBulkTagDraftChange("remove", nextTags);
                                }}
                                placeholder="Remove tag"
                                autoFocus
                                showAllSuggestionsOnFocus
                              />
                            </div>
                          ) : null}
                        </div>
                        <label className="library-context-favorite">
                          <select
                            aria-label="Favorite"
                            value={bulkMetadataDraft.favorite}
                            onChange={async (event) => {
                              const nextValue = event.target.value;
                              setBulkMetadataDraft((current) => ({ ...current, favorite: nextValue }));
                              await applyImmediateBulkFavoriteEdit(nextValue);
                              setBulkMetadataDraft((current) => ({ ...current, favorite: "" }));
                            }}
                          >
                            <option value="">♥</option>
                            <option value="yes">♥+</option>
                            <option value="no">♥−</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          className="primary-button wardrobe-bulk-button wardrobe-bulk-button-danger library-context-button"
                          onClick={deleteSelectedReferences}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`ghost-button library-context-button ${wardrobeSavedOpen ? "is-active" : ""}`}
                          onClick={toggleWardrobeSaved}
                          aria-expanded={wardrobeSavedOpen}
                        >
                          Saved Boards
                        </button>
                        <button
                          type="button"
                          className={`ghost-button library-context-button ${wardrobeManageOpen ? "is-active" : ""}`}
                          onClick={toggleWardrobeManage}
                          aria-expanded={wardrobeManageOpen}
                        >
                          Manage
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
            </div>

            {wardrobeFiltersOpen ? (
              <div
                className="floating-backdrop filter-backdrop"
                data-debug-id="library-filter-backdrop"
                onPointerDown={(event) => {
                  logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterBackdrop.onPointerDown", event);
                }}
                onClick={(event) => {
                  logNestedTagDebug(nestedTagDebugEnabled, "library-filter", "LibraryFilterBackdrop.onClick", event);
                  setWardrobeFiltersOpen(false);
                }}
              />
            ) : null}

            {wardrobeAddOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={closeWardrobeAdd} />
            ) : null}

            <div className={`wardrobe-add-window ${wardrobeAddOpen ? "is-open" : ""}`} aria-label="Add references">
              <button type="button" className="ghost-button filter-close-button" onClick={closeWardrobeAdd}>
                Close
              </button>
              <div className="wardrobe-modal-header">
                <p className="eyebrow">Library</p>
                <h2>Add</h2>
                <p>Import one or more images directly into the library.</p>
              </div>
              <div
                className={`item-image-upload wardrobe-add-upload ${itemImageDragActive ? "is-drag-active" : ""}`}
                onDragEnter={handleItemImageDragEnter}
                onDragOver={handleItemImageDragOver}
                onDragLeave={handleItemImageDragLeave}
                onDrop={handleItemImageDrop}
              >
                <div className="item-image-preview wardrobe-add-preview">
                  <span>Drop images here</span>
                </div>
                <div className="wardrobe-add-upload-main">
                  <div className="item-image-actions wardrobe-add-actions">
                    <label className="upload-button">
                      {itemImporting ? "Importing..." : "Import image"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleItemImageUpload}
                        disabled={imageProcessing || itemImporting}
                      />
                    </label>
                  </div>
                  <p className="item-image-note">
                    Drag and drop images here or use Import image. Imported references are saved in this browser and included in backup JSON.
                  </p>
                  {imageUploadError ? <p className="form-success wardrobe-add-feedback">{imageUploadError}</p> : null}
                </div>
              </div>
            </div>

            {wardrobeManageOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={() => setWardrobeManageOpen(false)} />
            ) : null}

            <div
              className={`wardrobe-manage-window ${wardrobeManageOpen ? "is-open" : ""}`}
              aria-label="Library management"
              data-debug-id="manage-tags-window"
              onPointerDownCapture={(event) => {
                logNestedTagDebug(nestedTagDebugEnabled, "manage-tags", "ManageWindow.onPointerDownCapture", event);
              }}
              onClickCapture={(event) => {
                logNestedTagDebug(nestedTagDebugEnabled, "manage-tags", "ManageWindow.onClickCapture", event);
              }}
              onFocusCapture={(event) => {
                logNestedTagDebug(nestedTagDebugEnabled, "manage-tags", "ManageWindow.onFocusCapture", event);
              }}
            >
              <button type="button" className="ghost-button filter-close-button" onClick={() => setWardrobeManageOpen(false)}>
                Close
              </button>
              <div className={`tag-manager-panel wardrobe-manage-stats ${manageStatsOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className={`ghost-button tag-manager-toggle ${manageStatsOpen ? "is-active" : ""}`}
                  onClick={() => setManageStatsOpen((current) => !current)}
                  aria-expanded={manageStatsOpen}
                >
                  Library stats
                </button>

                {manageStatsOpen ? (
                  <section className="wardrobe-manage-section" aria-label="Library stats">
                    <div className="wardrobe-worth-summary">
                      <h2>{libraryStats.totalImages} images</h2>
                      <span>
                        {libraryStats.visibleImages} visible · {libraryStats.selectedImages} selected · {libraryStats.favoriteImages} favorites
                      </span>
                    </div>

                    <div className="worth-chart worth-chart-stats">
                      <div className="worth-row">
                        <div className="worth-row-header">
                          <strong>Visible tags</strong>
                          <span>{libraryStats.totalTags}</span>
                        </div>
                      </div>
                      {libraryStats.topTags.length ? (
                        <div className="worth-row">
                          <div className="worth-row-header">
                            <strong>Top tags</strong>
                            <span>Most used in current view</span>
                          </div>
                          <div className="active-filter-chips">
                            {libraryStats.topTags.map(({ tag, count }) => (
                              <button
                                key={tag}
                                type="button"
                                className={`tag-filter-option ${wardrobeFilters.tags.includes(tag) ? "is-active" : ""}`}
                                onClick={() => toggleLibraryTagFilter(tag)}
                                aria-pressed={wardrobeFilters.tags.includes(tag)}
                              >
                                <span>{tag}</span>
                                <small>{count}</small>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
              <button type="button" className="ghost-button" onClick={handleExportWardrobeImage}>
                Export library image
              </button>
              <button type="button" className="ghost-button" onClick={handleExportBackup}>
                Export backup
              </button>
              <button type="button" className="ghost-button" onClick={() => importBackupRef.current?.click()}>
                Import backup
              </button>
              {backupExportFeedback ? <p className="form-success tag-manager-feedback">{backupExportFeedback}</p> : null}
              <div className={`tag-manager-panel ${manageTagsOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className={`ghost-button tag-manager-toggle ${manageTagsOpen ? "is-active" : ""}`}
                  onClick={() => setManageTagsOpen((current) => !current)}
                  aria-expanded={manageTagsOpen}
                >
                  Manage tags
                </button>

                {manageTagsOpen ? (
                  <div className="tag-manager-body">
                    <div className="tag-manager-toolbar">
                      <label className="tag-manager-search">
                        <span className="sr-only">Search tags</span>
                        <input
                          type="search"
                          value={tagManagerSearch}
                          onChange={(event) => setTagManagerSearch(event.target.value)}
                          placeholder="Search tags"
                          aria-label="Search tags"
                        />
                      </label>
                      <span className="tag-manager-count">
                        {tagManagerEntries.length} {tagManagerEntries.length === 1 ? "tag" : "tags"}
                      </span>
                    </div>

                    {tagManagerFeedback ? <p className="form-success tag-manager-feedback">{tagManagerFeedback}</p> : null}

                    {tagManagerEntries.length ? (
                      <div className="tag-manager-list">
                        {tagManagerTree.childNodes.map((node) => renderTagManagerNode(node))}
                      </div>
                    ) : (
                      <p className="tag-manager-empty">No tags match this search.</p>
                    )}
                    <datalist id="tag-manager-targets">
                      {allLibraryTagEntries.map(({ tag }) => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                  </div>
                ) : null}
              </div>
              <button type="button" className="ghost-button danger" onClick={handleResetToDefault}>
                Reset to default
              </button>
            </div>

            <input
              ref={importBackupRef}
              type="file"
              accept="application/json,.json"
              className="backup-file-input"
              onChange={handleImportBackup}
            />

            <div className={`wardrobe-panel-body ${isSideEditorOpen ? "has-side-editor" : ""}`}>
              <div ref={wardrobePanelScrollRef} className="wardrobe-panel-scroll">
                {wardrobeSavedOpen ? (
                  renderSavedOutfitsContent()
                ) : (
                  renderWardrobeGrid()
                )}
              </div>

              <aside
                ref={editorRef}
                className={`panel side-editor ${isSideEditorOpen ? "is-open" : ""} ${isMobileViewport ? "is-mobile-fullscreen" : ""}`}
              >
                <div className="panel-header side-editor-header">
                  <div>
                    <p className="eyebrow">Reference editor</p>
                    <h2>{editorTitle}</h2>
                  </div>
                  {(editingId || isBulkSelectionEditing) ? (
                    <button type="button" className="ghost-button" onClick={cancelEdit}>
                      Close
                    </button>
                  ) : null}
                </div>

                {editorBody}
              </aside>
            </div>
          </div>
        </div>
        ) : null}

        </div>
        </div>
        ) : null}

        {(isBulkSelectionEditing && editorReturnTarget === "outfit") || (editingId && editorReturnTarget === "outfit") ? (
          <aside className={`panel floating-item-editor ${isMobileViewport ? "is-mobile-fullscreen" : ""}`}>
            <div className="panel-header side-editor-header">
              <div>
                <p className="eyebrow">Reference editor</p>
                <h2>{editorTitle}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={cancelEdit}>
                Close
              </button>
            </div>

            {editorBody}
          </aside>
        ) : null}

        {confirmation ? (
          <div className="floating-backdrop confirm-backdrop" onClick={confirmation.onCancel}>
            <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
              <div>
                <p className="eyebrow">Confirm</p>
                <h2>{confirmation.title}</h2>
              </div>
              <p>{confirmation.message}</p>
              <div className="confirm-actions">
                <button type="button" className="ghost-button" onClick={confirmation.onCancel}>
                  Cancel
                </button>
                <button type="button" className="primary-button" onClick={confirmation.onConfirm}>
                  {confirmation.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {fitpicPreview ? (
          <div className="floating-backdrop fitpic-preview-backdrop" onClick={() => setFitpicPreview(null)}>
            <div className="fitpic-preview-overlay" onClick={(event) => event.stopPropagation()}>
              <img className="fitpic-preview-image" src={fitpicPreview.imageData} alt={fitpicPreview.name} />
            </div>
          </div>
        ) : null}

        {referencePreview ? (
          <div className="floating-backdrop fitpic-preview-backdrop" onClick={() => setReferencePreview(null)}>
            <div className="fitpic-preview-overlay reference-preview-overlay" onClick={(event) => event.stopPropagation()}>
              <div className="fitpic-preview-header">
                <div className="reference-preview-title">
                  <strong>{buildDisplayName(referencePreview)}</strong>
                  {!referencePreview.originalPreserved ? <span className="image-preservation-note">Original not preserved</span> : null}
                </div>
                <button type="button" className="ghost-button" onClick={() => setReferencePreview(null)}>
                  Close
                </button>
              </div>
              <div className="reference-preview-stage">
                <ManagedItemImage
                  item={referencePreview}
                  alt={buildDisplayName(referencePreview)}
                  dataItemId={referencePreview.id}
                  variant="original"
                  useCrop
                  usePresentation
                />
              </div>
            </div>
          </div>
        ) : null}

        {nestedTagDebugEnabled ? (
          <aside
            className="nested-tag-debug-console"
            data-debug-id="nested-tag-debug-console"
            aria-label="Nested tag debug console"
          >
            <strong>Nested tag debug</strong>
            <div className="nested-tag-debug-console-log">
              {nestedTagDebugLogs.map((entry, index) => (
                <div key={`${index}-${entry}`}>{entry}</div>
              ))}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
