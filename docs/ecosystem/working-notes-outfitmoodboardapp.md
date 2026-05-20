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

---

# Local environments

```bash
npm run dev -- --host 0.0.0.0
````

## **OA**

- https://layerfit.vercel.app/
- http://localhost:5173/

## **MBA**

- http://localhost:5174/

---

# **Development philosophy**

- Prefer extraction over rewrites.
- Preserve behavior during refactors.
- Additive migrations over destructive migrations.
- Compatibility-first import/export handling.
- Shared utility logic before shared UI abstractions.
- Avoid simultaneous architectural + UI redesigns.
- Add regression tests around sensitive logic.

---

# **Ecosystem convergence state**

## **Shared/aligned foundations**

Implemented/aligned:

- additive `itemUuid`
- additive relationship UUID sidecars
- shared `images.original / preview / thumbnail` direction
- additive provenance/import metadata
- normalized backup import preparation
- portable hub item/link/backup direction
- compatibility-first migrations
- local-first IndexedDB persistence

Portable hub rules:

- `itemUuid` is the stable cross-app identity
- `id` remains legacy/runtime-active
- preview assets are the portable default
- originals remain optional
- unknown fields should survive normalization
- app-specific metadata must not be silently collapsed

Ownership:

- OA owns outfits
- MBA owns boards/references
- Hub routes/resolves entities, not workflows


# Shared helper extraction strategy

## Slowly extracting reusable helpers

Continue feature work normally, but extract reusable helpers whenever the same concept appears in both OA and MBA.

Prioritize shared helper extraction where:
- the concept is already stable
- the same problem has been solved in both apps
- duplication would create maintenance drift
- the helper can stay mostly UI-agnostic
- extraction does not require a large rewrite

Good candidates:
- image/media import helpers
- import metadata normalization
- EXIF/dimension/aspect-ratio helpers
- image variant/preview/original metadata shapes
- tag normalization helpers
- filter state helpers
- search-text generation helpers
- list/group/sort helpers
- overlay behavior helpers
- selection/bulk-action helpers

Avoid extracting too early:
- full editors
- full toolbars
- full card components
- app shells
- large shared UI frameworks

Goal:
- reduce duplicated logic gradually
- keep OA/MBA conceptually aligned
- avoid blocking active feature development
- avoid premature over-abstraction

---

## Shared infrastructure extraction

Longer-term, move stable cross-app systems into shared infrastructure.

Strong candidates:

### Shared media/image infrastructure
- drag-and-drop import
- multi-file import
- file picker import
- image dimensions/aspect ratio/orientation
- import metadata
- preview/original image variants
- future originals support
- future cloud storage compatibility

### Shared metadata infrastructure
- importedAt/originalFilename/fileSize/mimeType
- capturedAt/camera/lens fields where available
- no GPS/location metadata by default
- safe additive normalization
- backup/import/export compatibility

### Shared filter infrastructure
- collapsible filter groups
- searchable options
- selected counts
- active filter chips
- any/all matching helpers
- reusable filter-state model

### Shared overlay/action infrastructure
- modals
- popovers
- drawers
- action menus
- Esc/outside-click/focus handling
- z-index/viewport behavior

### Shared selection/bulk infrastructure
- selected-count pills
- multi-select behavior
- contextual actions
- operation-based bulk editing patterns

Important:
- shared architecture matters more than shared UI right now
- keep app-specific workflows where they still differ
- extract stable primitives first, not entire screens

---

# **OA**

## **Current priorities**

- the preview in OA has favorite, exclude, edit, delete buttons, which I like. MBA only has edit. But maybe this could also be an action dropdown like in library

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

## **Lifecycle direction**

Current lifecycle ladder:

```txt
Interested → Wishlist → Incoming → Wardrobe → Selling → Sold
```

Rules:

- only `Wardrobe` is generation-enabled by default
- all other lists default excluded
- unknown future non-empty list values are preserved
- lifecycle system remains intentionally lightweight

`Incoming`:

- acquired/purchased but not physically available yet

No deeper marketplace/history system yet.

## **Identity & sync preparation**

Implemented:

- additive `itemUuid`
- additive `outfitItemUuids`
- migration-safe UUID backfill
- source identity metadata:
    - `sourceNamespace`
    - `sourceRelativePath`
    - `sourceOriginalFilename`
    - `relinkStatus`
    - `importSource`
- additive `outfitUuid`
- additive `boardUuid`

Current behavior:

- `id` still drives runtime outfit relationships
- UUID sidecars are additive only
- no UUID-based runtime lookup yet

## Current sync/cloud preparation state

Implemented locally in both OA and MBA:

- dedicated `syncState` + `syncMetadata` IndexedDB stores
- stable local `deviceId`
- sync metadata backfill for existing records
- dirty marking for syncable entities
- tombstone delete handling
- stable UUID-based sync keys
- aligned local sync metadata contract across OA and MBA
- sync metadata excluded from backup export
- sync metadata rebuilt on backup import/reset

Current behavior:

- IndexedDB remains runtime source of truth
- no cloud sync yet
- no auth yet
- no Supabase integration yet
- no collaboration/public sharing
- MBA current working board remains local-only
- preview-first asset sync direction remains planned

## **Image contract direction**

Current direction:

- `images.preview` becomes canonical render asset
- `imageUrl` remains compatibility mirror
- `images.original` remains optional/archival
- `originalPreserved` must never be inferred

Still deferred:

- original preservation
- blob/object storage
- shared asset repository architecture

## **Interaction direction**

OA is:

- outfit-oriented
- action-oriented
- state-oriented

Current behavior:

- click equips
- double-click previews

Future UX possibility:

- click previews
- explicit Equip button

Do not change until desktop/mobile workflow validation.

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

## **Interaction direction**

MBA is:

- exploration-oriented
- browsing-oriented
- reference-oriented

Current behavior:

- click selects
- cmd/ctrl toggles
- shift range-selects
- double-click previews

Do not casually merge OA interaction assumptions into MBA.

## **Stable-link preparation**

MBA board images now carry:

- `referenceId`
- additive `referenceItemUuid`

Current runtime still uses:

- `referenceId`
- existing board keys/dedupe
- existing delete/repair flows

`referenceItemUuid` is currently additive metadata only.

Purpose:

- future sync/cloud support
- stable cross-app relationships
- future relinking/recovery flows

Compatibility rules:

- old boards must still work unchanged
- no UUID runtime fallback yet
- preserve backward-compatible backups/imports

## **Current MBA issues**



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

# **Shared-system opportunities**

Potential future shared systems:

- metadata normalization
- image import/compression
- asset normalization
- provenance normalization
- stable identity helpers
- persistence abstractions
- export/import backups
- multi-select/bulk editing
- library virtualization

Prefer reusable abstractions when already touching:

- image systems
- metadata
- filters
- selection
- persistence
- identity normalization

---

# **Deferred systems**

Not priority yet:

- accounts
- public sharing
- cloud sync
- collaborative features
- large storage migrations
- object-storage relinking

Before major sync/cloud work:

- stabilize contracts
- stabilize identity/provenance
- stabilize asset behavior
- reduce duplicated OA/MBA infrastructure

IndexedDB remains the active local-first layer for now.

## **Sync/cloud v1 direction**

Documented implementation direction:

- IndexedDB remains runtime source/cache
- cloud becomes durable sync target/source
- preview assets sync first
- originals remain optional/deferred
- `itemUuid` is canonical cloud identity
- `id` remains legacy/local-active
- OA and MBA remain separate apps
- hub remains resolver/router, not workflow owner
- no collaboration/public sharing in v1
- v1 conflicts use last-write-wins with timestamps/device metadata

Spec location:

- `/Users/lafsimons/Desktop/outfit-app/docs/ecosystem/sync-cloud-v1-outfitmoodboardapp.md`

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

## **OA**

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
## **MBA**

- bulk rename
- ordered board generation
- higher image counts
- auto backup updates
- remove default images
