import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LIBRARY_ADD_WIDTH,
  DEFAULT_SIDE_EDITOR_WIDTH,
  getMaxLibraryAddWidth,
  getMaxSideEditorWidth,
  normalizeLibraryAddWidth,
  normalizePanelLayoutState,
  normalizeSideEditorWidth
} from "./panelLayoutState.js";

test("normalizeSideEditorWidth preserves valid widths and clamps to viewport-aware bounds", () => {
  assert.equal(normalizeSideEditorWidth(DEFAULT_SIDE_EDITOR_WIDTH, 1600), DEFAULT_SIDE_EDITOR_WIDTH);
  assert.equal(normalizeSideEditorWidth(900, 1600), getMaxSideEditorWidth(1600));
  assert.equal(normalizeSideEditorWidth(120, 1600), 360);
});

test("normalizeLibraryAddWidth stays additive and honors viewport caps", () => {
  assert.equal(normalizeLibraryAddWidth(DEFAULT_LIBRARY_ADD_WIDTH, 1600), DEFAULT_LIBRARY_ADD_WIDTH);
  assert.equal(normalizeLibraryAddWidth(900, 420), getMaxLibraryAddWidth(420));
  assert.equal(normalizeLibraryAddWidth(120, 420), 280);
});

test("normalizePanelLayoutState falls back safely when values are missing or invalid", () => {
  assert.deepEqual(
    normalizePanelLayoutState(undefined, 1600),
    {
      sideEditorWidth: DEFAULT_SIDE_EDITOR_WIDTH,
      libraryAddWidth: DEFAULT_LIBRARY_ADD_WIDTH
    }
  );

  assert.deepEqual(
    normalizePanelLayoutState({
      sideEditorWidth: "bad",
      libraryAddWidth: null
    }, 420),
    {
      sideEditorWidth: normalizeSideEditorWidth(undefined, 420),
      libraryAddWidth: normalizeLibraryAddWidth(undefined, 420)
    }
  );
});
