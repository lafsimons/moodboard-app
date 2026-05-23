function clamp(value, min, max, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function normalizeImageScale(value) {
  return clamp(value, 50, 180, 100);
}

export function normalizeImageFrameScale(value) {
  return clamp(value, 20, 300, 100);
}

export function normalizeImageOffset(value) {
  return clamp(value, -50, 50, 0);
}

export function normalizeImageCropSize(value) {
  return clamp(value, 1, 100, 100);
}

export function normalizeImageCropStart(value, size) {
  return clamp(value, 0, 100 - size, 0);
}

export function normalizeImageRotation(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 10) / 10;
}

export function getNormalizedImageCrop(item) {
  const width = normalizeImageCropSize(item?.imageCropWidth);
  const height = normalizeImageCropSize(item?.imageCropHeight);
  const x = normalizeImageCropStart(item?.imageCropX, width);
  const y = normalizeImageCropStart(item?.imageCropY, height);

  return { x, y, width, height };
}

export function getItemImageCropAspectRatio(item, metricsOverride = null) {
  const naturalWidth = Math.max(metricsOverride?.naturalWidth ?? Number(item?.imageWidth) ?? 1, 1);
  const naturalHeight = Math.max(metricsOverride?.naturalHeight ?? Number(item?.imageHeight) ?? 1, 1);
  const crop = getNormalizedImageCrop(item);
  const cropWidth = Math.max(crop.width / 100, 0.01);
  const cropHeight = Math.max(crop.height / 100, 0.01);

  return Math.max(0.01, (naturalWidth * cropWidth) / (naturalHeight * cropHeight));
}

export function getItemPresentationAspectRatio(item, metricsOverride = null) {
  return Math.max(0.55, Math.min(1.7, getItemImageCropAspectRatio(item, metricsOverride)));
}

export function getBoardAspectSizeBoost(aspectRatio) {
  const normalizedAspectRatio = Math.max(0.55, Math.min(1.7, Number(aspectRatio) || 1));

  if (normalizedAspectRatio < 0.85) {
    return Math.min(1.32, 1 + (0.85 - normalizedAspectRatio) * 0.9);
  }

  if (normalizedAspectRatio > 1.35) {
    return Math.min(1.16, 1 + (normalizedAspectRatio - 1.35) * 0.25);
  }

  return 1;
}

export function getItemPresentationSizeMultiplier(item, metricsOverride = null) {
  const frameScale = normalizeImageFrameScale(item?.imageFrameScale);
  const scale = normalizeImageScale(item?.imageScale);
  const aspectRatio = getItemPresentationAspectRatio(item, metricsOverride);

  return Math.max(0.82, Math.min(1.32, (Math.max(frameScale, scale) / 100) * getBoardAspectSizeBoost(aspectRatio)));
}

export function buildBoardRenderMetadata(item, metricsOverride = null) {
  return {
    aspectRatio: getItemImageCropAspectRatio(item, metricsOverride),
    sizeMultiplier: getItemPresentationSizeMultiplier(item, metricsOverride),
    frameScale: normalizeImageFrameScale(item?.imageFrameScale),
    imageScale: normalizeImageScale(item?.imageScale),
    offsetX: normalizeImageOffset(item?.imageOffsetX),
    offsetY: normalizeImageOffset(item?.imageOffsetY),
    crop: getNormalizedImageCrop(item),
    rotation: normalizeImageRotation(item?.rotation)
  };
}

function normalizeRect(rect = {}) {
  const left = Number(rect.left) || 0;
  const top = Number(rect.top) || 0;
  const width = Math.max(0, Number(rect.width) || 0);
  const height = Math.max(0, Number(rect.height) || 0);

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height
  };
}

export function getContainedRect(frameWidth, frameHeight, aspectRatio) {
  const safeWidth = Math.max(1, Number(frameWidth) || 1);
  const safeHeight = Math.max(1, Number(frameHeight) || 1);
  const safeAspectRatio = Math.max(0.01, Number(aspectRatio) || 1);
  const widthFromHeight = safeHeight * safeAspectRatio;
  const heightFromWidth = safeWidth / safeAspectRatio;

  if (widthFromHeight <= safeWidth) {
    return {
      width: widthFromHeight,
      height: safeHeight
    };
  }

  return {
    width: safeWidth,
    height: heightFromWidth
  };
}

export function getRotatedRectBounds(rect, rotation = 0) {
  const normalizedRect = normalizeRect(rect);
  const normalizedRotation = normalizeImageRotation(rotation);

  if (!normalizedRotation) {
    return normalizedRect;
  }

  const radians = (normalizedRotation * Math.PI) / 180;
  const centerX = normalizedRect.left + normalizedRect.width / 2;
  const centerY = normalizedRect.top + normalizedRect.height / 2;
  const corners = [
    { x: normalizedRect.left, y: normalizedRect.top },
    { x: normalizedRect.right, y: normalizedRect.top },
    { x: normalizedRect.right, y: normalizedRect.bottom },
    { x: normalizedRect.left, y: normalizedRect.bottom }
  ].map((point) => {
    const deltaX = point.x - centerX;
    const deltaY = point.y - centerY;

    return {
      x: centerX + deltaX * Math.cos(radians) - deltaY * Math.sin(radians),
      y: centerY + deltaX * Math.sin(radians) + deltaY * Math.cos(radians)
    };
  });
  const left = Math.min(...corners.map((point) => point.x));
  const right = Math.max(...corners.map((point) => point.x));
  const top = Math.min(...corners.map((point) => point.y));
  const bottom = Math.max(...corners.map((point) => point.y));

  return normalizeRect({
    left,
    top,
    width: right - left,
    height: bottom - top
  });
}

export function getBoardItemRenderedBounds(image, renderMetadata = {}) {
  const frameRect = normalizeRect({
    left: Number(image?.x) || 0,
    top: Number(image?.y) || 0,
    width: Math.max(1, Number(image?.width) || 1),
    height: Math.max(1, Number(image?.height) || 1)
  });
  const containedRect = getContainedRect(frameRect.width, frameRect.height, renderMetadata.aspectRatio);
  const visibleRect = normalizeRect({
    left: frameRect.left + (frameRect.width - containedRect.width) / 2,
    top: frameRect.top + (frameRect.height - containedRect.height) / 2,
    width: containedRect.width,
    height: containedRect.height
  });
  const rotatedBounds = getRotatedRectBounds(visibleRect, renderMetadata.rotation ?? image?.rotation ?? 0);

  return {
    frameRect,
    visibleRect,
    rotatedBounds,
    collisionRect: rotatedBounds
  };
}

export function rectanglesIntersect(leftRect, rightRect, gap = 0) {
  return !(
    leftRect.right + gap <= rightRect.left ||
    rightRect.right + gap <= leftRect.left ||
    leftRect.bottom + gap <= rightRect.top ||
    rightRect.bottom + gap <= leftRect.top
  );
}
