import test from "node:test";
import assert from "node:assert/strict";

import {
  applySavedLibraryView,
  applySavedLibraryViewToMetadataFilters,
  createSavedLibraryViewSnapshot,
  deleteSavedLibraryView,
  defaultLibraryUiState,
  defaultWardrobeSort,
  doesSavedLibraryViewMatchMetadataState,
  emptyWardrobeFilters,
  formatImportSourceFormatLabel,
  markBackupExported,
  markBackupImported,
  markLibraryEdited,
  markMetadataExported,
  normalizeLibraryProvenance,
  normalizeLocalSafetyState,
  normalizeSavedLibraryViews,
  normalizeLibrarySearch,
  normalizeLibraryUiState,
  normalizeMetadataFilterState,
  normalizeWardrobeFilterState,
  normalizeWardrobeSort,
  renameSavedLibraryView,
  upsertSavedLibraryView
} from "./appStateModel.js";

test("normalizeWardrobeFilterState keeps supported filters and drops invalid values", () => {
  assert.deepEqual(
    normalizeWardrobeFilterState({
      tags: ["z", "a", "a"],
      excludedTags: ["b", "b", "c"],
      tagMatchMode: "grouped",
      laundry: "show",
      favorite: "yes"
    }),
    {
      tags: ["z", "a"],
      excludedTags: ["b", "c"],
      tagMatchMode: "grouped",
      laundry: "show",
      favorite: "yes"
    }
  );

  assert.deepEqual(
    normalizeWardrobeFilterState({
      tags: "bad",
      excludedTags: null,
      tagMatchMode: "bad",
      laundry: "maybe",
      favorite: "sometimes"
    }),
    emptyWardrobeFilters
  );
});

test("normalizeMetadataFilterState preserves match mode and favorite compatibility", () => {
  assert.deepEqual(
    normalizeMetadataFilterState({
      tags: ["project/a", "project/a", "project/b"],
      excludedTags: ["archive"],
      tagMatchMode: "grouped",
      favorite: "no"
    }),
    {
      tags: ["project/a", "project/b"],
      excludedTags: ["archive"],
      tagMatchMode: "grouped",
      favorite: "no"
    }
  );
});

test("normalizeLibraryUiState treats saved and filter views as library-open state", () => {
  assert.deepEqual(normalizeLibraryUiState(undefined), defaultLibraryUiState);
  assert.deepEqual(
    normalizeLibraryUiState({
      libraryOpen: false,
      wardrobeFiltersOpen: true,
      wardrobeSavedOpen: true
    }),
    {
      libraryOpen: true,
      wardrobeFiltersOpen: true,
      wardrobeSavedOpen: true
    }
  );
});

test("normalizeLibrarySearch and normalizeWardrobeSort stay additive", () => {
  assert.equal(normalizeLibrarySearch("  chrome lamp  "), "  chrome lamp  ");
  assert.equal(normalizeLibrarySearch(12), "");
  assert.equal(normalizeWardrobeSort("favorites"), "favorites");
  assert.equal(normalizeWardrobeSort("name-desc"), "name-desc");
  assert.equal(normalizeWardrobeSort("tag"), "tag");
  assert.equal(normalizeWardrobeSort("unsupported"), defaultWardrobeSort);
});

test("normalizeLocalSafetyState preserves additive metadata snapshot state", () => {
  assert.deepEqual(
    normalizeLocalSafetyState({
      lastMetadataSnapshotAt: "2026-05-26T10:00:00.000Z",
      lastMetadataSnapshotReason: "before-import",
      lastMetadataSnapshotError: "warning",
      metadataDirtySinceSnapshot: 1,
      metadataDirtySinceFullBackup: true,
      changedItemIdsSinceSnapshot: ["item-1", "item-1", "", "item-2"],
      changedItemIdsSinceFullBackup: ["item-2", "item-3"]
    }),
    {
      lastMetadataSnapshotAt: "2026-05-26T10:00:00.000Z",
      lastMetadataSnapshotReason: "before-import",
      lastMetadataSnapshotError: "warning",
      metadataDirtySinceSnapshot: true,
      metadataDirtySinceFullBackup: true,
      changedItemIdsSinceSnapshot: ["item-1", "item-2"],
      changedItemIdsSinceFullBackup: ["item-2", "item-3"]
    }
  );
});

