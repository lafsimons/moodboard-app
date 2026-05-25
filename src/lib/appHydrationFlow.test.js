import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

test("bootstrap no longer performs a post-startup full-library loadItems hydration pass", () => {
  assert.equal(appSource.includes("const storedItems = await loadItems();"), false);
  assert.equal(appSource.includes("Failed to hydrate full library records after metadata-first startup."), false);
});

test("direct media consumers resolve metadata-only media on demand", () => {
  assert.match(appSource, /async function getAutoImageCrop\(item\) \{[\s\S]*resolveItemMediaSource\(item, "preview"\)/);
  assert.match(appSource, /async function extractItemPalette\(item\) \{[\s\S]*resolveItemMediaSource\(item, "preview"\)/);
  assert.match(appSource, /async function handleExportOutfitImage\(\) \{[\s\S]*resolveItemMediaSource\(item, "original"\)/);
  assert.match(appSource, /async function handleExportWardrobeImage\(\) \{[\s\S]*resolveItemMediaSource\(item, "original"\)/);
  assert.match(appSource, /async function removeDraftBackground\(\) \{[\s\S]*draftBackgroundRemovalMedia\.src/);
  assert.match(appSource, /const cropEditorBody = cropEditorState && cropEditorImageUrl \?/);
});

test("editor image controls key off resolver-backed draft preview state", () => {
  assert.match(appSource, /const draftResolvedPreviewMedia = useResolvedItemMediaSource\(editingId \? draft : null, "preview"\)/);
  assert.match(appSource, /const draftImageUrl = \(draftResolvedPreviewMedia\.src \|\| draft\.imageUrl\)\.trim\(\)/);
  assert.match(appSource, /isDraftImageLoading/);
});
