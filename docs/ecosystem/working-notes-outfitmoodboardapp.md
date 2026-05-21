# Working Notes

OA = Outfit-App  
MBA = Moodboard-App

Before making changes, read:
- `/Users/lafsimons/Desktop/outfit-app/docs/ecosystem/core-outfitmoodboardapp.md`
- `/Users/lafsimons/Desktop/outfit-app/docs/ecosystem/roadmap-outfitmoodboardapp.md`
- `/Users/lafsimons/Desktop/outfit-app/docs/ecosystem/working-notes-outfitmoodboardapp.md`

Preserve ecosystem direction and shared architectural goals.
Avoid isolated app-specific systems when reusable/shared concepts already exist.

Current sync/cloud implementation spec:
- `/Users/lafsimons/Desktop/outfit-app/docs/ecosystem/sync-cloud-v1-outfitmoodboardapp.md`

# Local environments

```bash
npm run dev -- --host 0.0.0.0
````

---

# OA & MBA Current priorities

## **OA — Phase 1 (Core interaction stabilization)**

### **Local controls architecture**

- Audit/spec local collection controls
- Implement selector-local search/filter/sort
- Audit/spec dashboard-local filters
- Implement dashboard-local filters

---

### **Core interaction fixes**

- Fix exclude in selector not triggering reroll/generation
- Clicking item no longer auto-opens Select on desktop
- Outfit single-click = select
- Outfit double-click = preview
- Add “Unlock all slots” control
- Toolbar selected/unselected layout stability
- Persist editor/add-images window positions

---

### **UI polish / smaller fixes**

- Headwear hover buttons cut off
- Remove click/select shadows
- Preview equip → unequip state polish
- Preview favorite heart icon
- Dashboard search hidden + filter reposition
- Manage buttons non-wrapping layout

---

## **OA — Phase 2 (Selector & preview UX redesign)**

### **Selector / actions redesign**

- Audit/spec outfit actions architecture
- Implement Actions dropdown in outfit hover controls
- Preview view redesign / action hierarchy cleanup

---

### **Layering / accessory systems**

- Audit/spec accessory visibility system
- Implement per-item accessory visibility toggles
- Audit/spec layering-off “which item stays” behavior
- Implement layering-off keep-inner/keep-outer behavior

---

## **OA — Phase 3 (Secondary collection surfaces)**

### **Saved Outfits**

- Local search/filter/sort for Saved Outfits

### **Fitpics**

- Lightweight local search/sort for Fitpics

---

## **MBA — Phase 1 (Interaction & layout stabilization)**

### **Boards / navigation**

- Remove “Back to Library” button in Boards
- ESC in Boards closes panel only
- Library button toggles closed again

---

### **Window persistence**

- Persist editor window positions
- Persist add-images window positions

---

### **Filters / manage tags**

- Move Manage Tags into Filter panel

---

### **Item editor structure/layout**

- Refactor image controls hierarchy/layout
- Keep Add Tag full-width row
- Consistent button heights/grid widths
- Reduce oversized gaps
- Align controls to top

---

### **Item editor visual polish**

- Subtle favorite heart
- Hover-only heart circle
- Secondary styling for Replace Original Image
- Technical/subtle preview regeneration controls
- Separate destructive Remove Image area

---

## **Shared ecosystem features (OA + MBA)**

### **Saved miniature previews**

- Audit/spec screenshot-style miniature rendering
- Implement OA screenshot-style saved outfit previews
- Implement MBA screenshot-style saved board previews

---

## **Architectural direction / principles**

### **Local state per surface**

- Selector controls independent from Wardrobe
- Dashboard filters independent from Wardrobe
- Saved Outfits controls independent
- Fitpics controls independent
- Avoid global shared filter state across surfaces

---

## **Recommended implementation order**

### **Highest priority**

1. Selector-local controls
2. Dashboard-local filters
3. Toolbar stability
4. Click/double-click interaction fixes
5. Exclude without reroll
6. Unlock all slots
7. Window persistence

### **Medium priority**

8. MBA interaction/layout fixes
9. Selector action dropdown
10. Preview redesign
11. Layering/accessory systems

### **Later / polish**

12. Saved Outfits controls
13. Fitpics controls
14. Screenshot-style miniatures

# OA & MBA Secondary Priorities 
(might be partially already in list above, will be checked afterwards)

## **Mobile check**
1. MBA quick mobile audit
2. OA quick mobile audit
3. Note all issues
4. Batch-fix mobile interaction/layout problems
5. Then continue editor/bulk-editor work
**MBA mobile**
- Library scrolling rhythm
- Toolbar wrapping
- Selection behavior
- Actions menu
- Preview/editor overlays
- Board gestures
- Saved boards
- Search/filter usability
- Card density
- Safe-area spacing
- Touch targets
**OA mobile**
- Wardrobe grid density
- Outfit window
- Fitpics flow
- Saved outfits
- Toolbar stability
- Bottom-sheet behavior
- Bulk edit
- Generator usability
- Preview/editor overlays
- Selection state

---

## **Next Steps:** 
1. Finish MBA Library grid
    Hide raw names unless explicitly renamed.
2. Improve MBA reference editor
    Bring closer to OA editor hierarchy.
3. Improve both bulk editors
    MBA + OA should use the same operation-based bulk-edit philosophy, with app-specific operations.
4. Finish OA Fitpics + Saved Outfits
5. Finish MBA Saved Boards
6. Normalize Fitpics ↔ MBA References
    Shared media/reference shape and compatibility.
7. Add relationship model
    Link outfits, wardrobe pieces, fitpics, MBA references, and boards.

---

# **OA**

## **Current implemented foundations**

- explicit select/manage mode
- bulk editing/batch operations
- preview overlay system
- additive `itemUuid`
- additive provenance metadata
- `images.*` normalization
- normalized backup import
- persisted wardrobe/library filters
- compact generation `Lists` control

## Current sync/cloud preparation state
Current local sync preparation is implemented in both OA and MBA.
See:
- sync-cloud-v1-outfitmoodboardapp.md

---

# **MBA**

## **Current implemented foundations**

- nested freeform tagging
- board canvas workflows
- multi-select interactions
- preview overlay
- additive `itemUuid`
- additive `referenceItemUuid`
- richer import metadata pipeline
- portable-core preservation updates
- backup normalization/import preparation

## **Current MBA issues**

- when I click ESC in saved boards, this should not go back to library, but to the board. also remove the "back to library" button
- saved boards are deleting on refresh page
- images in card could be bigger (like in OA)
- toolbar: remove divider line

### **Tags**

- infinite nesting support
- keyboard improvements
- rename hierarchy edge cases

### **Crop**

- incorrect crop boundaries
- oversized crop UI on tall images

### **Canvas**

- occasional distortion
- preview/render mismatch

---

# **Active refactor state**

## **OA extracted modules**

From `App.jsx`:

- `itemModel`
- `imagePresentation`
- `appStateModel`
- `selectionModel`
- `bulkEdit`
- `importMetadata`
- `backupImport`

Extracted components:

- `ConfirmationDialog`
- `PreviewOverlay`
- `WardrobeSelectionBar`

Goal:

- reduce `App.jsx` incrementally without behavior changes

Still intentionally coupled:

- crop/export math
- upload/compression flow
- image rendering behavior
- selection/equip routing
- outfit cleanup behavior

Known concerns:

- Dresses/Jumpsuits slot integration
- TopInner accepting Outerwear
- guided-score floor
- defaults config-table refactor
- fixture datasets for testing

---

# **Sensitive systems**

## **Image system**

Do not casually modify:

- crop math
- export math
- image transforms
- preview alignment
- rendered/stored bounds alignment
- migration behavior

Add regression coverage before crop/export work.

## **Metadata & persistence**

Preserve:

- timestamps
- import metadata
- `itemUuid`
- unknown metadata fields
- backward compatibility where feasible

Update `updatedAt` only on real edits.

## **Generation systems**

Avoid accidental changes to:

- scoring
- weighting
- filtering
- slot logic
- guided generation behavior

Use regression fixtures/tests when possible.

---

# **Deferred systems**

Before major sync/cloud work:

- stabilize contracts
- stabilize identity/provenance
- stabilize asset behavior
- reduce duplicated OA/MBA infrastructure

IndexedDB remains the active local-first layer for now.

---

# **Known risks**

- `App.jsx` still contains tightly coupled image/export logic
- crop/export alignment remains fragile
- historical datasets contain inconsistent shapes
- relationship systems still mostly rely on mutable `id`
- OA still primarily renders from `imageUrl`
- metadata/image migrations remain high-risk regression areas

---

# **Backlog**

## near-term backlog
### **OA**

- improve cropping
- mobile wardrobe controls below cards
- bottom-sheet behavior
- linked references
- wardrobe-role metadata
- multi-outfit generation
- canvas-style outfit comparison
- Unify overlay systems
	- preview
	- filter popover
	- select actions
	- edit drawers
	- saved outfits
	- manage dialogs
	- all likely want one shared overlay/modal architecture eventually.
- transparent PNG auto-fit
	- Explore detecting visible pixel bounds for transparent PNGs so garments with huge transparent margins render more consistently.
	- Do not implement auto-fit yet unless simple and low-risk.
	- This may need cached metadata such as visibleBounds.
- Later: Wardrobe density modes
	- Add optional wardrobe grid density modes once the base card layout is stable.
	- Modes:
		- Comfortable: current visual browsing layout
		- Compact: more columns, smaller gaps, name-only cards for large wardrobes
	- Requirements:
	- preserve image aspect ratio
	- preserve visual safe area
	- preserve selection/preview behavior
	- make setting persistent
	- avoid adding this before the main card layout stabilizes
- improve image cards sizing / cropped showing

### **MBA**
- bulk rename
- higher image counts
- Manage Tags:
	- add also to add new tags
	- change order button A-Z / number
- Tags in cards: Keep visible tags curated

## speculative ideas

### OA

### MBA
- auto backup updates
- ordered board generation