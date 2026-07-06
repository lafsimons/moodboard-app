import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("board multi-select styles expose stronger selected outlines and board actions anchor", () => {
  assert.match(stylesSource, /\.board-image-visual\.is-selected\s*\{/);
  assert.match(stylesSource, /\.board-image\.is-select-mode \.board-image-actions\s*\{\s*display:\s*none;/);
  assert.match(stylesSource, /box-shadow:\s*0 0 0 5px rgba\(17, 17, 17, 0\.16\);/);
  assert.match(stylesSource, /\.board-selection-actions-anchor\s*\{\s*position:\s*relative;/);
  assert.match(stylesSource, /\.board-canvas-selection-count\s*\{/);
  assert.match(stylesSource, /\.wardrobe-card\.is-on-current-board\s*\{/);
  assert.match(stylesSource, /\.wardrobe-card-corner-badge\s*\{/);
});
