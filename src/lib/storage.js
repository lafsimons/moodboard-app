import defaultWardrobe from "../data/defaultWardrobe.js";
import defaultAppState from "../data/defaultAppState.js";
import {
  normalizeLibraryProvenance,
  normalizeLocalSafetyState,
  normalizeMetadataSnapshotReason
} from "./appStateModel.js";
import {
  BACKUP_SOURCE,
  INDEXED_DB_NAME,
  LEGACY_INDEXED_DB_NAME,
  SUPPORTED_BACKUP_SOURCES,
  SUPPORTED_BACKUP_VERSIONS
} from "./appIdentity.js";
import { ensureBoardUuid, ensureSavedBoardUuid } from "./boardIdentity.js";
import {
  applyPreviewImageFields,
  createImageAsset,
  itemHasExplicitMediaChange,
  itemHasExplicitMediaRemoval,
  itemHasImagePayload,
  mergeItemImageState,
  normalizeMediaUpdateIntent,
  normalizeItemImages
} from "./itemImages.js";
import { normalizeKnownOriginalRelativePath } from "./itemIdentity.js";
import { migrateReferenceMetadataToTags, sanitizeBackupReference } from "./metadata.js";
import { stripItemMediaPayloads } from "./startupItemMetadata.js";

const DB_VERSION = 8;
export const BACKUP_VERSION = 2;
export const BACKUP_EXPORT_WARN_BYTES = 150 * 1024 * 1024;
export const BACKUP_IMPORT_MAX_BYTES = 250 * 1024 * 1024;
export const BACKUP_IMPORT_HARD_MAX_BYTES = 650 * 1024 * 1024;
export const METADATA_SNAPSHOT_VERSION = 1;
export const METADATA_SNAPSHOT_RETENTION_COUNT = 40;
export const METADATA_AUTOSNAPSHOT_INTERVAL_MS = 20 * 60 * 1000;
const ITEM_STORE = "items";
const APP_STORE = "appState";
const ITEM_MEDIA_STORE = "itemMediaAssets";
const ORIGINAL_STORE = "originalImageBlobs";
const SYNC_STATE_STORE = "syncState";
const SYNC_METADATA_STORE = "syncMetadata";
const METADATA_SNAPSHOT_STORE = "metadataSnapshots";
const ORIGINAL_RECOVERY_STORE = "originalRecoverySessions";
const SYNC_STATE_KEY = "state";
const MIGRATED_STORES = [ITEM_STORE, APP_STORE, ORIGINAL_STORE];
const PERSISTED_APP_STATE_MAX_BYTES = 1024 * 1024;
const SYNC_BACKFILL_BATCH_SIZE = 100;
const ITEM_MEDIA_VARIANTS = ["preview", "thumbnail"];
const SNAPSHOT_REASON_PRIORITY = {
  autosnapshot: 1,
  "visibility-hidden": 2,
  "before-import": 3,
  "before-bulk-edit": 3,
  "before-delete": 3,
  "before-migration": 3,
  "before-repair": 3,
  "before-dedupe": 3,
  manual: 4
};
const ORIGINAL_RECOVERY_SESSION_STATUSES = [
  "idle",
  "scanned",
  "reviewed",
  "applying",
  "completed",
  "completed_with_errors"
];
const ORIGINAL_RECOVERY_MATCH_OUTCOMES = [
  "exact_single",
  "strong_single",
  "possible_single",
  "ambiguous_multiple",
  "weak_only",
  "no_match",
  "excluded"
];
const ORIGINAL_RECOVERY_DECISIONS = [
  "accepted",
  "rejected",
  "skipped",
  "undecided",
  "needs_rescan"
];
const ORIGINAL_RECOVERY_APPLY_RESULTS = ["recovered", "failed", "skipped"];

let indexedDbFactory = () => globalThis.indexedDB;
let databaseReadyPromise = null;
let activeMetadataSnapshotRequest = null;
let pendingMetadataSnapshotRequest = null;

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePersistedId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePersistedBoardImage(image, index = 0) {
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    return null;
  }

  const sanitizedImage = {
    id: normalizePersistedId(image.id) || `board_image_${index}`,
    referenceId: normalizePersistedId(image.referenceId),
    referenceItemUuid: normalizePersistedId(image.referenceItemUuid),
    x: Math.round(Number(image.x) || 0),
    y: Math.round(Number(image.y) || 0),
    width: Math.max(0, Math.round(Number(image.width) || 0)),
    height: Math.max(0, Math.round(Number(image.height) || 0)),
    rotation: Math.round((Number(image.rotation) || 0) * 10) / 10,
    zIndex: Math.max(1, Math.round(Number(image.zIndex) || index + 1)),
    generationSlot: normalizePersistedId(image.generationSlot)
  };
  const referenceSourceKey = normalizePersistedId(image.referenceSourceKey).toLowerCase();

  if (referenceSourceKey) {
    sanitizedImage.referenceSourceKey = referenceSourceKey;
  }

  return sanitizedImage.referenceId ? sanitizedImage : null;
}

function sanitizePersistedBoard(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) {
    return null;
  }

  const images = (Array.isArray(board.images) ? board.images : [])
    .map((image, index) => sanitizePersistedBoardImage(image, index))
    .filter(Boolean);

  if (!images.length) {
    return null;
  }

  return {
    id: normalizePersistedId(board.id) || `board_${Date.now()}`,
    boardUuid: normalizePersistedId(board.boardUuid),
    width: Math.max(0, Math.round(Number(board.width) || 0)),
    height: Math.max(0, Math.round(Number(board.height) || 0)),
    images
  };
}

function sanitizePersistedOutfit(outfit) {
  return Object.fromEntries(
    Object.entries(outfit && typeof outfit === "object" && !Array.isArray(outfit) ? outfit : {}).map(
      ([slot, itemId]) => [slot, normalizePersistedId(itemId) || null]
    )
  );
}

function sanitizePersistedSavedOutfit(savedOutfit, index = 0) {
  if (!savedOutfit || typeof savedOutfit !== "object" || Array.isArray(savedOutfit)) {
    return null;
  }

  const sanitizedOutfit = sanitizePersistedOutfit(savedOutfit.outfit);
  const sanitizedSavedOutfit = {
    id: normalizePersistedId(savedOutfit.id) || `saved_outfit_${index}`,
    name: typeof savedOutfit.name === "string" ? savedOutfit.name : "Saved board",
    description: typeof savedOutfit.description === "string" ? savedOutfit.description : "",
    board: sanitizePersistedBoard(savedOutfit.board)
  };

  if (Object.keys(sanitizedOutfit).length) {
    sanitizedSavedOutfit.outfit = sanitizedOutfit;
  }

  if (savedOutfit.layering) {
    sanitizedSavedOutfit.layering = true;
  }

  return sanitizedSavedOutfit;
}

function sanitizePersistedAppState(value = {}) {
  return {
    ...value,
    itemDefaultsMigrationVersion: Math.max(0, Math.round(Number(value.itemDefaultsMigrationVersion) || 0)),
    imagePresentationMigrationVersion: Math.max(0, Math.round(Number(value.imagePresentationMigrationVersion) || 0)),
    provenance: normalizeLibraryProvenance(value.provenance),
    localSafety: normalizeLocalSafetyState(value.localSafety),
    outfit: sanitizePersistedOutfit(value.outfit),
    board: sanitizePersistedBoard(value.board),
    savedOutfits: (Array.isArray(value.savedOutfits) ? value.savedOutfits : [])
      .map((savedOutfit, index) => sanitizePersistedSavedOutfit(savedOutfit, index))
      .filter(Boolean)
  };
}

function sanitizeBackupAppStateSnapshot(appState) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    return {};
  }

  const strippedAppState = stripLocalOnlyAppState(appState);
  const sanitizedAppState = {
    ...strippedAppState
  };

  if (Object.prototype.hasOwnProperty.call(strippedAppState, "outfit")) {
    sanitizedAppState.outfit = sanitizePersistedOutfit(strippedAppState.outfit);
  }

  if (Object.prototype.hasOwnProperty.call(strippedAppState, "board")) {
    sanitizedAppState.board = sanitizePersistedBoard(strippedAppState.board);
  }

  if (Object.prototype.hasOwnProperty.call(strippedAppState, "savedOutfits")) {
    sanitizedAppState.savedOutfits = (Array.isArray(strippedAppState.savedOutfits) ? strippedAppState.savedOutfits : [])
      .map((savedOutfit, index) => sanitizePersistedSavedOutfit(savedOutfit, index))
      .filter(Boolean);
  }

  return sanitizedAppState;
}

function normalizeSnapshotText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSnapshotCount(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.round(parsedValue) : 0;
}

function normalizeSnapshotChangedItemIds(value) {
  return normalizeLocalSafetyState({
    changedItemIdsSinceSnapshot: value
  }).changedItemIdsSinceSnapshot;
}

function countSnapshotBoards(appState) {
  const currentBoardCount = Array.isArray(appState?.board?.images) && appState.board.images.length ? 1 : 0;
  const savedBoardCount = Array.isArray(appState?.savedOutfits) ? appState.savedOutfits.filter((entry) => entry?.board).length : 0;
  return currentBoardCount + savedBoardCount;
}

function getApproxSerializedBytes(value) {
  const serialized = JSON.stringify(value);
  const approxBytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(serialized).length
    : serialized.length * 2;

  return {
    serialized,
    approxBytes
  };
}

function createDeviceId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeSyncText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSyncBoolean(value) {
  return Boolean(value);
}

function normalizeSyncNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Math.round(numericValue) : fallback;
}

function normalizeSyncTimestamp(value) {
  const trimmedValue = normalizeSyncText(value);

  if (!trimmedValue) {
    return "";
  }

  const parsedValue = Date.parse(trimmedValue);
  return Number.isFinite(parsedValue) ? new Date(parsedValue).toISOString() : "";
}

function normalizeSyncState(record, fallbackDeviceId = "", now = getCurrentSyncTimestamp()) {
  const normalizedDeviceId = normalizeSyncText(record?.deviceId) || normalizeSyncText(fallbackDeviceId);
  const normalizedCreatedAt = normalizeSyncTimestamp(record?.createdAt);
  const normalizedUpdatedAt = normalizeSyncTimestamp(record?.updatedAt);
  const createdAt = normalizedCreatedAt || normalizedUpdatedAt || now;
  const updatedAt = normalizedUpdatedAt || normalizedCreatedAt || createdAt;

  return {
    key: SYNC_STATE_KEY,
    deviceId: normalizedDeviceId,
    createdAt,
    updatedAt,
    lastPushCursor: normalizeSyncText(record?.lastPushCursor),
    lastPullCursor: normalizeSyncText(record?.lastPullCursor)
  };
}

function getCurrentSyncTimestamp() {
  return new Date().toISOString();
}

function normalizeSyncMetadataKey(value) {
  return normalizeSyncText(value);
}

function createReferenceSyncMetadataKey(itemUuid) {
  const stableKey = normalizeSyncText(itemUuid);
  return stableKey ? `mba:reference:${stableKey}` : "";
}

function createBoardSyncMetadataKey(boardUuid) {
  const stableKey = normalizeSyncText(boardUuid);
  return stableKey ? `mba:board:${stableKey}` : "";
}

