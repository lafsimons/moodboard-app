import { normalizeItemImages } from "./itemImages.js";

export function getBackupExportMaterializationPlan(item) {
  const normalizedImages = normalizeItemImages(item);

  return {
    needsPreview: !normalizedImages.preview.src,
    needsThumbnail: false,
    needsOriginal: false
  };
}
