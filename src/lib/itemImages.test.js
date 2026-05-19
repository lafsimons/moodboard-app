import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPreviewImageFields,
  getOriginalImageAsset,
  getOriginalImageSrc,
  getPreviewImageAsset,
  getPreviewImageSrc,
  getThumbnailImageAsset,
  getThumbnailImageSrc,
  materializeItemImagesForExport,
  normalizeItemImages,
  replaceItemImageSet,
  replaceItemOriginalImage
} from "./itemImages.js";

test("normalizeItemImages migrates legacy single-image items without wiping metadata", () => {
  const item = {
    id: "1",
    imageUrl: "data:image/webp;base64,legacy",
    imageWidth: 1200,
    imageHeight: 800,
    mimeType: "image/webp",
    fileSize: 2048,
    originalFilename: "legacy.png",
    favorite: true,
    description: "note",
    imageCropWidth: 75
  };

  const normalized = normalizeItemImages(item);

  assert.deepEqual(normalized.preview, {
    src: "data:image/webp;base64,legacy",
    mimeType: "image/webp",
    width: 1200,
    height: 800,
    fileSize: 2048,
    originalFilename: "legacy.png"
  });
  assert.deepEqual(normalized.original, {
    src: "",
    mimeType: "",
    width: 0,
    height: 0,
    fileSize: 0,
    originalFilename: ""
  });
  assert.deepEqual(normalized.thumbnail, {
    src: "",
    mimeType: "",
    width: 0,
    height: 0,
    fileSize: 0,
    originalFilename: ""
  });
  assert.equal(normalized.originalPreserved, false);
  assert.equal(item.favorite, true);
  assert.equal(item.description, "note");
  assert.equal(item.imageCropWidth, 75);
});

test("normalizeItemImages preserves unknown nested image asset fields during normalization", () => {
  const normalized = normalizeItemImages({
    images: {
      original: {
        src: "data:image/png;base64,original",
        mimeType: "image/png",
        width: 2400,
        height: 1800,
        originalFilename: "original.png",
        assetKey: "orig-1",
        checksum: "abc123"
      },
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 1200,
        height: 900,
        originalFilename: "preview.png",
        cdnPath: "/portable/preview.webp"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb",
        mimeType: "image/webp",
        width: 480,
        height: 360,
        originalFilename: "thumb.png",
        dominantColor: "#111111"
      }
    }
  });

  assert.equal(normalized.original.assetKey, "orig-1");
  assert.equal(normalized.original.checksum, "abc123");
  assert.equal(normalized.preview.cdnPath, "/portable/preview.webp");
  assert.equal(normalized.thumbnail.dominantColor, "#111111");
});

test("normalizeItemImages defaults originalPreserved to false when missing even if original src exists", () => {
  const normalized = normalizeItemImages({
    images: {
      original: {
        src: "data:image/png;base64,original"
      }
    }
  });

  assert.equal(normalized.original.src, "data:image/png;base64,original");
  assert.equal(normalized.originalPreserved, false);
});

test("normalizeItemImages preserves explicit originalPreserved true", () => {
  const normalized = normalizeItemImages({
    images: {
      original: {
        src: "data:image/png;base64,original"
      }
    },
    originalPreserved: true
  });

  assert.equal(normalized.originalPreserved, true);
});

test("image src helpers fall back across original preview and thumbnail without duplicating runtime state", () => {
  const item = {
    imageUrl: "data:image/webp;base64,preview",
    imageWidth: 1000,
    imageHeight: 700,
    images: {
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 1000,
        height: 700
      }
    },
    originalPreserved: false
  };

  assert.equal(getPreviewImageSrc(item), "data:image/webp;base64,preview");
  assert.equal(getOriginalImageSrc(item), "data:image/webp;base64,preview");
  assert.equal(getThumbnailImageSrc(item), "data:image/webp;base64,preview");
  assert.deepEqual(getOriginalImageAsset(item), getPreviewImageAsset(item));
  assert.deepEqual(getThumbnailImageAsset(item), getPreviewImageAsset(item));
});

test("materializeItemImagesForExport duplicates fallback images only in exported shape", () => {
  const item = {
    imageUrl: "data:image/webp;base64,preview",
    imageWidth: 1000,
    imageHeight: 700,
    mimeType: "image/webp",
    fileSize: 1200,
    originalFilename: "preview.png"
  };

  assert.deepEqual(materializeItemImagesForExport(item), {
    original: {
      src: "data:image/webp;base64,preview",
      mimeType: "image/webp",
      width: 1000,
      height: 700,
      fileSize: 1200,
      originalFilename: "preview.png"
    },
    preview: {
      src: "data:image/webp;base64,preview",
      mimeType: "image/webp",
      width: 1000,
      height: 700,
      fileSize: 1200,
      originalFilename: "preview.png"
    },
    thumbnail: {
      src: "data:image/webp;base64,preview",
      mimeType: "image/webp",
      width: 1000,
      height: 700,
      fileSize: 1200,
      originalFilename: "preview.png"
    }
  });
});

