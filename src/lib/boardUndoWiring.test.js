import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

test("board toolbar exposes Undo, Redo, and Rearrange controls with labels and tooltips", () => {
  assert.match(appSource, /title="Undo"[\s\S]{0,120}?aria-label="Undo"[\s\S]{0,120}?>\s*Undo\s*</);
  assert.match(appSource, /title="Redo"[\s\S]{0,120}?aria-label="Redo"[\s\S]{0,120}?>\s*Redo\s*</);
  assert.match(appSource, /title="Rearrange board"[\s\S]{0,160}?aria-label="Rearrange board"[\s\S]{0,160}?>\s*Rearrange\s*</);
  assert.doesNotMatch(appSource, /title="Select board images"/);
});

test("board rearrange uses relayout plus existing undo snapshot commit flow", () => {
  assert.match(appSource, /function handleRearrangeCurrentBoard\(\)/);
  assert.match(appSource, /if \(!currentBoard\?\.images\?\.length \|\| currentBoard\.images\.length <= 1\) \{\s*return;\s*\}/);
  assert.match(appSource, /const nextBoard = relayoutBoardStateImages\(currentBoard\.images\);/);
  assert.match(appSource, /commitBoardSnapshotChange\(nextBoard,\s*\{\s*historySnapshot: captureCurrentBoardHistorySnapshot\(\),\s*clearBoardImageUi: true\s*\}\);/);
  assert.match(appSource, /disabled=\{!board\?\.images\?\.length \|\| board\.images\.length <= 1\}/);
});

test("board select mode exposes board-only bulk actions and excludes library-only actions", () => {
  assert.match(appSource, /const \[boardSelectMode, setBoardSelectMode\] = useState\(false\);/);
  assert.match(appSource, /const \[selectedBoardImageSelection, setSelectedBoardImageSelection\] = useState\(\{\s*ids: \{\},\s*anchorId: null\s*\}\);/);
  assert.match(appSource, /<span className="board-canvas-selection-count">\{selectedBoardImageCount\} selected<\/span>/);
  assert.match(appSource, /id="board-selection-actions-popover"/);
  assert.match(appSource, />\s*Remove selected images\s*</);
  assert.match(appSource, />\s*Add tags\s*</);
  assert.match(appSource, />\s*Remove tags\s*</);
  assert.match(appSource, />\s*Favorite\s*</);
  assert.match(appSource, />\s*Exclude\s*</);
  assert.match(appSource, />\s*Done\s*</);
  assert.match(appSource, /selectedBoardImageCount === 1[\s\S]{0,600}>\s*Edit\s*</);
  assert.doesNotMatch(appSource, /board-selection-actions-popover[\s\S]{0,1400}Create Board from Selection/);
  assert.doesNotMatch(appSource, /board-selection-actions-popover[\s\S]{0,1400}Add Selection to Current Board/);
});

