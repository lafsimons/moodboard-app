import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);
const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("board viewport wheel zoom uses a non-passive native listener so preventDefault remains valid", () => {
  assert.match(appSource, /addEventListener\("wheel", handleBoardViewportWheel, \{ passive: false \}\)/);
  assert.match(appSource, /removeEventListener\("wheel", handleBoardViewportWheel\)/);
  assert.doesNotMatch(appSource, /className="board-canvas-viewport"[^>]*onWheel=\{handleBoardViewportWheel\}/);
});

test("board viewport pinch zoom uses scoped non-passive touch listeners and routes through board zoom state", () => {
  assert.match(appSource, /function handleBoardViewportTouchStart\(event\) \{/);
  assert.match(appSource, /function handleBoardViewportTouchMove\(event\) \{/);
  assert.match(appSource, /event\.touches\.length !== 2/);
  assert.match(appSource, /zoomBoardView\(\(currentZoom\) => currentZoom \* zoomFactor, anchor\);/);
  assert.match(appSource, /addEventListener\("touchstart", handleBoardViewportTouchStart, \{ passive: false \}\)/);
  assert.match(appSource, /addEventListener\("touchmove", handleBoardViewportTouchMove, \{ passive: false \}\)/);
  assert.match(appSource, /addEventListener\("gesturestart", handleBoardViewportGestureEvent, \{ passive: false \}\)/);
  assert.match(appSource, /className=\{`board-canvas-viewport \$\{isMobileViewport \? "is-mobile-gesture-surface" : ""\}`\}/);
});

test("mobile board gesture surface contains browser touch behavior inside the viewport", () => {
  assert.match(stylesSource, /\.board-canvas-viewport\.is-mobile-gesture-surface\s*\{[\s\S]*touch-action:\s*none;[\s\S]*overscroll-behavior:\s*contain;/);
});