test("saved library view snapshot captures and reapplies MBA library filters and sort", () => {
  const snapshot = createSavedLibraryViewSnapshot({
    librarySearch: "chrome",
    wardrobeFilters: {
      tags: ["metal", "lamp", "metal"],
      excludedTags: ["broken", "archive", "archive"],
      tagMatchMode: "grouped",
      favorite: "yes",
      laundry: "hide"
    },
    wardrobeSort: "favorites"
  });

  assert.deepEqual(snapshot, {
    searchQuery: "chrome",
    filters: {
      tags: ["metal", "lamp"],
      excludedTags: ["broken", "archive"],
      tagMatchMode: "grouped",
      favorite: "yes",
      laundry: "hide"
    },
    sort: "favorites"
  });
  assert.deepEqual(applySavedLibraryView(snapshot), snapshot);
});

test("saved library views can be applied to controls generation metadata filters by shared fields only", () => {
  const savedView = {
    id: "view-1",
    name: "AW21 Sources",
    searchQuery: "ignored-in-controls",
    filters: {
      tags: ["collection/aw21", "source/lookbook", "source/fit"],
      excludedTags: ["color/red"],
      tagMatchMode: "grouped",
      favorite: "yes",
      laundry: "hide"
    },
    sort: "tag"
  };

  assert.deepEqual(
    applySavedLibraryViewToMetadataFilters(savedView),
    {
      tags: ["collection/aw21", "source/lookbook", "source/fit"],
      excludedTags: ["color/red"],
      tagMatchMode: "grouped",
      favorite: "yes"
    }
  );
  assert.equal(
    doesSavedLibraryViewMatchMetadataState(savedView, {
      tags: ["collection/aw21", "source/lookbook", "source/fit"],
      excludedTags: ["color/red"],
      tagMatchMode: "grouped",
      favorite: "yes"
    }),
    true
  );
});

test("normalizeSavedLibraryViews handles legacy aliases and missing saved views additively", () => {
  assert.deepEqual(normalizeSavedLibraryViews(undefined), []);

  const normalized = normalizeSavedLibraryViews([
    {
      id: "view-1",
      name: " Archive ",
      librarySearch: "books",
      wardrobeFilters: {
        tags: ["shelf", "shelf"],
        excludedTags: ["damaged"],
        tagMatchMode: "all",
        favorite: "no",
        laundry: "show"
      },
      wardrobeSort: "name-desc"
    }
  ]);

  assert.deepEqual(normalized, [
    {
      id: "view-1",
      name: "Archive",
      searchQuery: "books",
      filters: {
        tags: ["shelf"],
        excludedTags: ["damaged"],
        tagMatchMode: "all",
        favorite: "no",
        laundry: "show"
      },
      sort: "name-desc"
    }
  ]);
});

test("upsertSavedLibraryView saves current state and reports duplicate-name conflicts unless replaced", () => {
  const firstResult = upsertSavedLibraryView([], "Desk refs", {
    librarySearch: "oak",
    wardrobeFilters: {
      tags: ["desk"],
      excludedTags: ["archive"],
      tagMatchMode: "any",
      favorite: "",
      laundry: ""
    },
    wardrobeSort: "tag"
  });

  assert.equal(firstResult.savedViews.length, 1);
  assert.equal(firstResult.savedViews[0].name, "Desk refs");
  assert.equal(firstResult.savedViews[0].searchQuery, "oak");
  assert.equal(firstResult.savedViews[0].sort, "tag");

  const conflictResult = upsertSavedLibraryView(firstResult.savedViews, " desk refs ", {
    librarySearch: "walnut",
    wardrobeFilters: emptyWardrobeFilters,
    wardrobeSort: "newest"
  });

  assert.equal(conflictResult.savedView, null);
  assert.equal(conflictResult.conflictingView?.name, "Desk refs");

  const replaceResult = upsertSavedLibraryView(firstResult.savedViews, " desk refs ", {
    librarySearch: "walnut",
    wardrobeFilters: emptyWardrobeFilters,
    wardrobeSort: "newest"
  }, { allowReplace: true });

  assert.equal(replaceResult.savedViews.length, 1);
  assert.equal(replaceResult.savedViews[0].searchQuery, "walnut");
  assert.equal(replaceResult.savedViews[0].sort, "newest");
});

test("renameSavedLibraryView and deleteSavedLibraryView update the saved view list without touching other entries", () => {
  const sourceViews = [
    {
      id: "view-1",
      name: "Archive",
      searchQuery: "coat",
      filters: emptyWardrobeFilters,
      sort: "newest"
    },
    {
      id: "view-2",
      name: "Favorites",
      searchQuery: "",
      filters: {
        ...emptyWardrobeFilters,
        favorite: "yes"
      },
      sort: "favorites"
    }
  ];

  const renamed = renameSavedLibraryView(sourceViews, "view-1", "Seasonal archive");
  assert.equal(renamed.savedViews[0].name, "Seasonal archive");
  assert.equal(renamed.savedViews[1].name, "Favorites");

  const deleted = deleteSavedLibraryView(renamed.savedViews, "view-2");
  assert.deepEqual(deleted, [
    {
      id: "view-1",
      name: "Seasonal archive",
      searchQuery: "coat",
      filters: emptyWardrobeFilters,
      sort: "newest"
    }
  ]);
});

