import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultLibraryCardName,
  hasCustomLibraryCardName,
  shouldShowLibraryCardTitle
} from "./libraryCards.js";

test("getDefaultLibraryCardName prefers imported filenames", () => {
  assert.equal(
    getDefaultLibraryCardName({
      sourceOriginalFilename: "Camel Coat.png",
      originalFilename: "ignored.jpg"
    }),
    "Camel Coat"
  );
});

test("hasCustomLibraryCardName stays false for unchanged imported names", () => {
  assert.equal(
    hasCustomLibraryCardName({
      name: "Camel Coat",
      sourceOriginalFilename: "Camel Coat.png"
    }),
    false
  );
});

test("hasCustomLibraryCardName detects renamed items", () => {
  assert.equal(
    hasCustomLibraryCardName({
      name: "Runway Camel Coat",
      sourceOriginalFilename: "Camel Coat.png"
    }),
    true
  );
});

test("shouldShowLibraryCardTitle honors explicit toggle for default names", () => {
  assert.equal(
    shouldShowLibraryCardTitle({
      name: "Camel Coat",
      sourceOriginalFilename: "Camel Coat.png",
      showTitleOnCard: true
    }),
    true
  );
});

test("shouldShowLibraryCardTitle treats names without a filename fallback as custom", () => {
  assert.equal(
    shouldShowLibraryCardTitle({
      name: "Gallery Wall Study"
    }),
    true
  );
});
