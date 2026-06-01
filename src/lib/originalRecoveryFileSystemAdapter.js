import { isFileSystemAccessSupported } from "./backupPackage.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isOriginalRecoveryFileSystemAdapterSupported(target = globalThis) {
  return isFileSystemAccessSupported(target);
}

export async function scanOriginalRecoveryDirectoryWithFileSystemAccess(options = {}) {
  const target = options.target && typeof options.target === "object" ? options.target : globalThis;

  if (!isOriginalRecoveryFileSystemAdapterSupported(target)) {
    throw new Error("Original recovery folder scanning requires File System Access API support.");
  }

  const directoryHandle = await target.showDirectoryPicker();
  const sourceLabel = normalizeText(directoryHandle?.name) || "Selected folder";
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
    entries
  };
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
