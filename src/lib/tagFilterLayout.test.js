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
  assert.match(appSource, /tag-tree-header-compact[\s\S]*\{headerActions\}/);
  assert.match(appSource, /tag-tree-sort-mode-button/);
  assert.match(appSource, /aria-label=\{sortMode === "count" \? "Tag order: count" : "Tag order: A-Z"\}/);
  assert.match(appSource, /tag-tree-toggle-all-button/);
  assert.match(appSource, /aria-label=\{areAllGroupsExpanded \? "Collapse all tag groups" : "Expand all tag groups"\}/);
  assert.match(appSource, /loadStoredTagTreeCollapsedGroups\(storageKey\)/);
  assert.match(appSource, /saveStoredTagTreeCollapsedGroups\(storageKey, collapsedGroups\)/);
  assert.match(stylesSource, /\.wardrobe-controls \.tag-tree-meta\s*\{[\s\S]*flex-wrap:\s*wrap;/);
  assert.match(stylesSource, /\.tag-tree-sort-mode-button\s*\{[\s\S]*width:\s*24px;/);
  assert.match(stylesSource, /\.tag-tree-toggle-all-button\s*\{[\s\S]*width:\s*24px;/);
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

test("MBA controls reference filters include grouped matching, compact expand collapse, and apply shared library views", () => {
  assert.match(appSource, /storageKey="controls-reference-filters"[\s\S]*variant="compact"/);
  assert.match(appSource, /generationMetadataFilters\.tagMatchMode === "grouped"/);
  assert.match(appSource, /controls-reference-views-button/);
  assert.match(appSource, /id="controls-library-views-popover"/);
  assert.match(appSource, /applyControlsSavedLibraryView/);
  assert.doesNotMatch(appSource, /id="controls-library-views-popover"[\s\S]{0,600}?Save current view/);
  assert.match(stylesSource, /\.controls-saved-views-window\s*\{/);
});

test("MBA guided board debug labels separate board output tags from filter direction", () => {
  assert.match(appSource, />Current board tags</);
  assert.match(appSource, />Filter direction</);
  assert.doesNotMatch(appSource, />Direction tags</);
  assert.match(appSource, /debugGuidedBoardCandidates/);
});

test("MBA guided board debug render keys no longer rely on OA slot names", () => {
  assert.match(appSource, /function getGuidedDebugEntryKey/);
  assert.match(appSource, /<section key=\{debugEntryKey\} className="outfit-debug-slot">/);
  assert.doesNotMatch(appSource, /<section key=\{entry\.slot\} className="outfit-debug-slot">/);
});
