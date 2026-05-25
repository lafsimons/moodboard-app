import test from "node:test";
import assert from "node:assert/strict";
import {
  PACKAGE_APP_STATE_FILE,
  PACKAGE_ASSET_POLICY,
  PACKAGE_FORMAT,
  PACKAGE_ITEMS_FILE,
  PACKAGE_MANIFEST_FILE,
  PACKAGE_PREVIEWS_DIR,
  PACKAGE_SOURCE,
  PACKAGE_VERSION,
  buildBackupPackageAppState,
  buildBackupPackageItemRecord,
  buildBackupPackageManifest,
  exportBackupPackageToDirectory,
  getBackupPackagePreviewFileName,
  isFileSystemAccessSupported,
  serializeBackupPackageItemRecord,
  validateBackupPackageManifest
} from "./backupPackage.js";

class FakeWritable {
  constructor(fileHandle, closeLog) {
    this.fileHandle = fileHandle;
    this.closeLog = closeLog;
  }

  async write(chunk) {
    this.fileHandle.chunks.push(chunk);
  }

  async close() {
    this.fileHandle.closed = true;
    this.closeLog.push(this.fileHandle.path);
  }
}

class FakeFileHandle {
  constructor(path, closeLog) {
    this.path = path;
    this.closeLog = closeLog;
    this.chunks = [];
    this.closed = false;
  }

  async createWritable() {
    return new FakeWritable(this, this.closeLog);
  }

  async readText() {
    const chunks = await Promise.all(this.chunks.map(async (chunk) => {
      if (typeof chunk === "string") {
        return chunk;
      }

      if (chunk instanceof Blob) {
        return chunk.text();
      }

      return String(chunk);
    }));

    return chunks.join("");
  }

  async readBlob() {
    const parts = [];

    for (const chunk of this.chunks) {
      if (chunk instanceof Blob) {
        parts.push(chunk);
      } else {
        parts.push(new Blob([chunk]));
      }
    }

    return new Blob(parts);
  }
}

class FakeDirectoryHandle {
  constructor(path = "", closeLog = []) {
    this.path = path;
    this.closeLog = closeLog;
    this.directories = new Map();
    this.files = new Map();
  }

  async getDirectoryHandle(name, options = {}) {
    if (!this.directories.has(name)) {
      if (!options.create) {
        throw new Error(`Missing directory: ${name}`);
      }

      const nextPath = this.path ? `${this.path}/${name}` : name;
      this.directories.set(name, new FakeDirectoryHandle(nextPath, this.closeLog));
    }

    return this.directories.get(name);
  }

  async getFileHandle(name, options = {}) {
    if (!this.files.has(name)) {
      if (!options.create) {
        throw new Error(`Missing file: ${name}`);
      }

      const nextPath = this.path ? `${this.path}/${name}` : name;
      this.files.set(name, new FakeFileHandle(nextPath, this.closeLog));
    }

    return this.files.get(name);
  }
}

test("buildBackupPackageManifest returns the expected package manifest", () => {
  const manifest = buildBackupPackageManifest({
    exportedAt: "2026-05-25T12:00:00.000Z",
    itemCount: 2,
    previewFileCount: 2
  });

  assert.deepEqual(manifest, {
    source: PACKAGE_SOURCE,
    version: PACKAGE_VERSION,
    exportedAt: "2026-05-25T12:00:00.000Z",
    format: PACKAGE_FORMAT,
    assetPolicy: PACKAGE_ASSET_POLICY,
    itemCount: 2,
    previewFileCount: 2,
    files: {
      appState: PACKAGE_APP_STATE_FILE,
      items: PACKAGE_ITEMS_FILE,
      previewsDir: PACKAGE_PREVIEWS_DIR
    }
  });
  assert.equal(validateBackupPackageManifest(manifest), manifest);
});

