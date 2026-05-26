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

export const emptySavedLibraryViews = [];

export const emptyLibraryProvenance = {
  lastLibraryEditAt: "",
  lastBackupExportAt: "",
  lastBackupImportAt: "",
  lastImportedBackupName: "",
  lastImportedBackupSource: "",
  lastImportedBackupSchemaVersion: "",
  itemCountSnapshot: 0,
  appVersion: ""
};

function normalizeLibraryProvenanceText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLibraryProvenanceVersion(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeLibraryProvenanceText(value);
}

function normalizeLibraryProvenanceTimestamp(value) {
  const normalizedValue = normalizeLibraryProvenanceText(value);

  if (!normalizedValue) {
    return "";
  }

  const parsedValue = Date.parse(normalizedValue);
  return Number.isFinite(parsedValue) ? new Date(parsedValue).toISOString() : "";
}

function normalizeLibraryProvenanceCount(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.round(parsedValue) : fallback;
}

export function normalizeLibraryProvenance(value, options = {}) {
  const fallbackItemCount = normalizeLibraryProvenanceCount(options.itemCountSnapshot, 0);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...emptyLibraryProvenance,
      itemCountSnapshot: fallbackItemCount
    };
  }

  return {
    ...emptyLibraryProvenance,
    ...value,
    lastLibraryEditAt: normalizeLibraryProvenanceTimestamp(value.lastLibraryEditAt),
    lastBackupExportAt: normalizeLibraryProvenanceTimestamp(value.lastBackupExportAt),
    lastBackupImportAt: normalizeLibraryProvenanceTimestamp(value.lastBackupImportAt),
    lastImportedBackupName: normalizeLibraryProvenanceText(value.lastImportedBackupName),
    lastImportedBackupSource: normalizeLibraryProvenanceText(value.lastImportedBackupSource),
    lastImportedBackupSchemaVersion: normalizeLibraryProvenanceVersion(value.lastImportedBackupSchemaVersion),
    itemCountSnapshot: normalizeLibraryProvenanceCount(value.itemCountSnapshot, fallbackItemCount),
    appVersion: normalizeLibraryProvenanceText(value.appVersion)
  };
}

function getLibraryProvenanceTimestamp(timestamp = new Date().toISOString()) {
  return normalizeLibraryProvenanceTimestamp(timestamp) || new Date().toISOString();
}

export function markLibraryEdited(provenance, options = {}) {
  const normalizedTimestamp = getLibraryProvenanceTimestamp(options.editedAt);

  return normalizeLibraryProvenance({
    ...normalizeLibraryProvenance(provenance, options),
    lastLibraryEditAt: normalizedTimestamp,
    itemCountSnapshot: options.itemCountSnapshot
  }, options);
}

export function markBackupExported(provenance, options = {}) {
  const normalizedTimestamp = getLibraryProvenanceTimestamp(options.exportedAt);

  return normalizeLibraryProvenance({
    ...normalizeLibraryProvenance(provenance, options),
    lastBackupExportAt: normalizedTimestamp,
    itemCountSnapshot: options.itemCountSnapshot
  }, options);
}

export function markBackupImported(provenance, options = {}) {
  const normalizedTimestamp = getLibraryProvenanceTimestamp(options.importedAt);

  return normalizeLibraryProvenance({
    ...normalizeLibraryProvenance(provenance, options),
    lastLibraryEditAt: normalizedTimestamp,
    lastBackupImportAt: normalizedTimestamp,
    lastImportedBackupName: normalizeLibraryProvenanceText(options.lastImportedBackupName),
    lastImportedBackupSource: normalizeLibraryProvenanceText(options.lastImportedBackupSource),
    lastImportedBackupSchemaVersion: normalizeLibraryProvenanceVersion(options.lastImportedBackupSchemaVersion),
    itemCountSnapshot: options.itemCountSnapshot
  }, options);
}

export function normalizeMetadataFilterState(filters) {
  return {
    tags: uniqueTags(filters?.tags),
    excludedTags: uniqueTags(filters?.excludedTags),
    tagMatchMode: filters?.tagMatchMode === "all" || filters?.tagMatchMode === "grouped" ? filters.tagMatchMode : "any",
    favorite: filters?.favorite === "yes" || filters?.favorite === "no" ? filters.favorite : ""
  };
}

export function normalizeWardrobeFilterState(filters) {
  return {
    tags: uniqueTags(filters?.tags),
    excludedTags: uniqueTags(filters?.excludedTags),
    tagMatchMode: filters?.tagMatchMode === "all" || filters?.tagMatchMode === "grouped" ? filters.tagMatchMode : "any",
    laundry: filters?.laundry === "show" || filters?.laundry === "hide" ? filters.laundry : "",
    favorite: filters?.favorite === "yes" || filters?.favorite === "no" ? filters.favorite : ""
  };
}

export function normalizeWardrobeSort(value) {
  return ["newest", "oldest", "name", "name-desc", "tag", "favorites"].includes(value) ? value : defaultWardrobeSort;
}

export function normalizeLibrarySearch(value) {
  return typeof value === "string" ? value : "";
}

function normalizeSavedLibraryViewName(value, index = 0) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return normalizedValue || `View ${index + 1}`;
}

