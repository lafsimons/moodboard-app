import { normalizeKnownOriginalRelativePath } from "./itemIdentity.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createResult(item, status, reason, nextItem = null, changedFields = [], preview = null) {
  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name),
    status,
    reason,
    nextItem,
    changedFields,
    preview
  };
}

function createSkippedResult(item, reason, preview = null) {
  return createResult(item, "skipped", reason, null, [], preview);
}

function createInvalidResult(item, reason, preview = null) {
  return createResult(item, "invalid", reason, null, [], preview);
}

function createAffectedResult(item, nextItem, preview) {
  return createResult(
    item,
    "affected",
    "",
    nextItem,
    ["knownOriginalRelativePath"],
    preview
  );
}

function createPreview(item, sanitizedPath = "") {
  return {
    originalRelinkedRelativePath: normalizeText(item?.originalRelinkedRelativePath),
    knownOriginalRelativePath: normalizeText(item?.knownOriginalRelativePath),
    sourceRelativePath: normalizeText(item?.sourceRelativePath),
    sanitizedKnownOriginalRelativePath: sanitizedPath
  };
}

export function buildKnownOriginalRelativePathBackfillResult(item = {}) {
  if (!item?.originalPreserved) {
    return createSkippedResult(item, "not_preserved", createPreview(item));
  }

  if (normalizeText(item?.knownOriginalRelativePath)) {
    return createSkippedResult(item, "already_backfilled", createPreview(item));
  }

  const candidatePath = normalizeText(item?.originalRelinkedRelativePath);

  if (!candidatePath) {
    return createSkippedResult(item, "missing_original_relinked_relative_path", createPreview(item));
  }

  const sanitizedPath = normalizeKnownOriginalRelativePath(candidatePath);

  if (!sanitizedPath) {
    return createInvalidResult(item, "invalid_original_relinked_relative_path", createPreview(item));
  }

  const nextItem = {
    ...item,
    knownOriginalRelativePath: sanitizedPath
  };

  return createAffectedResult(item, nextItem, createPreview(nextItem, sanitizedPath));
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

export function createKnownOriginalRelativePathBackfillReport(items = [], options = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const exampleLimit = Math.max(1, Math.round(Number(options.exampleLimit) || 5));
  const totalPreservedItemCount = normalizedItems.filter((item) => item?.originalPreserved).length;
  const eligibleItems = normalizedItems.filter(
    (item) => item?.originalPreserved && !normalizeText(item?.knownOriginalRelativePath)
  );
  const results = normalizedItems.map((item) => buildKnownOriginalRelativePathBackfillResult(item));
  const affected = results.filter((result) => result.status === "affected");
  const skipped = results.filter((result) => result.status === "skipped");
  const invalid = results.filter((result) => result.status === "invalid");

  return {
    totalPreservedItemCount,
    eligiblePreservedItemCount: eligibleItems.length,
    affectedCount: affected.length,
    skippedCount: skipped.length,
    invalidPathCount: invalid.length,
    results,
    affectedItems: affected.map((result) => result.nextItem).filter(Boolean),
    changedItemIds: affected.map((result) => result.itemId).filter(Boolean),
    examples: {
      affected: affected.slice(0, exampleLimit).map(createExample),
      skipped: skipped.slice(0, exampleLimit).map(createExample),
      invalid: invalid.slice(0, exampleLimit).map(createExample)
    }
  };
}
