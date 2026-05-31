import test from "node:test";
import assert from "node:assert/strict";

import {
  buildImportedReferenceMetadata,
  createReferenceFromFile,
  getReferenceImportMessage,
  getOrientation,
  inferReferenceTagsFromFilename,
  importReferenceFiles,
  isSupportedReferenceImageFile,
  sanitizeEmbeddedMetadata
} from "./referenceImport.js";

function createDependencies(overrides = {}) {
  return {
    bakeItemImagePresentation: async (item) => item,
    createOriginalImageAsset: async (file) => ({
      src: `data:${file.type};base64,original:${file.name}`,
      mimeType: file.type,
      width: 3200,
      height: 2400,
      fileSize: 4096,
      originalFilename: file.name
    }),
    createPreviewImageAsset: async (file) => ({
      src: `data:image/webp;base64,preview:${file.name}`,
      mimeType: "image/webp",
      width: 1400,
      height: 1050,
      fileSize: 2048,
      originalFilename: file.name
    }),
    createThumbnailImageAsset: async (file) => ({
      src: `data:image/webp;base64,thumbnail:${file.name}`,
      mimeType: "image/webp",
      width: 480,
      height: 360,
      fileSize: 512,
      originalFilename: file.name
    }),
    createUniqueItemId: (item, items) => `${item.name || "item"}_${items.length + 1}`,
    getImportedReferenceMetadata: async (file, now) => ({
      createdAt: now(),
      importedAt: now(),
      updatedAt: now(),
      originalFilename: file.name,
      fileExtension: "png",
      fileSize: 2048,
      mimeType: file.type,
      imageWidth: 1200,
      imageHeight: 800,
      aspectRatio: 1.5,
      orientation: "landscape"
    }),
    now: () => 1234567890,
    saveItem: async () => {},
    ...overrides
  };
}

test("isSupportedReferenceImageFile accepts image mime types", () => {
  assert.equal(isSupportedReferenceImageFile({ type: "image/png" }), true);
  assert.equal(isSupportedReferenceImageFile({ type: "text/plain" }), false);
  assert.equal(isSupportedReferenceImageFile({}), false);
});

test("createReferenceFromFile applies defaults and persists the item", async () => {
  const savedItems = [];
  const file = {
    name: "Camel Coat.png",
    type: "image/png"
  };
  const item = await createReferenceFromFile(file, [], createDependencies({
    saveItem: async (nextItem) => {
      savedItems.push(nextItem);
    }
  }));

  assert.equal(item.name, "Camel Coat");
  assert.equal(item.imageUrl, "");
  assert.deepEqual(item.tags, []);
  assert.equal(item.createdAt, 1234567890);
  assert.equal(item.importedAt, 1234567890);
  assert.equal(item.updatedAt, 1234567890);
  assert.equal(item.originalFilename, "Camel Coat.png");
  assert.equal(item.fileExtension, "png");
  assert.equal(item.fileSize, 2048);
  assert.equal(item.mimeType, "image/webp");
  assert.equal(item.imageWidth, 1400);
  assert.equal(item.imageHeight, 1050);
  assert.equal(item.aspectRatio, 1.3333);
  assert.equal(item.orientation, "landscape");
  assert.equal(item.list, "Wardrobe");
  assert.equal(item.quantity, 1);
  assert.equal(item.id, "Camel Coat_1");
  assert.equal(item.originalPreserved, true);
  assert.ok(item.itemUuid);
  assert.equal(item.sourceOriginalFilename, "Camel Coat.png");
  assert.deepEqual(item.sourceFilenameAliases, []);
  assert.equal(item.sourceFileSize, 0);
  assert.equal(item.sourceImageWidth, 3200);
  assert.equal(item.sourceImageHeight, 2400);
  assert.equal(item.relinkStatus, "linked");
  assert.equal(item.images.original.src, "");
  assert.equal(item.images.preview.src, "");
  assert.equal(item.images.thumbnail.src, "");
  assert.equal(savedItems.length, 1);
  assert.equal(savedItems[0].images.original.src, "data:image/png;base64,original:Camel Coat.png");
  assert.equal(savedItems[0].images.preview.src, "data:image/webp;base64,preview:Camel Coat.png");
  assert.equal(savedItems[0].images.thumbnail.src, "data:image/webp;base64,thumbnail:Camel Coat.png");
});

test("createReferenceFromFile infers conservative metadata from filenames", async () => {
  const item = await createReferenceFromFile(
    {
      name: "guidi_boots.jpg",
      type: "image/jpeg"
    },
    [],
    createDependencies()
  );

  assert.deepEqual(item.tags, ["footwear", "guidi"]);
});

