import test from "node:test";
import assert from "node:assert/strict";

import { analyzeBackupData } from "./backupAnalysis.js";

test("analyzeBackupData reports top-level size and inline image duplication", () => {
  const preview = "data:image/webp;base64,QUJDRA==";
  const thumbnail = "data:image/webp;base64,VEhVTUI=";
  const original = "data:image/png;base64,T1JJR0lOQUw=";
  const analysis = analyzeBackupData({
    source: "moodboard-app",
    version: 2,
    exportedAt: "2026-05-21T00:00:00.000Z",
    items: [
      {
        id: "item-1",
        imageUrl: preview,
        mimeType: "image/webp",
        imageWidth: 1400,
        imageHeight: 1050,
        fileSize: 100,
        originalFilename: "one.png",
        images: {
          original: { src: original, mimeType: "image/png", width: 3000, height: 2200, fileSize: 300, originalFilename: "one.png" },
          preview: { src: preview, mimeType: "image/webp", width: 1400, height: 1050, fileSize: 100, originalFilename: "one.png" },
          thumbnail: { src: thumbnail, mimeType: "image/webp", width: 520, height: 390, fileSize: 20, originalFilename: "one.png" }
        }
      },
      {
        id: "item-2",
        imageUrl: preview,
        mimeType: "image/webp",
        imageWidth: 1400,
        imageHeight: 1050,
        fileSize: 100,
        originalFilename: "two.png",
        images: {
          original: { src: "", mimeType: "image/png", width: 3000, height: 2200, fileSize: 300, originalFilename: "two.png" },
          preview: { src: preview, mimeType: "image/webp", width: 1400, height: 1050, fileSize: 100, originalFilename: "two.png" },
          thumbnail: { src: thumbnail, mimeType: "image/webp", width: 520, height: 390, fileSize: 20, originalFilename: "two.png" }
        }
      }
    ],
    appState: {
      savedOutfits: [
        {
          id: "saved-1",
          board: {
            id: "board-1",
            images: [
              { id: "board-image-1", referenceId: "item-1" }
            ]
          }
        }
      ]
    }
  });

  assert.equal(analysis.largestTopLevelField.key, "items");
  assert.equal(analysis.itemCount, 2);
  assert.equal(analysis.embeddedDataUrlStats.itemsWithEmbeddedData, 2);
  assert.equal(analysis.embeddedDataUrlStats.itemsWithMultipleEmbeddedDataUrls, 2);
  assert.equal(analysis.embeddedDataUrlStats.itemsWithDuplicatedPreviewMirror, 2);
  assert.equal(analysis.embeddedDataUrlStats.pathStats.imageUrl.count, 2);
  assert.equal(analysis.embeddedDataUrlStats.pathStats["images.preview.src"].count, 2);
  assert.equal(analysis.embeddedDataUrlStats.pathStats["images.thumbnail.src"].count, 2);
  assert.equal(analysis.savedBoardEmbeddedData.count, 0);
  assert.equal(analysis.previewMirrorFieldBreakdown[0].topLevelField, "imageUrl");
  assert.equal(analysis.previewMirrorFieldBreakdown[0].matchingItemCount, 2);
  assert.equal(analysis.embeddedDataUrlStats.duplicatePayloadGroups.length >= 2, true);
});
