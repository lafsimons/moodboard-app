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
  assert.match(appSource, /const draftImageUrl = getEffectiveReferencePreviewSource\(draft, draftResolvedPreviewMedia\.src\)/);
  assert.match(appSource, /if \(!hasEffectiveReferencePreviewSource\(draft, draftResolvedPreviewMedia\.src\)\) \{/);
  assert.match(appSource, /isDraftImageLoading/);
});

test("debounced persistence reuses the memoized persisted app state snapshot", () => {
  assert.match(appSource, /enqueueAppStateSave\(currentPersistedAppState, "debounced"\)/);
});

test("fresh import progress is owned at app level and survives add-window reopen", () => {
  assert.match(appSource, /const \[freshImportSession, setFreshImportSession\] = useState\(null\)/);
  assert.match(appSource, /setFreshImportSession\(\{\s*active: true,\s*total: selectedFiles.length/);
  assert.match(appSource, /onProgress: \(\{ file, total, completed, succeeded, failed, ignored \}\) => \{/);
  assert.match(appSource, /function closeWardrobeAdd\(event = null\) \{[\s\S]*setWardrobeAddOpen\(false\);[\s\S]*setItemImageDragActive\(false\);[\s\S]*\}/);
  assert.doesNotMatch(appSource, /function closeWardrobeAdd\(event = null\) \{[\s\S]*setItemImporting\(false\)/);
  assert.match(appSource, /function getFreshImportProgressLabel\(session\) \{/);
  assert.match(appSource, /freshImportSession \? <p className="wardrobe-add-feedback">\{getFreshImportProgressLabel\(freshImportSession\)\}<\/p> : null/);
});
