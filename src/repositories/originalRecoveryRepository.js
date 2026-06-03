import {
  loadLatestOriginalRecoverySession as loadLatestStoredOriginalRecoverySession,
  loadOriginalRecoverySessionById,
  loadOriginalRecoverySessions as loadStoredOriginalRecoverySessions,
  saveOriginalRecoverySession as saveStoredOriginalRecoverySession
} from "../lib/storage.js";
import {
  buildOriginalRecoverySession,
  collectOriginalRecoveryPlausibleCandidateIds,
  createDirectPathMatchRecord,
  createDirectPathRecoveryCandidate,
  createOriginalRecoveryCandidateRecord,
  createOriginalRecoveryReport,
  getApprovedOriginalRecoveryMatches,
  mergeOriginalRecoveryApplyResults,
  refreshOriginalRecoverySession,
  selectOriginalRecoveryCandidate,
  updateOriginalRecoveryMatchDecision
} from "../lib/originalRecovery.js";
import { normalizeKnownOriginalRelativePath } from "../lib/itemIdentity.js";
import { attachRecoveredOriginalForItem, loadItems } from "./itemsRepository.js";

const DEFAULT_APPLY_CHUNK_SIZE = 200;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp", ".tif", ".tiff"]);

function inferImageMimeTypeFromName(fileName = "") {
  const normalizedFileName = normalizeText(fileName).toLowerCase();

  if (normalizedFileName.endsWith(".jpg") || normalizedFileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalizedFileName.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedFileName.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalizedFileName.endsWith(".gif")) {
    return "image/gif";
  }

  if (normalizedFileName.endsWith(".avif")) {
    return "image/avif";
  }

  if (normalizedFileName.endsWith(".bmp")) {
    return "image/bmp";
  }

  if (normalizedFileName.endsWith(".tif") || normalizedFileName.endsWith(".tiff")) {
    return "image/tiff";
  }

  return "";
}

function hasSupportedImageExtension(fileName = "") {
  const normalizedFileName = normalizeText(fileName).toLowerCase();
  return [...SUPPORTED_IMAGE_EXTENSIONS].some((extension) => normalizedFileName.endsWith(extension));
}

function isSupportedImageFile(file) {
  return Boolean(file?.type?.startsWith?.("image/") || hasSupportedImageExtension(file?.name));
}

