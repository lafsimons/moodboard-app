import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);
const storageSource = readFileSync(
  new URL("./storage.js", import.meta.url),
  "utf8"
);
const taggingUxSource = readFileSync(
  new URL("./taggingUx.js", import.meta.url),
  "utf8"
);
const itemsRepositorySource = readFileSync(
  new URL("../repositories/itemsRepository.js", import.meta.url),
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
    /deferAppStatePersistence\(15000,\s*"bulk metadata edit"\);[\s\S]*await saveItems\(updatedItems\);[\s\S]*const updatedItemsById = Object\.fromEntries\(updatedItems\.map\(\(item\) => \[item\.id, item\]\)\);\s*startTransition\(\(\) => \{\s*perfSession\?\.mark\("transition scheduled"\);\s*setItems\(\(current\) => current\.map\(\(item\) => updatedItemsById\[item\.id\] \?\? item\)\);\s*markMetadataDirty\(updatedItems\.map\(\(item\) => item\.id\), \{ persistMode: "deferred" \}\);/s
  );
});

test("app-state persistence reuses the last saved app state instead of reloading it on each queued save", () => {
  assert.match(
    appSource,
    /await saveAppState\(stateToSave, \{\s*previousAppState: lastSavedAppStateRef\.current\s*\}\);\s*lastSavedAppStateRef\.current = stateToSave;/s
  );
});

