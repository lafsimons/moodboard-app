export function pruneOutfitForDeletedReferences(outfit, deletedReferenceIdSet) {
  if (!outfit || typeof outfit !== "object" || Array.isArray(outfit)) {
    return outfit;
  }

  let changed = false;
  const nextEntries = Object.entries(outfit).map(([slot, equippedId]) => {
    if (deletedReferenceIdSet.has(equippedId)) {
      changed = true;
      return [slot, null];
    }

    return [slot, equippedId];
  });

  return changed ? Object.fromEntries(nextEntries) : outfit;
}

export function pruneBoardForDeletedReferences(board, deletedReferenceIdSet) {
  if (!board || typeof board !== "object" || Array.isArray(board) || !Array.isArray(board.images)) {
    return board;
  }

  const hasDeletedImage = board.images.some((image) => deletedReferenceIdSet.has(image?.referenceId));

  if (!hasDeletedImage) {
    return board;
  }

  return {
    ...board,
    images: board.images.filter((image) => !deletedReferenceIdSet.has(image.referenceId))
  };
}

export function pruneSavedOutfitsForDeletedReferences(savedOutfits, deletedReferenceIdSet) {
  if (!Array.isArray(savedOutfits)) {
    return savedOutfits;
  }

  let changed = false;
  const nextSavedOutfits = savedOutfits.map((savedOutfit) => {
    const nextOutfit = pruneOutfitForDeletedReferences(savedOutfit?.outfit, deletedReferenceIdSet);
    const nextBoard = pruneBoardForDeletedReferences(savedOutfit?.board, deletedReferenceIdSet);

    if (nextOutfit === savedOutfit?.outfit && nextBoard === savedOutfit?.board) {
      return savedOutfit;
    }

    changed = true;
    return {
      ...savedOutfit,
      outfit: nextOutfit,
      board: nextBoard
    };
  });

  return changed ? nextSavedOutfits : savedOutfits;
}
