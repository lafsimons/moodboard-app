import { getSourceProvenanceMatchDetails } from "./sourceProvenanceMatching.js";

const MATCH_PRIORITY = {
  none: 0,
  weak: 1,
  possible: 2,
  strong: 3,
  exact: 4
};

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

function buildComparableCandidate(candidate) {
  return {
    sourceOriginalFilename: normalizeText(candidate.fileName),
    sourceRelativePath: normalizeText(candidate.relativePath),
    sourceFilenameAliases: [],
    sourceFileSize: normalizeNumber(candidate.sourceFileSize),
    sourceImageWidth: normalizeNumber(candidate.sourceImageWidth),
    sourceImageHeight: normalizeNumber(candidate.sourceImageHeight),
    sourceLastModified: normalizeNumber(candidate.sourceLastModified),
    mimeType: normalizeText(candidate.mimeType)
  };
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

  if (outcome === "exact_single" || outcome === "strong_single" || outcome === "possible_single") {
    return nextCandidates[0].id;
  }

  return "";
}

function deriveNextDecision(previousMatch, outcome, selectedCandidateId) {
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
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
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
  const decision = deriveNextDecision(previousMatch, outcome, selectedCandidateId);

  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name) || normalizeText(item?.sourceOriginalFilename),
    outcome,
    decision,
    exclusionReason: "",
    relinkStatus: normalizeText(item?.relinkStatus),
    selectedCandidateId,
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
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

export function buildOriginalRecoverySession({
  sessionId = "",
  app = "mba",
  sourceLabel = "",
  items = [],
  candidates = [],
  previousSession = null,
  now = new Date().toISOString()
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
  const summary = summarizeMatches(matches, candidates.length);

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
