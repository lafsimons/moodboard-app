import test from "node:test";
import assert from "node:assert/strict";

import {
  hydrateSavedBoards,
  normalizeBoard,
  normalizeSavedOutfits,
  resolveBoardFromAppState,
  savedOutfitHasMissingItems
} from "./boardsRepository.js";

const visibleSlots = ["TopInner", "Bottom", "Footwear"];

const dependencies = {
  visibleSlots,
  itemsById: {
    itemA: { id: "itemA" },
    itemB: { id: "itemB" }
  },
  getBoardKey: (board) => board.images.map((image) => image.referenceId).join(","),
  getOutfitKey: (outfit) => Object.values(outfit ?? {}).filter(Boolean).join(","),
  buildBoardFromLegacyReferences: (referenceIds) => ({
    id: "legacy-board",
    width: 1600,
    height: 1200,
    images: referenceIds.map((referenceId, index) => ({
      id: `legacy-${index}`,
      referenceId,
      x: 0,
      y: 0,
      width: 220,
      height: 260,
      rotation: 0,
      zIndex: index + 1,
      generationSlot: visibleSlots[index % visibleSlots.length]
    }))
  })
};

test("normalizeSavedOutfits deduplicates equivalent saved boards", () => {
  const normalized = normalizeSavedOutfits(
    [
      {
        id: "saved-1",
        board: {
          images: [{ referenceId: "itemA" }]
        },
        outfit: {}
      },
      {
        id: "saved-2",
        board: {
          images: [{ referenceId: "itemA" }]
        },
        outfit: {}
      }
    ],
    dependencies
  );

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "saved-1");
});

test("hydrateSavedBoards filters missing board references and falls back to legacy outfits", () => {
  const hydrated = hydrateSavedBoards(
    [
      {
        id: "saved-direct",
        board: {
          images: [
            { referenceId: "itemA" },
            { referenceId: "missing" }
          ]
        },
        outfit: {}
      },
      {
        id: "saved-legacy",
        board: null,
        outfit: {
          TopInner: "itemB"
        }
      }
    ],
    [dependencies.itemsById.itemA, dependencies.itemsById.itemB],
    dependencies
  );

  assert.equal(hydrated.length, 2);
  assert.deepEqual(
    hydrated[0].board.images.map((image) => image.referenceId),
    ["itemA"]
  );
  assert.deepEqual(
    hydrated[1].board.images.map((image) => image.referenceId),
    ["itemB"]
  );
});

test("resolveBoardFromAppState falls back to legacy references when persisted board becomes empty", () => {
  const resolved = resolveBoardFromAppState(
    {
      board: {
        images: [{ referenceId: "missing" }]
      },
      outfit: {
        TopInner: "itemA"
      }
    },
    [dependencies.itemsById.itemA],
    dependencies
  );

  assert.deepEqual(
    resolved.images.map((image) => image.referenceId),
    ["itemA"]
  );
});

test("savedOutfitHasMissingItems reports missing references from boards and outfits", () => {
  assert.equal(
    savedOutfitHasMissingItems(
      {
        board: {
          images: [{ referenceId: "missing" }]
        },
        outfit: {}
      },
      dependencies.itemsById
    ),
    true
  );

  assert.equal(
    savedOutfitHasMissingItems(
      {
        board: null,
        outfit: {
          TopInner: "itemA"
        }
      },
      dependencies.itemsById
    ),
    false
  );
});

test("normalizeBoard preserves valid board images and fills defaults", () => {
  const normalized = normalizeBoard(
    {
      images: [{ referenceId: "itemA", width: 150, height: 180 }]
    },
    visibleSlots
  );

  assert.equal(normalized.images[0].generationSlot, "TopInner");
  assert.equal(normalized.images[0].width, 150);
});
