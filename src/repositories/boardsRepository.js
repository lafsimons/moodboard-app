import { createBoardUuid, normalizeBoardUuid } from "../lib/boardIdentity.js";

function normalizeBoardImageReferenceItemUuid(image, itemsById) {
  if (typeof image?.referenceItemUuid === "string" && image.referenceItemUuid.trim()) {
    return image.referenceItemUuid;
  }

  const resolvedItem = itemsById?.[image?.referenceId];
  return typeof resolvedItem?.itemUuid === "string" ? resolvedItem.itemUuid.trim() : "";
}

export function normalizeBoard(board, visibleSlots = [], itemsById = {}) {
  if (!board || typeof board !== "object") {
    return null;
  }

  const images = Array.isArray(board.images)
    ? board.images
        .map((image, index) => normalizeBoardImage(image, index, visibleSlots, itemsById))
        .filter((entry) => entry?.referenceId)
    : [];

  if (!images.length) {
    return null;
  }

  return {
    id: typeof board.id === "string" ? board.id : `board_${Date.now()}`,
    boardUuid: normalizeBoardUuid(board.boardUuid) || createBoardUuid(),
    width: Math.max(800, Math.round(Number(board.width) || 1600)),
    height: Math.max(600, Math.round(Number(board.height) || 1200)),
    images
  };
}

function normalizeBoardImage(image, index = 0, visibleSlots = [], itemsById = {}) {
  if (!image || typeof image !== "object") {
    return null;
  }

  const width = Math.max(80, Math.round(Number(image.width) || 220));
  const height = Math.max(80, Math.round(Number(image.height) || 260));
  const fallbackSlot = visibleSlots[index % visibleSlots.length] ?? "";

  return {
    id: typeof image.id === "string" ? image.id : `board_image_${index}`,
    referenceId: typeof image.referenceId === "string" ? image.referenceId : "",
    referenceItemUuid: normalizeBoardImageReferenceItemUuid(image, itemsById),
    x: Math.round(Number(image.x) || 0),
    y: Math.round(Number(image.y) || 0),
    width,
    height,
    rotation: Math.round((Number(image.rotation) || 0) * 10) / 10,
    zIndex: Math.max(1, Math.round(Number(image.zIndex) || index + 1)),
    generationSlot: typeof image.generationSlot === "string" ? image.generationSlot : fallbackSlot
  };
}

export function normalizeSavedOutfit(savedOutfit, dependencies) {
  return {
    id: savedOutfit.id,
    name: savedOutfit.name ?? "Saved board",
    description: savedOutfit.description ?? "",
    board: normalizeBoard(savedOutfit.board, dependencies.visibleSlots, dependencies.itemsById),
    outfit: savedOutfit.outfit ?? {},
    layering: Boolean(savedOutfit.layering)
  };
}

export function normalizeSavedOutfits(savedOutfits, dependencies) {
  if (!Array.isArray(savedOutfits)) {
    return [];
  }

  const seenOutfitKeys = new Set();

  return savedOutfits.reduce((normalized, savedOutfit) => {
    const nextSavedOutfit = normalizeSavedOutfit(savedOutfit, dependencies);
    const outfitKey = nextSavedOutfit.board
      ? dependencies.getBoardKey(nextSavedOutfit.board)
      : dependencies.getOutfitKey(nextSavedOutfit.outfit, nextSavedOutfit.layering);

    if (seenOutfitKeys.has(outfitKey)) {
      return normalized;
    }

    seenOutfitKeys.add(outfitKey);
    normalized.push(nextSavedOutfit);
    return normalized;
  }, []);
}

export function hydrateSavedBoards(rawSavedOutfits, sourceItems, dependencies) {
  return normalizeSavedOutfits(rawSavedOutfits, dependencies)
    .map((savedOutfit) => {
      const boardFromState = normalizeBoard(savedOutfit.board, dependencies.visibleSlots, dependencies.itemsById);
      const hydratedBoard = boardFromState
        ? {
            ...boardFromState,
            images: boardFromState.images.filter((image) => dependencies.itemsById[image.referenceId])
          }
        : dependencies.buildBoardFromLegacyReferences(Object.values(savedOutfit.outfit ?? {}).filter(Boolean), sourceItems);

      return hydratedBoard?.images?.length
        ? {
            ...savedOutfit,
            board: hydratedBoard
          }
        : null;
    })
    .filter(Boolean);
}

export function resolveBoardFromAppState(appState, sourceItems, dependencies) {
  const normalizedBoard = normalizeBoard(appState?.board, dependencies.visibleSlots, dependencies.itemsById);

  if (normalizedBoard?.images?.length) {
    const filteredBoard = {
      ...normalizedBoard,
      images: normalizedBoard.images.filter((image) => dependencies.itemsById[image.referenceId])
    };

    if (filteredBoard.images.length) {
      return filteredBoard;
    }
  }

  const legacyReferenceIds = Object.values(appState?.outfit ?? {}).filter(Boolean);
  return dependencies.buildBoardFromLegacyReferences(legacyReferenceIds, sourceItems);
}

export function savedOutfitHasMissingItems(savedOutfit, itemsById) {
  if (savedOutfit.board?.images?.length) {
    return savedOutfit.board.images.some((image) => image.referenceId && !itemsById[image.referenceId]);
  }

  return Object.values(savedOutfit.outfit ?? {}).some((itemId) => itemId && !itemsById[itemId]);
}
