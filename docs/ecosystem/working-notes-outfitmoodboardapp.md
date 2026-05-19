# Working Notes

OA = Outfit-App  
MBA = Moodboard-App

Before making changes, read:
- `docs/ecosystem/core-outfitmoodboardapp.md`
- `docs/ecosystem/roadmap-outfitmoodboardapp.md`
- `docs/ecosystem/working-notes-outfitmoodboardapp.md`

Preserve existing ecosystem direction and shared architectural goals.
Avoid introducing isolated app-specific systems when reusable/shared concepts already exist.

---

# Current local environments

```bash
npm run dev -- --host 0.0.0.0
```

## OA

- https://layerfit.vercel.app/ — current primary mobile dataset
- http://localhost:5173/

## MBA

- http://localhost:5174/ — current primary Mac dataset

---

# Current development philosophy

- Continue feature work normally.
- Avoid large-scale rewrites during active feature development.
- Prefer extraction over rewrites.
- Prefer behavioral stability over architectural purity.
- Extract shared systems incrementally when already touching that area.
- Preserve working UX and generation behavior during refactors.
- Add regression tests before modifying sensitive logic where feasible.
- Avoid simultaneous UI redesign + architectural migration in the same area.
- Preserve backward compatibility for imports/exports where reasonably possible.
- Stability and long-term maintainability are more important than theoretical cleanliness.

---

# Current ecosystem convergence state

## Shared/aligned so far

- additive `itemUuid` identity direction
- canonical shared `images.original / preview / thumbnail` contract direction
- additive provenance/import metadata direction
- prepared/normalized backup import direction
- portable hub item/link/backup contract direction
- explicit select/manage UX direction
- bulk editing foundations
- stable-link preparation direction
- additive migration philosophy
- local-first IndexedDB persistence direction
- compatibility-first import/export philosophy

## Still intentionally different

### OA

- structured garment/outfit-slot system
- guided outfit generation
- structured style/climate metadata
- action-oriented interaction model
- outfit/equip-first UX

### MBA

- board/reference workflows
- exploratory visual browsing
- freeform nested tagging
- board canvas interactions
- browse-oriented interaction model

## Portable hub contract notes

- `itemUuid` is the stable cross-app item identity.
- `id` remains app-local and legacy-active during transition.
- Relationships may carry additive UUID sidecars while old ids remain active.
- Preview assets are the portable default.
- Originals remain optional and archival for hub v1.
- OA owns outfits.
- MBA owns boards and references.
- The hub should route and resolve shared entities, not own domain workflows.
- Unknown fields should be preserved where possible.
- App-specific metadata must not be silently collapsed.
- Long-term provenance/import/source metadata should converge between OA and MBA.

---

# Active priorities

## OA

- improve cropping
- mobile wardrobe controls below cards
- bottom-sheet behavior
- separate sort from filter

### OA currently implemented

- explicit select/manage mode
- bulk metadata editing
- bulk wardrobe/wishlist operations
- preview overlay system
- additive import provenance metadata
- stable `itemUuid`
- canonical `images.*` normalization
- normalized backup import preparation
- lifecycle states:
  - wishlist
  - incoming
  - wardrobe

### OA current interaction direction

OA now uses an explicit manage/select mode instead of always-on selection behavior.

Normal mode preserves outfit/equip interaction.

Manage/select mode is intended for:

- bulk metadata editing
- batch operations
- future lifecycle operations
- future relationship editing
- future sync-safe actions

OA is intentionally:
- action-oriented
- state-oriented
- outfit-oriented

This is intentionally different from MBA’s browsing-oriented interaction model.

### OA current lifecycle direction

`incoming` represents items that are acquired/purchased but not yet physically available.

The current `list` field is gradually evolving toward a broader garment lifecycle/acquisition pipeline.

Current lightweight lifecycle states:

- wishlist
- incoming
- wardrobe

Deferred future lifecycle states:

- archive
- sold
- retired

Do not prematurely redesign the lifecycle model yet.

Current list behavior should remain lightweight and backward-compatible during active feature development.

### OA current sync/cloud preparation state

#### Stable identity

