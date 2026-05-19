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

---

# **OA**

## **Current priorities**

- improve cropping
- mobile wardrobe controls below cards
- bottom-sheet behavior
- separate sort from filter

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

- linked references
- wardrobe-role metadata
- multi-outfit generation
- canvas-style outfit comparison

## **MBA**

- bulk rename
- ordered board generation
- higher image counts
- auto backup updates
- remove default images
