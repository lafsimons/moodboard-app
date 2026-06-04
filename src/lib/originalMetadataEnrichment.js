import { normalizeSourceFilenameAliases } from "./itemIdentity.js";

const ENRICHABLE_FIELDS = [
  "sourceFileSize",
  "sourceImageWidth",
  "sourceImageHeight",
  "sourceLastModified",
  "mimeType",
  "sourceOriginalFilename",
  "sourceFilenameAliases",
  "knownOriginalRelativePath",
  "originalRelinkedFilename",
  "originalRelinkedRelativePath",
  "originalLinkedAt"
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
}

function normalizeTimestamp(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
}

function normalizeIsoTimestamp(value) {
  const normalizedValue = normalizeText(value);

  if (normalizedValue) {
    return normalizedValue;
  }

  const numericValue = normalizeTimestamp(value);
  return numericValue ? new Date(numericValue).toISOString() : "";
}

function buildRecoveryRelativePathIndex(recoverySessions = []) {
  const sortedSessions = (Array.isArray(recoverySessions) ? recoverySessions : [])
    .filter((session) => session && typeof session === "object")
    .sort((left, right) => Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0));
  const byItemId = new Map();

  sortedSessions.forEach((session) => {
    (Array.isArray(session.matches) ? session.matches : []).forEach((match) => {
      const itemId = normalizeText(match?.itemId);

      if (!itemId || byItemId.has(itemId)) {
        return;
      }

      const selectedCandidateId = normalizeText(match?.selectedCandidateId);
      const selectedCandidate = (Array.isArray(match?.candidates) ? match.candidates : []).find(
        (candidate) => normalizeText(candidate?.id) === selectedCandidateId
      );
      const relativePath = normalizeText(selectedCandidate?.relativePath);
      const appliedAt = normalizeText(match?.applyResult?.appliedAt);
      const appliedStatus = normalizeText(match?.applyResult?.status);

      if (appliedStatus !== "recovered" || (!relativePath && !appliedAt)) {
        return;
      }

      byItemId.set(itemId, {
        relativePath,
        appliedAt
      });
    });
  });

  return byItemId;
}

function buildOriginalEntryMetadata(entry = {}) {
  return {
    fileSize: normalizeNumber(entry?.fileSize),
    width: normalizeNumber(entry?.width),
    height: normalizeNumber(entry?.height),
    mimeType: normalizeText(entry?.mimeType),
    originalFilename: normalizeText(entry?.originalFilename),
    lastModified: normalizeTimestamp(entry?.lastModified || entry?.sourceLastModified),
    savedAt: normalizeTimestamp(entry?.savedAt)
  };
}

function buildOriginalLinkedAtValue(item, recoveryHint, originalEntryMetadata) {
  if (normalizeText(item?.originalLinkedAt)) {
    return "";
  }

  return normalizeIsoTimestamp(recoveryHint?.appliedAt) || normalizeIsoTimestamp(originalEntryMetadata.savedAt);
}

function buildUpdatedAliases(item, nextSourceOriginalFilename, originalFilename) {
  const aliasCandidate = normalizeText(originalFilename);

  return normalizeSourceFilenameAliases([
    ...(Array.isArray(item?.sourceFilenameAliases) ? item.sourceFilenameAliases : []),
    aliasCandidate
  ], {
    excludedValues: [normalizeText(nextSourceOriginalFilename)]
  });
}

function createSkippedResult(item, reason) {
  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name),
    status: "skipped",
    reason,
    changedFields: [],
    nextItem: null,
    preview: null
  };
}