Implemented:

- additive `itemUuid`
- migration-safe `itemUuid` backfill
- preserved compatibility with existing `id` references

Current compatibility behavior:

- `id` remains the active relationship key
- outfit references remain `id`-based
- saved outfit references remain `id`-based

Future direction:

- gradually move toward stable identity relationships
- preserve compatibility during migration
- avoid abrupt canonical-key switches

#### Import provenance

Implemented additive provenance fields:

- `importedAt`
- `sourceOriginalFilename`
- `sourceFileSize`
- `sourceImageWidth`
- `sourceImageHeight`
- `sourceLastModified`
- `importSource`

Current behavior:

- provenance captured during upload
- provenance preserved through normalization/import/export
- provenance does not overwrite historical timestamps

#### Shared image contract direction

Current contract:

- `images.preview` is the future canonical render contract
- `imageUrl` remains a compatibility mirror of `images.preview.src`
- `images.original` is optional and archival-oriented
- `originalPreserved` must never be inferred automatically

Current compatibility behavior:

- legacy `imageUrl` items continue working
- unknown `images.*` fields are preserved
- runtime still primarily renders through `imageUrl`

Deferred:

- original-image preservation strategy
- object/blob storage strategy
- canonical asset repository architecture

### OA future UX question

Current behavior:
- click equips
- double-click previews

Possible future direction:
- click previews
- explicit Equip button equips

Do not change until desktop/mobile workflow behavior is validated.

---

## MBA

### MBA currently implemented

- freeform nested tagging
- multi-select library interactions
- board canvas interactions
- reference preview overlay
- additive `itemUuid`
- additive `referenceItemUuid`
- richer import metadata pipeline
- preview/original/thumbnail image contract
- backup normalization/import preparation

### MBA current interaction direction

MBA remains:
- exploration-oriented
- browsing-oriented
- reference-oriented

Current library behavior:

- click selects
- cmd/ctrl click toggles
- shift click range-selects
- double-click previews

Possible future direction:

- explicit browse/select distinction for library interactions
- preserve board interaction behavior
- preserve double-click preview behavior
- preserve existing bulk/tag workflows

Do not casually merge OA interaction assumptions into MBA board interactions.

### MBA stable-link preparation direction

MBA board images now carry additive `referenceItemUuid` metadata alongside the existing `referenceId`.

Current behavior remains intentionally unchanged:

- `referenceId` is still the active runtime/render relationship key
- board rendering still resolves through `referenceId`
- saved-board dedupe and board keys still use `referenceId`
- delete/repair behavior still operates through `referenceId`

`referenceItemUuid` currently acts as additive stable-link metadata only.

Purpose:

- prepare future sync/cloud support
- prepare stable cross-app relationships
- reduce future dependence on mutable `id`
- support future relinking/recovery flows

Current compatibility strategy:

- old boards with only `referenceId` must continue working unchanged
- new boards may contain both `referenceId` and `referenceItemUuid`
- backup/import behavior must remain backward-compatible
- no runtime fallback to UUID-based lookup yet

Future direction:

- gradually move relationship systems toward stable identity
- preserve compatibility during the migration window
- avoid abrupt canonical-key switches

### MBA active issues

#### Tags

- infinite nesting support
- keyboard selection improvements
- rename hierarchy edge cases

#### Crop

- incorrect crop boundaries
- oversized crop UI on tall images

#### Canvas

- occasional distortion
- preview/render mismatch

---

# Active refactor state

## OA

### Current extraction progress

Extracted from `App.jsx`:

- `src/lib/itemModel.js`
- `src/lib/imagePresentation.js`
- `src/lib/appStateModel.js`
- `src/lib/selectionModel.js`
- `src/lib/bulkEdit.js`
- `src/lib/importMetadata.js`
- `src/lib/backupImport.js`

Added tests:

- `src/lib/itemModel.test.js`
- `src/lib/imagePresentation.test.js`
- `src/lib/appStateModel.test.js`
- `src/lib/selectionModel.test.js`
- `src/lib/bulkEdit.test.js`
- `src/lib/importMetadata.test.js`
- `src/lib/backupImport.test.js`

