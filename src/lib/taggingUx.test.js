import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLibrarySearchText,
  describeBulkMetadataChanges,
  getCommonTagsForItems,
  getNextLibrarySelection,
  getTagInputKeyIntent,
  getTotalUniqueTagCount,
  matchesLibrarySearch,
  matchesTagFilter
} from "./taggingUx.js";

test("getTagInputKeyIntent uses Enter to accept the highlighted suggestion when suggestions are open", () => {
  assert.deepEqual(
    getTagInputKeyIntent({
      key: "Enter",
      inputValue: "vintage",
      suggestionsOpen: true,
      highlightedSuggestion: "vintage american",
      isFocused: true,
      selectedTags: []
    }),
    {
      type: "commitSuggestion",
      value: "vintage american"
    }
  );
});

test("getTagInputKeyIntent uses Tab to accept the highlighted suggestion", () => {
  assert.deepEqual(
    getTagInputKeyIntent({
      key: "Tab",
      inputValue: "vin",
      suggestionsOpen: true,
      highlightedSuggestion: "vintage american",
      isFocused: true,
      selectedTags: []
    }),
    {
      type: "commitSuggestion",
      value: "vintage american"
    }
  );
});

test("getTagInputKeyIntent keeps Enter committing typed input when no suggestion is highlighted", () => {
  assert.deepEqual(
    getTagInputKeyIntent({
      key: "Enter",
      inputValue: "vintage",
      suggestionsOpen: false,
      highlightedSuggestion: "",
      isFocused: true,
      selectedTags: []
    }),
    {
      type: "commitInput",
      value: "vintage"
    }
  );
});

test("getTagInputKeyIntent removes the last selected tag on empty-input Backspace", () => {
  assert.deepEqual(
    getTagInputKeyIntent({
      key: "Backspace",
      inputValue: "",
      suggestionsOpen: false,
      highlightedSuggestion: "",
      isFocused: true,
      selectedTags: ["black", "vintage"]
    }),
    {
      type: "removeLastTag",
      tag: "vintage"
    }
  );
});

test("getTagInputKeyIntent keeps arrow navigation and escape as suggestion-state actions", () => {
  assert.deepEqual(
    getTagInputKeyIntent({
      key: "ArrowDown",
      inputValue: "vi",
      suggestionsOpen: true,
      highlightedSuggestion: "vintage",
      isFocused: true,
      selectedTags: []
    }),
    { type: "highlightNext" }
  );

  assert.deepEqual(
    getTagInputKeyIntent({
      key: "ArrowUp",
      inputValue: "vi",
      suggestionsOpen: true,
      highlightedSuggestion: "vintage",
      isFocused: true,
      selectedTags: []
    }),
    { type: "highlightPrevious" }
  );

  assert.deepEqual(
    getTagInputKeyIntent({
      key: "Escape",
      inputValue: "vi",
      suggestionsOpen: true,
      highlightedSuggestion: "vintage",
      isFocused: true,
      selectedTags: []
    }),
    { type: "closeSuggestions" }
  );
});

test("getCommonTagsForItems and getTotalUniqueTagCount summarize mixed selections", () => {
  const items = [
    { tags: ["Black", "vintage", "wool"] },
    { tags: ["black", "vintage", "coat"] },
    { tags: ["black", "VINTAGE", "archive"] }
  ];

  assert.deepEqual(getCommonTagsForItems(items), ["black", "vintage"]);
  assert.equal(getTotalUniqueTagCount(items), 5);
});

test("getNextLibrarySelection supports plain click, toggle, and shift range", () => {
  const visibleItemIds = ["a", "b", "c", "d", "e"];

  assert.deepEqual(
    getNextLibrarySelection({
      currentSelection: { c: true },
      itemId: "b",
      visibleItemIds,
      anchorId: "c",
      isToggleSelection: false,
      isRangeSelection: false
    }),
    {
      nextSelection: { b: true },
      nextAnchorId: "b"
    }
  );

  assert.deepEqual(
    getNextLibrarySelection({
      currentSelection: { b: true },
      itemId: "d",
      visibleItemIds,
      anchorId: "b",
      isToggleSelection: true,
      isRangeSelection: false
    }),
    {
      nextSelection: { b: true, d: true },
      nextAnchorId: "d"
    }
  );

  assert.deepEqual(
    getNextLibrarySelection({
      currentSelection: { b: true },
      itemId: "d",
      visibleItemIds,
      anchorId: "b",
      isToggleSelection: false,
      isRangeSelection: true
    }),
    {
      nextSelection: { b: true, c: true, d: true },
      nextAnchorId: "d"
    }
  );

  assert.deepEqual(
    getNextLibrarySelection({
      currentSelection: { a: true },
      itemId: "d",
      visibleItemIds,
      anchorId: "b",
      isToggleSelection: true,
      isRangeSelection: true
    }),
    {
      nextSelection: { a: true, b: true, c: true, d: true },
      nextAnchorId: "d"
    }
  );
});

