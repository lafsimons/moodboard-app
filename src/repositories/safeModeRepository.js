import {
  deleteSafeModeItems,
  loadSafeModeAppState,
  loadSafeModeItemMetadata,
  saveSafeModeAppState
} from "../lib/storage.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
}

function getDeletedSelectionSet(referenceIds = []) {
  return new Set((Array.isArray(referenceIds) ? referenceIds : []).filter(Boolean));
}

function pruneExcludedLookup(excluded, deletedReferenceIdSet) {
  if (!excluded || typeof excluded !== "object" || Array.isArray(excluded)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(excluded).filter(([referenceId, isExcluded]) => isExcluded && !deletedReferenceIdSet.has(referenceId))
  );
}

function pruneOutfit(outfit, deletedReferenceIdSet) {
  if (!outfit || typeof outfit !== "object" || Array.isArray(outfit)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(outfit).map(([slot, referenceId]) => [slot, deletedReferenceIdSet.has(referenceId) ? null : referenceId])
  );
}

function pruneBoard(board, deletedReferenceIdSet) {
  if (!board || typeof board !== "object") {
    return null;
  }

  const images = Array.isArray(board.images)
    ? board.images.filter((image) => !deletedReferenceIdSet.has(image?.referenceId))
    : [];

  return images.length
    ? {
        ...board,
        images
      }
    : null;
}

function pruneSavedOutfits(savedOutfits, deletedReferenceIdSet) {
  if (!Array.isArray(savedOutfits)) {
    return [];
  }

  return savedOutfits
    .map((savedOutfit) => {
      const nextBoard = pruneBoard(savedOutfit?.board, deletedReferenceIdSet);
      const nextOutfit = pruneOutfit(savedOutfit?.outfit, deletedReferenceIdSet);
      const hasOutfitReferences = Object.values(nextOutfit).some(Boolean);

      if (!nextBoard && !hasOutfitReferences) {
        return null;
      }

      return {
        ...savedOutfit,
        board: nextBoard,
        outfit: nextOutfit
      };
    })
    .filter(Boolean);
}

function summarizeAppState(appState) {
  const savedOutfits = Array.isArray(appState?.savedOutfits) ? appState.savedOutfits : [];
  const currentBoardImageCount = Array.isArray(appState?.board?.images) ? appState.board.images.length : 0;

  return {
    savedBoardCount: savedOutfits.length,
    currentBoardImageCount,
    hasCurrentBoard: currentBoardImageCount > 0,
    excludedCount: Object.values(appState?.excluded ?? {}).filter(Boolean).length
  };
}

function buildMetadataBackup(items, summary) {
  return {
    source: "moodboard-app-safe-mode-metadata",
    version: 1,
    exportedAt: new Date().toISOString(),
    summary,
    items: (Array.isArray(items) ? items : []).map((item) => ({
      id: normalizeText(item?.id),
      name: normalizeText(item?.name),
      tags: Array.isArray(item?.tags) ? item.tags.map((tag) => normalizeText(tag)).filter(Boolean) : [],
      favorite: Boolean(item?.favorite),
      excluded: Boolean(item?.excluded),
      originalFilename: normalizeText(item?.originalFilename),
      importedAt: normalizeTimestamp(item?.importedAt),
      createdAt: normalizeTimestamp(item?.createdAt),
      updatedAt: normalizeTimestamp(item?.updatedAt),
      fileSize: Math.max(0, Number(item?.fileSize) || 0),
      mimeType: normalizeText(item?.mimeType),
      imageWidth: Math.max(0, Number(item?.imageWidth) || 0),
      imageHeight: Math.max(0, Number(item?.imageHeight) || 0)
    }))
  };
}

function getMostRecentTimestamp(item) {
  return Math.max(
    normalizeTimestamp(item?.importedAt),
    normalizeTimestamp(item?.createdAt),
    normalizeTimestamp(item?.updatedAt)
  );
}

export async function loadSafeModeLibraryMetadata({
  batchSize = 50,
  onBatch = null
} = {}) {
  const appState = await loadSafeModeAppState();
  const excludedById =
    appState?.excluded && typeof appState.excluded === "object" && !Array.isArray(appState.excluded)
      ? appState.excluded
      : {};
  const items = await loadSafeModeItemMetadata({
    batchSize,
    excludedById,
    onBatch
  });

  return {
    items,
    summary: summarizeAppState(appState)
  };
}

export function createSafeModeMetadataBackup(items, summary) {
  return buildMetadataBackup(items, summary);
}

export async function deleteSafeModeReferences(referenceIds = []) {
  const deletedReferenceIdSet = getDeletedSelectionSet(referenceIds);

  if (!deletedReferenceIdSet.size) {
    return {
      deletedCount: 0,
      summary: summarizeAppState(await loadSafeModeAppState())
    };
  }

  await deleteSafeModeItems([...deletedReferenceIdSet]);

  const appState = await loadSafeModeAppState();

  if (appState) {
    await saveSafeModeAppState({
      ...appState,
      excluded: pruneExcludedLookup(appState.excluded, deletedReferenceIdSet),
      outfit: pruneOutfit(appState.outfit, deletedReferenceIdSet),
      board: pruneBoard(appState.board, deletedReferenceIdSet),
      savedOutfits: pruneSavedOutfits(appState.savedOutfits, deletedReferenceIdSet)
    });
  }

  return {
    deletedCount: deletedReferenceIdSet.size,
    summary: summarizeAppState(appState ? await loadSafeModeAppState() : null)
  };
}

export function getMostRecentReferenceIds(items = [], count = 0) {
  const normalizedCount = Math.max(0, Math.round(Number(count) || 0));

  return (Array.isArray(items) ? items : [])
    .filter((item) => normalizeText(item?.id))
    .slice()
    .sort((left, right) => {
      const timestampDelta = getMostRecentTimestamp(right) - getMostRecentTimestamp(left);

      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return normalizeText(right?.id).localeCompare(normalizeText(left?.id));
    })
    .slice(0, normalizedCount)
    .map((item) => item.id);
}

export async function clearSafeModeGeneratedBoards() {
  const appState = await loadSafeModeAppState();

  if (!appState) {
    return {
      cleared: false,
      summary: summarizeAppState(null)
    };
  }

  await saveSafeModeAppState({
    ...appState,
    outfit: {},
    board: null,
    savedOutfits: [],
    recentOutfits: []
  });

  return {
    cleared: true,
    summary: summarizeAppState(await loadSafeModeAppState())
  };
}
