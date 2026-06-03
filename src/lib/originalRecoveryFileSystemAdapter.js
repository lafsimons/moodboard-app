import { isFileSystemAccessSupported } from "./backupPackage.js";
import { getApprovedOriginalRecoveryMatches, reconcileOriginalRecoverySessionWithItemsResult } from "./originalRecovery.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRelativePath(value) {
  const normalizedValue = normalizeText(value).replace(/\\/g, "/");

  if (!normalizedValue || normalizedValue.startsWith("/") || /^[a-z]:\//i.test(normalizedValue)) {
    return "";
  }

  const segments = normalizedValue
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== ".");

  if (segments.some((segment) => segment === "..")) {
    return "";
  }

  return segments.join("/");
}

export function isOriginalRecoveryFileSystemAdapterSupported(target = globalThis) {
  return isFileSystemAccessSupported(target);
}

export async function pickOriginalRecoveryDirectoryWithFileSystemAccess(options = {}) {
  const target = options.target && typeof options.target === "object" ? options.target : globalThis;

  if (!isOriginalRecoveryFileSystemAdapterSupported(target)) {
    throw new Error("Original recovery folder scanning requires File System Access API support.");
  }

  const directoryHandle = await target.showDirectoryPicker();
  return {
    directoryHandle,
    sourceLabel: normalizeText(directoryHandle?.name) || "Selected folder"
  };
}

export async function scanOriginalRecoveryDirectoryHandleWithFileSystemAccess(directoryHandle, options = {}) {
  const sourceLabel = normalizeText(options.sourceLabel) || normalizeText(directoryHandle?.name) || "Selected folder";
  const entries = [];
  let traversedFileCount = 0;

  async function walkDirectory(handle, prefix = "") {
    // Keep adapter-specific directory traversal outside the recovery engine.
    for await (const [name, entry] of handle.entries()) {
      const nextRelativePath = prefix ? `${prefix}/${name}` : name;

      if (entry.kind === "directory") {
        await walkDirectory(entry, nextRelativePath);
        continue;
      }

      if (entry.kind !== "file") {
        continue;
      }

      traversedFileCount += 1;
      entries.push({
        id: `recovery_candidate_${traversedFileCount}`,
        sourceLabel,
        relativePath: nextRelativePath,
        fileName: name,
        handle: entry
      });

      options.onProgress?.({
        phase: "traversal",
        traversedFileCount,
        currentPath: nextRelativePath
      });
    }
  }

  await walkDirectory(directoryHandle);

  return {
    sourceLabel,
    entries,
    directoryHandle
  };
}

export async function scanOriginalRecoveryDirectoryWithFileSystemAccess(options = {}) {
  const { directoryHandle, sourceLabel } = await pickOriginalRecoveryDirectoryWithFileSystemAccess(options);
  return scanOriginalRecoveryDirectoryHandleWithFileSystemAccess(directoryHandle, {
    ...options,
    sourceLabel
  });
}

export async function resolveOriginalRecoveryEntryByRelativePathWithFileSystemAccess(directoryHandle, relativePath, options = {}) {
  const normalizedRelativePath = normalizeRelativePath(relativePath);

  if (!directoryHandle || !normalizedRelativePath) {
    return null;
  }

  const segments = normalizedRelativePath.split("/");
  const fileName = segments.at(-1) ?? "";
  let currentDirectoryHandle = directoryHandle;

  try {
    for (let index = 0; index < segments.length - 1; index += 1) {
      currentDirectoryHandle = await currentDirectoryHandle.getDirectoryHandle(segments[index]);
    }

    const handle = await currentDirectoryHandle.getFileHandle(fileName);
    return {
      id: normalizeText(options.id) || `direct_path_${normalizedRelativePath}`,
      sourceLabel: normalizeText(options.sourceLabel) || normalizeText(directoryHandle?.name) || "Selected folder",
      relativePath: normalizedRelativePath,
      fileName,
      handle,
      lookupStrategy: options.lookupStrategy === "exact_path" ? "exact_path" : "direct_path"
    };
  } catch (error) {
    if (error?.name === "NotFoundError") {
      return null;
    }

    throw error;
  }
}

export async function getOriginalRecoveryEntryFileWithFileSystemAccess(entry) {
  if (entry?.file) {
    return entry.file;
  }

  if (entry?.handle && typeof entry.handle.getFile === "function") {
    return entry.handle.getFile();
  }

  throw new Error("Original recovery entry could not be materialized as a file.");
}

export async function getOriginalRecoveryEntryMetadataWithFileSystemAccess(entry) {
  const file = await getOriginalRecoveryEntryFileWithFileSystemAccess(entry);

  return {
    name: file?.name,
    size: file?.size,
    type: file?.type,
    lastModified: file?.lastModified
  };
}

function getSelectedCandidate(match) {
  const selectedCandidateId = normalizeText(match?.selectedCandidateId);

  if (!selectedCandidateId) {
    return null;
  }

  return (Array.isArray(match?.candidates) ? match.candidates : []).find(
    (candidate) => normalizeText(candidate?.id) === selectedCandidateId
  ) ?? null;
}

export async function resolveRecoverySelectedCandidateHandles(rootHandle, recoverySession, options = {}) {
  const sourceLabel = normalizeText(options.sourceLabel) || normalizeText(rootHandle?.name) || "Selected folder";
  const candidateEntriesById = {};
  const missingMatches = [];
  const invalidMatches = [];
  const reconciledSession = options.currentItems
    ? reconcileOriginalRecoverySessionWithItemsResult(recoverySession, options.currentItems).session
    : recoverySession;
  const approvedMatches = getApprovedOriginalRecoveryMatches(reconciledSession);

  for (const match of approvedMatches) {
    const selectedCandidate = getSelectedCandidate(match);
    const relativePath = normalizeRelativePath(selectedCandidate?.relativePath);

    if (!selectedCandidate?.id || !relativePath) {
      invalidMatches.push({
        itemId: normalizeText(match?.itemId),
        selectedCandidateId: normalizeText(match?.selectedCandidateId),
        relativePath: normalizeText(selectedCandidate?.relativePath)
      });
      continue;
    }

    const entry = await resolveOriginalRecoveryEntryByRelativePathWithFileSystemAccess(rootHandle, relativePath, {
      id: normalizeText(selectedCandidate.id),
      sourceLabel,
      lookupStrategy: normalizeText(selectedCandidate.lookupStrategy) || "scan"
    });

    if (!entry) {
      missingMatches.push({
        itemId: normalizeText(match?.itemId),
        selectedCandidateId: normalizeText(selectedCandidate.id),
        relativePath
      });
      continue;
    }

    candidateEntriesById[selectedCandidate.id] = {
      id: entry.id,
      sourceLabel: entry.sourceLabel,
      relativePath: entry.relativePath,
      fileName: entry.fileName,
      handle: entry.handle,
      lookupStrategy: entry.lookupStrategy
    };
  }

  return {
    candidateEntriesById,
    approvedMatchCount: approvedMatches.length,
    resolvedCount: Object.keys(candidateEntriesById).length,
    missingCount: missingMatches.length,
    invalidPathCount: invalidMatches.length,
    missingMatches,
    invalidMatches
  };
}
