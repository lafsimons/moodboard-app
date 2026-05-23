export const DEFAULT_SIDE_EDITOR_WIDTH = 360;
export const DEFAULT_LIBRARY_ADD_WIDTH = 440;
export const MIN_SIDE_EDITOR_WIDTH = 360;
export const MAX_SIDE_EDITOR_WIDTH = 560;
export const MIN_LIBRARY_ADD_WIDTH = 280;
export const MAX_LIBRARY_ADD_WIDTH = 440;

function normalizeViewportWidth(viewportWidth) {
  const numericViewportWidth = Number(viewportWidth);

  return Number.isFinite(numericViewportWidth) && numericViewportWidth > 0
    ? numericViewportWidth
    : null;
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined) {
    return Number.NaN;
  }

  if (typeof value === "string" && !value.trim()) {
    return Number.NaN;
  }

  return Number(value);
}

export function getMaxSideEditorWidth(viewportWidth) {
  const normalizedViewportWidth = normalizeViewportWidth(viewportWidth);

  if (normalizedViewportWidth === null) {
    return MAX_SIDE_EDITOR_WIDTH;
  }

  return Math.min(MAX_SIDE_EDITOR_WIDTH, Math.max(MIN_SIDE_EDITOR_WIDTH, Math.round(normalizedViewportWidth * 0.46)));
}

export function normalizeSideEditorWidth(value, viewportWidth) {
  const rawNumericValue = normalizeOptionalNumber(value);
  const numericValue = Number.isFinite(rawNumericValue) ? Math.round(rawNumericValue) : Number.NaN;
  const fallbackWidth = Math.min(
    DEFAULT_SIDE_EDITOR_WIDTH,
    getMaxSideEditorWidth(viewportWidth)
  );

  if (!Number.isFinite(numericValue)) {
    return fallbackWidth;
  }

  return Math.min(
    getMaxSideEditorWidth(viewportWidth),
    Math.max(MIN_SIDE_EDITOR_WIDTH, numericValue)
  );
}

export function getMaxLibraryAddWidth(viewportWidth) {
  const normalizedViewportWidth = normalizeViewportWidth(viewportWidth);

  if (normalizedViewportWidth === null) {
    return MAX_LIBRARY_ADD_WIDTH;
  }

  return Math.max(MIN_LIBRARY_ADD_WIDTH, Math.min(MAX_LIBRARY_ADD_WIDTH, Math.round(normalizedViewportWidth - 32)));
}

export function normalizeLibraryAddWidth(value, viewportWidth) {
  const rawNumericValue = normalizeOptionalNumber(value);
  const numericValue = Number.isFinite(rawNumericValue) ? Math.round(rawNumericValue) : Number.NaN;
  const fallbackWidth = Math.min(
    DEFAULT_LIBRARY_ADD_WIDTH,
    getMaxLibraryAddWidth(viewportWidth)
  );

  if (!Number.isFinite(numericValue)) {
    return fallbackWidth;
  }

  return Math.min(
    getMaxLibraryAddWidth(viewportWidth),
    Math.max(MIN_LIBRARY_ADD_WIDTH, numericValue)
  );
}

export function normalizePanelLayoutState(value, viewportWidth) {
  return {
    sideEditorWidth: normalizeSideEditorWidth(value?.sideEditorWidth, viewportWidth),
    libraryAddWidth: normalizeLibraryAddWidth(value?.libraryAddWidth, viewportWidth)
  };
}
