import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultLibraryUiState,
  defaultWardrobeSort,
  emptyWardrobeFilters,
  normalizeLibrarySearch,
  normalizeLibraryUiState,
  normalizeMetadataFilterState,
  normalizeWardrobeFilterState,
  normalizeWardrobeSort
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
