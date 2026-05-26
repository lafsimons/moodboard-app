function roundBoardZoom(value) {
  return Math.round(value * 1000) / 1000;
}

export function getBoardFitZoom({
  boardWidth,
  boardHeight,
  viewportWidth,
  viewportHeight,
  boardImageCount = 0,
  isMobileViewport = false,
  viewportPadding = 24,
  minZoom = 0.1,
  maxZoom = 6
} = {}) {
  if (!boardWidth || !boardHeight || !viewportWidth || !viewportHeight) {
    return 1;
  }

  const safeViewportWidth = Math.max(1, viewportWidth - viewportPadding);
  const safeViewportHeight = Math.max(1, viewportHeight - viewportPadding);
  const widthZoom = safeViewportWidth / boardWidth;
  const heightZoom = safeViewportHeight / boardHeight;
  const fittedZoom = Math.min(widthZoom, heightZoom);
  let relaxedZoom = fittedZoom;

  if (isMobileViewport && boardImageCount >= 12 && boardImageCount <= 15) {
    relaxedZoom = fittedZoom;
  } else if (boardImageCount >= 12 && boardImageCount <= 15) {
    relaxedZoom = Math.min(0.62, Math.max(0.6, fittedZoom * 1.55));
  } else if (boardImageCount > 15) {
    relaxedZoom =
      fittedZoom >= 0.34
        ? Math.min(0.62, Math.max(0.52, fittedZoom * 1.46))
        : fittedZoom * 1.22;
  } else {
    relaxedZoom =
      fittedZoom >= 0.82
        ? 1
        : fittedZoom >= 0.62
          ? fittedZoom * 1.12
          : fittedZoom * 1.05;
  }

  return Math.min(maxZoom, Math.max(minZoom, roundBoardZoom(relaxedZoom)));
}

export function getFittedBoardViewForViewport({
  boardWidth,
  boardHeight,
  viewportWidth,
  viewportHeight,
  boardImageCount = 0,
  isMobileViewport = false,
  viewportPadding = 24,
  minZoom = 0.1,
  maxZoom = 6
} = {}) {
  if (!boardWidth || !boardHeight || !viewportWidth || !viewportHeight) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const zoom = getBoardFitZoom({
    boardWidth,
    boardHeight,
    viewportWidth,
    viewportHeight,
    boardImageCount,
    isMobileViewport,
    viewportPadding,
    minZoom,
    maxZoom
  });

  return {
    x: roundBoardZoom(boardWidth * (1 - zoom) * 0.5),
    y: roundBoardZoom(boardHeight * (1 - zoom) * 0.5),
    zoom
  };
}
