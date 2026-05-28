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
  assert.match(appSource, /const \[referencePreviewZoomFocus, setReferencePreviewZoomFocus\] = useState\(null\)/);
  assert.match(appSource, /useEffect\(\(\) => \{[\s\S]*setIsReferencePreviewZoomed\(false\);[\s\S]*setReferencePreviewZoomFocus\(null\);[\s\S]*referencePreviewStageRef\.current\.scrollLeft = 0;[\s\S]*\}, \[referencePreview\?\.id\]\);/);
  assert.match(appSource, /function closeReferencePreview\(\) \{[\s\S]*setIsReferencePreviewZoomed\(false\);[\s\S]*setReferencePreviewZoomFocus\(null\);[\s\S]*referencePreviewStageRef\.current\.scrollLeft = 0;[\s\S]*setReferencePreview\(null\);[\s\S]*\}/);
});

test("reference preview image stores click focus and centers native scroll on zoom enter without pointer pan wiring", () => {
  assert.match(appSource, /function toggleReferencePreviewZoom\(event = null\) \{/);
  assert.match(appSource, /const focusRatio = getReferencePreviewClickFocus\(\{[\s\S]*clientX: event\?\.clientX,[\s\S]*clientY: event\?\.clientY,[\s\S]*contentRect: referencePreviewImageFrameRef\.current\?\.getBoundingClientRect\?\.\(\) \?\? null/);
  assert.match(appSource, /setReferencePreviewZoomFocus\(focusRatio\);[\s\S]*setIsReferencePreviewZoomed\(true\);/);
  assert.match(appSource, /useEffect\(\(\) => \{[\s\S]*getReferencePreviewCenteredScrollPosition\(\{[\s\S]*focusRatio: referencePreviewZoomFocus,[\s\S]*containerWidth: stageElement\.clientWidth,[\s\S]*contentWidth: imageFrameElement\.offsetWidth/);
  assert.match(appSource, /frameRef={referencePreviewImageFrameRef}/);
  assert.match(appSource, /ref={referencePreviewStageRef}/);
  assert.match(appSource, /onClick=\{\(event\) => \{[\s\S]*event\.stopPropagation\(\);[\s\S]*toggleReferencePreviewZoom\(event\);[\s\S]*\}\}/);
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

test("mobile reference preview pinch uses scoped non-passive listeners and keeps swipe gated while zoomed", () => {
  assert.match(appSource, /const \[mobileReferencePreviewScale, setMobileReferencePreviewScale\] = useState\(1\)/);
  assert.match(appSource, /function handleMobileReferencePreviewPinchStart\(event\) \{/);
  assert.match(appSource, /function handleMobileReferencePreviewPinchMove\(event\) \{/);
  assert.match(appSource, /syncMobileReferencePreviewScale\(/);
  assert.match(appSource, /setIsReferencePreviewZoomed\(normalizedScale > 1\.01\);/);
  assert.match(appSource, /addEventListener\("touchstart", handleMobileReferencePreviewPinchStart, \{ passive: false \}\)/);
  assert.match(appSource, /addEventListener\("touchmove", handleMobileReferencePreviewPinchMove, \{ passive: false \}\)/);
  assert.match(appSource, /addEventListener\("gesturestart", handleMobileReferencePreviewGestureEvent, \{ passive: false \}\)/);
  assert.match(appSource, /if \(!mobileReferencePreviewTouchRef\.current \|\| isReferencePreviewZoomed\) \{/);
  assert.match(appSource, /style=\{\{ "--mobile-reference-preview-scale": mobileReferencePreviewScale \}\}/);
});
