export const BOARD_HISTORY_LIMIT = 20;

function normalizeBoardImageSnapshot(image) {
  if (!image || typeof image !== "object") {
    return null;
  }

  return {
    id: typeof image.id === "string" ? image.id : "",
    referenceId: typeof image.referenceId === "string" ? image.referenceId : "",
    referenceItemUuid: typeof image.referenceItemUuid === "string" ? image.referenceItemUuid : "",
    referenceSourceKey: typeof image.referenceSourceKey === "string" ? image.referenceSourceKey : "",
    generationSlot: typeof image.generationSlot === "string" ? image.generationSlot : "",
    x: Math.round(Number(image.x) || 0),
    y: Math.round(Number(image.y) || 0),
    width: Math.round(Number(image.width) || 0),
    height: Math.round(Number(image.height) || 0),
    rotation: Math.round((Number(image.rotation) || 0) * 10) / 10,
    zIndex: Math.round(Number(image.zIndex) || 0)
  };
}

function normalizeBoardSnapshot(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) {
    return null;
  }

  return {
    id: typeof board.id === "string" ? board.id : "",
    boardUuid: typeof board.boardUuid === "string" ? board.boardUuid : "",
    width: Math.round(Number(board.width) || 0),
    height: Math.round(Number(board.height) || 0),
    images: (Array.isArray(board.images) ? board.images : [])
      .map((image) => normalizeBoardImageSnapshot(image))
      .filter((image) => image?.referenceId)
  };
}

export function createBoardHistorySnapshot({ board = null, boardView = null, imageCount = 0 } = {}) {
  return {
    board: normalizeBoardSnapshot(board),
    boardView: {
      x: Math.round((Number(boardView?.x) || 0) * 1000) / 1000,
      y: Math.round((Number(boardView?.y) || 0) * 1000) / 1000,
      zoom: Math.round((Number(boardView?.zoom) || 1) * 1000) / 1000
    },
    imageCount: Math.max(0, Math.round(Number(imageCount) || 0))
  };
}

export function areBoardHistorySnapshotsEqual(left, right) {
  return JSON.stringify(createBoardHistorySnapshot(left)) === JSON.stringify(createBoardHistorySnapshot(right));
}

export function pushBoardHistorySnapshot(history = [], snapshot, limit = BOARD_HISTORY_LIMIT) {
  const normalizedHistory = Array.isArray(history) ? history : [];
  const normalizedSnapshot = createBoardHistorySnapshot(snapshot);
  const lastSnapshot = normalizedHistory[normalizedHistory.length - 1] ?? null;

  if (lastSnapshot && areBoardHistorySnapshotsEqual(lastSnapshot, normalizedSnapshot)) {
    return normalizedHistory;
  }

  const nextHistory = [...normalizedHistory, normalizedSnapshot];
  return nextHistory.slice(Math.max(0, nextHistory.length - Math.max(1, Math.round(Number(limit) || BOARD_HISTORY_LIMIT))));
}

export function restoreBoardUndoState({ undoStack = [], redoStack = [], currentSnapshot } = {}) {
  const normalizedUndoStack = Array.isArray(undoStack) ? undoStack : [];

  if (!normalizedUndoStack.length) {
    return {
      snapshot: null,
      undoStack: normalizedUndoStack,
      redoStack: Array.isArray(redoStack) ? redoStack : []
    };
  }

  return {
    snapshot: normalizedUndoStack[normalizedUndoStack.length - 1],
    undoStack: normalizedUndoStack.slice(0, -1),
    redoStack: pushBoardHistorySnapshot(redoStack, currentSnapshot)
  };
}

export function restoreBoardRedoState({ undoStack = [], redoStack = [], currentSnapshot } = {}) {
  const normalizedRedoStack = Array.isArray(redoStack) ? redoStack : [];

  if (!normalizedRedoStack.length) {
    return {
      snapshot: null,
      undoStack: Array.isArray(undoStack) ? undoStack : [],
      redoStack: normalizedRedoStack
    };
  }

  return {
    snapshot: normalizedRedoStack[normalizedRedoStack.length - 1],
    undoStack: pushBoardHistorySnapshot(undoStack, currentSnapshot),
    redoStack: normalizedRedoStack.slice(0, -1)
  };
}