function createSavedLibraryViewId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `library_view_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSavedLibraryView(view, index = 0) {
  if (!view || typeof view !== "object" || Array.isArray(view)) {
    return null;
  }

  return {
    id: typeof view.id === "string" && view.id.trim() ? view.id.trim() : createSavedLibraryViewId(),
    name: normalizeSavedLibraryViewName(view.name, index),
    searchQuery: normalizeLibrarySearch(view.searchQuery ?? view.librarySearch),
    filters: normalizeWardrobeFilterState(view.filters ?? view.wardrobeFilters),
    sort: normalizeWardrobeSort(view.sort ?? view.wardrobeSort)
  };
}

function normalizeSavedLibraryViewNameKey(value) {
  return normalizeSavedLibraryViewName(value).toLowerCase();
}

export function normalizeSavedLibraryViews(value) {
  const seenIds = new Set();

  return (Array.isArray(value) ? value : [])
    .map((view, index) => normalizeSavedLibraryView(view, index))
    .filter(Boolean)
    .map((view) => {
      if (!seenIds.has(view.id)) {
        seenIds.add(view.id);
        return view;
      }

      let nextId = createSavedLibraryViewId();

      while (seenIds.has(nextId)) {
        nextId = createSavedLibraryViewId();
      }

      seenIds.add(nextId);
      return {
        ...view,
        id: nextId
      };
    });
}

export function createSavedLibraryViewSnapshot({ librarySearch, wardrobeFilters, wardrobeSort, searchQuery, filters, sort }) {
  return {
    searchQuery: normalizeLibrarySearch(librarySearch ?? searchQuery),
    filters: normalizeWardrobeFilterState(wardrobeFilters ?? filters),
    sort: normalizeWardrobeSort(wardrobeSort ?? sort)
  };
}

export function applySavedLibraryView(savedView) {
  const normalizedSavedView = normalizeSavedLibraryView(savedView);

  if (!normalizedSavedView) {
    return createSavedLibraryViewSnapshot({
      librarySearch: "",
      wardrobeFilters: emptyWardrobeFilters,
      wardrobeSort: defaultWardrobeSort
    });
  }

  return createSavedLibraryViewSnapshot({
    librarySearch: normalizedSavedView.searchQuery,
    wardrobeFilters: normalizedSavedView.filters,
    wardrobeSort: normalizedSavedView.sort
  });
}

export function applySavedLibraryViewToMetadataFilters(savedView) {
  return normalizeMetadataFilterState(applySavedLibraryView(savedView).filters);
}

export function doesSavedLibraryViewMatchState(savedView, currentState) {
  return JSON.stringify(applySavedLibraryView(savedView)) === JSON.stringify(createSavedLibraryViewSnapshot(currentState));
}

export function doesSavedLibraryViewMatchMetadataState(savedView, metadataFilters) {
  return JSON.stringify(applySavedLibraryViewToMetadataFilters(savedView)) === JSON.stringify(normalizeMetadataFilterState(metadataFilters));
}

export function upsertSavedLibraryView(savedViews, name, currentState, options = {}) {
  const normalizedSavedViews = normalizeSavedLibraryViews(savedViews);
  const normalizedName = normalizeSavedLibraryViewName(name);
  const targetId = typeof options.targetId === "string" ? options.targetId.trim() : "";
  const conflictingView = normalizedSavedViews.find(
    (view) => normalizeSavedLibraryViewNameKey(view.name) === normalizeSavedLibraryViewNameKey(normalizedName) && view.id !== targetId
  ) ?? null;

  if (conflictingView && !options.allowReplace) {
    return {
      savedViews: normalizedSavedViews,
      savedView: null,
      conflictingView
    };
  }

  const nextSavedView = {
    id: targetId || conflictingView?.id || createSavedLibraryViewId(),
    name: normalizedName,
    ...createSavedLibraryViewSnapshot(currentState)
  };
  const nextSavedViews = normalizedSavedViews.filter(
    (view) => view.id !== targetId && view.id !== conflictingView?.id
  );
  const targetIndex = targetId
    ? normalizedSavedViews.findIndex((view) => view.id === targetId)
    : conflictingView
      ? normalizedSavedViews.findIndex((view) => view.id === conflictingView.id)
      : -1;

  if (targetIndex >= 0 && targetIndex <= nextSavedViews.length) {
    nextSavedViews.splice(targetIndex, 0, nextSavedView);
  } else {
    nextSavedViews.push(nextSavedView);
  }

  return {
    savedViews: nextSavedViews,
    savedView: nextSavedView,
    conflictingView
  };
}

export function renameSavedLibraryView(savedViews, id, name, options = {}) {
  const normalizedSavedViews = normalizeSavedLibraryViews(savedViews);
  const normalizedId = typeof id === "string" ? id.trim() : "";
  const targetView = normalizedSavedViews.find((view) => view.id === normalizedId) ?? null;

  if (!targetView) {
    return {
      savedViews: normalizedSavedViews,
      savedView: null,
      conflictingView: null
    };
  }

  return upsertSavedLibraryView(
    normalizedSavedViews,
    name,
    applySavedLibraryView(targetView),
    {
      targetId: normalizedId,
      allowReplace: options.allowReplace
    }
  );
}

export function deleteSavedLibraryView(savedViews, id) {
  const normalizedId = typeof id === "string" ? id.trim() : "";
  return normalizeSavedLibraryViews(savedViews).filter((view) => view.id !== normalizedId);
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
