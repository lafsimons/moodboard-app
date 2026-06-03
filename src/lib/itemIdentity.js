function normalizeIdentityText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeKnownOriginalRelativePath(value) {
  const normalizedValue = normalizeIdentityText(value).replace(/\\/g, "/");

  if (!normalizedValue) {
    return "";
  }

  if (
    normalizedValue.startsWith("/")
    || /^[a-z]:\//i.test(normalizedValue)
    || normalizedValue.split("/").some((segment) => segment === "..")
  ) {
    return "";
  }

  const sanitizedSegments = normalizedValue
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== ".");

  return sanitizedSegments.join("/");
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

function normalizeFilenameAlias(value) {
  return normalizeIdentityText(value);
}

function normalizeFilenameAliasKey(value) {
  return normalizeFilenameAlias(value).toLowerCase();
}

export function normalizeSourceFilenameAliases(value, options = {}) {
  const {
    excludedValues = []
  } = options;
  const excludedKeys = new Set((Array.isArray(excludedValues) ? excludedValues : []).map(normalizeFilenameAliasKey).filter(Boolean));
  const seen = new Set();

  return (Array.isArray(value) ? value : [])
    .map(normalizeFilenameAlias)
    .filter((alias) => {
      if (!alias) {
        return false;
      }

      const aliasKey = normalizeFilenameAliasKey(alias);

      if (!aliasKey || excludedKeys.has(aliasKey) || seen.has(aliasKey)) {
        return false;
      }

      seen.add(aliasKey);
      return true;
    });
}

export const relinkStatusValues = ["untracked", "pending", "linked", "missing", "ambiguous"];

export function createItemUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizeRelinkStatus(value, fallback = "pending") {
  const trimmedValue = normalizeIdentityText(value);
  const normalizedValue = trimmedValue.toLowerCase();

  if (relinkStatusValues.includes(normalizedValue)) {
    return normalizedValue;
  }

  if (trimmedValue) {
    return trimmedValue;
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
    importSource: normalizeIdentityText(item?.importSource),
    sourceNamespace: normalizeIdentityText(item?.sourceNamespace),
    sourceRelativePath: normalizeIdentityText(item?.sourceRelativePath),
    knownOriginalRelativePath: normalizeKnownOriginalRelativePath(item?.knownOriginalRelativePath),
    sourceOriginalFilename: normalizeIdentityText(item?.sourceOriginalFilename) || fallbackSourceOriginalFilename,
    sourceFilenameAliases: normalizeSourceFilenameAliases(item?.sourceFilenameAliases, {
      excludedValues: [
        normalizeIdentityText(item?.sourceOriginalFilename) || fallbackSourceOriginalFilename
      ]
    }),
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
    knownOriginalRelativePath: "",
    sourceOriginalFilename: normalizeIdentityText(file?.name) || normalizeIdentityText(originalAsset?.originalFilename),
    sourceFilenameAliases: [],
    sourceFileSize: normalizeIdentityNumber(file?.size),
    sourceImageWidth: normalizeIdentityNumber(originalAsset?.width),
    sourceImageHeight: normalizeIdentityNumber(originalAsset?.height),
    sourceLastModified: normalizeIdentityTimestamp(file?.lastModified),
    relinkStatus: "linked"
  };
}