Current extracted components:

- `ConfirmationDialog`
- `PreviewOverlay`
- `WardrobeSelectionBar`

### Current refactor goal

Reduce `App.jsx` responsibilities incrementally without changing behavior.

### Current intentional boundaries

The following remain intentionally inside `App.jsx` for now:

- `ManagedItemImage`
- `useImageMetrics`
- `resolveImageUrl`
- export handlers
- upload/compression handlers
- crop baking/migration logic
- selection/equip interaction routing
- bulk persistence orchestration
- outfit cleanup behavior

These systems remain tightly coupled and behavior-sensitive.

### Current extraction guidance

- Prefer extracting pure utility logic first.
- Keep extraction targets dependency-light.
- Avoid circular abstractions.
- Avoid prematurely building shared UI systems.
- Shared utilities are preferred before shared component layers.

### Known OA architectural concerns

- Dresses/Jumpsuits slot integration
- TopInner accepting Outerwear
- minimum guided-score floor
- config-table refactor for defaults
- tiny wardrobe fixture datasets for testing

---

# Sensitive systems

## Image system

Crop, scale, frame scale, offset, preview rendering, rendered bounds, and export alignment are tightly connected.

Do not casually modify:

- crop math
- export math
- image transforms
- preview alignment
- rendered/stored bounds alignment
- migration behavior

Future crop fixes should ideally happen only after:

- isolating behavior
- adding regression coverage
- validating export compatibility

Avoid changing persisted image fields unless migration/backward compatibility is explicitly handled.

## Metadata & persistence

Preserve:

- import metadata
- timestamps
- `itemUuid`
- backward compatibility where feasible
- unknown metadata fields during normalization

Update `updatedAt` only on actual edits.

Avoid unnecessary metadata rewrites during migrations.

Historical continuity matters.

## Generation systems

Generation behavior should remain stable during refactors.

Avoid unintentionally changing:

- scoring behavior
- weighting behavior
- filtering behavior
- slot logic
- guided generation outcomes

Add regression fixtures/tests where useful.

---

# Shared-system extraction opportunities

The ecosystem should gradually move toward shared reusable infrastructure instead of duplicated app-specific implementations.

Prefer shared pure utility logic before shared UI abstractions.

## Potential future shared systems

- bulk editing
- multi-select
- metadata normalization
- metadata filters
- image import/compression
- image storage handling
- asset normalization
- provenance normalization
- stable identity helpers
- persistence abstractions
- export/import backups
- library virtualization
- selection systems

Prefer reusable abstractions when already touching:

- image systems
- metadata
- filters
- tags
- selection
- persistence
- import/export
- asset handling
- identity normalization

---

# MBA cleanup direction

- rename remaining Outfit-App identifiers
- remove obsolete copied root files
- separate app identity from shared infrastructure
- improve repository structure before public sharing

---

# Deferred systems

Do not prioritize yet:

- accounts
- public sharing
- cloud sync
- collaborative features
- object-storage relinking
- large-scale storage migrations

Sync readiness should still influence current architectural decisions.

Before major sync/cloud work:

- extract reusable modules from `App.jsx`
- standardize storage shapes
- standardize export/import structures
- reduce duplicated OA/MBA infrastructure
- stabilize repository boundaries
- stabilize image asset contracts
- stabilize identity/provenance contracts

IndexedDB should continue functioning as the active local-first layer until shared storage architecture is mature.

---

# Known architectural risks

- `App.jsx` still contains tightly coupled image/export behavior
- crop/export alignment remains fragile
- existing import/export datasets may contain inconsistent historical shapes
- OA and MBA still duplicate some infrastructure concepts
- local-first assumptions may complicate future sync architecture
- image handling and metadata migrations remain high-risk regression areas
- relationship systems still largely rely on mutable `id`
- OA runtime still primarily renders from `imageUrl`

---

# Temporary ideas / backlog

## OA

- linked references
- wardrobe-role metadata
- multi-outfit generation
- canvas-style outfit comparison

## MBA

- bulk rename
- ordered board generation
- higher image counts
- auto backup updates
- remove default images