function normalizeSyncMetadataRecord(record) {
  const key = normalizeSyncMetadataKey(record?.key);

  if (!key) {
    throw new Error("Sync metadata entry is missing a key.");
  }

  return {
    key,
    entityType: normalizeSyncText(record?.entityType),
    stableKey: normalizeSyncText(record?.stableKey),
    localId: normalizeSyncText(record?.localId),
    recordVersion: normalizeSyncNumber(record?.recordVersion),
    syncStatus: normalizeSyncText(record?.syncStatus),
    lastSyncedAt: normalizeSyncTimestamp(record?.lastSyncedAt),
    lastModifiedByDevice: normalizeSyncText(record?.lastModifiedByDevice),
    pendingDelete: normalizeSyncBoolean(record?.pendingDelete),
    lastSyncError: normalizeSyncText(record?.lastSyncError),
    lastLocalChangeAt: normalizeSyncTimestamp(record?.lastLocalChangeAt)
  };
}

function createNextDirtySyncMetadataRecord({
  key,
  entityType,
  stableKey,
  localId,
  existingRecord = null,
  deviceId = "",
  pendingDelete = false,
  now = getCurrentSyncTimestamp()
}) {
  return normalizeSyncMetadataRecord({
    key,
    entityType,
    stableKey,
    localId,
    recordVersion: normalizeSyncNumber(existingRecord?.recordVersion) + 1,
    syncStatus: "pending_upload",
    lastSyncedAt: normalizeSyncTimestamp(existingRecord?.lastSyncedAt),
    lastModifiedByDevice: normalizeSyncText(deviceId),
    pendingDelete,
    lastSyncError: "",
    lastLocalChangeAt: now
  });
}

