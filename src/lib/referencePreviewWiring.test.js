import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

test("reference preview keyboard navigation uses arrow keys while the preview is open", () => {
  assert.match(
    appSource,
    /referencePreview &&[\s\S]*\(event\.key === "ArrowLeft" \|\| event\.key === "ArrowRight"\)/
  );
  assert.match(
    appSource,
    /event\.key === "ArrowLeft"[\s\S]*referencePreviewNavigation\.previousItem[\s\S]*referencePreviewNavigation\.nextItem/
  );
});

test("reference preview zoom resets on close and item change", () => {
  assert.match(appSource, /const \[isReferencePreviewZoomed, setIsReferencePreviewZoomed\] = useState\(false\)/);
  assert.match(appSource, /useEffect\(\(\) => \{[\s\S]*setIsReferencePreviewZoomed\(false\);[\s\S]*\}, \[referencePreview\?\.id\]\);/);
  assert.match(appSource, /function closeReferencePreview\(\) \{[\s\S]*setIsReferencePreviewZoomed\(false\);[\s\S]*setReferencePreview\(null\);[\s\S]*\}/);
});

test("reference preview image toggles simple zoom without pointer pan wiring", () => {
  assert.match(appSource, /function toggleReferencePreviewZoom\(\) \{[\s\S]*setIsReferencePreviewZoomed\(\(current\) => !current\)/);
  assert.match(appSource, /onClick=\{\(event\) => \{[\s\S]*event\.stopPropagation\(\);[\s\S]*toggleReferencePreviewZoom\(\);[\s\S]*\}\}/);
  assert.doesNotMatch(appSource, /onPointerDown={handleReferencePreviewImagePointerDown}/);
  assert.doesNotMatch(appSource, /translate3d\(/);
  assert.doesNotMatch(appSource, /panReferencePreview\(/);
});

test("reference preview zoom mode hides non-close actions while normal preview keeps them", () => {
  assert.match(appSource, /isReferencePreviewZoomed \? \([\s\S]*reference-preview-actions reference-preview-actions-zoomed[\s\S]*Close[\s\S]*\) : \(/);
  assert.match(appSource, /\) : \([\s\S]*Previous[\s\S]*Next[\s\S]*Exclude[\s\S]*Favorite[\s\S]*Edit[\s\S]*Delete[\s\S]*Close/);
});

test("reference preview close and backdrop handlers remain intact", () => {
  assert.match(appSource, /<div className="floating-backdrop fitpic-preview-backdrop" onClick={closeReferencePreview}>/);
  assert.match(appSource, /<button type="button" className="ghost-button" onClick={closeReferencePreview}>/);
});