export function buildLinkedOriginalMetadataEnrichmentResult(item = {}, originalEntry = null, recoveryHint = null) {
  if (!item?.originalPreserved) {
    return createSkippedResult(item, "not_linked");
  }

  if (!normalizeText(item?.itemUuid) || !originalEntry) {
    return createSkippedResult(item, "missing_original_blob");
  }

  const originalEntryMetadata = buildOriginalEntryMetadata(originalEntry);
  const nextItem = {
    ...item
  };
  const changedFields = [];

  if (!normalizeNumber(item?.sourceFileSize) && originalEntryMetadata.fileSize) {
    nextItem.sourceFileSize = originalEntryMetadata.fileSize;
    changedFields.push("sourceFileSize");
  }

  if (!normalizeNumber(item?.sourceImageWidth) && originalEntryMetadata.width) {
    nextItem.sourceImageWidth = originalEntryMetadata.width;
    changedFields.push("sourceImageWidth");
  }

  if (!normalizeNumber(item?.sourceImageHeight) && originalEntryMetadata.height) {
    nextItem.sourceImageHeight = originalEntryMetadata.height;
    changedFields.push("sourceImageHeight");
  }

  if (!normalizeTimestamp(item?.sourceLastModified) && originalEntryMetadata.lastModified) {
    nextItem.sourceLastModified = originalEntryMetadata.lastModified;
    changedFields.push("sourceLastModified");
  }

  if (!normalizeText(item?.mimeType) && originalEntryMetadata.mimeType) {
    nextItem.mimeType = originalEntryMetadata.mimeType;
    changedFields.push("mimeType");
  }

  const nextSourceOriginalFilename = normalizeText(item?.sourceOriginalFilename) || originalEntryMetadata.originalFilename;

  if (!normalizeText(item?.sourceOriginalFilename) && nextSourceOriginalFilename) {
    nextItem.sourceOriginalFilename = nextSourceOriginalFilename;
    changedFields.push("sourceOriginalFilename");
  }

  const nextAliases = buildUpdatedAliases(item, nextSourceOriginalFilename, originalEntryMetadata.originalFilename);
  const currentAliases = normalizeSourceFilenameAliases(item?.sourceFilenameAliases, {
    excludedValues: [nextSourceOriginalFilename]
  });

  if (JSON.stringify(nextAliases) !== JSON.stringify(currentAliases)) {
    nextItem.sourceFilenameAliases = nextAliases;
    changedFields.push("sourceFilenameAliases");
  }

  if (!normalizeText(item?.knownOriginalRelativePath) && normalizeText(recoveryHint?.relativePath)) {
    nextItem.knownOriginalRelativePath = normalizeText(recoveryHint?.relativePath);
    changedFields.push("knownOriginalRelativePath");
  }

  if (!normalizeText(item?.originalRelinkedFilename) && originalEntryMetadata.originalFilename) {
    nextItem.originalRelinkedFilename = originalEntryMetadata.originalFilename;
    changedFields.push("originalRelinkedFilename");
  }

  if (!normalizeText(item?.originalRelinkedRelativePath) && normalizeText(recoveryHint?.relativePath)) {
    nextItem.originalRelinkedRelativePath = normalizeText(recoveryHint?.relativePath);
    changedFields.push("originalRelinkedRelativePath");
  }

  const nextOriginalLinkedAt = buildOriginalLinkedAtValue(item, recoveryHint, originalEntryMetadata);

  if (nextOriginalLinkedAt) {
    nextItem.originalLinkedAt = nextOriginalLinkedAt;
    changedFields.push("originalLinkedAt");
  }

  if (!changedFields.length) {
    return createSkippedResult(item, "already_enriched");
  }

  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name),
    status: "update",
    reason: "",
    changedFields,
    nextItem,
    preview: {
      sourceFileSize: normalizeNumber(nextItem?.sourceFileSize),
      sourceImageWidth: normalizeNumber(nextItem?.sourceImageWidth),
      sourceImageHeight: normalizeNumber(nextItem?.sourceImageHeight),
      sourceLastModified: normalizeTimestamp(nextItem?.sourceLastModified),
      mimeType: normalizeText(nextItem?.mimeType),
      sourceOriginalFilename: normalizeText(nextItem?.sourceOriginalFilename),
      sourceFilenameAliases: Array.isArray(nextItem?.sourceFilenameAliases) ? nextItem.sourceFilenameAliases : [],
      knownOriginalRelativePath: normalizeText(nextItem?.knownOriginalRelativePath),
      originalRelinkedFilename: normalizeText(nextItem?.originalRelinkedFilename),
      originalRelinkedRelativePath: normalizeText(nextItem?.originalRelinkedRelativePath),
      originalLinkedAt: normalizeText(nextItem?.originalLinkedAt)
    }
  };
}

function createExample(result) {
  return {
    itemId: result.itemId,
    itemUuid: result.itemUuid,
    itemName: result.itemName,
    reason: result.reason,
    changedFields: result.changedFields,
    preview: result.preview
  };
}

export function createLinkedOriginalMetadataEnrichmentReport({
  items = [],
  originalEntriesByItemUuid = {},
  recoverySessions = [],
  exampleLimit = 20
} = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedExampleLimit = Math.max(1, Math.round(Number(exampleLimit) || 20));
  const recoveryHintsByItemId = buildRecoveryRelativePathIndex(recoverySessions);
  const results = normalizedItems
    .filter((item) => item?.originalPreserved)
    .map((item) => buildLinkedOriginalMetadataEnrichmentResult(
      item,
      originalEntriesByItemUuid?.[normalizeText(item?.itemUuid)] ?? null,
      recoveryHintsByItemId.get(normalizeText(item?.id)) ?? null
    ));
  const eligibleLinkedItems = results.filter((result) => result.reason !== "missing_original_blob");
  const updated = results.filter((result) => result.status === "update");
  const skipped = results.filter((result) => result.status === "skipped");
  const fieldCounts = Object.fromEntries(ENRICHABLE_FIELDS.map((field) => [field, 0]));

  updated.forEach((result) => {
    result.changedFields.forEach((field) => {
      fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
    });
  });

  return {
    totalItemCount: normalizedItems.length,
    linkedItemCount: normalizedItems.filter((item) => item?.originalPreserved).length,
    eligibleLinkedItemCount: eligibleLinkedItems.length,
    updatedItemCount: updated.length,
    skippedItemCount: skipped.length,
    fieldCounts,
    results,
    updatedItems: updated.map((result) => result.nextItem).filter(Boolean),
    changedItemIds: updated.map((result) => result.itemId).filter(Boolean),
    examples: {
      updated: updated.slice(0, normalizedExampleLimit).map(createExample),
      skipped: skipped.slice(0, normalizedExampleLimit).map(createExample)
    }
  };
}
