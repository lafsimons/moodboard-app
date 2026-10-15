import { normalizeTag, uniqueTags } from "./metadata.js";

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getTagInputKeyIntent({
  key,
  inputValue = "",
  suggestionsOpen = false,
  highlightedSuggestion = "",
  isFocused = false,
  selectedTags = []
}) {
  const normalizedInput = normalizeTag(inputValue);
  const normalizedSelectedTags = uniqueTags(selectedTags);

  if (key === "ArrowDown" && suggestionsOpen) {
    return { type: "highlightNext" };
  }

  if (key === "ArrowUp" && suggestionsOpen) {
    return { type: "highlightPrevious" };
  }

  if (key === "Escape" && (suggestionsOpen || Boolean(inputValue))) {
    return { type: "closeSuggestions" };
  }

  if (key === "Backspace" && isFocused && !normalizedInput && normalizedSelectedTags.length) {
    return {
      type: "removeLastTag",
      tag: normalizedSelectedTags[normalizedSelectedTags.length - 1]
    };
  }

  if (key === "Tab" && suggestionsOpen && highlightedSuggestion) {
    return {
      type: "commitSuggestion",
      value: highlightedSuggestion
    };
  }

  if ((key === "," || key === "Enter") && normalizedInput) {
    return {
      type: "commitInput",
      value: inputValue
    };
  }

  return { type: "none" };
}

export function getCommonTagsForItems(items) {
  const normalizedItems = (Array.isArray(items) ? items : []).filter(Boolean);

  if (!normalizedItems.length) {
    return [];
  }

  const [firstItem, ...restItems] = normalizedItems;
  const firstTags = uniqueTags(firstItem.tags);

  return firstTags.filter((tag) => restItems.every((item) => uniqueTags(item.tags).includes(tag)));
}

export function getNextLibrarySelection({
  currentSelection = {},
  itemId,
  visibleItemIds = [],
  anchorId = null,
  isToggleSelection = false,
  isRangeSelection = false
}) {
  const normalizedVisibleIds = Array.isArray(visibleItemIds) ? visibleItemIds.filter(Boolean) : [];
  const visibleIdSet = new Set(normalizedVisibleIds);
  const currentSelectedIds = Object.entries(currentSelection)
    .filter(([, isSelected]) => Boolean(isSelected))
    .map(([selectedItemId]) => selectedItemId);
  const currentSelectionSet = new Set(currentSelectedIds);
  const hasAnchor = Boolean(anchorId) && normalizedVisibleIds.includes(anchorId);
  const itemIndex = normalizedVisibleIds.indexOf(itemId);
  let nextSelection = {};
  let nextAnchorId = itemId;

  function buildOrderedSelection(selectedIdSet) {
    const orderedSelectedIds = [
      ...normalizedVisibleIds.filter((referenceId) => selectedIdSet.has(referenceId)),
      ...currentSelectedIds.filter((referenceId) => !visibleIdSet.has(referenceId) && selectedIdSet.has(referenceId))
    ];

    return Object.fromEntries(orderedSelectedIds.map((referenceId) => [referenceId, true]));
  }

  if (!itemId) {
    return {
      nextSelection: currentSelection,
      nextAnchorId: anchorId ?? null
    };
  }

  if (isRangeSelection && hasAnchor && itemIndex !== -1) {
    const anchorIndex = normalizedVisibleIds.indexOf(anchorId);
    const [startIndex, endIndex] = anchorIndex < itemIndex
      ? [anchorIndex, itemIndex]
      : [itemIndex, anchorIndex];
    const rangeIds = normalizedVisibleIds.slice(startIndex, endIndex + 1);

    if (isToggleSelection) {
      rangeIds.forEach((referenceId) => {
        currentSelectionSet.add(referenceId);
      });
      nextSelection = buildOrderedSelection(currentSelectionSet);
      nextAnchorId = anchorId;
    } else {
      nextSelection = Object.fromEntries(rangeIds.map((referenceId) => [referenceId, true]));
      nextAnchorId = anchorId;
    }
  } else if (isToggleSelection) {
    const isCurrentlySelected = currentSelectionSet.has(itemId);

    if (isCurrentlySelected) {
      currentSelectionSet.delete(itemId);
    } else {
      currentSelectionSet.add(itemId);
    }

    nextSelection = buildOrderedSelection(currentSelectionSet);
    nextAnchorId = currentSelectionSet.size === 0 ? null : (isCurrentlySelected ? anchorId ?? itemId : itemId);
  } else if (currentSelectedIds.length === 1 && currentSelectionSet.has(itemId)) {
    nextSelection = {};
    nextAnchorId = null;
  } else {
    nextSelection = { [itemId]: true };
    nextAnchorId = itemId;
  }

  return {
    nextSelection,
    nextAnchorId
  };
}

export function getTotalUniqueTagCount(items) {
  return uniqueTags((Array.isArray(items) ? items : []).flatMap((item) => item?.tags ?? [])).length;
}