test("importReferenceFiles preserves order and continues after failures", async () => {
  const files = [
    { name: "One.png", type: "image/png" },
    { name: "Ignored.txt", type: "text/plain" },
    { name: "Broken.png", type: "image/png" },
    { name: "Two.png", type: "image/png" }
  ];
  const result = await importReferenceFiles(files, [], createDependencies({
    createPreviewImageAsset: async (file) => {
      if (file.name === "Broken.png") {
        throw new Error("broken");
      }

      return {
        src: `data:image/webp;base64,preview:${file.name}`,
        mimeType: "image/webp",
        width: 1400,
        height: 1050,
        fileSize: 2048,
        originalFilename: file.name
      };
    }
  }));

  assert.deepEqual(
    result.successfulItems.map((item) => item.name),
    ["One", "Two"]
  );
  assert.deepEqual(
    result.successfulItems.map((item) => item.id),
    ["One_1", "Two_2"]
  );
  assert.deepEqual(
    result.ignoredFiles.map((file) => file.name),
    ["Ignored.txt"]
  );
  assert.deepEqual(
    result.failedFiles.map(({ file }) => file.name),
    ["Broken.png"]
  );
});

test("buildImportedReferenceMetadata reuses known dimensions when provided", async () => {
  const metadata = await buildImportedReferenceMetadata(
    { name: "Known.png", size: 512, type: "image/png" },
    () => 321,
    {
      knownDimensions: { imageWidth: 2048, imageHeight: 1365 },
      getDimensions: async () => {
        throw new Error("should not read dimensions");
      },
      extractMetadata: async () => ({ cameraMake: "Canon" })
    }
  );

  assert.equal(metadata.imageWidth, 2048);
  assert.equal(metadata.imageHeight, 1365);
  assert.equal(metadata.aspectRatio, 1.5004);
  assert.equal(metadata.orientation, "landscape");
  assert.equal(metadata.cameraMake, "Canon");
});

test("createReferenceFromFile returns metadata-only item derived from the exact saved item", async () => {
  const item = await createReferenceFromFile(
    {
      name: "Saved Exact.png",
      type: "image/png",
      size: 2048
    },
    [],
    createDependencies({
      bakeItemImagePresentation: async (nextItem) => ({
        ...nextItem,
        imageScale: 87,
        customField: "preserved"
      }),
      saveItem: async (nextItem) => ({
        ...nextItem,
        unknownNested: { marker: "keep" }
      })
    })
  );

  assert.equal(item.imageUrl, "");
  assert.equal(item.images.preview.src, "");
  assert.equal(item.images.thumbnail.src, "");
  assert.equal(item.images.original.src, "");
  assert.equal(item.itemUuid.length > 0, true);
  assert.equal(item.imageScale, 87);
  assert.equal(item.customField, "preserved");
  assert.deepEqual(item.unknownNested, { marker: "keep" });
});

test("importReferenceFiles reports per-file progress while remaining failure tolerant", async () => {
  const progressEvents = [];
  const files = [
    { name: "One.png", type: "image/png" },
    { name: "Ignored.txt", type: "text/plain" },
    { name: "Broken.png", type: "image/png" }
  ];

  const result = await importReferenceFiles(files, [], {
    ...createDependencies({
      createPreviewImageAsset: async (file) => {
        if (file.name === "Broken.png") {
          throw new Error("broken");
        }

        return {
          src: `data:image/webp;base64,preview:${file.name}`,
          mimeType: "image/webp",
          width: 1400,
          height: 1050,
          fileSize: 2048,
          originalFilename: file.name
        };
      }
    }),
    onProgress: (event) => {
      progressEvents.push({
        fileName: event.file?.name ?? "",
        outcome: event.outcome,
        total: event.total,
        completed: event.completed,
        succeeded: event.succeeded,
        failed: event.failed,
        ignored: event.ignored
      });
    }
  });

  assert.equal(result.successfulItems.length, 1);
  assert.deepEqual(progressEvents, [
    {
      fileName: "One.png",
      outcome: "succeeded",
      total: 3,
      completed: 1,
      succeeded: 1,
      failed: 0,
      ignored: 0
    },
    {
      fileName: "Ignored.txt",
      outcome: "ignored",
      total: 3,
      completed: 2,
      succeeded: 1,
      failed: 0,
      ignored: 1
    },
    {
      fileName: "Broken.png",
      outcome: "failed",
      total: 3,
      completed: 3,
      succeeded: 1,
      failed: 1,
      ignored: 1
    }
  ]);
});

test("inferReferenceTagsFromFilename recognizes interior and material keywords", () => {
  assert.deepEqual(
    inferReferenceTagsFromFilename("interior_room.jpg"),
    ["interior"]
  );

  assert.deepEqual(
    inferReferenceTagsFromFilename("fabric_texture_study.png"),
    ["texture", "material"]
  );
});

test("inferReferenceTagsFromFilename leaves unknown filenames mostly empty", () => {
  assert.deepEqual(
    inferReferenceTagsFromFilename("scan_2026_05_01.jpg"),
    []
  );
});

