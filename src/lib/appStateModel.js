import { uniqueTags } from "./metadata.js";

export const emptyWardrobeFilters = {
  tags: [],
  excludedTags: [],
  tagMatchMode: "any",
  laundry: "",
  favorite: ""
};

export const defaultWardrobeSort = "newest";

export const defaultLibraryUiState = {
  libraryOpen: false,
  wardrobeFiltersOpen: false,
  wardrobeSavedOpen: false
};

export function normalizeMetadataFilterState(filters) {
  return {
    tags: uniqueTags(filters?.tags),
    excludedTags: uniqueTags(filters?.excludedTags),
    tagMatchMode: filters?.tagMatchMode === "all" ? "all" : "any",
    favorite: filters?.favorite === "yes" || filters?.favorite === "no" ? filters.favorite : ""
  };
}

export function normalizeWardrobeFilterState(filters) {
  return {
    tags: uniqueTags(filters?.tags),
    excludedTags: uniqueTags(filters?.excludedTags),
    tagMatchMode: filters?.tagMatchMode === "all" ? "all" : "any",
    laundry: filters?.laundry === "show" || filters?.laundry === "hide" ? filters.laundry : "",
    favorite: filters?.favorite === "yes" || filters?.favorite === "no" ? filters.favorite : ""
  };
}

export function normalizeWardrobeSort(value) {
  return ["newest", "oldest", "name", "favorites"].includes(value) ? value : defaultWardrobeSort;
}

export function normalizeLibrarySearch(value) {
  return typeof value === "string" ? value : "";
}

export function normalizeLibraryUiState(value) {
  const rawLibraryOpen = Boolean(value?.libraryOpen);
  const rawFiltersOpen = Boolean(value?.wardrobeFiltersOpen);
  const rawSavedOpen = Boolean(value?.wardrobeSavedOpen);
  const libraryOpen = rawLibraryOpen || rawFiltersOpen || rawSavedOpen;

  return {
    libraryOpen,
    wardrobeFiltersOpen: rawFiltersOpen,
    wardrobeSavedOpen: libraryOpen ? rawSavedOpen : false
  };
}
