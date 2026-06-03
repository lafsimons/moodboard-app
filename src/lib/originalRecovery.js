import {
  buildSourceProvenanceSignals,
  createSourceProvenanceComparableRecord,
  getSourceProvenanceMatchDetails
} from "./sourceProvenanceMatching.js";
import { normalizeKnownOriginalRelativePath } from "./itemIdentity.js";

const MATCH_PRIORITY = {
  none: 0,
  weak: 1,
  possible: 2,
  strong: 3,
  exact: 4
};
const LEGACY_SOURCE_NAMESPACES = new Set(["vintage", "moodboard", "wishlist"]);
const LEGACY_NUMBERED_FILENAME_PATTERN = /^images-\d+(\.[a-z0-9]+)?$/i;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
}

function normalizeStringArray(value) {
  const seen = new Set();

  return (Array.isArray(value) ? value : [])
    .map((entry) => normalizeText(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    });
}

function normalizeComparableValue(value) {
  return normalizeText(value).replace(/\\/g, "/").toLowerCase();
}

function getPathSegments(value) {
  return normalizeComparableValue(value)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getPathNamespace(value) {
  const namespace = getPathSegments(value)[0] ?? "";
  return LEGACY_SOURCE_NAMESPACES.has(namespace) ? namespace : "";
}

function getPathBasename(value) {
  const segments = getPathSegments(value);
  return segments[segments.length - 1] ?? "";
}

function parseLegacyRelativePath(value) {
  const segments = getPathSegments(value);

  if (segments.length < 2) {
    return null;
  }

  const namespace = segments[0];
  const basename = segments[segments.length - 1];

  if (!LEGACY_SOURCE_NAMESPACES.has(namespace) || !LEGACY_NUMBERED_FILENAME_PATTERN.test(basename)) {
    return null;
  }

  return {
    namespace,
    basename
  };
}

function isSafeLegacyReadyPossibleSingle(item, candidateMatches, outcome) {
  if (outcome !== "possible_single" || candidateMatches.length !== 1) {
    return false;
  }

  const sourceRelativePath = normalizeText(item?.sourceRelativePath);
  const sourceAliases = normalizeStringArray(item?.sourceFilenameAliases).map(normalizeComparableValue);
  const relativePathDetails = parseLegacyRelativePath(sourceRelativePath);

  if (!relativePathDetails || !sourceAliases.length) {
    return false;
  }

  const expectedArchiveBasename = `${relativePathDetails.namespace}-${relativePathDetails.basename}`;

  if (!sourceAliases.includes(expectedArchiveBasename)) {
    return false;
  }

  const candidate = candidateMatches[0];

  if (!candidate?.match?.filenameMatch) {
    return false;
  }

  const candidateNamespace = getPathNamespace(candidate.relativePath);
  const candidateBasename = getPathBasename(candidate.relativePath) || normalizeComparableValue(candidate.fileName);

  return candidateNamespace === relativePathDetails.namespace
    && candidateBasename === expectedArchiveBasename;
}

function getLegacyNumberFromValue(value) {
  const match = normalizeText(value).match(/images-(\d+)/i);
  return match ? match[1] : "";
}

function parseLegacyArchiveCandidate(value) {
  const normalizedBasename = getPathBasename(value) || normalizeComparableValue(value);
  const match = normalizedBasename.match(/^(vintage|moodboard|wishlist)-images-(\d+)(\.[a-z0-9]+)$/i);

  if (!match) {
    return null;
  }

  return {
    namespace: match[1].toLowerCase(),
    number: match[2],
    extension: match[3].toLowerCase(),
    basename: `${match[1].toLowerCase()}-images-${match[2]}${match[3].toLowerCase()}`
  };
}

function getCandidateNamespace(candidate = {}) {
  const relativePathNamespace = getPathNamespace(candidate?.relativePath);

  if (relativePathNamespace) {
    return relativePathNamespace;
  }

  const sourceLabel = normalizeText(candidate?.sourceLabel).toLowerCase();
  return LEGACY_SOURCE_NAMESPACES.has(sourceLabel) ? sourceLabel : "";
}

function isSafeVintageReadyWeakSingle(item, candidateMatches, outcome) {
  if (outcome !== "weak_only" || candidateMatches.length !== 1 || item?.originalPreserved) {
    return false;
  }

  const normalizedTags = normalizeStringArray(item?.tags).map((entry) => entry.toLowerCase());

  if (!normalizedTags.includes("folder/vintage")) {
    return false;
  }

  const legacyNumber =
    getLegacyNumberFromValue(item?.sourceOriginalFilename)
    || getLegacyNumberFromValue(item?.name);

  if (!legacyNumber) {
    return false;
  }

  const candidate = candidateMatches[0];
  const candidateDetails = parseLegacyArchiveCandidate(candidate?.relativePath || candidate?.fileName);

  if (!candidateDetails || candidateDetails.namespace !== "vintage" || candidateDetails.number !== legacyNumber) {
    return false;
  }

  const candidateNamespace = getCandidateNamespace(candidate);
  const candidateBasename = getPathBasename(candidate.relativePath) || normalizeComparableValue(candidate.fileName);
  const expectedRelativePath = `vintage/images-${legacyNumber}${candidateDetails.extension}`;
  const expectedArchiveBasename = `vintage-images-${legacyNumber}${candidateDetails.extension}`;
  const normalizedSourceNamespace = normalizeText(item?.sourceNamespace).toLowerCase();
  const sourceRelativePath = normalizeText(item?.sourceRelativePath);
  const normalizedSourceRelativePath = normalizeComparableValue(sourceRelativePath);
  const sourceAliases = normalizeStringArray(item?.sourceFilenameAliases).map(normalizeComparableValue);
  const hasVintagePathProof = normalizedSourceRelativePath.startsWith("vintage/");
  const hasVintageAliasProof = sourceAliases.includes(expectedArchiveBasename);
  const hasVintageNamespaceProof = normalizedSourceNamespace === "vintage";

  if (candidateNamespace !== "vintage" || candidateBasename !== expectedArchiveBasename) {
    return false;
  }

  if (sourceRelativePath && normalizedSourceRelativePath !== expectedRelativePath) {
    return false;
  }

  if (sourceAliases.length && !hasVintageAliasProof) {
    return false;
  }

  return hasVintageNamespaceProof || hasVintagePathProof || hasVintageAliasProof;
}

function buildComparableCandidate(candidate) {
  return createSourceProvenanceComparableRecord({
    sourceOriginalFilename: normalizeText(candidate.fileName),
    sourceRelativePath: normalizeText(candidate.relativePath),
    sourceFilenameAliases: [],
    sourceFileSize: normalizeNumber(candidate.sourceFileSize),
    sourceImageWidth: normalizeNumber(candidate.sourceImageWidth),
    sourceImageHeight: normalizeNumber(candidate.sourceImageHeight),
    sourceLastModified: normalizeNumber(candidate.sourceLastModified),
    mimeType: normalizeText(candidate.mimeType)
  });
}

function buildMatchReasons(match) {
  const reasons = [];

  if (match.filenameMatch) {
    reasons.push("Filename matches stored provenance");
  }

  if (match.sizeMatch) {
    reasons.push("File size matches");
  }

  if (match.dimensionMatch) {
    reasons.push("Dimensions match");
  }

  if (match.lastModifiedMatch) {
    reasons.push("Last modified timestamp matches");
  }

  if (match.mimeTypeMatch) {
    reasons.push("MIME type matches");
  }

  return reasons;
}

function createOutcomeFromRank(topClassification, candidateCountAtTopRank) {
  if (!topClassification || topClassification === "none") {
    return "no_match";
  }

  if (candidateCountAtTopRank > 1) {
    return "ambiguous_multiple";
  }

  if (topClassification === "weak") {
    return "weak_only";
  }

  if (topClassification === "exact") {
    return "exact_single";
  }

  if (topClassification === "strong") {
    return "strong_single";
  }

  return "possible_single";
}

function sortCandidateMatches(left, right) {
  const classificationDelta =
    (MATCH_PRIORITY[right.match.classification] ?? 0) - (MATCH_PRIORITY[left.match.classification] ?? 0);

  if (classificationDelta !== 0) {
    return classificationDelta;
  }

  const supportingDelta = (right.match.supportingMatches ?? 0) - (left.match.supportingMatches ?? 0);

  if (supportingDelta !== 0) {
    return supportingDelta;
  }

  const relativePathDelta = normalizeText(left.relativePath).localeCompare(normalizeText(right.relativePath));

  if (relativePathDelta !== 0) {
    return relativePathDelta;
  }

  return normalizeText(left.id).localeCompare(normalizeText(right.id));
}

function createCandidateFingerprint(candidate) {
  return [
    normalizeText(candidate.relativePath).toLowerCase(),
    normalizeText(candidate.fileName).toLowerCase(),
    normalizeText(candidate.mimeType).toLowerCase(),
    normalizeNumber(candidate.sourceFileSize),
    normalizeNumber(candidate.sourceImageWidth),
    normalizeNumber(candidate.sourceImageHeight),
    normalizeNumber(candidate.sourceLastModified)
  ].join("|");
}

function createPreparedCandidate(candidate) {
  const comparableRecord = buildComparableCandidate(candidate);
  const provenanceSignals = buildSourceProvenanceSignals(comparableRecord);

  return {
    candidate,
    comparableRecord,
    provenanceSignals,
    supportKeys: {
      sizeKey: normalizeNumber(comparableRecord.sourceFileSize) || 0,
      dimensionKey:
        comparableRecord.sourceImageWidth && comparableRecord.sourceImageHeight
          ? `${comparableRecord.sourceImageWidth}x${comparableRecord.sourceImageHeight}`
          : "",
      mimeTypeKey: normalizeText(comparableRecord.mimeType).toLowerCase()
    }
  };
}

function createPreparedItem(item) {
  const comparableRecord = createSourceProvenanceComparableRecord({
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
    sourceOriginalFilename: normalizeText(item?.sourceOriginalFilename),
    sourceFilenameAliases: normalizeStringArray(item?.sourceFilenameAliases),
    sourceFileSize: normalizeNumber(item?.sourceFileSize),
    sourceImageWidth: normalizeNumber(item?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(item?.sourceImageHeight),
    sourceLastModified: normalizeNumber(item?.sourceLastModified),
    mimeType: normalizeText(item?.mimeType)
  });
  const provenanceSignals = buildSourceProvenanceSignals(comparableRecord);

  return {
    item,
    comparableRecord,
    provenanceSignals,
    supportKeys: {
      sizeKey: normalizeNumber(comparableRecord.sourceFileSize) || 0,
      dimensionKey:
        comparableRecord.sourceImageWidth && comparableRecord.sourceImageHeight
          ? `${comparableRecord.sourceImageWidth}x${comparableRecord.sourceImageHeight}`
          : "",
      mimeTypeKey: normalizeText(comparableRecord.mimeType).toLowerCase()
    }
  };
}

function pushIndexedCandidate(index, key, preparedCandidate) {
  if (!key) {
    return;
  }

  const existingCandidates = index.get(key);

  if (existingCandidates) {
    existingCandidates.push(preparedCandidate);
    return;
  }

  index.set(key, [preparedCandidate]);
}

function buildPreparedCandidateIndex(candidates) {
  const preparedCandidates = (Array.isArray(candidates) ? candidates : []).map(createPreparedCandidate);
  const indexes = {
    preparedCandidates,
    byFilename: new Map(),
    byNamespaceFilename: new Map(),
    byLegacyNumber: new Map(),
    byNamespaceLegacyNumber: new Map(),
    bySize: new Map(),
    byDimensions: new Map(),
    byMimeType: new Map()
  };

  preparedCandidates.forEach((preparedCandidate) => {
    preparedCandidate.provenanceSignals.comparableFilenameKeys.forEach((filenameKey) => {
      pushIndexedCandidate(indexes.byFilename, filenameKey, preparedCandidate);
    });
    preparedCandidate.provenanceSignals.namespaceFilenameKeys.forEach((namespaceFilenameKey) => {
      pushIndexedCandidate(indexes.byNamespaceFilename, namespaceFilenameKey, preparedCandidate);
    });
    preparedCandidate.provenanceSignals.legacyNumberKeys.forEach((legacyNumberKey) => {
      pushIndexedCandidate(indexes.byLegacyNumber, legacyNumberKey, preparedCandidate);
    });
    preparedCandidate.provenanceSignals.namespaceLegacyNumberKeys.forEach((namespaceLegacyNumberKey) => {
      pushIndexedCandidate(indexes.byNamespaceLegacyNumber, namespaceLegacyNumberKey, preparedCandidate);
    });
    pushIndexedCandidate(indexes.bySize, preparedCandidate.supportKeys.sizeKey, preparedCandidate);
    pushIndexedCandidate(indexes.byDimensions, preparedCandidate.supportKeys.dimensionKey, preparedCandidate);
    pushIndexedCandidate(indexes.byMimeType, preparedCandidate.supportKeys.mimeTypeKey, preparedCandidate);
  });

  return indexes;
}

function collectCandidateUnion(preparedItem, candidateIndex, options = {}) {
  const candidatesById = new Map();
  const includeSizeIndex = options.includeSizeIndex !== false;
  const includeMimeIndex = options.includeMimeIndex !== false;
  const includeDimensionIndex = options.includeDimensionIndex !== false;
  const pushCandidates = (entries) => {
    (Array.isArray(entries) ? entries : []).forEach((preparedCandidate) => {
      const candidateId = normalizeText(preparedCandidate?.candidate?.id);

      if (candidateId) {
        candidatesById.set(candidateId, preparedCandidate);
      }
    });
  };

  preparedItem.provenanceSignals.comparableFilenameKeys.forEach((filenameKey) => {
    pushCandidates(candidateIndex.byFilename.get(filenameKey));
  });
  preparedItem.provenanceSignals.namespaceFilenameKeys.forEach((namespaceFilenameKey) => {
    pushCandidates(candidateIndex.byNamespaceFilename.get(namespaceFilenameKey));
  });
  preparedItem.provenanceSignals.legacyNumberKeys.forEach((legacyNumberKey) => {
    pushCandidates(candidateIndex.byLegacyNumber.get(legacyNumberKey));
  });
  preparedItem.provenanceSignals.namespaceLegacyNumberKeys.forEach((namespaceLegacyNumberKey) => {
    pushCandidates(candidateIndex.byNamespaceLegacyNumber.get(namespaceLegacyNumberKey));
  });

  if (includeSizeIndex) {
    pushCandidates(candidateIndex.bySize.get(preparedItem.supportKeys.sizeKey));
  }

  if (includeDimensionIndex) {
    pushCandidates(candidateIndex.byDimensions.get(preparedItem.supportKeys.dimensionKey));
  }

  if (includeMimeIndex) {
    pushCandidates(candidateIndex.byMimeType.get(preparedItem.supportKeys.mimeTypeKey));
  }

  return [...candidatesById.values()];
}

export function createOriginalRecoveryCandidateRecord(scanEntry, originalAsset = {}) {
  const candidateId = normalizeText(scanEntry?.id);

  if (!candidateId) {
    throw new Error("Original recovery candidate is missing an id.");
  }

  const file = scanEntry?.file;

  return {
    id: candidateId,
    sourceLabel: normalizeText(scanEntry?.sourceLabel),
    relativePath: normalizeText(scanEntry?.relativePath),
    lookupStrategy: normalizeText(scanEntry?.lookupStrategy) || "scan",
    fileName: normalizeText(file?.name) || normalizeText(originalAsset?.originalFilename),
    sourceFileSize: normalizeNumber(file?.size) || normalizeNumber(originalAsset?.fileSize),
    sourceImageWidth: normalizeNumber(originalAsset?.width),
    sourceImageHeight: normalizeNumber(originalAsset?.height),
    sourceLastModified: normalizeNumber(file?.lastModified),
    mimeType: normalizeText(file?.type) || normalizeText(originalAsset?.mimeType),
    fingerprint: ""
  };
}

function createCandidateMatchRecord(item, candidate) {
  const match = getSourceProvenanceMatchDetails(item, buildComparableCandidate(candidate));

  return {
    ...candidate,
    fingerprint: createCandidateFingerprint(candidate),
    match,
    reasons: buildMatchReasons(match)
  };
}

function createPreparedCandidateMatchRecord(preparedItem, preparedCandidate) {
  const match = getSourceProvenanceMatchDetails(
    preparedItem.comparableRecord,
    preparedCandidate.comparableRecord,
    {
      recordSignals: preparedItem.provenanceSignals,
      candidateSignals: preparedCandidate.provenanceSignals
    }
  );

  return {
    ...preparedCandidate.candidate,
    fingerprint: createCandidateFingerprint(preparedCandidate.candidate),
    match,
    reasons: buildMatchReasons(match)
  };
}

function selectPreviousCandidate(previousMatch, nextCandidates) {
  const previousCandidateId = normalizeText(previousMatch?.selectedCandidateId);

  if (!previousCandidateId) {
    return "";
  }

  return nextCandidates.some((candidate) => candidate.id === previousCandidateId) ? previousCandidateId : "";
}

function selectDefaultCandidate(nextCandidates, outcome) {
  if (!nextCandidates.length) {
    return "";
  }

  if (outcome === "exact_single" || outcome === "strong_single" || outcome === "possible_single" || outcome === "weak_only") {
    return nextCandidates[0].id;
  }

  return "";
}

function deriveNextDecision(previousMatch, item, candidateMatches, outcome, selectedCandidateId) {
  const previousDecision = normalizeText(previousMatch?.decision);
  const candidateStillExists = Boolean(selectedCandidateId);

  if (previousDecision === "accepted" && !candidateStillExists) {
    return "needs_rescan";
  }

  if (previousDecision === "accepted" || previousDecision === "rejected" || previousDecision === "skipped") {
    return previousDecision;
  }

  if (previousDecision === "needs_rescan") {
    return candidateStillExists ? "undecided" : "needs_rescan";
  }

  if ((outcome === "exact_single" || outcome === "strong_single") && selectedCandidateId) {
    return "accepted";
  }

  if (selectedCandidateId && isSafeLegacyReadyPossibleSingle(item, candidateMatches, outcome)) {
    return "accepted";
  }

  if (selectedCandidateId && isSafeVintageReadyWeakSingle(item, candidateMatches, outcome)) {
    return "accepted";
  }

  return "undecided";
}

function summarizeMatches(matches, scannedFileCount) {
  const outcomeCounts = {};
  const decisionCounts = {};
  let eligibleItemCount = 0;
  let excludedItemCount = 0;
  let approvedCount = 0;
  let unresolvedCount = 0;
  let recoveredCount = 0;
  let failedCount = 0;
  let needsRescanCount = 0;

  matches.forEach((match) => {
    outcomeCounts[match.outcome] = (outcomeCounts[match.outcome] ?? 0) + 1;
    decisionCounts[match.decision] = (decisionCounts[match.decision] ?? 0) + 1;

    if (match.outcome === "excluded") {
      excludedItemCount += 1;
    } else {
      eligibleItemCount += 1;
    }

    if (match.decision === "accepted") {
      approvedCount += 1;
    }

    if (match.decision === "needs_rescan") {
      needsRescanCount += 1;
      unresolvedCount += 1;
    } else if (match.outcome !== "excluded" && match.decision !== "accepted" && match.decision !== "rejected" && match.decision !== "skipped") {
      unresolvedCount += 1;
    }

    if (match.applyResult?.status === "recovered") {
      recoveredCount += 1;
    } else if (match.applyResult?.status === "failed") {
      failedCount += 1;
    }
  });

  return {
    itemCount: matches.length,
    eligibleItemCount,
    excludedItemCount,
    scannedFileCount: normalizeNumber(scannedFileCount),
    approvedCount,
    unresolvedCount,
    recoveredCount,
    failedCount,
    needsRescanCount,
    outcomeCounts,
    decisionCounts
  };
}

function createExcludedMatchRecord(item) {
  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name) || normalizeText(item?.sourceOriginalFilename),
    outcome: "excluded",
    decision: "skipped",
    exclusionReason: item?.originalPreserved ? "already_linked" : "ineligible",
    relinkStatus: normalizeText(item?.relinkStatus),
    selectedCandidateId: "",
    recoveryStrategy: "",
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
    knownOriginalRelativePath: normalizeKnownOriginalRelativePath(item?.knownOriginalRelativePath),
    sourceOriginalFilename: normalizeText(item?.sourceOriginalFilename),
    sourceFilenameAliases: normalizeStringArray(item?.sourceFilenameAliases),
    sourceFileSize: normalizeNumber(item?.sourceFileSize),
    sourceImageWidth: normalizeNumber(item?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(item?.sourceImageHeight),
    sourceLastModified: normalizeNumber(item?.sourceLastModified),
    mimeType: normalizeText(item?.mimeType),
    candidates: [],
    applyResult: null
  };
}

function createMatchRecord(item, candidates, previousMatch = null) {
  const candidateMatches = candidates
    .map((candidate) => createCandidateMatchRecord(item, candidate))
    .filter((candidate) => candidate.match.classification !== "none")
    .sort(sortCandidateMatches);
  const topClassification = candidateMatches[0]?.match?.classification ?? "none";
  const topClassificationRank = MATCH_PRIORITY[topClassification] ?? 0;
  const topRankCandidates = candidateMatches.filter(
    (candidate) => (MATCH_PRIORITY[candidate.match.classification] ?? 0) === topClassificationRank
  );
  const outcome = createOutcomeFromRank(topClassification, topRankCandidates.length);
  const selectedCandidateId =
    selectPreviousCandidate(previousMatch, candidateMatches) || selectDefaultCandidate(candidateMatches, outcome);
  const decision = deriveNextDecision(previousMatch, item, candidateMatches, outcome, selectedCandidateId);

  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name) || normalizeText(item?.sourceOriginalFilename),
    outcome,
    decision,
    exclusionReason: "",
    relinkStatus: normalizeText(item?.relinkStatus),
    selectedCandidateId,
    recoveryStrategy: "",
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
    knownOriginalRelativePath: normalizeKnownOriginalRelativePath(item?.knownOriginalRelativePath),
    sourceOriginalFilename: normalizeText(item?.sourceOriginalFilename),
    sourceFilenameAliases: normalizeStringArray(item?.sourceFilenameAliases),
    sourceFileSize: normalizeNumber(item?.sourceFileSize),
    sourceImageWidth: normalizeNumber(item?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(item?.sourceImageHeight),
    sourceLastModified: normalizeNumber(item?.sourceLastModified),
    mimeType: normalizeText(item?.mimeType),
    candidates: candidateMatches,
    applyResult: previousMatch?.applyResult ?? null
  };
}

