import { normalizeSourceFilenameAliases } from "./itemIdentity.js";
import { getSourceProvenanceMatchDetails } from "./sourceProvenanceMatching.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
}

function normalizeTimestamp(value) {
  const numericValue = normalizeNumber(value);

  if (numericValue) {
    return numericValue;
  }

  if (typeof value === "string") {
    const parsedValue = Date.parse(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
  }

  return 0;
}

export function createOriginalReconnectionCandidate(file, originalAsset = {}) {
  return {
    sourceOriginalFilename: normalizeText(file?.name) || normalizeText(originalAsset?.originalFilename),
    sourceFilenameAliases: [],
    sourceFileSize: normalizeNumber(file?.size) || normalizeNumber(originalAsset?.fileSize),
    sourceImageWidth: normalizeNumber(originalAsset?.width),
    sourceImageHeight: normalizeNumber(originalAsset?.height),
    sourceLastModified: normalizeTimestamp(file?.lastModified),
    mimeType: normalizeText(file?.type) || normalizeText(originalAsset?.mimeType)
  };
}

export function buildOriginalReconnectionReview(item = {}, file, originalAsset = {}) {
  const candidate = createOriginalReconnectionCandidate(file, originalAsset);
  const match = getSourceProvenanceMatchDetails(item, candidate);
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

  return {
    candidate,
    match,
    reasons,
    canConfirm: match.classification !== "none",
    requiresExplicitOverride: match.classification === "weak"
  };
}

export function classifyOriginalAvailability(item = {}, options = {}) {
  const normalizedRelinkStatus = normalizeText(item?.relinkStatus).toLowerCase();
  const hasStoredOriginal = Boolean(options.hasStoredOriginal);

  if (item?.originalPreserved) {
    return hasStoredOriginal ? "preserved" : "missing";
  }

  if (normalizedRelinkStatus === "missing") {
    return "missing";
  }

  return "attention";
}

export function appendOriginalReconnectionAlias(item = {}, filename = "") {
  const normalizedFilename = normalizeText(filename);

  if (!normalizedFilename) {
    return Array.isArray(item?.sourceFilenameAliases) ? item.sourceFilenameAliases : [];
  }

  return normalizeSourceFilenameAliases([
    ...(Array.isArray(item?.sourceFilenameAliases) ? item.sourceFilenameAliases : []),
    normalizedFilename
  ], {
    excludedValues: [normalizeText(item?.sourceOriginalFilename)]
  });
}
