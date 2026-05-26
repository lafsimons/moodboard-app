import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("MBA tag filter match mode is wired into the tag tree header instead of a lower standalone row", () => {
  assert.match(appSource, /<TagTree[\s\S]*storageKey="library-filters"[\s\S]*headerActions=\{\(\s*<div className="wardrobe-tag-match-toggle"/);
  assert.match(appSource, /wardrobe-tag-match-option \$\{normalizedWardrobeFilters\.tagMatchMode === "any" \? "is-active" : ""\}/);
  assert.match(appSource, /wardrobe-tag-match-option \$\{normalizedWardrobeFilters\.tagMatchMode === "grouped" \? "is-active" : ""\}/);
  assert.match(appSource, /wardrobe-tag-match-option \$\{normalizedWardrobeFilters\.tagMatchMode === "all" \? "is-active" : ""\}/);
  assert.doesNotMatch(appSource, /wardrobe-inline-filter-match/);
});

test("MBA tag filter header controls stay compact and wrap safely at narrow widths", () => {
  assert.match(appSource, /tag-tree-header-default[\s\S]*\{headerActions\}/);
  assert.match(stylesSource, /\.wardrobe-controls \.tag-tree-meta\s*\{[\s\S]*flex-wrap:\s*wrap;/);
  assert.match(stylesSource, /\.wardrobe-tag-match-toggle\s*\{[\s\S]*border-radius:\s*999px;/);
  assert.match(stylesSource, /\.wardrobe-tag-match-option\s*\{[\s\S]*white-space:\s*nowrap;/);
});

test("MBA library command bar includes a compact saved views control with save, rename, delete, and apply actions", () => {
  assert.match(appSource, /aria-controls="library-views-popover"[\s\S]*>\s*Views\s*</);
  assert.match(appSource, /id="library-views-popover"[\s\S]*Save current view/);
  assert.match(appSource, /saved-library-view-apply/);
  assert.match(appSource, /handleRenameSavedLibraryView/);
  assert.match(appSource, /handleDeleteSavedLibraryView/);
  assert.match(stylesSource, /\.wardrobe-saved-views-window\s*\{/);
  assert.match(stylesSource, /\.saved-library-view-row\s*\{/);
});
