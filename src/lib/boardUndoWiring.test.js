import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

test("board toolbar exposes Undo, Redo, and Rearrange buttons with labels and tooltips", () => {
  assert.match(appSource, /title="Undo"[\s\S]{0,120}?aria-label="Undo"[\s\S]{0,120}?>\s*Undo\s*</);
  assert.match(appSource, /title="Redo"[\s\S]{0,120}?aria-label="Redo"[\s\S]{0,120}?>\s*Redo\s*</);
  assert.match(appSource, /title="Rearrange board"[\s\S]{0,160}?aria-label="Rearrange board"[\s\S]{0,160}?>\s*Rearrange\s*</);
});

test("board rearrange uses relayout plus existing undo snapshot commit flow", () => {
  assert.match(appSource, /function handleRearrangeCurrentBoard\(\)/);
  assert.match(appSource, /if \(!currentBoard\?\.images\?\.length \|\| currentBoard\.images\.length <= 1\) \{\s*return;\s*\}/);
  assert.match(appSource, /const nextBoard = relayoutBoardStateImages\(currentBoard\.images\);/);
  assert.match(appSource, /commitBoardSnapshotChange\(nextBoard,\s*\{\s*historySnapshot: captureCurrentBoardHistorySnapshot\(\),\s*clearBoardImageUi: true\s*\}\);/);
  assert.match(appSource, /disabled=\{!board\?\.images\?\.length \|\| board\.images\.length <= 1\}/);
});

test("board undo keyboard shortcuts are wired for undo and redo", () => {
  assert.match(appSource, /const normalizedKey = event\.key\.toLowerCase\(\);/);
  assert.match(appSource, /if \(isPrimaryModifier && normalizedKey === "z"\)/);
  assert.match(appSource, /if \(event\.shiftKey\) \{\s*handleRedoBoardChange\(\);\s*\} else \{\s*handleUndoBoardChange\(\);\s*\}/);
  assert.match(appSource, /if \(isPrimaryModifier && normalizedKey === "y"\)/);
});
