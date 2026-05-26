import test from "node:test";
import assert from "node:assert/strict";

import {
  loadStoredTagTreeCollapsedGroups,
  normalizeTagTreeCollapsedGroups,
  saveStoredTagTreeCollapsedGroups
} from "./tagTreeState.js";

test("normalizeTagTreeCollapsedGroups keeps only boolean entries for the requested tag tree", () => {
  assert.deepEqual(
    normalizeTagTreeCollapsedGroups(
      {
        "library-filters:collection": true,
        "library-filters:collection/aw21": false,
        "controls-reference-filters:collection": true,
        "library-filters:broken": "yes",
        other: false
      },
      "library-filters"
    ),
    {
      "library-filters:collection": true,
      "library-filters:collection/aw21": false
    }
  );
});

test("loadStoredTagTreeCollapsedGroups returns an empty object for invalid persisted JSON", () => {
  const storage = {
    getItem() {
      return "{not-json";
    }
  };

  assert.deepEqual(loadStoredTagTreeCollapsedGroups("library-filters", storage), {});
});

test("saveStoredTagTreeCollapsedGroups round-trips collapsed state and clears empty payloads", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };

  saveStoredTagTreeCollapsedGroups(
    "library-filters",
    {
      "library-filters:collection": true,
      "library-filters:ig": false,
      "controls-reference-filters:collection": true
    },
    storage
  );

  assert.deepEqual(loadStoredTagTreeCollapsedGroups("library-filters", storage), {
    "library-filters:collection": true,
    "library-filters:ig": false
  });

  saveStoredTagTreeCollapsedGroups("library-filters", {}, storage);

  assert.deepEqual(loadStoredTagTreeCollapsedGroups("library-filters", storage), {});
});
