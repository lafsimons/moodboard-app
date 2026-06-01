import {
  loadLatestOriginalRecoverySession as loadLatestStoredOriginalRecoverySession,
  loadOriginalRecoverySessionById,
  loadOriginalRecoverySessions as loadStoredOriginalRecoverySessions,
  saveOriginalRecoverySession as saveStoredOriginalRecoverySession
} from "../lib/storage.js";
import {
  buildOriginalRecoverySession,
  collectOriginalRecoveryPlausibleCandidateIds,
  createOriginalRecoveryCandidateRecord,
  createOriginalRecoveryReport,
  getApprovedOriginalRecoveryMatches,
  mergeOriginalRecoveryApplyResults,
  selectOriginalRecoveryCandidate,
  updateOriginalRecoveryMatchDecision
} from "../lib/originalRecovery.js";
import { loadItems, reconnectOriginalForItem } from "./itemsRepository.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isSupportedImageFile(file) {
  return Boolean(file?.type?.startsWith?.("image/"));
}

function normalizeNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
}

function getNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function buildPhaseTiming(startedAtMs) {
  return Math.max(0, Math.round((getNowMs() - startedAtMs) * 100) / 100);
}

function createScanTimingSummary() {
  return {
    traversalMs: 0,
    metadataMs: 0,
    decodeMs: 0,
    indexBuildMs: 0,
    matchSessionMs: 0,
    persistenceMs: 0
  };
}

function createLightweightCandidateRecord(entry, fileMetadata = {}) {
  return {
    id: normalizeText(entry?.id),
    sourceLabel: normalizeText(entry?.sourceLabel),
    relativePath: normalizeText(entry?.relativePath),
    fileName: normalizeText(entry?.fileName) || normalizeText(fileMetadata?.name),
    sourceFileSize: normalizeNumber(fileMetadata?.size),
    sourceImageWidth: 0,
    sourceImageHeight: 0,
    sourceLastModified: normalizeNumber(fileMetadata?.lastModified),
    mimeType: normalizeText(fileMetadata?.type),
    fingerprint: ""
  };
}

async function resolveScanEntryFile(adapter, entry) {
  if (entry?.file) {
    return entry.file;
  }

  if (typeof adapter?.getFile === "function") {
    return adapter.getFile(entry);
  }

  if (entry?.handle && typeof entry.handle.getFile === "function") {
    return entry.handle.getFile();
  }

  throw new Error("Original recovery scan entry could not be materialized as a file.");
}

async function resolveScanEntryMetadata(adapter, entry) {
  if (typeof adapter?.getFileMetadata === "function") {
    const metadata = await adapter.getFileMetadata(entry);

    if (metadata) {
      return metadata;
    }
  }

  const file = await resolveScanEntryFile(adapter, entry);

  return {
    name: file?.name,
    size: file?.size,
    type: file?.type,
    lastModified: file?.lastModified
  };
}

async function persistRecoverySession(session) {
  const savedSession = await saveStoredOriginalRecoverySession(session);
  const persistedSession = await loadOriginalRecoverySessionById(savedSession.id);

  return {
    session: savedSession,
    persisted: Boolean(persistedSession)
  };
}

async function resolveRecoverySession(sessionId, currentSession = null) {
  const normalizedSessionId = normalizeText(sessionId);
  const normalizedCurrentSessionId = normalizeText(currentSession?.id);

  if (normalizedCurrentSessionId && (!normalizedSessionId || normalizedCurrentSessionId === normalizedSessionId)) {
    return currentSession;
  }

  if (!normalizedSessionId) {
    return currentSession ?? null;
  }

  const persistedSession = await loadOriginalRecoverySessionById(normalizedSessionId);

  return persistedSession ?? currentSession ?? null;
}

export async function loadOriginalRecoverySessions(options = {}) {
  return loadStoredOriginalRecoverySessions(options);
}

export async function loadLatestOriginalRecoverySession() {
  return loadLatestStoredOriginalRecoverySession();
}

export async function saveOriginalRecoverySession(session) {
  return persistRecoverySession(session);
}

export async function updateOriginalRecoveryDecision(sessionId, itemId, decision, options = {}) {
  const session = await resolveRecoverySession(sessionId, options.currentSession);

  if (!session) {
    throw new Error("Original recovery session could not be found.");
  }

  const nextSession = updateOriginalRecoveryMatchDecision(session, itemId, decision);
  return persistRecoverySession(nextSession);
}

export async function updateOriginalRecoveryCandidateSelection(sessionId, itemId, candidateId, options = {}) {
  const session = await resolveRecoverySession(sessionId, options.currentSession);

  if (!session) {
    throw new Error("Original recovery session could not be found.");
  }

  const nextSession = selectOriginalRecoveryCandidate(session, itemId, candidateId);
  return persistRecoverySession(nextSession);
}

