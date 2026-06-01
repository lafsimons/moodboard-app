import {
  loadLatestOriginalRecoverySession as loadLatestStoredOriginalRecoverySession,
  loadOriginalRecoverySessionById,
  loadOriginalRecoverySessions as loadStoredOriginalRecoverySessions,
  saveOriginalRecoverySession as saveStoredOriginalRecoverySession
} from "../lib/storage.js";
import {
  buildOriginalRecoverySession,
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
  now = () => new Date().toISOString()
} = {}) {
  if (!adapter || typeof adapter.scan !== "function") {
    throw new Error("Original recovery scanning requires a scan adapter.");
  }

  if (typeof createOriginalImageAsset !== "function") {
    throw new Error("Original recovery scanning requires an original image asset decoder.");
  }

  const [items, scanResult] = await Promise.all([
    loadItems(),
    adapter.scan()
  ]);
  const candidateFilesById = {};
  const candidates = [];

  for (const entry of Array.isArray(scanResult?.entries) ? scanResult.entries : []) {
    if (!isSupportedImageFile(entry?.file)) {
      continue;
    }

    const originalAsset = await createOriginalImageAsset(entry.file);
    const candidate = createOriginalRecoveryCandidateRecord(entry, originalAsset);
    candidates.push(candidate);
    candidateFilesById[candidate.id] = entry.file;
  }

  const session = buildOriginalRecoverySession({
    sessionId: previousSession?.id,
    app,
    sourceLabel: scanResult?.sourceLabel,
    items,
    candidates,
    previousSession,
    now: typeof now === "function" ? now() : new Date().toISOString()
  });
  const saveResult = await persistRecoverySession(session);

  return {
    ...saveResult,
    candidateFilesById
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
