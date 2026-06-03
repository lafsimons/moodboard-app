import { createImageAsset } from "./itemImages.js";

function mergeOriginalMutationIntoDraft(currentDraft, savedItem) {
  if (!currentDraft?.id || currentDraft.id !== savedItem?.id) {
    return currentDraft;
  }

  return {
    ...currentDraft,
    originalPreserved: Boolean(savedItem?.originalPreserved),
    relinkStatus: savedItem?.relinkStatus ?? currentDraft.relinkStatus,
    sourceFilenameAliases: Array.isArray(savedItem?.sourceFilenameAliases) ? savedItem.sourceFilenameAliases : currentDraft.sourceFilenameAliases,
    originalLinkedAt: savedItem?.originalLinkedAt ?? currentDraft.originalLinkedAt ?? "",
    originalRelinkedFrom: savedItem?.originalRelinkedFrom ?? currentDraft.originalRelinkedFrom ?? "",
    originalRelinkedFilename: savedItem?.originalRelinkedFilename ?? currentDraft.originalRelinkedFilename ?? "",
    updatedAt: savedItem?.updatedAt ?? currentDraft.updatedAt,
    images: {
      ...(currentDraft?.images && typeof currentDraft.images === "object" ? currentDraft.images : {}),
      original: createImageAsset(savedItem?.images?.original)
    }
  };
}

export function mergeOriginalMutationIntoItem(currentItem, savedItem) {
  if (!currentItem?.id || currentItem.id !== savedItem?.id) {
    return currentItem;
  }

  return {
    ...currentItem,
    originalPreserved: Boolean(savedItem?.originalPreserved),
    relinkStatus: savedItem?.relinkStatus ?? currentItem.relinkStatus,
    sourceOriginalFilename: savedItem?.sourceOriginalFilename ?? currentItem.sourceOriginalFilename,
    sourceFilenameAliases: Array.isArray(savedItem?.sourceFilenameAliases) ? savedItem.sourceFilenameAliases : currentItem.sourceFilenameAliases,
    originalLinkedAt: savedItem?.originalLinkedAt ?? currentItem.originalLinkedAt ?? "",
    originalRelinkedFrom: savedItem?.originalRelinkedFrom ?? currentItem.originalRelinkedFrom ?? "",
    originalRelinkedFilename: savedItem?.originalRelinkedFilename ?? currentItem.originalRelinkedFilename ?? "",
    updatedAt: savedItem?.updatedAt ?? currentItem.updatedAt,
    images: {
      ...(currentItem?.images && typeof currentItem.images === "object" ? currentItem.images : {}),
      original: createImageAsset(savedItem?.images?.original)
    }
  };
}

export function applyPersistedOriginalMutations(items, savedItems = [], referencePreview = null, draft = null) {
  const normalizedSavedItems = Array.isArray(savedItems)
    ? savedItems.filter((savedItem) => savedItem?.id)
    : [];

  if (!normalizedSavedItems.length) {
    return {
      items: Array.isArray(items) ? items : [],
      referencePreview,
      draft,
      changedItemIds: []
    };
  }

  const savedItemsById = Object.fromEntries(normalizedSavedItems.map((savedItem) => [savedItem.id, savedItem]));

  return {
    items: (Array.isArray(items) ? items : []).map((item) => {
      const savedItem = savedItemsById[item?.id];
      return savedItem ? mergeOriginalMutationIntoItem(item, savedItem) : item;
    }),
    referencePreview: referencePreview?.id && savedItemsById[referencePreview.id]
      ? mergeOriginalMutationIntoItem(referencePreview, savedItemsById[referencePreview.id])
      : referencePreview,
    draft: draft?.id && savedItemsById[draft.id]
      ? mergeOriginalMutationIntoDraft(draft, savedItemsById[draft.id])
      : draft,
    changedItemIds: normalizedSavedItems.map((savedItem) => savedItem.id)
  };
}
