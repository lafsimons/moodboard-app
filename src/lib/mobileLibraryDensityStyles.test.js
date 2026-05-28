import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("mobile library command bar compacts into a search row and dense primary controls row", () => {
  assert.match(stylesSource, /@media \(max-width: 960px\) \{[\s\S]*\.library-command-bar\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*8px;/);
  assert.match(stylesSource, /\.library-selection-toolbar\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto auto;[\s\S]*gap:\s*6px;/);
  assert.match(stylesSource, /\.library-command-bar-leading\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*8px;/);
  assert.match(stylesSource, /\.library-command-bar-main-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);[\s\S]*gap:\s*5px;/);
  assert.match(stylesSource, /@media \(max-width: 960px\) \{[\s\S]*\.library-command-bar\.is-mobile-selection-toolbar\s*\{[\s\S]*gap:\s*0;/);
  assert.match(stylesSource, /\.library-selection-toolbar-status\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(stylesSource, /\.library-mobile-more-popover\s*\{[\s\S]*width:\s*min\(180px,\s*calc\(100vw - 28px\)\);/);
});

test("mobile library grid and cards tighten spacing while keeping two columns", () => {
  assert.match(stylesSource, /@media \(max-width: 960px\) \{[\s\S]*\.wardrobe-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*gap:\s*3px;/);
  assert.match(stylesSource, /\.wardrobe-card\.is-mobile-card\s*\{[\s\S]*--library-card-min-height:\s*0;[\s\S]*padding:\s*0;[\s\S]*border:\s*none;[\s\S]*background:\s*transparent;/);
  assert.match(stylesSource, /\.wardrobe-preview\.is-mobile-preview-card\s*\{[\s\S]*aspect-ratio:\s*var\(--library-mobile-tile-ratio, 0\.9\);[\s\S]*padding:\s*0;[\s\S]*background:\s*transparent;/);
  assert.match(stylesSource, /\.wardrobe-card\.is-mobile-card\.is-selected \.wardrobe-preview::after,[\s\S]*box-shadow:\s*inset 0 0 0 2px rgba\(255, 255, 255, 0\.94\), inset 0 0 0 4px rgba\(17, 17, 17, 0\.22\);/);
  assert.match(stylesSource, /\.wardrobe-mobile-selection-badge\s*\{[\s\S]*min-width:\s*22px;[\s\S]*background:\s*rgba\(17, 17, 17, 0\.82\);/);
});

test("mobile library fullscreen shell flattens the overlay into an edge-to-edge viewport surface with sticky transparent header", () => {
  assert.match(stylesSource, /\.active-panel-overlay\.is-wardrobe-panel\.is-mobile-fullscreen-shell\s*\{[\s\S]*top:\s*0;[\s\S]*left:\s*0;[\s\S]*right:\s*0;[\s\S]*bottom:\s*0;[\s\S]*width:\s*100vw;[\s\S]*max-width:\s*none;[\s\S]*transform:\s*none;[\s\S]*background:\s*var\(--bg\);[\s\S]*z-index:\s*52;/);
  assert.match(stylesSource, /\.wardrobe-workspace\.is-mobile-fullscreen-shell\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100dvh;[\s\S]*max-height:\s*none;/);
  assert.match(stylesSource, /\.wardrobe-panel\.is-mobile-fullscreen-shell\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100dvh;[\s\S]*border:\s*none;[\s\S]*border-radius:\s*0;[\s\S]*background:\s*var\(--bg\);[\s\S]*overflow:\s*hidden;/);
  assert.match(stylesSource, /\.wardrobe-panel > \.panel-header\.is-mobile-fullscreen-shell\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;[\s\S]*background:\s*transparent;[\s\S]*backdrop-filter:\s*none;/);
  assert.match(stylesSource, /\.wardrobe-panel-scroll\.is-mobile-fullscreen-shell\s*\{[\s\S]*padding:[\s\S]*78px \+ env\(safe-area-inset-bottom\)[\s\S]*overflow-y:\s*auto;/);
});

test("mobile library selection actions popover stays anchored inside the viewport", () => {
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[\s\S]*\.library-tag-action-anchor\.is-mobile-library-actions-anchor\s*\{[\s\S]*margin-left:\s*auto;/);
  assert.match(stylesSource, /\.selection-actions-popover\.is-mobile-library-actions-popover\s*\{[\s\S]*left:\s*auto;[\s\S]*right:\s*0;[\s\S]*width:\s*min\(236px,\s*calc\(100vw - 24px - env\(safe-area-inset-left\) - env\(safe-area-inset-right\)\)\);[\s\S]*max-width:\s*calc\(100vw - 24px - env\(safe-area-inset-left\) - env\(safe-area-inset-right\)\);/);
});
