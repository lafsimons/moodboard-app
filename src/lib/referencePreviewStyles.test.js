import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("reference preview zoom uses a native scroll container with enlarged image sizing", () => {
  assert.match(stylesSource, /\.reference-preview-stage\.is-zoomed\s*\{[\s\S]*display:\s*block;[\s\S]*max-height:\s*calc\(100vh - 112px\);[\s\S]*text-align:\s*left;[\s\S]*overflow:\s*auto;/);
  assert.match(stylesSource, /\.reference-preview-image-button\.is-zoomed\s*\{[\s\S]*display:\s*inline-block;[\s\S]*width:\s*auto;[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*none;/);
  assert.match(stylesSource, /\.reference-preview-image-button\.is-zoomed \.managed-image\s*\{[\s\S]*calc\(\(100vw - 120px\) \* 2\),[\s\S]*calc\(\(100vh - 160px\) \* var\(--managed-crop-aspect, 1\) \* 2\)/);
  assert.match(stylesSource, /\.reference-preview-image-button\.is-zoomed \.managed-image\s*\{[\s\S]*max-width:\s*none;[\s\S]*max-height:\s*none;[\s\S]*margin-inline:\s*0;/);
});

test("reference preview zoom styles do not rely on transform or pointer-pan helpers", () => {
  assert.doesNotMatch(stylesSource, /translate3d\(/);
  assert.doesNotMatch(stylesSource, /\.reference-preview-image-button[\s\S]*touch-action:/);
  assert.doesNotMatch(stylesSource, /\.reference-preview-image-button[\s\S]*cursor:\s*grab/);
});
