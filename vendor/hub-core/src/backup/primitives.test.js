import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWarningReport,
  getExtensionFromDataUrl,
  getExtensionFromFilename,
  getExtensionFromMimeType,
  normalizeCount,
  sanitizeFileSegment,
  serializeNdjsonRecord,
  streamNdjsonFileLines
} from "./primitives.js";

test("sanitizeFileSegment normalizes unicode and unsafe characters", () => {
  assert.equal(sanitizeFileSegment(" Åwesome/File  Name!.png ", "fallback"), "awesome-file-name-.png");
  assert.equal(sanitizeFileSegment("", "fallback"), "fallback");
});

test("extension helpers infer from mime filename and data url", () => {
  assert.equal(getExtensionFromMimeType("image/jpeg"), ".jpg");
  assert.equal(getExtensionFromFilename("photo.PNG"), ".png");
  assert.equal(getExtensionFromDataUrl("data:image/webp;base64,AAAA"), ".webp");
});

test("normalizeCount rounds finite positive values and clamps invalid values to zero", () => {
  assert.equal(normalizeCount(3.6), 4);
  assert.equal(normalizeCount(-1), 0);
  assert.equal(normalizeCount("abc"), 0);
});

test("serializeNdjsonRecord appends a newline", () => {
  assert.equal(serializeNdjsonRecord({ id: "a" }), "{\"id\":\"a\"}\n");
});

test("buildWarningReport counts object warnings only", () => {
  assert.deepEqual(
    buildWarningReport({
      source: "test",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      warnings: [{ id: "a" }, null, "nope"]
    }),
    {
      source: "test",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      warningCount: 1,
      warnings: [{ id: "a" }]
    }
  );
});

test("streamNdjsonFileLines yields line numbers and skips no content merging issues", async () => {
  const chunks = [
    new TextEncoder().encode("{\"a\":1}\n{\"b"),
    new TextEncoder().encode("\":2}\n"),
    new TextEncoder().encode("{\"c\":3}")
  ];
  let index = 0;
  const seen = [];
  const file = {
    stream() {
      return new ReadableStream({
        pull(controller) {
          if (index >= chunks.length) {
            controller.close();
            return;
          }

          controller.enqueue(chunks[index]);
          index += 1;
        }
      });
    }
  };

  await streamNdjsonFileLines(file, async (line, lineNumber) => {
    seen.push([line, lineNumber]);
  });

  assert.deepEqual(seen, [
    ["{\"a\":1}", 1],
    ["{\"b\":2}", 2],
    ["{\"c\":3}", 3]
  ]);
});