function buildReferenceSyncMetadata(item, deviceId, existingRecord = null) {
  const stableKey = normalizeSyncText(item?.itemUuid);
  const key = createReferenceSyncMetadataKey(stableKey);

  if (!key) {
    return null;
  }

  if (existingRecord) {
    return null;
  }

  return normalizeSyncMetadataRecord({
    key,
    entityType: "mbaReference",
    stableKey,
    localId: normalizeSyncText(item?.id),
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: normalizeSyncText(deviceId),
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
}

async function markReferenceSyncMetadataDirtyForItem(item) {
  const stableKey = normalizeSyncText(item?.itemUuid);

  if (!stableKey) {
    return null;
  }

  const [deviceId, existingRecord] = await Promise.all([
    getOrCreateDeviceId(),
    getSyncMetadata(createReferenceSyncMetadataKey(stableKey))
  ]);

  const nextRecord = createNextDirtySyncMetadataRecord({
    key: createReferenceSyncMetadataKey(stableKey),
    entityType: "mbaReference",
    stableKey,
    localId: normalizeSyncText(item?.id),
    existingRecord,
    deviceId,
    pendingDelete: false
  });

  await upsertSyncMetadata(nextRecord);
  return nextRecord;
}

function buildSavedBoardSyncMetadata(savedOutfit, deviceId, existingRecord = null) {
  const normalizedSavedOutfit = ensureSavedBoardUuid(savedOutfit);
  const stableKey = normalizeSyncText(normalizedSavedOutfit?.board?.boardUuid);
  const key = createBoardSyncMetadataKey(stableKey);

  if (!key) {
    return null;
  }

  if (existingRecord) {
    return null;
  }

  return normalizeSyncMetadataRecord({
    key,
    entityType: "mbaBoard",
    stableKey,
    localId: normalizeSyncText(normalizedSavedOutfit?.id),
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: normalizeSyncText(deviceId),
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
}

function getSavedBoardSyncableRecord(savedOutfit) {
  const normalizedSavedOutfit = ensureSavedBoardUuid(savedOutfit);
  const boardUuid = normalizeSyncText(normalizedSavedOutfit?.board?.boardUuid);

  if (!boardUuid) {
    return null;
  }

  return {
    ...normalizedSavedOutfit,
    board: normalizedSavedOutfit.board
  };
}

function createSavedBoardMetadataByStableKey(savedOutfits = []) {
  return (Array.isArray(savedOutfits) ? savedOutfits : []).reduce((lookup, savedOutfit) => {
    const syncableSavedOutfit = getSavedBoardSyncableRecord(savedOutfit);

    if (!syncableSavedOutfit) {
      return lookup;
    }

    lookup[syncableSavedOutfit.board.boardUuid] = syncableSavedOutfit;
    return lookup;
  }, {});
}

function haveSavedBoardRecordsChanged(previousSavedOutfit, nextSavedOutfit) {
  return JSON.stringify(previousSavedOutfit) !== JSON.stringify(nextSavedOutfit);
}

function stripLocalOnlyAppState(appState) {
  if (!appState || typeof appState !== "object") {
    return {};
  }

  const { recentOutfits, localSafety, ...rest } = appState;
  return rest;
}

function buildMetadataStatePayload(items, appState) {
  return {
    source: BACKUP_SOURCE,
    version: BACKUP_VERSION,
    items: (Array.isArray(items) ? items : []).map((item) => stripItemMediaPayloads(migrateReferenceMetadataToTags(item))),
    appState: sanitizeBackupAppStateSnapshot(appState)
  };
}

function mergeChangedItemIds(...lists) {
  const seenIds = new Set();
  const mergedIds = [];

  lists.forEach((list) => {
    normalizeSnapshotChangedItemIds(list).forEach((itemId) => {
      if (!seenIds.has(itemId)) {
        seenIds.add(itemId);
        mergedIds.push(itemId);
      }
    });
  });

  return mergedIds;
}

function buildNextLocalSafetyState(currentLocalSafety, updates = {}) {
  return normalizeLocalSafetyState({
    ...normalizeLocalSafetyState(currentLocalSafety),
    ...updates
  });
}

function buildMetadataSnapshotErrorMessage(error) {
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "Metadata snapshot failed.";
}

function buildSnapshotStateWithPersistedLocalSafety(appState, localSafety) {
  return sanitizePersistedAppState({
    ...(appState && typeof appState === "object" && !Array.isArray(appState) ? appState : {}),
    localSafety
  });
}

async function persistSnapshotLocalSafety(appState, localSafety) {
  const sanitizedState = buildSnapshotStateWithPersistedLocalSafety(appState, localSafety);
  await saveAppState(sanitizedState, {
    previousAppState: sanitizePersistedAppState(appState)
  });
  return sanitizedState.localSafety;
}

function getSnapshotReasonPriority(reason) {
  return SNAPSHOT_REASON_PRIORITY[normalizeMetadataSnapshotReason(reason)] ?? 0;
}

function mergeSnapshotRequestDescriptor(currentRequest, nextRequest) {
  if (!currentRequest) {
    return nextRequest;
  }

  const currentReason = normalizeMetadataSnapshotReason(currentRequest.reason);
  const nextReason = normalizeMetadataSnapshotReason(nextRequest.reason);
  const resolvedReason =
    getSnapshotReasonPriority(nextReason) >= getSnapshotReasonPriority(currentReason)
      ? nextReason || currentReason
      : currentReason || nextReason;

  return {
    ...currentRequest,
    ...nextRequest,
    reason: resolvedReason,
    changedItemIds: mergeChangedItemIds(currentRequest.changedItemIds, nextRequest.changedItemIds),
    priority: currentRequest.priority === "blocking" || nextRequest.priority === "blocking" ? "blocking" : "background",
    waiters: [...(currentRequest.waiters ?? []), ...(nextRequest.waiters ?? [])]
  };
}

function stripItemInlineMediaFields(record = {}) {
  const normalizedImages = normalizeItemImages(record);
  const { mediaUpdateIntent: _mediaUpdateIntent, ...rest } = record ?? {};

  return {
    ...rest,
    imageUrl: "",
    knownOriginalRelativePath: normalizeKnownOriginalRelativePath(rest?.knownOriginalRelativePath),
    images: {
      ...(rest?.images && typeof rest.images === "object" && !Array.isArray(rest.images) ? rest.images : {}),
      original: {
        ...normalizedImages.original,
        src: ""
      },
      preview: {
        ...normalizedImages.preview,
        src: ""
      },
      thumbnail: {
        ...normalizedImages.thumbnail,
        src: ""
      }
    },
    originalPreserved: normalizedImages.originalPreserved
  };
}

function omitMediaUpdateIntent(record = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return record;
  }

  const { mediaUpdateIntent: _mediaUpdateIntent, ...rest } = record;
  return rest;
}

function classifyItemSave(existingOwnerItem, incomingItem) {
  if (!existingOwnerItem) {
    return "newItem";
  }

  if (itemHasExplicitMediaRemoval(incomingItem)) {
    return "mediaRemove";
  }

  if (itemHasExplicitMediaChange(incomingItem) || itemHasImagePayload(incomingItem) || normalizeMediaUpdateIntent(incomingItem?.mediaUpdateIntent) === "replace") {
    return "mediaReplace";
  }

  return "metadataOnly";
}

async function hasOtherStoredItemWithItemUuid(itemUuid, excludedIds = []) {
  const normalizedItemUuid = normalizeSyncText(itemUuid);

  if (!normalizedItemUuid) {
    return false;
  }

  const excludedIdSet = new Set((Array.isArray(excludedIds) ? excludedIds : []).map((value) => normalizeSyncText(value)).filter(Boolean));
  const items = await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.getAll());

  return (Array.isArray(items) ? items : []).some((item) => {
    const itemId = normalizeSyncText(item?.id);
    return normalizeSyncText(item?.itemUuid) === normalizedItemUuid && !excludedIdSet.has(itemId);
  });
}

async function createSaveMediaDebugSnapshot(item = null) {
  const normalizedItemId = normalizeSyncText(item?.id);
  const normalizedItemUuid = normalizeSyncText(item?.itemUuid);
  const normalizedImages = normalizeItemImages(item);
  const [storedPreview, storedThumbnail, storedOriginal] = await Promise.all([
    normalizedItemId ? loadStoredItemMediaAsset(normalizedItemId, "preview") : null,
    normalizedItemId ? loadStoredItemMediaAsset(normalizedItemId, "thumbnail") : null,
    normalizedItemUuid ? loadOriginalImageBlobEntry(normalizedItemUuid) : null
  ]);

  return {
    id: normalizedItemId,
    itemUuid: normalizedItemUuid,
    originalFilename: normalizeSyncText(item?.originalFilename),
    previewAssetKey: createItemMediaKey(normalizedItemId, "preview"),
    thumbnailAssetKey: createItemMediaKey(normalizedItemId, "thumbnail"),
    originalBlobKey: normalizedItemUuid,
    imageUrl: normalizeSyncText(item?.imageUrl),
    images: {
      preview: createImageAsset(normalizedImages.preview),
      thumbnail: createImageAsset(normalizedImages.thumbnail),
      original: createImageAsset(normalizedImages.original)
    },
    storedPreview: storedPreview ? createImageAsset(storedPreview) : null,
    storedThumbnail: storedThumbnail ? createImageAsset(storedThumbnail) : null,
    storedOriginal: storedOriginal
      ? {
          mimeType: normalizeSyncText(storedOriginal.mimeType),
          width: Math.max(0, Math.round(Number(storedOriginal.width) || 0)),
          height: Math.max(0, Math.round(Number(storedOriginal.height) || 0)),
          fileSize: Math.max(0, Math.round(Number(storedOriginal.fileSize) || 0)),
          originalFilename: normalizeSyncText(storedOriginal.originalFilename)
        }
      : null
  };
}

function createItemMediaKey(itemId, variant) {
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";
  const normalizedVariant = typeof variant === "string" ? variant.trim().toLowerCase() : "";

  if (!normalizedItemId || !ITEM_MEDIA_VARIANTS.includes(normalizedVariant)) {
    return "";
  }

  return `${normalizedItemId}:${normalizedVariant}`;
}

function normalizeItemMediaVariant(value) {
  const normalizedVariant = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ITEM_MEDIA_VARIANTS.includes(normalizedVariant) ? normalizedVariant : "";
}

function normalizeItemMediaAssetRecord(record) {
  const itemId = typeof record?.itemId === "string" ? record.itemId.trim() : "";
  const variant = normalizeItemMediaVariant(record?.variant);
  const key = createItemMediaKey(itemId, variant);

  if (!key) {
    throw new Error("Item media asset record is invalid.");
  }

  return {
    key,
    itemId,
    variant,
    asset: createImageAsset(record?.asset)
  };
}

function buildItemMediaAssetRecord(itemId, variant, asset) {
  return normalizeItemMediaAssetRecord({
    itemId,
    variant,
    asset
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getIndexedDb() {
  const indexedDb = indexedDbFactory();

  if (!indexedDb) {
    throw new Error("IndexedDB is not available in this environment.");
  }

  return indexedDb;
}

function openDatabaseByName(name) {
  return new Promise((resolve, reject) => {
    const request = getIndexedDb().open(name, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        db.createObjectStore(ITEM_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(APP_STORE)) {
        db.createObjectStore(APP_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(ITEM_MEDIA_STORE)) {
        db.createObjectStore(ITEM_MEDIA_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(ORIGINAL_STORE)) {
        db.createObjectStore(ORIGINAL_STORE, { keyPath: "itemUuid" });
      }

      if (!db.objectStoreNames.contains(SYNC_STATE_STORE)) {
        db.createObjectStore(SYNC_STATE_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(SYNC_METADATA_STORE)) {
        db.createObjectStore(SYNC_METADATA_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(METADATA_SNAPSHOT_STORE)) {
        db.createObjectStore(METADATA_SNAPSHOT_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(ORIGINAL_RECOVERY_STORE)) {
        db.createObjectStore(ORIGINAL_RECOVERY_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function hasObjectStore(database, storeName) {
  return Boolean(database?.objectStoreNames?.contains?.(storeName));
}

function getObjectStoreNames(database) {
  if (database?.objectStoreNames && typeof database.objectStoreNames[Symbol.iterator] === "function") {
    return Array.from(database.objectStoreNames);
  }

  if (database?.stores instanceof Map) {
    return [...database.stores.keys()];
  }

  return [];
}

function isMissingObjectStoreError(error) {
  const errorName = typeof error?.name === "string" ? error.name : "";
  const message = typeof error?.message === "string" ? error.message : "";

  return errorName === "NotFoundError" || message.includes("object stores was not found") || message.includes("Missing object store:");
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readAllStoreRecords(database, storeNames) {
  const transaction = database.transaction(storeNames, "readonly");
  const transactionDone = transactionToPromise(transaction);
  const stores = Object.fromEntries(storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]));
  const recordsByStore = await Promise.all(
    storeNames.map(async (storeName) => [storeName, await requestToPromise(stores[storeName].getAll())])
  );
  await transactionDone;
  return Object.fromEntries(recordsByStore);
}

function hasAnyMigratableData(recordsByStore) {
  return MIGRATED_STORES.some((storeName) => Array.isArray(recordsByStore[storeName]) && recordsByStore[storeName].length > 0);
}

async function copyStoreRecords(database, recordsByStore) {
  const transaction = database.transaction(MIGRATED_STORES, "readwrite");
  const transactionDone = transactionToPromise(transaction);
  const stores = Object.fromEntries(MIGRATED_STORES.map((storeName) => [storeName, transaction.objectStore(storeName)]));

  MIGRATED_STORES.forEach((storeName) => {
    (recordsByStore[storeName] ?? []).forEach((record) => stores[storeName].put(record));
  });

  await transactionDone;
}

async function migrateLegacyDataIfNeeded() {
  const currentDatabase = await openDatabaseByName(INDEXED_DB_NAME);

  try {
    const currentRecords = await readAllStoreRecords(currentDatabase, MIGRATED_STORES);

    if (hasAnyMigratableData(currentRecords)) {
      return;
    }

    const legacyDatabase = await openDatabaseByName(LEGACY_INDEXED_DB_NAME);

    try {
      const legacyRecords = await readAllStoreRecords(legacyDatabase, MIGRATED_STORES);

      if (!hasAnyMigratableData(legacyRecords)) {
        return;
      }

      await copyStoreRecords(currentDatabase, legacyRecords);
    } finally {
      legacyDatabase.close();
    }
  } finally {
    currentDatabase.close();
  }
}

async function ensureDatabaseReady() {
  if (!databaseReadyPromise) {
    databaseReadyPromise = migrateLegacyDataIfNeeded().catch((error) => {
      databaseReadyPromise = null;
      throw error;
    });
  }

  await databaseReadyPromise;
}

async function openDatabase() {
  await ensureDatabaseReady();
  return openDatabaseByName(INDEXED_DB_NAME);
}

async function openDatabaseWithoutMigration() {
  return openDatabaseByName(INDEXED_DB_NAME);
}

export async function loadIndexedDbDebugInfo() {
  const db = await openDatabase();

  try {
    return {
      name: INDEXED_DB_NAME,
      version: db.version,
      stores: getObjectStoreNames(db)
    };
  } finally {
    db.close();
  }
}

async function withStore(storeName, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let resultPromise;

    try {
      const result = run(store);
      const isIdbRequest = typeof IDBRequest !== "undefined" && result instanceof IDBRequest;
      resultPromise = isIdbRequest ? requestToPromise(result) : Promise.resolve(result);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resultPromise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          db.close();
        });
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

async function withStoreWithoutMigration(storeName, mode, run) {
  const db = await openDatabaseWithoutMigration();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let resultPromise;

    try {
      const result = run(store);
      const isIdbRequest = typeof IDBRequest !== "undefined" && result instanceof IDBRequest;
      resultPromise = isIdbRequest ? requestToPromise(result) : Promise.resolve(result);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resultPromise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          db.close();
        });
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

async function withOptionalStore(storeName, mode, onMissing, run) {
  const db = await openDatabase();

  try {
    if (!hasObjectStore(db, storeName)) {
      return onMissing?.();
    }

    return await new Promise((resolve, reject) => {
      let transaction;

      try {
        transaction = db.transaction(storeName, mode);
      } catch (error) {
        if (isMissingObjectStoreError(error)) {
          resolve(onMissing?.());
          return;
        }

        reject(error);
        return;
      }

      const store = transaction.objectStore(storeName);

      let resultPromise;

      try {
        const result = run(store);
        const isIdbRequest = typeof IDBRequest !== "undefined" && result instanceof IDBRequest;
        resultPromise = isIdbRequest ? requestToPromise(result) : Promise.resolve(result);
      } catch (error) {
        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        resultPromise.then(resolve).catch(reject);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } finally {
    db.close();
  }
}

async function withStores(storeNames, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]));
    let resultPromise;

    try {
      resultPromise = Promise.resolve(run(stores));
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resultPromise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          db.close();
        });
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

function normalizeMetadataOnlyText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMetadataOnlyNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function normalizeMetadataOnlyTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 0;
    }

    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return Math.round(numericValue);
    }

    const parsedDate = Date.parse(trimmedValue);
    return Number.isFinite(parsedDate) ? parsedDate : 0;
  }

  return 0;
}

function normalizeMetadataOnlyTags(value) {
  return Array.isArray(value)
    ? value.map((tag) => normalizeMetadataOnlyText(tag)).filter(Boolean)
    : [];
}

function normalizeMetadataOnlyFilenameAliases(value) {
  const seen = new Set();

  return (Array.isArray(value) ? value : [])
    .map((alias) => normalizeMetadataOnlyText(alias))
    .filter((alias) => {
      if (!alias) {
        return false;
      }

      const aliasKey = alias.toLowerCase();

      if (seen.has(aliasKey)) {
        return false;
      }

      seen.add(aliasKey);
      return true;
    });
}

function createMetadataOnlyItem(record, excludedById = {}) {
  const strippedRecord = stripItemMediaPayloads(record);
  const id = normalizeMetadataOnlyText(strippedRecord?.id);

  return {
    ...strippedRecord,
    id,
    name: normalizeMetadataOnlyText(strippedRecord?.name || strippedRecord?.title),
    tags: normalizeMetadataOnlyTags(strippedRecord?.tags),
    favorite: Boolean(strippedRecord?.favorite),
    excluded: Boolean(id && excludedById[id]),
    sourceFilenameAliases: normalizeMetadataOnlyFilenameAliases(strippedRecord?.sourceFilenameAliases),
    originalFilename: normalizeMetadataOnlyText(strippedRecord?.originalFilename),
    importedAt: normalizeMetadataOnlyTimestamp(strippedRecord?.importedAt),
    createdAt: normalizeMetadataOnlyTimestamp(strippedRecord?.createdAt),
    updatedAt: normalizeMetadataOnlyTimestamp(strippedRecord?.updatedAt),
    fileSize: normalizeMetadataOnlyNumber(strippedRecord?.fileSize),
    mimeType: normalizeMetadataOnlyText(strippedRecord?.mimeType),
    imageWidth: normalizeMetadataOnlyNumber(strippedRecord?.imageWidth),
    imageHeight: normalizeMetadataOnlyNumber(strippedRecord?.imageHeight)
  };
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

function isEmbeddedImageDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

async function convertImageAssetToBlob(asset) {
  if (!isEmbeddedImageDataUrl(asset?.src)) {
    return null;
  }

  const [header, payload = ""] = asset.src.split(",", 2);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? asset?.mimeType ?? "application/octet-stream";
  const binary =
    typeof Buffer !== "undefined"
      ? Buffer.from(payload, "base64")
      : Uint8Array.from(globalThis.atob(payload), (character) => character.charCodeAt(0));

  return new Blob([binary], { type: mimeType });
}

async function readMetadataOnlyItemBatch(startAfterKey = undefined, batchSize = 50, excludedById = {}) {
  const db = await openDatabaseWithoutMigration();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ITEM_STORE, "readonly");
    const store = transaction.objectStore(ITEM_STORE);

    if (typeof store.openCursor !== "function") {
      requestToPromise(store.getAll())
        .then((records) => {
          const normalizedRecords = Array.isArray(records) ? records : [];
          const startIndex = startAfterKey === undefined
            ? 0
            : normalizedRecords.findIndex((record) => record?.id === startAfterKey) + 1;
          const batchRecords = normalizedRecords.slice(Math.max(0, startIndex), Math.max(0, startIndex) + batchSize);
          const items = batchRecords.map((record) => createMetadataOnlyItem(record, excludedById)).filter((item) => item.id);
          const lastRecord = batchRecords.at(-1);

          resolve({
            items,
            lastKey: lastRecord?.id ?? startAfterKey,
            hasMore: startIndex + batchSize < normalizedRecords.length
          });
        })
        .catch(reject)
        .finally(() => {
          db.close();
        });
      return;
    }

    const keyRange =
      startAfterKey === undefined ? undefined : IDBKeyRange.lowerBound(startAfterKey, true);
    const request = store.openCursor(keyRange);
    const items = [];
    let lastKey = startAfterKey;

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve({
          items,
          lastKey,
          hasMore: false
        });
        db.close();
        return;
      }

      lastKey = cursor.primaryKey;
      const item = createMetadataOnlyItem(cursor.value, excludedById);

      if (item.id) {
        items.push(item);
      }

      if (items.length >= batchSize) {
        resolve({
          items,
          lastKey,
          hasMore: true
        });
        db.close();
        return;
      }

      cursor.continue();
    };

    request.onerror = () => {
      reject(request.error);
      db.close();
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

async function loadMetadataOnlyItems({
  batchSize = 50,
  excludedById = {},
  onBatch = null
} = {}) {
  const normalizedBatchSize = Math.max(1, Math.round(Number(batchSize) || 50));
  const items = [];
  let lastKey;
  let hasMore = true;

  while (hasMore) {
    const batchResult = await readMetadataOnlyItemBatch(lastKey, normalizedBatchSize, excludedById);
    const batchItems = batchResult.items;

    items.push(...batchItems);
    lastKey = batchResult.lastKey;
    hasMore = batchResult.hasMore;

    if (batchItems.length) {
      await Promise.resolve(
        onBatch?.({
          items: batchItems,
          loaded: items.length,
          hasMore
        })
      );
    }

    if (hasMore) {
      await yieldToBrowser();
    }
  }

  return items;
}

export async function loadStartupItemMetadata(options = {}) {
  return loadMetadataOnlyItems(options);
}

export async function loadSafeModeItemMetadata(options = {}) {
  return loadMetadataOnlyItems(options);
}

export async function loadStartupAppState() {
  const entry = await withStoreWithoutMigration(APP_STORE, "readonly", (store) => store.get("state"));
  return entry?.value ?? null;
}

export async function loadSafeModeAppState() {
  return loadStartupAppState();
}

export async function saveSafeModeAppState(value) {
  await withStoreWithoutMigration(APP_STORE, "readwrite", (store) =>
    store.put({
      key: "state",
      value
    })
  );
}

export async function deleteSafeModeItems(ids = []) {
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];

  if (!normalizedIds.length) {
    return;
  }

  await withStoreWithoutMigration(ITEM_STORE, "readwrite", (store) => {
    normalizedIds.forEach((id) => store.delete(id));
  });
}

async function loadStoredItemMediaAsset(itemId, variant) {
  const key = createItemMediaKey(itemId, variant);

  if (!key) {
    return null;
  }

  const entry = await withStoreWithoutMigration(ITEM_MEDIA_STORE, "readonly", (store) => store.get(key));
  return entry ? normalizeItemMediaAssetRecord(entry).asset : null;
}

async function saveStoredItemMediaAsset(itemId, variant, asset) {
  const record = buildItemMediaAssetRecord(itemId, variant, asset);
  await withStore(ITEM_MEDIA_STORE, "readwrite", (store) => store.put(record));
  return record.asset;
}

async function deleteStoredItemMediaAsset(itemId, variant) {
  const key = createItemMediaKey(itemId, variant);

  if (!key) {
    return;
  }

  await withStore(ITEM_MEDIA_STORE, "readwrite", (store) => store.delete(key));
}

async function deleteStoredItemMediaAssets(itemId) {
  await Promise.all(ITEM_MEDIA_VARIANTS.map((variant) => deleteStoredItemMediaAsset(itemId, variant)));
}

function buildDeletedItemBatchPlan(items = [], ids = []) {
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => normalizeSyncText(id)).filter(Boolean))];
  const normalizedIdSet = new Set(normalizedIds);
  const deletedItems = [];
  const remainingStableKeys = new Set();
  const deletedStableKeyToItems = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const itemId = normalizeSyncText(item?.id);

    if (!itemId) {
      return;
    }

    const stableKey = normalizeSyncText(item?.itemUuid);

    if (normalizedIdSet.has(itemId)) {
      deletedItems.push(item);

      if (stableKey) {
        const matchingItems = deletedStableKeyToItems.get(stableKey) ?? [];
        matchingItems.push(item);
        deletedStableKeyToItems.set(stableKey, matchingItems);
      }

      return;
    }

    if (stableKey) {
      remainingStableKeys.add(stableKey);
    }
  });

  const itemIdsToDeleteMedia = deletedItems
    .filter((item) => {
      const stableKey = normalizeSyncText(item?.itemUuid);
      return !stableKey || !remainingStableKeys.has(stableKey);
    })
    .map((item) => normalizeSyncText(item?.id))
    .filter(Boolean);
  const originalImageBlobUuidsToDelete = [...deletedStableKeyToItems.keys()].filter(
    (stableKey) => !remainingStableKeys.has(stableKey)
  );
  const stableKeysToTombstone = originalImageBlobUuidsToDelete;

  return {
    normalizedIds,
    deletedItems,
    itemIdsToDeleteMedia,
    originalImageBlobUuidsToDelete,
    stableKeysToTombstone
  };
}

async function copyStoredItemMediaAssets(sourceItemId, targetItemId) {
  const normalizedSourceItemId = typeof sourceItemId === "string" ? sourceItemId.trim() : "";
  const normalizedTargetItemId = typeof targetItemId === "string" ? targetItemId.trim() : "";

  if (!normalizedSourceItemId || !normalizedTargetItemId || normalizedSourceItemId === normalizedTargetItemId) {
    return;
  }

  const assets = await Promise.all(
    ITEM_MEDIA_VARIANTS.map(async (variant) => [variant, await loadStoredItemMediaAsset(normalizedSourceItemId, variant)])
  );

  await Promise.all(
    assets
      .filter(([, asset]) => asset?.src || asset?.blob instanceof Blob)
      .map(([variant, asset]) => saveStoredItemMediaAsset(normalizedTargetItemId, variant, asset))
  );
}

async function findStoredItemByItemUuid(itemUuid, excludedId = "") {
  const normalizedItemUuid = normalizeSyncText(itemUuid);

  if (!normalizedItemUuid) {
    return null;
  }

  const items = await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.getAll());

  return (Array.isArray(items) ? items : []).find(
    (item) => normalizeSyncText(item?.id) !== normalizeSyncText(excludedId) && normalizeSyncText(item?.itemUuid) === normalizedItemUuid
  ) ?? null;
}

async function materializeStoredItemMedia(item) {
  if (!item || typeof item !== "object") {
    return item;
  }

  const normalizedImages = normalizeItemImages(item);
  const [previewAsset, thumbnailAsset] = await Promise.all([
    normalizedImages.preview?.src ? normalizedImages.preview : loadStoredItemMediaAsset(item.id, "preview"),
    normalizedImages.thumbnail?.src ? normalizedImages.thumbnail : loadStoredItemMediaAsset(item.id, "thumbnail")
  ]);
  const originalAsset = normalizedImages.original?.src
    ? normalizedImages.original
    : normalizedImages.originalPreserved && item.itemUuid
      ? await loadOriginalImageBlobEntry(item.itemUuid).then((entry) =>
          entry?.blob instanceof Blob
            ? createImageAsset({
                src: "",
                mimeType: entry.mimeType,
                width: entry.width,
                height: entry.height,
                fileSize: entry.fileSize,
                originalFilename: entry.originalFilename
              })
            : normalizedImages.original
        )
      : normalizedImages.original;

  return applyPreviewImageFields(
    {
      ...item,
      images: {
        original: originalAsset,
        preview: createImageAsset(previewAsset),
        thumbnail: createImageAsset(thumbnailAsset)
      },
      originalPreserved: normalizedImages.originalPreserved
    },
    previewAsset
  );
}

export async function loadItemMediaAssetById(itemId, variant = "preview") {
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";

  if (!normalizedItemId) {
    return null;
  }

  const item = await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.get(normalizedItemId));

  if (!item || typeof item !== "object") {
    return null;
  }

  const normalizedImages = normalizeItemImages(item);
  const normalizedVariant = variant === "original" ? "original" : variant === "thumbnail" ? "thumbnail" : "preview";
  const selectedAsset =
    normalizedVariant === "original"
      ? normalizedImages.original
      : normalizedVariant === "thumbnail"
        ? normalizedImages.thumbnail
        : normalizedImages.preview;

  if (selectedAsset?.src) {
    return {
      ...createImageAsset(selectedAsset),
      blob: null
    };
  }

  if (normalizedVariant === "preview" || normalizedVariant === "thumbnail") {
    const storedAsset = await loadStoredItemMediaAsset(normalizedItemId, normalizedVariant);

    if (storedAsset?.src) {
      return {
        ...storedAsset,
        blob: null
      };
    }

    if (storedAsset?.blob instanceof Blob) {
      return {
        ...storedAsset,
        src: "",
        blob: storedAsset.blob
      };
    }
  }

  if (normalizedVariant === "original" && normalizedImages.originalPreserved && item.itemUuid) {
    const blobEntry = await loadOriginalImageBlobEntry(item.itemUuid);

    if (blobEntry?.blob instanceof Blob) {
      return {
        src: "",
        mimeType: blobEntry.mimeType ?? "",
        width: Math.max(0, Math.round(Number(blobEntry.width) || 0)),
        height: Math.max(0, Math.round(Number(blobEntry.height) || 0)),
        fileSize: Math.max(0, Math.round(Number(blobEntry.fileSize) || 0)),
        originalFilename: typeof blobEntry.originalFilename === "string" ? blobEntry.originalFilename.trim() : "",
        blob: blobEntry.blob
      };
    }
  }

  if (normalizedVariant === "original" || normalizedVariant === "thumbnail") {
    const fallbackAsset = await loadItemMediaAssetById(normalizedItemId, "preview");
    return fallbackAsset ? { ...fallbackAsset, blob: fallbackAsset.blob ?? null } : null;
  }

  return null;
}

export async function loadItemById(itemId, options = {}) {
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";

  if (!normalizedItemId) {
    return null;
  }

  const item = await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.get(normalizedItemId));

  if (!item || typeof item !== "object") {
    return null;
  }

  const migratedItem = migrateReferenceMetadataToTags(item);

  if (options.includeMediaPayloads) {
    return materializeStoredItemMedia(migratedItem);
  }

  return stripItemInlineMediaFields(migratedItem);
}

export async function loadMediaIntegritySnapshot() {
  return withStores([ITEM_STORE, ITEM_MEDIA_STORE, ORIGINAL_STORE], "readonly", async ({ items, itemMediaAssets, originalImageBlobs }) => {
    const [itemRecords, itemMediaRecords, originalBlobRecords] = await Promise.all([
      requestToPromise(items.getAll()),
      requestToPromise(itemMediaAssets.getAll()),
      requestToPromise(originalImageBlobs.getAll())
    ]);

    return {
      items: Array.isArray(itemRecords) ? itemRecords : [],
      itemMediaAssets: Array.isArray(itemMediaRecords) ? itemMediaRecords : [],
      originalImageBlobs: Array.isArray(originalBlobRecords) ? originalBlobRecords : []
    };
  });
}

export async function loadItems(options = {}) {
  const items = await withStore(ITEM_STORE, "readonly", (store) => store.getAll());

  if (items.length > 0) {
    const migratedItems = items.map(migrateReferenceMetadataToTags);

    if (options.includeMediaPayloads) {
      return Promise.all(migratedItems.map((item) => materializeStoredItemMedia(item)));
    }

    return migratedItems.map((item) => stripItemInlineMediaFields(item));
  }

  await withStore(ITEM_STORE, "readwrite", (store) => {
    defaultWardrobe.map(migrateReferenceMetadataToTags).forEach((item) => store.put(item));
  });

  return defaultWardrobe.map(migrateReferenceMetadataToTags);
}

export async function saveItem(item) {
  const incomingItem = omitMediaUpdateIntent(item);
  const existingItem = typeof incomingItem?.id === "string" && incomingItem.id.trim()
    ? await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.get(incomingItem.id.trim()))
    : null;
  const matchingStoredItem = incomingItem?.itemUuid
    ? await findStoredItemByItemUuid(incomingItem.itemUuid, incomingItem.id)
    : null;
  const existingOwnerItem = existingItem ?? matchingStoredItem ?? null;
  const saveKind = classifyItemSave(existingOwnerItem, item);
  const mergedItem = mergeItemImageState(existingOwnerItem, incomingItem);
  const normalizedMergedImages = normalizeItemImages(mergedItem);
  const storedItem = stripItemInlineMediaFields(mergedItem);
  const beforeSnapshot = await createSaveMediaDebugSnapshot(existingOwnerItem);

  console.log("[storage.saveItem] before", {
    saveKind,
    mediaUpdateIntent: normalizeMediaUpdateIntent(item?.mediaUpdateIntent),
    snapshot: beforeSnapshot
  });

  await withStore(ITEM_STORE, "readwrite", (store) => store.put(storedItem));

  const previewAsset = normalizedMergedImages.preview;
  const thumbnailAsset = normalizedMergedImages.thumbnail;

  if (saveKind === "metadataOnly") {
    const [storedPreviewAsset, storedThumbnailAsset, storedOriginalEntry] = await Promise.all([
      loadStoredItemMediaAsset(storedItem.id, "preview"),
      loadStoredItemMediaAsset(storedItem.id, "thumbnail"),
      storedItem.itemUuid ? loadOriginalImageBlobEntry(storedItem.itemUuid) : Promise.resolve(null)
    ]);

    if (!storedPreviewAsset && previewAsset?.src) {
      await saveStoredItemMediaAsset(storedItem.id, "preview", previewAsset);
    }

    if (!storedThumbnailAsset && thumbnailAsset?.src) {
      await saveStoredItemMediaAsset(storedItem.id, "thumbnail", thumbnailAsset);
    }

    if (!storedOriginalEntry && storedItem.originalPreserved && storedItem.itemUuid && normalizedMergedImages.original?.src) {
      const originalBlob = await convertImageAssetToBlob(normalizedMergedImages.original);

      if (originalBlob) {
        await saveOriginalImageBlob(storedItem.itemUuid, originalBlob, normalizedMergedImages.original);
      }
    }

    if (!existingItem && existingOwnerItem?.id && existingOwnerItem.id !== storedItem.id) {
      await copyStoredItemMediaAssets(existingOwnerItem.id, storedItem.id);
    }
  } else if (saveKind === "mediaRemove") {
    await deleteStoredItemMediaAssets(storedItem.id);

    if (storedItem.itemUuid && !await hasOtherStoredItemWithItemUuid(storedItem.itemUuid, [storedItem.id])) {
      await deleteOriginalImageBlob(storedItem.itemUuid);
    }
  } else {
    if (previewAsset?.src) {
      await saveStoredItemMediaAsset(storedItem.id, "preview", previewAsset);
    } else if (!existingOwnerItem) {
      await deleteStoredItemMediaAsset(storedItem.id, "preview");
    }

    if (thumbnailAsset?.src) {
      await saveStoredItemMediaAsset(storedItem.id, "thumbnail", thumbnailAsset);
    } else if (!existingOwnerItem) {
      await deleteStoredItemMediaAsset(storedItem.id, "thumbnail");
    }

    if (storedItem.originalPreserved && storedItem.itemUuid && normalizedMergedImages.original?.src) {
      const originalBlob = await convertImageAssetToBlob(normalizedMergedImages.original);

      if (originalBlob) {
        await saveOriginalImageBlob(storedItem.itemUuid, originalBlob, normalizedMergedImages.original);
      }
    }
  }

  const materializedMergedItem = await materializeStoredItemMedia(mergedItem);
  const afterSnapshot = await createSaveMediaDebugSnapshot(storedItem);

  console.log("[storage.saveItem] after", {
    saveKind,
    mediaUpdateIntent: normalizeMediaUpdateIntent(item?.mediaUpdateIntent),
    snapshot: afterSnapshot
  });

  await markReferenceSyncMetadataDirtyForItem(storedItem);

  return materializedMergedItem;
}

export async function markItemOriginalRecovered(itemOrId, recoveryItem = {}) {
  const existingItem = itemOrId && typeof itemOrId === "object"
    ? itemOrId
    : await loadItemById(itemOrId);

  if (!existingItem?.id) {
    throw new Error("Reference could not be found.");
  }

  const normalizedExistingImages = normalizeItemImages(existingItem);
  const incomingImages = normalizeItemImages(recoveryItem);
  const nextItem = {
    ...existingItem,
    originalPreserved: true,
    relinkStatus: typeof recoveryItem?.relinkStatus === "string" && recoveryItem.relinkStatus.trim()
      ? recoveryItem.relinkStatus.trim()
      : "linked",
    originalLinkedAt: normalizeSyncText(recoveryItem?.originalLinkedAt),
    originalRelinkedFrom: normalizeSyncText(recoveryItem?.originalRelinkedFrom),
    originalRelinkedFilename: normalizeSyncText(recoveryItem?.originalRelinkedFilename),
    updatedAt: normalizeSyncText(recoveryItem?.updatedAt) || normalizeSyncText(existingItem?.updatedAt),
    knownOriginalRelativePath:
      normalizeKnownOriginalRelativePath(recoveryItem?.knownOriginalRelativePath)
      || normalizeKnownOriginalRelativePath(existingItem?.knownOriginalRelativePath),
    sourceFilenameAliases: Array.isArray(recoveryItem?.sourceFilenameAliases)
      ? recoveryItem.sourceFilenameAliases
      : Array.isArray(existingItem?.sourceFilenameAliases)
        ? existingItem.sourceFilenameAliases
        : [],
    sourceOriginalFilename: normalizeSyncText(existingItem?.sourceOriginalFilename) || normalizeSyncText(recoveryItem?.sourceOriginalFilename),
    images: {
      ...(existingItem?.images && typeof existingItem.images === "object" && !Array.isArray(existingItem.images)
        ? existingItem.images
        : {}),
      preview: normalizedExistingImages.preview,
      thumbnail: normalizedExistingImages.thumbnail,
      original: incomingImages.original
    }
  };
  const storedItem = stripItemInlineMediaFields(nextItem);

  await withStore(ITEM_STORE, "readwrite", (store) => store.put(storedItem));
  await markReferenceSyncMetadataDirtyForItem(storedItem);

  return {
    ...nextItem,
    images: {
      ...(nextItem?.images && typeof nextItem.images === "object" && !Array.isArray(nextItem.images) ? nextItem.images : {}),
      preview: normalizedExistingImages.preview,
      thumbnail: normalizedExistingImages.thumbnail,
      original: {
        ...incomingImages.original,
        src: ""
      }
    }
  };
}

export async function deleteItemsByIds(ids) {
  const allItems = await withStoreWithoutMigration(ITEM_STORE, "readonly", (store) => store.getAll());
  const {
    normalizedIds,
    deletedItems,
    itemIdsToDeleteMedia,
    originalImageBlobUuidsToDelete,
    stableKeysToTombstone
  } = buildDeletedItemBatchPlan(allItems, ids);

  if (!normalizedIds.length) {
    return;
  }

  await withStore(ITEM_STORE, "readwrite", (store) => {
    normalizedIds.forEach((id) => {
      store.delete(id);
    });
  });

  if (itemIdsToDeleteMedia.length || originalImageBlobUuidsToDelete.length) {
    await withStores([ITEM_MEDIA_STORE, ORIGINAL_STORE], "readwrite", ({ itemMediaAssets, originalImageBlobs }) => {
      itemIdsToDeleteMedia.forEach((itemId) => {
        ITEM_MEDIA_VARIANTS.forEach((variant) => {
          const mediaKey = createItemMediaKey(itemId, variant);

          if (mediaKey) {
            itemMediaAssets.delete(mediaKey);
          }
        });
      });

      originalImageBlobUuidsToDelete.forEach((itemUuid) => {
        originalImageBlobs.delete(itemUuid);
      });
    });
  }

  if (!stableKeysToTombstone.length) {
    return;
  }

  const tombstoneLocalIdsByStableKey = deletedItems.reduce((lookup, item) => {
    const stableKey = normalizeSyncText(item?.itemUuid);

    if (stableKey && !lookup[stableKey]) {
      lookup[stableKey] = normalizeSyncText(item?.id);
    }

    return lookup;
  }, {});
  const metadataKeys = stableKeysToTombstone.map((stableKey) => createReferenceSyncMetadataKey(stableKey));
  const existingMetadataEntries = await withStore(SYNC_METADATA_STORE, "readonly", (store) =>
    Promise.all(metadataKeys.map((metadataKey) => requestToPromise(store.get(metadataKey))))
  );
  const existingMetadataByStableKey = Object.fromEntries(
    stableKeysToTombstone.map((stableKey, index) => [stableKey, existingMetadataEntries[index] ?? null])
  );
  const deviceId = await getOrCreateDeviceId();

  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => {
    stableKeysToTombstone.forEach((stableKey) => {
      const metadataKey = createReferenceSyncMetadataKey(stableKey);
      const existingRecord = existingMetadataByStableKey[stableKey];

      store.put(
        createNextDirtySyncMetadataRecord({
          key: metadataKey,
          entityType: "mbaReference",
          stableKey,
          localId: normalizeSyncText(existingRecord?.localId) || tombstoneLocalIdsByStableKey[stableKey] || "",
          existingRecord,
          deviceId,
          pendingDelete: true
        })
      );
    });
  });
}