function createIndexedMatchRecord(item, preparedItem, candidateIndex, previousMatch = null, options = {}) {
  const candidateMatches = collectCandidateUnion(preparedItem, candidateIndex, options)
    .map((preparedCandidate) => createPreparedCandidateMatchRecord(preparedItem, preparedCandidate))
    .filter((candidate) => candidate.match.classification !== "none")
    .sort(sortCandidateMatches);
  const topClassification = candidateMatches[0]?.match?.classification ?? "none";
  const topClassificationRank = MATCH_PRIORITY[topClassification] ?? 0;
  const topRankCandidates = candidateMatches.filter(
    (candidate) => (MATCH_PRIORITY[candidate.match.classification] ?? 0) === topClassificationRank
  );
  const outcome = createOutcomeFromRank(topClassification, topRankCandidates.length);
  const selectedCandidateId =
    selectPreviousCandidate(previousMatch, candidateMatches) || selectDefaultCandidate(candidateMatches, outcome);
  const decision = deriveNextDecision(previousMatch, item, candidateMatches, outcome, selectedCandidateId);

  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name) || normalizeText(item?.sourceOriginalFilename),
    outcome,
    decision,
    exclusionReason: "",
    relinkStatus: normalizeText(item?.relinkStatus),
    selectedCandidateId,
    recoveryStrategy: "",
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
    knownOriginalRelativePath: normalizeKnownOriginalRelativePath(item?.knownOriginalRelativePath),
    sourceOriginalFilename: normalizeText(item?.sourceOriginalFilename),
    sourceFilenameAliases: normalizeStringArray(item?.sourceFilenameAliases),
    sourceFileSize: normalizeNumber(item?.sourceFileSize),
    sourceImageWidth: normalizeNumber(item?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(item?.sourceImageHeight),
    sourceLastModified: normalizeNumber(item?.sourceLastModified),
    mimeType: normalizeText(item?.mimeType),
    candidates: candidateMatches,
    applyResult: previousMatch?.applyResult ?? null
  };
}
export function collectOriginalRecoveryPlausibleCandidateIds(items = [], candidates = []) {
  const candidateIndex = buildPreparedCandidateIndex(candidates);
  const plausibleCandidateIds = new Set();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!normalizeText(item?.id) || item?.originalPreserved || !normalizeText(item?.itemUuid)) {
      return;
    }

    const preparedItem = createPreparedItem(item);
    const candidateUnion = collectCandidateUnion(preparedItem, candidateIndex, {
      includeSizeIndex: false,
      includeMimeIndex: false,
      includeDimensionIndex: false
    });

    candidateUnion.forEach((preparedCandidate) => {
      const candidateId = normalizeText(preparedCandidate?.candidate?.id);

      if (candidateId) {
        plausibleCandidateIds.add(candidateId);
      }
    });
  });

  return plausibleCandidateIds;
}

