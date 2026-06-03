import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeItemSourceIdentity,
  normalizeKnownOriginalRelativePath
} from "./itemIdentity.js";

test("normalizeKnownOriginalRelativePath preserves archive-relative forward-slash paths", () => {
  assert.equal(
    normalizeKnownOriginalRelativePath(" moodboard\\moodboard-images-123.png "),
    "moodboard/moodboard-images-123.png"
  );
});

test("normalizeKnownOriginalRelativePath rejects absolute and parent-relative paths", () => {
  assert.equal(normalizeKnownOriginalRelativePath("/Users/example/image.jpg"), "");
  assert.equal(normalizeKnownOriginalRelativePath("C:/Users/example/image.jpg"), "");
  assert.equal(normalizeKnownOriginalRelativePath("../archive/image.jpg"), "");
});

test("normalizeItemSourceIdentity preserves knownOriginalRelativePath", () => {
  const identity = normalizeItemSourceIdentity({
    itemUuid: "uuid-1",
    knownOriginalRelativePath: "wishlist/wishlist-images-168.png",
    sourceOriginalFilename: "wishlist-images-168.png"
  });

  assert.equal(identity.knownOriginalRelativePath, "wishlist/wishlist-images-168.png");
});