export async function deleteItems(ids) {
  return deleteItemsByIds(ids);
}

export async function deleteItem(id) {
  return deleteItemsByIds([id]);
}

export async function loadAppState() {
  const entry = await withStore(APP_STORE, "readonly", (store) => store.get("state"));
  return entry?.value ?? null;
}

export async function saveAppState(value, options = {}) {
  const sanitizedValue = sanitizePersistedAppState(value);
  const { serialized, approxBytes } = getApproxSerializedBytes(sanitizedValue);

  if (approxBytes > PERSISTED_APP_STATE_MAX_BYTES) {
    return false;
  }

  const hasPreviousAppStateOverride = Object.prototype.hasOwnProperty.call(options, "previousAppState");
  const previousAppState = hasPreviousAppStateOverride
    ? options.previousAppState
    : await loadAppState();
  const sanitizedPreviousAppState = sanitizePersistedAppState(
    previousAppState && typeof previousAppState === "object" && !Array.isArray(previousAppState)
      ? previousAppState
      : {}
  );

  if (serialized === JSON.stringify(sanitizedPreviousAppState)) {
    return true;
  }

  await withStore(APP_STORE, "readwrite", (store) =>
    store.put({
      key: "state",
      value: sanitizedValue
    })
  );

  const previousSavedBoardsByStableKey = createSavedBoardMetadataByStableKey(sanitizedPreviousAppState?.savedOutfits);
  const nextSavedBoardsByStableKey = createSavedBoardMetadataByStableKey(sanitizedValue?.savedOutfits);
  const affectedStableKeys = new Set([
    ...Object.keys(previousSavedBoardsByStableKey),
    ...Object.keys(nextSavedBoardsByStableKey)
  ]);

  if (!affectedStableKeys.size) {
    return true;
  }

  const deviceId = await getOrCreateDeviceId();
  const nextMetadataEntries = await Promise.all(
    [...affectedStableKeys].map(async (stableKey) => {
      const previousSavedBoard = previousSavedBoardsByStableKey[stableKey] ?? null;
      const nextSavedBoard = nextSavedBoardsByStableKey[stableKey] ?? null;

      if (previousSavedBoard && nextSavedBoard && !haveSavedBoardRecordsChanged(previousSavedBoard, nextSavedBoard)) {
        return null;
      }

      const metadataKey = createBoardSyncMetadataKey(stableKey);
      const existingRecord = await getSyncMetadata(metadataKey);

      if (nextSavedBoard) {
        return createNextDirtySyncMetadataRecord({
          key: metadataKey,
          entityType: "mbaBoard",
          stableKey,
          localId: normalizeSyncText(nextSavedBoard.id),
          existingRecord,
          deviceId,
          pendingDelete: false
        });
      }

      return createNextDirtySyncMetadataRecord({
        key: metadataKey,
        entityType: "mbaBoard",
        stableKey,
        localId: normalizeSyncText(previousSavedBoard?.id) || normalizeSyncText(existingRecord?.localId),
        existingRecord,
        deviceId,
        pendingDelete: true
      });
    })
  );

  await Promise.all(nextMetadataEntries.filter(Boolean).map((entry) => upsertSyncMetadata(entry)));
  return true;
}

