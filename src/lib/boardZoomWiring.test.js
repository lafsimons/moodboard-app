import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

test("board viewport wheel zoom uses a non-passive native listener so preventDefault remains valid", () => {
  assert.match(appSource, /addEventListener\("wheel", handleBoardViewportWheel, \{ passive: false \}\)/);
  assert.match(appSource, /removeEventListener\("wheel", handleBoardViewportWheel\)/);
  assert.doesNotMatch(appSource, /className="board-canvas-viewport"[^>]*onWheel=\{handleBoardViewportWheel\}/);
});
