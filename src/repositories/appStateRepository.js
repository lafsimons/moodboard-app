import {
  getDefaultData,
  loadAppState as loadStoredAppState,
  loadStartupAppState as loadStoredStartupAppState,
  saveAppState as saveStoredAppState
} from "../lib/storage.js";

export async function loadAppState() {
  return loadStoredAppState();
}

export async function loadStartupAppState() {
  return loadStoredStartupAppState();
}

export async function saveAppState(value) {
  return saveStoredAppState(value);
}

export function getDefaultAppState() {
  return getDefaultData().appState;
}