export async function getOrCreateDeviceId() {
  const existingState = await withStore(SYNC_STATE_STORE, "readonly", (store) => store.get(SYNC_STATE_KEY));
  const normalizedExistingState = normalizeSyncState(existingState);

  if (normalizedExistingState.deviceId) {
    if (JSON.stringify(existingState) !== JSON.stringify(normalizedExistingState)) {
      await withStore(SYNC_STATE_STORE, "readwrite", (store) => store.put(normalizedExistingState));
    }

    return normalizedExistingState.deviceId;
  }

  const nextDeviceId = createDeviceId();
  const nextState = normalizeSyncState(existingState, nextDeviceId);
  await withStore(SYNC_STATE_STORE, "readwrite", (store) =>
    store.put(nextState)
  );
  return nextDeviceId;
}

export async function getSyncMetadata(key = null) {
  if (typeof key === "string") {
    const normalizedKey = normalizeSyncMetadataKey(key);

    if (!normalizedKey) {
      return null;
    }

    const entry = await withStore(SYNC_METADATA_STORE, "readonly", (store) => store.get(normalizedKey));
    return entry ? normalizeSyncMetadataRecord(entry) : null;
  }

  const entries = await withStore(SYNC_METADATA_STORE, "readonly", (store) => store.getAll());
  return entries.map((entry) => normalizeSyncMetadataRecord(entry));
}

