const MIME_EXTENSION_MAP = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCount(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Math.round(numericValue) : 0;
}

export function sanitizeFileSegment(value, fallback = "asset") {
  const normalized = typeof value === "string" ? value.normalize("NFKD") : "";
  const ascii = normalized.replace(/[^\x00-\x7F]/g, "");
  const safe = ascii
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || fallback;
}

export function getExtensionFromMimeType(mimeType = "") {
  return MIME_EXTENSION_MAP[normalizeText(mimeType).toLowerCase()] ?? "";
}

export function getExtensionFromFilename(filename = "") {
  const normalized = normalizeText(filename).toLowerCase();

  if (!normalized.includes(".")) {
    return "";
  }

  const extension = normalized.slice(normalized.lastIndexOf("."));
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

export function getExtensionFromDataUrl(dataUrl = "") {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return "";
  }

  const mimeType = dataUrl.match(/^data:([^;,]+)/i)?.[1] ?? "";
  return getExtensionFromMimeType(mimeType);
}

export function serializeNdjsonRecord(record) {
  return `${JSON.stringify(record)}\n`;
}

export function buildWarningReport({
  source = "",
  version = 0,
  exportedAt = new Date().toISOString(),
  warnings = []
} = {}) {
  const normalizedWarnings = Array.isArray(warnings)
    ? warnings.filter((warning) => warning && typeof warning === "object")
    : [];

  return {
    source,
    version,
    exportedAt,
    warningCount: normalizedWarnings.length,
    warnings: normalizedWarnings
  };
}

export async function streamNdjsonFileLines(file, onLine) {
  if (!file || typeof file.stream !== "function") {
    throw new Error("NDJSON file is invalid.");
  }

  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let lineNumber = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();

      buffered += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? "";

      for (const line of lines) {
        lineNumber += 1;
        await onLine(line, lineNumber);
      }

      if (done) {
        break;
      }
    }

    buffered += decoder.decode();

    if (buffered.length > 0) {
      lineNumber += 1;
      await onLine(buffered, lineNumber);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
