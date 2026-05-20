const DEMO_REFERENCE_BASE_TIMESTAMP = Date.UTC(2024, 0, 1, 12, 0, 0);

const demoReferenceDefinitions = [
  { file: "tt-1-aw21-image1.jpg", width: 1200, height: 1219, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 001" },
  { file: "tt-1-aw21-image134.jpg", width: 1600, height: 1200, orientation: "landscape", extension: "jpg", label: "TT AW21 Image 134" },
  { file: "tt-1-aw21-image2.jpg", width: 1200, height: 1219, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 002" },
  { file: "tt-1-aw21-image22.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 022" },
  { file: "tt-1-aw21-image23.jpg", width: 800, height: 1006, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 023" },
  { file: "tt-1-aw21-image238.jpg", width: 1920, height: 1920, orientation: "square", extension: "jpg", label: "TT AW21 Image 238" },
  { file: "tt-1-aw21-image251.jpg", width: 1284, height: 1614, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 251" },
  { file: "tt-1-aw21-image253.png", width: 2400, height: 3000, orientation: "portrait", extension: "png", label: "TT AW21 Image 253" },
  { file: "tt-1-aw21-image28.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 028" },
  { file: "tt-1-aw21-image29.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 029" },
  { file: "tt-1-aw21-image3.jpg", width: 1200, height: 1217, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 003" },
  { file: "tt-1-aw21-image30.jpg", width: 800, height: 1006, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 030" },
  { file: "tt-1-aw21-image32.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 032" },
  { file: "tt-1-aw21-image34.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 034" },
  { file: "tt-1-aw21-image35.jpg", width: 800, height: 1006, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 035" },
  { file: "tt-1-aw21-image36.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 036" },
  { file: "tt-1-aw21-image38.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 038" },
  { file: "tt-1-aw21-image4.jpg", width: 1200, height: 1219, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 004" },
  { file: "tt-1-aw21-image41.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 041" },
  { file: "tt-1-aw21-image42.jpg", width: 800, height: 1006, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 042" },
  { file: "tt-1-aw21-image44.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 044" },
  { file: "tt-1-aw21-image45.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 045" },
  { file: "tt-1-aw21-image47.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 047" },
  { file: "tt-1-aw21-image49.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 049" },
  { file: "tt-1-aw21-image5.jpg", width: 1200, height: 1218, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 005" },
  { file: "tt-1-aw21-image50.jpg", width: 2400, height: 3000, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 050" },
  { file: "tt-1-aw21-image55.jpg", width: 800, height: 1007, orientation: "portrait", extension: "jpg", label: "TT AW21 Image 055" },
  { file: "tt-1-aw21-image89.png", width: 1600, height: 2072, orientation: "portrait", extension: "png", label: "TT AW21 Image 089" },
  { file: "tt-1-aw21-image90.png", width: 1600, height: 1960, orientation: "portrait", extension: "png", label: "TT AW21 Image 090" },
  { file: "tt-1-aw21-image91.png", width: 1600, height: 1961, orientation: "portrait", extension: "png", label: "TT AW21 Image 091" },
  { file: "tt-1-aw21-image92.png", width: 1600, height: 1096, orientation: "landscape", extension: "png", label: "TT AW21 Image 092" },
  { file: "tt-1-aw21-image93.png", width: 1600, height: 1028, orientation: "landscape", extension: "png", label: "TT AW21 Image 093" },
  { file: "tt-1-aw21-image94.png", width: 1600, height: 1076, orientation: "landscape", extension: "png", label: "TT AW21 Image 094" },
  { file: "tt-1-aw21-image95.png", width: 1600, height: 1086, orientation: "landscape", extension: "png", label: "TT AW21 Image 095" }
];

function getMimeType(extension) {
  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "avif") {
    return "image/avif";
  }

  return "image/jpeg";
}

function createDemoImageAsset(imageUrl, definition) {
  return {
    src: imageUrl,
    mimeType: getMimeType(definition.extension),
    width: definition.width,
    height: definition.height,
    fileSize: 0,
    originalFilename: definition.file
  };
}

function createDemoReferenceId(file) {
  return `demo_reference_${file}`
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function createDemoReference(definition, index, total) {
  const imageUrl = `/images/${definition.file}`;
  const createdAt = DEMO_REFERENCE_BASE_TIMESTAMP + (total - index) * 1000;
  const imageAsset = createDemoImageAsset(imageUrl, definition);

  return {
    id: createDemoReferenceId(definition.file),
    itemUuid: `demo-${createDemoReferenceId(definition.file)}`,
    name: definition.label,
    description: `Bundled MBA demo reference from the TT AW21 validation set.`,
    imageUrl,
    images: {
      original: { ...imageAsset },
      preview: { ...imageAsset },
      thumbnail: { ...imageAsset }
    },
    originalPreserved: true,
    imageScale: 100,
    imageFrameScale: 100,
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageCropX: 0,
    imageCropY: 0,
    imageCropWidth: 100,
    imageCropHeight: 100,
    value: "",
    retailValue: "",
    brand: "TT AW21 Demo",
    tags: [
      "demo",
      "collection/tt-aw21",
      `orientation/${definition.orientation}`,
      `format/${definition.extension}`
    ],
    type: "Reference",
    createdAt,
    importedAt: createdAt,
    updatedAt: createdAt,
    sourceNamespace: "demo-library",
    sourceRelativePath: `images/${definition.file}`,
    sourceOriginalFilename: definition.file,
    sourceFileSize: 0,
    sourceImageWidth: definition.width,
    sourceImageHeight: definition.height,
    sourceLastModified: createdAt,
    relinkStatus: "linked",
    originalFilename: definition.file,
    fileExtension: definition.extension,
    fileSize: 0,
    mimeType: imageAsset.mimeType,
    imageWidth: definition.width,
    imageHeight: definition.height,
    aspectRatio: Number((definition.width / definition.height).toFixed(4)),
    orientation: definition.orientation,
    capturedAt: 0,
    originalCreatedAt: 0,
    cameraMake: "",
    cameraModel: "",
    lensModel: "",
    focalLength: "",
    fNumber: "",
    exposureTime: "",
    iso: "",
    colorSpace: "",
    colorProfile: "",
    size: "",
    favorite: definition.orientation !== "portrait",
    garmentType: "Top",
    layerType: "Both",
    accessorySlot: "",
    color: "",
    weight: "",
    list: "Wardrobe",
    quantity: 1,
    styleTags: [],
    climateTags: []
  };
}

const defaultWardrobe = demoReferenceDefinitions.map((definition, index, definitions) =>
  createDemoReference(definition, index, definitions.length)
);

export default defaultWardrobe;
