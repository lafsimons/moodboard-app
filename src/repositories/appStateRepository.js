import {
  getDefaultData,
  loadAppState as loadStoredAppState,
  saveAppState as saveStoredAppState
} from "../lib/storage.js";

export async function loadAppState() {
  return loadStoredAppState();
}

export async function saveAppState(value) {
  return saveStoredAppState(value);
}

export function getDefaultAppState() {
  return getDefaultData().appState;
}