export async function upsertSyncMetadata(record) {
  const normalizedRecord = normalizeSyncMetadataRecord(record);
  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.put(normalizedRecord));
  return normalizedRecord;
}

export async function clearSyncMetadata() {
  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.clear());
}

export async function backfillLocalSyncMetadata(items = [], savedOutfits = []) {
  const deviceId = await getOrCreateDeviceId();
  const itemList = Array.isArray(items) ? items : [];
  const savedOutfitList = Array.isArray(savedOutfits) ? savedOutfits : [];
  const existingKeys = new Set();

  await withStore(SYNC_METADATA_STORE, "readonly", async (store) => {
    if (typeof store.openCursor !== "function") {
      const entries = await requestToPromise(store.getAll());
      entries.forEach((entry) => {
        existingKeys.add(normalizeSyncMetadataKey(entry?.key));
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        existingKeys.add(normalizeSyncMetadataKey(cursor.primaryKey));
        cursor.continue();
      };
    });
  });

  const nextMetadataEntries = [];

  for (const item of itemList) {
    const key = createReferenceSyncMetadataKey(item?.itemUuid);

    if (!key || existingKeys.has(key)) {
      continue;
    }

    const nextEntry = buildReferenceSyncMetadata(item, deviceId, null);

    if (!nextEntry) {
      continue;
    }

    existingKeys.add(key);
    nextMetadataEntries.push(nextEntry);
  }

  for (const savedOutfit of savedOutfitList) {
    const boardUuid = normalizeSyncText(savedOutfit?.board?.boardUuid)
      || normalizeSyncText(ensureSavedBoardUuid(savedOutfit)?.board?.boardUuid);
    const key = createBoardSyncMetadataKey(boardUuid);

    if (!key || existingKeys.has(key)) {
      continue;
    }

    const nextEntry = buildSavedBoardSyncMetadata(savedOutfit, deviceId, null);

    if (!nextEntry) {
      continue;
    }

    existingKeys.add(key);
    nextMetadataEntries.push(nextEntry);
  }

  if (!nextMetadataEntries.length) {
    return {
      deviceId,
      createdCount: 0
    };
  }

  let createdCount = 0;

  for (let index = 0; index < nextMetadataEntries.length; index += SYNC_BACKFILL_BATCH_SIZE) {
    const batch = nextMetadataEntries.slice(index, index + SYNC_BACKFILL_BATCH_SIZE);

    await withStore(SYNC_METADATA_STORE, "readwrite", (store) => {
      batch.forEach((entry) => store.put(entry));
    });

    createdCount += batch.length;

    if (index + SYNC_BACKFILL_BATCH_SIZE < nextMetadataEntries.length) {
      await yieldToBrowser();
    }
  }

  return {
    deviceId,
    createdCount
  };
}

function normalizeBackupAppState(appState) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    throw new Error("Backup app state is invalid.");
  }

  const sanitizedAppState = sanitizeBackupAppStateSnapshot(appState);
  const normalizedBoard = ensureBoardUuid(sanitizedAppState.board);

  return {
    ...sanitizedAppState,
    provenance: normalizeLibraryProvenance(sanitizedAppState.provenance),
    ...(normalizedBoard === undefined ? {} : { board: normalizedBoard }),
    savedOutfits: Array.isArray(sanitizedAppState.savedOutfits)
      ? sanitizedAppState.savedOutfits.map(ensureSavedBoardUuid)
      : sanitizedAppState.savedOutfits,
    recentOutfits: []
  };
}

function prepareBackupItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Backup items are invalid.");
  }

  const seenIds = new Set();

  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Backup item ${index + 1} is invalid.`);
    }

    if (typeof item.id !== "string" || !item.id.trim()) {
      throw new Error(`Backup item ${index + 1} is missing an id.`);
    }

    if (seenIds.has(item.id)) {
      throw new Error(`Backup item id "${item.id}" is duplicated.`);
    }

    seenIds.add(item.id);
    const migratedItem = migrateReferenceMetadataToTags(item);

    return {
      ...migratedItem,
      knownOriginalRelativePath: normalizeKnownOriginalRelativePath(migratedItem?.knownOriginalRelativePath)
    };
  });
}

export function createLightweightBackupData(items, appState) {
  return {
    source: BACKUP_SOURCE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: (Array.isArray(items) ? items : []).map((item) => sanitizeBackupReference(item)),
    appState: sanitizeBackupAppStateSnapshot(appState)
  };
}

export function createMetadataOnlyBackupData(items, appState) {
  return {
    ...buildMetadataStatePayload(items, appState),
    exportedAt: new Date().toISOString(),
  };
}

export function buildMetadataStateSnapshot(items, appState, options = {}) {
  const metadataPayload = buildMetadataStatePayload(items, appState);
  const changedItemIds = mergeChangedItemIds(options.changedItemIds);
  const normalizedReason = normalizeMetadataSnapshotReason(options.reason);

  return {
    ...metadataPayload,
    id:
      normalizeSnapshotText(options.id)
      || (typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `metadata_snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`),
    createdAt: normalizeSyncTimestamp(options.createdAt) || new Date().toISOString(),
    reason: normalizedReason,
    appVersion: normalizeSnapshotText(options.appVersion),
    appBuildTime: normalizeSnapshotText(options.appBuildTime),
    snapshotVersion: METADATA_SNAPSHOT_VERSION,
    itemCount: normalizeSnapshotCount(metadataPayload.items.length),
    boardCount: countSnapshotBoards(metadataPayload.appState),
    changedItemCount: normalizeSnapshotCount(
      Object.prototype.hasOwnProperty.call(options, "changedItemCount")
        ? options.changedItemCount
        : changedItemIds.length
    ),
    changedItemIds
  };
}

function normalizeMetadataSnapshotRecord(record = {}) {
  const metadataState = buildMetadataStateSnapshot(record.items, record.appState, record);

  return {
    ...metadataState,
    id: normalizeSnapshotText(record.id) || metadataState.id,
    createdAt: normalizeSyncTimestamp(record.createdAt) || metadataState.createdAt
  };
}

export function markMetadataChanged(localSafety, options = {}) {
  const changedItemIds = mergeChangedItemIds(
    normalizeLocalSafetyState(localSafety).changedItemIdsSinceSnapshot,
    options.changedItemIds
  );
  const changedItemIdsSinceFullBackup = mergeChangedItemIds(
    normalizeLocalSafetyState(localSafety).changedItemIdsSinceFullBackup,
    options.changedItemIds
  );

  return buildNextLocalSafetyState(localSafety, {
    metadataDirtySinceSnapshot: true,
    metadataDirtySinceFullBackup: true,
    changedItemIdsSinceSnapshot: changedItemIds,
    changedItemIdsSinceFullBackup
  });
}

export function markFullBackupExported(localSafety) {
  return buildNextLocalSafetyState(localSafety, {
    metadataDirtySinceFullBackup: false,
    changedItemIdsSinceFullBackup: []
  });
}

function markMetadataSnapshotSucceeded(localSafety, snapshot) {
  return buildNextLocalSafetyState(localSafety, {
    lastMetadataSnapshotAt: snapshot.createdAt,
    lastMetadataSnapshotReason: snapshot.reason,
    lastMetadataSnapshotError: "",
    metadataDirtySinceSnapshot: false,
    changedItemIdsSinceSnapshot: []
  });
}

function markMetadataSnapshotFailed(localSafety, error) {
  return buildNextLocalSafetyState(localSafety, {
    lastMetadataSnapshotError: buildMetadataSnapshotErrorMessage(error)
  });
}

function createOriginalRecoverySessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `original_recovery_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeOriginalRecoveryText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOriginalRecoveryCount(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.round(parsedValue) : 0;
}

function normalizeOriginalRecoveryTimestamp(value) {
  const trimmedValue = normalizeOriginalRecoveryText(value);

  if (!trimmedValue) {
    return "";
  }

  const parsedValue = Date.parse(trimmedValue);
  return Number.isFinite(parsedValue) ? new Date(parsedValue).toISOString() : "";
}

