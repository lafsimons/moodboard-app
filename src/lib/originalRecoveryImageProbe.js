function normalizePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

export async function probeOriginalRecoveryImageMetadata(file) {
  if (!file?.type?.startsWith?.("image/")) {
    throw new Error("Selected file is not an image.");
  }

  if (typeof URL?.createObjectURL !== "function" || typeof URL?.revokeObjectURL !== "function") {
    throw new Error("Object URL image probing is unavailable.");
  }

  if (typeof Image !== "function") {
    throw new Error("Image probing is unavailable.");
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    const dimensions = await new Promise((resolve, reject) => {
      image.onload = () => {
        resolve({
          width: normalizePositiveNumber(image.naturalWidth),
          height: normalizePositiveNumber(image.naturalHeight)
        });
      };
      image.onerror = () => {
        reject(new Error("Image metadata could not be read."));
      };
      image.src = objectUrl;
    });

    return {
      width: dimensions.width,
      height: dimensions.height,
      mimeType: typeof file.type === "string" ? file.type : "",
      fileSize: normalizePositiveNumber(file.size),
      lastModified: normalizePositiveNumber(file.lastModified),
      originalFilename: typeof file.name === "string" ? file.name.trim() : ""
    };
  } finally {
    image.onload = null;
    image.onerror = null;

    try {
      image.src = "";
    } catch {
      // Best effort cleanup only.
    }

    URL.revokeObjectURL(objectUrl);
  }
}