function isSupportedImageScanEntry(entry) {
  return hasSupportedImageExtension(entry?.fileName || entry?.relativePath);
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

function createApplyTimingSummary() {
  return {
    autosnapshotMs: 0,
    getFileMs: 0,
    blobWriteMs: 0,
    itemMetadataSaveMs: 0,
    averagePerItemMs: 0,
    appliedItemCount: 0,
    applyLoopMs: 0,
    reportPersistenceMs: 0
  };
}

function createRecoveryScanInstrumentation() {
  return {
    descriptorCount: 0,
    fileObjectsRetainedCount: 0,
    plausibleCandidateCount: 0,
    decodedCandidateCount: 0,
    getFileCallCount: 0,
    totalStoredCandidateCount: 0,
    liveDescriptorCount: 0,
    serializedSessionByteEstimate: 0
  };
}

function createPathLookupSummary() {
  return {
    checkedCount: 0,
    readyCount: 0,
    missingCount: 0,
    conflictCount: 0,
    fallbackItemCount: 0,
    fallbackMatchCount: 0
  };
}

function createLightweightCandidateRecord(entry, fileMetadata = {}) {
  return {
    id: normalizeText(entry?.id),
    sourceLabel: normalizeText(entry?.sourceLabel),
    relativePath: normalizeText(entry?.relativePath),
    lookupStrategy: normalizeText(entry?.lookupStrategy) || "scan",
    fileName: normalizeText(entry?.fileName) || normalizeText(fileMetadata?.name),
    sourceFileSize: normalizeNumber(fileMetadata?.size),
    sourceImageWidth: 0,
    sourceImageHeight: 0,
    sourceLastModified: normalizeNumber(fileMetadata?.lastModified),
    mimeType: normalizeText(fileMetadata?.type) || inferImageMimeTypeFromName(entry?.fileName || fileMetadata?.name),
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

function buildDirectPathConflict(item, fileMetadata = {}, relativePath = "") {
  const reasons = [];
  const normalizedRelativePath = normalizeKnownOriginalRelativePath(relativePath);
  const basename = normalizedRelativePath.split("/").filter(Boolean).at(-1) ?? "";
  const storedFilename = normalizeText(item?.sourceOriginalFilename);
  const actualFilename = normalizeText(fileMetadata?.name) || basename;
  const storedSize = normalizeNumber(item?.sourceFileSize);
  const actualSize = normalizeNumber(fileMetadata?.size);

  if (storedFilename && actualFilename && storedFilename !== actualFilename) {
    reasons.push("filename_mismatch");
  }

  if (storedSize && actualSize && storedSize !== actualSize) {
    reasons.push("size_mismatch");
  }

  return {
    hasConflict: reasons.length > 0,
    reasons
  };
}

async function runDirectPathLookup(items, adapter, rootContext, options = {}) {
  const pathLookup = createPathLookupSummary();
  const directMatchesByItemId = new Map();
  const directEntriesById = {};
  const missingOrConflictItemIds = new Set();
  const previousMatchesByItemId = new Map(
    (Array.isArray(options.previousSession?.matches) ? options.previousSession.matches : [])
      .filter((match) => normalizeText(match?.itemId))
      .map((match) => [normalizeText(match.itemId), match])
  );

  if (typeof adapter?.resolveRelativePath !== "function" || !rootContext) {
    return {
      pathLookup,
      directMatchesByItemId,
      directEntriesById,
      missingOrConflictItemIds
    };
  }

  const eligibleItems = (Array.isArray(items) ? items : []).filter(
    (item) => !item?.originalPreserved && normalizeText(item?.itemUuid) && normalizeKnownOriginalRelativePath(item?.knownOriginalRelativePath)
  );

  for (let index = 0; index < eligibleItems.length; index += 1) {
    const item = eligibleItems[index];
    const relativePath = normalizeKnownOriginalRelativePath(item?.knownOriginalRelativePath);

    if (!relativePath) {
      continue;
    }

    pathLookup.checkedCount += 1;
    options.onProgress?.({
      phase: "direct-path-check",
      completed: index + 1,
      total: eligibleItems.length,
      currentPath: relativePath
    });

    const entry = await adapter.resolveRelativePath(rootContext, relativePath, {
      id: `direct_path_${normalizeText(item?.id)}`,
      sourceLabel: normalizeText(rootContext?.sourceLabel),
      lookupStrategy: "direct_path"
    });

    if (!entry) {
      pathLookup.missingCount += 1;
      missingOrConflictItemIds.add(normalizeText(item?.id));
      continue;
    }

    const fileMetadata = await resolveScanEntryMetadata(adapter, entry);
    const conflict = buildDirectPathConflict(item, fileMetadata, relativePath);

    if (conflict.hasConflict) {
      pathLookup.conflictCount += 1;
      missingOrConflictItemIds.add(normalizeText(item?.id));
      continue;
    }

    const isExactPath = normalizeText(item?.sourceRelativePath) === relativePath;
    const candidate = createDirectPathRecoveryCandidate(item, fileMetadata, {
      id: entry.id,
      sourceLabel: entry.sourceLabel || rootContext?.sourceLabel,
      relativePath,
      lookupStrategy: isExactPath ? "exact_path" : "direct_path"
    });
    const match = createDirectPathMatchRecord(
      item,
      candidate,
      previousMatchesByItemId.get(normalizeText(item?.id))
    );

    directMatchesByItemId.set(match.itemId, match);
    directEntriesById[candidate.id] = createLiveCandidateEntryDescriptor(entry) ?? entry;
    pathLookup.readyCount += 1;
  }

  return {
    pathLookup,
    directMatchesByItemId,
    directEntriesById,
    missingOrConflictItemIds
  };
}

function createTraversalCandidateRecord(entry) {
  const relativePath = normalizeText(entry?.relativePath);
  const derivedFileName = relativePath.split("/").filter(Boolean).at(-1) ?? "";

  return createLightweightCandidateRecord({
    ...entry,
    fileName: normalizeText(entry?.fileName) || derivedFileName
  });
}

function createLiveCandidateEntryDescriptor(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const descriptor = {
    id: normalizeText(entry.id),
    sourceLabel: normalizeText(entry.sourceLabel),
    relativePath: normalizeText(entry.relativePath),
    fileName: normalizeText(entry.fileName),
    lookupStrategy: normalizeText(entry.lookupStrategy)
  };

  if (entry.handle) {
    descriptor.handle = entry.handle;
  } else if (entry.file) {
    descriptor.file = entry.file;
  }

  return descriptor.id ? descriptor : null;
}

function estimateSerializedBytes(value) {
  const payload = JSON.stringify(value ?? null);

  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(payload).length;
  }

  return payload.length;
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

export async function loadLatestOriginalRecoverySession(options = {}) {
  return loadLatestStoredOriginalRecoverySession(options);
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
  probeRecoveryImageMetadata,
  app = "mba",
  previousSession = null,
  now = () => new Date().toISOString(),
  onProgress = null
} = {}) {
  if (
    !adapter
    || (
      typeof adapter.scan !== "function"
      && !(typeof adapter.selectRoot === "function" && typeof adapter.scanRoot === "function")
    )
  ) {
    throw new Error("Original recovery scanning requires a scan adapter.");
  }

  if (typeof probeRecoveryImageMetadata !== "function") {
    throw new Error("Original recovery scanning requires an image metadata probe.");
  }

  const timings = createScanTimingSummary();
  const instrumentation = createRecoveryScanInstrumentation();
  const traversalStartedAtMs = getNowMs();
  const items = await loadItems();
  let rootContext = null;
  let scanResult = null;

  if (typeof adapter.selectRoot === "function") {
    rootContext = await adapter.selectRoot({
      onProgress: typeof onProgress === "function" ? onProgress : undefined
    });
  }

  const directLookupResult = await runDirectPathLookup(items, adapter, rootContext, {
    previousSession,
    onProgress
  });
  const remainingItems = items.filter((item) => !directLookupResult.directMatchesByItemId.has(normalizeText(item?.id)));
  const needsFallbackScan = remainingItems.some(
    (item) => !item?.originalPreserved && normalizeText(item?.itemUuid)
  );

  if (needsFallbackScan) {
    if (typeof adapter.scanRoot === "function" && rootContext) {
      scanResult = await adapter.scanRoot(rootContext, {
        onProgress: typeof onProgress === "function" ? onProgress : undefined
      });
    } else {
      scanResult = await adapter.scan({
        onProgress: typeof onProgress === "function" ? onProgress : undefined
      });
    }
  } else {
    scanResult = {
      sourceLabel: normalizeText(rootContext?.sourceLabel),
      entries: []
    };
  }
  timings.traversalMs = buildPhaseTiming(traversalStartedAtMs);
  const candidateEntriesById = {};
  const lightweightCandidates = [];
  const metadataEntries = Array.isArray(scanResult?.entries) ? scanResult.entries : [];
  for (let index = 0; index < metadataEntries.length; index += 1) {
    const entry = metadataEntries[index];

    if (!isSupportedImageScanEntry(entry)) {
      continue;
    }

    const candidate = createTraversalCandidateRecord(entry);

    if (!candidate.id) {
      continue;
    }

    lightweightCandidates.push(candidate);
    const liveDescriptor = createLiveCandidateEntryDescriptor(entry);

    if (liveDescriptor) {
      candidateEntriesById[candidate.id] = liveDescriptor;
    }
  }
  timings.metadataMs = 0;
  instrumentation.descriptorCount = lightweightCandidates.length;
  instrumentation.fileObjectsRetainedCount = 0;
  instrumentation.liveDescriptorCount = Object.keys(candidateEntriesById).length;

  onProgress?.({
    phase: "matching-filenames",
    completed: 0,
    total: remainingItems.length
  });
  const indexBuildStartedAtMs = getNowMs();
  const plausibleCandidateIds = collectOriginalRecoveryPlausibleCandidateIds(remainingItems, lightweightCandidates);
  timings.indexBuildMs = buildPhaseTiming(indexBuildStartedAtMs);

  const decodedCandidates = [];
  const plausibleCandidateList = lightweightCandidates.filter((candidate) => plausibleCandidateIds.has(candidate.id));
  instrumentation.plausibleCandidateCount = plausibleCandidateList.length;
  const candidateMetadataStartedAtMs = getNowMs();

  for (let index = 0; index < plausibleCandidateList.length; index += 1) {
    const lightweightCandidate = plausibleCandidateList[index];
    const entry = candidateEntriesById[lightweightCandidate.id];
    const fileMetadata = await resolveScanEntryMetadata(adapter, entry);

    if (!isSupportedImageFile(fileMetadata)) {
      continue;
    }

    lightweightCandidate.sourceFileSize = normalizeNumber(fileMetadata?.size);
    lightweightCandidate.sourceLastModified = normalizeNumber(fileMetadata?.lastModified);
    lightweightCandidate.mimeType = normalizeText(fileMetadata?.type) || lightweightCandidate.mimeType;
    instrumentation.fileObjectsRetainedCount = 0;
    instrumentation.getFileCallCount = (instrumentation.getFileCallCount ?? 0) + 1;
    onProgress?.({
      phase: "reading-candidate-metadata",
      completed: index + 1,
      total: plausibleCandidateList.length,
      currentPath: lightweightCandidate.relativePath
    });
  }
  timings.metadataMs = buildPhaseTiming(candidateMetadataStartedAtMs);

  const decodeStartedAtMs = getNowMs();

  for (let index = 0; index < plausibleCandidateList.length; index += 1) {
    const lightweightCandidate = plausibleCandidateList[index];
    const entry = candidateEntriesById[lightweightCandidate.id];
    const file = await resolveScanEntryFile(adapter, entry);
    instrumentation.getFileCallCount = (instrumentation.getFileCallCount ?? 0) + 1;
    const originalAsset = await probeRecoveryImageMetadata(file);
    const candidate = createOriginalRecoveryCandidateRecord({
      ...entry,
      fileName: lightweightCandidate.fileName
    }, originalAsset);
    decodedCandidates.push(candidate);
    onProgress?.({
      phase: "decoding-candidate-images",
      completed: index + 1,
      total: plausibleCandidateList.length,
      currentPath: candidate.relativePath
    });
  }
  timings.decodeMs = buildPhaseTiming(decodeStartedAtMs);
  instrumentation.decodedCandidateCount = decodedCandidates.length;

  onProgress?.({
    phase: "final-scoring",
    completed: 0,
    total: remainingItems.length
  });
  const matchSessionStartedAtMs = getNowMs();
  const fallbackSession = buildOriginalRecoverySession({
    sessionId: previousSession?.id,
    app,
    sourceLabel: scanResult?.sourceLabel,
    items: remainingItems,
    candidates: decodedCandidates,
    scannedFileCount: lightweightCandidates.length,
    previousSession,
    now: typeof now === "function" ? now() : new Date().toISOString()
  });
  timings.matchSessionMs = buildPhaseTiming(matchSessionStartedAtMs);
  directLookupResult.pathLookup.fallbackItemCount = remainingItems.filter(
    (item) => !item?.originalPreserved && normalizeText(item?.itemUuid)
  ).length;
  directLookupResult.pathLookup.fallbackMatchCount = (fallbackSession.matches ?? []).filter(
    (match) => match.outcome !== "excluded" && Array.isArray(match.candidates) && match.candidates.length > 0
  ).length;
  const session = refreshOriginalRecoverySession({
    ...fallbackSession,
    matches: [
      ...directLookupResult.directMatchesByItemId.values(),
      ...(fallbackSession.matches ?? [])
    ].sort((left, right) => normalizeText(left.itemName || left.itemId).localeCompare(normalizeText(right.itemName || right.itemId))),
    pathLookup: directLookupResult.pathLookup
  }, {
    status: "scanned",
    updatedAt: typeof now === "function" ? now() : new Date().toISOString()
  });

  onProgress?.({
    phase: "saving",
    completed: 0,
    total: 1
  });
  const persistenceStartedAtMs = getNowMs();
  const saveResult = await persistRecoverySession(session);
  timings.persistenceMs = buildPhaseTiming(persistenceStartedAtMs);
  instrumentation.liveDescriptorCount = Object.keys({
    ...candidateEntriesById,
    ...directLookupResult.directEntriesById
  }).length;
  instrumentation.totalStoredCandidateCount = (session.matches ?? []).reduce(
    (total, match) => total + (Array.isArray(match?.candidates) ? match.candidates.length : 0),
    0
  );
  instrumentation.serializedSessionByteEstimate = estimateSerializedBytes(session);

  return {
    ...saveResult,
    candidateEntriesById: {
      ...candidateEntriesById,
      ...directLookupResult.directEntriesById
    },
    timings,
    instrumentation
  };
}

export async function applyOriginalRecoverySession(sessionId, options = {}) {
  const session = await resolveRecoverySession(sessionId, options.currentSession);

  if (!session) {
    throw new Error("Original recovery session is unavailable. Re-scan the source before applying.");
  }

  const candidateEntriesById = options.candidateEntriesById && typeof options.candidateEntriesById === "object"
    ? options.candidateEntriesById
    : {};
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const approvedMatches = getApprovedOriginalRecoveryMatches(session);
  const appliedAt = typeof options.now === "function" ? options.now() : new Date().toISOString();
  const timings = createApplyTimingSummary();
  const applyLoopStartedAtMs = getNowMs();
  const chunkSize = Math.max(1, Math.round(Number(options.chunkSize) || DEFAULT_APPLY_CHUNK_SIZE));
  const recoveredItemIds = [];
  const failedResults = [];
  let workingSession = session;
  let applyChunkCount = 0;
  let maxApplyChunkSize = 0;
  let persisted = true;

  onProgress?.({
    phase: "apply-start",
    completed: 0,
    total: approvedMatches.length
  });

  for (let chunkStart = 0; chunkStart < approvedMatches.length; chunkStart += chunkSize) {
    const chunkMatches = approvedMatches.slice(chunkStart, chunkStart + chunkSize);
    const chunkApplyResults = [];

    applyChunkCount += 1;
    maxApplyChunkSize = Math.max(maxApplyChunkSize, chunkMatches.length);

    for (let chunkIndex = 0; chunkIndex < chunkMatches.length; chunkIndex += 1) {
      const index = chunkStart + chunkIndex;
      const itemStartedAtMs = getNowMs();
      const match = chunkMatches[chunkIndex];
      const selectedCandidateId = normalizeText(match.selectedCandidateId);
      const selectedCandidate = (Array.isArray(match.candidates) ? match.candidates : []).find(
        (candidate) => candidate.id === selectedCandidateId
      );
      onProgress?.({
        phase: "candidate-lookup",
        completed: index,
        total: approvedMatches.length,
        itemId: match.itemId,
        itemName: match.itemName || match.itemId,
        fileName: selectedCandidate?.fileName || ""
      });
      const entry = selectedCandidateId ? candidateEntriesById[selectedCandidateId] : null;
      const getFileStartedAtMs = getNowMs();
      const file = entry ? await resolveScanEntryFile(options.adapter ?? null, entry) : null;
      const getFileMs = buildPhaseTiming(getFileStartedAtMs);
      timings.getFileMs += getFileMs;

      if (!selectedCandidateId || !selectedCandidate || !file) {
        chunkApplyResults.push({
          itemId: match.itemId,
          status: "skipped",
          message: "Selected candidate is no longer available. Re-scan before applying.",
          appliedAt,
          decision: "needs_rescan"
        });
        onProgress?.({
          phase: "candidate-missing",
          completed: index + 1,
          total: approvedMatches.length,
          itemId: match.itemId,
          itemName: match.itemName || match.itemId,
          fileName: selectedCandidate?.fileName || ""
        });
        continue;
      }

      try {
        const result = await attachRecoveredOriginalForItem(
          match.itemId,
          file,
          selectedCandidate,
          {
            createOriginalImageAsset: options.createOriginalImageAsset,
            now: options.now,
            onProgress: (event) => {
              onProgress?.({
                ...event,
                completed: index,
                total: approvedMatches.length,
                itemName: match.itemName || match.itemId
              });
            }
          }
        );
        timings.blobWriteMs += Number(result?.timings?.blobWriteMs) || 0;
        timings.itemMetadataSaveMs += Number(result?.timings?.itemMetadataSaveMs) || 0;
        timings.appliedItemCount += 1;
        timings.averagePerItemMs = Math.max(
          0,
          Math.round((((Number(timings.averagePerItemMs) * Math.max(0, timings.appliedItemCount - 1))
            + buildPhaseTiming(itemStartedAtMs)) / timings.appliedItemCount) * 100) / 100
        );
        recoveredItemIds.push(result.item.id);
        chunkApplyResults.push({
          itemId: match.itemId,
          status: "recovered",
          message: `Recovered ${selectedCandidate.fileName || match.itemName || match.itemId}.`,
          appliedAt,
          decision: "accepted"
        });
        onProgress?.({
          phase: "item-recovered",
          completed: index + 1,
          total: approvedMatches.length,
          itemId: match.itemId,
          itemName: match.itemName || match.itemId,
          fileName: selectedCandidate.fileName || ""
        });
      } catch (error) {
        const message = typeof error?.message === "string" ? error.message : "Original recovery failed.";

        timings.appliedItemCount += 1;
        timings.averagePerItemMs = Math.max(
          0,
          Math.round((((Number(timings.averagePerItemMs) * Math.max(0, timings.appliedItemCount - 1))
            + buildPhaseTiming(itemStartedAtMs)) / timings.appliedItemCount) * 100) / 100
        );
        chunkApplyResults.push({
          itemId: match.itemId,
          status: "failed",
          message,
          appliedAt,
          decision: "accepted"
        });
        failedResults.push({
          itemId: match.itemId,
          message
        });
        onProgress?.({
          phase: "item-failed",
          completed: index + 1,
          total: approvedMatches.length,
          itemId: match.itemId,
          itemName: match.itemName || match.itemId,
          fileName: selectedCandidate.fileName || "",
          error: message
        });
      }
    }

    workingSession = mergeOriginalRecoveryApplyResults(workingSession, chunkApplyResults, {
      updatedAt: appliedAt
    });
    onProgress?.({
      phase: "report-persistence",
      completed: Math.min(chunkStart + chunkMatches.length, approvedMatches.length),
      total: approvedMatches.length
    });
    const chunkPersistenceStartedAtMs = getNowMs();
    const chunkSaveResult = await persistRecoverySession(workingSession);
    timings.reportPersistenceMs += buildPhaseTiming(chunkPersistenceStartedAtMs);
    workingSession = chunkSaveResult.session;
    persisted = persisted && chunkSaveResult.persisted;
  }
  timings.applyLoopMs = buildPhaseTiming(applyLoopStartedAtMs);
  timings.applyChunkCount = applyChunkCount;
  timings.maxApplyChunkSize = maxApplyChunkSize;
  onProgress?.({
    phase: "apply-complete",
    completed: approvedMatches.length,
    total: approvedMatches.length
  });

  return {
    session: workingSession,
    persisted,
    recoveredItemIds,
    failedResults,
    timings
  };
}

export async function exportOriginalRecoveryReport(sessionId, options = {}) {
  const session = await resolveRecoverySession(sessionId, options.currentSession);

  if (!session) {
    throw new Error("Original recovery session could not be found.");
  }

  return createOriginalRecoveryReport(session);
}
