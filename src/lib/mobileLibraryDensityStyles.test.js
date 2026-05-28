import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("mobile library command bar compacts into a search row and dense primary controls row", () => {
  assert.match(stylesSource, /@media \(max-width: 960px\) \{[\s\S]*\.library-command-bar\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*8px;/);
  assert.match(stylesSource, /\.library-command-bar-leading\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*8px;/);
  assert.match(stylesSource, /\.library-command-bar-main-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);[\s\S]*gap:\s*5px;/);
  assert.match(stylesSource, /\.library-mobile-more-popover\s*\{[\s\S]*width:\s*min\(180px,\s*calc\(100vw - 28px\)\);/);
});

test("mobile library grid and cards tighten spacing while keeping two columns", () => {
  assert.match(stylesSource, /@media \(max-width: 960px\) \{[\s\S]*\.wardrobe-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*gap:\s*3px;/);
  assert.match(stylesSource, /\.wardrobe-card\.is-mobile-card\s*\{[\s\S]*--library-card-min-height:\s*0;[\s\S]*padding:\s*0;[\s\S]*border:\s*none;[\s\S]*background:\s*transparent;/);
  assert.match(stylesSource, /\.wardrobe-preview\.is-mobile-preview-card\s*\{[\s\S]*aspect-ratio:\s*var\(--library-mobile-tile-ratio, 0\.9\);[\s\S]*padding:\s*0;[\s\S]*background:\s*transparent;/);
  assert.match(stylesSource, /\.wardrobe-card\.is-mobile-card\.is-selected \.wardrobe-preview::after,[\s\S]*box-shadow:\s*inset 0 0 0 2px rgba\(255, 255, 255, 0\.94\), inset 0 0 0 4px rgba\(17, 17, 17, 0\.22\);/);
  assert.match(stylesSource, /\.wardrobe-mobile-selection-badge\s*\{[\s\S]*min-width:\s*22px;[\s\S]*background:\s*rgba\(17, 17, 17, 0\.82\);/);
});
