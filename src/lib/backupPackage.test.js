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
  PACKAGE_WARNINGS_FILE,
  buildBackupPackageAppState,
  buildBackupPackageItemRecord,
  buildBackupPackageManifest,
  exportBackupPackageToDirectory,
  getBackupPackagePreviewFileName,
  isFileSystemAccessSupported,
  prepareBackupPackageImportFromDirectory,
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

  async getFile() {
    return this.readBlob();
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
    provenance: {
      lastBackupExportAt: "2026-05-26T12:00:00.000Z",
      itemCountSnapshot: 3
    },
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
  assert.equal(appState.provenance.lastBackupExportAt, "2026-05-26T12:00:00.000Z");
  assert.equal(appState.provenance.itemCountSnapshot, 3);
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

test("exportBackupPackageToDirectory keeps exporting metadata when preview media is missing and writes warnings", async () => {
  const rootHandle = new FakeDirectoryHandle();

  const result = await exportBackupPackageToDirectory({
    rootHandle,
    items: [
      {
        id: "item-missing-preview",
        itemUuid: "uuid-missing-preview",
        name: "Missing Preview",
        tags: ["damaged"],
        images: {
          preview: {
            src: "",
            mimeType: "image/webp",
            width: 640,
            height: 480
          }
        }
      },
      {
        id: "item-healthy-preview",
        itemUuid: "uuid-healthy-preview",
        name: "Healthy Preview",
        images: {
          preview: {
            src: "data:image/webp;base64,cHJldmlldw==",
            mimeType: "image/webp",
            width: 320,
            height: 240
          }
        }
      }
    ],
    appState: {
      savedOutfits: []
    },
    resolvePreviewAsset: async (item) => {
      if (item.id === "item-missing-preview") {
        return null;
      }

      return null;
    }
  });

  assert.equal(result.itemCount, 2);
  assert.equal(result.previewFileCount, 1);
  assert.equal(result.warningCount, 1);
  assert.equal(result.warningReportFileName, PACKAGE_WARNINGS_FILE);
  assert.equal(result.warnings[0].id, "item-missing-preview");

  const itemsText = await rootHandle.files.get(PACKAGE_ITEMS_FILE).readText();
  const records = itemsText.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(records.length, 2);
  assert.equal("packagePath" in records[0].images.preview, false);
  assert.equal(records[1].images.preview.packagePath, "media/previews/uuid-healthy-preview.webp");

  const warningReportText = await rootHandle.files.get(PACKAGE_WARNINGS_FILE).readText();
  const warningReport = JSON.parse(warningReportText);
  assert.equal(warningReport.warningCount, 1);
  assert.equal(warningReport.warnings[0].id, "item-missing-preview");
});

test("prepareBackupPackageImportFromDirectory accepts metadata-only damaged items without preview package paths", async () => {
  const rootHandle = new FakeDirectoryHandle();
  const manifest = buildBackupPackageManifest({
    exportedAt: "2026-05-25T12:00:00.000Z",
    itemCount: 1,
    previewFileCount: 0
  });
  const appState = buildBackupPackageAppState({
    savedOutfits: []
  });
  const mediaDirectory = await rootHandle.getDirectoryHandle("media", { create: true });
  await mediaDirectory.getDirectoryHandle("previews", { create: true });
  await seedPackageFile(rootHandle, PACKAGE_MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  await seedPackageFile(rootHandle, PACKAGE_APP_STATE_FILE, JSON.stringify(appState, null, 2));
  await seedPackageFile(
    rootHandle,
    PACKAGE_ITEMS_FILE,
    `${JSON.stringify({
      id: "item-damaged",
      itemUuid: "uuid-damaged",
      name: "Damaged",
      originalPreserved: false,
      images: {
        original: {
          src: "",
          mimeType: "",
          width: 0,
          height: 0
        },
        preview: {
          src: "",
          mimeType: "image/webp",
          width: 640,
          height: 480
        },
        thumbnail: {
          src: "",
          mimeType: "",
          width: 0,
          height: 0
        }
      }
    })}\n`,
    "application/x-ndjson"
  );

  const prepared = await prepareBackupPackageImportFromDirectory(rootHandle);

  assert.equal(prepared.items.length, 1);
  assert.equal(prepared.itemMediaAssets.length, 0);
  assert.equal(prepared.items[0].id, "item-damaged");
  assert.equal(prepared.items[0].images.preview.src, "");
});

async function seedPackageFile(directoryHandle, fileName, value, type = "application/json") {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  fileHandle.chunks = [];
  fileHandle.closed = false;
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([value], { type }));
  await writable.close();
}

async function createValidImportPackageRoot() {
  const rootHandle = new FakeDirectoryHandle();
  const manifest = buildBackupPackageManifest({
    exportedAt: "2026-05-25T12:00:00.000Z",
    itemCount: 1,
    previewFileCount: 1
  });
  const appState = buildBackupPackageAppState({
    savedOutfits: []
  });
  const mediaDirectory = await rootHandle.getDirectoryHandle("media", { create: true });
  const previewsDirectory = await mediaDirectory.getDirectoryHandle("previews", { create: true });
  await seedPackageFile(rootHandle, PACKAGE_MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  await seedPackageFile(rootHandle, PACKAGE_APP_STATE_FILE, JSON.stringify(appState, null, 2));
  await seedPackageFile(
    rootHandle,
    PACKAGE_ITEMS_FILE,
    `${JSON.stringify({
      id: "item-1",
      itemUuid: "uuid-1",
      originalPreserved: false,
      images: {
        preview: {
          mimeType: "image/webp",
          width: 640,
          height: 480,
          fileSize: 1234,
          originalFilename: "preview.webp",
          packagePath: "media/previews/item-1.webp"
        }
      }
    })}\n`,
    "application/x-ndjson"
  );
  await seedPackageFile(previewsDirectory, "item-1.webp", "preview-binary", "image/webp");

  return rootHandle;
}

test("prepareBackupPackageImportFromDirectory stages metadata-only items and preview blobs", async () => {
  const rootHandle = await createValidImportPackageRoot();
  rootHandle.name = "mba-archive-package";
  const progressEvents = [];

  const prepared = await prepareBackupPackageImportFromDirectory(rootHandle, {
    onProgress: (event) => {
      progressEvents.push(event);
    }
  });

  assert.equal(prepared.items.length, 1);
  assert.equal(prepared.items[0].id, "item-1");
  assert.equal(prepared.items[0].imageUrl, "");
  assert.equal(prepared.items[0].images.preview.src, "");
  assert.equal("packagePath" in prepared.items[0].images.preview, false);
  assert.equal(prepared.itemMediaAssets.length, 1);
  assert.equal(prepared.itemMediaAssets[0].itemId, "item-1");
  assert.equal(prepared.itemMediaAssets[0].variant, "preview");
  assert.equal(prepared.itemMediaAssets[0].asset.blob instanceof Blob, true);
  assert.equal(prepared.backupName, "mba-archive-package");
  assert.deepEqual(progressEvents, [
    { phase: "reading-manifest", completed: 0, total: 0 },
    { phase: "reading-app-state", completed: 0, total: 0 },
    { phase: "validating-items", completed: 0, total: 1 },
    { phase: "validating-items", completed: 1, total: 1 },
    { phase: "verifying-previews", completed: 1, total: 1 },
    { phase: "preparing-import", completed: 1, total: 1 }
  ]);
});

test("prepareBackupPackageImportFromDirectory rejects duplicate item ids", async () => {
  const rootHandle = await createValidImportPackageRoot();
  await seedPackageFile(
    rootHandle,
    PACKAGE_ITEMS_FILE,
    `${JSON.stringify({ id: "item-1", images: { preview: { packagePath: "media/previews/item-1.webp" } } })}\n${JSON.stringify({ id: "item-1", images: { preview: { packagePath: "media/previews/item-1.webp" } } })}\n`,
    "application/x-ndjson"
  );
  await assert.rejects(() => prepareBackupPackageImportFromDirectory(rootHandle), /duplicated/i);
});

test("prepareBackupPackageImportFromDirectory rejects embedded image data payloads", async () => {
  const rootHandle = await createValidImportPackageRoot();
  await seedPackageFile(
    rootHandle,
    PACKAGE_ITEMS_FILE,
    `${JSON.stringify({
      id: "item-1",
      imageUrl: "data:image/webp;base64,cHJldmlldw==",
      images: { preview: { packagePath: "media/previews/item-1.webp" } }
    })}\n`,
    "application/x-ndjson"
  );
  await assert.rejects(() => prepareBackupPackageImportFromDirectory(rootHandle), /embedded image data/i);
});

test("prepareBackupPackageImportFromDirectory rejects invalid preview package paths", async () => {
  const rootHandle = await createValidImportPackageRoot();
  await seedPackageFile(
    rootHandle,
    PACKAGE_ITEMS_FILE,
    `${JSON.stringify({
      id: "item-1",
      images: { preview: { packagePath: "media/previews/nested/item-1.webp" } }
    })}\n`,
    "application/x-ndjson"
  );
  await assert.rejects(() => prepareBackupPackageImportFromDirectory(rootHandle), /preview path/i);
});

test("prepareBackupPackageImportFromDirectory rejects missing preview files", async () => {
  const rootHandle = await createValidImportPackageRoot();
  const mediaDirectory = rootHandle.directories.get("media");
  const previewsDirectory = mediaDirectory.directories.get("previews");
  previewsDirectory.files.delete("item-1.webp");

  await assert.rejects(() => prepareBackupPackageImportFromDirectory(rootHandle), /missing/i);
});

test("prepareBackupPackageImportFromDirectory rejects manifest item count mismatches", async () => {
  const rootHandle = await createValidImportPackageRoot();
  const mismatchedManifest = buildBackupPackageManifest({
    exportedAt: "2026-05-25T12:00:00.000Z",
    itemCount: 2,
    previewFileCount: 1
  });
  await seedPackageFile(rootHandle, PACKAGE_MANIFEST_FILE, JSON.stringify(mismatchedManifest, null, 2));

  await assert.rejects(() => prepareBackupPackageImportFromDirectory(rootHandle), /item count/i);
});

test("prepareBackupPackageImportFromDirectory rejects manifest preview count mismatches", async () => {
  const rootHandle = await createValidImportPackageRoot();
  const mismatchedManifest = buildBackupPackageManifest({
    exportedAt: "2026-05-25T12:00:00.000Z",
    itemCount: 1,
    previewFileCount: 2
  });
  await seedPackageFile(rootHandle, PACKAGE_MANIFEST_FILE, JSON.stringify(mismatchedManifest, null, 2));

  await assert.rejects(() => prepareBackupPackageImportFromDirectory(rootHandle), /preview file count/i);
});