test("buildBackupPackageItemRecord strips inline media and adds preview packagePath", () => {
  const record = buildBackupPackageItemRecord({
    id: "item-1",
    itemUuid: "uuid-1",
    imageUrl: "data:image/webp;base64,preview",
    imageWidth: 1200,
    imageHeight: 800,
    mimeType: "image/webp",
    fileSize: 1111,
    originalFilename: "preview-name.webp",
    images: {
      original: {
        src: "data:image/png;base64,original",
        mimeType: "image/png",
        width: 4000,
        height: 3000
      },
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 1200,
        height: 800,
        fileSize: 1111,
        originalFilename: "preview-name.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb",
        mimeType: "image/webp",
        width: 480,
        height: 320
      }
    },
    originalPreserved: true
  }, "item-1.webp");

  assert.equal(record.originalPreserved, false);
  assert.equal(record.images.original.src, "");
  assert.equal(record.images.preview.src, "");
  assert.equal(record.images.preview.packagePath, "media/previews/item-1.webp");
  assert.equal(record.images.thumbnail.src, "");
});

test("serializeBackupPackageItemRecord emits one NDJSON line", () => {
  const line = serializeBackupPackageItemRecord({
    id: "item-1",
    images: {
      preview: {
        packagePath: "media/previews/item-1.webp"
      }
    }
  });

  assert.equal(line.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(line.trim()), {
    id: "item-1",
    images: {
      preview: {
        packagePath: "media/previews/item-1.webp"
      }
    }
  });
});

test("getBackupPackagePreviewFileName prefers itemUuid over legacy id-derived names", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      { itemUuid: "mba-ref-123", id: "top_both_legacy_name" },
      { mimeType: "image/webp", originalFilename: "unsafe name.webp" }
    ),
    "mba-ref-123.webp"
  );
});

test("getBackupPackagePreviewFileName falls back to id when itemUuid is missing", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      { id: "../Look 01:Spring" },
      { mimeType: "image/webp", originalFilename: "unsafe name.webp" }
    ),
    "look-01-spring.webp"
  );
});

test("getBackupPackagePreviewFileName does not use original filename as the base name", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      {},
      { mimeType: "image/png", originalFilename: "top_both_original-name.png" }
    ),
    "reference.png"
  );
});

test("getBackupPackagePreviewFileName falls back to previewAsset.type when mimeType is missing", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      { itemUuid: "mba-ref-123" },
      { type: "image/png" }
    ),
    "mba-ref-123.png"
  );
});

test("getBackupPackagePreviewFileName falls back to item preview mimeType metadata", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      {
        itemUuid: "mba-ref-123",
        images: {
          preview: {
            mimeType: "image/jpeg"
          }
        }
      },
      {}
    ),
    "mba-ref-123.jpg"
  );
});

test("getBackupPackagePreviewFileName falls back to item mimeType metadata", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      {
        itemUuid: "mba-ref-123",
        mimeType: "image/gif"
      },
      {}
    ),
    "mba-ref-123.gif"
  );
});

test("getBackupPackagePreviewFileName falls back to MIME parsed from preview data URLs", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      { itemUuid: "mba-ref-123" },
      { src: "data:image/avif;base64,AAAA" }
    ),
    "mba-ref-123.avif"
  );
});

test("getBackupPackagePreviewFileName falls back to item fileExtension metadata", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      {
        itemUuid: "mba-ref-123",
        fileExtension: "webp"
      },
      {}
    ),
    "mba-ref-123.webp"
  );
  assert.equal(
    getBackupPackagePreviewFileName(
      {
        itemUuid: "mba-ref-456",
        fileExtension: ".png"
      },
      {}
    ),
    "mba-ref-456.png"
  );
});

test("getBackupPackagePreviewFileName falls back to preview originalFilename extension before item originalFilename", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      {
        itemUuid: "mba-ref-123",
        originalFilename: "ignored-item.gif"
      },
      {
        originalFilename: "preview-name.webp"
      }
    ),
    "mba-ref-123.webp"
  );
});

test("getBackupPackagePreviewFileName falls back to item originalFilename extension when needed", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      {
        itemUuid: "mba-ref-123",
        originalFilename: "item-name.jpg"
      },
      {}
    ),
    "mba-ref-123.jpg"
  );
});

test("getBackupPackagePreviewFileName uses .bin only when the extension is genuinely unknown", () => {
  assert.equal(
    getBackupPackagePreviewFileName(
      {
        itemUuid: "mba-ref-123",
        fileExtension: "unknown/value",
        originalFilename: "no-valid-extension"
      },
      {
        type: "image/unknown",
        originalFilename: "still-unknown"
      }
    ),
    "mba-ref-123.bin"
  );
});

