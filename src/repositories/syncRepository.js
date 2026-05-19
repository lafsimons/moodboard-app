import {
  backfillLocalSyncMetadata as backfillStoredLocalSyncMetadata,
  clearSyncMetadata as clearStoredSyncMetadata,
  getOrCreateDeviceId as getStoredOrCreateDeviceId,
  getSyncMetadata as getStoredSyncMetadata,
  upsertSyncMetadata as upsertStoredSyncMetadata
} from "../lib/storage.js";

export async function getOrCreateDeviceId() {
  return getStoredOrCreateDeviceId();
}

export async function getSyncMetadata(key) {
  return getStoredSyncMetadata(key);
}

export async function upsertSyncMetadata(record) {
  return upsertStoredSyncMetadata(record);
}

export async function clearSyncMetadata() {
  return clearStoredSyncMetadata();
}

export async function backfillLocalSyncMetadata(items, savedOutfits) {
  return backfillStoredLocalSyncMetadata(items, savedOutfits);
}