test("normalizeLibraryProvenance loads old app states safely and keeps additive fields", () => {
  assert.deepEqual(
    normalizeLibraryProvenance(undefined, { itemCountSnapshot: 12 }),
    {
      lastLibraryEditAt: "",
      lastBackupExportAt: "",
      lastMetadataExportAt: "",
      lastBackupImportAt: "",
      lastImportedBackupName: "",
      lastImportedBackupSource: "",
      lastImportedBackupSchemaVersion: "",
      itemCountSnapshot: 12,
      appVersion: ""
    }
  );

  assert.deepEqual(
    normalizeLibraryProvenance({
      lastLibraryEditAt: "2026-05-26T10:00:00.000Z",
      lastImportedBackupName: "Archive MBA",
      lastImportedBackupSource: "moodboard-app-package",
      lastImportedBackupSchemaVersion: 1,
      itemCountSnapshot: "7",
      customField: "keep-me"
    }),
    {
      lastLibraryEditAt: "2026-05-26T10:00:00.000Z",
      lastBackupExportAt: "",
      lastMetadataExportAt: "",
      lastBackupImportAt: "",
      lastImportedBackupName: "Archive MBA",
      lastImportedBackupSource: "moodboard-app-package",
      lastImportedBackupSchemaVersion: "1",
      itemCountSnapshot: 7,
      appVersion: "",
      customField: "keep-me"
    }
  );
});

test("provenance helper updates track edits exports and imports additively", () => {
  const afterEdit = markLibraryEdited(undefined, {
    editedAt: "2026-05-26T11:00:00.000Z",
    itemCountSnapshot: 5
  });
  assert.equal(afterEdit.lastLibraryEditAt, "2026-05-26T11:00:00.000Z");
  assert.equal(afterEdit.itemCountSnapshot, 5);

  const afterExport = markBackupExported(afterEdit, {
    exportedAt: "2026-05-26T12:00:00.000Z",
    itemCountSnapshot: 5
  });
  assert.equal(afterExport.lastLibraryEditAt, "2026-05-26T11:00:00.000Z");
  assert.equal(afterExport.lastBackupExportAt, "2026-05-26T12:00:00.000Z");

  const afterMetadataExport = markMetadataExported(afterExport, {
    exportedAt: "2026-05-26T12:30:00.000Z",
    itemCountSnapshot: 5
  });
  assert.equal(afterMetadataExport.lastBackupExportAt, "2026-05-26T12:00:00.000Z");
  assert.equal(afterMetadataExport.lastMetadataExportAt, "2026-05-26T12:30:00.000Z");

  const afterImport = markBackupImported(afterMetadataExport, {
    importedAt: "2026-05-26T13:00:00.000Z",
    lastImportedBackupName: "mba-package",
    lastImportedBackupSource: "moodboard-app-package",
    lastImportedBackupSchemaVersion: 1,
    itemCountSnapshot: 9
  });
  assert.equal(afterImport.lastLibraryEditAt, "2026-05-26T13:00:00.000Z");
  assert.equal(afterImport.lastBackupExportAt, "2026-05-26T12:00:00.000Z");
  assert.equal(afterImport.lastMetadataExportAt, "2026-05-26T12:30:00.000Z");
  assert.equal(afterImport.lastBackupImportAt, "2026-05-26T13:00:00.000Z");
  assert.equal(afterImport.lastImportedBackupName, "mba-package");
  assert.equal(afterImport.lastImportedBackupSource, "moodboard-app-package");
  assert.equal(afterImport.lastImportedBackupSchemaVersion, "1");
  assert.equal(afterImport.itemCountSnapshot, 9);
});

test("formatImportSourceFormatLabel reports generic import source/version without implying package schema", () => {
  assert.equal(
    formatImportSourceFormatLabel({
      lastImportedBackupSource: "moodboard-app-package",
      lastImportedBackupSchemaVersion: 1
    }),
    "moodboard-app-package v1"
  );

  assert.equal(
    formatImportSourceFormatLabel({
      lastImportedBackupSource: "moodboard-app",
      lastImportedBackupSchemaVersion: 2
    }),
    "moodboard-app v2"
  );

  assert.equal(formatImportSourceFormatLabel({}), "");
});
