function normalizeIdentityText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function createBoardUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `board_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizeBoardUuid(value) {
  return normalizeIdentityText(value);
}

export function ensureBoardUuid(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) {
    return board;
  }

  const boardUuid = normalizeBoardUuid(board.boardUuid) || createBoardUuid();
  return board.boardUuid === boardUuid ? board : { ...board, boardUuid };
}

export function ensureSavedBoardUuid(savedOutfit) {
  if (!savedOutfit || typeof savedOutfit !== "object" || Array.isArray(savedOutfit) || !savedOutfit.board) {
    return savedOutfit;
  }

  const board = ensureBoardUuid(savedOutfit.board);
  return board === savedOutfit.board ? savedOutfit : { ...savedOutfit, board };
}
