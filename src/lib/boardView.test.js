import test from "node:test";
import assert from "node:assert/strict";

import { getBoardFitZoom, getFittedBoardViewForViewport } from "./boardView.js";

test("mobile fit for 11 images keeps the existing pre-12 relaxed zoom behavior", () => {
  const zoom = getBoardFitZoom({
    boardWidth: 2874,
    boardHeight: 2258,
    viewportWidth: 390,
    viewportHeight: 844,
    boardImageCount: 11,
    isMobileViewport: true
  });

  assert.equal(zoom, 0.134);
});

test("mobile fit for 12 images uses the true fitted zoom instead of the 60 percent fallback", () => {
  const zoom = getBoardFitZoom({
    boardWidth: 2968,
    boardHeight: 2336,
    viewportWidth: 390,
    viewportHeight: 844,
    boardImageCount: 12,
    isMobileViewport: true
  });

  assert.equal(zoom, 0.123);
  assert.ok(zoom < 0.6);
});

test("mobile fit for 13 images uses the true fitted zoom instead of the 60 percent fallback", () => {
  const zoom = getBoardFitZoom({
    boardWidth: 3062,
    boardHeight: 2414,
    viewportWidth: 390,
    viewportHeight: 844,
    boardImageCount: 13,
    isMobileViewport: true
  });

  assert.equal(zoom, 0.12);
  assert.ok(zoom < 0.6);
});

test("mobile fit for 14 images uses the true fitted zoom instead of the 60 percent fallback", () => {
  const zoom = getBoardFitZoom({
    boardWidth: 3156,
    boardHeight: 2492,
    viewportWidth: 390,
    viewportHeight: 844,
    boardImageCount: 14,
    isMobileViewport: true
  });

  assert.equal(zoom, 0.116);
  assert.ok(zoom < 0.6);
});

test("mobile fit for 15 images uses the true fitted zoom instead of the 60 percent fallback", () => {
  const zoom = getBoardFitZoom({
    boardWidth: 3250,
    boardHeight: 2570,
    viewportWidth: 390,
    viewportHeight: 844,
    boardImageCount: 15,
    isMobileViewport: true
  });

  assert.equal(zoom, 0.113);
  assert.ok(zoom < 0.6);
});

test("mobile fit for 16 images preserves the existing high-count relaxed zoom path", () => {
  const zoom = getBoardFitZoom({
    boardWidth: 3344,
    boardHeight: 2648,
    viewportWidth: 390,
    viewportHeight: 844,
    boardImageCount: 16,
    isMobileViewport: true
  });

  assert.equal(zoom, 0.134);
});

test("desktop fit behavior for 12 to 15 images remains unchanged", () => {
  const zoom = getBoardFitZoom({
    boardWidth: 3062,
    boardHeight: 2414,
    viewportWidth: 1440,
    viewportHeight: 1024,
    boardImageCount: 13,
    isMobileViewport: false
  });

  assert.equal(zoom, 0.62);
});

test("fit view centers the board using the corrected mobile fit path", () => {
  const view = getFittedBoardViewForViewport({
    boardWidth: 3062,
    boardHeight: 2414,
    viewportWidth: 390,
    viewportHeight: 844,
    boardImageCount: 13,
    isMobileViewport: true
  });

  assert.deepEqual(view, {
    x: 1347.28,
    y: 1062.16,
    zoom: 0.12
  });
});
