function getJsonSizeBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDataImageUrl(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function getDataUrlPayloadBytes(dataUrl) {
  if (!isDataImageUrl(dataUrl)) {
    return 0;
  }

  const payload = dataUrl.split(",")[1] ?? "";
  if (!payload) {
    return 0;
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function hashString(value = "") {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getTopLevelBreakdown(backup) {
  return Object.entries(isObject(backup) ? backup : {}).map(([key, value]) => ({
    key,
    type: Array.isArray(value) ? "array" : typeof value,
    count: Array.isArray(value) ? value.length : undefined,
    bytes: getJsonSizeBytes(value)
  })).sort((left, right) => right.bytes - left.bytes);
}

function getAssetAtPath(item, path) {
  if (path === "imageUrl") {
    return item?.imageUrl;
  }

  const [root, slot, field] = path.split(".");
  return root === "images" ? item?.[root]?.[slot]?.[field] : undefined;
}

function collectDataUrlStats(items = []) {
  const pathStats = {
    imageUrl: { count: 0, payloadBytes: 0, jsonBytes: 0 },
    "images.original.src": { count: 0, payloadBytes: 0, jsonBytes: 0 },
    "images.preview.src": { count: 0, payloadBytes: 0, jsonBytes: 0 },
    "images.thumbnail.src": { count: 0, payloadBytes: 0, jsonBytes: 0 }
  };
  const valueOccurrences = new Map();
  const largestEntries = [];
  let itemsWithEmbeddedData = 0;
  let itemsWithMultipleEmbeddedDataUrls = 0;
  let itemsWithDuplicatedPreviewMirror = 0;
  let itemsWithOriginalPreviewDuplication = 0;
  let itemsWithPreviewThumbnailDuplication = 0;
  let itemsWithOriginalThumbnailDuplication = 0;

  items.forEach((item) => {
    const itemId = typeof item?.id === "string" ? item.id : "";
    const paths = Object.keys(pathStats);
    const embeddedPaths = paths.filter((path) => isDataImageUrl(getAssetAtPath(item, path)));

    if (embeddedPaths.length > 0) {
      itemsWithEmbeddedData += 1;
    }

    if (embeddedPaths.length > 1) {
      itemsWithMultipleEmbeddedDataUrls += 1;
    }

    const previewSrc = getAssetAtPath(item, "images.preview.src");
    const originalSrc = getAssetAtPath(item, "images.original.src");
    const thumbnailSrc = getAssetAtPath(item, "images.thumbnail.src");
    const imageUrl = getAssetAtPath(item, "imageUrl");

    if (isDataImageUrl(imageUrl) && imageUrl === previewSrc) {
      itemsWithDuplicatedPreviewMirror += 1;
    }

    if (isDataImageUrl(originalSrc) && originalSrc === previewSrc) {
      itemsWithOriginalPreviewDuplication += 1;
    }

    if (isDataImageUrl(previewSrc) && previewSrc === thumbnailSrc) {
      itemsWithPreviewThumbnailDuplication += 1;
    }

    if (isDataImageUrl(originalSrc) && originalSrc === thumbnailSrc) {
      itemsWithOriginalThumbnailDuplication += 1;
    }

    let itemEmbeddedPayloadBytes = 0;
    let itemEmbeddedJsonBytes = 0;

    embeddedPaths.forEach((path) => {
      const value = getAssetAtPath(item, path);
      const payloadBytes = getDataUrlPayloadBytes(value);
      const jsonBytes = getJsonSizeBytes(value);

      pathStats[path].count += 1;
      pathStats[path].payloadBytes += payloadBytes;
      pathStats[path].jsonBytes += jsonBytes;

      itemEmbeddedPayloadBytes += payloadBytes;
      itemEmbeddedJsonBytes += jsonBytes;

      const occurrenceKey = `${hashString(value)}:${value.length}`;
      const existingOccurrence = valueOccurrences.get(occurrenceKey);

      if (existingOccurrence && existingOccurrence.value === value) {
        existingOccurrence.count += 1;
        existingOccurrence.payloadBytes += payloadBytes;
        existingOccurrence.jsonBytes += jsonBytes;
        existingOccurrence.paths[path] = (existingOccurrence.paths[path] ?? 0) + 1;
        existingOccurrence.itemIds.add(itemId);
      } else {
        valueOccurrences.set(occurrenceKey, {
          hash: hashString(value),
          value,
          samplePrefix: value.slice(0, 48),
          count: 1,
          payloadBytes,
          jsonBytes,
          paths: { [path]: 1 },
          itemIds: new Set(itemId ? [itemId] : [])
        });
      }
    });

    if (itemEmbeddedPayloadBytes > 0) {
      largestEntries.push({
        itemId,
        payloadBytes: itemEmbeddedPayloadBytes,
        jsonBytes: itemEmbeddedJsonBytes,
        embeddedPathCount: embeddedPaths.length
      });
    }
  });

  const duplicatePayloadGroups = [...valueOccurrences.values()]
    .filter((entry) => entry.count > 1)
    .sort((left, right) => right.payloadBytes - left.payloadBytes)
    .map((entry) => ({
      hash: entry.hash,
      count: entry.count,
      payloadBytes: entry.payloadBytes,
      jsonBytes: entry.jsonBytes,
      distinctItemCount: entry.itemIds.size,
      paths: entry.paths,
      samplePrefix: entry.samplePrefix
    }));

  return {
    pathStats,
    itemsWithEmbeddedData,
    itemsWithMultipleEmbeddedDataUrls,
    itemsWithDuplicatedPreviewMirror,
    itemsWithOriginalPreviewDuplication,
    itemsWithPreviewThumbnailDuplication,
    itemsWithOriginalThumbnailDuplication,
    totalDuplicatePayloadBytes:
      duplicatePayloadGroups.reduce((sum, entry) => sum + ((entry.count - 1) * (entry.payloadBytes / entry.count)), 0),
    duplicatePayloadGroups,
    largestItemsByEmbeddedPayload: largestEntries
      .sort((left, right) => right.payloadBytes - left.payloadBytes)
      .slice(0, 10)
  };
}

function summarizePreviewMirrorFields(items = []) {
  const fields = [
    ["imageUrl", "images.preview.src"],
    ["mimeType", "images.preview.mimeType"],
    ["imageWidth", "images.preview.width"],
    ["imageHeight", "images.preview.height"],
    ["fileSize", "images.preview.fileSize"],
    ["originalFilename", "images.preview.originalFilename"]
  ];

  return fields.map(([topLevelField, nestedField]) => {
    const matchingItems = items.filter((item) => {
      const topLevelValue = item?.[topLevelField];
      const nestedValue = nestedField.split(".").reduce((value, key) => value?.[key], item);
      return topLevelValue !== undefined && topLevelValue !== "" && topLevelValue === nestedValue;
    });

    return {
      topLevelField,
      nestedField,
      matchingItemCount: matchingItems.length,
      duplicatedBytes: matchingItems.reduce((sum, item) => sum + getJsonSizeBytes(item?.[topLevelField]), 0)
    };
  }).sort((left, right) => right.duplicatedBytes - left.duplicatedBytes);
}

function scanForEmbeddedDataUrls(value, path = "appState", results = []) {
  if (isDataImageUrl(value)) {
    results.push({
      path,
      payloadBytes: getDataUrlPayloadBytes(value),
      jsonBytes: getJsonSizeBytes(value)
    });
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForEmbeddedDataUrls(entry, `${path}[${index}]`, results));
    return results;
  }

  if (isObject(value)) {
    Object.entries(value).forEach(([key, entry]) => scanForEmbeddedDataUrls(entry, `${path}.${key}`, results));
  }

  return results;
}

function getItemPropertyBreakdown(items = []) {
  const totals = new Map();

  items.forEach((item) => {
    Object.entries(isObject(item) ? item : {}).forEach(([key, value]) => {
      totals.set(key, (totals.get(key) ?? 0) + getJsonSizeBytes(value));
    });
  });

  return [...totals.entries()]
    .map(([key, bytes]) => ({ key, bytes }))
    .sort((left, right) => right.bytes - left.bytes);
}

export function analyzeBackupData(backup) {
  const items = Array.isArray(backup?.items) ? backup.items : [];
  const appState = isObject(backup?.appState) ? backup.appState : {};
  const topLevelBreakdown = getTopLevelBreakdown(backup);
  const embeddedDataUrlStats = collectDataUrlStats(items);
  const embeddedAppStateData = scanForEmbeddedDataUrls(appState);

  return {
    totalBytes: getJsonSizeBytes(backup),
    topLevelBreakdown,
    largestTopLevelField: topLevelBreakdown[0] ?? null,
    itemCount: items.length,
    itemPropertyBreakdown: getItemPropertyBreakdown(items).slice(0, 20),
    previewMirrorFieldBreakdown: summarizePreviewMirrorFields(items),
    embeddedDataUrlStats,
    savedBoardEmbeddedData: {
      count: embeddedAppStateData.length,
      totalPayloadBytes: embeddedAppStateData.reduce((sum, entry) => sum + entry.payloadBytes, 0),
      totalJsonBytes: embeddedAppStateData.reduce((sum, entry) => sum + entry.jsonBytes, 0),
      samples: embeddedAppStateData.slice(0, 10)
    }
  };
}