test("buildBackupPackageAppState preserves current backup app-state sanitization", () => {
  const appState = buildBackupPackageAppState({
    board: {
      id: "board-1",
      images: [
        {
          id: "board-image-1",
          referenceId: "item-1",
          imageUrl: "data:image/png;base64,large"
        }
      ]
    },
    savedOutfits: []
  });

  assert.equal("imageUrl" in appState.board.images[0], false);
});

test("isFileSystemAccessSupported reflects directory-picker support", () => {
  assert.equal(isFileSystemAccessSupported({ showDirectoryPicker: async () => null }), true);
  assert.equal(isFileSystemAccessSupported({}), false);
});

test("exportBackupPackageToDirectory writes manifest last and does not require originals", async () => {
  const rootHandle = new FakeDirectoryHandle();
  const resolvePreviewCalls = [];

  const result = await exportBackupPackageToDirectory({
    rootHandle,
    items: [
      {
        id: "item-inline-preview",
        itemUuid: "uuid-inline-preview",
        originalPreserved: true,
        images: {
          original: {
            src: "",
            mimeType: "image/png",
            width: 3000,
            height: 2000
          },
          preview: {
            src: "data:image/webp;base64,cHJldmlldw==",
            mimeType: "image/webp",
            width: 800,
            height: 600,
            originalFilename: "preview.webp"
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    resolvePreviewAsset: async (item, variant) => {
      resolvePreviewCalls.push({ itemId: item.id, variant });
      return null;
    }
  });

  assert.equal(resolvePreviewCalls.length, 0);
  assert.equal(result.previewFileCount, 1);
  assert.equal(rootHandle.closeLog.at(-1), PACKAGE_MANIFEST_FILE);

  const manifestText = await rootHandle.files.get(PACKAGE_MANIFEST_FILE).readText();
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.previewFileCount, 1);
});

test("exportBackupPackageToDirectory resolves preview assets for metadata-only items", async () => {
  const rootHandle = new FakeDirectoryHandle();
  const resolvePreviewCalls = [];

  await exportBackupPackageToDirectory({
    rootHandle,
    items: [
      {
        id: "item-metadata-only",
        itemUuid: "uuid-metadata-only",
        images: {
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480,
            originalFilename: "preview.webp"
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    resolvePreviewAsset: async (item, variant) => {
      resolvePreviewCalls.push({ itemId: item.id, variant });
      return {
        src: "data:image/webp;base64,cHJldmlldw==",
        mimeType: "image/webp",
        width: 640,
        height: 480,
        originalFilename: "preview.webp"
      };
    }
  });

  assert.deepEqual(resolvePreviewCalls, [
    {
      itemId: "item-metadata-only",
      variant: "preview"
    }
  ]);

  const itemsText = await rootHandle.files.get(PACKAGE_ITEMS_FILE).readText();
  const record = JSON.parse(itemsText.trim());
  assert.equal(record.images.preview.packagePath, "media/previews/uuid-metadata-only.webp");

  const mediaDirectory = rootHandle.directories.get("media");
  const previewsDirectory = mediaDirectory.directories.get("previews");
  const previewBlob = await previewsDirectory.files.get("uuid-metadata-only.webp").readBlob();
  assert.equal(previewBlob.size > 0, true);
});

test("exportBackupPackageToDirectory reports package export progress by phase", async () => {
  const rootHandle = new FakeDirectoryHandle();
  const progressEvents = [];

  await exportBackupPackageToDirectory({
    rootHandle,
    items: [
      {
        id: "item-1",
        itemUuid: "uuid-1",
        images: {
          preview: {
            src: "data:image/webp;base64,cHJldmlldw==",
            mimeType: "image/webp"
          }
        }
      },
      {
        id: "item-2",
        itemUuid: "uuid-2",
        images: {
          preview: {
            src: "data:image/png;base64,cHJldmlldw==",
            mimeType: "image/png"
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    resolvePreviewAsset: async () => null,
    onProgress: (event) => {
      progressEvents.push(event);
    }
  });

  assert.deepEqual(progressEvents, [
    { phase: "preparing", completed: 0, total: 2 },
    { phase: "writing-previews", completed: 1, total: 2 },
    { phase: "writing-previews", completed: 2, total: 2 },
    { phase: "finalizing", completed: 2, total: 2 }
  ]);
});
