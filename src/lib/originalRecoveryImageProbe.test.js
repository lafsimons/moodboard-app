import test from "node:test";
import assert from "node:assert/strict";

import { probeOriginalRecoveryImageMetadata } from "./originalRecoveryImageProbe.js";

test("probeOriginalRecoveryImageMetadata uses object URLs and does not call readFileAsDataUrl", async () => {
  const originalReadFileAsDataUrl = globalThis.readFileAsDataUrl;
  const originalUrl = globalThis.URL;
  const originalImage = globalThis.Image;
  const file = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  let readFileAsDataUrlCalled = false;
  let revokedUrl = "";

  globalThis.readFileAsDataUrl = () => {
    readFileAsDataUrlCalled = true;
    throw new Error("should not be called");
  };
  globalThis.URL = {
    createObjectURL() {
      return "blob:test-success";
    },
    revokeObjectURL(url) {
      revokedUrl = url;
    }
  };
  globalThis.Image = class FakeImage {
    constructor() {
      this.naturalWidth = 100;
      this.naturalHeight = 50;
      this._src = "";
    }

    set src(value) {
      this._src = value;

      if (value === "blob:test-success") {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    get src() {
      return this._src;
    }
  };

  try {
    const result = await probeOriginalRecoveryImageMetadata(file);

    assert.equal(readFileAsDataUrlCalled, false);
    assert.equal(result.width, 100);
    assert.equal(result.height, 50);
    assert.equal(revokedUrl, "blob:test-success");
  } finally {
    globalThis.readFileAsDataUrl = originalReadFileAsDataUrl;
    globalThis.URL = originalUrl;
    globalThis.Image = originalImage;
  }
});

test("probeOriginalRecoveryImageMetadata revokes object URL and clears image src on failure", async () => {
  const originalUrl = globalThis.URL;
  const originalImage = globalThis.Image;
  const file = new File(["1234567890"], "camel-coat.jpg", {
    type: "image/jpeg",
    lastModified: 1717236000000
  });
  let revokedUrl = "";
  let finalSrc = null;

  globalThis.URL = {
    createObjectURL() {
      return "blob:test-failure";
    },
    revokeObjectURL(url) {
      revokedUrl = url;
    }
  };
  globalThis.Image = class FakeImage {
    constructor() {
      this._src = "";
    }

    set src(value) {
      this._src = value;
      finalSrc = value;

      if (value === "blob:test-failure") {
        queueMicrotask(() => {
          this.onerror?.(new Error("load failed"));
        });
      }
    }

    get src() {
      return this._src;
    }
  };

  try {
    await assert.rejects(() => probeOriginalRecoveryImageMetadata(file), /could not be read/);
    assert.equal(revokedUrl, "blob:test-failure");
    assert.equal(finalSrc, "");
  } finally {
    globalThis.URL = originalUrl;
    globalThis.Image = originalImage;
  }
});
