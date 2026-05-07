function normalizeIdentityText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentityNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
}

function normalizeIdentityTimestamp(value) {
  const numericValue = normalizeIdentityNumber(value);

  if (numericValue) {
    return numericValue;
  }

  if (typeof value === "string") {
    const parsedValue = Date.parse(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
  }

  return 0;
}

export const relinkStatusValues = ["untracked", "pending", "linked", "missing", "ambiguous"];

export function createItemUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizeRelinkStatus(value, fallback = "pending") {
  const normalizedValue = normalizeIdentityText(value).toLowerCase();

  if (relinkStatusValues.includes(normalizedValue)) {
    return normalizedValue;
  }

  return relinkStatusValues.includes(fallback) ? fallback : "pending";
}

export function normalizeItemSourceIdentity(item, options = {}) {
  const fallbackSourceOriginalFilename = normalizeIdentityText(options.fallbackSourceOriginalFilename);
  const defaultRelinkStatus = normalizeRelinkStatus(
    options.defaultRelinkStatus,
    item?.originalPreserved ? "linked" : "pending"
  );

  return {
    itemUuid: normalizeIdentityText(item?.itemUuid) || createItemUuid(),
    sourceNamespace: normalizeIdentityText(item?.sourceNamespace),
    sourceRelativePath: normalizeIdentityText(item?.sourceRelativePath),
    sourceOriginalFilename: normalizeIdentityText(item?.sourceOriginalFilename) || fallbackSourceOriginalFilename,
    sourceFileSize: normalizeIdentityNumber(item?.sourceFileSize),
    sourceImageWidth: normalizeIdentityNumber(item?.sourceImageWidth),
    sourceImageHeight: normalizeIdentityNumber(item?.sourceImageHeight),
    sourceLastModified: normalizeIdentityTimestamp(item?.sourceLastModified),
    relinkStatus: normalizeRelinkStatus(item?.relinkStatus, defaultRelinkStatus)
  };
}

export function createImportedSourceIdentity(file, originalAsset = {}) {
  return {
    itemUuid: createItemUuid(),
    sourceNamespace: "",
    sourceRelativePath: "",
    sourceOriginalFilename: normalizeIdentityText(file?.name) || normalizeIdentityText(originalAsset?.originalFilename),
    sourceFileSize: normalizeIdentityNumber(file?.size),
    sourceImageWidth: normalizeIdentityNumber(originalAsset?.width),
    sourceImageHeight: normalizeIdentityNumber(originalAsset?.height),
    sourceLastModified: normalizeIdentityTimestamp(file?.lastModified),
    relinkStatus: "linked"
  };
}
