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
  let candidateCount = 0;

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

      const file = await entry.getFile();
      candidateCount += 1;
      entries.push({
        id: `recovery_candidate_${candidateCount}`,
        sourceLabel,
        relativePath: nextRelativePath,
        file
      });

      options.onProgress?.({
        scannedFileCount: candidateCount,
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
