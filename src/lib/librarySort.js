import { uniqueTags } from "./metadata.js";

export function compareNaturalLibraryText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function getPrimarySortedTag(item) {
  return uniqueTags(item?.tags).slice().sort(compareNaturalLibraryText)[0] ?? "";
}

export function sortLibraryItems(items, sortMode, options = {}) {
  const {
    getDisplayName = (item) => String(item?.name ?? ""),
    compareCreatedAt = () => 0
  } = options;

  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (sortMode === "favorites") {
        return Number(Boolean(right.item.favorite)) - Number(Boolean(left.item.favorite)) || right.index - left.index;
      }

      if (sortMode === "name") {
        return compareNaturalLibraryText(getDisplayName(left.item), getDisplayName(right.item)) || left.index - right.index;
      }

      if (sortMode === "name-desc") {
        return compareNaturalLibraryText(getDisplayName(right.item), getDisplayName(left.item)) || left.index - right.index;
      }

      if (sortMode === "tag") {
        return (
          compareNaturalLibraryText(getPrimarySortedTag(left.item), getPrimarySortedTag(right.item)) ||
          compareNaturalLibraryText(getDisplayName(left.item), getDisplayName(right.item)) ||
          left.index - right.index
        );
      }

      if (sortMode === "newest") {
        return compareCreatedAt(left.item, right.item, "desc") || right.index - left.index;
      }

      if (sortMode === "oldest") {
        return compareCreatedAt(left.item, right.item, "asc") || left.index - right.index;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}