test("board select mode disables drag and picker behavior and bulk remove uses the undo commit path", () => {
  assert.match(appSource, /if \(boardSelectMode\) \{\s*if \(event\.detail >= 2 && selectedBoardImageIdSet\.has\(image\.id\)\) \{\s*event\.preventDefault\(\);\s*return;\s*\}\s*event\.preventDefault\(\);\s*toggleBoardImageSelection\(image\.id, event\);\s*return;\s*\}/);
  assert.match(appSource, /if \(boardSelectMode\) \{\s*toggleBoardImageSelection\(imageId\);\s*return;\s*\}/);
  assert.match(appSource, /if \(boardSelectMode\) \{\s*clearSelectedBoardImages\(\);\s*setBoardSelectMode\(false\);\s*boardSelectModeBoardIdRef\.current = null;\s*\}/);
  assert.match(appSource, /commitBoardSnapshotChange\(nextImages\.length \? relayoutBoardStateImages\(nextImages\) : null, \{\s*historySnapshot: captureCurrentBoardHistorySnapshot\(\),\s*clearBoardImageUi: true,/);
});

test("board bulk metadata actions use explicit selected reference ids and stay separate from library selection", () => {
  assert.match(appSource, /function applyImmediateBulkTagEditForReferenceIds\(referenceIds, mode, tag\)/);
  assert.match(appSource, /function applyImmediateBulkFavoriteEditForReferenceIds\(referenceIds, nextValue\)/);
  assert.match(appSource, /function applyImmediateBulkExcludedEditForReferenceIds\(referenceIds, nextValue\)/);
  assert.match(appSource, /applyImmediateBulkFavoriteEditForReferenceIds\(selectedBoardReferenceIdList, "yes"\)/);
  assert.match(appSource, /applyImmediateBulkExcludedEditForReferenceIds\(selectedBoardReferenceIdList, "yes"\)/);
  assert.match(appSource, /const \[selectedReferenceSelection, setSelectedReferenceSelection\] = useState/);
  assert.match(appSource, /const \[selectedBoardImageSelection, setSelectedBoardImageSelection\] = useState/);
});

test("board select mode reuses library-style selection semantics for single and modifier clicks", () => {
  assert.match(appSource, /function toggleBoardImageSelection\(imageId, event = null, options = \{\}\)/);
  assert.match(appSource, /const currentBoardImageIds = boardRef\.current\?\.images\?\.map\(\(image\) => image\.id\) \?\? \[\];/);
  assert.match(appSource, /const isToggleSelection = Boolean\(options\.forceToggleSelection \|\| event\?\.metaKey \|\| event\?\.ctrlKey\);/);
  assert.match(appSource, /const isRangeSelection = Boolean\(event\?\.shiftKey\);/);
  assert.match(appSource, /const \{ nextSelection, nextAnchorId \} = getNextLibrarySelection\(\{/);
});

test("board select mode stays active until the underlying board actually changes", () => {
  assert.match(appSource, /const boardSelectModeBoardIdRef = useRef\(null\);/);
  assert.match(appSource, /boardSelectModeBoardIdRef\.current = boardRef\.current\?\.id \?\? null;/);
  assert.match(appSource, /if \(board\.id !== boardSelectModeBoardIdRef\.current\) \{\s*exitBoardSelectMode\(\);\s*\}/);
});

test("board selection is transient and auto-enters on image click then exits when cleared", () => {
  assert.match(appSource, /function startBoardImageSelection\(imageId, event = null, options = \{\}\)/);
  assert.match(appSource, /setBoardSelectMode\(true\);\s*toggleBoardImageSelection\(imageId, event, options\);/);
  assert.match(appSource, /startBoardImageSelection\(image\.id, event\);\s*startBoardInteraction\(event, \{/);
  assert.match(appSource, /if \(!boardSelectMode \|\| selectedBoardImageCount > 0\) \{\s*return;\s*\}\s*boardSelectModeBoardIdRef\.current = null;\s*setBoardSelectMode\(false\);/);
});

test("board selection can be dismissed with escape and double click preview still opens", () => {
  assert.match(appSource, /if \(boardSelectMode \|\| selectedBoardImageCount > 0 \|\| boardSelectionActionsOpen \|\| boardTagActionMode\) \{\s*event\.preventDefault\(\);\s*blurRetainedPointerFocus\(\);\s*exitBoardSelectMode\(\);\s*return;\s*\}/);
  assert.match(appSource, /onImageDoubleClick=\{\(boardImage, boardItem\) => \{\s*openReferencePreview\(boardItem\);\s*\}\}/);
});

test("library cards carry current-board border state and move favorite to a corner badge", () => {
  assert.match(appSource, /const currentBoardReferenceIdSet = useMemo\(/);
  assert.match(appSource, /isOnCurrentBoard=\{currentBoardReferenceIdSet\.has\(item\.id\)\}/);
  assert.match(appSource, /className=\{`wardrobe-card .*?\$\{isOnCurrentBoard \? "is-on-current-board" : ""\}/s);
  assert.match(appSource, /className="wardrobe-card-corner-badge" aria-label="Favorite"/);
});

test("board undo keyboard shortcuts are wired for undo and redo", () => {
  assert.match(appSource, /const normalizedKey = event\.key\.toLowerCase\(\);/);
  assert.match(appSource, /if \(isPrimaryModifier && normalizedKey === "z"\)/);
  assert.match(appSource, /if \(event\.shiftKey\) \{\s*handleRedoBoardChange\(\);\s*\} else \{\s*handleUndoBoardChange\(\);\s*\}/);
  assert.match(appSource, /if \(isPrimaryModifier && normalizedKey === "y"\)/);
});
