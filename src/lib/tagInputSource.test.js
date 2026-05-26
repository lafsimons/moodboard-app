import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

const tagInputSource = readFileSync(
  new URL("../components/TagInput.jsx", import.meta.url),
  "utf8"
);

const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("bulk selection actions use overlay-specific tag input classes without changing the normal editor wiring", () => {
  assert.match(appSource, /className="selection-action-tag-input"/);
  assert.match(appSource, /suggestionsClassName="selection-action-tag-input-suggestions"/);
  assert.match(appSource, /placeholder=\{libraryTagActionMode === "add" \? "Add tag" : "Remove tag"\}/);
  assert.match(appSource, /allTags=\{libraryTagActionSuggestions\}/);
  assert.match(appSource, /selectedTags=\{draft\.tags\}[\s\S]{0,600}?placeholder="Add tag…"/);
  assert.doesNotMatch(appSource, /selectedTags=\{draft\.tags\}[\s\S]{0,600}?selection-action-tag-input/);
});

test("tag input suggestion buttons still commit the clicked suggestion directly", () => {
  assert.match(tagInputSource, /onClick=\{\(\) => commitTag\(tag\)\}/);
  assert.match(tagInputSource, /onMouseEnter=\{\(\) => setHighlightedIndex\(index\)\}/);
});

test("bulk selection action suggestions stay unclipped and scrollable above the popover", () => {
  assert.match(stylesSource, /\.selection-actions-popover\s*\{[\s\S]*z-index:\s*125;[\s\S]*overflow:\s*visible;/);
  assert.match(stylesSource, /\.selection-action-editor\s*\{[\s\S]*overflow:\s*visible;/);
  assert.match(stylesSource, /\.selection-action-tag-input-suggestions\s*\{[\s\S]*max-height:\s*min\(220px,\s*40vh\);[\s\S]*overflow-y:\s*auto;/);
});
