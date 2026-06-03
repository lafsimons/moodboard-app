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

const LEGACY_SOURCE_NAMESPACES = new Set(["vintage", "moodboard", "wishlist"]);
const LEGACY_NUMBERED_IMAGE_PATTERN = /^images-(\d+)(\.[a-z0-9]+)?$/i;

export function normalizeComparableFilename(value) {
  return normalizeText(value).replace(/\\/g, "/").toLowerCase();
}

function getNormalizedLegacyNumberKey(value) {
  const parsedNamespacedFilename = parseLegacyNamespacedFilename(value);

  if (parsedNamespacedFilename) {
    return `images-${parsedNamespacedFilename.number}${parsedNamespacedFilename.extension}`.toLowerCase();
  }

  const parsedNumberedFilename = parseLegacyNumberedFilename(value);

  if (!parsedNumberedFilename) {
    return "";
  }

  return `images-${parsedNumberedFilename.number}${parsedNumberedFilename.extension}`.toLowerCase();
}

function getPathSegments(value) {
  return normalizeComparableFilename(value)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getBasename(value) {
  const segments = getPathSegments(value);
  return segments[segments.length - 1] ?? "";
}

function parseLegacyNamespacedFilename(value) {
  const basename = getBasename(value);
  const match = basename.match(/^(vintage|moodboard|wishlist)-images-(\d+)(\.[a-z0-9]+)?$/i);

  if (!match) {
    return null;
  }

  return {
    namespace: match[1].toLowerCase(),
    number: match[2],
    extension: match[3] || ""
  };
}

function parseLegacyNumberedFilename(value) {
  const basename = getBasename(value);
  const match = basename.match(LEGACY_NUMBERED_IMAGE_PATTERN);

  if (!match) {
    return null;
  }

  return {
    number: match[1],
    extension: match[2] || ""
  };
}

function collectSourceNamespacesSet(record = {}) {
  const namespaces = new Set();
  const pushNamespace = (value) => {
    const normalizedValue = normalizeComparableFilename(value);

    if (LEGACY_SOURCE_NAMESPACES.has(normalizedValue)) {
      namespaces.add(normalizedValue);
    }
  };
  const pushFromValue = (value) => {
    const segments = getPathSegments(value);

    segments.forEach((segment) => {
      pushNamespace(segment);
      const namespacedFilename = parseLegacyNamespacedFilename(segment);

      if (namespacedFilename?.namespace) {
        pushNamespace(namespacedFilename.namespace);
      }
    });
  };

  pushFromValue(record?.sourceRelativePath);
  pushFromValue(record?.relativePath);
  pushFromValue(record?.sourceOriginalFilename);
  pushFromValue(record?.originalFilename);
  pushFromValue(record?.images?.preview?.originalFilename);
  (Array.isArray(record?.sourceFilenameAliases) ? record.sourceFilenameAliases : []).forEach(pushFromValue);

  return namespaces;
}

function buildLegacyNamespaceAliases(value, namespaces) {
  const numberedFilename = parseLegacyNumberedFilename(value);

  if (!numberedFilename || !namespaces.size) {
    return [];
  }

  const basename = `images-${numberedFilename.number}${numberedFilename.extension}`;

  return [...namespaces].flatMap((namespace) => [`${namespace}/${basename}`, `${namespace}-${basename}`]);
}

function hasSharedNamespace(leftNamespaces, rightNamespaces) {
  for (const namespace of leftNamespaces) {
    if (rightNamespaces.has(namespace)) {
      return true;
    }
  }

  return false;
}

export function collectSourceNamespaces(record = {}) {
  return [...collectSourceNamespacesSet(record)];
}

export function collectSourceFilenameCandidates(record = {}) {
  const seen = new Set();
  const candidates = [];
  const namespaces = collectSourceNamespacesSet(record);
  const pushCandidate = (value) => {
    const normalizedValue = normalizeText(value);
    const candidateKey = normalizeComparableFilename(normalizedValue);

    if (!candidateKey || seen.has(candidateKey)) {
      return;
    }

    seen.add(candidateKey);
    candidates.push(normalizedValue);
  };
  const pushWithLegacyAliases = (value) => {
    pushCandidate(value);
    buildLegacyNamespaceAliases(value, namespaces).forEach(pushCandidate);
  };

  pushWithLegacyAliases(record?.sourceOriginalFilename);
  pushWithLegacyAliases(record?.originalFilename);
  pushWithLegacyAliases(record?.images?.preview?.originalFilename);
  pushCandidate(record?.sourceRelativePath);
  pushCandidate(record?.relativePath);
  (Array.isArray(record?.sourceFilenameAliases) ? record.sourceFilenameAliases : []).forEach(pushWithLegacyAliases);

  return candidates;
}

export function collectComparableFilenameKeys(record = {}) {
  return collectSourceFilenameCandidates(record).map(normalizeComparableFilename).filter(Boolean);
}

export function buildSourceProvenanceSignals(record = {}) {
  const comparableFilenameKeys = collectComparableFilenameKeys(record);
  const namespaces = collectSourceNamespaces(record);
  const legacyNumberKeys = [];
  const namespaceFilenameKeys = [];
  const namespaceLegacyNumberKeys = [];
  const seenLegacyNumberKeys = new Set();
  const seenNamespaceFilenameKeys = new Set();
  const seenNamespaceLegacyNumberKeys = new Set();

  comparableFilenameKeys.forEach((filenameKey) => {
    const legacyNumberKey = getNormalizedLegacyNumberKey(filenameKey);

    if (legacyNumberKey && !seenLegacyNumberKeys.has(legacyNumberKey)) {
      seenLegacyNumberKeys.add(legacyNumberKey);
      legacyNumberKeys.push(legacyNumberKey);
    }

    namespaces.forEach((namespace) => {
      const namespaceFilenameKey = `${namespace}|${filenameKey}`;

      if (!seenNamespaceFilenameKeys.has(namespaceFilenameKey)) {
        seenNamespaceFilenameKeys.add(namespaceFilenameKey);
        namespaceFilenameKeys.push(namespaceFilenameKey);
      }

      if (!legacyNumberKey) {
        return;
      }

      const namespaceLegacyNumberKey = `${namespace}|${legacyNumberKey}`;

      if (!seenNamespaceLegacyNumberKeys.has(namespaceLegacyNumberKey)) {
        seenNamespaceLegacyNumberKeys.add(namespaceLegacyNumberKey);
        namespaceLegacyNumberKeys.push(namespaceLegacyNumberKey);
      }
    });
  });

  return {
    comparableFilenameKeys,
    comparableFilenameKeySet: new Set(comparableFilenameKeys),
    namespaces,
    namespaceSet: new Set(namespaces),
    legacyNumberKeys,
    legacyNumberKeySet: new Set(legacyNumberKeys),
    namespaceFilenameKeys,
    namespaceLegacyNumberKeys
  };
}

function hasSharedFilename(record, candidate) {
  return hasSharedFilenameFromSignals(
    buildSourceProvenanceSignals(record),
    buildSourceProvenanceSignals(candidate)
  );
}

function hasSharedFilenameFromSignals(leftSignals, rightSignals) {
  for (const entry of leftSignals.comparableFilenameKeys) {
    if (!rightSignals.comparableFilenameKeySet.has(entry)) {
      continue;
    }

    if (!LEGACY_NUMBERED_IMAGE_PATTERN.test(getBasename(entry))) {
      return true;
    }

    if (
      leftSignals.namespaceSet.size
      && rightSignals.namespaceSet.size
      && hasSharedNamespace(leftSignals.namespaceSet, rightSignals.namespaceSet)
    ) {
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

export function createSourceProvenanceComparableRecord(record = {}) {
  return {
    sourceRelativePath: normalizeText(record?.sourceRelativePath),
    relativePath: normalizeText(record?.relativePath),
    sourceOriginalFilename: normalizeText(record?.sourceOriginalFilename),
    originalFilename: normalizeText(record?.originalFilename),
    sourceFilenameAliases: Array.isArray(record?.sourceFilenameAliases) ? record.sourceFilenameAliases : [],
    sourceFileSize: normalizeNumber(record?.sourceFileSize),
    sourceImageWidth: normalizeNumber(record?.sourceImageWidth),
    sourceImageHeight: normalizeNumber(record?.sourceImageHeight),
    sourceLastModified: normalizeNumber(record?.sourceLastModified),
    mimeType: normalizeMimeType(record?.mimeType),
    images: record?.images
  };
}

export function getSourceProvenanceMatchDetails(record = {}, candidate = {}, options = {}) {
  const recordSignals = options.recordSignals ?? buildSourceProvenanceSignals(record);
  const candidateSignals = options.candidateSignals ?? buildSourceProvenanceSignals(candidate);
  const filenameMatch = hasSharedFilenameFromSignals(recordSignals, candidateSignals);
  const sizeMatch = hasExactSizeMatch(record, candidate);
  const dimensionMatch = hasExactDimensionMatch(record, candidate);
  const lastModifiedMatch = hasExactLastModifiedMatch(record, candidate);
  const mimeTypeMatch = hasExactMimeTypeMatch(record, candidate);
  const supportingMatches = [sizeMatch, dimensionMatch, mimeTypeMatch].filter(Boolean).length;
  let classification = "none";

  if (filenameMatch && sizeMatch && dimensionMatch && lastModifiedMatch) {
    classification = "exact";
  } else if (filenameMatch && sizeMatch && dimensionMatch) {
    classification = "strong";
  } else if (filenameMatch && supportingMatches >= 1) {
    classification = "possible";
  } else if (filenameMatch || supportingMatches >= 2) {
    classification = "weak";
  }

  return {
    classification,
    filenameMatch,
    sizeMatch,
    dimensionMatch,
    lastModifiedMatch,
    mimeTypeMatch,
    supportingMatches
  };
}

export function classifySourceProvenanceMatch(record = {}, candidate = {}, options = {}) {
  return getSourceProvenanceMatchDetails(record, candidate, options).classification;
}