function normalizeOriginalRecoveryReasonList(value) {
  return (Array.isArray(value) ? value : [])
    .map((reason) => normalizeOriginalRecoveryText(reason))
    .filter(Boolean);
}

function normalizeOriginalRecoveryPathLookupSummary(value = {}) {
  return {
    checkedCount: normalizeOriginalRecoveryCount(value.checkedCount),
    readyCount: normalizeOriginalRecoveryCount(value.readyCount),
    missingCount: normalizeOriginalRecoveryCount(value.missingCount),
    conflictCount: normalizeOriginalRecoveryCount(value.conflictCount),
    fallbackItemCount: normalizeOriginalRecoveryCount(value.fallbackItemCount),
    fallbackMatchCount: normalizeOriginalRecoveryCount(value.fallbackMatchCount)
  };
}

function normalizeOriginalRecoveryDecision(value, fallback = "undecided") {
  const normalizedValue = normalizeOriginalRecoveryText(value);
  return ORIGINAL_RECOVERY_DECISIONS.includes(normalizedValue)
    ? normalizedValue
    : ORIGINAL_RECOVERY_DECISIONS.includes(fallback)
      ? fallback
      : "undecided";
}

function normalizeOriginalRecoveryMatchOutcome(value, fallback = "no_match") {
  const normalizedValue = normalizeOriginalRecoveryText(value);
  return ORIGINAL_RECOVERY_MATCH_OUTCOMES.includes(normalizedValue)
    ? normalizedValue
    : ORIGINAL_RECOVERY_MATCH_OUTCOMES.includes(fallback)
      ? fallback
      : "no_match";
}

function normalizeOriginalRecoveryApplyResult(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }

  const status = normalizeOriginalRecoveryText(record.status);

  if (!ORIGINAL_RECOVERY_APPLY_RESULTS.includes(status)) {
    return null;
  }

  return {
    status,
    message: normalizeOriginalRecoveryText(record.message),
    appliedAt: normalizeOriginalRecoveryTimestamp(record.appliedAt)
  };
}

function normalizeOriginalRecoveryMatchFlags(match = {}) {
  return {
    classification: normalizeOriginalRecoveryText(match.classification),
    filenameMatch: Boolean(match.filenameMatch),
    sizeMatch: Boolean(match.sizeMatch),
    dimensionMatch: Boolean(match.dimensionMatch),
    lastModifiedMatch: Boolean(match.lastModifiedMatch),
    mimeTypeMatch: Boolean(match.mimeTypeMatch),
    supportingMatches: normalizeOriginalRecoveryCount(match.supportingMatches)
  };
}

function normalizeOriginalRecoveryCandidateRecord(record = {}) {
  const id = normalizeOriginalRecoveryText(record.id);

  if (!id) {
    return null;
  }

  return {
    id,
    sourceLabel: normalizeOriginalRecoveryText(record.sourceLabel),
    relativePath: normalizeOriginalRecoveryText(record.relativePath),
    lookupStrategy: normalizeOriginalRecoveryText(record.lookupStrategy),
    fileName: normalizeOriginalRecoveryText(record.fileName),
    sourceFileSize: normalizeOriginalRecoveryCount(record.sourceFileSize),
    sourceImageWidth: normalizeOriginalRecoveryCount(record.sourceImageWidth),
    sourceImageHeight: normalizeOriginalRecoveryCount(record.sourceImageHeight),
    sourceLastModified: normalizeOriginalRecoveryCount(record.sourceLastModified),
    mimeType: normalizeOriginalRecoveryText(record.mimeType),
    fingerprint: normalizeOriginalRecoveryText(record.fingerprint),
    match: normalizeOriginalRecoveryMatchFlags(record.match),
    reasons: normalizeOriginalRecoveryReasonList(record.reasons)
  };
}

function normalizeOriginalRecoveryMatchRecord(record = {}) {
  const itemId = normalizeOriginalRecoveryText(record.itemId);

  if (!itemId) {
    return null;
  }

  return {
    itemId,
    itemUuid: normalizeOriginalRecoveryText(record.itemUuid),
    itemName: normalizeOriginalRecoveryText(record.itemName),
    outcome: normalizeOriginalRecoveryMatchOutcome(record.outcome, "excluded"),
    decision: normalizeOriginalRecoveryDecision(record.decision),
    exclusionReason: normalizeOriginalRecoveryText(record.exclusionReason),
    relinkStatus: normalizeOriginalRecoveryText(record.relinkStatus),
    selectedCandidateId: normalizeOriginalRecoveryText(record.selectedCandidateId),
    recoveryStrategy: normalizeOriginalRecoveryText(record.recoveryStrategy),
    sourceRelativePath: normalizeOriginalRecoveryText(record.sourceRelativePath),
    knownOriginalRelativePath: normalizeKnownOriginalRelativePath(record.knownOriginalRelativePath),
    sourceOriginalFilename: normalizeOriginalRecoveryText(record.sourceOriginalFilename),
    sourceFilenameAliases: normalizeReasonableStringArray(record.sourceFilenameAliases),
    sourceFileSize: normalizeOriginalRecoveryCount(record.sourceFileSize),
    sourceImageWidth: normalizeOriginalRecoveryCount(record.sourceImageWidth),
    sourceImageHeight: normalizeOriginalRecoveryCount(record.sourceImageHeight),
    sourceLastModified: normalizeOriginalRecoveryCount(record.sourceLastModified),
    mimeType: normalizeOriginalRecoveryText(record.mimeType),
    candidates: (Array.isArray(record.candidates) ? record.candidates : [])
      .map((candidate) => normalizeOriginalRecoveryCandidateRecord(candidate))
      .filter(Boolean),
    applyResult: normalizeOriginalRecoveryApplyResult(record.applyResult)
  };
}

function normalizeOriginalRecoverySummary(summary = {}) {
  return {
    itemCount: normalizeOriginalRecoveryCount(summary.itemCount),
    eligibleItemCount: normalizeOriginalRecoveryCount(summary.eligibleItemCount),
    excludedItemCount: normalizeOriginalRecoveryCount(summary.excludedItemCount),
    scannedFileCount: normalizeOriginalRecoveryCount(summary.scannedFileCount),
    approvedCount: normalizeOriginalRecoveryCount(summary.approvedCount),
    unresolvedCount: normalizeOriginalRecoveryCount(summary.unresolvedCount),
    recoveredCount: normalizeOriginalRecoveryCount(summary.recoveredCount),
    failedCount: normalizeOriginalRecoveryCount(summary.failedCount),
    needsRescanCount: normalizeOriginalRecoveryCount(summary.needsRescanCount),
    outcomeCounts: Object.fromEntries(
      Object.entries(summary.outcomeCounts && typeof summary.outcomeCounts === "object" ? summary.outcomeCounts : {}).map(
        ([key, value]) => [normalizeOriginalRecoveryText(key), normalizeOriginalRecoveryCount(value)]
      )
    ),
    decisionCounts: Object.fromEntries(
      Object.entries(summary.decisionCounts && typeof summary.decisionCounts === "object" ? summary.decisionCounts : {}).map(
        ([key, value]) => [normalizeOriginalRecoveryText(key), normalizeOriginalRecoveryCount(value)]
      )
    )
  };
}

function normalizeReasonableStringArray(value) {
  const seen = new Set();

  return (Array.isArray(value) ? value : [])
    .map((entry) => normalizeOriginalRecoveryText(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    });
}

function normalizeOriginalRecoverySessionRecord(record = {}) {
  const id = normalizeOriginalRecoveryText(record.id) || createOriginalRecoverySessionId();
  const now = new Date().toISOString();
  const createdAt = normalizeOriginalRecoveryTimestamp(record.createdAt) || normalizeOriginalRecoveryTimestamp(record.updatedAt) || now;
  const updatedAt = normalizeOriginalRecoveryTimestamp(record.updatedAt) || createdAt;
  const status = normalizeOriginalRecoveryText(record.status);

  return {
    id,
    app: normalizeOriginalRecoveryText(record.app),
    sourceLabel: normalizeOriginalRecoveryText(record.sourceLabel),
    createdAt,
    updatedAt,
    status: ORIGINAL_RECOVERY_SESSION_STATUSES.includes(status) ? status : "idle",
    summary: normalizeOriginalRecoverySummary(record.summary),
    pathLookup: normalizeOriginalRecoveryPathLookupSummary(record.pathLookup),
    matches: (Array.isArray(record.matches) ? record.matches : [])
      .map((match) => normalizeOriginalRecoveryMatchRecord(match))
      .filter(Boolean)
  };
}

export async function loadOriginalRecoverySessions(options = {}) {
  const limit = normalizeOriginalRecoveryCount(options.limit);
  const sessions = await withOptionalStore(
    ORIGINAL_RECOVERY_STORE,
    "readonly",
    () => [],
    (store) => store.getAll()
  );
  const normalizedSessions = (Array.isArray(sessions) ? sessions : [])
    .map((session) => normalizeOriginalRecoverySessionRecord(session))
    .sort((left, right) => {
      const timeDelta = Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0);

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return right.id.localeCompare(left.id);
    });

  return limit > 0 ? normalizedSessions.slice(0, limit) : normalizedSessions;
}

export async function loadLatestOriginalRecoverySession() {
  const [latestSession] = await loadOriginalRecoverySessions({ limit: 1 });
  return latestSession ?? null;
}

export async function loadOriginalRecoverySessionById(sessionId) {
  const normalizedSessionId = normalizeOriginalRecoveryText(sessionId);

  if (!normalizedSessionId) {
    return null;
  }

  const session = await withOptionalStore(
    ORIGINAL_RECOVERY_STORE,
    "readonly",
    () => null,
    (store) => store.get(normalizedSessionId)
  );

  return session ? normalizeOriginalRecoverySessionRecord(session) : null;
}

export async function saveOriginalRecoverySession(session) {
  const normalizedSession = normalizeOriginalRecoverySessionRecord(session);

  await withOptionalStore(
    ORIGINAL_RECOVERY_STORE,
    "readwrite",
    () => {
      console.warn("Original recovery store is unavailable; continuing without persisted recovery sessions.");
      return undefined;
    },
    (store) => store.put(normalizedSession)
  );

  return normalizedSession;
}

export async function clearOriginalRecoverySessions() {
  await withOptionalStore(ORIGINAL_RECOVERY_STORE, "readwrite", () => undefined, (store) => store.clear());
}

export async function pruneMetadataSnapshots(options = {}) {
  const retainCount = Math.max(1, normalizeSnapshotCount(options.retainCount) || METADATA_SNAPSHOT_RETENTION_COUNT);
  const snapshots = await loadMetadataSnapshots();

  if (snapshots.length <= retainCount) {
    return {
      deletedCount: 0
    };
  }

  const snapshotIdsToDelete = snapshots
    .slice(retainCount)
    .map((snapshot) => normalizeSnapshotText(snapshot.id))
    .filter(Boolean);

  await withStore(METADATA_SNAPSHOT_STORE, "readwrite", (store) => {
    snapshotIdsToDelete.forEach((snapshotId) => store.delete(snapshotId));
  });

  return {
    deletedCount: snapshotIdsToDelete.length
  };
}

