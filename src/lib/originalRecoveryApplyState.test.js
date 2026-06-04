import test from "node:test";
import assert from "node:assert/strict";

import { applyPersistedOriginalMutations } from "./originalRecoveryApplyState.js";

test("applyPersistedOriginalMutations updates multiple recovered items and preserves unrelated state", () => {
  const state = applyPersistedOriginalMutations(
    [
      { id: "item-1", name: "One", originalPreserved: false, images: { preview: { src: "preview-1" } } },
      { id: "item-2", name: "Two", originalPreserved: false, images: { preview: { src: "preview-2" } } },
      { id: "item-3", name: "Three", originalPreserved: false, images: { preview: { src: "preview-3" } } }
    ],
    [
      { id: "item-1", originalPreserved: true, relinkStatus: "linked", images: { original: { mimeType: "image/jpeg", width: 100, height: 50 } } },
      { id: "item-2", originalPreserved: true, relinkStatus: "linked", images: { original: { mimeType: "image/png", width: 80, height: 80 } } }
    ],
    { id: "item-2", originalPreserved: false, images: { preview: { src: "preview-2" } } },
    { id: "item-1", originalPreserved: false, images: { preview: { src: "preview-1" } } }
  );

  assert.equal(state.items[0].originalPreserved, true);
  assert.equal(state.items[1].originalPreserved, true);
  assert.equal(state.items[2].originalPreserved, false);
  assert.equal(state.referencePreview?.originalPreserved, true);
  assert.equal(state.draft?.originalPreserved, true);
  assert.deepEqual(state.changedItemIds, ["item-1", "item-2"]);
});