export async function scanOriginalRecoverySource({
  adapter,
  createOriginalImageAsset,
  app = "mba",
  previousSession = null,
  now = () => new Date().toISOString(),
  onProgress = null
} = {}) {
  if (!adapter || typeof adapter.scan !== "function") {
    throw new Error("Original recovery scanning requires a scan adapter.");
  }

  if (typeof createOriginalImageAsset !== "function") {
    throw new Error("Original recovery scanning requires an original image asset decoder.");
  }

  const timings = createScanTimingSummary();
  const traversalStartedAtMs = getNowMs();
  const [items, scanResult] = await Promise.all([
    loadItems(),
    adapter.scan({
      onProgress: typeof onProgress === "function" ? onProgress : undefined
    })
  ]);
  timings.traversalMs = buildPhaseTiming(traversalStartedAtMs);
  const candidateFilesById = {};
  const lightweightCandidates = [];
  const scanEntriesById = new Map();
  const metadataEntries = Array.isArray(scanResult?.entries) ? scanResult.entries : [];
  const metadataStartedAtMs = getNowMs();

  for (let index = 0; index < metadataEntries.length; index += 1) {
    const entry = metadataEntries[index];
    const fileMetadata = await resolveScanEntryMetadata(adapter, entry);

    if (!isSupportedImageFile(fileMetadata)) {
      continue;
    }

    const candidate = createLightweightCandidateRecord(entry, fileMetadata);

    if (!candidate.id) {
      continue;
    }

    lightweightCandidates.push(candidate);
    scanEntriesById.set(candidate.id, entry);
    onProgress?.({
      phase: "metadata",
      completed: index + 1,
      total: metadataEntries.length,
      currentPath: candidate.relativePath
    });
  }
  timings.metadataMs = buildPhaseTiming(metadataStartedAtMs);

  const indexBuildStartedAtMs = getNowMs();
  const plausibleCandidateIds = collectOriginalRecoveryPlausibleCandidateIds(items, lightweightCandidates);
  timings.indexBuildMs = buildPhaseTiming(indexBuildStartedAtMs);

  const decodedCandidates = [];
  const plausibleCandidateList = lightweightCandidates.filter((candidate) => plausibleCandidateIds.has(candidate.id));
  const decodeStartedAtMs = getNowMs();

  for (let index = 0; index < plausibleCandidateList.length; index += 1) {
    const lightweightCandidate = plausibleCandidateList[index];
    const entry = scanEntriesById.get(lightweightCandidate.id);
    const file = await resolveScanEntryFile(adapter, entry);
    const originalAsset = await createOriginalImageAsset(file);
    const candidate = createOriginalRecoveryCandidateRecord({
      ...entry,
      file
    }, originalAsset);
    decodedCandidates.push(candidate);
    candidateFilesById[candidate.id] = file;
    onProgress?.({
      phase: "decode",
      completed: index + 1,
      total: plausibleCandidateList.length,
      currentPath: candidate.relativePath
    });
  }
  timings.decodeMs = buildPhaseTiming(decodeStartedAtMs);

  onProgress?.({
    phase: "matching",
    completed: 0,
    total: items.length
  });
  const matchSessionStartedAtMs = getNowMs();
  const session = buildOriginalRecoverySession({
    sessionId: previousSession?.id,
    app,
    sourceLabel: scanResult?.sourceLabel,
    items,
    candidates: decodedCandidates,
    scannedFileCount: lightweightCandidates.length,
    previousSession,
    now: typeof now === "function" ? now() : new Date().toISOString()
  });
  timings.matchSessionMs = buildPhaseTiming(matchSessionStartedAtMs);

  onProgress?.({
    phase: "saving",
    completed: 0,
    total: 1
  });
  const persistenceStartedAtMs = getNowMs();
  const saveResult = await persistRecoverySession(session);
  timings.persistenceMs = buildPhaseTiming(persistenceStartedAtMs);

  return {
    ...saveResult,
    candidateFilesById,
    timings
  };
}

export async function applyOriginalRecoverySession(sessionId, options = {}) {
  const session = await resolveRecoverySession(sessionId, options.currentSession);

  if (!session) {
    throw new Error("Original recovery session is unavailable. Re-scan the source before applying.");
  }

  if (typeof options.createOriginalImageAsset !== "function") {
    throw new Error("Original recovery apply requires an original image asset decoder.");
  }

  const candidateFilesById = options.candidateFilesById && typeof options.candidateFilesById === "object"
    ? options.candidateFilesById
    : {};
  const approvedMatches = getApprovedOriginalRecoveryMatches(session);
  const applyResults = [];
  const recoveredItems = [];
  const appliedAt = typeof options.now === "function" ? options.now() : new Date().toISOString();

  for (const match of approvedMatches) {
    const selectedCandidateId = normalizeText(match.selectedCandidateId);
    const selectedCandidate = (Array.isArray(match.candidates) ? match.candidates : []).find(
      (candidate) => candidate.id === selectedCandidateId
    );
    const file = selectedCandidateId ? candidateFilesById[selectedCandidateId] : null;

    if (!selectedCandidateId || !selectedCandidate || !file) {
      applyResults.push({
        itemId: match.itemId,
        status: "skipped",
        message: "Selected candidate is no longer available. Re-scan before applying.",
        appliedAt,
        decision: "needs_rescan"
      });
      continue;
    }

    try {
      const result = await reconnectOriginalForItem(
        match.itemId,
        file,
        {
          match: {
            classification: selectedCandidate.match?.classification
          }
        },
        {
          createOriginalImageAsset: options.createOriginalImageAsset,
          now: options.now
        }
      );
      recoveredItems.push(result.item);
      applyResults.push({
        itemId: match.itemId,
        status: "recovered",
        message: `Recovered ${selectedCandidate.fileName || match.itemName || match.itemId}.`,
        appliedAt,
        decision: "accepted"
      });
    } catch (error) {
      applyResults.push({
        itemId: match.itemId,
        status: "failed",
        message: typeof error?.message === "string" ? error.message : "Original recovery failed.",
        appliedAt,
        decision: "accepted"
      });
    }
  }

  const nextSession = mergeOriginalRecoveryApplyResults(session, applyResults, {
    updatedAt: appliedAt
  });
  const saveResult = await persistRecoverySession(nextSession);

  return {
    ...saveResult,
    recoveredItems,
    applyResults
  };
}

export async function exportOriginalRecoveryReport(sessionId, options = {}) {
  const session = await resolveRecoverySession(sessionId, options.currentSession);

  if (!session) {
    throw new Error("Original recovery session could not be found.");
  }

  return createOriginalRecoveryReport(session);
}