export function buildOriginalRecoverySessionExhaustive({
  sessionId = "",
  app = "mba",
  sourceLabel = "",
  items = [],
  candidates = [],
  previousSession = null,
  now = new Date().toISOString(),
  scannedFileCount = null
} = {}) {
  const previousMatchesByItemId = new Map(
    (Array.isArray(previousSession?.matches) ? previousSession.matches : [])
      .filter((match) => normalizeText(match?.itemId))
      .map((match) => [normalizeText(match.itemId), match])
  );
  const matches = (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!normalizeText(item?.id)) {
        return null;
      }

      if (item?.originalPreserved || !normalizeText(item?.itemUuid)) {
        return createExcludedMatchRecord(item);
      }

      return createMatchRecord(item, candidates, previousMatchesByItemId.get(normalizeText(item.id)));
    })
    .filter(Boolean)
    .sort((left, right) => normalizeText(left.itemName || left.itemId).localeCompare(normalizeText(right.itemName || right.itemId)));
  const summary = summarizeMatches(matches, scannedFileCount ?? candidates.length);

  return {
    id: normalizeText(sessionId) || normalizeText(previousSession?.id) || `original_recovery_${Date.now()}`,
    app: normalizeText(app) || normalizeText(previousSession?.app) || "mba",
    sourceLabel: normalizeText(sourceLabel) || normalizeText(previousSession?.sourceLabel),
    createdAt: normalizeText(previousSession?.createdAt) || now,
    updatedAt: now,
    status: "scanned",
    summary,
    matches
  };
}

