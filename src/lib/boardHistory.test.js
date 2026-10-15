import test from "node:test";
import assert from "node:assert/strict";

import {
  areBoardHistorySnapshotsEqual,
  BOARD_HISTORY_LIMIT,
  createBoardHistorySnapshot,
  pushBoardHistorySnapshot,
  restoreBoardRedoState,
  restoreBoardUndoState
} from "./boardHistory.js";

test("createBoardHistorySnapshot keeps board references and visual layout without media payloads", () => {
  const snapshot = createBoardHistorySnapshot({
    board: {
      id: "board-1",
      boardUuid: "uuid-board-1",
      width: 1600,
      height: 1200,
      images: [
        {
          id: "image-1",
          referenceId: "item-1",
          referenceItemUuid: "uuid-1",
          referenceSourceKey: "source-1",
          generationSlot: "TopInner",
          x: 10.2,
          y: 20.6,
          width: 220.1,
          height: 260.4,
          rotation: 1.26,
          zIndex: 1,
          blob: "ignored"
        }
      ]
    },
    boardView: { x: 1.2345, y: 6.7891, zoom: 0.9876 },
    imageCount: 15
  });

  assert.deepEqual(snapshot, {
    board: {
      id: "board-1",
      boardUuid: "uuid-board-1",
      width: 1600,
      height: 1200,
      images: [
        {
          id: "image-1",
          referenceId: "item-1",
          referenceItemUuid: "uuid-1",
          referenceSourceKey: "source-1",
          generationSlot: "TopInner",
          x: 10,
          y: 21,
          width: 220,
          height: 260,
          rotation: 1.3,
          zIndex: 1
        }
      ]
    },
    boardView: {
      x: 1.235,
      y: 6.789,
      zoom: 0.988
    },
    imageCount: 15
  });
});

test("pushBoardHistorySnapshot caps the stack and skips adjacent duplicates", () => {
  const first = createBoardHistorySnapshot({ board: null, boardView: { x: 0, y: 0, zoom: 1 }, imageCount: 15 });
  const history = Array.from({ length: BOARD_HISTORY_LIMIT + 5 }, (_, index) =>
    createBoardHistorySnapshot({
      board: {
        id: `board-${index}`,
        width: 1000 + index,
        height: 800,
        images: [{ id: `image-${index}`, referenceId: `item-${index}` }]
      },
      boardView: { x: index, y: 0, zoom: 1 },
      imageCount: 15
    })
  ).reduce((currentHistory, snapshot) => pushBoardHistorySnapshot(currentHistory, snapshot), [first]);

  assert.equal(history.length, BOARD_HISTORY_LIMIT);
  assert.equal(history[history.length - 1].board.id, `board-${BOARD_HISTORY_LIMIT + 4}`);

  const deduped = pushBoardHistorySnapshot(history, history[history.length - 1]);
  assert.equal(deduped.length, history.length);
});

test("restoreBoardUndoState moves the current snapshot onto redo and returns the previous snapshot", () => {
  const undoStack = [
    createBoardHistorySnapshot({ board: { id: "board-a", width: 100, height: 100, images: [{ id: "image-a", referenceId: "item-a" }] } }),
    createBoardHistorySnapshot({ board: { id: "board-b", width: 100, height: 100, images: [{ id: "image-b", referenceId: "item-b" }] } })
  ];
  const currentSnapshot = createBoardHistorySnapshot({
    board: { id: "board-c", width: 100, height: 100, images: [{ id: "image-c", referenceId: "item-c" }] }
  });

  const result = restoreBoardUndoState({
    undoStack,
    redoStack: [],
    currentSnapshot
  });

  assert.equal(result.snapshot.board.id, "board-b");
  assert.deepEqual(result.undoStack.map((entry) => entry.board.id), ["board-a"]);
  assert.deepEqual(result.redoStack.map((entry) => entry.board.id), ["board-c"]);
});

test("restoreBoardRedoState moves the current snapshot back onto undo and returns the redo snapshot", () => {
  const redoStack = [
    createBoardHistorySnapshot({ board: { id: "board-b", width: 100, height: 100, images: [{ id: "image-b", referenceId: "item-b" }] } })
  ];
  const currentSnapshot = createBoardHistorySnapshot({
    board: { id: "board-a", width: 100, height: 100, images: [{ id: "image-a", referenceId: "item-a" }] }
  });

  const result = restoreBoardRedoState({
    undoStack: [],
    redoStack,
    currentSnapshot
  });

  assert.equal(result.snapshot.board.id, "board-b");
  assert.deepEqual(result.undoStack.map((entry) => entry.board.id), ["board-a"]);
  assert.equal(result.redoStack.length, 0);
});

test("areBoardHistorySnapshotsEqual normalizes equivalent snapshots", () => {
  assert.equal(
    areBoardHistorySnapshotsEqual(
      {
        board: {
          id: "board-1",
          width: 100,
          height: 100,
          images: [{ id: "image-1", referenceId: "item-1", rotation: 1.04 }]
        },
        boardView: { x: 1.2344, y: 0, zoom: 1 },
        imageCount: 15
      },
      {
        board: {
          id: "board-1",
          width: 100,
          height: 100,
          images: [{ id: "image-1", referenceId: "item-1", rotation: 1.0 }]
        },
        boardView: { x: 1.23449, y: 0, zoom: 1 },
        imageCount: 15
      }
    ),
    true
  );
});
