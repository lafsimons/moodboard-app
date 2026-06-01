import { normalizeSourceFilenameAliases } from "./itemIdentity.js";

const LEGACY_FOLDER_NAMESPACE_TAGS = new Map([
  ["folder/vintage", "vintage"],
  ["folder/moodboard", "moodboard"],
  ["folder/wishlist", "wishlist"]
]);

const LEGACY_NAMESPACE_ORDER = ["vintage", "moodboard", "wishlist"];
const LEGACY_NUMBERED_FILENAME_PATTERN = /^(images-\d+)(\.[a-z0-9]+)$/i;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTag(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePathSegment(value) {
  return normalizeText(value).replace(/\\/g, "/");
}

function getNormalizedTags(item = {}) {
  return Array.isArray(item?.tags) ? item.tags.map((tag) => normalizeTag(tag)).filter(Boolean) : [];
}

function hasAnyFolderTag(item = {}) {
  return getNormalizedTags(item).some((tag) => tag.startsWith("folder/"));
}

function getTaggedNamespace(item = {}) {
  const matchedNamespaces = [...new Set(
    getNormalizedTags(item)
      .map((tag) => LEGACY_FOLDER_NAMESPACE_TAGS.get(tag))
      .filter(Boolean)
  )];

  if (!matchedNamespaces.length) {
    return {
      namespace: "",
      reason: "no_supported_folder_tag"
    };
  }

  if (matchedNamespaces.length > 1) {
    return {
      namespace: "",
      reason: "conflicting_folder_tags"
    };
  }

  return {
    namespace: matchedNamespaces[0],
    reason: ""
  };
}

function getLegacyNumberedFilenameParts(filename = "") {
  const normalizedFilename = normalizeText(filename);
  const match = normalizedFilename.match(LEGACY_NUMBERED_FILENAME_PATTERN);

  if (!match) {
    return null;
  }

  return {
    stem: match[1],
    extension: match[2],
    fileName: `${match[1]}${match[2]}`
  };
}

function buildLegacyAlias(namespace, fileName) {
  const parts = getLegacyNumberedFilenameParts(fileName);

  if (!namespace || !parts) {
    return "";
  }

  return `${namespace}-${parts.stem}${parts.extension}`;
}

function buildLegacyRelativePath(namespace, fileName) {
  const parts = getLegacyNumberedFilenameParts(fileName);

  if (!namespace || !parts) {
    return "";
  }

  return `${namespace}/${parts.stem}${parts.extension}`;
}

function getExistingPathNamespace(relativePath = "") {
  return normalizePathSegment(relativePath).split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
}

function createResult(item, namespace, status, reason, nextItem = null, changedFields = [], preview = null) {
  return {
    itemId: normalizeText(item?.id),
    itemUuid: normalizeText(item?.itemUuid),
    itemName: normalizeText(item?.name),
    namespace,
    status,
    reason,
    nextItem,
    changedFields,
    preview
  };
}

function createSkippedResult(item, namespace, reason) {
  return createResult(item, namespace, "skipped", reason);
}

function createConflictResult(item, namespace, reason) {
  return createResult(item, namespace, "conflict", reason);
}

function getLegacyFilenameCandidate(item = {}) {
  const candidates = [
    {
      field: "sourceOriginalFilename",
      value: normalizeText(item?.sourceOriginalFilename)
    },
    {
      field: "originalFilename",
      value: normalizeText(item?.originalFilename)
    },
    {
      field: "images.preview.originalFilename",
      value: normalizeText(item?.images?.preview?.originalFilename)
    }
  ];

  for (const candidate of candidates) {
    if (getLegacyNumberedFilenameParts(candidate.value)) {
      return candidate;
    }
  }

  return {
    field: "",
    value: ""
  };
}

function buildPreview(nextItem, legacyFilename, legacyFilenameField) {
  return {
    legacyFilename,
    legacyFilenameField,
    sourceNamespace: normalizeText(nextItem?.sourceNamespace),
    sourceRelativePath: normalizeText(nextItem?.sourceRelativePath),
    sourceFilenameAliases: Array.isArray(nextItem?.sourceFilenameAliases) ? nextItem.sourceFilenameAliases : []
  };
}

function shouldIncludeInReport(item = {}) {
  return hasAnyFolderTag(item);
}

export function buildLegacyProvenanceBackfillResult(item = {}) {
  if (!shouldIncludeInReport(item)) {
    return createSkippedResult(item, "", "no_supported_folder_tag");
  }

  const { namespace, reason } = getTaggedNamespace(item);

  if (!namespace) {
    return reason === "conflicting_folder_tags"
      ? createConflictResult(item, "", reason)
      : createSkippedResult(item, "", reason);
  }

  const existingNamespace = normalizeText(item?.sourceNamespace).toLowerCase();
  const existingRelativePath = normalizePathSegment(item?.sourceRelativePath);
  const existingRelativePathNamespace = getExistingPathNamespace(existingRelativePath);

  if (existingNamespace && existingNamespace !== namespace) {
    return createConflictResult(item, namespace, "existing_namespace_conflict");
  }

  if (existingRelativePathNamespace && existingRelativePathNamespace !== namespace) {
    return createConflictResult(item, namespace, "existing_relative_path_conflict");
  }

  const { value: legacyFilename, field: legacyFilenameField } = getLegacyFilenameCandidate(item);
  const nextItem = {
    ...item
  };
  const changedFields = [];

  if (!existingNamespace) {
    nextItem.sourceNamespace = namespace;
    changedFields.push("sourceNamespace");
  }

  if (legacyFilename) {
    const nextRelativePath = buildLegacyRelativePath(namespace, legacyFilename);
    const nextAlias = buildLegacyAlias(namespace, legacyFilename);

    if (!existingRelativePath && nextRelativePath) {
      nextItem.sourceRelativePath = nextRelativePath;
      changedFields.push("sourceRelativePath");
    }

    if (nextAlias) {
      const currentAliases = normalizeSourceFilenameAliases(item?.sourceFilenameAliases, {
        excludedValues: [normalizeText(item?.sourceOriginalFilename)]
      });
      const normalizedAliases = normalizeSourceFilenameAliases([
        ...currentAliases,
        nextAlias
      ], {
        excludedValues: [normalizeText(item?.sourceOriginalFilename)]
      });

      if (JSON.stringify(normalizedAliases) !== JSON.stringify(currentAliases)) {
        nextItem.sourceFilenameAliases = normalizedAliases;
        changedFields.push("sourceFilenameAliases");
      }
    }
  }

  if (!changedFields.length) {
    return createSkippedResult(item, namespace, legacyFilename ? "already_backfilled" : "no_legacy_numbered_filename");
  }

  return createResult(
    item,
    namespace,
    "affected",
    "",
    nextItem,
    changedFields,
    buildPreview(nextItem, legacyFilename, legacyFilenameField)
  );
}

function createExample(result) {
  return {
    itemId: result.itemId,
    itemUuid: result.itemUuid,
    itemName: result.itemName,
    namespace: result.namespace,
    reason: result.reason,
    changedFields: result.changedFields,
    legacyFilename: result.preview?.legacyFilename ?? "",
    legacyFilenameField: result.preview?.legacyFilenameField ?? "",
    sourceNamespace: result.preview?.sourceNamespace ?? "",
    sourceRelativePath: result.preview?.sourceRelativePath ?? "",
    sourceFilenameAliases: result.preview?.sourceFilenameAliases ?? []
  };
}

export function createLegacyProvenanceBackfillReport(items = [], options = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const scopedItems = normalizedItems.filter((item) => shouldIncludeInReport(item));
  const exampleLimit = Math.max(1, Math.round(Number(options.exampleLimit) || 5));
  const results = scopedItems.map((item) => buildLegacyProvenanceBackfillResult(item));
  const affected = results.filter((result) => result.status === "affected");
  const skipped = results.filter((result) => result.status === "skipped");
  const conflicts = results.filter((result) => result.status === "conflict");
  const examplesByNamespace = Object.fromEntries(
    LEGACY_NAMESPACE_ORDER.map((namespace) => [
      namespace,
      affected
        .filter((result) => result.namespace === namespace)
        .slice(0, exampleLimit)
        .map(createExample)
    ])
  );

  return {
    scopedItemCount: scopedItems.length,
    affectedCount: affected.length,
    skippedCount: skipped.length,
    conflictCount: conflicts.length,
    results,
    affectedItems: affected.map((result) => result.nextItem).filter(Boolean),
    changedItemIds: affected.map((result) => result.itemId).filter(Boolean),
    examples: {
      byNamespace: examplesByNamespace,
      affected: affected.slice(0, exampleLimit).map(createExample),
      skipped: skipped.slice(0, exampleLimit).map(createExample),
      conflicts: conflicts.slice(0, exampleLimit).map(createExample)
    }
  };
}