export function buildOriginalRecoverySession({
  sessionId = "",
  app = "mba",
  sourceLabel = "",
  items = [],
  candidates = [],
  previousSession = null,
  now = new Date().toISOString(),
  scannedFileCount = null
} = {}) {
  const previousMatchesByItemId = new Map(
    (Array.isArray(previousSession?.matches) ? previousSession.matches : [])
      .filter((match) => normalizeText(match?.itemId))
      .map((match) => [normalizeText(match.itemId), match])
  );
  const candidateIndex = buildPreparedCandidateIndex(candidates);
  const matches = (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!normalizeText(item?.id)) {
        return null;
      }

      if (item?.originalPreserved || !normalizeText(item?.itemUuid)) {
        return createExcludedMatchRecord(item);
      }

      return createIndexedMatchRecord(
        item,
        createPreparedItem(item),
        candidateIndex,
        previousMatchesByItemId.get(normalizeText(item.id)),
        {
          includeSizeIndex: false,
          includeMimeIndex: false,
          includeDimensionIndex: false
        }
      );
    })
    .filter(Boolean)
    .sort((left, right) => normalizeText(left.itemName || left.itemId).localeCompare(normalizeText(right.itemName || right.itemId)));
  const summary = summarizeMatches(matches, scannedFileCount ?? candidates.length);

  return {
    id: normalizeText(sessionId) || normalizeText(previousSession?.id) || `original_recovery_${Date.now()}`,
    app: normalizeText(app) || normalizeText(previousSession?.app) || "mba",
    sourceLabel: normalizeText(sourceLabel) || normalizeText(previousSession?.sourceLabel),
    createdAt: normalizeText(previousSession?.createdAt) || now,
    updatedAt: now,
    status: "scanned",
    summary,
    matches
  };
}

