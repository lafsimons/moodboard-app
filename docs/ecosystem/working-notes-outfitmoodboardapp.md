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

npm run dev -- --host 0.0.0.0 --port 5174
````

`/Users/lafsimons/Desktop/outfit-app/`
`/Users/lafsimons/Desktop/moodboard-app/`

---

# Recent stabilization checkpoint

Completed in MBA:
- metadata-first startup
- metadata-only runtime state
- out-of-line media storage
- lazy media resolution
- removed post-startup full hydration
- Safe Mode recovery
- batched delete cleanup
- persistence dedupe
- virtualization reload stabilization
- backup hardening

Next large-library architecture work:
- archive/chunked backup format
- media integrity tools
- export limits/UX
- optional object URL cache layer

---

# OA & MBA Current priorities

## OA + MBA — Stability / Scaling

### Completed large-library stabilization

- ~~Large-library crash fix~~
- ~~Large backup import/export hardening~~

### Persistence / rendering

- Audit/spec screenshot-style miniature rendering
- Implement OA screenshot-style saved outfit previews
- Implement MBA screenshot-style saved board previews

## OA — Phase 1 (Core interaction stabilization)

### Local collection controls architecture

- Audit/spec local collection controls
- Implement selector-local search/filter/sort
- Audit/spec dashboard-local filters
- Implement dashboard-local filters

### Secondary surface rollout

- Local search/filter/sort for Saved Outfits
- Lightweight local search/sort for Fitpics

### **Core interaction fixes** -  done

- ~~Fix exclude in selector not triggering reroll/generation~~
- ~~Clicking item no longer auto-opens Select on desktop~~
- ~~Outfit single-click = select~~
- ~~Outfit double-click = preview~~
- ~~Add “Unlock all slots” control~~
- ~~Persist editor/add-images window positions~~

### **UI polish / smaller fixes** -  done

- ~~Remove click/select shadows~~
- ~~Preview equip → unequip state polish~~
- ~~Preview favorite heart icon~~
- ~~Dashboard search hidden + filter reposition~~
- ~~Manage buttons non-wrapping layout~~


### Deferred polish

- Toolbar selected/unselected layout stability
- Headwear hover buttons cut off (minor remaining issue)

## **OA — Phase 2 (Selector & preview UX redesign)**

### **Selector / actions redesign**

- Audit/spec outfit actions architecture
- Implement Actions dropdown in outfit hover controls
- Preview view redesign / action hierarchy cleanup

### Accessory / layering systems

- Audit/spec accessory visibility system
- Implement per-item accessory visibility toggles
- Audit/spec layering-off “which item stays” behavior
- Implement layering-off keep-inner/keep-outer behavior

## ~~**MBA — Phase 1 (Interaction & layout stabilization)** - done~~

### ~~**Boards / navigation**~~

- ~~Remove “Back to Library” button in Boards~~
- ~~ESC in Boards closes panel only~~
- ~~Library button toggles closed again~~

### ~~**Window persistence**~~

- ~~Persist editor window positions~~
- ~~Persist add-images window positions~~

### ~~**Filters / manage tags**~~

- ~~Move Manage Tags into Filter panel~~

### ~~**Item editor structure/layout**~~

- ~~Refactor image controls hierarchy/layout~~
- ~~Keep Add Tag full-width row~~
- ~~Consistent button heights/grid widths~~
- ~~Reduce oversized gaps~~
- ~~Align controls to top~~

### ~~**Item editor visual polish**~~

- ~~Subtle favorite heart~~
- ~~Hover-only heart circle~~
- ~~Secondary styling for Replace Original Image~~
- ~~Technical/subtle preview regeneration controls~~
- ~~Separate destructive Remove Image area~~

## **Architectural direction / principles**

## Mobile Quick Wins
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

## Ecosystem Evolution (Post-Stabilization)

### Shared editing systems

- Improve MBA bulk editor
- Improve OA bulk editor
- Align both apps around shared operation-based bulk-edit architecture
- Keep app-specific operations where needed

### Shared reference/media model

- Normalize Fitpics ↔ MBA references
- Shared media/reference shape
- Shared compatibility layer

### Secondary entity systems

- Finish OA Fitpics
- Finish OA Saved Outfits
- Finish MBA Saved Boards

### Relationship model

- Link:
  - wardrobe items
  - outfits
  - fitpics
  - MBA references
  - saved boards

- Support many-to-many relationships
- Preserve local-first architecture compatibility

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

### **Tags**

- infinite nesting support
- keyboard improvements
- rename hierarchy edge cases

### **Crop**

- crop boundary edge cases on tall/extreme-aspect images
- oversized crop UI on tall images

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

## Runtime hydration warning

Do not casually reintroduce:
- full-library runtime hydration
- inline media residency in React state
- startup-time full media materialization

Large-library stabilization depends on maintaining:
- metadata-only runtime state
- lazy media resolution
- out-of-line media storage

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
- Current browser architecture has been substantially hardened for multi-thousand-image libraries, but continued validation is needed around memory pressure, large IndexedDB flows, backup size, and recovery behavior.
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
- validate higher image counts after metadata/media split
- define practical backup/export limits
- add media integrity tools
- Manage Tags:
	- add also to add new tags
	- change order button A-Z / number
- Tags in cards: Keep visible tags curated

## speculative ideas

### OA

### MBA
- auto backup updates
- ordered board generation