import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BACKUP_EXPORT_WARN_BYTES,
  BACKUP_IMPORT_HARD_MAX_BYTES,
  BACKUP_IMPORT_MAX_BYTES,
  createMetadataOnlyBackupData,
  createLightweightBackupData,
  getDefaultData,
  loadLatestMetadataSnapshotInfo,
  markFullBackupExported,
  markMetadataChanged,
  prepareBackupImport,
  prepareBackupPackageImportFromDirectory,
  requestMetadataSnapshot,
  replaceWithPreparedBackupPackage,
  replaceWithPreparedBackup,
  resetToDefaults
} from "./repositories/backupRepository";
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
  resolveBoardLayoutViewportClass,
  rerollBoardImage,
  summarizeGuidedDebugPayload,
  visibleSlots
} from "./lib/generation";
import {
  getReferenceImportMessage,
  importReferenceFiles
} from "./lib/referenceImport";
import {
  getEffectiveReferencePreviewSource,
  hasEffectiveReferencePreviewSource
} from "./lib/referenceEditor.js";
import { shouldShowLibraryCardTitle } from "./lib/libraryCards.js";
import {
  applyPreviewImageFields,
  createImageAsset,
  getOriginalImageSrc,
  mergeItemImageState,
  getPreviewImageAsset,
  getPreviewImageSrc,
  getThumbnailImageSrc,
  normalizeItemImages,
  replaceItemImageSet,
  replaceItemOriginalImage
} from "./lib/itemImages";
import { normalizeItemSourceIdentity } from "./lib/itemIdentity";
import { ensureBoardUuid, ensureSavedBoardUuid } from "./lib/boardIdentity.js";
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
import { getFittedBoardViewForViewport } from "./lib/boardView.js";
import {
  exportBackupPackageToDirectory,
  isFileSystemAccessSupported
} from "./lib/backupPackage.js";
import { getBackupExportMaterializationPlan } from "./lib/backupExportPolicy.js";
import {
  applySavedLibraryView,
  applySavedLibraryViewToMetadataFilters,
  createSavedLibraryViewSnapshot,
  deleteSavedLibraryView,
  markBackupExported,
  markBackupImported,
  markLibraryEdited,
  normalizeLocalSafetyState,
  normalizeLibraryProvenance,
  doesSavedLibraryViewMatchMetadataState,
  doesSavedLibraryViewMatchState,
  normalizeSavedLibraryViews,
  normalizeLibrarySearch,
  normalizeLibraryUiState,
  normalizeMetadataFilterState,
  normalizeWardrobeFilterState,
  normalizeWardrobeSort,
  renameSavedLibraryView,
  upsertSavedLibraryView
} from "./lib/appStateModel.js";
import { sortLibraryItems } from "./lib/librarySort.js";
import {
  getReferencePreviewCenteredScrollPosition,
  getReferencePreviewClickFocus,
  getReferencePreviewNavigation,
  getReferencePreviewSwipeDirection
} from "./lib/referencePreview.js";
import {
  loadStoredTagTreeCollapsedGroups,
  saveStoredTagTreeCollapsedGroups
} from "./lib/tagTreeState.js";
import {
  pruneBoardForDeletedReferences,
  pruneOutfitForDeletedReferences,
  pruneSavedOutfitsForDeletedReferences
} from "./lib/deleteStatePruning.js";
import { getVirtualizedGridLayout } from "./lib/libraryVirtualization.js";
import {
  DEFAULT_LIBRARY_ADD_WIDTH,
  DEFAULT_SIDE_EDITOR_WIDTH,
  getMaxSideEditorWidth,
  normalizePanelLayoutState
} from "./lib/panelLayoutState.js";
import {
  replaceBoardImagePreservingLayout,
  replaceBoardImageReferencePreservingLayout
} from "./lib/boardLayoutState.js";
import {
  normalizeBoard,
  normalizeSavedOutfit,
  hydrateSavedBoards,
  resolveBoardFromAppState,
  savedOutfitHasMissingItems
} from "./repositories/boardsRepository.js";
import {
  deleteItem,
  deleteItems,
  loadItemMediaAssetById,
  loadStartupItemMetadata,
  prepareLoadedItems,
  resolveItemMediaSource,
  runMediaIntegrityCheck,
  saveItem,
  saveItems
} from "./repositories/itemsRepository.js";
import { loadStartupAppState, saveAppState } from "./repositories/appStateRepository.js";
import { backfillLocalSyncMetadata } from "./repositories/syncRepository.js";

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

function formatMediaIntegritySample(sample) {
  const itemId = typeof sample?.id === "string" ? sample.id.trim() : "";
  const name = typeof sample?.name === "string" ? sample.name.trim() : "";

  if (itemId && name) {
    return `${itemId}: ${name}`;
  }

  if (itemId) {
    return itemId;
  }

  if (typeof sample?.itemId === "string" && sample.itemId.trim()) {
    const variant = typeof sample?.variant === "string" && sample.variant.trim() ? ` (${sample.variant.trim()})` : "";
    return `${sample.itemId.trim()}${variant}`;
  }

  if (typeof sample?.itemUuid === "string" && sample.itemUuid.trim()) {
    return sample.itemUuid.trim();
  }

  if (typeof sample?.compositeKey === "string" && sample.compositeKey.trim()) {
    return sample.compositeKey.trim();
  }

  return "";
}

function formatErrorMessage(error, fallback = "Unknown error.") {
  const normalizedMessage = typeof error?.message === "string" ? error.message.trim() : "";
  return normalizedMessage || fallback;
}

function getFileSystemAccessDebugSnapshot(target = globalThis) {
  const supportTarget = target && typeof target === "object" ? target : {};

  return {
    isSupported: isFileSystemAccessSupported(supportTarget),
    hasShowDirectoryPicker: typeof supportTarget.showDirectoryPicker === "function",
    isSecureContext: typeof supportTarget.isSecureContext === "boolean" ? supportTarget.isSecureContext : false,
    userAgent: typeof supportTarget.navigator?.userAgent === "string" ? supportTarget.navigator.userAgent : ""
  };
}

function formatAppBuildLabel(version = APP_BUILD_VERSION, buildTime = APP_BUILD_TIME) {
  const trimmedVersion = typeof version === "string" ? version.trim() : "";
  const trimmedBuildTime = typeof buildTime === "string" ? buildTime.trim() : "";

  if (trimmedVersion && trimmedBuildTime) {
    return `v${trimmedVersion} (${trimmedBuildTime})`;
  }

  if (trimmedVersion) {
    return `v${trimmedVersion}`;
  }

  return "Unknown";
}
const imageUrlByFilename = Object.fromEntries(
  imageAssetEntries.map((image) => [image.filename, image.imageUrl])
);
const APP_BUILD_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
const APP_BUILD_TIME = typeof __APP_BUILD_TIME__ === "string" ? __APP_BUILD_TIME__ : "";
const imageMetricsCache = new Map();
const BOARD_ZOOM_MIN = 0.1;
const BOARD_ZOOM_MAX = 6;
const GENERATE_PERF_DEBUG_FLAG = "debug:generate-perf";
const LIBRARY_PERF_DEBUG_FLAG = "debug:library-perf";
const LIBRARY_GRID_MIN_COLUMN_WIDTH = 164;
const LIBRARY_GRID_GAP = 12;
const LIBRARY_GRID_ESTIMATED_ROW_HEIGHT = 222;
const MOBILE_LIBRARY_GRID_COLUMNS = 3;
const MOBILE_LIBRARY_GRID_GAP = 3;
const MOBILE_LIBRARY_GRID_FALLBACK_VIEWPORT_WIDTH = 390;
const MOBILE_LIBRARY_GRID_TILE_RATIO = 0.9;
const LIBRARY_GRID_OVERSCAN_ROWS = 2;
const LIBRARY_VIRTUALIZATION_THRESHOLD = 120;
const BOARD_PICKER_GRID_COLUMNS = 3;
const BOARD_PICKER_GRID_GAP = 8;
const BOARD_PICKER_ESTIMATED_ROW_HEIGHT = 126;
const BOARD_PICKER_OVERSCAN_ROWS = 2;
const GUIDED_BOARD_CANDIDATE_DEBUG_FLAG = "debug:guided-board-candidates";
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

function getLibraryGridLayoutConfig({ viewportWidth, isMobileViewport }) {
  if (!isMobileViewport) {
    return {
      minColumnWidth: LIBRARY_GRID_MIN_COLUMN_WIDTH,
      gap: LIBRARY_GRID_GAP,
      estimatedRowHeight: LIBRARY_GRID_ESTIMATED_ROW_HEIGHT
    };
  }

  const availableWidth = Math.max(
    Number(viewportWidth) || MOBILE_LIBRARY_GRID_FALLBACK_VIEWPORT_WIDTH,
    MOBILE_LIBRARY_GRID_COLUMNS * 88
  );
  const minColumnWidth = Math.max(
    88,
    Math.floor((availableWidth - MOBILE_LIBRARY_GRID_GAP * (MOBILE_LIBRARY_GRID_COLUMNS - 1)) / MOBILE_LIBRARY_GRID_COLUMNS)
  );

  return {
    minColumnWidth,
    gap: MOBILE_LIBRARY_GRID_GAP,
    estimatedRowHeight: Math.max(112, Math.round(minColumnWidth / MOBILE_LIBRARY_GRID_TILE_RATIO) + 4)
  };
}

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

function isGuidedBoardCandidateDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("debugGuidedBoardCandidates") === "1") {
      return true;
    }

    return window.localStorage.getItem(GUIDED_BOARD_CANDIDATE_DEBUG_FLAG) === "1";
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

function getFilterDirectionSummary(filters) {
  return uniqueTags(filters?.tags).slice(0, 3);
}

function sortGuidedDebugPayloadForBoard(entries, boardImages) {
  const indexedBoardImages = (Array.isArray(boardImages) ? boardImages : []).map((image, index) => ({
    image,
    index
  }));

  return (Array.isArray(entries) ? entries : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => {
      const leftIndex = indexedBoardImages.findIndex(({ image, index }) =>
        (left.imageId && image.id === left.imageId) ||
        (Number.isInteger(left.imageIndex) && index === left.imageIndex) ||
        (image.referenceId === left.itemId && image.generationSlot === left.slot)
      );
      const rightIndex = indexedBoardImages.findIndex(({ image, index }) =>
        (right.imageId && image.id === right.imageId) ||
        (Number.isInteger(right.imageIndex) && index === right.imageIndex) ||
        (image.referenceId === right.itemId && image.generationSlot === right.slot)
      );

      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    })
    .map((entry, index) => ({
      ...entry,
      imageId: indexedBoardImages[index]?.image?.id ?? entry.imageId ?? "",
      imageIndex: indexedBoardImages[index]?.index ?? entry.imageIndex ?? index
    }));
}

function mergeGuidedDebugEntryIntoPayload(currentPayload, guidedDebugEntry, boardImages) {
  if (!guidedDebugEntry) {
    return currentPayload;
  }

  const nextPayload = Array.isArray(currentPayload) ? currentPayload.slice() : [];
  const replacementIndex = nextPayload.findIndex((entry) =>
    (guidedDebugEntry.imageId && entry.imageId === guidedDebugEntry.imageId) ||
    (Number.isInteger(guidedDebugEntry.imageIndex) && entry.imageIndex === guidedDebugEntry.imageIndex)
  );
  const fallbackIndex = replacementIndex === -1
    ? nextPayload.findIndex((entry) => entry.slot === guidedDebugEntry.slot)
    : replacementIndex;

  if (fallbackIndex >= 0) {
    nextPayload[fallbackIndex] = guidedDebugEntry;
  } else {
    nextPayload.push(guidedDebugEntry);
  }

  return sortGuidedDebugPayloadForBoard(nextPayload, boardImages);
}