export function updateOriginalRecoveryMatchDecision(session, itemId, decision) {
  const normalizedItemId = normalizeText(itemId);
  const normalizedDecision = normalizeText(decision);

  if (!normalizedItemId || !normalizedDecision) {
    return session;
  }

  const nextMatches = (Array.isArray(session?.matches) ? session.matches : []).map((match) =>
    match.itemId === normalizedItemId
      ? {
          ...match,
          decision: normalizedDecision
        }
      : match
  );

  return {
    ...session,
    status: "reviewed",
    updatedAt: new Date().toISOString(),
    matches: nextMatches,
    summary: summarizeMatches(nextMatches, session?.summary?.scannedFileCount)
  };
}

export function selectOriginalRecoveryCandidate(session, itemId, candidateId) {
  const normalizedItemId = normalizeText(itemId);
  const normalizedCandidateId = normalizeText(candidateId);

  if (!normalizedItemId) {
    return session;
  }

  const nextMatches = (Array.isArray(session?.matches) ? session.matches : []).map((match) => {
    if (match.itemId !== normalizedItemId) {
      return match;
    }

    const selectedCandidate = (Array.isArray(match.candidates) ? match.candidates : []).find(
      (candidate) => candidate.id === normalizedCandidateId
    );

    return {
      ...match,
      selectedCandidateId: selectedCandidate ? selectedCandidate.id : "",
      decision:
        match.decision === "needs_rescan" && selectedCandidate
          ? "undecided"
          : match.decision
    };
  });

  return {
    ...session,
    status: "reviewed",
    updatedAt: new Date().toISOString(),
    matches: nextMatches,
    summary: summarizeMatches(nextMatches, session?.summary?.scannedFileCount)
  };
}

