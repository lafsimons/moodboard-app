import test from "node:test";
import assert from "node:assert/strict";

import {
  replaceBoardImagePreservingLayout,
  replaceBoardImageReferencePreservingLayout
} from "./boardLayoutState.js";

test("replaceBoardImageReferencePreservingLayout swaps only the targeted reference", () => {
  const board = {
    id: "board-1",
    width: 1600,
    height: 1200,
    images: [
      {
        id: "image-1",
        referenceId: "item-1",
        referenceItemUuid: "uuid-1",
        x: 40,
        y: 50,
        width: 220,
        height: 300,
        zIndex: 1
      },
      {
        id: "image-2",
        referenceId: "item-2",
        referenceItemUuid: "uuid-2",
        x: 360,
        y: 180,
        width: 280,
        height: 240,
        zIndex: 2
      }
    ]
  };

  const nextBoard = replaceBoardImageReferencePreservingLayout(board, "image-2", "item-9", "uuid-9");

  assert.deepEqual(nextBoard.images[0], board.images[0]);
  assert.deepEqual(nextBoard.images[1], {
    ...board.images[1],
    referenceId: "item-9",
    referenceItemUuid: "uuid-9"
  });
});

test("replaceBoardImagePreservingLayout keeps frame placement when applying a rerolled image", () => {
  const board = {
    id: "board-1",
    width: 1600,
    height: 1200,
    images: [
      {
        id: "image-1",
        referenceId: "item-1",
        referenceItemUuid: "uuid-1",
        generationSlot: "TopInner",
        x: 160,
        y: 210,
        width: 240,
        height: 320,
        zIndex: 4
      }
    ]
  };

  const nextBoard = replaceBoardImagePreservingLayout(board, {
    id: "image-1",
    referenceId: "item-3",
    referenceItemUuid: "uuid-3",
    generationSlot: "TopInner",
    x: 999,
    y: 999,
    width: 999,
    height: 999,
    zIndex: 99
  });

  assert.deepEqual(nextBoard.images[0], {
    ...board.images[0],
    referenceId: "item-3",
    referenceItemUuid: "uuid-3",
    generationSlot: "TopInner"
  });
});