test("getOrientation returns square, portrait, and landscape", () => {
  assert.equal(getOrientation(1000, 980), "square");
  assert.equal(getOrientation(800, 1200), "portrait");
  assert.equal(getOrientation(1200, 800), "landscape");
});

test("sanitizeEmbeddedMetadata prefers DateTimeOriginal and excludes GPS data", () => {
  const metadata = sanitizeEmbeddedMetadata({
    DateTimeOriginal: new Date("2024-02-03T10:11:12Z"),
    CreateDate: new Date("2023-01-01T00:00:00Z"),
    ModifyDate: new Date("2022-01-01T00:00:00Z"),
    Make: "Canon",
    Model: "R6",
    LensModel: "50mm",
    FocalLength: 50,
    FNumber: 1.8,
    ExposureTime: "1/125",
    ISO: 400,
    ColorSpace: "sRGB",
    GPSLatitude: 1,
    GPSLongitude: 2
  });

  assert.equal(metadata.capturedAt, Date.parse("2024-02-03T10:11:12Z"));
  assert.equal(metadata.originalCreatedAt, Date.parse("2024-02-03T10:11:12Z"));
  assert.equal(metadata.cameraMake, "Canon");
  assert.equal(metadata.cameraModel, "R6");
  assert.equal(metadata.lensModel, "50mm");
  assert.equal(metadata.focalLength, "50");
  assert.equal(metadata.fNumber, "1.8");
  assert.equal(metadata.exposureTime, "1/125");
  assert.equal(metadata.iso, "400");
  assert.equal(metadata.colorSpace, "sRGB");
  assert.equal("GPSLatitude" in metadata, false);
  assert.equal("GPSLongitude" in metadata, false);
});

test("buildImportedReferenceMetadata prefers CreateDate then ModifyDate when needed", async () => {
  const file = {
    name: "Photo.JPG",
    size: 4096,
    type: "image/jpeg"
  };
  const metadataFromCreateDate = await buildImportedReferenceMetadata(file, () => 111, {
    getDimensions: async () => ({ imageWidth: 900, imageHeight: 1200 }),
    extractMetadata: async () => sanitizeEmbeddedMetadata({
      CreateDate: new Date("2020-06-01T00:00:00Z"),
      ModifyDate: new Date("2019-06-01T00:00:00Z")
    })
  });
  const metadataFromModifyDate = await buildImportedReferenceMetadata(file, () => 222, {
    getDimensions: async () => ({ imageWidth: 900, imageHeight: 1200 }),
    extractMetadata: async () => sanitizeEmbeddedMetadata({
      ModifyDate: new Date("2019-06-01T00:00:00Z")
    })
  });

  assert.equal(metadataFromCreateDate.capturedAt, Date.parse("2020-06-01T00:00:00Z"));
  assert.equal(metadataFromModifyDate.capturedAt, Date.parse("2019-06-01T00:00:00Z"));
  assert.equal(metadataFromCreateDate.originalFilename, "Photo.JPG");
  assert.equal(metadataFromCreateDate.fileExtension, "jpg");
  assert.equal(metadataFromCreateDate.fileSize, 4096);
  assert.equal(metadataFromCreateDate.mimeType, "image/jpeg");
  assert.equal(metadataFromCreateDate.imageWidth, 900);
  assert.equal(metadataFromCreateDate.imageHeight, 1200);
  assert.equal(metadataFromCreateDate.aspectRatio, 0.75);
  assert.equal(metadataFromCreateDate.orientation, "portrait");
});

test("buildImportedReferenceMetadata tolerates missing EXIF metadata", async () => {
  const metadata = await buildImportedReferenceMetadata(
    { name: "Plain.png", size: 512, type: "image/png" },
    () => 999,
    {
      getDimensions: async () => ({ imageWidth: 1000, imageHeight: 1000 }),
      extractMetadata: async () => {
        throw new Error("no exif");
      }
    }
  );

  assert.equal(metadata.createdAt, 999);
  assert.equal(metadata.importedAt, 999);
  assert.equal(metadata.updatedAt, 999);
  assert.equal(metadata.capturedAt, undefined);
  assert.equal(metadata.orientation, "square");
});

test("getReferenceImportMessage summarizes mixed outcomes", () => {
  const message = getReferenceImportMessage({
    successfulItems: [{ id: "1" }, { id: "2" }],
    ignoredFiles: [{ name: "Ignored.txt" }],
    failedFiles: [{ file: { name: "Broken.png" }, error: new Error("broken") }]
  });

  assert.equal(
    message,
    "Imported 2 references. Ignored 1 unsupported file. 1 image file failed to import."
  );
});

test("getReferenceImportMessage reports when no supported images are provided", () => {
  const message = getReferenceImportMessage({
    successfulItems: [],
    ignoredFiles: [{ name: "Ignored.txt" }],
    failedFiles: []
  });

  assert.equal(message, "No supported image files were selected.");
});