export function mergeOriginalRecoveryApplyResults(session, applyResults = [], options = {}) {
  const resultsByItemId = new Map(
    (Array.isArray(applyResults) ? applyResults : [])
      .filter((result) => normalizeText(result?.itemId))
      .map((result) => [normalizeText(result.itemId), result])
  );
  const nextMatches = (Array.isArray(session?.matches) ? session.matches : []).map((match) => {
    const nextResult = resultsByItemId.get(match.itemId);

    if (!nextResult) {
      return match;
    }

    return {
      ...match,
      decision: nextResult.decision ? normalizeText(nextResult.decision) : match.decision,
      applyResult: {
        status: normalizeText(nextResult.status),
        message: normalizeText(nextResult.message),
        appliedAt: normalizeText(nextResult.appliedAt)
      }
    };
  });
  const failedCount = nextMatches.filter((match) => match.applyResult?.status === "failed").length;

  return {
    ...session,
    status: failedCount ? "completed_with_errors" : "completed",
    updatedAt: normalizeText(options.updatedAt) || new Date().toISOString(),
    matches: nextMatches,
    summary: summarizeMatches(nextMatches, session?.summary?.scannedFileCount)
  };
}

export function getApprovedOriginalRecoveryMatches(session) {
  return (Array.isArray(session?.matches) ? session.matches : []).filter((match) => match.decision === "accepted");
}