export function matchesTagFilter(
  itemTags,
  {
    includeTags = [],
    excludeTags = [],
    matchMode = "all",
    noTagsToken = "__no_tags__"
  } = {}
) {
  const normalizedItemTags = uniqueTags(itemTags);
  const normalizedIncludeTags = uniqueTags(includeTags);
  const normalizedExcludeTags = uniqueTags(excludeTags);
  const normalizedMatchMode = matchMode === "any" || matchMode === "grouped" ? matchMode : "all";
  const includesNoTags = normalizedIncludeTags.includes(noTagsToken);
  const excludesNoTags = normalizedExcludeTags.includes(noTagsToken);
  const includedTags = normalizedIncludeTags.filter((tag) => tag !== noTagsToken);
  const excludedTags = normalizedExcludeTags.filter((tag) => tag !== noTagsToken);

  if (excludesNoTags && normalizedItemTags.length === 0) {
    return false;
  }

  if (excludedTags.some((tag) => normalizedItemTags.includes(tag))) {
    return false;
  }

  if (!normalizedIncludeTags.length) {
    return true;
  }

  if (normalizedMatchMode === "any") {
    return (
      (includesNoTags && normalizedItemTags.length === 0) ||
      includedTags.some((tag) => normalizedItemTags.includes(tag))
    );
  }

  if (normalizedMatchMode === "grouped") {
    if (includesNoTags && normalizedItemTags.length !== 0) {
      return false;
    }

    const groupedIncludedTags = includedTags.reduce((groups, tag) => {
      const [topLevelGroup, ...rest] = String(tag ?? "").split("/");
      const groupKey = rest.length ? topLevelGroup : String(tag ?? "");

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey).push(tag);
      return groups;
    }, new Map());

    return [...groupedIncludedTags.values()].every((groupTags) =>
      groupTags.some((tag) => normalizedItemTags.includes(tag))
    );
  }

  if (includesNoTags && normalizedItemTags.length !== 0) {
    return false;
  }

  return includedTags.every((tag) => normalizedItemTags.includes(tag));
}

function normalizeSearchFragment(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const librarySearchTextCache = new WeakMap();

function collectSearchValues(...values) {
  return values
    .flat()
    .map(normalizeSearchFragment)
    .filter(Boolean);
}

export function buildLibrarySearchText(item) {
  if (item && typeof item === "object") {
    const cachedValue = librarySearchTextCache.get(item);

    if (typeof cachedValue === "string") {
      return cachedValue;
    }
  }

  const searchText = collectSearchValues(
    item?.name,
    item?.description,
    item?.tags,
    item?.originalFilename,
    item?.fileExtension,
    item?.mimeType,
    item?.cameraMake,
    item?.cameraModel,
    item?.lensModel,
    item?.focalLength,
    item?.fNumber,
    item?.exposureTime,
    item?.iso,
    item?.colorSpace,
    item?.colorProfile,
    item?.id
  ).join(" ");

  if (item && typeof item === "object") {
    librarySearchTextCache.set(item, searchText);
  }

  return searchText;
}

export function matchesLibrarySearch(item, query) {
  const normalizedQuery = normalizeSearchFragment(query);

  if (!normalizedQuery) {
    return true;
  }

  return buildLibrarySearchText(item).includes(normalizedQuery);
}

export function normalizeLibrarySearchQuery(query) {
  return normalizeSearchFragment(query);
}

export function matchesNormalizedLibrarySearch(item, normalizedQuery) {
  if (!normalizedQuery) {
    return true;
  }

  return buildLibrarySearchText(item).includes(normalizedQuery);
}

export function describeBulkMetadataChanges(items, draft) {
  const normalizedItems = (Array.isArray(items) ? items : []).filter(Boolean);
  const addTags = uniqueTags(draft?.addTags);
  const removeTags = uniqueTags(draft?.removeTags);
  const favoriteAction = draft?.favorite === "yes" || draft?.favorite === "no" ? draft.favorite : "";

  const counts = normalizedItems.reduce(
    (summary, item) => {
      const currentTags = uniqueTags(item.tags);
      const nextTags = uniqueTags([...currentTags, ...addTags].filter((tag) => !removeTags.includes(tag)));
      const added = nextTags.some((tag) => !currentTags.includes(tag));
      const removed = currentTags.some((tag) => !nextTags.includes(tag));
      const currentFavorite = Boolean(item.favorite);
      const nextFavorite =
        favoriteAction === "yes"
          ? true
          : favoriteAction === "no"
            ? false
            : currentFavorite;
      const favorited = !currentFavorite && nextFavorite;
      const unfavorited = currentFavorite && !nextFavorite;

      if (added) {
        summary.addedItems += 1;
      }

      if (removed) {
        summary.removedItems += 1;
      }

      if (favorited) {
        summary.favoritedItems += 1;
      }

      if (unfavorited) {
        summary.unfavoritedItems += 1;
      }

      if (added || removed || favorited || unfavorited) {
        summary.changedItems += 1;
      }

      return summary;
    },
    {
      addedItems: 0,
      removedItems: 0,
      favoritedItems: 0,
      unfavoritedItems: 0,
      changedItems: 0
    }
  );

  const messageParts = [];

  if (counts.addedItems) {
    messageParts.push(`Added tags to ${pluralize(counts.addedItems, "item")}`);
  }

  if (counts.removedItems) {
    messageParts.push(`Removed tags from ${pluralize(counts.removedItems, "item")}`);
  }

  if (counts.favoritedItems) {
    messageParts.push(`Favorited ${pluralize(counts.favoritedItems, "item")}`);
  }

  if (counts.unfavoritedItems) {
    messageParts.push(`Unfavorited ${pluralize(counts.unfavoritedItems, "item")}`);
  }

  return {
    ...counts,
    message: messageParts.length ? messageParts.join(" · ") : "No changes applied"
  };
}
