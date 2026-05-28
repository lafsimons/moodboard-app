import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

test("mobile library uses an explicit select mode toggle", () => {
  assert.equal(appSource.includes('const [mobileLibrarySelectMode, setMobileLibrarySelectMode] = useState(false);'), true);
  assert.equal(appSource.includes('const [mobileLibraryMoreOpen, setMobileLibraryMoreOpen] = useState(false);'), true);
  assert.equal(appSource.includes("function toggleMobileLibrarySelectionMode() {"), true);
  assert.equal(appSource.includes('{mobileLibrarySelectMode ? "Done" : "Select"}'), true);
  assert.equal(appSource.includes('const mobileLibrarySelectionStatusLabel = selectedReferenceCount ? `${selectedReferenceCount} selected` : libraryImageCountLabel;'), true);
  assert.equal(appSource.includes('const showMobileLibrarySelectionToolbar = isMobileViewport && mobileLibrarySelectMode;'), true);
  assert.equal(appSource.includes('className={`library-command-bar ${showMobileLibrarySelectionToolbar ? "is-mobile-selection-toolbar" : ""}`}'), true);
  assert.equal(appSource.includes('className="library-selection-toolbar"'), true);
  assert.equal(appSource.includes('{mobileLibrarySelectionStatusLabel}'), true);
});

test("mobile library card tap opens preview while select mode keeps selection behavior", () => {
  assert.equal(appSource.includes("if (isMobileViewport && !isMobileSelectMode) {"), true);
  assert.equal(appSource.includes("onOpenReferencePreview(item);"), true);
  assert.equal(appSource.includes("onSelectReference(item.id, event);"), true);
  assert.equal(appSource.includes("selectReference(itemId, event, { forceToggleSelection: isMobileViewport && mobileLibrarySelectMode });"), true);
  assert.equal(appSource.includes("const isToggleSelection = Boolean(options.forceToggleSelection || event?.metaKey || event?.ctrlKey);"), true);
  assert.equal(appSource.includes("onDoubleClick={(event) => {"), true);
  assert.equal(appSource.includes("if (isMobileViewport) {"), true);
  assert.equal(appSource.includes('className={`wardrobe-card-badges ${isMobileViewport ? "is-mobile-tile-badges" : ""}`}'), true);
  assert.equal(appSource.includes('className="wardrobe-mobile-selection-badge"'), true);
});

test("mobile reference preview hides chrome behind explicit toggles and uses overflow plus info states", () => {
  assert.equal(appSource.includes('const [mobileReferencePreviewChromeVisible, setMobileReferencePreviewChromeVisible] = useState(false);'), true);
  assert.equal(appSource.includes('const [mobileReferencePreviewActionsOpen, setMobileReferencePreviewActionsOpen] = useState(false);'), true);
  assert.equal(appSource.includes('const [mobileReferencePreviewInfoOpen, setMobileReferencePreviewInfoOpen] = useState(false);'), true);
  assert.equal(appSource.includes("toggleMobileReferencePreviewChrome();"), true);
  assert.equal(appSource.includes("toggleMobileReferencePreviewActions"), true);
  assert.equal(appSource.includes("toggleMobileReferencePreviewInfo"), true);
  assert.equal(appSource.includes("reference-preview-mobile-sheet"), true);
  assert.equal(appSource.includes("selection-actions-popover reference-preview-overflow-menu"), true);
});

test("mobile reference preview swipe uses the shared navigation helpers", () => {
  assert.equal(appSource.includes("onTouchStart={handleReferencePreviewStageTouchStart}"), true);
  assert.equal(appSource.includes("onTouchMove={handleReferencePreviewStageTouchMove}"), true);
  assert.equal(appSource.includes("onTouchEnd={handleReferencePreviewStageTouchEnd}"), true);
  assert.equal(appSource.includes("const direction = getReferencePreviewSwipeDirection(mobileReferencePreviewTouchRef.current);"), true);
  assert.equal(appSource.includes("openAdjacentReferencePreview(direction);"), true);
});

test("mobile library routes lower-priority actions through a More popover while desktop keeps direct buttons", () => {
  assert.equal(appSource.includes("function toggleMobileLibraryMore(event = null) {"), true);
  assert.equal(appSource.includes("function openMobileLibraryManage(event = null) {"), true);
  assert.equal(appSource.includes("function openMobileLibraryAdd(event = null) {"), true);
  assert.equal(appSource.includes('id="library-mobile-more-popover"'), true);
  assert.equal(appSource.includes('aria-controls="library-mobile-more-popover"'), true);
  assert.equal(appSource.includes("selection-actions-popover library-mobile-more-popover"), true);
  assert.equal(appSource.includes("!isMobileViewport ? ("), true);
  assert.equal(appSource.includes("Manage\n                          </button>"), true);
  assert.equal(appSource.includes("Add\n                          </button>"), true);
});

test("mobile library fullscreen shell reuses the existing wardrobe overlay structure with mobile-only classes", () => {
  assert.equal(appSource.includes('activePanel === "wardrobe" && isMobileViewport ? "is-mobile-fullscreen-shell" : ""'), true);
  assert.equal(appSource.includes('className={`wardrobe-workspace ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}'), true);
  assert.equal(appSource.includes('className={`panel wardrobe-panel ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}'), true);
  assert.equal(appSource.includes('className={`panel-header ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}'), true);
  assert.equal(appSource.includes('className={`wardrobe-panel-scroll ${isMobileViewport ? "is-mobile-fullscreen-shell" : ""}`}'), true);
});

test("mobile library selection actions popover uses mobile-only anchor and clamp classes", () => {
  assert.equal(appSource.includes('className={`library-tag-action-anchor ${isMobileViewport ? "is-mobile-library-actions-anchor" : ""}`}'), true);
  assert.equal(appSource.includes('className={`selection-actions-popover ${isMobileViewport ? "is-mobile-library-actions-popover" : ""}`}'), true);
});