export function createOriginalRecoveryReport(session) {
  return JSON.parse(JSON.stringify(session ?? null));
}

export function refreshOriginalRecoverySession(session, options = {}) {
  const nextMatches = Array.isArray(session?.matches) ? session.matches : [];

  return {
    ...session,
    status: normalizeText(options.status) || session?.status || "reviewed",
    updatedAt: normalizeText(options.updatedAt) || new Date().toISOString(),
    summary: summarizeMatches(nextMatches, session?.summary?.scannedFileCount),
    matches: nextMatches
  };
}

export function createDirectPathRecoveryCandidate(item, fileMetadata = {}, options = {}) {
  const normalizedRelativePath = normalizeKnownOriginalRelativePath(
    options.relativePath || item?.knownOriginalRelativePath
  );
  const basename = normalizedRelativePath.split("/").filter(Boolean).at(-1) ?? "";

  return {
    id: normalizeText(options.id) || `direct_path_${normalizeText(item?.id)}`,
    sourceLabel: normalizeText(options.sourceLabel),
    relativePath: normalizedRelativePath,
    lookupStrategy: options.lookupStrategy === "exact_path" ? "exact_path" : "direct_path",
    fileName: normalizeText(fileMetadata?.name) || basename,
    sourceFileSize: normalizeNumber(fileMetadata?.size),
    sourceImageWidth: normalizeNumber(item?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(item?.sourceImageHeight),
    sourceLastModified: normalizeNumber(fileMetadata?.lastModified),
    mimeType: normalizeText(fileMetadata?.type) || normalizeText(item?.mimeType),
    fingerprint: ""
  };
}

export function createDirectPathMatchRecord(item, candidate, previousMatch = null) {
  const candidateMatch = createCandidateMatchRecord(item, candidate);
  const outcome = candidate.lookupStrategy === "exact_path" ? "exact_single" : "strong_single";

  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name) || normalizeText(item?.sourceOriginalFilename),
    outcome,
    decision: "accepted",
    exclusionReason: "",
    relinkStatus: normalizeText(item?.relinkStatus),
    selectedCandidateId: candidate.id,
    recoveryStrategy: normalizeText(candidate.lookupStrategy) || "direct_path",
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
    knownOriginalRelativePath: normalizeKnownOriginalRelativePath(item?.knownOriginalRelativePath),
    sourceOriginalFilename: normalizeText(item?.sourceOriginalFilename),
    sourceFilenameAliases: normalizeStringArray(item?.sourceFilenameAliases),
    sourceFileSize: normalizeNumber(item?.sourceFileSize),
    sourceImageWidth: normalizeNumber(item?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(item?.sourceImageHeight),
    sourceLastModified: normalizeNumber(item?.sourceLastModified),
    mimeType: normalizeText(item?.mimeType),
    candidates: [candidateMatch],
    applyResult: previousMatch?.applyResult ?? null
  };
}