export async function loadMetadataSnapshots(options = {}) {
  const limit = normalizeSnapshotCount(options.limit);
  const snapshots = await withOptionalStore(
    METADATA_SNAPSHOT_STORE,
    "readonly",
    () => {
      console.warn("Metadata snapshot store is unavailable; continuing without snapshot history.");
      return [];
    },
    (store) => store.getAll()
  );
  const normalizedSnapshots = (Array.isArray(snapshots) ? snapshots : [])
    .map((snapshot) => normalizeMetadataSnapshotRecord(snapshot))
    .sort((left, right) => {
      const timeDelta = Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0);

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return right.id.localeCompare(left.id);
    });

  return limit > 0 ? normalizedSnapshots.slice(0, limit) : normalizedSnapshots;
}

export async function loadLatestMetadataSnapshotInfo() {
  let latestSnapshot;

  try {
    [latestSnapshot] = await loadMetadataSnapshots({ limit: 1 });
  } catch (error) {
    if (!isMissingObjectStoreError(error)) {
      throw error;
    }

    console.warn("Metadata snapshot store is unavailable; returning empty snapshot status.", error);
    return null;
  }

  if (!latestSnapshot) {
    return null;
  }

  return {
    id: latestSnapshot.id,
    createdAt: latestSnapshot.createdAt,
    reason: latestSnapshot.reason,
    appVersion: latestSnapshot.appVersion,
    appBuildTime: latestSnapshot.appBuildTime,
    itemCount: latestSnapshot.itemCount,
    boardCount: latestSnapshot.boardCount,
    changedItemCount: latestSnapshot.changedItemCount
  };
}

export async function createMetadataSnapshot(options = {}) {
  const snapshot = normalizeMetadataSnapshotRecord(
    buildMetadataStateSnapshot(options.items, options.appState, options)
  );
  const currentLocalSafety = normalizeLocalSafetyState(options.appState?.localSafety);

  try {
    await withStore(METADATA_SNAPSHOT_STORE, "readwrite", (store) => store.put(snapshot));
    await pruneMetadataSnapshots({
      retainCount: options.retainCount
    });
    const nextLocalSafety = markMetadataSnapshotSucceeded(currentLocalSafety, snapshot);
    await persistSnapshotLocalSafety(options.appState, nextLocalSafety);

    return {
      snapshot,
      localSafety: nextLocalSafety
    };
  } catch (error) {
    const nextLocalSafety = markMetadataSnapshotFailed(currentLocalSafety, error);

    try {
      await persistSnapshotLocalSafety(options.appState, nextLocalSafety);
    } catch {}

    throw error;
  }
}

async function drainMetadataSnapshotQueue() {
  while (activeMetadataSnapshotRequest) {
    const request = activeMetadataSnapshotRequest;

    try {
      const result = await createMetadataSnapshot(request);
      (request.waiters ?? []).forEach(({ resolve }) => resolve(result));
    } catch (error) {
      (request.waiters ?? []).forEach(({ reject }) => reject(error));
    } finally {
      activeMetadataSnapshotRequest = null;
    }

    if (pendingMetadataSnapshotRequest) {
      activeMetadataSnapshotRequest = pendingMetadataSnapshotRequest;
      pendingMetadataSnapshotRequest = null;
    }
  }
}

export function requestMetadataSnapshot(options = {}) {
  const requestDescriptor = {
    ...options,
    reason: normalizeMetadataSnapshotReason(options.reason),
    changedItemIds: mergeChangedItemIds(options.changedItemIds),
    priority: options.priority === "blocking" ? "blocking" : "background"
  };

  return new Promise((resolve, reject) => {
    const nextRequest = {
      ...requestDescriptor,
      waiters: [{ resolve, reject }]
    };

    if (!activeMetadataSnapshotRequest) {
      activeMetadataSnapshotRequest = nextRequest;
      void drainMetadataSnapshotQueue();
      return;
    }

    pendingMetadataSnapshotRequest = mergeSnapshotRequestDescriptor(pendingMetadataSnapshotRequest, nextRequest);
  });
}

export function prepareBackupImport(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    throw new Error("Backup payload is invalid.");
  }

  if (!SUPPORTED_BACKUP_SOURCES.includes(backup.source)) {
    throw new Error("Backup source is invalid.");
  }

  if (!SUPPORTED_BACKUP_VERSIONS.includes(backup.version)) {
    throw new Error("Backup version is not supported.");
  }

  return {
    source: backup.source,
    version: backup.version,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "",
    items: prepareBackupItems(backup.items),
    appState: normalizeBackupAppState(backup.appState)
  };
}

function validatePreparedBackupForReplacement(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    throw new Error("Prepared backup payload is invalid.");
  }

  return {
    source: typeof backup.source === "string" ? backup.source : BACKUP_SOURCE,
    version: Number.isFinite(Number(backup.version)) ? Number(backup.version) : BACKUP_VERSION,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "",
    items: prepareBackupItems(backup.items),
    appState: normalizeBackupAppState(backup.appState)
  };
}

function validatePreparedBackupPackageForReplacement(preparedPackage) {
  if (!preparedPackage || typeof preparedPackage !== "object" || Array.isArray(preparedPackage)) {
    throw new Error("Prepared backup package payload is invalid.");
  }

  const validatedItemMediaAssets = Array.isArray(preparedPackage.itemMediaAssets)
    ? preparedPackage.itemMediaAssets.map((record, index) => {
        const normalizedRecord = normalizeItemMediaAssetRecord(record);

        if (normalizedRecord.variant !== "preview") {
          throw new Error(`Prepared backup package media asset ${index + 1} is invalid.`);
        }

        if (!(normalizedRecord.asset?.blob instanceof Blob)) {
          throw new Error(`Prepared backup package media asset ${index + 1} is missing preview data.`);
        }

        return normalizedRecord;
      })
    : (() => {
        throw new Error("Prepared backup package media assets are invalid.");
      })();

  return {
    source: typeof preparedPackage.source === "string" ? preparedPackage.source : BACKUP_SOURCE,
    version: Number.isFinite(Number(preparedPackage.version)) ? Number(preparedPackage.version) : BACKUP_VERSION,
    exportedAt: typeof preparedPackage.exportedAt === "string" ? preparedPackage.exportedAt : "",
    items: prepareBackupItems(preparedPackage.items),
    appState: normalizeBackupAppState(preparedPackage.appState),
    itemMediaAssets: validatedItemMediaAssets
  };
}

export async function exportBackup(options = {}) {
  const [items, appState] = await Promise.all([loadItems({ includeMediaPayloads: true }), loadAppState()]);
  return options.mode === "metadata"
    ? createMetadataOnlyBackupData(items, appState)
    : createLightweightBackupData(items, appState);
}

export async function replaceWithPreparedBackup(backup) {
  const validatedBackup = validatePreparedBackupForReplacement(backup);

  await withStores(
    [ITEM_STORE, APP_STORE, ITEM_MEDIA_STORE, ORIGINAL_STORE, SYNC_METADATA_STORE, ORIGINAL_RECOVERY_STORE],
    "readwrite",
    ({ items, appState, itemMediaAssets, originalImageBlobs, syncMetadata, originalRecoverySessions }) => {
    items.clear();
    appState.clear();
    itemMediaAssets.clear();
    originalImageBlobs.clear();
    syncMetadata.clear();
    originalRecoverySessions.clear();

    validatedBackup.items.forEach((item) => items.put(item));
    appState.put({
      key: "state",
      value: validatedBackup.appState
    });
    }
  );

  await backfillLocalSyncMetadata(validatedBackup.items, validatedBackup.appState?.savedOutfits ?? []);
}

export async function replaceWithPreparedBackupPackage(preparedPackage) {
  const validatedPackage = validatePreparedBackupPackageForReplacement(preparedPackage);

  await withStores(
    [ITEM_STORE, APP_STORE, ITEM_MEDIA_STORE, ORIGINAL_STORE, SYNC_METADATA_STORE, ORIGINAL_RECOVERY_STORE],
    "readwrite",
    ({ items, appState, itemMediaAssets, originalImageBlobs, syncMetadata, originalRecoverySessions }) => {
      items.clear();
      appState.clear();
      itemMediaAssets.clear();
      originalImageBlobs.clear();
      syncMetadata.clear();
      originalRecoverySessions.clear();

      validatedPackage.items.forEach((item) => items.put(item));
      validatedPackage.itemMediaAssets.forEach((assetRecord) => itemMediaAssets.put(assetRecord));
      appState.put({
        key: "state",
        value: validatedPackage.appState
      });
    }
  );

  await backfillLocalSyncMetadata(validatedPackage.items, validatedPackage.appState?.savedOutfits ?? []);
}

export async function replaceWithBackup(backup) {
  return replaceWithPreparedBackup(prepareBackupImport(backup));
}

export async function saveOriginalImageBlob(itemUuid, blob, metadata = {}) {
  if (typeof itemUuid !== "string" || !itemUuid.trim()) {
    throw new Error("Original image blob is missing an itemUuid.");
  }

  if (!(blob instanceof Blob)) {
    throw new Error("Original image blob is invalid.");
  }

  const entry = {
    itemUuid: itemUuid.trim(),
    blob,
    mimeType: typeof metadata.mimeType === "string" ? metadata.mimeType.trim() : "",
    width: Math.max(0, Math.round(Number(metadata.width) || 0)),
    height: Math.max(0, Math.round(Number(metadata.height) || 0)),
    fileSize: Math.max(0, Math.round(Number(metadata.fileSize) || blob.size || 0)),
    originalFilename: typeof metadata.originalFilename === "string" ? metadata.originalFilename.trim() : "",
    savedAt: Date.now()
  };

  await withStore(ORIGINAL_STORE, "readwrite", (store) => store.put(entry));
  return entry;
}

export async function loadOriginalImageBlobEntry(itemUuid) {
  if (typeof itemUuid !== "string" || !itemUuid.trim()) {
    return null;
  }

  return withStore(ORIGINAL_STORE, "readonly", (store) => store.get(itemUuid.trim()));
}

export async function loadOriginalImageBlob(itemUuid) {
  const entry = await loadOriginalImageBlobEntry(itemUuid);
  return entry?.blob ?? null;
}

export async function hasOriginalImageBlob(itemUuid) {
  return Boolean(await loadOriginalImageBlob(itemUuid));
}

export async function deleteOriginalImageBlob(itemUuid) {
  if (typeof itemUuid !== "string" || !itemUuid.trim()) {
    return;
  }

  await withStore(ORIGINAL_STORE, "readwrite", (store) => store.delete(itemUuid.trim()));
}

export async function loadOriginalImageBlobUrl(itemUuid) {
  const blob = await loadOriginalImageBlob(itemUuid);

  if (!blob || typeof URL?.createObjectURL !== "function") {
    return "";
  }

  return URL.createObjectURL(blob);
}

export function getDefaultData() {
  return {
    items: cloneData(defaultWardrobe).map(migrateReferenceMetadataToTags),
    appState: cloneData(defaultAppState)
  };
}

export async function resetToDefaults() {
  const defaultData = getDefaultData();
  await replaceWithPreparedBackup({
    items: defaultData.items,
    appState: {
      ...defaultData.appState,
      recentOutfits: []
    }
  });
  return defaultData;
}

export function __setIndexedDbFactoryForTests(factory) {
  indexedDbFactory = typeof factory === "function" ? factory : () => globalThis.indexedDB;
  databaseReadyPromise = null;
}