test("bulk metadata perf instrumentation marks recompute and delayed persistence milestones", () => {
  assert.match(appSource, /const deferredLibraryItems = useDeferredValue\(items\);/);
  assert.match(appSource, /const deferredVisibleWardrobeItems = useDeferredValue\(visibleWardrobeItems\);/);
  assert.match(appSource, /const normalizedWardrobeFilters = useMemo\(\s*\(\) => normalizeWardrobeFilterState\(wardrobeFilters\),\s*\[wardrobeFilters\]\s*\);/s);
  assert.match(appSource, /const normalizedLibrarySearchQuery = useMemo\(\s*\(\) => normalizeLibrarySearchQuery\(librarySearch\),/s);
  assert.match(appSource, /const librarySearchTextById = useMemo\(\s*\(\) => new Map\(deferredLibraryItems\.map\(\(item\) => \[item\.id, buildLibrarySearchText\(item\)\]\)\),/s);
  assert.match(appSource, /function matchesNormalizedWardrobeFilters\(item, normalizedFilters, options = \{\}\)/);
  assert.match(appSource, /matchesNormalizedWardrobeFilters\(item, normalizedWardrobeFilters, \{ ignoreTagFilters: true \}\)/);
  assert.match(appSource, /matchesNormalizedWardrobeFilters\(item, normalizedWardrobeFilters\)/);
  assert.match(appSource, /createLibraryInteractionPerfSession\(\s*isLibraryPerfDebug,\s*"library bulk metadata edit"/);
  assert.match(appSource, /const filtered = deferredLibraryItems\.filter\(\(item\) =>/);
  assert.match(appSource, /bulkPerfSession\?\.mark\("visibleWardrobeItems computed"/);
  assert.match(appSource, /const nextEntries = getTagFrequencyEntries\(deferredVisibleWardrobeItems\);/);
  assert.match(appSource, /deferredVisibleWardrobeItems\.forEach\(\(item\) => \{/);
  assert.match(appSource, /libraryBulkMetadataPerfRef\.current\?\.mark\("visibleLibraryTagEntries computed"/);
  assert.match(appSource, /libraryBulkMetadataPerfRef\.current\?\.mark\("libraryParentGroupEntries computed"/);
  assert.match(appSource, /libraryPerfSession\?\.mark\("app-state save deferred"/);
  assert.match(appSource, /perfSession\.mark\("post-edit frame rendered"/);
});

test("saveAppState exposes phase timing when library perf debug is enabled", () => {
  assert.match(storageSource, /createStoragePerfSession\(isLibraryPerfDebugEnabled\(\), "save app state"\)/);
  assert.match(storageSource, /perfSession\?\.mark\("app state record persisted"\)/);
  assert.match(storageSource, /perfSession\?\.mark\("saved board metadata diff prepared"/);
  assert.match(storageSource, /perfSession\?\.mark\("saved board sync metadata persisted"\)/);
});

test("storage caches persisted app state and device id across repeated saves", () => {
  assert.match(storageSource, /let cachedDeviceId = "";/);
  assert.match(storageSource, /let cachedPersistedAppState = null;/);
  assert.match(storageSource, /if \(hasCachedPersistedAppState\) \{\s*return cloneData\(cachedPersistedAppState\);\s*\}/s);
  assert.match(storageSource, /hasPreviousAppStateOverride \|\| hasCachedPersistedAppState\s*\?\s*"previous app state reused from memory"/s);
  assert.match(storageSource, /if \(cachedDeviceId\) \{\s*return cachedDeviceId;\s*\}/s);
});

test("saveItem media snapshots are only collected when explicit storage-save debug is enabled", () => {
  assert.match(storageSource, /function isStorageSaveDebugEnabled\(\)/);
  assert.match(storageSource, /const storageSaveDebugEnabled = isStorageSaveDebugEnabled\(\);/);
  assert.match(storageSource, /if \(storageSaveDebugEnabled\) \{\s*const beforeSnapshot = await createSaveMediaDebugSnapshot\(existingOwnerItem\);/s);
  assert.match(storageSource, /if \(storageSaveDebugEnabled\) \{\s*const afterSnapshot = await createSaveMediaDebugSnapshot\(storedItem\);/s);
});

test("bulk saveItems skips result materialization and metadata-only media backfill for ordinary edits", () => {
  assert.match(itemsRepositorySource, /await saveStoredItems\(normalizedItems, \{ materializeResult: false \}\);/);
  assert.match(storageSource, /const shouldMaterializeResult = options\.materializeResult !== false;/);
  assert.match(storageSource, /const requiresMetadataMediaBackfill = !existingItem \|\| \(existingOwnerItem\?\.id && existingOwnerItem\.id !== storedItem\.id\);/);
});

test("library search text is cached per item and reused by library filtering", () => {
  assert.match(taggingUxSource, /const librarySearchTextCache = new WeakMap\(\);/);
  assert.match(taggingUxSource, /librarySearchTextCache\.get\(item\)/);
  assert.match(appSource, /librarySearchTextById\.get\(item\.id\) \?\? ""\)\.includes\(normalizedLibrarySearchQuery\)/);
});

test("storage saveItems batches existing metadata-only updates into shared item and sync metadata transactions", () => {
  assert.match(storageSource, /export async function saveItems\(items, options = \{\}\)/);
  assert.match(storageSource, /if \(incomingIds\.length !== incomingItems\.length\) \{\s*return Promise\.all\(normalizedItems\.map\(\(item\) => saveItem\(item, options\)\)\);\s*\}/s);
  assert.match(storageSource, /if \(classifyItemSave\(existingItem, originalItem\) !== "metadataOnly"\) \{\s*return Promise\.all\(normalizedItems\.map\(\(item\) => saveItem\(item, options\)\)\);\s*\}/s);
  assert.match(storageSource, /await withStores\(\[ITEM_STORE, SYNC_METADATA_STORE\], "readwrite", \(\{ items: itemStore, syncMetadata \}\) => \{/);
});

test("background metadata snapshots defer queue draining off the current bulk-edit turn", () => {
  assert.match(storageSource, /let backgroundMetadataSnapshotDrainScheduled = false;/);
  assert.match(storageSource, /function scheduleMetadataSnapshotDrain\(priority = "background"\)/);
  assert.match(storageSource, /if \(priority === "blocking"\) \{\s*void drainMetadataSnapshotQueue\(\);\s*return;\s*\}/s);
  assert.match(storageSource, /setTimeout\(\(\) => \{\s*backgroundMetadataSnapshotDrainScheduled = false;[\s\S]*void drainMetadataSnapshotQueue\(\);[\s\S]*\}, 0\);/s);
});
