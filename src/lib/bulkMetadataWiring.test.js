import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

test("bulk metadata edits snapshot in background instead of blocking the tag save path", () => {
  assert.match(
    appSource,
    /void runMetadataSnapshot\("before-bulk-edit", \{\s*priority: "background",\s*changedItemIds: updatedItems\.map\(\(item\) => item\.id\)\s*\}\);\s*await saveItems\(updatedItems\);/
  );
});

test("bulk metadata edits commit library state through a transition after saving", () => {
  assert.match(
    appSource,
    /await saveItems\(updatedItems\);\s*perfSession\?\.mark\("items persisted"[\s\S]*?const updatedItemsById = Object\.fromEntries\(updatedItems\.map\(\(item\) => \[item\.id, item\]\)\);\s*startTransition\(\(\) => \{\s*perfSession\?\.mark\("transition scheduled"\);\s*setItems\(\(current\) => current\.map\(\(item\) => updatedItemsById\[item\.id\] \?\? item\)\);\s*markMetadataDirty\(updatedItems\.map\(\(item\) => item\.id\), \{ persistMode: "deferred" \}\);/s
  );
});

test("app-state persistence reuses the last saved app state instead of reloading it on each queued save", () => {
  assert.match(
    appSource,
    /await saveAppState\(stateToSave, \{\s*previousAppState: lastSavedAppStateRef\.current\s*\}\);\s*lastSavedAppStateRef\.current = stateToSave;/s
  );
});

test("bulk metadata perf instrumentation marks recompute and delayed persistence milestones", () => {
  assert.match(appSource, /createLibraryInteractionPerfSession\(\s*isLibraryPerfDebug,\s*"library bulk metadata edit"/);
  assert.match(appSource, /bulkPerfSession\?\.mark\("visibleWardrobeItems computed"/);
  assert.match(appSource, /libraryBulkMetadataPerfRef\.current\?\.mark\("visibleLibraryTagEntries computed"/);
  assert.match(appSource, /libraryBulkMetadataPerfRef\.current\?\.mark\("libraryParentGroupEntries computed"/);
  assert.match(appSource, /libraryPerfSession\?\.mark\("app-state save queued for idle callback"\)/);
  assert.match(appSource, /perfSession\.mark\("post-edit frame rendered"/);
});
