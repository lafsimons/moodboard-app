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
````

## **OA**

- https://layerfit.vercel.app/ — current primary mobile dataset
- http://localhost:5173/

## **MBA**

- http://localhost:5174/ — current primary Mac dataset

---

# **Current development philosophy**

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

# **Active priorities**

## **OA**

- improve cropping
- mobile wardrobe controls below cards
- bottom-sheet behavior
- separate sort from filter

### **OA selection & bulk-management direction**

OA now uses an explicit manage/select mode instead of always-on selection behavior.

Normal mode preserves outfit/equip interaction.

Manage/select mode is intended for:

- bulk metadata editing
- batch wardrobe/wishlist operations
- future lifecycle operations
- future relationship editing
- future sync-safe batch actions

OA is action-oriented and state-oriented.

This is intentionally different from MBA’s current always-selection-first library behavior.

MBA is exploration-oriented and browsing-oriented.

MBA may later adopt a related browse/select distinction for library interactions while preserving board interactions.

OA future UX question:

- Reconsider wardrobe card click behavior now that preview and select mode exist.
- Current behavior: normal click equips, double-click previews.
- Possible future behavior: click opens preview, explicit Equip button equips.
- Do not change until mobile/desktop workflow is tested.

### **OA current sync/cloud preparation progress**

Implemented:

- stable `itemUuid` identity field
- additive import provenance metadata
- canonical shared `images.original / preview / thumbnail` normalization
- explicit preview overlay system
- explicit select/manage mode
- bulk metadata editing and batch operations

Current additive provenance fields:

- `importedAt`
- `sourceOriginalFilename`
- `sourceFileSize`
- `sourceImageWidth`
- `sourceImageHeight`
- `sourceLastModified`
- `importSource`

Current shared image contract direction:

- `images.preview` should become the canonical shared render contract
- `imageUrl` remains a compatibility mirror of `images.preview.src`
- `images.original` remains optional and archival-oriented
- `originalPreserved` must never be inferred automatically
- original storage strategy is still deferred

Current stable identity direction:

- `itemUuid` is the future canonical relationship/sync identity
- current `id` behavior remains active during compatibility transition
- outfit references and saved outfit references are still `id`-based for now

Known future sync blockers:

- relationship systems still point at mutable `id`
- OA backup import/export remains simpler than MBA
- OA runtime rendering still primarily uses `imageUrl`
- originals are not preserved yet
- shared asset repository architecture is not finalized

---

## **MBA**

### **Tags**

- infinite nesting support
- keyboard selection improvements
- rename hierarchy issues

### **Crop**

- incorrect crop boundaries
- oversized crop UI on tall images

### **Canvas**

- occasional distortion
- preview/render mismatch

### **MBA interaction direction**

MBA currently remains exploration-oriented and browsing-oriented.

Current library behavior:

- click selects
- cmd/ctrl click toggles
- shift click range-selects
- double-click previews

Possible future direction:

- explicit browse/select distinction for library interactions
- preserve current board interaction behavior
- preserve double-click preview behavior
- preserve existing bulk/tag workflows

Do not casually merge OA interaction assumptions into MBA board interactions.

---

# **Active refactor state**

## **OA**

### **Current extraction progress**

Extracted from `App.jsx`:

- `src/lib/itemModel.js`
- `src/lib/imagePresentation.js`
- `src/lib/appStateModel.js`
- `src/lib/selectionModel.js`
- `src/lib/bulkEdit.js`
- `src/lib/importMetadata.js`

Added:

- `src/lib/itemModel.test.js`
- `src/lib/imagePresentation.test.js`
- `src/lib/appStateModel.test.js`
- `src/lib/selectionModel.test.js`
- `src/lib/bulkEdit.test.js`
- `src/lib/importMetadata.test.js`

Current extracted components:

- `ConfirmationDialog`
- `PreviewOverlay`
- `WardrobeSelectionBar`

### **Current refactor goal**

Reduce `App.jsx` responsibilities incrementally without changing behavior.

### **Current intentional boundaries**

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

### **Current extraction guidance**

- Prefer extracting pure utility logic first.
- Keep extraction targets dependency-light.
- Avoid circular abstractions.
- Avoid prematurely building shared UI systems.
- Shared utilities are preferred before shared component layers.

Build/tests passed after current extraction steps.

### **Known OA architectural concerns**

- Dresses/Jumpsuits slot integration
- TopInner accepting Outerwear
- minimum guided-score floor
- config-table refactor for defaults
- tiny wardrobe fixture datasets for testing

### **Deferred OA lifecycle systems**

Define garment lifecycle/acquisition pipeline before implementing:

- wishlist
- archive
- sold states
- acquisition tracking

---

# **Sensitive systems**

## **Image system**

Crop, scale, frame scale, offset, preview rendering, rendered bounds, and export alignment are tightly connected.

Do not casually “clean up”:

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

---

## **Metadata & persistence**

- preserve import metadata
- preserve timestamps
- preserve `itemUuid`
- update `updatedAt` only on actual edits
- preserve backward compatibility for imports/exports where feasible
- avoid unnecessary metadata rewrites during migrations

Historical continuity matters.

---

## **Generation systems**

Generation behavior should remain stable during refactors.

Avoid unintentionally changing:

- scoring behavior
- weighting behavior
- filtering behavior
- slot logic
- guided generation outcomes

Add small regression fixtures/tests where useful.

---

# **Shared-system extraction opportunities**

The ecosystem should gradually move toward shared reusable infrastructure instead of duplicated app-specific implementations.

Prefer shared pure utility logic before shared UI abstractions.

Potential shared systems:

- bulk editing
- multi-select
- tag editing
- metadata normalization
- metadata filters
- image import/compression
- image storage handling
- library virtualization
- selection systems
- persistence abstractions
- export/import backups
- provenance normalization
- stable identity helpers
- asset normalization helpers

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

# **MBA cleanup direction**

- rename remaining Outfit-App identifiers
- remove obsolete copied root files
- separate app identity from shared infrastructure
- improve repository structure before public sharing

---

# **Deferred systems**

Do not prioritize yet:

- accounts
- public sharing
- cloud sync
- collaborative features
- object-storage relinking
- large-scale storage migrations

Sync readiness should still influence current architectural decisions.

Before sync/cloud work:

- extract reusable modules from `App.jsx`
- standardize storage shapes
- standardize export/import structures
- reduce duplicated OA/MBA infrastructure
- stabilize repository boundaries
- stabilize image asset contracts
- stabilize identity/provenance contracts

IndexedDB should continue functioning as the active local-first layer until shared storage architecture is mature.

---

# **Known architectural risks**

- `App.jsx` still contains tightly coupled image/export behavior.
- Crop/export alignment remains fragile.
- Existing import/export datasets may contain inconsistent historical shapes.
- OA and MBA still duplicate some infrastructure concepts.
- Current local-first assumptions may complicate future sync architecture.
- Image handling and metadata migrations remain high-risk areas for regressions.
- Relationship systems still rely on mutable `id`.
- OA runtime still primarily renders from `imageUrl`.

---

# **Temporary ideas / backlog**

## **OA**

- linked references
- lifecycle tracking
- wardrobe-role metadata
- multi-outfit generation
- canvas-style outfit comparison
- stable relationship migration toward `itemUuid`
- original-image preservation strategy
- shared asset repository abstraction

## **MBA**

- bulk rename
- ordered board generation
- higher image counts
- auto backup updates
- remove default images
- move board/reference links toward stable identity