test("replaceItemImageSet replaces original preview and thumbnail and syncs preview-facing fields", () => {
  const nextItem = replaceItemImageSet(
    {
      id: "1",
      name: "Look",
      favorite: true,
      tags: ["archive"]
    },
    {
      original: {
        src: "data:image/png;base64,original",
        mimeType: "image/png",
        width: 3000,
        height: 2400,
        fileSize: 9500,
        originalFilename: "look.png"
      },
      preview: {
        src: "data:image/webp;base64,preview",
        mimeType: "image/webp",
        width: 1400,
        height: 1120,
        fileSize: 2100,
        originalFilename: "look.png"
      },
      thumbnail: {
        src: "data:image/webp;base64,thumb",
        mimeType: "image/webp",
        width: 480,
        height: 384,
        fileSize: 400,
        originalFilename: "look.png"
      }
    }
  );

  assert.equal(nextItem.originalPreserved, true);
  assert.equal(nextItem.imageUrl, "data:image/webp;base64,preview");
  assert.equal(nextItem.mimeType, "image/webp");
  assert.equal(nextItem.imageWidth, 1400);
  assert.equal(nextItem.imageHeight, 1120);
  assert.equal(nextItem.favorite, true);
  assert.deepEqual(nextItem.tags, ["archive"]);
  assert.equal(nextItem.images.original.src, "data:image/png;base64,original");
  assert.equal(nextItem.images.thumbnail.src, "data:image/webp;base64,thumb");
});

test("replaceItemOriginalImage updates only original by default and sets originalPreserved true", () => {
  const nextItem = replaceItemOriginalImage(
    {
      imageUrl: "data:image/webp;base64,preview",
      imageWidth: 1000,
      imageHeight: 700,
      mimeType: "image/webp",
      fileSize: 1200,
      originalFilename: "preview.png",
      images: {
        preview: {
          src: "data:image/webp;base64,preview",
          mimeType: "image/webp",
          width: 1000,
          height: 700,
          fileSize: 1200,
          originalFilename: "preview.png"
        }
      },
      originalPreserved: false,
      favorite: true,
      description: "kept"
    },
    {
      src: "data:image/png;base64,original",
      mimeType: "image/png",
      width: 3000,
      height: 2100,
      fileSize: 9000,
      originalFilename: "archive.png"
    }
  );

  assert.equal(nextItem.originalPreserved, true);
  assert.equal(nextItem.imageUrl, "data:image/webp;base64,preview");
  assert.equal(nextItem.originalFilename, "preview.png");
  assert.equal(nextItem.favorite, true);
  assert.equal(nextItem.description, "kept");
  assert.equal(nextItem.images.original.originalFilename, "archive.png");
  assert.equal(nextItem.images.preview.src, "data:image/webp;base64,preview");
});

test("replaceItemOriginalImage can regenerate preview and thumbnail while preserving other metadata", () => {
  const nextItem = replaceItemOriginalImage(
    {
      imageUrl: "data:image/webp;base64,preview",
      imageWidth: 1000,
      imageHeight: 700,
      mimeType: "image/webp",
      fileSize: 1200,
      originalFilename: "preview.png",
      favorite: true
    },
    {
      src: "data:image/png;base64,original",
      mimeType: "image/png",
      width: 3000,
      height: 2100,
      fileSize: 9000,
      originalFilename: "archive.png"
    },
    {
      regenerateOptimizedAssets: true,
      previewAsset: {
        src: "data:image/webp;base64,next-preview",
        mimeType: "image/webp",
        width: 1600,
        height: 1120,
        fileSize: 1800,
        originalFilename: "archive.png"
      },
      thumbnailAsset: {
        src: "data:image/webp;base64,next-thumb",
        mimeType: "image/webp",
        width: 480,
        height: 336,
        fileSize: 300,
        originalFilename: "archive.png"
      }
    }
  );

  assert.equal(nextItem.originalPreserved, true);
  assert.equal(nextItem.imageUrl, "data:image/webp;base64,next-preview");
  assert.equal(nextItem.imageWidth, 1600);
  assert.equal(nextItem.images.thumbnail.src, "data:image/webp;base64,next-thumb");
  assert.equal(nextItem.favorite, true);
});

test("applyPreviewImageFields recalculates preview-facing metadata", () => {
  const nextItem = applyPreviewImageFields(
    { imageUrl: "", imageWidth: 0, imageHeight: 0, aspectRatio: 0, orientation: "" },
    {
      src: "data:image/webp;base64,preview",
      mimeType: "image/webp",
      width: 1200,
      height: 1180,
      fileSize: 1234,
      originalFilename: "preview.png"
    }
  );

  assert.equal(nextItem.aspectRatio, 1.0169);
  assert.equal(nextItem.orientation, "square");
});