function getGuidedDebugEntryKey(entry, fallback = "debug-entry") {
  if (entry?.imageId) {
    return entry.imageId;
  }

  if (Number.isInteger(entry?.imageIndex)) {
    return `board-image-${entry.imageIndex}`;
  }

  if (entry?.itemId) {
    return `${fallback}-${entry.itemId}`;
  }

  return fallback;
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

function readLibraryGridViewport(scrollElement, gridElement) {
  const nextWidth = Math.max(scrollElement.clientWidth - 4, 0);
  const nextHeight = scrollElement.clientHeight;
  const nextScrollTop = scrollElement.scrollTop;
  const scrollBounds = scrollElement.getBoundingClientRect();
  const gridBounds = gridElement.getBoundingClientRect();
  const nextGridOffsetTop = Math.max(0, gridBounds.top - scrollBounds.top + nextScrollTop);

  return {
    width: nextWidth,
    height: nextHeight,
    scrollTop: nextScrollTop,
    gridOffsetTop: nextGridOffsetTop
  };
}

function areLibraryGridViewportsEqual(left, right) {
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.scrollTop === right.scrollTop &&
    left.gridOffsetTop === right.gridOffsetTop
  );
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

function formatLibraryProvenanceValue(value) {
  return formatCreatedAt(value) || "Never";
}

function formatBackupSchemaLabel(provenance) {
  const source = typeof provenance?.lastImportedBackupSource === "string" ? provenance.lastImportedBackupSource.trim() : "";
  const version = typeof provenance?.lastImportedBackupSchemaVersion === "string" ? provenance.lastImportedBackupSchemaVersion.trim() : "";

  if (source && version) {
    return `${source} v${version}`;
  }

  if (version) {
    return `v${version}`;
  }

  return "";
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

  if (normalizedBytes < 1024 * 1024 * 1024) {
    return `${(normalizedBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(normalizedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

function getViewportWidth() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.innerWidth;
}

function getViewportHeight() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.innerHeight;
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

function getTouchDistance(touches) {
  if (!touches || touches.length < 2) {
    return 0;
  }

  const deltaX = touches[0].clientX - touches[1].clientX;
  const deltaY = touches[0].clientY - touches[1].clientY;
  return Math.hypot(deltaX, deltaY);
}

function getTouchMidpoint(touches) {
  if (!touches || touches.length < 2) {
    return null;
  }

  return {
    clientX: (touches[0].clientX + touches[1].clientX) / 2,
    clientY: (touches[0].clientY + touches[1].clientY) / 2
  };
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
  const resolvedMedia = await resolveItemMediaSource(item, "preview");
  const imageUrl = resolvedMedia?.src?.trim?.() ?? resolvedMedia?.src ?? item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "";
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

function getResolvedImageMetrics(item, resolvedMedia = null) {
  const resolvedWidth = Math.max(Number(resolvedMedia?.width) || 0, 0);
  const resolvedHeight = Math.max(Number(resolvedMedia?.height) || 0, 0);

  if (resolvedWidth && resolvedHeight) {
    return {
      naturalWidth: resolvedWidth,
      naturalHeight: resolvedHeight
    };
  }

  return getStoredImageMetrics(item);
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

function useDeferredItemMedia(item, variant = "preview") {
  const immediateSrc = getManagedItemImageSrc(item, variant);
  const [resolvedMedia, setResolvedMedia] = useState(() => ({
    src: immediateSrc,
    width: 0,
    height: 0
  }));

  useEffect(() => {
    if (immediateSrc) {
      setResolvedMedia({
        src: immediateSrc,
        width: 0,
        height: 0
      });
      return undefined;
    }

    if (!item?.id) {
      setResolvedMedia({
        src: "",
        width: 0,
        height: 0
      });
      return undefined;
    }

    let cancelled = false;
    let objectUrl = "";

    async function resolveMedia() {
      try {
        const asset = await loadItemMediaAssetById(item.id, variant);

        if (cancelled) {
          return;
        }

        let nextSrc = asset?.src ?? "";

        if (!nextSrc && asset?.blob instanceof Blob && typeof URL?.createObjectURL === "function") {
          objectUrl = URL.createObjectURL(asset.blob);
          nextSrc = objectUrl;
        }

        setResolvedMedia({
          src: nextSrc,
          width: Math.max(Number(asset?.width) || 0, 0),
          height: Math.max(Number(asset?.height) || 0, 0)
        });
      } catch {
        if (!cancelled) {
          setResolvedMedia({
            src: "",
            width: 0,
            height: 0
          });
        }
      }
    }

    void resolveMedia();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [immediateSrc, item?.id, variant]);

  return resolvedMedia;
}

function useResolvedItemMediaSource(item, variant = "preview", preferDataUrl = false) {
  const [resolvedMedia, setResolvedMedia] = useState(() => ({
    src: "",
    blob: null,
    width: 0,
    height: 0,
    fileSize: 0,
    mimeType: "",
    originalFilename: ""
  }));

  useEffect(() => {
    const synchronousSrc = getManagedItemImageSrc(item, variant);

    if (!item?.id && !synchronousSrc) {
      setResolvedMedia({
        src: "",
        blob: null,
        width: 0,
        height: 0,
        fileSize: 0,
        mimeType: "",
        originalFilename: ""
      });
      return undefined;
    }

    let cancelled = false;
    let revoke = null;

    async function resolveMedia() {
      try {
        const media = await resolveItemMediaSource(item, variant, { preferDataUrl });

        if (cancelled) {
          media?.revoke?.();
          return;
        }

        revoke = media?.revoke ?? null;
        setResolvedMedia({
          src: media?.src ?? "",
          blob: media?.blob ?? null,
          width: Math.max(Number(media?.width) || 0, 0),
          height: Math.max(Number(media?.height) || 0, 0),
          fileSize: Math.max(Number(media?.fileSize) || 0, 0),
          mimeType: media?.mimeType ?? "",
          originalFilename: media?.originalFilename ?? ""
        });
      } catch {
        if (!cancelled) {
          setResolvedMedia({
            src: "",
            blob: null,
            width: 0,
            height: 0,
            fileSize: 0,
            mimeType: "",
            originalFilename: ""
          });
        }
      }
    }

    void resolveMedia();

    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [item, item?.id, preferDataUrl, variant]);

  return resolvedMedia;
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
  const deferredMedia = useDeferredItemMedia(item, variant);
  const resolvedImageUrl = resolveImageUrl(deferredMedia.src);
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
  isEditing,
  isPickerOpen,
  onImagePointerDown,
  onImageDoubleClick,
  onEditImage,
  onCloseEdit,
  onSelectImage,
  onCloseSelect,
  onMetrics
}) {
  const deferredMedia = useDeferredItemMedia(item, "preview");
  const resolvedImageUrl = resolveImageUrl(deferredMedia.src);
  const seedMetrics = useMemo(() => getResolvedImageMetrics(item, deferredMedia), [deferredMedia, item]);
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
        onMouseDown={preventMouseButtonFocus}
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
          onMouseDown={preventMouseButtonFocus}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (isEditing) {
              onCloseEdit();
              return;
            }

            onEditImage(item);
          }}
          aria-label={`Edit ${buildDisplayName(item)}`}
        >
          Edit
        </button>
        <button
          type="button"
          className="board-image-picker-button"
          onMouseDown={preventMouseButtonFocus}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (isPickerOpen) {
              onCloseSelect();
              return;
            }

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
  prevProps.isActive === nextProps.isActive &&
  prevProps.isEditing === nextProps.isEditing &&
  prevProps.isPickerOpen === nextProps.isPickerOpen
);

function preventMouseButtonFocus(event) {
  if (event?.detail !== 0) {
    event.preventDefault();
  }
}

function getLibraryCardPresentation(item) {
  const fallbackAspectRatio =
    Number(item?.imageWidth) > 0 && Number(item?.imageHeight) > 0
      ? Number(item.imageWidth) / Number(item.imageHeight)
      : 1;
  const aspectRatio = Math.max(0.45, Math.min(2.2, Number(item?.aspectRatio) || fallbackAspectRatio || 1));
  const normalizedOrientation =
    item?.orientation === "landscape" || aspectRatio > 1.08
      ? "landscape"
      : item?.orientation === "square" || Math.abs(aspectRatio - 1) < 0.08
        ? "square"
        : "portrait";

  if (normalizedOrientation === "landscape") {
    const isWideLandscape = aspectRatio > 1.45;

    return {
      orientationClass: isWideLandscape ? "is-landscape is-wide" : "is-landscape",
      style: {
        "--library-card-min-height": isWideLandscape ? "196px" : "202px",
        "--library-preview-height": isWideLandscape ? "116px" : "126px",
        "--library-preview-padding": isWideLandscape ? "4px 6px" : "5px 7px 6px",
        "--library-preview-align": "center",
        "--library-image-width-base": isWideLandscape ? "182px" : "166px",
        "--library-image-max-height": isWideLandscape ? "112px" : "122px",
        "--library-mobile-tile-ratio": isWideLandscape ? "1.28" : "1.12"
      }
    };
  }

  if (normalizedOrientation === "square") {
    return {
      orientationClass: "is-square",
      style: {
        "--library-card-min-height": "206px",
        "--library-preview-height": "142px",
        "--library-preview-padding": "5px",
        "--library-preview-align": "center",
        "--library-image-width-base": "150px",
        "--library-image-max-height": "136px",
        "--library-mobile-tile-ratio": "1"
      }
    };
  }

  const isTallPortrait = aspectRatio < 0.72;

  return {
    orientationClass: isTallPortrait ? "is-portrait is-tall" : "is-portrait",
    style: {
      "--library-card-min-height": isTallPortrait ? "220px" : "212px",
      "--library-preview-height": isTallPortrait ? "160px" : "152px",
      "--library-preview-padding": isTallPortrait ? "6px" : "6px",
      "--library-preview-align": "end",
      "--library-image-width-base": isTallPortrait ? "138px" : "142px",
      "--library-image-max-height": isTallPortrait ? "148px" : "140px",
      "--library-mobile-tile-ratio": isTallPortrait ? "0.78" : "0.88"
    }
  };
}

const LibraryGridCard = memo(function LibraryGridCard({
  item,
  isSelected,
  isExcluded,
  isMobileViewport,
  isMobileSelectMode,
  cardStyle = null,
  onSelectReference,
  onOpenReferencePreview,
  onVisibleImageMount
}) {
  const itemName = useMemo(() => buildDisplayName(item), [item]);
  const showTitle = useMemo(() => shouldShowLibraryCardTitle(item), [item]);
  const itemTagsLabel = useMemo(() => {
    const normalizedTags = uniqueTags(item.tags);
    if (!normalizedTags.length) {
      return "No tags";
    }

    const displayTags = normalizedTags.slice(0, 4).map((tag) => getLeafTagLabel(tag));
    return normalizedTags.length > 4 ? `${displayTags.join(" · ")} · …` : displayTags.join(" · ");
  }, [item]);
  const presentation = useMemo(() => getLibraryCardPresentation(item), [item]);
  const mergedCardStyle = useMemo(
    () => ({
      ...(cardStyle ?? {}),
      ...(presentation.style ?? {})
    }),
    [cardStyle, presentation.style]
  );

  useEffect(() => {
    onVisibleImageMount?.();
  }, [onVisibleImageMount]);

  return (
    <article
      className={`wardrobe-card ${presentation.orientationClass} ${isExcluded ? "is-excluded" : ""} ${isSelected ? "is-selected" : ""} ${isMobileViewport ? "is-mobile-card" : ""} ${isMobileViewport && isMobileSelectMode ? "is-mobile-select-mode" : ""}`}
      style={mergedCardStyle}
    >
      {isExcluded || (isMobileViewport && isSelected) ? (
        <div className={`wardrobe-card-badges ${isMobileViewport ? "is-mobile-tile-badges" : ""}`} aria-label="Reference status">
          {isMobileViewport && isSelected ? (
            <span className="wardrobe-mobile-selection-badge" aria-hidden="true">✓</span>
          ) : null}
          {isExcluded ? (
            <span className={`wardrobe-status-dot ${isMobileViewport ? "is-mobile-tile-dot" : ""}`} aria-hidden="true" />
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className={`wardrobe-preview ${isMobileViewport ? "is-mobile-preview-card" : ""}`}
        onMouseDown={preventMouseButtonFocus}
        onClick={(event) => {
          if (isMobileViewport && !isMobileSelectMode) {
            if (event.currentTarget instanceof HTMLElement) {
              event.currentTarget.blur();
            }

            onOpenReferencePreview(item);
            return;
          }

          onSelectReference(item.id, event);
        }}
        onDoubleClick={(event) => {
          if (isMobileViewport) {
            return;
          }

          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.blur();
          }

          onOpenReferencePreview(item);
        }}
        aria-pressed={isSelected}
        aria-label={isMobileViewport && !isMobileSelectMode ? `${itemName} preview` : `${itemName} select`}
      >
        <ManagedItemImage
          item={item}
          alt={item.name}
          className="wardrobe-preview-image"
          dataItemId={item.id}
          variant="thumbnail"
          useFrameScale
          normalizeToFrameScale
          useCrop
          usePresentation
          loadingStrategy="eager"
          decodingStrategy="sync"
        />
      </button>

      <div className={`wardrobe-meta ${isMobileViewport ? "is-mobile-hidden" : ""}`}>
        {showTitle ? (
          <strong title={itemName}>
            <span>{itemName}</span>
            {item.favorite ? <span className="wardrobe-meta-favorite" aria-label="Favorite">♥</span> : null}
          </strong>
        ) : null}
        <span title={itemTagsLabel}>{itemTagsLabel}</span>
      </div>
    </article>
  );
}, (prevProps, nextProps) =>
  prevProps.item === nextProps.item &&
  prevProps.isSelected === nextProps.isSelected &&
  prevProps.isExcluded === nextProps.isExcluded &&
  prevProps.isMobileViewport === nextProps.isMobileViewport &&
  prevProps.isMobileSelectMode === nextProps.isMobileSelectMode &&
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
  onToggle
}) {
  return (
    <button
      type="button"
      className={className}
      onPointerDown={stopNestedTagTreeEvent}
      onClick={(event) => {
        stopNestedTagTreeEvent(event);
        onToggle();
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
  searchQuery = ""
}) {
  const [sortMode, setSortMode] = useState(() => {
    if (typeof window === "undefined") {
      return "count";
    }

    const storedSortMode = window.localStorage.getItem(`tag-tree-sort:${storageKey}`);
    return storedSortMode === "alpha" ? "alpha" : "count";
  });
  const [collapsedGroups, setCollapsedGroups] = useState(() => loadStoredTagTreeCollapsedGroups(storageKey));

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
  const allGroupKeys = useMemo(() => {
    const keys = [];

    function collectGroupKeys(nodes) {
      nodes.forEach((node) => {
        if (!node.childNodes.length) {
          return;
        }

        keys.push(`${storageKey}:${node.key}`);
        collectGroupKeys(node.childNodes);
      });
    }

    collectGroupKeys(rootNode.childNodes);
    return keys;
  }, [rootNode.childNodes, storageKey]);
  const autoExpandedGroups = useMemo(() => {
    if (!searchQuery) {
      return new Set();
    }

    const expanded = new Set();

    sortedEntries.forEach(({ tag }) => {
      const parts = splitTagPath(tag);
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (index < parts.length - 1) {
          expanded.add(`${storageKey}:${currentPath}`);
        }
      });
    });

    return expanded;
  }, [searchQuery, sortedEntries, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(`tag-tree-sort:${storageKey}`, sortMode);
  }, [sortMode, storageKey]);

  useEffect(() => {
    setCollapsedGroups(loadStoredTagTreeCollapsedGroups(storageKey));
  }, [storageKey]);

  useEffect(() => {
    saveStoredTagTreeCollapsedGroups(storageKey, collapsedGroups);
  }, [collapsedGroups, storageKey]);

  function toggleCollapsedGroup(groupKey) {
    const collapsedKey = `${storageKey}:${groupKey}`;

    setCollapsedGroups((current) => ({
      ...current,
      [collapsedKey]: !(current[collapsedKey] ?? true)
    }));
  }

  function setAllGroupsExpanded(isExpanded) {
    setCollapsedGroups((current) => {
      const next = { ...current };

      allGroupKeys.forEach((groupKey) => {
        next[groupKey] = !isExpanded;
      });

      return next;
    });
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

  const areAllGroupsExpanded = allGroupKeys.length > 0 && allGroupKeys.every((groupKey) => {
    if (searchQuery) {
      return autoExpandedGroups.has(groupKey);
    }

    return !(collapsedGroups[groupKey] ?? true);
  });

  function renderTagNode(node, depth = 0) {
    const isSelected = normalizedSelectedTags.includes(node.path);
    const isExcluded = normalizedExcludedTags.includes(node.path);
    const collapsedKey = `${storageKey}:${node.key}`;
    const isCollapsed = searchQuery ? !autoExpandedGroups.has(collapsedKey) : (collapsedGroups[collapsedKey] ?? true);
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
          style={rowStyle}
          onClick={(event) => {
            stopNestedTagTreeEvent(event);
            activateTag(event, node.path);
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
        <div className={rowClassName} style={rowStyle}>
          <ExpandArrow
            className="tag-tree-chevron"
            isExpanded={!isCollapsed}
            label={label}
            onToggle={() => toggleCollapsedGroup(node.key)}
          />
          <button
            type="button"
            className="tag-tree-row-main tag-tree-row-main-button tag-tree-row-main-button-parent"
            onClick={(event) => {
              stopNestedTagTreeEvent(event);
              activateTagGroup(event, node.tagTargets);
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
          <div className="tag-tree-children">
            {node.childNodes.map((childNode) => renderTagNode(childNode, depth + 1))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className={`tag-tree ${variant === "compact" ? "is-compact" : ""}`.trim()}>
      {variant === "compact" ? (
        <div className="tag-tree-header tag-tree-header-compact">
          <div className="tag-tree-meta">
            <button
              type="button"
              className="tag-tree-sort-button tag-tree-sort-mode-button"
              onClick={(event) => {
                stopNestedTagTreeEvent(event);
                setSortMode((current) => (current === "count" ? "alpha" : "count"));
              }}
              aria-label={sortMode === "count" ? "Tag order: count" : "Tag order: A-Z"}
              title={sortMode === "count" ? "Tag order: count" : "Tag order: A-Z"}
            >
              <span aria-hidden="true">{sortMode === "count" ? "#" : "A"}</span>
            </button>
            {allGroupKeys.length ? (
              <button
                type="button"
                className="tag-tree-sort-button tag-tree-toggle-all-button"
                onClick={(event) => {
                  stopNestedTagTreeEvent(event);
                  setAllGroupsExpanded(!areAllGroupsExpanded);
                }}
                aria-label={areAllGroupsExpanded ? "Collapse all tag groups" : "Expand all tag groups"}
                title={areAllGroupsExpanded ? "Collapse all tag groups" : "Expand all tag groups"}
              >
                <span aria-hidden="true">{areAllGroupsExpanded ? "▾" : "▸"}</span>
              </button>
            ) : null}
            {headerActions}
          </div>
        </div>
      ) : (
        <div className="tag-tree-header tag-tree-header-default">
          <div className="tag-tree-meta">
            <button
              type="button"
              className="tag-tree-sort-button tag-tree-sort-mode-button"
              onClick={(event) => {
                stopNestedTagTreeEvent(event);
                setSortMode((current) => (current === "count" ? "alpha" : "count"));
              }}
              aria-label={sortMode === "count" ? "Tag order: count" : "Tag order: A-Z"}
              title={sortMode === "count" ? "Tag order: count" : "Tag order: A-Z"}
            >
              <span aria-hidden="true">{sortMode === "count" ? "#" : "A"}</span>
            </button>
            {allGroupKeys.length ? (
              <button
                type="button"
                className="tag-tree-sort-button tag-tree-toggle-all-button"
                onClick={(event) => {
                  stopNestedTagTreeEvent(event);
                  setAllGroupsExpanded(!areAllGroupsExpanded);
                }}
                aria-label={areAllGroupsExpanded ? "Collapse all tag groups" : "Expand all tag groups"}
                title={areAllGroupsExpanded ? "Collapse all tag groups" : "Expand all tag groups"}
                >
                <span aria-hidden="true">{areAllGroupsExpanded ? "▾" : "▸"}</span>
              </button>
            ) : null}
            {headerActions}
          </div>
        </div>
      )}

      <div className="tag-tree-list" aria-label="Tag filters">
        {noTagsCount ? (
          <button
            type="button"
            className={`tag-tree-row tag-tree-row-leaf tag-tree-row-untagged ${noTagsSelected ? "is-active" : ""} ${noTagsExcluded ? "is-excluded" : ""}`}
            onClick={(event) => {
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
      return value === "all" || value === "grouped";
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

function getReferenceSourceKey(item) {
  const sourceKeyCandidate = [
    item?.sourceRelativePath,
    item?.sourceOriginalFilename,
    item?.originalFilename,
    getImageStem(item?.imageUrl ?? ""),
    item?.name,
    item?.id
  ].find((value) => typeof value === "string" && value.trim());

  return typeof sourceKeyCandidate === "string" ? sourceKeyCandidate.trim().toLowerCase() : "";
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
    showTitleOnCard: Boolean(item.showTitleOnCard),
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

function getSavedOutfitPreviewSlots(savedOutfit) {
  return savedOutfit.layering
    ? ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"]
    : ["Headwear", "TopInner", "Bottom", "Footwear"];
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
    const resolvedMedia = await resolveItemMediaSource(item, "preview");
    const imageUrl = resolveImageUrl(resolvedMedia?.src || getManagedItemImageSrc(item, "preview"));

    if (!imageUrl) {
      return [getFallbackPaletteColor(item)];
    }

    const image = await loadImage(imageUrl);
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

function buildMetadataOnlyBackupExportData(items, appState) {
  return createMetadataOnlyBackupData(items, appState);
}

async function materializeItemsForBackupExport(items) {
  return Promise.all(
    (Array.isArray(items) ? items : []).map(async (item) => {
      const normalizedImages = normalizeItemImages(item);
      const materializationPlan = getBackupExportMaterializationPlan(item);
      const previewAsset = materializationPlan.needsPreview
        ? await loadItemMediaAssetById(item.id, "preview")
        : normalizedImages.preview;

      return {
        ...item,
        images: {
          original: createImageAsset(normalizedImages.original),
          preview: createImageAsset(previewAsset),
          thumbnail: createImageAsset(normalizedImages.thumbnail)
        }
      };
    })
  );
}

async function buildFullBackupExportData(items, appState) {
  return createLightweightBackupData(await materializeItemsForBackupExport(items), appState);
}

async function resolvePreviewAssetForBackupPackageExport(item) {
  const normalizedImages = normalizeItemImages(item);

  if (normalizedImages.preview?.src) {
    return normalizedImages.preview;
  }

  return loadItemMediaAssetById(item.id, "preview");
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

function isLikelyJsonBackupFile(file) {
  const fileType = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  const fileName = typeof file?.name === "string" ? file.name.toLowerCase() : "";

  return !fileType || fileType.includes("json") || fileName.endsWith(".json");
}

function buildSnapshotTrackedAppStateSignature(appState) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    return "{}";
  }

  const { provenance, localSafety, recentOutfits, ...rest } = appState;
  return JSON.stringify(rest);
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
  const boardPinchRef = useRef(null);
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
  const referencePreviewStageRef = useRef(null);
  const referencePreviewImageFrameRef = useRef(null);
  const mobileReferencePreviewTouchRef = useRef(null);
  const mobileReferencePreviewPinchRef = useRef(null);
  const mobileReferencePreviewDidPinchRef = useRef(false);
  const mobileReferencePreviewScaleRef = useRef(1);
  const saveAppStateTimeoutRef = useRef(null);
  const saveAppStateIdleCallbackRef = useRef(null);
  const currentPersistedAppStateRef = useRef(null);
  const previousSnapshotTrackedAppStateRef = useRef(null);
  const localSafetyRef = useRef(normalizeLocalSafetyState());
  const pendingAppStateSaveRef = useRef(null);
  const appStateSaveInFlightRef = useRef(false);
  const appStateSavePromiseRef = useRef(Promise.resolve());
  const importCommitInFlightRef = useRef(false);
  const pendingPersistenceReadyRef = useRef(false);
  const cropInteractionRef = useRef(null);
  const librarySelectionActionsRef = useRef(null);
  const wardrobeFiltersPanelRef = useRef(null);
  const wardrobeFiltersTriggerRef = useRef(null);
  const mobileFilterDismissClickSuppressionRef = useRef(false);
  const mobileFilterDismissClickSuppressionTimeoutRef = useRef(null);
  const suppressMobileLibraryCardInteractionUntilRef = useRef(0);
  const wardrobeViewsPopoverRef = useRef(null);
  const controlsViewsPopoverRef = useRef(null);
  const mobileLibraryMorePopoverRef = useRef(null);
  const wardrobeManagePopoverRef = useRef(null);
  const wardrobeAddPopoverRef = useRef(null);
  const sideEditorResizeCleanupRef = useRef(null);
  const bulkMetadataFeedbackTimeoutRef = useRef(null);
  const backupExportFeedbackTimeoutRef = useRef(null);
  const backupPackageExportProgressRef = useRef(null);
  const backupPackageImportProgressRef = useRef(null);
  const paletteCacheRef = useRef(new Map());
  const boardRenderLayoutSignatureRef = useRef("");
  const suppressNextBoardRelayoutRef = useRef(false);
  const pendingRestoredBoardFitRef = useRef(false);
  const lastInteractionWasPointerRef = useRef(false);
  const pointerActivatedControlRef = useRef(null);
  const excludedOutfitReconcileFrameRef = useRef(0);
  const latestExcludedStateRef = useRef({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [persistenceReady, setPersistenceReady] = useState(false);
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
  const [isReferencePreviewZoomed, setIsReferencePreviewZoomed] = useState(false);
  const [referencePreviewZoomFocus, setReferencePreviewZoomFocus] = useState(null);
  const [mobileReferencePreviewScale, setMobileReferencePreviewScale] = useState(1);
  const [mobileLibrarySelectMode, setMobileLibrarySelectMode] = useState(false);
  const [mobileLibraryMoreOpen, setMobileLibraryMoreOpen] = useState(false);
  const [mobileReferencePreviewChromeVisible, setMobileReferencePreviewChromeVisible] = useState(false);
  const [mobileReferencePreviewActionsOpen, setMobileReferencePreviewActionsOpen] = useState(false);
  const [mobileReferencePreviewInfoOpen, setMobileReferencePreviewInfoOpen] = useState(false);
  const [wardrobeFiltersOpen, setWardrobeFiltersOpen] = useState(false);
  const [wardrobeWorthOpen, setWardrobeWorthOpen] = useState(false);
  const [wardrobeSavedOpen, setWardrobeSavedOpen] = useState(false);
  const [wardrobeViewsOpen, setWardrobeViewsOpen] = useState(false);
  const [controlsViewsOpen, setControlsViewsOpen] = useState(false);
  const [wardrobeManageOpen, setWardrobeManageOpen] = useState(false);
  const [wardrobeAddOpen, setWardrobeAddOpen] = useState(false);
  const [savedLibraryViews, setSavedLibraryViews] = useState([]);
  const [provenance, setProvenance] = useState(() => normalizeLibraryProvenance());
  const [localSafety, setLocalSafety] = useState(() => normalizeLocalSafetyState());
  const [wardrobeFilterSearch, setWardrobeFilterSearch] = useState("");
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [backupExportFeedback, setBackupExportFeedback] = useState("");
  const [mediaIntegrityReport, setMediaIntegrityReport] = useState(null);
  const [mediaIntegrityError, setMediaIntegrityError] = useState("");
  const [isMediaIntegrityChecking, setIsMediaIntegrityChecking] = useState(false);
  const [isBackupPackageExporting, setIsBackupPackageExporting] = useState(false);
  const [backupPackageExportProgress, setBackupPackageExportProgress] = useState(null);
  const [isBackupPackageImporting, setIsBackupPackageImporting] = useState(false);
  const [backupPackageImportProgress, setBackupPackageImportProgress] = useState(null);
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
  const [freshImportSession, setFreshImportSession] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [itemImporting, setItemImporting] = useState(false);
  const [replaceOriginalShouldRegenerate, setReplaceOriginalShouldRegenerate] = useState(false);
  const [itemImageDragActive, setItemImageDragActive] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [selectedReferenceSelection, setSelectedReferenceSelection] = useState({
    ids: {},
    anchorId: null
  });
  const [bulkMetadataDraft, setBulkMetadataDraft] = useState({
    addTags: [],
    removeTags: [],
    favorite: ""
  });
  const [bulkMetadataFeedback, setBulkMetadataFeedback] = useState("");
  const [wardrobeFilters, setWardrobeFilters] = useState(emptyWardrobeFilters);
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySelectionActionsOpen, setLibrarySelectionActionsOpen] = useState(false);
  const [wardrobeSort, setWardrobeSort] = useState("newest");
  const [sideEditorWidth, setSideEditorWidth] = useState(DEFAULT_SIDE_EDITOR_WIDTH);
  const [libraryAddWidth, setLibraryAddWidth] = useState(DEFAULT_LIBRARY_ADD_WIDTH);
  const [libraryTagActionMode, setLibraryTagActionMode] = useState(null);
  const [outfitPalette, setOutfitPalette] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [boardView, setBoardView] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    latestExcludedStateRef.current = excluded;
  }, [excluded]);

  useEffect(() => {
    mobileReferencePreviewScaleRef.current = mobileReferencePreviewScale;
  }, [mobileReferencePreviewScale]);

  useEffect(() => () => {
    if (excludedOutfitReconcileFrameRef.current) {
      window.cancelAnimationFrame(excludedOutfitReconcileFrameRef.current);
    }
  }, []);

  useEffect(() => () => {
    sideEditorResizeCleanupRef.current?.();
  }, []);

  useEffect(() => () => {
    if (mobileFilterDismissClickSuppressionTimeoutRef.current) {
      window.clearTimeout(mobileFilterDismissClickSuppressionTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    function handleWindowResize() {
      const viewportWidth = getViewportWidth();

      setSideEditorWidth((current) => normalizePanelLayoutState({
        sideEditorWidth: current,
        libraryAddWidth
      }, viewportWidth).sideEditorWidth);
      setLibraryAddWidth((current) => normalizePanelLayoutState({
        sideEditorWidth,
        libraryAddWidth: current
      }, viewportWidth).libraryAddWidth);
    }

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [libraryAddWidth, sideEditorWidth]);
  const selectedReferenceIds = selectedReferenceSelection.ids;
  const [isBoardGenerating, setIsBoardGenerating] = useState(false);
  const [showBoardGenerationBusy, setShowBoardGenerationBusy] = useState(false);
  const [boardGenerationError, setBoardGenerationError] = useState("");
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
  const isGeneratePerfDebug = isGeneratePerfDebugEnabled();
  const isGuidedBoardCandidateDebug = isGuidedBoardCandidateDebugEnabled();
  const isLibraryPerfDebug = isLibraryPerfDebugEnabled();

  function noteInteractionModality(event) {
    if (event.type === "pointerdown") {
      lastInteractionWasPointerRef.current = true;
      document.documentElement.dataset.inputModality = "pointer";
      const pointerTarget = event.target instanceof Element
        ? event.target.closest("button, summary, input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])")
        : null;
      pointerActivatedControlRef.current = pointerTarget instanceof HTMLElement ? pointerTarget : null;
      return;
    }

    if (event.type !== "keydown") {
      return;
    }

    if (event.key === "Tab" || event.key === "Enter" || event.key === " " || event.key.startsWith("Arrow")) {
      lastInteractionWasPointerRef.current = false;
      pointerActivatedControlRef.current = null;
      document.documentElement.dataset.inputModality = "keyboard";
    }
  }

  function registerPointerActivatedControl(event) {
    if (event?.detail === 0 || !(event?.currentTarget instanceof HTMLElement)) {
      return;
    }

    pointerActivatedControlRef.current = event.currentTarget;
    lastInteractionWasPointerRef.current = true;
  }

  function blurPointerActivatedControl(event) {
    registerPointerActivatedControl(event);

    if (!(event?.currentTarget instanceof HTMLElement) || event.detail === 0) {
      return;
    }

    const target = event.currentTarget;

    window.setTimeout(() => {
      if (document.activeElement === target) {
        target.blur();
      }

      if (pointerActivatedControlRef.current === target) {
        pointerActivatedControlRef.current = null;
      }
    }, 0);
  }

  useEffect(() => {
    function handleDocumentClickCapture(event) {
      if (!mobileFilterDismissClickSuppressionRef.current || !isMobileViewport) {
        return;
      }

      mobileFilterDismissClickSuppressionRef.current = false;

      if (mobileFilterDismissClickSuppressionTimeoutRef.current) {
        window.clearTimeout(mobileFilterDismissClickSuppressionTimeoutRef.current);
        mobileFilterDismissClickSuppressionTimeoutRef.current = null;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    document.addEventListener("click", handleDocumentClickCapture, true);
    return () => document.removeEventListener("click", handleDocumentClickCapture, true);
  }, [isMobileViewport]);

  function blurRetainedPointerFocus() {
    const activeElement = document.activeElement;
    const pointerActivatedControl = pointerActivatedControlRef.current;

    if (
      !lastInteractionWasPointerRef.current
      || !(activeElement instanceof HTMLElement)
      || !(pointerActivatedControl instanceof HTMLElement)
      || activeElement !== pointerActivatedControl
    ) {
      return;
    }

    activeElement.blur();
    pointerActivatedControlRef.current = null;
  }

  function shouldSuppressMobileLibraryCardInteraction() {
    return isMobileViewport && Date.now() < suppressMobileLibraryCardInteractionUntilRef.current;
  }

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items]
  );
  const itemsByItemUuid = useMemo(
    () => Object.fromEntries(items.filter((item) => item.itemUuid).map((item) => [item.itemUuid, item])),
    [items]
  );
  const itemsByReferenceSourceKey = useMemo(
    () => Object.fromEntries(items.map((item) => [getReferenceSourceKey(item), item]).filter(([key]) => key)),
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
        (board?.images ?? []).some((image, index) =>
          (entry.imageId && image.id === entry.imageId) ||
          (Number.isInteger(entry.imageIndex) && index === entry.imageIndex) ||
          (image.referenceId === entry.itemId && image.generationSlot === entry.slot)
        )
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
  const currentFilterDirectionSummary = useMemo(
    () => getFilterDirectionSummary(generationMetadataFilters),
    [generationMetadataFilters]
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

  function renderTagManagerPanelBody() {
    return (
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
    if (!isMobileViewport) {
      setMobileLibrarySelectMode(false);
      setMobileLibraryMoreOpen(false);
    }
  }, [isMobileViewport]);

  useEffect(() => {
    setMobileReferencePreviewChromeVisible(false);
    setMobileReferencePreviewActionsOpen(false);
    setMobileReferencePreviewInfoOpen(false);
    mobileReferencePreviewTouchRef.current = null;
    mobileReferencePreviewPinchRef.current = null;
    mobileReferencePreviewDidPinchRef.current = false;
    setMobileReferencePreviewScale(1);
  }, [isMobileViewport, referencePreview?.id]);

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
  const nestedTagDebugEnabled = isNestedTagDebugEnabled();
  const tagDebugItems = useMemo(
    () => (nestedTagDebugEnabled ? NESTED_TAG_DEBUG_ITEMS : []),
    [nestedTagDebugEnabled]
  );
  const tagDebugSourceItems = useMemo(
    () => (tagDebugItems.length ? [...items, ...tagDebugItems] : items),
    [items, tagDebugItems]
  );
  const allLibraryTags = useMemo(() => getAllTags(tagDebugSourceItems), [tagDebugSourceItems]);
  const draftResolvedPreviewMedia = useResolvedItemMediaSource(editingId ? draft : null, "preview");
  const cropEditorResolvedMedia = useResolvedItemMediaSource(cropEditorState ? draft : null, "preview");
  const cropEditorImageUrl = resolveImageUrl(cropEditorResolvedMedia.src || draft.imageUrl);
  const cropEditorImageMetrics = useImageMetrics(cropEditorImageUrl);

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
                <span>Current board tags</span>
                <strong>{currentBoardTagSummary.length ? currentBoardTagSummary.join(", ") : "Unspecified"}</strong>
              </div>
              {currentFilterDirectionSummary.length ? (
                <div className="outfit-debug-row">
                  <span>Filter direction</span>
                  <strong>{currentFilterDirectionSummary.join(", ")}</strong>
                </div>
              ) : null}
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
                  const candidateRows = (entry.candidates ?? []).slice(0, 25);
                  const debugEntryKey = getGuidedDebugEntryKey(entry, `board-debug-${index}`);

                  return (
                    <section key={debugEntryKey} className="outfit-debug-slot">
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
                            <div key={`${debugEntryKey}-${reason.key}`} className="outfit-debug-value-row">
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
                              <div key={`${debugEntryKey}-top-${candidate.itemId}`} className="outfit-debug-value-row">
                                <span>{itemsById[candidate.itemId]?.name ?? candidate.itemId}</span>
                                <strong>{candidate.score.toFixed(1)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {candidateRows.length ? (
                        <div className="outfit-debug-slot-block">
                          <span className="outfit-debug-label">Candidate scores</span>
                          <div className="outfit-debug-value-list">
                            {candidateRows.map((candidate) => {
                              const candidateReasons = getGuidedBreakdownDisplayEntries(candidate.breakdown, 2);
                              const candidateLabel = candidateReasons.length
                                ? candidateReasons.map((reason) => reason.label).join(" · ")
                                : "No dominant reasons";

                              return (
                                <div key={`${debugEntryKey}-candidate-${candidate.itemId}`} className="outfit-debug-value-row">
                                  <span>{`${candidate.rank}. ${itemsById[candidate.itemId]?.name ?? candidate.itemId}${candidate.selected ? " [Selected]" : ""}`}</span>
                                  <strong>{`${candidate.rawScore.toFixed(1)} / w ${candidate.weight.toFixed(1)}`}</strong>
                                  <span>{candidateLabel}</span>
                                </div>
                              );
                            })}
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
  const draftBackgroundRemovalMedia = useResolvedItemMediaSource(
    editingId === "new" || draft?.id ? draft : null,
    "preview",
    true
  );
  const canRemoveDraftBackground = isLocalDataImage(draftBackgroundRemovalMedia.src || draftResolvedPreviewMedia.src || draft.imageUrl);
  const normalizedWardrobeFilters = normalizeWardrobeFilterState(wardrobeFilters);
  const currentSavedLibraryViewSnapshot = useMemo(
    () => createSavedLibraryViewSnapshot({
      librarySearch,
      wardrobeFilters,
      wardrobeSort
    }),
    [librarySearch, wardrobeFilters, wardrobeSort]
  );
  const activeWardrobeFilterCount =
    countActiveFilterValues({
      tags: normalizedWardrobeFilters.tags,
      excludedTags: normalizedWardrobeFilters.excludedTags,
      laundry: normalizedWardrobeFilters.laundry,
      favorite: normalizedWardrobeFilters.favorite,
      tagMatchMode:
        normalizedWardrobeFilters.tags.length > 1 && normalizedWardrobeFilters.tagMatchMode !== "any"
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
  const matchingSavedLibraryViewId = useMemo(
    () =>
      normalizeSavedLibraryViews(savedLibraryViews).find((view) =>
        doesSavedLibraryViewMatchState(view, {
          librarySearch: currentSavedLibraryViewSnapshot.searchQuery,
          wardrobeFilters: currentSavedLibraryViewSnapshot.filters,
          wardrobeSort: currentSavedLibraryViewSnapshot.sort
        })
      )?.id ?? "",
    [currentSavedLibraryViewSnapshot, savedLibraryViews]
  );
  const matchingControlsSavedLibraryViewId = useMemo(
    () =>
      normalizeSavedLibraryViews(savedLibraryViews).find((view) =>
        doesSavedLibraryViewMatchMetadataState(view, generationMetadataFilters)
      )?.id ?? "",
    [generationMetadataFilters, savedLibraryViews]
  );
  const wardrobeFilterSearchQuery = normalizeTag(wardrobeFilterSearch);
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
  const filteredLibraryTagEntries = useMemo(() => {
    if (!wardrobeFilterSearchQuery) {
      return libraryTagEntries;
    }

    return libraryTagEntries.filter(({ tag }) => tag.includes(wardrobeFilterSearchQuery));
  }, [libraryTagEntries, wardrobeFilterSearchQuery]);
  const filteredLibraryNoTagsCount = useMemo(() => {
    if (!wardrobeFilterSearchQuery) {
      return libraryNoTagsCount;
    }

    return "untagged".includes(wardrobeFilterSearchQuery) || "no tags".includes(wardrobeFilterSearchQuery)
      ? libraryNoTagsCount
      : 0;
  }, [libraryNoTagsCount, wardrobeFilterSearchQuery]);
  const hasVisibleWardrobeFilterOptions = filteredLibraryTagEntries.length > 0 || filteredLibraryNoTagsCount > 0;
  const excludedReferenceCount = useMemo(
    () => Object.values(excluded).filter(Boolean).length,
    [excluded]
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
      setLibrarySelectionActionsOpen(false);
      setLibraryTagActionMode(null);
    }
  }, [selectedReferenceCount]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!librarySelectionActionsOpen && !libraryTagActionMode) {
        return;
      }

      if (!librarySelectionActionsRef.current?.contains(event.target)) {
        setLibrarySelectionActionsOpen(false);
        setLibraryTagActionMode(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [librarySelectionActionsOpen, libraryTagActionMode]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }

      if (!librarySelectionActionsOpen && !libraryTagActionMode) {
        return;
      }

      setLibrarySelectionActionsOpen(false);
      setLibraryTagActionMode(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [librarySelectionActionsOpen, libraryTagActionMode]);

  useEffect(() => {
    if (!wardrobeViewsOpen && !controlsViewsOpen && !mobileLibraryMoreOpen && !wardrobeManageOpen && !wardrobeAddOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;

      if (
        wardrobeViewsOpen &&
        wardrobeViewsPopoverRef.current?.contains(target)
      ) {
        return;
      }

      if (
        controlsViewsOpen &&
        controlsViewsPopoverRef.current?.contains(target)
      ) {
        return;
      }

      if (
        mobileLibraryMoreOpen &&
        mobileLibraryMorePopoverRef.current?.contains(target)
      ) {
        return;
      }

      if (
        wardrobeManageOpen &&
        wardrobeManagePopoverRef.current?.contains(target)
      ) {
        return;
      }

      if (
        wardrobeAddOpen &&
        wardrobeAddPopoverRef.current?.contains(target)
      ) {
        return;
      }

      if (wardrobeViewsOpen) {
        setWardrobeViewsOpen(false);
      }

      if (controlsViewsOpen) {
        setControlsViewsOpen(false);
      }

      if (mobileLibraryMoreOpen) {
        setMobileLibraryMoreOpen(false);
      }

      if (wardrobeManageOpen) {
        setWardrobeManageOpen(false);
      }

      if (wardrobeAddOpen) {
        closeWardrobeAdd();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [controlsViewsOpen, mobileLibraryMoreOpen, wardrobeAddOpen, wardrobeManageOpen, wardrobeViewsOpen]);

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

  useEffect(() => {
    setIsReferencePreviewZoomed(false);
    setReferencePreviewZoomFocus(null);
    setMobileReferencePreviewScale(1);
    mobileReferencePreviewPinchRef.current = null;
    mobileReferencePreviewDidPinchRef.current = false;
    if (referencePreviewStageRef.current) {
      referencePreviewStageRef.current.scrollLeft = 0;
      referencePreviewStageRef.current.scrollTop = 0;
    }
  }, [referencePreview?.id]);

  useEffect(() => {
    if (!isReferencePreviewZoomed || !referencePreviewZoomFocus) {
      return undefined;
    }

    let frameId = window.requestAnimationFrame(() => {
      const stageElement = referencePreviewStageRef.current;
      const imageFrameElement = referencePreviewImageFrameRef.current;

      if (!stageElement || !imageFrameElement) {
        return;
      }

      const nextScrollPosition = getReferencePreviewCenteredScrollPosition({
        focusRatio: referencePreviewZoomFocus,
        containerWidth: stageElement.clientWidth,
        containerHeight: stageElement.clientHeight,
        contentWidth: imageFrameElement.offsetWidth,
        contentHeight: imageFrameElement.offsetHeight
      });

      stageElement.scrollLeft = nextScrollPosition.scrollLeft;
      stageElement.scrollTop = nextScrollPosition.scrollTop;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isReferencePreviewZoomed, referencePreviewZoomFocus]);

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

    const sortedItems = sortLibraryItems(filtered, wardrobeSort, {
      getDisplayName: buildDisplayName,
      compareCreatedAt: compareItemsByCreatedAt
    });

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
  const referencePreviewNavigation = useMemo(
    () => getReferencePreviewNavigation(visibleWardrobeItems, referencePreview?.id ?? ""),
    [referencePreview?.id, visibleWardrobeItems]
  );
  const isMobileReferencePreview = isMobileViewport && Boolean(referencePreview);
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
  const libraryParentGroupEntries = useMemo(() => {
    const counts = new Map();

    visibleWardrobeItems.forEach((item) => {
      uniqueTags(item?.tags).forEach((tag) => {
        const group = getBoardTagParentGroup(tag);
        if (group) {
          counts.set(group, (counts.get(group) ?? 0) + 1);
        }
      });
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([group, count]) => ({ group, count }));
  }, [visibleWardrobeItems]);
  const libraryImageCountLabel = useMemo(() => {
    if (libraryStats.visibleImages !== libraryStats.totalImages) {
      return `${libraryStats.visibleImages} of ${libraryStats.totalImages} images`;
    }

    return `${libraryStats.totalImages} images`;
  }, [libraryStats.totalImages, libraryStats.visibleImages]);
  const mobileLibrarySelectionStatusLabel = selectedReferenceCount ? `${selectedReferenceCount} selected` : libraryImageCountLabel;
  const showMobileLibrarySelectionToolbar = isMobileViewport && mobileLibrarySelectMode;
  const selectedReferenceIdSet = useMemo(
    () => new Set(selectedReferenceIdList),
    [selectedReferenceIdList]
  );
  const libraryGridLayoutConfig = useMemo(
    () => getLibraryGridLayoutConfig({ viewportWidth: libraryGridViewport.width, isMobileViewport }),
    [isMobileViewport, libraryGridViewport.width]
  );
  const shouldVirtualizeWardrobeGrid = visibleWardrobeItems.length >= LIBRARY_VIRTUALIZATION_THRESHOLD;
  const virtualizedWardrobeGrid = useMemo(() => {
    if (!shouldVirtualizeWardrobeGrid) {
      return {
        totalHeight: 0,
        virtualItems: visibleWardrobeItems.map((item) => ({ item, style: null }))
      };
    }

    const layout = getVirtualizedGridLayout({
      itemCount: visibleWardrobeItems.length,
      viewportWidth: libraryGridViewport.width,
      viewportHeight: libraryGridViewport.height,
      scrollTop: libraryGridViewport.scrollTop,
      gridOffsetTop: libraryGridViewport.gridOffsetTop,
      minColumnWidth: libraryGridLayoutConfig.minColumnWidth,
      gap: libraryGridLayoutConfig.gap,
      estimatedRowHeight: libraryGridLayoutConfig.estimatedRowHeight,
      overscanRows: LIBRARY_GRID_OVERSCAN_ROWS
    });
    const virtualItems = visibleWardrobeItems.slice(layout.startIndex, layout.endIndex).map((item, index) => {
      const absoluteIndex = layout.startIndex + index;
      const rowIndex = Math.floor(absoluteIndex / layout.columns);
      const columnIndex = absoluteIndex % layout.columns;

      return {
        item,
        style: {
          position: "absolute",
          top: `${rowIndex * layout.rowStride}px`,
          left: `${columnIndex * (layout.columnWidth + libraryGridLayoutConfig.gap)}px`,
          width: `${layout.columnWidth}px`,
          height: `${libraryGridLayoutConfig.estimatedRowHeight}px`
        }
      };
    });

    return {
      totalHeight: layout.totalHeight,
      virtualItems
    };
  }, [libraryGridLayoutConfig.estimatedRowHeight, libraryGridLayoutConfig.gap, libraryGridLayoutConfig.minColumnWidth, libraryGridViewport.gridOffsetTop, libraryGridViewport.height, libraryGridViewport.scrollTop, libraryGridViewport.width, shouldVirtualizeWardrobeGrid, visibleWardrobeItems]);
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

  useLayoutEffect(() => {
    if (activePanel !== "wardrobe" || wardrobeSavedOpen) {
      return undefined;
    }

    const scrollElement = wardrobePanelScrollRef.current;
    const gridElement = wardrobeGridRef.current;

    if (!scrollElement || !gridElement) {
      return undefined;
    }

    let frameId = 0;
    const timeoutIds = new Set();
    const postLayoutFrameIds = new Set();
    const updateViewport = () => {
      frameId = 0;
      const nextViewport = readLibraryGridViewport(scrollElement, gridElement);

      setLibraryGridViewport((current) => {
        if (areLibraryGridViewportsEqual(current, nextViewport)) {
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

    const schedulePostLayoutRemeasure = () => {
      scheduleViewportUpdate();

      const firstFrameId = window.requestAnimationFrame(() => {
        postLayoutFrameIds.delete(firstFrameId);
        scheduleViewportUpdate();

        const secondFrameId = window.requestAnimationFrame(() => {
          postLayoutFrameIds.delete(secondFrameId);
          scheduleViewportUpdate();
        });

        postLayoutFrameIds.add(secondFrameId);
      });

      postLayoutFrameIds.add(firstFrameId);

      [0, 120].forEach((delay) => {
        const timeoutId = window.setTimeout(() => {
          timeoutIds.delete(timeoutId);
          scheduleViewportUpdate();
        }, delay);

        timeoutIds.add(timeoutId);
      });
    };

    schedulePostLayoutRemeasure();
    scrollElement.addEventListener("scroll", scheduleViewportUpdate, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      scheduleViewportUpdate();
    });

    [
      scrollElement,
      gridElement,
      scrollElement.parentElement,
      gridElement.parentElement,
      scrollElement.closest(".wardrobe-panel-body"),
      scrollElement.closest(".active-panel-overlay")
    ]
      .filter((element, index, array) => element instanceof Element && array.indexOf(element) === index)
      .forEach((element) => {
        resizeObserver.observe(element);
      });

    let intersectionObserver = null;

    if (typeof IntersectionObserver === "function") {
      intersectionObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          schedulePostLayoutRemeasure();
        }
      });
      intersectionObserver.observe(scrollElement);
    }

    const handleWindowResize = () => {
      schedulePostLayoutRemeasure();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        schedulePostLayoutRemeasure();
      }
    };

    window.addEventListener("resize", handleWindowResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      scrollElement.removeEventListener("scroll", scheduleViewportUpdate);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      postLayoutFrameIds.forEach((scheduledFrameId) => {
        window.cancelAnimationFrame(scheduledFrameId);
      });
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, [activePanel, loading, visibleWardrobeItems.length, wardrobeSavedOpen]);

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
    if (shouldSuppressMobileLibraryCardInteraction()) {
      if (event) {
        blurPointerActivatedControl(event);
      }
      return;
    }

    selectReference(itemId, event, { forceToggleSelection: isMobileViewport && mobileLibrarySelectMode });
  }, [isMobileViewport, mobileLibrarySelectMode, selectReference]);
  const handleLibraryReferencePreview = useCallback((item) => {
    if (shouldSuppressMobileLibraryCardInteraction()) {
      return;
    }

    openReferencePreview(item);
  }, [isMobileViewport, openReferencePreview]);
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
  function getCurrentBoardLayoutOptions(baseOptions = boardLayoutOptions) {
    return {
      ...baseOptions,
      viewportClass: resolveBoardLayoutViewportClass({
        viewportWidth: getViewportWidth(),
        viewportHeight: getViewportHeight()
      })
    };
  }
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

  function relayoutBoardStateImages(boardImages, layoutOptionsOverride = getCurrentBoardLayoutOptions()) {
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
      layoutOptions: getCurrentBoardLayoutOptions(),
      debugHooks: perfSession,
      boardFilters: options.metadataFilters ?? null,
      boardGuidedOptions: {
        collectTopCandidates: Boolean(options.collectTopCandidates),
        debugCandidates: Boolean(options.debugCandidates)
      }
    });
  }

  function buildBoardFromLegacyReferences(referenceIds, sourceItems) {
    const filteredSourceItems = getMetadataFilteredItems(sourceItems, generationMetadataFilters);
    const sourceItemsById = Object.fromEntries(filteredSourceItems.map((item) => [item.id, item]));
    const validReferenceIds = referenceIds.filter((referenceId) => sourceItemsById[referenceId]);

    if (validReferenceIds.length) {
      return createBoardFromReferenceIds(validReferenceIds, {
        ...getCurrentBoardLayoutOptions(),
        itemsByReferenceId: sourceItemsById
      });
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
      setShowBoardGenerationBusy(true);
      return;
    }

    setBoardGenerationError("");
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
        setBoardGenerationError("Board generation failed. Try again.");
        clearBoardGenerationFeedback();
      }
    });
  }, [applyGeneratedBoardResult, clearBoardGenerationFeedback]);

  function getBoardRepositoryDependencies() {
    return {
      visibleSlots,
      getBoardKey,
      getOutfitKey,
      itemsById,
      itemsByItemUuid,
      itemsByReferenceSourceKey,
      buildBoardFromLegacyReferences
    };
  }

  function getItemRepositoryDependencies() {
    return {
      normalizeItem,
      restoreLegacyBakedImageScale,
      applyMappedStyleWeightDefaults,
      bakeItemImagePresentation,
      itemDefaultsMigrationVersion: ITEM_DEFAULTS_MIGRATION_VERSION,
      imagePresentationMigrationVersion: IMAGE_PRESENTATION_MIGRATION_VERSION,
      itemNeedsRetailMigration,
      itemNeedsImageFrameScaleMigration,
      itemNeedsImageScaleMigration,
      itemNeedsImageOffsetMigration,
      itemNeedsImageCropMigration,
      itemNeedsFavoriteMigration,
      itemNeedsQuantityMigration,
      itemNeedsColorMigration,
      itemNeedsWeightMigration,
      itemNeedsGarmentTypeMigration,
      itemNeedsTagMigration,
      itemNeedsClimateTagMigration,
      itemNeedsDefaultMetadataMigration,
      itemNeedsMoodboardMetadataMigration,
      itemNeedsImageAssetMigration,
      itemNeedsStyleWeightMappingMigration
    };
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

    function applyDefaultBootstrapState(sourceItems, appStateOverride = null) {
      const defaultData = getDefaultData();
      const defaultState = appStateOverride ?? defaultData.appState;
      const normalizedPanelLayoutState = normalizePanelLayoutState(defaultState.panelLayoutState, getViewportWidth());
      const normalizedItems = sourceItems.length ? sourceItems : defaultData.items.map(normalizeItem);
      const normalizedProvenance = normalizeLibraryProvenance(defaultState.provenance, {
        itemCountSnapshot: normalizedItems.length
      });
      const generatedBoard = buildGeneratedBoard(normalizedItems, {
        imageCount: normalizeImageCount(defaultState.imageCount),
        excluded: {},
        generationLists: defaultGenerationLists,
        outfitFilters: emptyOutfitFilters,
        generationMode: defaultGenerationMode,
        outfitAffinity: normalizeOutfitAffinity(defaultState.outfitAffinity),
        recentOutfits: normalizeRecentOutfits(defaultState.recentOutfits)
      });

      pendingRestoredBoardFitRef.current = false;
      setItems(normalizedItems);
      setLayering(Boolean(defaultState.layering));
      setAccessoriesEnabled(defaultState.accessoriesEnabled ?? true);
      setLocked(defaultState.locked ?? {});
      setExcluded(defaultState.excluded ?? {});
      setBoard(generatedBoard.board);
      setImageCount(resolvePersistedImageCount(defaultState.imageCount));
      setOutfit(generatedBoard.syntheticOutfit);
      setBoardView(getFittedBoardView(generatedBoard.board));
      setGuidedDebugPayload([]);
      setIgnoredImportImages(defaultState.ignoredImportImages ?? []);
      setSavedOutfits([]);
      setLikedOutfitKeys(normalizeLikedOutfitKeys(defaultState.likedOutfitKeys));
      setOutfitAffinity(normalizeOutfitAffinity(defaultState.outfitAffinity));
      setRecentOutfits(normalizeRecentOutfits(defaultState.recentOutfits));
      setGenerateCount(Math.max(0, Math.round(Number(defaultState.generateCount) || 0)));
      setGenerationLists(normalizeGenerationLists(defaultState.generationLists));
      setGenerationMode(normalizeGenerationMode(defaultState.generationMode));
      setGenerationMetadataFilters(normalizeMetadataFilterState(defaultState.generationMetadataFilters));
      setWardrobeFilters(normalizeWardrobeFilterState(defaultState.wardrobeFilters));
      setLibrarySearch(normalizeLibrarySearch(defaultState.librarySearch));
      setWardrobeSort(normalizeWardrobeSort(defaultState.wardrobeSort));
      setSavedLibraryViews(normalizeSavedLibraryViews(defaultState.savedLibraryViews));
      setProvenance(normalizedProvenance);
      setLocalSafety(normalizeLocalSafetyState(defaultState.localSafety));
      setSideEditorWidth(normalizedPanelLayoutState.sideEditorWidth);
      setLibraryAddWidth(normalizedPanelLayoutState.libraryAddWidth);
      const normalizedLibraryUiState = normalizeLibraryUiState(defaultState.libraryUiState);
      setActivePanel(normalizedLibraryUiState.libraryOpen ? "wardrobe" : null);
      setWardrobeFiltersOpen(normalizedLibraryUiState.wardrobeFiltersOpen);
      setWardrobeSavedOpen(normalizedLibraryUiState.wardrobeSavedOpen);
      setOutfitFilters(normalizeOutfitFilters(defaultState.outfitFilters));
      setWeatherSettings(normalizeWeatherSettings(defaultState.weatherSettings));
      setWeatherLocationDraft(defaultState.weatherSettings?.locationName ?? "");
      setWeatherData(defaultState.weatherData ?? null);
      setFitpics(defaultState.fitpics ?? []);
    }

    async function bootstrap() {
      let fallbackItems = [];

      try {
        const [storedAppState, startupItems, latestMetadataSnapshotInfoResult] = await Promise.all([
          loadStartupAppState(),
          loadStartupItemMetadata(),
          loadLatestMetadataSnapshotInfo().catch((error) => {
            console.warn("Failed to load metadata snapshot status during bootstrap.", error);
            return null;
          })
        ]);
        const latestMetadataSnapshotInfo = latestMetadataSnapshotInfoResult;
        const effectiveItems = startupItems.length
          ? startupItems.map((item) => normalizeItem(item))
          : [];
        fallbackItems = effectiveItems;

        if (cancelled) {
          return;
        }

        setItems(effectiveItems);

        if (storedAppState) {
          const resolvedImageCount = resolvePersistedImageCount(storedAppState.imageCount);
          const normalizedGenerationLists = normalizeGenerationLists(storedAppState.generationLists);
          const normalizedGenerationMode = normalizeGenerationMode(storedAppState.generationMode);
          const normalizedMetadataFilters = normalizeMetadataFilterState(storedAppState.generationMetadataFilters);
          const normalizedWardrobeFilters = normalizeWardrobeFilterState(storedAppState.wardrobeFilters);
          const normalizedWardrobeSort = normalizeWardrobeSort(storedAppState.wardrobeSort);
          const normalizedPanelLayoutState = normalizePanelLayoutState(storedAppState.panelLayoutState, getViewportWidth());
          const normalizedLibraryUiState = normalizeLibraryUiState(storedAppState.libraryUiState);
          const normalizedOutfitFilters = normalizeOutfitFilters(storedAppState.outfitFilters);
          const normalizedOutfitAffinity = normalizeOutfitAffinity(storedAppState.outfitAffinity);
          const normalizedRecentOutfits = normalizeRecentOutfits(storedAppState.recentOutfits);
          const normalizedProvenance = normalizeLibraryProvenance(storedAppState.provenance, {
            itemCountSnapshot: effectiveItems.length
          });
          const normalizedLocalSafety = normalizeLocalSafetyState({
            ...storedAppState.localSafety,
            ...(latestMetadataSnapshotInfo
              ? {
                  lastMetadataSnapshotAt: latestMetadataSnapshotInfo.createdAt,
                  lastMetadataSnapshotReason: latestMetadataSnapshotInfo.reason
                }
              : {})
          });
          setLayering(Boolean(storedAppState.layering));
          setAccessoriesEnabled(storedAppState.accessoriesEnabled ?? true);
          setLocked(storedAppState.locked ?? {});
          setExcluded(storedAppState.excluded ?? {});
          const restoredBoard = resolveBoardFromAppState(
            storedAppState,
            effectiveItems,
            getBoardRepositoryDependencies()
          );
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
          const hydratedSavedBoards = hydrateSavedBoards(
            storedAppState.savedOutfits,
            effectiveItems,
            getBoardRepositoryDependencies()
          );
          setSavedOutfits(hydratedSavedBoards);
          setLikedOutfitKeys(normalizeLikedOutfitKeys(storedAppState.likedOutfitKeys));
          setOutfitAffinity(normalizedOutfitAffinity);
          setRecentOutfits(normalizedRecentOutfits);
          setGenerateCount(Math.max(0, Math.round(Number(storedAppState.generateCount) || 0)));
          setGenerationLists(normalizedGenerationLists);
          setGenerationMode(normalizedGenerationMode);
          setGenerationMetadataFilters(normalizedMetadataFilters);
          setWardrobeFilters(normalizedWardrobeFilters);
          setLibrarySearch(normalizeLibrarySearch(storedAppState.librarySearch));
          setWardrobeSort(normalizedWardrobeSort);
          setSavedLibraryViews(normalizeSavedLibraryViews(storedAppState.savedLibraryViews));
          setProvenance(normalizedProvenance);
          setLocalSafety(normalizedLocalSafety);
          setSideEditorWidth(normalizedPanelLayoutState.sideEditorWidth);
          setLibraryAddWidth(normalizedPanelLayoutState.libraryAddWidth);
          setActivePanel(normalizedLibraryUiState.libraryOpen ? "wardrobe" : null);
          setWardrobeFiltersOpen(normalizedLibraryUiState.wardrobeFiltersOpen);
          setWardrobeSavedOpen(normalizedLibraryUiState.wardrobeSavedOpen);
          setOutfitFilters(normalizedOutfitFilters);
          setWeatherSettings(normalizeWeatherSettings(storedAppState.weatherSettings));
          setWeatherLocationDraft(storedAppState.weatherSettings?.locationName ?? "");
          setWeatherData(storedAppState.weatherData ?? null);
          setFitpics(storedAppState.fitpics ?? []);

          try {
            await backfillLocalSyncMetadata(effectiveItems, hydratedSavedBoards);
          } catch (syncMetadataError) {
            console.error("Failed to initialize local sync metadata.", syncMetadataError);
          }
        } else {
          applyDefaultBootstrapState(effectiveItems);

          try {
            await backfillLocalSyncMetadata(effectiveItems, []);
          } catch (syncMetadataError) {
            console.error("Failed to initialize local sync metadata.", syncMetadataError);
          }
        }

      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to restore library state. Falling back to defaults.", error);
        applyDefaultBootstrapState(fallbackItems);
        setLocalSafety(normalizeLocalSafetyState());
      }

      if (!cancelled) {
        setLoading(false);
        pendingPersistenceReadyRef.current = true;
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => clearBoardGenerationFeedback, [clearBoardGenerationFeedback]);

  useEffect(() => {
    if (!generationMetadataFiltersOpen) {
      setControlsViewsOpen(false);
    }
  }, [generationMetadataFiltersOpen]);

  useEffect(() => {
    if (!board?.images?.length || (typeof board.boardUuid === "string" && board.boardUuid.trim())) {
      return;
    }

    setBoard((current) => ensureBoardUuid(current));
  }, [board]);

  useEffect(() => {
    if (!savedOutfits.some((savedOutfit) => savedOutfit?.board && !(typeof savedOutfit.board.boardUuid === "string" && savedOutfit.board.boardUuid.trim()))) {
      return;
    }

    setSavedOutfits((current) => current.map((savedOutfit) => ensureSavedBoardUuid(savedOutfit)));
  }, [savedOutfits]);

  useEffect(() => () => {
    if (boardRelayoutFrameRef.current) {
      cancelAnimationFrame(boardRelayoutFrameRef.current);
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
      board: ensureBoardUuid(board),
      ignoredImportImages,
      savedOutfits: savedOutfits.map((savedOutfit) => ensureSavedBoardUuid(savedOutfit)),
      likedOutfitKeys,
      outfitAffinity,
      recentOutfits,
      generateCount,
      imageCount,
      generationLists,
      generationMode,
      generationMetadataFilters,
      wardrobeFilters,
      librarySearch,
      wardrobeSort,
      savedLibraryViews,
      provenance: normalizeLibraryProvenance(provenance, {
        itemCountSnapshot: items.length
      }),
      localSafety: normalizeLocalSafetyState(localSafety),
      libraryUiState: {
        libraryOpen: activePanel === "wardrobe",
        wardrobeFiltersOpen,
        wardrobeSavedOpen
      },
      panelLayoutState: {
        sideEditorWidth,
        libraryAddWidth
      },
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
      wardrobeFilters,
      librarySearch,
      wardrobeSort,
      savedLibraryViews,
      provenance,
      localSafety,
      activePanel,
      wardrobeFiltersOpen,
      wardrobeSavedOpen,
      sideEditorWidth,
      libraryAddWidth,
      outfitFilters,
      weatherSettings,
      weatherData,
      fitpics,
      items.length
    ]
  );

  useEffect(() => {
    currentPersistedAppStateRef.current = currentPersistedAppState;
  }, [currentPersistedAppState]);

  useEffect(() => {
    localSafetyRef.current = normalizeLocalSafetyState(localSafety);
  }, [localSafety]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const nextSignature = buildSnapshotTrackedAppStateSignature(currentPersistedAppState);
    const previousSignature = previousSnapshotTrackedAppStateRef.current;
    previousSnapshotTrackedAppStateRef.current = nextSignature;

    if (previousSignature === null || previousSignature === nextSignature) {
      return;
    }

    markMetadataDirty();
  }, [currentPersistedAppState, loading]);

  useEffect(() => {
    if (!loading && !persistenceReady && pendingPersistenceReadyRef.current) {
      pendingPersistenceReadyRef.current = false;
      setPersistenceReady(true);
    }
  }, [loading, persistenceReady]);

  useEffect(() => {
    if (loading || !persistenceReady) {
      return;
    }

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
      enqueueAppStateSave(currentPersistedAppState, "debounced").then(() => {
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
  }, [currentPersistedAppState, isGeneratePerfDebug, loading, persistenceReady]);

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

  useEffect(() => {
    if (loading || !persistenceReady) {
      return undefined;
    }

    const flushAppState = () => {
      const nextState = currentPersistedAppStateRef.current;

      if (nextState) {
        void enqueueAppStateSave(nextState, "pagehide");
      }
    };

    window.addEventListener("pagehide", flushAppState);
    document.addEventListener("visibilitychange", flushOnHide);

    function flushOnHide() {
      if (document.visibilityState === "hidden") {
        flushAppState();
      }
    }

    return () => {
      window.removeEventListener("pagehide", flushAppState);
      document.removeEventListener("visibilitychange", flushOnHide);
    };
  }, [loading, persistenceReady]);

  useEffect(() => {
    if (loading || !persistenceReady || !localSafety.metadataDirtySinceSnapshot) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      void runMetadataSnapshot("autosnapshot", {
        priority: "background",
        changedItemIds: localSafety.changedItemIdsSinceSnapshot
      });
    }, 20 * 60 * 1000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [loading, localSafety.changedItemIdsSinceSnapshot, localSafety.metadataDirtySinceSnapshot, persistenceReady]);

  useEffect(() => {
    if (loading || !persistenceReady) {
      return undefined;
    }

    function handleVisibilityHiddenSnapshot() {
      if (document.visibilityState !== "hidden" || !localSafety.metadataDirtySinceSnapshot) {
        return;
      }

      void runMetadataSnapshot("visibility-hidden", {
        priority: "background",
        changedItemIds: localSafety.changedItemIdsSinceSnapshot
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityHiddenSnapshot);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityHiddenSnapshot);
    };
  }, [loading, localSafety.changedItemIdsSinceSnapshot, localSafety.metadataDirtySinceSnapshot, persistenceReady]);

  useEffect(() => {
    if (loading || !persistenceReady) {
      return;
    }

    void enqueueAppStateSave(currentPersistedAppState, "savedOutfitsEffect");
  }, [currentPersistedAppState, loading, persistenceReady, savedOutfits]);

  function enqueueAppStateSave(nextState, reason = "unknown") {
    if (!nextState) {
      return Promise.resolve();
    }

    pendingAppStateSaveRef.current = nextState;

    if (appStateSaveInFlightRef.current) {
      return appStateSavePromiseRef.current;
    }

    appStateSaveInFlightRef.current = true;

    const flushQueuedState = async () => {
      try {
        while (pendingAppStateSaveRef.current) {
          const stateToSave = pendingAppStateSaveRef.current;
          pendingAppStateSaveRef.current = null;
          await saveAppState(stateToSave);
        }
      } finally {
        appStateSaveInFlightRef.current = false;

        if (pendingAppStateSaveRef.current) {
          void enqueueAppStateSave(pendingAppStateSaveRef.current, "drain");
        }
      }
    };

    appStateSavePromiseRef.current = flushQueuedState();
    return appStateSavePromiseRef.current;
  }

  async function drainAppStatePersistenceQueue() {
    while (appStateSaveInFlightRef.current || pendingAppStateSaveRef.current) {
      await appStateSavePromiseRef.current;
    }
  }

  function dropPendingAppStatePersistence() {
    pendingAppStateSaveRef.current = null;
  }

  function applyProvenanceUpdate(buildNextProvenance, options = {}) {
    const itemCountSnapshot = Math.max(0, Math.round(Number(options.itemCountSnapshot) || 0));
    const baseProvenance = normalizeLibraryProvenance(
      currentPersistedAppStateRef.current?.provenance ?? provenance,
      { itemCountSnapshot }
    );
    const nextProvenance = normalizeLibraryProvenance(buildNextProvenance(baseProvenance), {
      itemCountSnapshot
    });

    setProvenance(nextProvenance);

    if (options.immediate) {
      void enqueueAppStateSave({
        ...(currentPersistedAppStateRef.current ?? currentPersistedAppState),
        provenance: nextProvenance
      }, options.reason ?? "provenance");
    }

    return nextProvenance;
  }

  function buildImportedAppStateWithProvenance(nextAppState, options = {}) {
    const itemCountSnapshot = Math.max(0, Math.round(Number(options.itemCountSnapshot) || 0));

    return {
      ...(nextAppState ?? {}),
      provenance: markBackupImported(nextAppState?.provenance, {
        importedAt: options.importedAt,
        lastImportedBackupName: options.lastImportedBackupName,
        lastImportedBackupSource: options.lastImportedBackupSource,
        lastImportedBackupSchemaVersion: options.lastImportedBackupSchemaVersion,
        itemCountSnapshot
      })
    };
  }

  function applyLocalSafetyUpdate(buildNextLocalSafety) {
    const nextLocalSafety = normalizeLocalSafetyState(buildNextLocalSafety(localSafetyRef.current));
    localSafetyRef.current = nextLocalSafety;
    setLocalSafety(nextLocalSafety);

    if (!loading && persistenceReady && !importCommitInFlightRef.current) {
      const nextAppState = {
        ...(currentPersistedAppStateRef.current ?? currentPersistedAppState),
        localSafety: nextLocalSafety
      };
      void enqueueAppStateSave(nextAppState, "localSafety");
    }

    return nextLocalSafety;
  }

  function markMetadataDirty(changedItemIds = []) {
    applyLocalSafetyUpdate((currentLocalSafety) =>
      markMetadataChanged(currentLocalSafety, {
        changedItemIds
      })
    );
  }

  async function runMetadataSnapshot(reason, options = {}) {
    const snapshotState = {
      ...(options.appState ?? currentPersistedAppStateRef.current ?? currentPersistedAppState),
      localSafety: normalizeLocalSafetyState(options.localSafety ?? localSafety)
    };

    try {
      const result = await requestMetadataSnapshot({
        reason,
        items: options.items ?? items,
        appState: snapshotState,
        changedItemIds: options.changedItemIds,
        appVersion: APP_BUILD_VERSION,
        appBuildTime: APP_BUILD_TIME,
        priority: options.priority === "blocking" ? "blocking" : "background"
      });

      setLocalSafety(result?.localSafety ?? normalizeLocalSafetyState());
      return result;
    } catch (error) {
      console.error(`Metadata snapshot failed for ${reason}.`, error);
      setLocalSafety((current) =>
        normalizeLocalSafetyState({
          ...current,
          lastMetadataSnapshotError: error?.message || "Metadata snapshot failed."
        })
      );
      return null;
    }
  }

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
          recentOutfits,
          debugCandidates: isGuidedBoardCandidateDebug
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
          recentOutfits,
          debugCandidates: isGuidedBoardCandidateDebug
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
  }, [items, itemsById, excluded, imageCount, generationLists, generationMode, generationMetadataFilters, outfitFilters, weatherData, outfitAffinity, recentOutfits, loading, isGuidedBoardCandidateDebug]);

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
    if (suppressNextBoardRelayoutRef.current) {
      suppressNextBoardRelayoutRef.current = false;
      return;
    }
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
    document.documentElement.dataset.inputModality = "pointer";
    document.addEventListener("pointerdown", noteInteractionModality, true);
    document.addEventListener("keydown", noteInteractionModality, true);
    return () => {
      delete document.documentElement.dataset.inputModality;
      document.removeEventListener("pointerdown", noteInteractionModality, true);
      document.removeEventListener("keydown", noteInteractionModality, true);
    };
  }, []);

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

      if (
        referencePreview &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        const nextPreviewItem =
          event.key === "ArrowLeft"
            ? referencePreviewNavigation.previousItem
            : referencePreviewNavigation.nextItem;

        if (nextPreviewItem) {
          event.preventDefault();
          openReferencePreview(nextPreviewItem);
          return;
        }
      }

      if (event.key !== "Escape") {
        return;
      }

      if (cropEditorState) {
        event.preventDefault();
        blurRetainedPointerFocus();
        closeCropEditor();
        return;
      }

      if (confirmation) {
        event.preventDefault();
        blurRetainedPointerFocus();
        confirmation.onCancel();
        return;
      }

      if (fitpicPreview) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setFitpicPreview(null);
        return;
      }

      if (referencePreview) {
        event.preventDefault();
        blurRetainedPointerFocus();
        closeReferencePreview();
        return;
      }

      if (editingId) {
        event.preventDefault();
        blurRetainedPointerFocus();
        cancelEdit();
        return;
      }

      if (pickerBoardImageId) {
        event.preventDefault();
        blurRetainedPointerFocus();
        closePickerOverlay();
        return;
      }

      if (wardrobeFiltersOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setWardrobeFiltersOpen(false);
        return;
      }

      if (wardrobeWorthOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setWardrobeWorthOpen(false);
        return;
      }

      if (wardrobeSavedOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        closeWorkspacePanel();
        return;
      }

      if (wardrobeViewsOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setWardrobeViewsOpen(false);
        return;
      }

      if (mobileLibraryMoreOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setMobileLibraryMoreOpen(false);
        return;
      }

      if (wardrobeManageOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setWardrobeManageOpen(false);
        return;
      }

      if (wardrobeAddOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        closeWardrobeAdd();
        return;
      }

      if (librarySelectionActionsOpen || libraryTagActionMode) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setLibrarySelectionActionsOpen(false);
        setLibraryTagActionMode(null);
        return;
      }

      if (activePanel) {
        event.preventDefault();
        blurRetainedPointerFocus();
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
    referencePreviewNavigation.nextItem,
    referencePreviewNavigation.previousItem,
    cropEditorState,
    librarySelectionActionsOpen,
    libraryTagActionMode,
    wardrobeFiltersOpen,
    wardrobeAddOpen,
    wardrobeWorthOpen,
    wardrobeSavedOpen,
    wardrobeViewsOpen,
    mobileLibraryMoreOpen,
    wardrobeManageOpen
  ]);

  function handleGenerate() {
    if (isBoardGenerating || boardGenerationInFlightRef.current) {
      setShowBoardGenerationBusy(true);
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
          collectTopCandidates: outfitDebugOpen,
          debugCandidates: isGuidedBoardCandidateDebug
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
    const { items: effectiveItems } = await prepareLoadedItems(nextItems, nextAppState, getItemRepositoryDependencies(), {
      includeImageAssetMigration: true
    });

    setItems(effectiveItems);
    setLayering(Boolean(nextAppState?.layering));
    setAccessoriesEnabled(nextAppState?.accessoriesEnabled ?? true);
    setLocked(nextAppState?.locked ?? {});
    setExcluded(nextAppState?.excluded ?? {});
    const resolvedImageCount = resolvePersistedImageCount(nextAppState?.imageCount);
    const normalizedGenerationLists = normalizeGenerationLists(nextAppState?.generationLists);
    const normalizedGenerationMode = normalizeGenerationMode(nextAppState?.generationMode);
    const normalizedMetadataFilters = normalizeMetadataFilterState(nextAppState?.generationMetadataFilters);
    const normalizedWardrobeFilters = normalizeWardrobeFilterState(nextAppState?.wardrobeFilters);
    const normalizedWardrobeSort = normalizeWardrobeSort(nextAppState?.wardrobeSort);
    const normalizedPanelLayoutState = normalizePanelLayoutState(nextAppState?.panelLayoutState, getViewportWidth());
    const normalizedLibraryUiState = normalizeLibraryUiState(nextAppState?.libraryUiState);
    const normalizedOutfitFilters = normalizeOutfitFilters(nextAppState?.outfitFilters);
    const normalizedOutfitAffinity = normalizeOutfitAffinity(nextAppState?.outfitAffinity);
    const normalizedRecentOutfits = normalizeRecentOutfits(nextAppState?.recentOutfits);
    const restoredBoard = resolveBoardFromAppState(nextAppState, effectiveItems, getBoardRepositoryDependencies());
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
          recentOutfits: normalizedRecentOutfits,
          debugCandidates: isGuidedBoardCandidateDebug
        }).board
      : restoredBoard;
    pendingRestoredBoardFitRef.current = Boolean(nextBoard?.images?.length);
    setBoard(nextBoard);
    setImageCount(resolvedImageCount);
    setOutfit(boardToSyntheticOutfit(nextBoard));
    setBoardView(nextBoard ? getFittedBoardView(nextBoard) : { x: 0, y: 0, zoom: 1 });
    setGuidedDebugPayload([]);
    setIgnoredImportImages(nextAppState?.ignoredImportImages ?? []);
    setSavedOutfits(hydrateSavedBoards(nextAppState?.savedOutfits, effectiveItems, getBoardRepositoryDependencies()));
    setLikedOutfitKeys(normalizeLikedOutfitKeys(nextAppState?.likedOutfitKeys));
    setOutfitAffinity(normalizedOutfitAffinity);
    setRecentOutfits(normalizedRecentOutfits);
    setGenerationLists(normalizedGenerationLists);
    setGenerationMode(normalizedGenerationMode);
    setGenerationMetadataFilters(normalizedMetadataFilters);
    setWardrobeFilters(normalizedWardrobeFilters);
    setLibrarySearch(normalizeLibrarySearch(nextAppState?.librarySearch));
    setWardrobeSort(normalizedWardrobeSort);
    setSavedLibraryViews(normalizeSavedLibraryViews(nextAppState?.savedLibraryViews));
    setProvenance(normalizeLibraryProvenance(nextAppState?.provenance, {
      itemCountSnapshot: effectiveItems.length
    }));
    setLocalSafety(normalizeLocalSafetyState(nextAppState?.localSafety));
    setSideEditorWidth(normalizedPanelLayoutState.sideEditorWidth);
    setLibraryAddWidth(normalizedPanelLayoutState.libraryAddWidth);
    setOutfitFilters(normalizedOutfitFilters);
    setWeatherSettings(normalizeWeatherSettings(nextAppState?.weatherSettings));
    setWeatherLocationDraft(nextAppState?.weatherSettings?.locationName ?? "");
    setWeatherData(nextAppState?.weatherData ?? null);
    setFitpics(nextAppState?.fitpics ?? []);
    setEditingId(null);
    setEditorReturnTarget(null);
    setDraft(emptyForm);
    setActivePanel(normalizedLibraryUiState.libraryOpen ? "wardrobe" : null);
    setWardrobeFiltersOpen(normalizedLibraryUiState.wardrobeFiltersOpen);
    setWardrobeSavedOpen(normalizedLibraryUiState.wardrobeSavedOpen);
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

  async function verifyImportedPersistence(expectedItemCount, expectedAppState) {
    const [persistedItems, persistedAppState] = await Promise.all([
      loadStartupItemMetadata(),
      loadStartupAppState()
    ]);

    if ((persistedItems?.length ?? 0) !== expectedItemCount) {
      throw new Error(`Imported library persistence verification failed: expected ${expectedItemCount} items but found ${persistedItems?.length ?? 0}.`);
    }

    if (!persistedAppState) {
      throw new Error("Imported library persistence verification failed: app state is missing.");
    }

    const warnings = [];
    const expectedProvenance = normalizeLibraryProvenance(expectedAppState?.provenance, {
      itemCountSnapshot: expectedItemCount
    });
    const persistedProvenance = normalizeLibraryProvenance(persistedAppState?.provenance, {
      itemCountSnapshot: persistedItems.length
    });

    if (expectedProvenance.lastImportedBackupName && persistedProvenance.lastImportedBackupName !== expectedProvenance.lastImportedBackupName) {
      warnings.push("Imported backup name did not persist.");
    }

    if (expectedProvenance.lastImportedBackupSource && persistedProvenance.lastImportedBackupSource !== expectedProvenance.lastImportedBackupSource) {
      warnings.push("Imported backup source did not persist.");
    }

    if (
      expectedProvenance.lastImportedBackupSchemaVersion
      && persistedProvenance.lastImportedBackupSchemaVersion !== expectedProvenance.lastImportedBackupSchemaVersion
    ) {
      warnings.push("Imported backup schema version did not persist.");
    }

    return {
      items: persistedItems,
      appState: persistedAppState,
      warnings
    };
  }

  async function handleExportBackup() {
    try {
      const backup = await buildFullBackupExportData(items, currentPersistedAppState);
      const blob = createBackupExportBlob(backup);
      const formattedSize = formatFileSize(blob.size);

      if (blob.size >= BACKUP_EXPORT_WARN_BYTES) {
        const confirmed = await requestConfirmation({
          title: "Export very large backup?",
          message: `This full backup is about ${formattedSize}. Large JSON backups can be slow to save and may not import reliably in the browser. Continue with the full backup export?`,
          confirmLabel: "Export full backup"
        });

        if (!confirmed) {
          setBackupExportStatus("Full backup export canceled.");
          return;
        }
      }

      const date = new Date().toISOString().slice(0, 10);
      const downloadStatus = await downloadBlobFile(blob, `moodboard-app-backup-${date}.json`, {
        mimeType: "application/json"
      });

      if (downloadStatus === "cancelled") {
        setBackupExportStatus("Backup export canceled.");
        return;
      }

      if (downloadStatus === "saved") {
        applyProvenanceUpdate(
          (current) => markBackupExported(current, { itemCountSnapshot: items.length }),
          {
            itemCountSnapshot: items.length,
            immediate: true,
            reason: "backupExport"
          }
        );
        applyLocalSafetyUpdate((currentLocalSafety) => markFullBackupExported(currentLocalSafety));
        setBackupExportStatus(blob.size >= BACKUP_EXPORT_WARN_BYTES ? `Full backup saved (${formattedSize}).` : "Backup saved.");
        return;
      }

      setBackupExportStatus(
        blob.size >= BACKUP_EXPORT_WARN_BYTES
          ? `Full backup download attempted (${formattedSize}).`
          : "Backup download attempted."
      );
      applyProvenanceUpdate(
        (current) => markBackupExported(current, { itemCountSnapshot: items.length }),
        {
          itemCountSnapshot: items.length,
          immediate: true,
          reason: "backupExport"
        }
      );
      applyLocalSafetyUpdate((currentLocalSafety) => markFullBackupExported(currentLocalSafety));
    } catch {
      const fallbackBackup = buildMetadataOnlyBackupExportData(items, currentPersistedAppState);
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

  async function handleExportMetadataBackup() {
    try {
      const backup = buildMetadataOnlyBackupExportData(items, currentPersistedAppState);
      const blob = createBackupExportBlob(backup);
      const date = new Date().toISOString().slice(0, 10);
      const downloadStatus = await downloadBlobFile(blob, `moodboard-app-metadata-backup-${date}.json`, {
        mimeType: "application/json"
      });

      if (downloadStatus === "cancelled") {
        setBackupExportStatus("Metadata backup export canceled.");
        return;
      }

      if (downloadStatus === "saved") {
        setBackupExportStatus("Metadata backup saved.");
        return;
      }

      setBackupExportStatus("Metadata backup download attempted.");
    } catch {
      setBackupExportStatus("Metadata backup export failed in this browser.");
    }
  }

  async function handleExportBackupPackage() {
    const fileSystemAccessDebug = getFileSystemAccessDebugSnapshot(window);

    if (!fileSystemAccessDebug.isSupported) {
      setBackupExportStatus("Scalable backup packages require a browser with File System Access API support.");
      return;
    }

    setIsBackupPackageExporting(true);
    updateBackupPackageExportProgress({
      phase: "preparing",
      completed: 0,
      total: Array.isArray(items) ? items.length : 0
    });

    try {
      const directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });

      const result = await exportBackupPackageToDirectory({
        rootHandle: directoryHandle,
        items,
        appState: currentPersistedAppState,
        resolvePreviewAsset: resolvePreviewAssetForBackupPackageExport,
        createPreviewAsset: createPreviewImageAsset,
        createThumbnailAsset: createThumbnailImageAsset,
        onProgress: updateBackupPackageExportProgress
      });
      applyProvenanceUpdate(
        (current) => markBackupExported(current, { itemCountSnapshot: items.length }),
        {
          itemCountSnapshot: items.length,
          immediate: true,
          reason: "backupPackageExport"
        }
      );
      applyLocalSafetyUpdate((currentLocalSafety) => markFullBackupExported(currentLocalSafety));

      clearBackupPackageExportProgress();
      if (result.warningCount > 0) {
        console.warn("Scalable backup package export completed with warnings.", {
          appBuildVersion: APP_BUILD_VERSION,
          appBuildTime: APP_BUILD_TIME,
          warningCount: result.warningCount,
          warnings: result.warnings,
          warningReportFileName: result.warningReportFileName
        });
        setBackupExportStatus(
          `Scalable backup package saved with ${result.warningCount} warnings. See ${result.warningReportFileName}.`
        );
      } else {
        setBackupExportStatus("Scalable backup package saved.");
      }
    } catch (error) {
      clearBackupPackageExportProgress();
      if (error?.name === "AbortError") {
        setBackupExportStatus("Scalable backup package export canceled.");
        return;
      }

      const failureReason = formatErrorMessage(error, "Scalable backup package export failed.");
      console.error("Scalable backup package export failed.", {
        error,
        message: failureReason,
        appBuildVersion: APP_BUILD_VERSION,
        appBuildTime: APP_BUILD_TIME,
        fileSystemAccessDebug,
        itemCount: Array.isArray(items) ? items.length : 0
      });
      setBackupExportStatus(`Scalable backup package export failed: ${failureReason}`);
    } finally {
      setIsBackupPackageExporting(false);
    }
  }

  async function handleImportBackupPackage() {
    if (!isFileSystemAccessSupported(window)) {
      setBackupExportStatus("Scalable backup package imports require a browser with File System Access API support.");
      return;
    }

    setIsBackupPackageImporting(true);
    updateBackupPackageImportProgress({
      phase: "reading-manifest",
      completed: 0,
      total: 0
    });

    try {
      const directoryHandle = await window.showDirectoryPicker();
      const preparedPackage = await prepareBackupPackageImportFromDirectory(directoryHandle, {
        onProgress: updateBackupPackageImportProgress
      });
      const importedAppState = buildImportedAppStateWithProvenance(preparedPackage.appState, {
        importedAt: new Date().toISOString(),
        lastImportedBackupName: preparedPackage.backupName || directoryHandle?.name || "",
        lastImportedBackupSource: preparedPackage.source,
        lastImportedBackupSchemaVersion: String(preparedPackage.version ?? ""),
        itemCountSnapshot: preparedPackage.items.length
      });

      const confirmed = await requestConfirmation({
        title: "Import scalable backup package?",
        message: "This will replace all library data in this browser.",
        confirmLabel: "Import"
      });

      if (!confirmed) {
        clearBackupPackageImportProgress();
        setBackupExportStatus("Scalable backup package import canceled.");
        return;
      }

      updateBackupPackageImportProgress({
        phase: "importing",
        completed: preparedPackage.items.length,
        total: preparedPackage.items.length
      });
      importCommitInFlightRef.current = true;
      await drainAppStatePersistenceQueue();
      dropPendingAppStatePersistence();
      await runMetadataSnapshot("before-import", {
        priority: "blocking",
        changedItemIds: localSafety.changedItemIdsSinceSnapshot
      });
      await replaceWithPreparedBackupPackage({
        ...preparedPackage,
        appState: importedAppState
      });
      const verifiedImport = await verifyImportedPersistence(preparedPackage.items.length, importedAppState);
      await applyLoadedData(verifiedImport.items, verifiedImport.appState);
      clearBackupPackageImportProgress();
      if (verifiedImport.warnings.length) {
        console.warn("Scalable backup package import completed with provenance warnings.", verifiedImport.warnings);
        setBackupExportStatus(`Scalable backup package imported with warnings: ${verifiedImport.warnings.join(" ")}`);
      } else {
        setBackupExportStatus("Scalable backup package imported.");
      }
    } catch (error) {
      clearBackupPackageImportProgress();

      if (error?.name === "AbortError") {
        setBackupExportStatus("Scalable backup package import canceled.");
        return;
      }

      window.alert(error?.message || "This scalable backup package could not be imported.");
    } finally {
      importCommitInFlightRef.current = false;
      setIsBackupPackageImporting(false);
    }
  }

  async function handleImportBackup(event) {
    const [file] = event.target.files;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isLikelyJsonBackupFile(file)) {
      window.alert("This backup file must be a JSON export from this app.");
      return;
    }

    if (file.size <= 0) {
      window.alert("This backup file is empty.");
      return;
    }

    if (file.size > BACKUP_IMPORT_HARD_MAX_BYTES) {
      window.alert(
        `This backup file is ${formatFileSize(file.size)}, which is above the hard browser import limit of ${formatFileSize(BACKUP_IMPORT_HARD_MAX_BYTES)}. The app did not try to read it because extremely large imports can freeze or crash the browser. Use a smaller backup, or prefer a metadata-only backup where possible.`
      );
      return;
    }

    if (file.size > BACKUP_IMPORT_MAX_BYTES) {
      const confirmedLargeImport = await requestConfirmation({
        title: "Import large backup?",
        message: `This backup file is ${formatFileSize(file.size)}, which is above the normal browser safety limit of ${formatFileSize(BACKUP_IMPORT_MAX_BYTES)}. Reading and parsing a large full backup may freeze or crash the browser. Prefer a metadata-only backup where possible. Continue anyway?`,
        confirmLabel: "Read large backup"
      });

      if (!confirmedLargeImport) {
        return;
      }
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
    } catch (error) {
      window.alert(error?.message || "This is not a valid backup file for this app.");
      return;
    }

    const importedAppState = buildImportedAppStateWithProvenance(preparedBackup.appState, {
      importedAt: new Date().toISOString(),
      lastImportedBackupName: file.name || "",
      lastImportedBackupSource: preparedBackup.source,
      lastImportedBackupSchemaVersion: String(preparedBackup.version ?? ""),
      itemCountSnapshot: preparedBackup.items.length
    });

    const confirmed = await requestConfirmation({
      title: "Import backup?",
      message: "This will replace all library data in this browser.",
      confirmLabel: "Import"
    });

    if (!confirmed) {
      return;
    }

    try {
      importCommitInFlightRef.current = true;
      await drainAppStatePersistenceQueue();
      dropPendingAppStatePersistence();
      await runMetadataSnapshot("before-import", {
        priority: "blocking",
        changedItemIds: localSafety.changedItemIdsSinceSnapshot
      });
      await replaceWithPreparedBackup({
        ...preparedBackup,
        appState: importedAppState
      });
      const verifiedImport = await verifyImportedPersistence(preparedBackup.items.length, importedAppState);
      await applyLoadedData(verifiedImport.items, verifiedImport.appState);
      if (verifiedImport.warnings.length) {
        console.warn("Backup import completed with provenance warnings.", verifiedImport.warnings);
      }
      window.alert(verifiedImport.warnings.length ? `Backup imported with warnings: ${verifiedImport.warnings.join(" ")}` : "Backup imported.");
    } catch (error) {
      window.alert(error?.message || "This backup could not be imported.");
    } finally {
      importCommitInFlightRef.current = false;
    }
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

    let loadedEntries = [];

    try {
      loadedEntries = await Promise.all(
        exportEntries.map(async ({ image, item }) => ({
          image,
          item,
          media: await resolveItemMediaSource(item, "original")
        }))
      );
      const renderedEntries = await Promise.all(
        loadedEntries.map(async ({ image: boardImage, item, media }) => {
          const asset = await loadImage(resolveImageUrl(media?.src));

          return {
            boardImage,
            item,
            asset,
            renderMetadata: buildBoardRenderMetadata(
              {
                ...item,
                rotation: boardImage.rotation
              },
              {
                naturalWidth: Math.max(item.imageWidth || asset.naturalWidth, 1),
                naturalHeight: Math.max(item.imageHeight || asset.naturalHeight, 1)
              }
            )
          };
        })
      );
      const renderedEntriesWithBounds = renderedEntries.map(({ boardImage, item, asset, renderMetadata }) => {
        const bounds = getBoardItemRenderedBounds(boardImage, renderMetadata);

        return {
          boardImage,
          item,
          asset,
          renderMetadata,
          bounds
        };
      });
      const cropLeft = Math.max(Math.min(...renderedEntriesWithBounds.map(({ bounds }) => bounds.collisionRect.left)) - margin, 0);
      const cropTop = Math.max(Math.min(...renderedEntriesWithBounds.map(({ bounds }) => bounds.collisionRect.top)) - margin, 0);
      const cropRight = Math.min(
        Math.max(...renderedEntriesWithBounds.map(({ bounds }) => bounds.collisionRect.right)) + margin,
        board.width
      );
      const cropBottom = Math.min(
        Math.max(...renderedEntriesWithBounds.map(({ bounds }) => bounds.collisionRect.bottom)) + margin,
        board.height
      );
      const cropWidth = Math.max(cropRight - cropLeft, 1);
      const cropHeight = Math.max(cropBottom - cropTop, 1);

      canvas.width = Math.round(cropWidth * scale);
      canvas.height = Math.round(cropHeight * scale);
      context.scale(scale, scale);
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f7f7f7";
      context.fillRect(0, 0, cropWidth, cropHeight);

      renderedEntriesWithBounds.forEach(({ item, asset, bounds, renderMetadata }) => {
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
    } finally {
      loadedEntries.forEach(({ media }) => {
        media?.revoke?.();
      });
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

    let loadedItems = [];

    try {
      loadedItems = await Promise.all(
        shuffledItems.map(async (item) => ({
          item,
          media: await resolveItemMediaSource(item, "original")
        }))
      );
      const loadedImages = await Promise.all(
        loadedItems.map(async ({ item, media }) => ({
          item,
          media,
          image: await loadImage(resolveImageUrl(media?.src))
        }))
      );

      loadedImages.forEach(({ item, image }, index) => {
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
    } finally {
      loadedItems.forEach(({ media }) => {
        media?.revoke?.();
      });
    }
  }

  async function handleRunMediaIntegrityCheck() {
    if (isMediaIntegrityChecking) {
      return;
    }

    setMediaIntegrityError("");
    setIsMediaIntegrityChecking(true);

    try {
      const report = await runMediaIntegrityCheck();
      setMediaIntegrityReport(report);
    } catch (error) {
      setMediaIntegrityError(error instanceof Error ? error.message : "Failed to run media integrity check.");
    } finally {
      setIsMediaIntegrityChecking(false);
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

  function startCreate(event = null) {
    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(true);
    setReferencePreview(null);
    setSelectionEditorActive(false);
    setImageProcessing(false);
    setItemImporting(Boolean(freshImportSession?.active));
    setItemImageDragActive(false);
    closeCropEditor();
    setEditingId(null);
    setEditorReturnTarget(null);
    setEditorAdvancedOpen(false);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function startEdit(item, options = {}) {
    const normalizedItem = normalizeItem(item);
    const shouldOpenAdvanced = getAdvancedOverrideFields(
      normalizedItem,
      resolveTypeDefaults(normalizedItem.type)
    ).length > 0;
    const requestedReturnTarget = options.returnTarget ?? "wardrobe";
    const resolvedReturnTarget = isMobileViewport ? "outfit" : requestedReturnTarget;

    if (editingId === item.id && editorReturnTarget === resolvedReturnTarget) {
      setSelectionEditorActive(false);
      resetEditorState();
      return;
    }

    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    if (!options.preserveReferencePreview) {
      setReferencePreview(null);
    }
    setSelectionEditorActive(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImporting(false);
    setItemImageDragActive(false);
    setReplaceOriginalShouldRegenerate(false);
    setEditorReturnTarget(resolvedReturnTarget);
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
      setSelectedReferenceSelection({
        ids: {},
        anchorId: null
      });
    }

    resetEditorState();
  }

  function startFloatingEdit(item) {
    if (editingId === item?.id && editorReturnTarget === "outfit") {
      setSelectionEditorActive(false);
      resetEditorState();
      closePickerOverlay();
      setWardrobeFiltersOpen(false);
      setWardrobeWorthOpen(false);
      setWardrobeSavedOpen(false);
      setWardrobeManageOpen(false);
      return;
    }

    startEdit(item, { returnTarget: "outfit" });
    closePickerOverlay();
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
  }

  function startFloatingEditFromPreview(item) {
    if (editingId === item?.id && editorReturnTarget === "outfit") {
      setSelectionEditorActive(false);
      resetEditorState();
      return;
    }

    startEdit(item, { returnTarget: "outfit", preserveReferencePreview: true });
    closePickerOverlay();
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
  }

  function toggleBoardImageEdit(item) {
    if (!item) {
      return;
    }

    if (editingId === item.id && editorReturnTarget === "outfit") {
      setSelectionEditorActive(false);
      resetEditorState();
      return;
    }

    startFloatingEdit(item);
  }

  function toggleBoardImagePicker(image) {
    if (!image) {
      return;
    }

    if (pickerBoardImageId === image.id) {
      closePickerOverlay();
      setActiveBoardImageId(null);
      return;
    }

    openBoardImagePicker(image);
  }

  function closeBoardImageEdit() {
    setSelectionEditorActive(false);
    resetEditorState();
  }

  function closeBoardImagePickerSelection() {
    closePickerOverlay();
    setActiveBoardImageId(null);
  }

  function scheduleExcludedOutfitReconcile(nextExcluded) {
    latestExcludedStateRef.current = nextExcluded;

    if (excludedOutfitReconcileFrameRef.current) {
      return;
    }

    excludedOutfitReconcileFrameRef.current = window.requestAnimationFrame(() => {
      excludedOutfitReconcileFrameRef.current = 0;
      const reconcileExcluded = latestExcludedStateRef.current;

      startTransition(() => {
        setOutfit((previous) => {
          const sanitized = Object.fromEntries(
            Object.entries(previous ?? {}).map(([slot, equippedId]) => [
              slot,
              Boolean(reconcileExcluded[equippedId]) ? null : equippedId
            ])
          );
          const didChange = Object.keys(sanitized).some((slot) => sanitized[slot] !== previous?.[slot]);

          if (!didChange) {
            return previous;
          }

          return buildNextOutfit(
            items,
            sanitized,
            locked,
            layering,
            reconcileExcluded,
            generationLists,
            outfitFilters,
            weatherData,
            generationMode,
            outfitAffinity,
            recentOutfits
          );
        });
      });
    });
  }

  function setReferencesExcluded(referenceIds, nextExcludedValue) {
    const uniqueReferenceIds = [...new Set((referenceIds ?? []).filter(Boolean))];

    if (!uniqueReferenceIds.length) {
      return;
    }

    setExcluded((current) => {
      const nextExcluded = { ...current };
      let changed = false;

      uniqueReferenceIds.forEach((itemId) => {
        const isCurrentlyExcluded = Boolean(current[itemId]);

        if (nextExcludedValue) {
          if (!isCurrentlyExcluded) {
            nextExcluded[itemId] = true;
            changed = true;
          }
          return;
        }

        if (itemId in nextExcluded) {
          delete nextExcluded[itemId];
          changed = true;
        }
      });

      if (!changed) {
        return current;
      }

      latestExcludedStateRef.current = nextExcluded;

      if (nextExcludedValue) {
        scheduleExcludedOutfitReconcile(nextExcluded);
      }

      return nextExcluded;
    });
  }

  function excludeReferenceIds(referenceIds) {
    setReferencesExcluded(referenceIds, true);
  }

  function toggleExcluded(itemId) {
    setReferencesExcluded([itemId], !Boolean(excluded[itemId]));
  }

  function clearExcluded() {
    latestExcludedStateRef.current = {};
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

    if (selectedReferenceCount === 1 && editingId === selectedReferenceItems[0]?.id && editorReturnTarget !== "outfit") {
      setSelectionEditorActive(false);
      resetEditorState();
      return;
    }

    if (
      selectionEditorActive &&
      (
        (selectedReferenceCount === 1 && editingId === selectedReferenceItems[0]?.id && editorReturnTarget !== "outfit")
        || (selectedReferenceCount > 1 && !editingId)
      )
    ) {
      setSelectionEditorActive(false);
      resetEditorState();
      return;
    }

    setLibrarySelectionActionsOpen(false);
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

  function toggleMobileLibrarySelectionMode() {
    setMobileLibrarySelectMode((current) => !current);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeViewsOpen(false);
    setWardrobeAddOpen(false);
    setWardrobeFiltersOpen(false);
  }

  function toggleMobileLibraryMore(event = null) {
    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeViewsOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setWardrobeSavedOpen(false);
    setMobileLibraryMoreOpen((current) => !current);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function openMobileLibraryManage(event = null) {
    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeViewsOpen(false);
    setWardrobeSavedOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(true);
    setWardrobeAddOpen(false);
    cancelEditSavedOutfit();

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function openMobileLibraryAdd(event = null) {
    setMobileLibraryMoreOpen(false);
    startCreate(event);
  }

  function selectReference(itemId, event = null, options = {}) {
    const isToggleSelection = Boolean(options.forceToggleSelection || event?.metaKey || event?.ctrlKey);
    const isRangeSelection = Boolean(event?.shiftKey);

    setSelectedReferenceSelection((current) => {
      const { nextSelection, nextAnchorId } = getNextLibrarySelection({
        currentSelection: current.ids,
        itemId,
        visibleItemIds: visibleWardrobeItemIds,
        anchorId: current.anchorId,
        isToggleSelection,
        isRangeSelection
      });

      syncSelectionEditor(nextSelection);
      return {
        ids: nextSelection,
        anchorId: nextAnchorId
      };
    });

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function clearSelectedReferences() {
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
    setSelectionEditorActive(false);
    setSelectedReferenceSelection({
      ids: {},
      anchorId: null
    });
    resetEditorState();
  }

  function selectAllVisibleReferences() {
    if (!visibleWardrobeItemIds.length) {
      return;
    }

    const nextSelected = Object.fromEntries(visibleWardrobeItemIds.map((itemId) => [itemId, true]));
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
    setSelectedReferenceSelection({
      ids: nextSelected,
      anchorId: visibleWardrobeItemIds[0] ?? null
    });
    syncSelectionEditor(nextSelected);
  }

  function excludeSelectedReferences() {
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
    excludeReferenceIds(selectedReferenceIdList);
    setSelectionEditorActive(false);
    setSelectedReferenceSelection({
      ids: {},
      anchorId: null
    });
    resetEditorState();
  }

  async function deleteSelectedReferences() {
    const deleted = await deleteReferenceIds(selectedReferenceIdList, {
      title: "Delete selected references?",
      message: "These references will be removed from the library, moodboards, and saved boards in this browser.",
      confirmLabel: "Delete"
    });

    if (deleted) {
      setLibrarySelectionActionsOpen(false);
      setLibraryTagActionMode(null);
      setSelectionEditorActive(false);
      setSelectedReferenceSelection({
        ids: {},
        anchorId: null
      });
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

    await runMetadataSnapshot("before-bulk-edit", {
      priority: "blocking",
      changedItemIds: updatedItems.map((item) => item.id)
    });
    await saveItems(updatedItems);

    const updatedItemsById = Object.fromEntries(updatedItems.map((item) => [item.id, item]));
    setItems((current) => current.map((item) => updatedItemsById[item.id] ?? item));
    markMetadataDirty(updatedItems.map((item) => item.id));
    applyProvenanceUpdate(
      (current) => markLibraryEdited(current, { itemCountSnapshot: items.length }),
      { itemCountSnapshot: items.length }
    );
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

    await runMetadataSnapshot("before-bulk-edit", {
      priority: "blocking",
      changedItemIds: updatedItems.map((item) => item.id)
    });
    await saveItems(updatedItems);

    const updatedItemsById = Object.fromEntries(updatedItems.map((item) => [item.id, item]));
    setItems((current) => current.map((item) => updatedItemsById[item.id] ?? item));
    markMetadataDirty(updatedItems.map((item) => item.id));
    applyProvenanceUpdate(
      (current) => markLibraryEdited(current, { itemCountSnapshot: items.length }),
      { itemCountSnapshot: items.length }
    );
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

  async function applyImmediateBulkExcludedEdit(nextValue) {
    if (!selectedReferenceIdList.length || !nextValue) {
      return;
    }

    const nextExcludedValue = nextValue === "yes";
    const changedCount = selectedReferenceItems.reduce(
      (count, item) => count + (Boolean(excluded[item.id]) !== nextExcludedValue ? 1 : 0),
      0
    );

    if (!changedCount) {
      showTemporaryBulkMetadataFeedback("No changes applied");
      return;
    }

    setReferencesExcluded(selectedReferenceIdList, nextExcludedValue);

    showTemporaryBulkMetadataFeedback(
      `${nextExcludedValue ? "Excluded" : "Included"} ${changedCount} ${changedCount === 1 ? "item" : "items"}`
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

  function clearWardrobeFilterSearch() {
    setWardrobeFilterSearch("");
  }

  function clearWardrobeFiltersAndSearch() {
    setWardrobeFilters(emptyWardrobeFilters);
    setWardrobeFilterSearch("");
  }

  function clearLibrarySearch(event = null) {
    setLibrarySearch("");

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function promptForSavedLibraryViewName(initialValue = "") {
    if (typeof window === "undefined" || typeof window.prompt !== "function") {
      return "";
    }

    return window.prompt("Saved view name", initialValue)?.trim() ?? "";
  }

  function confirmSavedLibraryViewReplacement(name) {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return true;
    }

    return window.confirm(`Replace the existing saved view "${name}"?`);
  }

  function confirmSavedLibraryViewDelete(name) {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return true;
    }

    return window.confirm(`Delete the saved view "${name}"?`);
  }

  function applyLibrarySavedView(savedView, event = null) {
    const nextViewState = applySavedLibraryView(savedView);
    setLibrarySearch(nextViewState.searchQuery);
    setWardrobeFilters(nextViewState.filters);
    setWardrobeSort(nextViewState.sort);
    setWardrobeViewsOpen(false);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function applyControlsSavedLibraryView(savedView, event = null) {
    setGenerationMetadataFilters(applySavedLibraryViewToMetadataFilters(savedView));
    setControlsViewsOpen(false);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function handleSaveCurrentLibraryView(event = null) {
    const activeView = savedLibraryViews.find((view) => view.id === matchingSavedLibraryViewId) ?? null;
    const nextName = promptForSavedLibraryViewName(activeView?.name ?? "");

    if (!nextName) {
      return;
    }

    let saveResult = upsertSavedLibraryView(
      savedLibraryViews,
      nextName,
      {
        librarySearch: currentSavedLibraryViewSnapshot.searchQuery,
        wardrobeFilters: currentSavedLibraryViewSnapshot.filters,
        wardrobeSort: currentSavedLibraryViewSnapshot.sort
      },
      activeView ? { targetId: activeView.id } : {}
    );

    if (saveResult.conflictingView) {
      const shouldReplace = confirmSavedLibraryViewReplacement(saveResult.conflictingView.name);

      if (!shouldReplace) {
        return;
      }

      saveResult = upsertSavedLibraryView(
        savedLibraryViews,
        nextName,
        {
          librarySearch: currentSavedLibraryViewSnapshot.searchQuery,
          wardrobeFilters: currentSavedLibraryViewSnapshot.filters,
          wardrobeSort: currentSavedLibraryViewSnapshot.sort
        },
        {
          targetId: activeView?.id ?? "",
          allowReplace: true
        }
      );
    }

    setSavedLibraryViews(saveResult.savedViews);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function handleRenameSavedLibraryView(view) {
    const nextName = promptForSavedLibraryViewName(view?.name ?? "");

    if (!nextName || !view?.id) {
      return;
    }

    let renameResult = renameSavedLibraryView(savedLibraryViews, view.id, nextName);

    if (renameResult.conflictingView) {
      const shouldReplace = confirmSavedLibraryViewReplacement(renameResult.conflictingView.name);

      if (!shouldReplace) {
        return;
      }

      renameResult = renameSavedLibraryView(savedLibraryViews, view.id, nextName, { allowReplace: true });
    }

    setSavedLibraryViews(renameResult.savedViews);
  }

  function handleDeleteSavedLibraryView(view) {
    if (!view?.id || !confirmSavedLibraryViewDelete(view.name)) {
      return;
    }

    setSavedLibraryViews((current) => deleteSavedLibraryView(current, view.id));
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

    if (!hasEffectiveReferencePreviewSource(draft, draftResolvedPreviewMedia.src)) {
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
          : draft.id,
      name: uniqueName,
      description: trimmedDescription
    };
    const savedItem = await saveItem(nextItem);
    const persistedItem = mergeItemImageState(
      duplicate || editingId === "new"
        ? draft
        : items.find((item) => item.id === draft.id) ?? draft,
      savedItem ?? nextItem
    );

    if (!duplicate && editingId !== "new" && draft.id !== persistedItem.id) {
      await deleteItem(draft.id);
    }

    const nextItemCount = duplicate || editingId === "new"
      ? items.length + 1
      : items.length;

    setItems((current) => {
      const existingIndex = current.findIndex((item) =>
        item.id === (duplicate || editingId === "new" ? persistedItem.id : draft.id)
      );

      if (existingIndex === -1) {
        return [...current, persistedItem];
      }

      const clone = [...current];
      clone[existingIndex] = mergeItemImageState(clone[existingIndex], persistedItem);
      return clone;
    });
    markMetadataDirty([persistedItem.id]);
    applyProvenanceUpdate(
      (current) => markLibraryEdited(current, { itemCountSnapshot: nextItemCount }),
      { itemCountSnapshot: nextItemCount }
    );

    if (!duplicate && editingId !== "new" && draft.id !== persistedItem.id) {
      setOutfit((current) =>
        replaceItemIdInOutfit(current, draft.id, persistedItem.id)
      );
      setBoard((current) => current ? {
        ...current,
        images: current.images.map((image) =>
          image.referenceId === draft.id
            ? {
                ...image,
                referenceId: persistedItem.id,
                referenceItemUuid: persistedItem.itemUuid || image.referenceItemUuid || ""
              }
            : image
        )
      } : current);
      setSavedOutfits((current) =>
        current.map((savedOutfit) => ({
          ...savedOutfit,
          outfit: replaceItemIdInOutfit(savedOutfit.outfit, draft.id, persistedItem.id),
          board: savedOutfit.board
              ? {
                  ...savedOutfit.board,
                  images: savedOutfit.board.images.map((image) =>
                    image.referenceId === draft.id
                      ? {
                          ...image,
                          referenceId: persistedItem.id,
                          referenceItemUuid: persistedItem.itemUuid || image.referenceItemUuid || ""
                        }
                      : image
                  )
                }
              : savedOutfit.board
        }))
      );
    }

    if (duplicate) {
      setEditingId(persistedItem.id);
      setDraft(persistedItem);
      return persistedItem;
    }

    const shouldReturnToWardrobe = editorReturnTarget === "wardrobe" && activePanel !== "wardrobe";
    cancelEdit();

    if (shouldReturnToWardrobe) {
      setActivePanel("wardrobe");
      setControlsOpen(false);
    }

    return persistedItem;
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
      setFreshImportSession({
        active: true,
        total: selectedFiles.length,
        completed: 0,
        succeeded: 0,
        failed: 0,
        ignored: 0,
        currentFile: ""
      });
      await runMetadataSnapshot("before-import", {
        priority: "blocking",
        changedItemIds: localSafety.changedItemIdsSinceSnapshot
      });
      const result = await importReferenceFiles(selectedFiles, items, {
        bakeItemImagePresentation,
        createOriginalImageAsset,
        createPreviewImageAsset,
        createThumbnailImageAsset,
        createUniqueItemId,
        saveItem,
        onProgress: ({ file, total, completed, succeeded, failed, ignored }) => {
          setFreshImportSession({
            active: completed < total,
            total,
            completed,
            succeeded,
            failed,
            ignored,
            currentFile: file?.name ?? ""
          });
        }
      });

      result.failedFiles.forEach(({ file, error }) => {
        console.error(`Reference import failed for ${file?.name || "unknown file"}.`, error);
      });

      if (result.successfulItems.length) {
        const nextItemCount = items.length + result.successfulItems.length;
        setItems((current) => [...current, ...result.successfulItems]);
        markMetadataDirty(result.successfulItems.map((item) => item.id));
        applyProvenanceUpdate(
          (current) => markLibraryEdited(current, { itemCountSnapshot: nextItemCount }),
          { itemCountSnapshot: nextItemCount }
        );
      }

      setImageUploadError(getReferenceImportMessage(result));
    } finally {
      setItemImporting(false);
      setFreshImportSession((current) => current ? {
        ...current,
        active: false
      } : current);
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
      setDraft((current) => ({
        ...replaceItemImageSet({
          ...current,
          imageFrameScale: 100,
          imageScale: 100,
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageCropX: 0,
          imageCropY: 0,
          imageCropWidth: 100,
          imageCropHeight: 100
        }, nextImageSet),
        mediaUpdateIntent: "replace"
      }));
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

      setDraft((current) => ({
        ...replaceItemOriginalImage(current, originalAsset, replacementOptions),
        mediaUpdateIntent: "replace"
      }));
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
      mediaUpdateIntent: "remove",
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
    if (!draft.id && !draft.imageUrl.trim()) {
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
    const currentItem = items.find((item) => item.id === persistedDraft.id) ?? draft;
    const mergedDraft = mergeItemImageState(currentItem, persistedDraft);

    setDraft(mergedDraft);
    setItems((current) => current.map((item) => item.id === mergedDraft.id ? mergeItemImageState(item, mergedDraft) : item));
    setReferencePreview((current) => current?.id === mergedDraft.id ? mergeItemImageState(current, mergedDraft) : current);
    markMetadataDirty([mergedDraft.id]);
    void saveItem(persistedDraft).then((savedDraft) => {
      const nextSavedDraft = mergeItemImageState(currentItem, savedDraft ?? persistedDraft);
      setDraft((current) => current?.id === nextSavedDraft.id ? mergeItemImageState(current, nextSavedDraft) : current);
      setItems((current) =>
        current.map((item) => item.id === nextSavedDraft.id ? mergeItemImageState(item, nextSavedDraft) : item)
      );
      setReferencePreview((current) =>
        current?.id === nextSavedDraft.id ? mergeItemImageState(current, nextSavedDraft) : current
      );
    });
    applyProvenanceUpdate(
      (current) => markLibraryEdited(current, { itemCountSnapshot: items.length }),
      { itemCountSnapshot: items.length }
    );

    if (closeEditor) {
      cancelEdit();
    }

    return mergedDraft;
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
    const originalImageUrl = (draftBackgroundRemovalMedia.src || draft.imageUrl).trim();

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
            mediaUpdateIntent: "replace",
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
    const nextItemCount = items.filter((item) => !deletedReferenceIdSet.has(item.id)).length;

    await runMetadataSnapshot("before-delete", {
      priority: "blocking",
      changedItemIds: uniqueReferenceIds
    });
    await deleteItems(uniqueReferenceIds);
    setItems((current) => current.filter((item) => !deletedReferenceIdSet.has(item.id)));
    markMetadataDirty(uniqueReferenceIds);
    applyProvenanceUpdate(
      (current) => markLibraryEdited(current, { itemCountSnapshot: nextItemCount }),
      { itemCountSnapshot: nextItemCount }
    );
    setSelectedReferenceSelection((current) => ({
      ids: Object.fromEntries(
        Object.entries(current.ids).filter(([itemId, isSelected]) => !deletedReferenceIdSet.has(itemId) && isSelected)
      ),
      anchorId: current.anchorId && deletedReferenceIdSet.has(current.anchorId) ? null : current.anchorId
    }));
    setOutfit((current) => pruneOutfitForDeletedReferences(current, deletedReferenceIdSet));
    setBoard((current) => pruneBoardForDeletedReferences(current, deletedReferenceIdSet));
    setSavedOutfits((current) => pruneSavedOutfitsForDeletedReferences(current, deletedReferenceIdSet));

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
    suppressNextBoardRelayoutRef.current = true;
    setBoard((current) => {
      if (!current) {
        return current;
      }

      const nextItemUuid = itemsById[referenceId]?.itemUuid ?? "";
      return replaceBoardImageReferencePreservingLayout(
        current,
        imageId,
        referenceId,
        nextItemUuid || current.images.find((image) => image.id === imageId)?.referenceItemUuid || ""
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
        collectTopCandidates: outfitDebugOpen,
        debugCandidates: isGuidedBoardCandidateDebug
      }
    });

    if (!result?.boardImage) {
      return;
    }

    const nextBoardImages = board.images.map((image) => image.id === result.boardImage.id ? result.boardImage : image);

    suppressNextBoardRelayoutRef.current = true;
    setBoard((current) => {
      if (!current) {
        return current;
      }

      return replaceBoardImagePreservingLayout(current, result.boardImage);
    });
    setGuidedDebugPayload((current) =>
      result.guidedDebugEntry
        ? mergeGuidedDebugEntryIntoPayload(current, result.guidedDebugEntry, nextBoardImages)
        : current
    );
    setOutfit(boardToSyntheticOutfit({
      ...board,
      images: nextBoardImages
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
      return getCurrentBoardLayoutOptions();
    }

    const item = itemsById[referenceId];
    if (!item) {
      return getCurrentBoardLayoutOptions();
    }

    const renderMetadata = buildBoardRenderMetadata(item, metrics);
    const nextLayoutOptions = getCurrentBoardLayoutOptions();

    return {
      ...nextLayoutOptions,
      aspectRatiosByReferenceId: {
        ...nextLayoutOptions.aspectRatiosByReferenceId,
        [referenceId]: getItemPresentationAspectRatio(item, metrics)
      },
      sizeMultipliersByReferenceId: {
        ...nextLayoutOptions.sizeMultipliersByReferenceId,
        [referenceId]: renderMetadata.sizeMultiplier
      },
      renderMetadataByReferenceId: {
        ...nextLayoutOptions.renderMetadataByReferenceId,
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
    return getFittedBoardViewForViewport({
      boardWidth: nextBoard.width,
      boardHeight: nextBoard.height,
      viewportWidth: viewportRect.width,
      viewportHeight: viewportRect.height,
      boardImageCount: Array.isArray(nextBoard.images) ? nextBoard.images.length : 0,
      isMobileViewport,
      minZoom: BOARD_ZOOM_MIN,
      maxZoom: BOARD_ZOOM_MAX
    });
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

  function handleBoardViewportTouchStart(event) {
    if (!isMobileViewport || event.touches.length !== 2) {
      if (event.touches.length < 2) {
        boardPinchRef.current = null;
      }
      return;
    }

    const viewportRect = boardViewportRef.current?.getBoundingClientRect();
    const midpoint = getTouchMidpoint(event.touches);
    if (!viewportRect || !midpoint) {
      boardPinchRef.current = null;
      return;
    }

    event.preventDefault();
    boardInteractionRef.current = null;
    boardPinchRef.current = {
      distance: getTouchDistance(event.touches),
      anchor: {
        x: midpoint.clientX - viewportRect.left,
        y: midpoint.clientY - viewportRect.top
      }
    };
  }

  function handleBoardViewportTouchMove(event) {
    if (!isMobileViewport || !boardPinchRef.current || event.touches.length !== 2) {
      return;
    }

    const viewportRect = boardViewportRef.current?.getBoundingClientRect();
    const midpoint = getTouchMidpoint(event.touches);
    const distance = getTouchDistance(event.touches);
    if (!viewportRect || !midpoint || distance <= 0 || boardPinchRef.current.distance <= 0) {
      return;
    }

    event.preventDefault();
    const zoomFactor = distance / boardPinchRef.current.distance;
    const anchor = {
      x: midpoint.clientX - viewportRect.left,
      y: midpoint.clientY - viewportRect.top
    };
    zoomBoardView((currentZoom) => currentZoom * zoomFactor, anchor);
    boardPinchRef.current = {
      distance,
      anchor
    };
  }

  function handleBoardViewportTouchEnd(event) {
    if (event.touches.length < 2) {
      boardPinchRef.current = null;
    }
  }

  function handleBoardViewportGestureEvent(event) {
    if (!isMobileViewport) {
      return;
    }

    event.preventDefault();
  }

  useEffect(() => {
    const viewportElement = boardViewportRef.current;
    if (!viewportElement) {
      return undefined;
    }

    viewportElement.addEventListener("wheel", handleBoardViewportWheel, { passive: false });
    viewportElement.addEventListener("touchstart", handleBoardViewportTouchStart, { passive: false });
    viewportElement.addEventListener("touchmove", handleBoardViewportTouchMove, { passive: false });
    viewportElement.addEventListener("touchend", handleBoardViewportTouchEnd);
    viewportElement.addEventListener("touchcancel", handleBoardViewportTouchEnd);
    viewportElement.addEventListener("gesturestart", handleBoardViewportGestureEvent, { passive: false });
    viewportElement.addEventListener("gesturechange", handleBoardViewportGestureEvent, { passive: false });

    return () => {
      viewportElement.removeEventListener("wheel", handleBoardViewportWheel);
      viewportElement.removeEventListener("touchstart", handleBoardViewportTouchStart);
      viewportElement.removeEventListener("touchmove", handleBoardViewportTouchMove);
      viewportElement.removeEventListener("touchend", handleBoardViewportTouchEnd);
      viewportElement.removeEventListener("touchcancel", handleBoardViewportTouchEnd);
      viewportElement.removeEventListener("gesturestart", handleBoardViewportGestureEvent);
      viewportElement.removeEventListener("gesturechange", handleBoardViewportGestureEvent);
    };
  }, [board, isMobileViewport]);

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

        const nextSavedOutfits = current.filter((savedOutfit) => savedOutfit.id !== existingSavedOutfit.id);
        void enqueueAppStateSave({
          ...(currentPersistedAppStateRef.current ?? {}),
          savedOutfits: nextSavedOutfits.map((savedOutfit) => ensureSavedBoardUuid(savedOutfit))
        }, "saveCurrentOutfit.remove");
        return nextSavedOutfits;
      }

      const nextSavedOutfits = [
        normalizeSavedOutfit(
          {
            id: `saved_outfit_${Date.now()}`,
            name: createSavedOutfitName(current),
            description: "",
            board: {
              ...board,
              images: board.images.map((image) => ({
                ...image,
                referenceSourceKey: getReferenceSourceKey(itemsById[image.referenceId])
              }))
            }
          },
          {
            visibleSlots,
            itemsById
          }
        ),
        ...current
      ];
      void enqueueAppStateSave({
        ...(currentPersistedAppStateRef.current ?? {}),
        savedOutfits: nextSavedOutfits.map((savedOutfit) => ensureSavedBoardUuid(savedOutfit))
      }, "saveCurrentOutfit.add");
      return nextSavedOutfits;
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
    const nextBoard = normalizeBoard(savedOutfit.board, visibleSlots);

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
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
  }

  function closeWardrobeFilters(event = null) {
    setWardrobeFiltersOpen(false);

    if (event && (event.type === "pointerdown" || event.type === "pointerup" || event.type === "click")) {
      blurPointerActivatedControl(event);
    }
  }

  function closeWardrobeAdd(event = null) {
    setWardrobeAddOpen(false);
    setItemImageDragActive(false);

    if (event) {
      blurPointerActivatedControl(event);
    }
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

  function clearBackupPackageExportProgress() {
    backupPackageExportProgressRef.current = null;
    setBackupPackageExportProgress(null);
  }

  function updateBackupPackageExportProgress(nextProgress) {
    const normalizedProgress = nextProgress && typeof nextProgress === "object"
      ? {
          phase: nextProgress.phase || "",
          completed: Math.max(Number(nextProgress.completed) || 0, 0),
          total: Math.max(Number(nextProgress.total) || 0, 0)
        }
      : null;

    if (!normalizedProgress) {
      clearBackupPackageExportProgress();
      return;
    }

    const previousProgress = backupPackageExportProgressRef.current;
    const shouldPublish =
      !previousProgress
      || previousProgress.phase !== normalizedProgress.phase
      || normalizedProgress.completed === 0
      || normalizedProgress.completed >= normalizedProgress.total
      || normalizedProgress.completed - previousProgress.completed >= 25;

    backupPackageExportProgressRef.current = normalizedProgress;

    if (shouldPublish) {
      setBackupPackageExportProgress(normalizedProgress);
    }
  }

  function clearBackupPackageImportProgress() {
    backupPackageImportProgressRef.current = null;
    setBackupPackageImportProgress(null);
  }

  function updateBackupPackageImportProgress(nextProgress) {
    const normalizedProgress = nextProgress && typeof nextProgress === "object"
      ? {
          phase: nextProgress.phase || "",
          completed: Math.max(Number(nextProgress.completed) || 0, 0),
          total: Math.max(Number(nextProgress.total) || 0, 0)
        }
      : null;

    if (!normalizedProgress) {
      clearBackupPackageImportProgress();
      return;
    }

    const previousProgress = backupPackageImportProgressRef.current;
    const shouldPublish =
      !previousProgress
      || previousProgress.phase !== normalizedProgress.phase
      || normalizedProgress.completed === 0
      || normalizedProgress.completed >= normalizedProgress.total
      || normalizedProgress.completed - previousProgress.completed >= 25;

    backupPackageImportProgressRef.current = normalizedProgress;

    if (shouldPublish) {
      setBackupPackageImportProgress(normalizedProgress);
    }
  }

  function getBackupPackageExportProgressLabel(progress) {
    if (!progress) {
      return "";
    }

    if (progress.phase === "preparing") {
      return "Preparing package";
    }

    if (progress.phase === "writing-previews") {
      return `Writing previews: ${progress.completed} / ${progress.total}`;
    }

    if (progress.phase === "finalizing") {
      return "Finalizing package";
    }

    return "";
  }

  function getBackupPackageImportProgressLabel(progress) {
    if (!progress) {
      return "";
    }

    if (progress.phase === "reading-manifest") {
      return "Reading manifest";
    }

    if (progress.phase === "reading-app-state") {
      return "Reading app state";
    }

    if (progress.phase === "validating-items") {
      return `Validating items: ${progress.completed} / ${progress.total}`;
    }

    if (progress.phase === "verifying-previews") {
      return `Verifying previews: ${progress.completed} / ${progress.total}`;
    }

    if (progress.phase === "preparing-import") {
      return "Preparing import";
    }

    if (progress.phase === "importing") {
      return "Importing";
    }

    return "";
  }

  function getFreshImportProgressLabel(session) {
    if (!session) {
      return "";
    }

    const currentFile = session.currentFile ? `Current: ${session.currentFile}` : "Current: finishing";
    return `Imported ${session.completed} / ${session.total}. Success ${session.succeeded}. Failed ${session.failed}. Ignored ${session.ignored}. ${currentFile}`;
  }

  function toggleWorkspacePanel(panel, event = null) {
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
      setWardrobeViewsOpen(false);
      setMobileLibraryMoreOpen(false);
      setWardrobeManageOpen(false);
      setWardrobeAddOpen(false);
      setLibrarySelectionActionsOpen(false);
      setLibraryTagActionMode(null);
      setFitpicPreview(null);
      cancelEditSavedOutfit();
      setEditingId(null);
      setEditorReturnTarget(null);
      return nextPanel;
    });

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function openLibraryPanel(event = null) {
    const shouldClosePanel = activePanel === "wardrobe" && !wardrobeSavedOpen;

    if (shouldClosePanel) {
      closeWorkspacePanel();

      if (event) {
        blurPointerActivatedControl(event);
      }

      return;
    }

    closeUtilityWindows();
    setControlsOpen(false);
    setDockExpanded(isMobileViewport);
    setActivePanel("wardrobe");
    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeViewsOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
    setFitpicPreview(null);
    cancelEditSavedOutfit();
    setEditingId(null);
    setEditorReturnTarget(null);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function toggleSavedBoardsPanel(event = null) {
    const shouldClosePanel = activePanel === "wardrobe" && wardrobeSavedOpen;

    if (shouldClosePanel) {
      closeWorkspacePanel();

      if (event) {
        blurPointerActivatedControl(event);
      }

      return;
    }

    closeUtilityWindows();
    setControlsOpen(false);
    setDockExpanded(isMobileViewport);
    setActivePanel("wardrobe");
    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeViewsOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setWardrobeSavedOpen(true);
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
    setFitpicPreview(null);
    cancelEditSavedOutfit();
    setEditingId(null);
    setEditorReturnTarget(null);

    if (event) {
      blurPointerActivatedControl(event);
    }
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
    setWardrobeViewsOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
    setFitpicPreview(null);
    cancelEditSavedOutfit();
    cancelEdit();
  }

  function toggleControlsWindow(event = null) {
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
    setWardrobeViewsOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setLibrarySelectionActionsOpen(false);
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

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function openWardrobeFilters(event = null) {
    closeUtilityWindows();
    setWardrobeSavedOpen(false);
    setWardrobeViewsOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    cancelEditSavedOutfit();
    setWardrobeFiltersOpen((current) => !current);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function toggleWardrobeSaved() {
    closeUtilityWindows();
    setWardrobeViewsOpen(false);
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

  function toggleWardrobeViews(event = null) {
    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setControlsViewsOpen(false);
    setWardrobeSavedOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    cancelEditSavedOutfit();
    setWardrobeViewsOpen((current) => !current);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function toggleControlsViews(event = null) {
    setWardrobeViewsOpen(false);
    setControlsViewsOpen((current) => !current);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function toggleWardrobeManage(event = null) {
    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeViewsOpen(false);
    setMobileLibraryMoreOpen(false);
    setWardrobeAddOpen(false);
    setWardrobeSavedOpen(false);
    cancelEditSavedOutfit();
    setWardrobeManageOpen((current) => !current);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function toggleTagManagerExpanded(tag) {
    setExpandedTagManagerTags((current) => ({
      ...current,
      [tag]: !current[tag]
    }));
  }

  function openDashboardPanel(event = null) {
    if (activePanel === "dashboard") {
      closeWorkspacePanel();

      if (event) {
        blurPointerActivatedControl(event);
      }

      return;
    }

    closeUtilityWindows();
    setControlsOpen(false);
    setDockExpanded(isMobileViewport);
    setActivePanel("dashboard");
    setActiveBoardImageId(null);
    setPickerBoardImageId(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeViewsOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeAddOpen(false);
    setLibrarySelectionActionsOpen(false);
    setLibraryTagActionMode(null);
    setFitpicPreview(null);
    cancelEditSavedOutfit();
    setEditingId(null);
    setEditorReturnTarget(null);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function startSideEditorResize(event, edge = "left") {
    if (isMobileViewport) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const initialWidth = sideEditorWidth;

    sideEditorResizeCleanupRef.current?.();

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = normalizePanelLayoutState({
        sideEditorWidth: Math.round(initialWidth + (edge === "right" ? deltaX : -deltaX)),
        libraryAddWidth
      }, getViewportWidth()).sideEditorWidth;
      setSideEditorWidth(nextWidth);
    };

    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      sideEditorResizeCleanupRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    sideEditorResizeCleanupRef.current = stopResize;
  }

  function toggleLibraryTagAction(mode) {
    if (!selectedReferenceCount) {
      setLibrarySelectionActionsOpen(false);
      setLibraryTagActionMode(null);
      return;
    }

    setLibrarySelectionActionsOpen(true);
    setLibraryTagActionMode((current) => (current === mode ? null : mode));
  }

  function toggleLibrarySelectionActions() {
    if (!selectedReferenceCount) {
      setLibrarySelectionActionsOpen(false);
      setLibraryTagActionMode(null);
      return;
    }

    setLibrarySelectionActionsOpen((current) => {
      const nextOpen = !current;

      if (!nextOpen) {
        setLibraryTagActionMode(null);
      }

      return nextOpen;
    });
  }

  function loadAndCloseSavedOutfit(savedOutfit, event = null) {
    loadSavedOutfit(savedOutfit);
    cancelEditSavedOutfit();
    setWardrobeSavedOpen(false);
    setActivePanel(null);

    if (event) {
      blurPointerActivatedControl(event);
    }
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
                    aria-pressed={isExcluded}
                    aria-label={isExcluded ? "Include reference in generation" : "Exclude reference from generation"}
                  >
                    {isExcluded ? "Excluded" : "Exclude"}
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
                        onClick={(event) => loadAndCloseSavedOutfit(savedOutfit, event)}
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
                            aria-pressed={isExcluded}
                            aria-label={isExcluded ? "Include reference in generation" : "Exclude reference from generation"}
                          >
                            {isExcluded ? "Excluded" : "Exclude"}
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
                      aria-pressed={isExcluded}
                      aria-label={isExcluded ? "Include reference in generation" : "Exclude reference from generation"}
                    >
                      {isExcluded ? "Excluded" : "Exclude"}
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

  const backupPackageExportProgressLabel = getBackupPackageExportProgressLabel(backupPackageExportProgress);
  const backupPackageImportProgressLabel = getBackupPackageImportProgressLabel(backupPackageImportProgress);
  const appBuildLabel = formatAppBuildLabel();
  const fileSystemAccessDebug = typeof window !== "undefined"
    ? getFileSystemAccessDebugSnapshot(window)
    : getFileSystemAccessDebugSnapshot();
  const fileSystemAccessDebugLabel = fileSystemAccessDebug.isSupported
    ? `Available${fileSystemAccessDebug.isSecureContext ? " · secure context" : ""}${fileSystemAccessDebug.hasShowDirectoryPicker ? " · picker exposed" : ""}`
    : "Unavailable";
  const normalizedProvenance = normalizeLibraryProvenance(provenance, {
    itemCountSnapshot: items.length
  });
  const normalizedLocalSafety = normalizeLocalSafetyState(localSafety);
  const packageSchemaLabel = formatBackupSchemaLabel(normalizedProvenance);
  const lastBackupImportLabel = normalizedProvenance.lastImportedBackupName
    ? `${formatLibraryProvenanceValue(normalizedProvenance.lastBackupImportAt)} (${normalizedProvenance.lastImportedBackupName})`
    : formatLibraryProvenanceValue(normalizedProvenance.lastBackupImportAt);
  const provenanceStatusEntries = [
    ["Build", appBuildLabel],
    ["File System Access", fileSystemAccessDebugLabel],
    ["Library updated", formatLibraryProvenanceValue(normalizedProvenance.lastLibraryEditAt)],
    ["Last metadata snapshot", formatLibraryProvenanceValue(normalizedLocalSafety.lastMetadataSnapshotAt)],
    ["Metadata snapshot reason", normalizedLocalSafety.lastMetadataSnapshotReason || "None"],
    ["Last backup export", formatLibraryProvenanceValue(normalizedProvenance.lastBackupExportAt)],
    ["Changed since snapshot", normalizedLocalSafety.metadataDirtySinceSnapshot ? "Yes" : "No"],
    ["Changed since full backup", normalizedLocalSafety.metadataDirtySinceFullBackup ? "Yes" : "No"],
    ["Changed items since backup", String(normalizedLocalSafety.changedItemIdsSinceFullBackup.length)],
    ["Snapshot status", normalizedLocalSafety.lastMetadataSnapshotError || "Healthy"],
    ["Last backup import", lastBackupImportLabel],
    ["Items", String(normalizedProvenance.itemCountSnapshot || items.length || 0)],
    ["Package schema", packageSchemaLabel || "Unknown"]
  ];
  const mediaIntegritySummaryEntries = mediaIntegrityReport
    ? [
        ["Items", mediaIntegrityReport.summary.items],
        ["Preview assets", mediaIntegrityReport.summary.previewAssets],
        ["Thumbnail assets", mediaIntegrityReport.summary.thumbnailAssets],
        ["Original blobs", mediaIntegrityReport.summary.originalBlobs],
        ["Orphaned records", mediaIntegrityReport.summary.orphanedRecords],
        ["Missing preview", mediaIntegrityReport.summary.missingPreviewMediaItems],
        ["Missing any media", mediaIntegrityReport.summary.missingAnyMediaSourceItems],
        ["Duplicate media groups", mediaIntegrityReport.summary.duplicateMediaAssetGroups],
        ["Inline payload items", mediaIntegrityReport.summary.inlineMediaPayloadItems],
        ["Blob-backed imported previews", mediaIntegrityReport.summary.packageImportedBlobPreviewAssets]
      ]
    : [];
  const mediaIntegrityIssueEntries = mediaIntegrityReport
    ? [
        ["Missing preview media", mediaIntegrityReport.issues.itemsMissingPreviewMedia],
        ["Missing any media source", mediaIntegrityReport.issues.itemsMissingAnyMediaSource],
        ["Orphaned preview/thumbnail rows", mediaIntegrityReport.issues.orphanedItemMediaAssets],
        ["Orphaned original blobs", mediaIntegrityReport.issues.orphanedOriginalImageBlobs],
        ["Duplicate media rows", mediaIntegrityReport.issues.duplicateItemMediaAssetEntries],
        ["Inline payloads still persisted", mediaIntegrityReport.issues.itemsWithInlineMediaPayloads]
      ].filter(([, entry]) => entry.count > 0)
    : [];

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
          {boardGenerationError ? <span className="board-canvas-generation-status is-error">{boardGenerationError}</span> : null}
        </div>

        <div
          className={`board-canvas-viewport ${isMobileViewport ? "is-mobile-gesture-surface" : ""}`}
          ref={boardViewportRef}
          onPointerDown={handleBoardViewportPointerDown}
        >
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
                  isEditing={editingId === item.id && editorReturnTarget === "outfit"}
                  isPickerOpen={pickerBoardImageId === image.id}
                  onMetrics={(metrics) => syncBoardImageDimensions(image.id, item, metrics)}
                  onImagePointerDown={handleBoardImagePointerDown}
                  onImageDoubleClick={(boardImage, boardItem) => {
                    selectBoardImage(boardImage.id);
                    openReferencePreview(boardItem);
                  }}
                  onEditImage={toggleBoardImageEdit}
                  onCloseEdit={closeBoardImageEdit}
                  onSelectImage={toggleBoardImagePicker}
                  onCloseSelect={closeBoardImagePickerSelection}
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
                isMobileViewport={isMobileViewport}
                isMobileSelectMode={mobileLibrarySelectMode}
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
              isMobileViewport={isMobileViewport}
              isMobileSelectMode={mobileLibrarySelectMode}
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
    setIsReferencePreviewZoomed(false);
    setReferencePreviewZoomFocus(null);
    setMobileReferencePreviewScale(1);
    setMobileReferencePreviewChromeVisible(false);
    setMobileReferencePreviewActionsOpen(false);
    setMobileReferencePreviewInfoOpen(false);
    mobileReferencePreviewTouchRef.current = null;
    mobileReferencePreviewPinchRef.current = null;
    mobileReferencePreviewDidPinchRef.current = false;
    setReferencePreview(normalizeItem(item));
  }

  function closeReferencePreview() {
    setIsReferencePreviewZoomed(false);
    setReferencePreviewZoomFocus(null);
    setMobileReferencePreviewScale(1);
    setMobileReferencePreviewChromeVisible(false);
    setMobileReferencePreviewActionsOpen(false);
    setMobileReferencePreviewInfoOpen(false);
    mobileReferencePreviewTouchRef.current = null;
    mobileReferencePreviewPinchRef.current = null;
    mobileReferencePreviewDidPinchRef.current = false;
    if (referencePreviewStageRef.current) {
      referencePreviewStageRef.current.scrollLeft = 0;
      referencePreviewStageRef.current.scrollTop = 0;
    }
    setReferencePreview(null);
  }

  function openAdjacentReferencePreview(direction) {
    const nextPreviewItem =
      direction === "previous"
        ? referencePreviewNavigation.previousItem
        : referencePreviewNavigation.nextItem;

    if (!nextPreviewItem) {
      return;
    }

    openReferencePreview(nextPreviewItem);
  }

  function toggleReferencePreviewZoom(event = null) {
    if (isReferencePreviewZoomed) {
      setIsReferencePreviewZoomed(false);
      setReferencePreviewZoomFocus(null);
      setMobileReferencePreviewScale(1);
      mobileReferencePreviewPinchRef.current = null;
      mobileReferencePreviewDidPinchRef.current = false;
      if (referencePreviewStageRef.current) {
        referencePreviewStageRef.current.scrollLeft = 0;
        referencePreviewStageRef.current.scrollTop = 0;
      }
      return;
    }

    const focusRatio = getReferencePreviewClickFocus({
      clientX: event?.clientX,
      clientY: event?.clientY,
      contentRect: referencePreviewImageFrameRef.current?.getBoundingClientRect?.() ?? null
    });

    setReferencePreviewZoomFocus(focusRatio);
    setIsReferencePreviewZoomed(true);
  }

  function toggleMobileReferencePreviewChrome() {
    if (!isMobileViewport || !referencePreview) {
      return;
    }

    setMobileReferencePreviewChromeVisible((current) => {
      const nextVisible = !current;

      if (!nextVisible) {
        setMobileReferencePreviewActionsOpen(false);
        setMobileReferencePreviewInfoOpen(false);
      }

      return nextVisible;
    });
  }

  function toggleMobileReferencePreviewActions(event) {
    event.stopPropagation();
    setMobileReferencePreviewChromeVisible(true);
    setMobileReferencePreviewInfoOpen(false);
    setMobileReferencePreviewActionsOpen((current) => !current);
  }

  function toggleMobileReferencePreviewInfo(event) {
    event.stopPropagation();
    setMobileReferencePreviewChromeVisible(true);
    setMobileReferencePreviewActionsOpen(false);
    setMobileReferencePreviewInfoOpen((current) => !current);
  }

  function syncMobileReferencePreviewScale(nextScale) {
    const normalizedScale = Math.min(4, Math.max(1, Math.round(nextScale * 1000) / 1000));
    setMobileReferencePreviewScale(normalizedScale);
    setIsReferencePreviewZoomed(normalizedScale > 1.01);

    if (normalizedScale <= 1.01) {
      setReferencePreviewZoomFocus(null);
    }
  }

  function handleMobileReferencePreviewPinchStart(event) {
    if (!isMobileViewport || !referencePreview || event.touches.length !== 2) {
      if (event.touches.length < 2) {
        mobileReferencePreviewPinchRef.current = null;
      }
      return;
    }

    event.preventDefault();
    mobileReferencePreviewTouchRef.current = null;
    mobileReferencePreviewDidPinchRef.current = false;
    setMobileReferencePreviewChromeVisible(false);
    setMobileReferencePreviewActionsOpen(false);
    setMobileReferencePreviewInfoOpen(false);
    mobileReferencePreviewPinchRef.current = {
      distance: getTouchDistance(event.touches),
      scale: mobileReferencePreviewScaleRef.current
    };
  }

  function handleMobileReferencePreviewPinchMove(event) {
    if (!mobileReferencePreviewPinchRef.current || event.touches.length !== 2) {
      return;
    }

    const distance = getTouchDistance(event.touches);
    if (distance <= 0 || mobileReferencePreviewPinchRef.current.distance <= 0) {
      return;
    }

    event.preventDefault();
    mobileReferencePreviewDidPinchRef.current = true;
    syncMobileReferencePreviewScale(
      mobileReferencePreviewPinchRef.current.scale * (distance / mobileReferencePreviewPinchRef.current.distance)
    );
  }

  function handleMobileReferencePreviewPinchEnd(event) {
    if (event.touches.length >= 2) {
      return;
    }

    mobileReferencePreviewPinchRef.current = null;
    if (mobileReferencePreviewScaleRef.current <= 1.01) {
      syncMobileReferencePreviewScale(1);
      if (referencePreviewStageRef.current) {
        referencePreviewStageRef.current.scrollLeft = 0;
        referencePreviewStageRef.current.scrollTop = 0;
      }
    }
  }

  function handleMobileReferencePreviewGestureEvent(event) {
    if (!isMobileViewport || !referencePreview) {
      return;
    }

    event.preventDefault();
  }

  function handleReferencePreviewStageTouchStart(event) {
    if (!isMobileViewport || isReferencePreviewZoomed) {
      mobileReferencePreviewTouchRef.current = null;
      return;
    }

    if (event.touches.length !== 1) {
      mobileReferencePreviewTouchRef.current = null;
      return;
    }

    const touch = event.touches[0];
    mobileReferencePreviewTouchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      endX: touch.clientX,
      endY: touch.clientY
    };
  }

  function handleReferencePreviewStageTouchMove(event) {
    if (!mobileReferencePreviewTouchRef.current || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    mobileReferencePreviewTouchRef.current = {
      ...mobileReferencePreviewTouchRef.current,
      endX: touch.clientX,
      endY: touch.clientY
    };
  }

  function handleReferencePreviewStageTouchCancel() {
    mobileReferencePreviewTouchRef.current = null;
  }

  function handleReferencePreviewStageTouchEnd(event) {
    if (!mobileReferencePreviewTouchRef.current || isReferencePreviewZoomed) {
      mobileReferencePreviewTouchRef.current = null;
      return;
    }

    const direction = getReferencePreviewSwipeDirection(mobileReferencePreviewTouchRef.current);
    mobileReferencePreviewTouchRef.current = null;

    if (!direction) {
      return;
    }

    event.preventDefault();
    openAdjacentReferencePreview(direction);
  }

  useEffect(() => {
    const stageElement = referencePreviewStageRef.current;
    if (!stageElement || !isMobileViewport || !referencePreview) {
      return undefined;
    }

    stageElement.addEventListener("touchstart", handleMobileReferencePreviewPinchStart, { passive: false });
    stageElement.addEventListener("touchmove", handleMobileReferencePreviewPinchMove, { passive: false });
    stageElement.addEventListener("touchend", handleMobileReferencePreviewPinchEnd);
    stageElement.addEventListener("touchcancel", handleMobileReferencePreviewPinchEnd);
    stageElement.addEventListener("gesturestart", handleMobileReferencePreviewGestureEvent, { passive: false });
    stageElement.addEventListener("gesturechange", handleMobileReferencePreviewGestureEvent, { passive: false });

    return () => {
      stageElement.removeEventListener("touchstart", handleMobileReferencePreviewPinchStart);
      stageElement.removeEventListener("touchmove", handleMobileReferencePreviewPinchMove);
      stageElement.removeEventListener("touchend", handleMobileReferencePreviewPinchEnd);
      stageElement.removeEventListener("touchcancel", handleMobileReferencePreviewPinchEnd);
      stageElement.removeEventListener("gesturestart", handleMobileReferencePreviewGestureEvent);
      stageElement.removeEventListener("gesturechange", handleMobileReferencePreviewGestureEvent);
    };
  }, [isMobileViewport, referencePreview]);

  async function toggleReferencePreviewFavorite() {
    if (!referencePreview?.id) {
      return;
    }

    const nextReferencePreview = normalizeItem({
      ...referencePreview,
      favorite: !referencePreview.favorite,
      updatedAt: new Date().toISOString()
    });

    const savedReferencePreview = await saveItem(nextReferencePreview);
    const persistedReferencePreview = mergeItemImageState(referencePreview, savedReferencePreview ?? nextReferencePreview);
    setItems((current) =>
      current.map((item) =>
        item.id === persistedReferencePreview.id ? mergeItemImageState(item, persistedReferencePreview) : item
      )
    );
    setReferencePreview(persistedReferencePreview);
    markMetadataDirty([persistedReferencePreview.id]);
    applyProvenanceUpdate(
      (current) => markLibraryEdited(current, { itemCountSnapshot: items.length }),
      { itemCountSnapshot: items.length }
    );
  }

  async function deleteReferencePreviewItem() {
    if (!referencePreview?.id) {
      return;
    }

    await handleDelete(referencePreview.id);
  }

  const cropEditorBody = cropEditorState && cropEditorImageUrl ? (
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
            src={cropEditorImageUrl}
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
  const bulkExcludedValues = [...new Set(selectedReferenceItems.map((item) => Boolean(excluded[item.id])))];
  const showFavoriteSelectedAction = bulkFavoriteValues.length > 1 || !bulkFavoriteValues[0];
  const showUnfavoriteSelectedAction = bulkFavoriteValues.length > 1 || Boolean(bulkFavoriteValues[0]);
  const showExcludeSelectedAction = bulkExcludedValues.length > 1 || !bulkExcludedValues[0];
  const showIncludeSelectedAction = bulkExcludedValues.length > 1 || Boolean(bulkExcludedValues[0]);
  const libraryTagActionSuggestions = libraryTagActionMode === "remove" ? selectedReferenceTags : allLibraryTags;
  const libraryTagActionSelectedTags =
    libraryTagActionMode === "remove" ? bulkMetadataDraft.removeTags : bulkMetadataDraft.addTags;
  const referencePreviewExcluded = Boolean(referencePreview?.id && excluded[referencePreview.id]);
  const isSideEditorOpen = Boolean(isBulkSelectionEditing || (editingId && editorReturnTarget !== "outfit"));
  const isMobileFullscreenEditorOpen = Boolean((editingId || isBulkSelectionEditing) && isMobileViewport);
  const draftImageUrl = getEffectiveReferencePreviewSource(draft, draftResolvedPreviewMedia.src);
  const isDraftImageLoading = Boolean(editingId && draft.id && !draftImageUrl);
  const draftImageCrop = getNormalizedImageCrop(draft);
  const hasDraftImagePresentationAdjustments = Boolean(draftImageUrl) && (
    normalizeImageFrameScale(draft.imageFrameScale) !== 100 ||
    normalizeImageScale(draft.imageScale) !== 100 ||
    normalizeImageOffset(draft.imageOffsetX) !== 0 ||
    normalizeImageOffset(draft.imageOffsetY) !== 0 ||
    draftImageCrop.x !== 0 ||
    draftImageCrop.y !== 0 ||
    draftImageCrop.width !== 100 ||
    draftImageCrop.height !== 100
  );
  const floatingEditorWidth = !isMobileViewport
    ? Math.min(sideEditorWidth, getMaxSideEditorWidth(getViewportWidth()))
    : null;
  const floatingEditorStyle = !isMobileViewport && floatingEditorWidth !== null
    ? {
        width: `${floatingEditorWidth}px`
      }
    : undefined;
  const libraryAddWindowStyle = !isMobileViewport
    ? {
        "--wardrobe-add-width": `${libraryAddWidth}px`
      }
    : undefined;
  const floatingEditorShellStyle = !isMobileViewport && floatingEditorWidth !== null
    ? {
        "--floating-editor-width": `${floatingEditorWidth}px`
      }
    : undefined;
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
        <button type="button" className="ghost-button danger" onClick={deleteSelectedReferences}>Delete selected</button>
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
          {draftImageUrl ? (
            <ManagedItemImage item={draft} alt="" frameRef={editorImageFrameRef} imageRef={editorImageRef} />
          ) : isDraftImageLoading ? (
            <span>Loading image…</span>
          ) : (
            <span>No image selected</span>
          )}
        </div>
        {!draft.originalPreserved && draftImageUrl ? (
          <p className="image-preservation-note">Original not preserved</p>
        ) : null}
        <div className="item-image-actions">
          <div className="item-image-action-row item-image-action-row-primary">
            <label className="upload-button upload-button-secondary editor-image-button">
              {draftImageUrl ? "Change image" : "Choose image"}
              <input type="file" accept="image/*" multiple onChange={handleItemImageUpload} disabled={imageProcessing || itemImporting} />
            </label>
            {draftImageUrl ? (
              <button type="button" className="editor-image-button" onClick={openCropEditor} disabled={imageProcessing || itemImporting}>
                Crop
              </button>
            ) : null}
            <button
              type="button"
              className="editor-image-button"
              onClick={removeDraftBackground}
              disabled={!canRemoveDraftBackground || imageProcessing || itemImporting}
            >
              {imageProcessing ? "Removing..." : "Remove background"}
            </button>
          </div>
          {draftImageUrl ? (
            <div className="item-image-action-row item-image-action-row-secondary">
              <label className="upload-button upload-button-secondary editor-image-button editor-image-button-secondary">
                Replace original image
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReplaceOriginalImageUpload}
                  disabled={imageProcessing || itemImporting}
                />
              </label>
            </div>
          ) : null}
          {draftImageUrl ? (
            <div className="item-image-action-row item-image-action-row-checkbox">
              <label className="editor-inline-checkbox editor-inline-checkbox-technical">
                <input
                  type="checkbox"
                  checked={replaceOriginalShouldRegenerate}
                  onChange={(event) => setReplaceOriginalShouldRegenerate(event.target.checked)}
                  disabled={imageProcessing || itemImporting}
                />
                <span>Regenerate optimized previews</span>
              </label>
            </div>
          ) : null}
          {hasDraftImagePresentationAdjustments ? (
            <div className="item-image-action-row item-image-action-row-reset">
              <button type="button" className="editor-image-button" onClick={resetDraftImageCrop} disabled={imageProcessing || itemImporting}>
                Reset crop
              </button>
            </div>
          ) : null}
          {draftImageUrl ? (
            <div className="item-image-action-row item-image-action-row-destructive">
              <button type="button" className="editor-image-button editor-image-button-danger editor-remove-image-button" onClick={removeDraftImage} disabled={imageProcessing || itemImporting}>
                Remove image
              </button>
            </div>
          ) : null}
        </div>
        {imageUploadError ? <p className="form-error">{imageUploadError}</p> : null}
      </div>

      <div className="editor-core-fields">
        <div className="editor-field editor-tags-field">
          <div className="editor-label-row">
            <span>Tags</span>
          </div>
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
        </div>

        <div className="editor-metadata-row">
          <div className="editor-metadata-toggle-group">
            <button
              type="button"
              className={`editor-favorite-button ${draft.favorite ? "is-active" : ""}`}
              aria-pressed={Boolean(draft.favorite)}
              aria-label={draft.favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => {
                const nextFavorite = !draft.favorite;

                if (editorReturnTarget === "outfit" && editingId !== "new") {
                  updateExistingDraftItem({
                    ...draft,
                    favorite: nextFavorite
                  });
                  return;
                }

                setDraft((current) => ({ ...current, favorite: nextFavorite }));
              }}
            >
              <span aria-hidden="true">{draft.favorite ? "♥" : "♡"}</span>
            </button>
          </div>

          <label className="editor-inline-checkbox editor-inline-checkbox-subtle">
            <span>Show titles on cards</span>
            <input
              type="checkbox"
              checked={Boolean(draft.showTitleOnCard)}
              onChange={(event) => {
                const nextShowTitleOnCard = event.target.checked;

                if (editorReturnTarget === "outfit" && editingId !== "new") {
                  updateExistingDraftItem({
                    ...draft,
                    showTitleOnCard: nextShowTitleOnCard
                  });
                  return;
                }

                setDraft((current) => ({ ...current, showTitleOnCard: nextShowTitleOnCard }));
              }}
            />
          </label>
        </div>
        <datalist id="item-name-suggestions">
          {nameSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="editor-field">
          <div className="editor-label-row">
            <span>Name</span>
          </div>
          <input
            list="item-name-suggestions"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Concrete study, chrome lamp, gallery wall"
          />
        </div>

        <label>
          Description
          <textarea
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Short notes about the reference"
            rows="3"
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
              onClick={(event) => toggleControlsWindow(event)}
              aria-pressed={controlsOpen && !activePanel}
            >
              CONTROLS
            </button>
            <div className={`workspace-tab-group ${isDockExpanded ? "is-expanded" : ""}`}>
              <button
                type="button"
                className={`workspace-tab ${activePanel === "wardrobe" && !wardrobeSavedOpen ? "is-active" : ""}`}
                onClick={(event) => openLibraryPanel(event)}
                aria-pressed={activePanel === "wardrobe" && !wardrobeSavedOpen}
                tabIndex={isDockExpanded ? 0 : -1}
              >
                Library
              </button>
              <button
                type="button"
                className={`workspace-tab ${activePanel === "wardrobe" && wardrobeSavedOpen ? "is-active" : ""}`}
                onClick={(event) => toggleSavedBoardsPanel(event)}
                aria-pressed={activePanel === "wardrobe" && wardrobeSavedOpen}
                tabIndex={isDockExpanded ? 0 : -1}
              >
                Boards
              </button>
              <button
                type="button"
                className={`workspace-tab ${activePanel === "dashboard" ? "is-active" : ""}`}
                onClick={(event) => openDashboardPanel(event)}
                aria-pressed={activePanel === "dashboard"}
                tabIndex={isDockExpanded ? 0 : -1}
              >
                Dashboard
              </button>
            </div>
            {outfitPalette.length ? (
              paletteOpen ? (
                <button
                  type="button"
                  className="outfit-palette-inline"
                  onClick={(event) => {
                    setPaletteOpen(false);
                    blurPointerActivatedControl(event);
                  }}
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
                  onClick={(event) => {
                    setPaletteOpen(true);
                    blurPointerActivatedControl(event);
                  }}
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
                onClick={(event) => {
                  setControlsOpen(false);
                  blurPointerActivatedControl(event);
                }}
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
              >
                <button
                  type="button"
                  className={`controls-outfit-filters-toggle ${generationMetadataFiltersOpen || hasActiveGenerationMetadataFilters ? "is-active" : ""}`}
                  onClick={() => setGenerationMetadataFiltersOpen((current) => !current)}
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
                <div className="outfit-filters-panel">
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
                        headerActions={(
                          <div className="wardrobe-tag-match-toggle controls-reference-match-toggle" role="group" aria-label="Tag matching">
                            <button
                              type="button"
                              className={`wardrobe-tag-match-option ${generationMetadataFilters.tagMatchMode === "any" ? "is-active" : ""}`}
                              onClick={() =>
                                setGenerationMetadataFilters((current) => ({
                                  ...current,
                                  tagMatchMode: "any"
                                }))
                              }
                              aria-pressed={generationMetadataFilters.tagMatchMode === "any"}
                              title="Match any selected tag."
                            >
                              Any
                            </button>
                            <button
                              type="button"
                              className={`wardrobe-tag-match-option ${generationMetadataFilters.tagMatchMode === "grouped" ? "is-active" : ""}`}
                              onClick={() =>
                                setGenerationMetadataFilters((current) => ({
                                  ...current,
                                  tagMatchMode: "grouped"
                                }))
                              }
                              aria-pressed={generationMetadataFilters.tagMatchMode === "grouped"}
                              title="Require every selected top-level tag group to match, while allowing any selected tag within each group."
                            >
                              Grouped
                            </button>
                            <button
                              type="button"
                              className={`wardrobe-tag-match-option ${generationMetadataFilters.tagMatchMode === "all" ? "is-active" : ""}`}
                              onClick={() =>
                                setGenerationMetadataFilters((current) => ({
                                  ...current,
                                  tagMatchMode: "all"
                                }))
                              }
                              aria-pressed={generationMetadataFilters.tagMatchMode === "all"}
                              title="Require all selected tags."
                            >
                              All
                            </button>
                          </div>
                        )}
                      />

                      <div className="controls-reference-filter-actions">
                        <div ref={controlsViewsPopoverRef} className="library-popover-anchor">
                          <button
                            type="button"
                            className={`ghost-button controls-reference-views-button ${controlsViewsOpen || matchingControlsSavedLibraryViewId ? "is-active" : ""}`}
                            onClick={(event) => toggleControlsViews(event)}
                            aria-expanded={controlsViewsOpen}
                            aria-haspopup="dialog"
                            aria-controls="controls-library-views-popover"
                          >
                            Views
                          </button>
                          <div
                            id="controls-library-views-popover"
                            className={`wardrobe-manage-window wardrobe-saved-views-window controls-saved-views-window ${controlsViewsOpen ? "is-open" : ""}`}
                            aria-label="Saved library views for controls"
                          >
                            {savedLibraryViews.length ? (
                              <div className="saved-library-views-list" aria-label="Saved library views list for controls">
                                {savedLibraryViews.map((view) => {
                                  const isCurrentView = view.id === matchingControlsSavedLibraryViewId;

                                  return (
                                    <div key={view.id} className={`saved-library-view-row ${isCurrentView ? "is-current" : ""}`}>
                                      <button
                                        type="button"
                                        className="ghost-button saved-library-view-apply"
                                        onClick={(event) => applyControlsSavedLibraryView(view, event)}
                                      >
                                        <span>{view.name}</span>
                                        {isCurrentView ? <strong>Current</strong> : null}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="wardrobe-filter-empty saved-library-views-empty">No saved views yet.</p>
                            )}
                          </div>
                        </div>
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
          <div className="floating-backdrop active-panel-backdrop" onClick={closeWorkspacePanel}>
        <div
          className={`active-panel-overlay ${activePanel === "wardrobe" ? "is-wardrobe-panel" : ""} ${activePanel === "wardrobe" && isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}
          onPointerDownCapture={(event) => {
            if (!wardrobeFiltersOpen || activePanel !== "wardrobe") {
              return;
            }

            if (wardrobeFiltersPanelRef.current?.contains(event.target)) {
              return;
            }

            if (wardrobeFiltersTriggerRef.current?.contains(event.target)) {
              return;
            }

            if (isMobileViewport) {
              mobileFilterDismissClickSuppressionRef.current = true;
              suppressMobileLibraryCardInteractionUntilRef.current = Date.now() + 450;

              if (mobileFilterDismissClickSuppressionTimeoutRef.current) {
                window.clearTimeout(mobileFilterDismissClickSuppressionTimeoutRef.current);
              }

              mobileFilterDismissClickSuppressionTimeoutRef.current = window.setTimeout(() => {
                mobileFilterDismissClickSuppressionRef.current = false;
                mobileFilterDismissClickSuppressionTimeoutRef.current = null;
              }, 400);
            }

            event.preventDefault();
            event.stopPropagation();
            closeWardrobeFilters();
          }}
          onClick={(event) => event.stopPropagation()}
        >
        {activePanel === "wardrobe" ? (
        <div className={`wardrobe-workspace ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}>
          <div className={`panel wardrobe-panel ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}>
          <div className={`panel-header ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}>
            {wardrobeSavedOpen ? (
              <div className="wardrobe-subview-header">
                <div>
                  <p className="eyebrow">Boards</p>
                  <h2>Saved boards</h2>
                </div>
              </div>
            ) : (
              <div className={`library-command-bar ${showMobileLibrarySelectionToolbar ? "is-mobile-selection-toolbar" : ""}`}>
                {showMobileLibrarySelectionToolbar ? (
                  <div className="library-selection-toolbar">
                    <button
                      type="button"
                      className="ghost-button library-context-button"
                      onClick={toggleMobileLibrarySelectionMode}
                      aria-pressed={mobileLibrarySelectMode}
                    >
                      Done
                    </button>
                    <span className="library-selection-toolbar-status" aria-label={mobileLibrarySelectionStatusLabel}>
                      {mobileLibrarySelectionStatusLabel}
                    </span>
                    <button
                      type="button"
                      className="secondary-button library-context-button library-selection-edit-button"
                      onMouseDown={preventMouseButtonFocus}
                      onClick={openSelectionEditor}
                    >
                      Edit
                    </button>
                    <div
                      ref={librarySelectionActionsRef}
                      className={`library-tag-action-anchor ${isMobileViewport ? "is-mobile-library-actions-anchor" : ""}`}
                    >
                      <button
                        type="button"
                        className={`ghost-button library-context-button library-selection-actions-trigger ${librarySelectionActionsOpen || libraryTagActionMode ? "is-active" : ""}`}
                        onMouseDown={preventMouseButtonFocus}
                        onClick={toggleLibrarySelectionActions}
                        aria-expanded={librarySelectionActionsOpen || Boolean(libraryTagActionMode)}
                        aria-haspopup="menu"
                        aria-controls="library-selection-actions-popover"
                      >
                        Actions ▾
                      </button>
                      {(librarySelectionActionsOpen || libraryTagActionMode) ? (
                        <div
                          id="library-selection-actions-popover"
                          className={`selection-actions-popover ${isMobileViewport ? "is-mobile-library-actions-popover" : ""}`}
                          aria-label="Selection actions"
                        >
                          {libraryTagActionMode ? (
                            <div className="selection-action-editor">
                              <button
                                type="button"
                                className="ghost-button selection-action-back"
                                onClick={() => setLibraryTagActionMode(null)}
                              >
                                Back
                              </button>
                              <p className="selection-action-title">
                                {libraryTagActionMode === "add" ? "Add tags" : "Remove tags"}
                              </p>
                              <TagInput
                                selectedTags={libraryTagActionSelectedTags}
                                allTags={libraryTagActionSuggestions}
                                onChange={(nextTags) => {
                                  void handleImmediateBulkTagDraftChange(libraryTagActionMode, nextTags);
                                }}
                                placeholder={libraryTagActionMode === "add" ? "Add tag" : "Remove tag"}
                                autoFocus
                                showAllSuggestionsOnFocus
                                className="selection-action-tag-input"
                                suggestionsClassName="selection-action-tag-input-suggestions"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="selection-actions-popover-section">
                                <button
                                  type="button"
                                  className="selection-actions-popover-item"
                                  onClick={() => toggleLibraryTagAction("add")}
                                >
                                  Add tags
                                </button>
                                <button
                                  type="button"
                                  className="selection-actions-popover-item"
                                  onClick={() => toggleLibraryTagAction("remove")}
                                >
                                  Remove tags
                                </button>
                              </div>
                              <div className="selection-actions-popover-section selection-actions-popover-section-divider">
                                {showFavoriteSelectedAction ? (
                                  <button
                                    type="button"
                                    className="selection-actions-popover-item"
                                    onClick={async () => {
                                      setLibrarySelectionActionsOpen(false);
                                      await applyImmediateBulkFavoriteEdit("yes");
                                    }}
                                  >
                                    Favorite
                                  </button>
                                ) : null}
                                {showUnfavoriteSelectedAction ? (
                                  <button
                                    type="button"
                                    className="selection-actions-popover-item"
                                    onClick={async () => {
                                      setLibrarySelectionActionsOpen(false);
                                      await applyImmediateBulkFavoriteEdit("no");
                                    }}
                                  >
                                    Unfavorite
                                  </button>
                                ) : null}
                                {showExcludeSelectedAction ? (
                                  <button
                                    type="button"
                                    className="selection-actions-popover-item"
                                    onClick={async () => {
                                      setLibrarySelectionActionsOpen(false);
                                      await applyImmediateBulkExcludedEdit("yes");
                                    }}
                                  >
                                    Exclude
                                  </button>
                                ) : null}
                                {showIncludeSelectedAction ? (
                                  <button
                                    type="button"
                                    className="selection-actions-popover-item"
                                    onClick={async () => {
                                      setLibrarySelectionActionsOpen(false);
                                      await applyImmediateBulkExcludedEdit("no");
                                    }}
                                  >
                                    Include
                                  </button>
                                ) : null}
                              </div>
                              <div className="selection-actions-popover-section selection-actions-popover-section-danger">
                                <button
                                  type="button"
                                  className="selection-actions-popover-item is-danger"
                                  onClick={async () => {
                                    setLibrarySelectionActionsOpen(false);
                                    await deleteSelectedReferences();
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <>
                  <div className="library-command-bar-leading">
                    <div className="library-command-bar-search">
                      <label className="wardrobe-search-control">
                        <input
                          type="search"
                          aria-label="Search"
                          value={librarySearch}
                          onPointerDown={closeWardrobeFilters}
                          onFocus={closeWardrobeFilters}
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
                        ref={wardrobeFiltersTriggerRef}
                        type="button"
                        className={`secondary-button filter-button ${wardrobeFiltersOpen || hasActiveWardrobeFilters || matchingSavedLibraryViewId ? "is-active" : ""}`}
                        onClick={openWardrobeFilters}
                        aria-pressed={wardrobeFiltersOpen}
                        aria-expanded={wardrobeFiltersOpen}
                      >
                        Filter
                      </button>
                      {isMobileViewport ? (
                        <button
                          type="button"
                          className={`ghost-button library-context-button ${mobileLibrarySelectMode ? "is-active" : ""}`}
                          onClick={toggleMobileLibrarySelectionMode}
                          aria-pressed={mobileLibrarySelectMode}
                        >
                          {mobileLibrarySelectMode ? "Done" : "Select"}
                        </button>
                      ) : null}
                      <label className="wardrobe-sort-control">
                        <select
                          value={wardrobeSort}
                          onPointerDown={closeWardrobeFilters}
                          onFocus={closeWardrobeFilters}
                          onChange={(event) => setWardrobeSort(event.target.value)}
                        >
                          <option value="favorites">Favorites first</option>
                          <option value="name">Name A-Z</option>
                          <option value="name-desc">Name Z-A</option>
                          <option value="tag">Tag A-Z</option>
                          <option value="newest">Newest</option>
                          <option value="oldest">Oldest</option>
                        </select>
                      </label>
                      {isMobileViewport ? (
                        <div ref={mobileLibraryMorePopoverRef} className="library-popover-anchor library-mobile-more-anchor">
                          <button
                            type="button"
                            className={`ghost-button library-context-button ${mobileLibraryMoreOpen ? "is-active" : ""}`}
                            onClick={toggleMobileLibraryMore}
                            aria-expanded={mobileLibraryMoreOpen}
                            aria-haspopup="menu"
                            aria-controls="library-mobile-more-popover"
                          >
                            More
                          </button>
                          {mobileLibraryMoreOpen ? (
                            <div
                              id="library-mobile-more-popover"
                              className="selection-actions-popover library-mobile-more-popover"
                              aria-label="More library actions"
                            >
                              <button
                                type="button"
                                className="selection-actions-popover-item"
                                onClick={openMobileLibraryManage}
                              >
                                Manage
                              </button>
                              <button
                                type="button"
                                className="selection-actions-popover-item"
                                onClick={openMobileLibraryAdd}
                              >
                                Add
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div ref={wardrobeManagePopoverRef} className="library-popover-anchor">
                        {!isMobileViewport ? (
                          <button
                            type="button"
                            className={`ghost-button library-context-button ${wardrobeManageOpen ? "is-active" : ""}`}
                            onClick={(event) => toggleWardrobeManage(event)}
                            aria-expanded={wardrobeManageOpen}
                            aria-haspopup="dialog"
                            aria-controls="library-manage-popover"
                          >
                            Manage
                          </button>
                        ) : null}
                        <div
                          id="library-manage-popover"
                          className={`wardrobe-manage-window ${wardrobeManageOpen ? "is-open" : ""}`}
                          aria-label="Library management"
                        >
                          <section className="wardrobe-manage-section provenance-status-section" aria-label="Archive status">
                            <div className="wardrobe-manage-section-header">
                              <strong>Archive status</strong>
                              <span>Local provenance</span>
                            </div>
                            <div className="provenance-status-list">
                              {provenanceStatusEntries.map(([label, value]) => (
                                <p key={label} className="provenance-status-row">
                                  <span>{label}</span>
                                  <strong>{value}</strong>
                                </p>
                              ))}
                            </div>
                          </section>
                          <button type="button" className="ghost-button wardrobe-manage-action" onClick={handleExportWardrobeImage}>
                            Export library image
                          </button>
                          <button type="button" className="ghost-button wardrobe-manage-action" onClick={handleExportBackup}>
                            Export backup
                          </button>
                          <button type="button" className="ghost-button wardrobe-manage-action" onClick={handleExportMetadataBackup}>
                            Export metadata backup
                          </button>
                          <button
                            type="button"
                            className="ghost-button wardrobe-manage-action"
                            onClick={handleRunMediaIntegrityCheck}
                            disabled={isMediaIntegrityChecking}
                          >
                            {isMediaIntegrityChecking ? "Running media integrity check..." : "Run media integrity check"}
                          </button>
                          {mediaIntegrityError ? <p className="form-error tag-manager-feedback">{mediaIntegrityError}</p> : null}
                          {mediaIntegrityReport ? (
                            <section className="media-integrity-report" aria-label="Media integrity results">
                              <p className={`media-integrity-status ${mediaIntegrityReport.warningsFound ? "has-warnings" : "is-healthy"}`}>
                                {mediaIntegrityReport.warningsFound ? "Warnings found" : "Healthy"}
                              </p>
                              <div className="media-integrity-summary">
                                {mediaIntegritySummaryEntries.map(([label, value]) => (
                                  <p key={label} className="media-integrity-summary-row">
                                    <span>{label}</span>
                                    <strong>{value}</strong>
                                  </p>
                                ))}
                              </div>
                              {mediaIntegrityIssueEntries.length ? (
                                <div className="media-integrity-issues">
                                  {mediaIntegrityIssueEntries.map(([label, entry]) => (
                                    <div key={label} className="media-integrity-issue">
                                      <p className="media-integrity-issue-title">{label}: {entry.count}</p>
                                      {entry.samples.length ? (
                                        <p className="media-integrity-issue-samples">
                                          {entry.samples.map((sample) => formatMediaIntegritySample(sample)).filter(Boolean).join(", ")}
                                        </p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </section>
                          ) : null}
                          <button
                            type="button"
                            className="ghost-button wardrobe-manage-action"
                            onClick={handleExportBackupPackage}
                            disabled={isBackupPackageExporting || isBackupPackageImporting}
                          >
                            {isBackupPackageExporting ? "Exporting scalable backup package..." : "Export scalable backup package"}
                          </button>
                          {backupPackageExportProgressLabel ? <p className="form-success tag-manager-feedback">{backupPackageExportProgressLabel}</p> : null}
                          <button
                            type="button"
                            className="ghost-button wardrobe-manage-action"
                            onClick={handleImportBackupPackage}
                            disabled={isBackupPackageExporting || isBackupPackageImporting}
                          >
                            {isBackupPackageImporting ? "Importing scalable backup package..." : "Import scalable backup package"}
                          </button>
                          {backupPackageImportProgressLabel ? <p className="form-success tag-manager-feedback">{backupPackageImportProgressLabel}</p> : null}
                          <button type="button" className="ghost-button wardrobe-manage-action" onClick={() => importBackupRef.current?.click()}>
                            Import backup
                          </button>
                          {backupExportFeedback ? <p className="form-success tag-manager-feedback">{backupExportFeedback}</p> : null}
                          <div className="wardrobe-manage-divider" aria-hidden="true" />
                          <button
                            type="button"
                            className="ghost-button wardrobe-manage-action"
                            onClick={clearExcluded}
                            disabled={!excludedReferenceCount}
                          >
                            Clear excluded
                          </button>
                          <button type="button" className="ghost-button danger wardrobe-manage-action" onClick={handleResetToDefault}>
                            Reset to default
                          </button>
                        </div>
                      </div>
                      <div ref={wardrobeAddPopoverRef} className="library-popover-anchor">
                        {!isMobileViewport ? (
                          <button
                            type="button"
                            className={`primary-button library-context-button ${wardrobeAddOpen ? "is-active" : ""}`}
                            onClick={(event) => (wardrobeAddOpen ? closeWardrobeAdd(event) : startCreate(event))}
                            aria-expanded={wardrobeAddOpen}
                            aria-haspopup="dialog"
                            aria-controls="library-add-popover"
                          >
                            Add
                          </button>
                        ) : null}
                        <div
                          id="library-add-popover"
                          className={`wardrobe-add-window ${wardrobeAddOpen ? "is-open" : ""}`}
                          aria-label="Add references"
                          style={libraryAddWindowStyle}
                        >
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
                              {freshImportSession ? <p className="wardrobe-add-feedback">{getFreshImportProgressLabel(freshImportSession)}</p> : null}
                              {imageUploadError ? <p className="form-success wardrobe-add-feedback">{imageUploadError}</p> : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        ref={wardrobeFiltersPanelRef}
                        className={`wardrobe-controls ${wardrobeFiltersOpen ? "is-open" : ""}`}
                        aria-label="Library filters"
                      >
                        <label className="wardrobe-filter-search">
                          <span className="sr-only">Search filter tags</span>
                          <input
                            type="search"
                            value={wardrobeFilterSearch}
                            onChange={(event) => setWardrobeFilterSearch(event.target.value)}
                            placeholder="Search filter options"
                            aria-label="Search filter tags"
                          />
                        </label>

                        <details className="wardrobe-filter-row wardrobe-tags-filter" open>
                          <summary>
                            <span>Tags</span>
                          </summary>
                          <div className="wardrobe-tags-filter-body">
                            <div className="wardrobe-filter-section-header">
                              <span>Click to include. Shift-click to exclude.</span>
                            </div>
                            {hasVisibleWardrobeFilterOptions ? (
                              <TagTree
                                entries={filteredLibraryTagEntries}
                                selectedTags={wardrobeFilters.tags}
                                excludedTags={wardrobeFilters.excludedTags}
                                onToggleTag={toggleLibraryTagFilter}
                                onToggleGroup={toggleLibraryTagGroup}
                                storageKey="library-filters"
                                noTagsCount={filteredLibraryNoTagsCount}
                                searchQuery={wardrobeFilterSearchQuery}
                                headerActions={(
                                  <div className="wardrobe-tag-match-toggle" role="group" aria-label="Tag matching">
                                    <button
                                      type="button"
                                      className={`wardrobe-tag-match-option ${normalizedWardrobeFilters.tagMatchMode === "any" ? "is-active" : ""}`}
                                      onClick={(event) => {
                                        stopNestedTagTreeEvent(event);
                                        setWardrobeFilters((current) => ({ ...current, tagMatchMode: "any" }));
                                      }}
                                      aria-pressed={normalizedWardrobeFilters.tagMatchMode === "any"}
                                      title="Match any selected tag."
                                    >
                                      Any
                                    </button>
                                    <button
                                      type="button"
                                      className={`wardrobe-tag-match-option ${normalizedWardrobeFilters.tagMatchMode === "grouped" ? "is-active" : ""}`}
                                      onClick={(event) => {
                                        stopNestedTagTreeEvent(event);
                                        setWardrobeFilters((current) => ({ ...current, tagMatchMode: "grouped" }));
                                      }}
                                      aria-pressed={normalizedWardrobeFilters.tagMatchMode === "grouped"}
                                      title="Require every selected top-level tag group to match, while allowing any selected tag within each group."
                                    >
                                      Grouped
                                    </button>
                                    <button
                                      type="button"
                                      className={`wardrobe-tag-match-option ${normalizedWardrobeFilters.tagMatchMode === "all" ? "is-active" : ""}`}
                                      onClick={(event) => {
                                        stopNestedTagTreeEvent(event);
                                        setWardrobeFilters((current) => ({ ...current, tagMatchMode: "all" }));
                                      }}
                                      aria-pressed={normalizedWardrobeFilters.tagMatchMode === "all"}
                                      title="Require all selected tags."
                                    >
                                      All
                                    </button>
                                  </div>
                                )}
                              />
                            ) : (
                              <p className="wardrobe-filter-empty">No tags match this search.</p>
                            )}
                          </div>
                        </details>

                        <div className="wardrobe-controls-inline-row">
                          <details className="wardrobe-filter-row wardrobe-filter-saved-views">
                            <summary>
                              <span>Views</span>
                              {matchingSavedLibraryViewId ? (
                                <strong className="wardrobe-filter-row-summary-meta">Current</strong>
                              ) : null}
                            </summary>
                            <div className="wardrobe-filter-saved-views-body">
                              <div className="wardrobe-filter-section-header">
                                <span>Saved search, filter, and sort presets.</span>
                                <button
                                  type="button"
                                  className="ghost-button saved-library-view-save-button"
                                  onClick={handleSaveCurrentLibraryView}
                                >
                                  Save current view
                                </button>
                              </div>
                              {savedLibraryViews.length ? (
                                <div className="saved-library-views-list" aria-label="Saved library views list">
                                  {savedLibraryViews.map((view) => {
                                    const isCurrentView = view.id === matchingSavedLibraryViewId;

                                    return (
                                      <div key={view.id} className={`saved-library-view-row ${isCurrentView ? "is-current" : ""}`}>
                                        <button
                                          type="button"
                                          className="ghost-button saved-library-view-apply"
                                          onClick={(event) => applyLibrarySavedView(view, event)}
                                        >
                                          <span>{view.name}</span>
                                          {isCurrentView ? <strong>Current</strong> : null}
                                        </button>
                                        <div className="saved-library-view-actions">
                                          <button
                                            type="button"
                                            className="ghost-button saved-library-view-action"
                                            onClick={() => handleRenameSavedLibraryView(view)}
                                          >
                                            Rename
                                          </button>
                                          <button
                                            type="button"
                                            className="ghost-button saved-library-view-action danger"
                                            onClick={() => handleDeleteSavedLibraryView(view)}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="wardrobe-filter-empty saved-library-views-empty">No saved views yet.</p>
                              )}
                            </div>
                          </details>

                          <details className="wardrobe-filter-row">
                            <summary>
                              <span>Favorite</span>
                            </summary>
                            <div className="wardrobe-filter-row-options" role="group" aria-label="Favorite filter">
                              <button
                                type="button"
                                className={`wardrobe-filter-option ${!normalizedWardrobeFilters.favorite ? "is-active" : ""}`}
                                onClick={() => setWardrobeFilters((current) => ({ ...current, favorite: "" }))}
                                aria-pressed={!normalizedWardrobeFilters.favorite}
                              >
                                All
                              </button>
                              <button
                                type="button"
                                className={`wardrobe-filter-option ${normalizedWardrobeFilters.favorite === "yes" ? "is-active" : ""}`}
                                onClick={() => setWardrobeFilters((current) => ({ ...current, favorite: "yes" }))}
                                aria-pressed={normalizedWardrobeFilters.favorite === "yes"}
                              >
                                Favorites
                              </button>
                              <button
                                type="button"
                                className={`wardrobe-filter-option ${normalizedWardrobeFilters.favorite === "no" ? "is-active" : ""}`}
                                onClick={() => setWardrobeFilters((current) => ({ ...current, favorite: "no" }))}
                                aria-pressed={normalizedWardrobeFilters.favorite === "no"}
                              >
                                Not favorites
                              </button>
                            </div>
                          </details>

                          <details className="wardrobe-filter-row">
                            <summary>
                              <span>Exclude</span>
                            </summary>
                            <div className="wardrobe-filter-row-options" role="group" aria-label="Excluded filter">
                              <button
                                type="button"
                                className={`wardrobe-filter-option ${!normalizedWardrobeFilters.laundry ? "is-active" : ""}`}
                                onClick={() => setWardrobeFilters((current) => ({ ...current, laundry: "" }))}
                                aria-pressed={!normalizedWardrobeFilters.laundry}
                              >
                                All
                              </button>
                              <button
                                type="button"
                                className={`wardrobe-filter-option ${normalizedWardrobeFilters.laundry === "show" ? "is-active" : ""}`}
                                onClick={() => setWardrobeFilters((current) => ({ ...current, laundry: "show" }))}
                                aria-pressed={normalizedWardrobeFilters.laundry === "show"}
                              >
                                Show excluded
                              </button>
                              <button
                                type="button"
                                className={`wardrobe-filter-option ${normalizedWardrobeFilters.laundry === "hide" ? "is-active" : ""}`}
                                onClick={() => setWardrobeFilters((current) => ({ ...current, laundry: "hide" }))}
                                aria-pressed={normalizedWardrobeFilters.laundry === "hide"}
                              >
                                Hide excluded
                              </button>
                            </div>
                          </details>

                          <details
                            className="wardrobe-filter-row wardrobe-inline-filter-manage-tags"
                            open={manageTagsOpen}
                            onToggle={(event) => {
                              setManageTagsOpen(event.currentTarget.open);
                            }}
                          >
                            <summary>
                              <span>Manage Tags</span>
                            </summary>
                            {renderTagManagerPanelBody()}
                          </details>
                        </div>

                        <div className={`wardrobe-controls-footer ${(includedWardrobeFilterChips.length || excludedWardrobeFilterChips.length) ? "" : "is-without-selected-filters"}`.trim()}>
                          {(includedWardrobeFilterChips.length || excludedWardrobeFilterChips.length) ? (
                            <div className="wardrobe-selected-filters" aria-label="Active library filters">
                              <div className="wardrobe-popover-chips">
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
                            </div>
                          ) : null}

                          <div className="filter-summary-actions wardrobe-popover-actions">
                            <button
                              type="button"
                              className="ghost-button clear-filters-button"
                              onClick={clearWardrobeFiltersAndSearch}
                              disabled={!hasActiveWardrobeFilters && !wardrobeFilterSearch.trim()}
                            >
                              Clear search + filters
                            </button>
                            {isMobileViewport ? (
                              <button
                                type="button"
                                className="secondary-button mobile-filter-close-button"
                                onClick={closeWardrobeFilters}
                              >
                                Close
                              </button>
                            ) : null}
                          </div>
                        </div>
                    </div>
                  </div>
                </div>

                  <div className="library-command-bar-context">
                    <span className="library-image-count" aria-label={libraryImageCountLabel}>
                      {libraryImageCountLabel}
                    </span>
                    {hasSelectedReferences ? (
                      <div className="library-command-bar-context-selection">
                        <span className="wardrobe-selection-chip">
                          {selectedReferenceCount} selected
                          <button
                            type="button"
                            className="wardrobe-selection-chip-clear"
                            onMouseDown={preventMouseButtonFocus}
                            onClick={clearSelectedReferences}
                            aria-label="Clear selection"
                          >
                            ×
                          </button>
                        </span>
                        <div className="library-command-bar-context-actions">
                          <button
                            type="button"
                            className="secondary-button library-context-button library-selection-edit-button"
                            onMouseDown={preventMouseButtonFocus}
                            onClick={openSelectionEditor}
                          >
                            Edit
                          </button>
                          <div
                            ref={librarySelectionActionsRef}
                            className={`library-tag-action-anchor ${isMobileViewport ? "is-mobile-library-actions-anchor" : ""}`}
                          >
                            <button
                              type="button"
                              className={`ghost-button library-context-button library-selection-actions-trigger ${librarySelectionActionsOpen || libraryTagActionMode ? "is-active" : ""}`}
                              onMouseDown={preventMouseButtonFocus}
                              onClick={toggleLibrarySelectionActions}
                              aria-expanded={librarySelectionActionsOpen || Boolean(libraryTagActionMode)}
                              aria-haspopup="menu"
                              aria-controls="library-selection-actions-popover"
                            >
                              Actions ▾
                            </button>
                            {(librarySelectionActionsOpen || libraryTagActionMode) ? (
                              <div
                                id="library-selection-actions-popover"
                                className={`selection-actions-popover ${isMobileViewport ? "is-mobile-library-actions-popover" : ""}`}
                                aria-label="Selection actions"
                              >
                                {libraryTagActionMode ? (
                                  <div className="selection-action-editor">
                                    <button
                                      type="button"
                                      className="ghost-button selection-action-back"
                                      onClick={() => setLibraryTagActionMode(null)}
                                    >
                                      Back
                                    </button>
                                    <p className="selection-action-title">
                                      {libraryTagActionMode === "add" ? "Add tags" : "Remove tags"}
                                    </p>
                                    <TagInput
                                      selectedTags={libraryTagActionSelectedTags}
                                      allTags={libraryTagActionSuggestions}
                                      onChange={(nextTags) => {
                                        void handleImmediateBulkTagDraftChange(libraryTagActionMode, nextTags);
                                      }}
                                      placeholder={libraryTagActionMode === "add" ? "Add tag" : "Remove tag"}
                                      autoFocus
                                      showAllSuggestionsOnFocus
                                      className="selection-action-tag-input"
                                      suggestionsClassName="selection-action-tag-input-suggestions"
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <div className="selection-actions-popover-section">
                                      <button
                                        type="button"
                                        className="selection-actions-popover-item"
                                        onClick={() => toggleLibraryTagAction("add")}
                                      >
                                        Add tags
                                      </button>
                                      <button
                                        type="button"
                                        className="selection-actions-popover-item"
                                        onClick={() => toggleLibraryTagAction("remove")}
                                      >
                                        Remove tags
                                      </button>
                                    </div>
                                    <div className="selection-actions-popover-section selection-actions-popover-section-divider">
                                      {showFavoriteSelectedAction ? (
                                        <button
                                          type="button"
                                          className="selection-actions-popover-item"
                                          onClick={async () => {
                                            setLibrarySelectionActionsOpen(false);
                                            await applyImmediateBulkFavoriteEdit("yes");
                                          }}
                                        >
                                          Favorite
                                        </button>
                                      ) : null}
                                      {showUnfavoriteSelectedAction ? (
                                        <button
                                          type="button"
                                          className="selection-actions-popover-item"
                                          onClick={async () => {
                                            setLibrarySelectionActionsOpen(false);
                                            await applyImmediateBulkFavoriteEdit("no");
                                          }}
                                        >
                                          Unfavorite
                                        </button>
                                      ) : null}
                                      {showExcludeSelectedAction ? (
                                        <button
                                          type="button"
                                          className="selection-actions-popover-item"
                                          onClick={async () => {
                                            setLibrarySelectionActionsOpen(false);
                                            await applyImmediateBulkExcludedEdit("yes");
                                          }}
                                        >
                                          Exclude
                                        </button>
                                      ) : null}
                                      {showIncludeSelectedAction ? (
                                        <button
                                          type="button"
                                          className="selection-actions-popover-item"
                                          onClick={async () => {
                                            setLibrarySelectionActionsOpen(false);
                                            await applyImmediateBulkExcludedEdit("no");
                                          }}
                                        >
                                          Include
                                        </button>
                                      ) : null}
                                    </div>
                                    <div className="selection-actions-popover-section selection-actions-popover-section-danger">
                                      <button
                                        type="button"
                                        className="selection-actions-popover-item is-danger"
                                        onClick={async () => {
                                          setLibrarySelectionActionsOpen(false);
                                          await deleteSelectedReferences();
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  </>
                )}
                </div>
            )}
            </div>

            {wardrobeFiltersOpen ? (
              <div className="floating-backdrop filter-backdrop" aria-hidden="true" />
            ) : null}

            <input
              ref={importBackupRef}
              type="file"
              accept="application/json,.json"
              className="backup-file-input"
              onChange={handleImportBackup}
            />

            <div
              className={`wardrobe-panel-body ${isSideEditorOpen ? "has-side-editor" : ""} ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}
              style={!isMobileViewport ? { "--side-editor-width": `${sideEditorWidth}px` } : undefined}
            >
              <div
                ref={wardrobePanelScrollRef}
                className={`wardrobe-panel-scroll ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}
              >
                {wardrobeSavedOpen ? (
                  renderSavedOutfitsContent()
                ) : (
                  renderWardrobeGrid()
                )}
              </div>

              {isSideEditorOpen && !isMobileViewport ? (
                <div
                  className="side-editor-resize-handle"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize reference editor"
                  onPointerDown={startSideEditorResize}
                />
              ) : null}

              <aside
                ref={editorRef}
                className={`panel side-editor ${isSideEditorOpen ? "is-open" : ""} ${isMobileViewport ? "is-mobile-fullscreen" : ""}`}
              >
                {editorBody}
              </aside>
            </div>
          </div>
        </div>
        ) : null}

        {activePanel === "dashboard" ? (
        <section className="insights-stack dashboard-stack">
          <div className="panel fitpics-panel dashboard-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Dashboard</p>
                <h2>Library overview</h2>
              </div>
            </div>

            <section className="wardrobe-manage-section dashboard-stats-section" aria-label="Library stats">
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
                {libraryParentGroupEntries.length ? (
                  <div className="worth-row">
                    <div className="worth-row-header">
                      <strong>Semantic overview</strong>
                      <span>Dominant parent groups</span>
                    </div>
                    <div className="active-filter-chips">
                      {libraryParentGroupEntries.map(({ group, count }) => (
                        <span key={group} className="active-filter-chip">
                          <span>{group}</span>
                          {count}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </section>
        ) : null}

        </div>
        </div>
        ) : null}

        {(isBulkSelectionEditing && editorReturnTarget === "outfit") || (editingId && editorReturnTarget === "outfit") ? (
          <div
            className={`floating-item-editor-shell ${isMobileViewport ? "is-mobile-fullscreen" : ""}`}
            style={floatingEditorShellStyle}
          >
            <aside
              className={`panel floating-item-editor ${isMobileViewport ? "is-mobile-fullscreen" : ""}`}
              style={floatingEditorStyle}
            >
              {editorBody}
            </aside>
            {!isMobileViewport ? (
              <div
                className="floating-item-editor-resize-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize floating reference editor"
                onPointerDown={(event) => startSideEditorResize(event, "right")}
              />
            ) : null}
          </div>
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
          <div className="floating-backdrop fitpic-preview-backdrop" onClick={closeReferencePreview}>
            <div
              className={`fitpic-preview-overlay reference-preview-overlay ${referencePreviewExcluded ? "is-excluded" : ""} ${isReferencePreviewZoomed ? "is-zoomed" : ""} ${isMobileReferencePreview ? "is-mobile-preview" : ""}`}
              onClick={(event) => event.stopPropagation()}
            >
              {(() => {
                const referencePreviewTags = uniqueTags(referencePreview.tags);
                const referencePreviewTagLabel = referencePreviewTags.map((tag) => getLeafTagLabel(tag)).join(", ");
                const referencePreviewDescription = referencePreview.description?.trim() ?? "";

                if (isMobileReferencePreview) {
                  return (
                    <>
                      <div className={`reference-preview-mobile-chrome ${mobileReferencePreviewChromeVisible ? "is-visible" : ""}`}>
                        <button
                          type="button"
                          className="reference-preview-mobile-control"
                          onClick={closeReferencePreview}
                          aria-label="Close reference preview"
                        >
                          &lt;
                        </button>
                        <div className="reference-preview-mobile-control-group">
                          <button
                            type="button"
                            className="reference-preview-mobile-control"
                            onClick={toggleMobileReferencePreviewInfo}
                            aria-expanded={mobileReferencePreviewInfoOpen}
                            aria-label="Show reference info"
                          >
                            i
                          </button>
                          <div className="reference-preview-mobile-overflow">
                            <button
                              type="button"
                              className="reference-preview-mobile-control"
                              onClick={toggleMobileReferencePreviewActions}
                              aria-expanded={mobileReferencePreviewActionsOpen}
                              aria-haspopup="menu"
                              aria-label="Reference actions"
                            >
                              …
                            </button>
                            {mobileReferencePreviewActionsOpen ? (
                              <div className="selection-actions-popover reference-preview-overflow-menu" role="menu" aria-label="Reference actions">
                                <button
                                  type="button"
                                  className="selection-actions-popover-item"
                                  onClick={async () => {
                                    setMobileReferencePreviewActionsOpen(false);
                                    await toggleReferencePreviewFavorite();
                                  }}
                                >
                                  {referencePreview.favorite ? "Unfavorite" : "Favorite"}
                                </button>
                                <button
                                  type="button"
                                  className="selection-actions-popover-item"
                                  onClick={() => {
                                    setMobileReferencePreviewActionsOpen(false);
                                    toggleExcluded(referencePreview.id);
                                  }}
                                >
                                  {referencePreviewExcluded ? "Include" : "Exclude"}
                                </button>
                                <button
                                  type="button"
                                  className="selection-actions-popover-item"
                                  onClick={() => {
                                    setMobileReferencePreviewActionsOpen(false);
                                    startFloatingEditFromPreview(referencePreview);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="selection-actions-popover-item is-danger"
                                  onClick={async () => {
                                    setMobileReferencePreviewActionsOpen(false);
                                    await deleteReferencePreviewItem();
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div
                        ref={referencePreviewStageRef}
                        className={`reference-preview-stage reference-preview-mobile-stage ${isReferencePreviewZoomed ? "is-zoomed" : ""}`}
                        style={{ "--mobile-reference-preview-scale": mobileReferencePreviewScale }}
                        onTouchStart={handleReferencePreviewStageTouchStart}
                        onTouchMove={handleReferencePreviewStageTouchMove}
                        onTouchEnd={handleReferencePreviewStageTouchEnd}
                        onTouchCancel={handleReferencePreviewStageTouchCancel}
                      >
                        <button
                          type="button"
                          className={`reference-preview-image-button reference-preview-mobile-image-button ${isReferencePreviewZoomed ? "is-zoomed" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (mobileReferencePreviewDidPinchRef.current) {
                              mobileReferencePreviewDidPinchRef.current = false;
                              return;
                            }
                            toggleMobileReferencePreviewChrome();
                          }}
                          aria-pressed={mobileReferencePreviewChromeVisible}
                          aria-label={mobileReferencePreviewChromeVisible ? "Hide preview controls" : "Show preview controls"}
                        >
                          <ManagedItemImage
                            item={referencePreview}
                            alt={buildDisplayName(referencePreview)}
                            dataItemId={referencePreview.id}
                            frameRef={referencePreviewImageFrameRef}
                            variant="original"
                            useCrop
                            usePresentation
                          />
                        </button>
                      </div>
                      {mobileReferencePreviewInfoOpen ? (
                        <div className="reference-preview-mobile-sheet" onClick={(event) => event.stopPropagation()}>
                          <div className="reference-preview-mobile-sheet-header">
                            <strong>{buildDisplayName(referencePreview)}</strong>
                            {!referencePreview.originalPreserved ? <span className="image-preservation-note">Original not preserved</span> : null}
                          </div>
                          {referencePreviewTagLabel ? (
                            <div className="reference-preview-mobile-sheet-section">
                              <span className="reference-preview-mobile-sheet-label">Tags</span>
                              <p>{referencePreviewTagLabel}</p>
                            </div>
                          ) : null}
                          {referencePreviewDescription ? (
                            <div className="reference-preview-mobile-sheet-section">
                              <span className="reference-preview-mobile-sheet-label">Description</span>
                              <p>{referencePreviewDescription}</p>
                            </div>
                          ) : null}
                          <div className="reference-preview-mobile-sheet-section">
                            <span className="reference-preview-mobile-sheet-label">Status</span>
                            <p>
                              {referencePreview.favorite ? "Favorite" : "Not favorite"}
                              {referencePreviewExcluded ? " · Excluded from generation" : ""}
                              {!referencePreview.originalPreserved ? " · Original not preserved" : " · Original preserved"}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                }

                return (
                  <div className="fitpic-preview-header">
                    {isReferencePreviewZoomed ? (
                      <div className="reference-preview-actions reference-preview-actions-zoomed">
                        <button type="button" className="ghost-button" onClick={closeReferencePreview}>
                          Close
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="reference-preview-title">
                          <strong>{buildDisplayName(referencePreview)}</strong>
                          {referencePreviewTagLabel || referencePreviewDescription || referencePreview.favorite || referencePreviewExcluded ? (
                            <div className="reference-preview-meta" aria-label="Reference metadata">
                              {referencePreviewTagLabel ? <span title={referencePreviewTagLabel}>{referencePreviewTagLabel}</span> : null}
                              {referencePreviewDescription ? (
                                <span className="reference-preview-description" title={referencePreviewDescription}>
                                  {referencePreviewDescription}
                                </span>
                              ) : null}
                              {referencePreview.favorite ? (
                                <span className="wardrobe-meta-favorite" aria-label="Favorite">
                                  ♥
                                </span>
                              ) : null}
                              {referencePreviewExcluded ? <span className="reference-preview-status-chip">Excluded from generation</span> : null}
                            </div>
                          ) : null}
                          {!referencePreview.originalPreserved ? <span className="image-preservation-note">Original not preserved</span> : null}
                        </div>
                        <div className="reference-preview-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => openAdjacentReferencePreview("previous")}
                            disabled={!referencePreviewNavigation.hasPrevious}
                            aria-label="Previous reference"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => openAdjacentReferencePreview("next")}
                            disabled={!referencePreviewNavigation.hasNext}
                            aria-label="Next reference"
                          >
                            Next
                          </button>
                          <button
                            type="button"
                            className={`ghost-button ${referencePreviewExcluded ? "is-active" : ""}`}
                            onClick={() => toggleExcluded(referencePreview.id)}
                            aria-pressed={referencePreviewExcluded}
                            aria-label={referencePreviewExcluded ? "Include reference in generation" : "Exclude reference from generation"}
                          >
                            {referencePreviewExcluded ? "Excluded" : "Exclude"}
                          </button>
                          <button
                            type="button"
                            className={`ghost-button ${referencePreview.favorite ? "is-active" : ""}`}
                            onClick={toggleReferencePreviewFavorite}
                            aria-pressed={Boolean(referencePreview.favorite)}
                            aria-label={referencePreview.favorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            {referencePreview.favorite ? "Unfavorite" : "Favorite"}
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => startFloatingEditFromPreview(referencePreview)}
                            aria-label={`Edit ${buildDisplayName(referencePreview)}`}
                          >
                            Edit
                          </button>
                          <button type="button" className="ghost-button danger" onClick={deleteReferencePreviewItem}>
                            Delete
                          </button>
                          <button type="button" className="ghost-button" onClick={closeReferencePreview}>
                            Close
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              <div
                ref={referencePreviewStageRef}
                className={`reference-preview-stage ${isReferencePreviewZoomed ? "is-zoomed" : ""}`}
              >
                <button
                  type="button"
                  className={`reference-preview-image-button ${isReferencePreviewZoomed ? "is-zoomed" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleReferencePreviewZoom(event);
                  }}
                  aria-pressed={isReferencePreviewZoomed}
                  aria-label={isReferencePreviewZoomed ? "Return reference preview to fit view" : "Zoom reference preview"}
                >
                  <ManagedItemImage
                    item={referencePreview}
                    alt={buildDisplayName(referencePreview)}
                    dataItemId={referencePreview.id}
                    frameRef={referencePreviewImageFrameRef}
                    variant="original"
                    useCrop
                    usePresentation
                  />
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </section>
    </main>
  );
}