test("describeBulkMetadataChanges reports actual changed-item counts", () => {
  const items = [
    { tags: ["black"], favorite: false },
    { tags: ["black", "vintage"], favorite: true },
    { tags: ["wool"], favorite: false }
  ];

  const summary = describeBulkMetadataChanges(items, {
    addTags: ["vintage"],
    removeTags: ["black"],
    favorite: "yes"
  });

  assert.equal(summary.addedItems, 2);
  assert.equal(summary.removedItems, 2);
  assert.equal(summary.favoritedItems, 2);
  assert.equal(summary.unfavoritedItems, 0);
  assert.equal(summary.changedItems, 3);
  assert.equal(summary.message, "Added tags to 2 items · Removed tags from 2 items · Favorited 2 items");
});

test("describeBulkMetadataChanges returns a no-op message when nothing changes", () => {
  const summary = describeBulkMetadataChanges(
    [{ tags: ["black", "vintage"], favorite: true }],
    {
      addTags: ["Black"],
      removeTags: [],
      favorite: "yes"
    }
  );

  assert.equal(summary.changedItems, 0);
  assert.equal(summary.message, "No changes applied");
});

test("buildLibrarySearchText prioritizes reference fields and excludes outfit-era fields", () => {
  const item = {
    name: "Studio Lamp",
    description: "Weathered chrome prop",
    tags: ["chrome", "interior"],
    originalFilename: "lamp_ref.jpg",
    fileExtension: "jpg",
    mimeType: "image/jpeg",
    cameraMake: "Sony",
    cameraModel: "A7C",
    lensModel: "35mm",
    exposureTime: "1/125",
    id: "ref_123",
    garmentType: "Top",
    weight: "Heavy",
    retailValue: "300"
  };

  const searchText = buildLibrarySearchText(item);

  assert.match(searchText, /^studio lamp weathered chrome prop chrome interior lamp_ref\.jpg jpg image\/jpeg sony a7c 35mm 1\/125 ref_123$/);
  assert.doesNotMatch(searchText, /top|heavy|300/);
});

test("matchesLibrarySearch uses moodboard metadata fields only", () => {
  const item = {
    name: "Concrete Table",
    description: "Brushed metal base",
    tags: ["brutalist", "stone"],
    originalFilename: "table.png",
    mimeType: "image/png",
    cameraMake: "Fujifilm",
    id: "table_ref",
    garmentType: "Bottom"
  };

  assert.equal(matchesLibrarySearch(item, "concrete"), true);
  assert.equal(matchesLibrarySearch(item, "brushed metal"), true);
  assert.equal(matchesLibrarySearch(item, "stone"), true);
  assert.equal(matchesLibrarySearch(item, "image/png"), true);
  assert.equal(matchesLibrarySearch(item, "fujifilm"), true);
  assert.equal(matchesLibrarySearch(item, "table_ref"), true);
  assert.equal(matchesLibrarySearch(item, "bottom"), false);
});

test("matchesTagFilter supports match-all and match-any include behavior", () => {
  const itemTags = ["style/vintage american", "source/movie", "color/black"];

  assert.equal(
    matchesTagFilter(itemTags, {
      includeTags: ["style/vintage american", "source/movie"],
      matchMode: "all"
    }),
    true
  );

  assert.equal(
    matchesTagFilter(itemTags, {
      includeTags: ["style/vintage american", "source/editorial"],
      matchMode: "all"
    }),
    false
  );

  assert.equal(
    matchesTagFilter(itemTags, {
      includeTags: ["style/vintage american", "source/editorial"],
      matchMode: "any"
    }),
    true
  );
});

test("matchesTagFilter excludes tags and can hide untagged items", () => {
  assert.equal(
    matchesTagFilter(["style/formal", "color/black"], {
      excludeTags: ["style/formal"]
    }),
    false
  );

  assert.equal(
    matchesTagFilter([], {
      excludeTags: ["__no_tags__"]
    }),
    false
  );

  assert.equal(
    matchesTagFilter([], {
      includeTags: ["__no_tags__"],
      matchMode: "any"
    }),
    true
  );
});
