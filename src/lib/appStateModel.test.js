import test from "node:test";
import assert from "node:assert/strict";

import {
  applySavedLibraryView,
  createSavedLibraryViewSnapshot,
  deleteSavedLibraryView,
  defaultLibraryUiState,
  defaultWardrobeSort,
  emptyWardrobeFilters,
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
