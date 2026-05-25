import test from "node:test";
import assert from "node:assert/strict";
import { getBackupExportMaterializationPlan } from "./backupExportPolicy.js";

test("getBackupExportMaterializationPlan skips extra loads when inline preview exists", () => {
  assert.deepEqual(
    getBackupExportMaterializationPlan({
      images: {
        preview: {
          src: "data:image/webp;base64,preview"
        }
      }
    }),
    {
      needsPreview: false,
      needsThumbnail: false,
      needsOriginal: false
    }
  );
});

test("getBackupExportMaterializationPlan requires preview when preview src is missing", () => {
  assert.deepEqual(
    getBackupExportMaterializationPlan({
      images: {
        preview: {
          src: "",
          mimeType: "image/webp",
          width: 100,
          height: 100
        }
      }
    }),
    {
      needsPreview: true,
      needsThumbnail: false,
      needsOriginal: false
    }
  );
});

test("getBackupExportMaterializationPlan does not request original blobs for preserved originals", () => {
  assert.deepEqual(
    getBackupExportMaterializationPlan({
      originalPreserved: true,
      images: {
        original: {
          src: "",
          mimeType: "image/png",
          width: 3000,
          height: 2000
        },
        preview: {
          src: "data:image/webp;base64,preview"
        }
      }
    }),
    {
      needsPreview: false,
      needsThumbnail: false,
      needsOriginal: false
    }
  );
});

test("getBackupExportMaterializationPlan does not request thumbnail payloads when thumbnail src is missing", () => {
  assert.deepEqual(
    getBackupExportMaterializationPlan({
      images: {
        preview: {
          src: "data:image/webp;base64,preview"
        },
        thumbnail: {
          src: "",
          mimeType: "image/webp",
          width: 50,
          height: 50
        }
      }
    }),
    {
      needsPreview: false,
      needsThumbnail: false,
      needsOriginal: false
    }
  );
});
