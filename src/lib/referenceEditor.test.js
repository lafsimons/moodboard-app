import test from "node:test";
import assert from "node:assert/strict";

import {
  getEffectiveReferencePreviewSource,
  hasEffectiveReferencePreviewSource
} from "./referenceEditor.js";

test("metadata-only existing references can validate against lazily resolved preview media", () => {
  const draft = {
    id: "item-1",
    imageUrl: ""
  };

  assert.equal(
    getEffectiveReferencePreviewSource(draft, "blob:resolved-preview"),
    "blob:resolved-preview"
  );
  assert.equal(hasEffectiveReferencePreviewSource(draft, "blob:resolved-preview"), true);
});

test("new empty references without inline or resolved media still fail image validation", () => {
  assert.equal(hasEffectiveReferencePreviewSource({ id: "", imageUrl: "" }, ""), false);
});

test("legacy inline-image references still validate through draft.imageUrl", () => {
  assert.equal(
    hasEffectiveReferencePreviewSource({ id: "legacy-inline", imageUrl: "data:image/webp;base64,preview" }, ""),
    true
  );
});
