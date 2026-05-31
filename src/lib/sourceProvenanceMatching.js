function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
}

function normalizeMimeType(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizeComparableFilename(value) {
  return normalizeText(value).toLowerCase();
}

export function collectSourceFilenameCandidates(record = {}) {
  const seen = new Set();
  const candidates = [];
  const pushCandidate = (value) => {
    const normalizedValue = normalizeText(value);
    const candidateKey = normalizeComparableFilename(normalizedValue);

    if (!candidateKey || seen.has(candidateKey)) {
      return;
    }

    seen.add(candidateKey);
    candidates.push(normalizedValue);
  };

  pushCandidate(record?.sourceOriginalFilename);
  pushCandidate(record?.originalFilename);
  pushCandidate(record?.images?.preview?.originalFilename);
  (Array.isArray(record?.sourceFilenameAliases) ? record.sourceFilenameAliases : []).forEach(pushCandidate);

  return candidates;
}

function collectComparableFilenameKeys(record = {}) {
  return new Set(collectSourceFilenameCandidates(record).map(normalizeComparableFilename).filter(Boolean));
}

function hasSharedFilename(record, candidate) {
  const left = collectComparableFilenameKeys(record);
  const right = collectComparableFilenameKeys(candidate);

  for (const entry of left) {
    if (right.has(entry)) {
      return true;
    }
  }

  return false;
}

function getComparableDimensions(record = {}) {
  return {
    width: normalizeNumber(record?.sourceImageWidth),
    height: normalizeNumber(record?.sourceImageHeight)
  };
}

function hasExactDimensionMatch(record, candidate) {
  const left = getComparableDimensions(record);
  const right = getComparableDimensions(candidate);

  return Boolean(left.width && left.height && left.width === right.width && left.height === right.height);
}

function hasExactSizeMatch(record, candidate) {
  const left = normalizeNumber(record?.sourceFileSize);
  const right = normalizeNumber(candidate?.sourceFileSize);
  return Boolean(left && right && left === right);
}

function hasExactLastModifiedMatch(record, candidate) {
  const left = normalizeNumber(record?.sourceLastModified);
  const right = normalizeNumber(candidate?.sourceLastModified);
  return Boolean(left && right && left === right);
}

function hasExactMimeTypeMatch(record, candidate) {
  const left = normalizeMimeType(record?.mimeType);
  const right = normalizeMimeType(candidate?.mimeType);
  return Boolean(left && right && left === right);
}

export function classifySourceProvenanceMatch(record = {}, candidate = {}) {
  const filenameMatch = hasSharedFilename(record, candidate);
  const sizeMatch = hasExactSizeMatch(record, candidate);
  const dimensionMatch = hasExactDimensionMatch(record, candidate);
  const lastModifiedMatch = hasExactLastModifiedMatch(record, candidate);
  const mimeTypeMatch = hasExactMimeTypeMatch(record, candidate);
  const supportingMatches = [sizeMatch, dimensionMatch, mimeTypeMatch].filter(Boolean).length;

  if (filenameMatch && sizeMatch && dimensionMatch && lastModifiedMatch) {
    return "exact";
  }

  if (filenameMatch && sizeMatch && dimensionMatch) {
    return "strong";
  }

  if (filenameMatch && supportingMatches >= 1) {
    return "possible";
  }

  if (filenameMatch || supportingMatches >= 2) {
    return "weak";
  }

  return "none";
}
