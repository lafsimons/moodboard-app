# Core

---

# Philosophy

## Vision

- OA = Outfit-App
- MBA = Moodboard-App
- OA + MBA as a connected aesthetic ecosystem, not two isolated apps.
- Goal: coherent understanding and development of taste/style over time.
- Move beyond inventory-only wardrobe tracking toward aesthetic exploration, relational styling, and reflective documentation.
- Garments become meaningful through repeated use, outfits, references, seasons, moods, and personal context.

## System philosophy

- The system should function partly as:
    - wardrobe tool
    - aesthetic archive
    - visual notebook
    - longitudinal self-documentation system
- The goal is coherent understanding of personal taste and real-world usage over time.
- The system should help reveal recurring patterns rather than merely store objects.
- Human interpretation and reflection are more important than algorithmic optimization.

## Interaction direction

### OA interaction direction

OA is:
- outfit-oriented
- action-oriented
- state-oriented

Current behavior:
- click selects
- cmd/ctrl toggles
- shift range-selects
- double-click previews
- double-click + equip action equips item

Do not change interaction assumptions casually until mobile/desktop workflow validation is complete.

### MBA interaction direction

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

## Core principles

- Relationships are more valuable long-term than isolated entries.
- Documentation should capture stable decisions, recurring patterns, and useful reflections — not every temporary detail.
- OA and MBA can stay separate, but should increasingly share concepts, logic, and data shapes.
- The system should support both practical wardrobe use and exploratory taste development.
- Local-first development is valuable, but browser storage should eventually become a cache/offline layer rather than the long-term source of truth.
- Architecture should evolve incrementally through real usage patterns rather than premature abstraction.
- Refactors should prioritize behavioral stability over architectural purity.
- The goal is not maximal data collection, but meaningful pattern recognition and reflective utility.
- Over-automation should be avoided where it weakens intentionality or interpretation.

## Development philosophy

- Prefer extraction over rewrites.
- Preserve behavior during refactors.
- Additive migrations over destructive migrations.
- Compatibility-first import/export handling.
- Shared utility logic before shared UI abstractions.
- Avoid simultaneous architectural + UI redesigns.
- Add regression tests around sensitive logic.

---

# Architecture

## Shared architecture

- Keep OA and MBA standalone for now.
- Avoid merging unless there is a clear need.
- Long-term direction: one ecosystem/hub with separate app modes or entries.
- Shared logic/components can be extracted gradually:
    - tags
    - filters
    - export/import
    - image handling
    - relationships
    - metadata types
- Avoid duplicating similar logic twice when possible.
- UI/business logic should not directly depend on storage implementation details.
- Repository boundaries should isolate:
    - item persistence
    - app-state persistence
    - backup/import/export
    - asset/original handling
- IndexedDB, Supabase, or future storage providers should eventually become swappable implementation details.
- Structured metadata, image storage, and offline cache layers should remain conceptually and architecturally separate.

## Shared/aligned foundations

Implemented/aligned:
- additive `itemUuid`
- additive relationship UUID sidecars
- shared `images.original / preview / thumbnail` direction
- additive provenance/import metadata
- normalized backup import preparation
- portable hub item/link/backup direction
- compatibility-first migrations
- local-first IndexedDB persistence

## Portable ecosystem rules

- `itemUuid` is the stable cross-app identity
- `id` remains legacy/runtime-active
- preview assets are the portable default
- originals remain optional
- unknown fields should survive normalization
- app-specific metadata must not be silently collapsed

## Ownership:

- OA owns outfits
- MBA owns boards/references
- Hub routes/resolves entities, not workflows

## Migration philosophy

- Data migrations should be additive where possible.
- Behavioral stability is more important than architectural purity.
- Storage providers should remain replaceable implementation details.
- IndexedDB should eventually function primarily as:
    - offline cache
    - local-first layer
  rather than the permanent source of truth.
- Export/import formats should remain durable and backward-compatible where feasible.

## Shared reusable systems

The ecosystem should gradually move toward shared reusable infrastructure rather than duplicating app-specific implementations.

Prefer reusable abstractions when already touching:
- image systems
- metadata
- filters
- selection
- persistence
- identity normalization

The goal is:
- reduce duplicated logic gradually
- keep OA/MBA conceptually aligned
- avoid blocking active feature development
- avoid premature over-abstraction

### Extraction philosophy

Continue feature work normally, but extract reusable helpers whenever the same concept appears in both OA and MBA.

Prioritize extraction where:
- the concept is already stable
- the same problem has been solved in both apps
- duplication would create maintenance drift
- the helper can stay mostly UI-agnostic
- extraction does not require a large rewrite

Avoid extracting too early:
- full editors
- full toolbars
- full card components
- app shells
- large shared UI frameworks

Shared architecture matters more than shared UI right now.
Keep app-specific workflows where they still differ.
Extract stable primitives first, not entire screens.

### Shared reusable infrastructure

Strong candidates:

#### Shared media/image infrastructure
- drag-and-drop import
- multi-file import
- file picker import
- image dimensions/aspect ratio/orientation
- image import/compression
- import metadata
- preview/original image variants
- asset normalization
- future originals support
- future cloud storage compatibility

#### Shared metadata/provenance infrastructure
- metadata normalization
- provenance normalization
- importedAt/originalFilename/fileSize/mimeType
- capturedAt/camera/lens fields where available
- no GPS/location metadata by default
- safe additive normalization
- stable identity helpers
- backup/import/export compatibility

#### Shared persistence infrastructure
- persistence abstractions
- export/import backups
- local persistence
- sync-ready storage abstractions

#### Shared filter/search infrastructure
- collapsible filter groups
- searchable options
- selected counts
- active filter chips
- any/all matching helpers
- reusable filter-state model
- search-text generation helpers
- list/group/sort helpers

#### Shared overlay/action infrastructure
- modals
- popovers
- drawers
- action menus
- Esc/outside-click/focus handling
- z-index/viewport behavior

#### Shared selection/bulk infrastructure
- selected-count pills
- multi-select behavior
- contextual actions
- operation-based bulk editing patterns

#### Shared rendering/performance infrastructure
- library virtualization

## Shared vs app-specific logic

Reusable systems:
- Library grid
- Tag editor
- Metadata filters
- Image handling
- Bulk editing
- Persistence/backups

OA-specific:
- outfit slot logic
- climate/style scoring
- outfit generation

MBA-specific:
- board layout
- spatial canvas logic
- moodboard generation scoring

---

# Identity & Sync

## Shared entity system

- Canonical garment entity with stable ID and metadata.
- Garment owns its main information:
    - tags
    - images
    - material
    - fit notes
    - measurements
    - ownership status
    - notes
- Outfits and moodboards should reference garments instead of duplicating garment data.
- Wishlist items can be treated as the same kind of object in a different lifecycle state.
- Stable immutable IDs are foundational for relationships, sync, relinking, migrations, and long-term data integrity.
- Relationships should survive renames, lifecycle changes, and storage migrations.

## Identity & sync preparation

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

## Portable hub schema direction

The future shared ecosystem contract should stay portable, additive, and app-owned. The hub should route, resolve, index, and link cross-app data, but should not become the place where domain workflows are owned.

### HubItem

- `HubItem` should represent the portable cross-app view of an entity.
- `itemUuid` is the stable cross-app item identity.
- `id` remains app-local and may stay active during migration and compatibility phases.
- A `HubItem` should carry enough shared metadata for routing, linking, previews, backup, import/export, and cross-app resolution without flattening app-specific behavior.
- OA should remain the owning app for outfits.
- MBA should remain the owning app for boards and references.
- App-specific metadata must remain preserved rather than silently collapsed into a lowest-common-denominator shape.
- Long-term provenance, import, and source metadata should converge between OA and MBA where possible.

Minimal direction:

```js
{
  itemUuid: "",
  id: "",
  app: "oa" | "mba",
  kind: "",
  title: "",
  preview: {},
  metadata: {},
  provenance: {}
}
```

### HubLink

- `HubLink` should represent portable relationships between items across OA and MBA.
- Relationships may carry additive UUID sidecars while legacy/local ids remain active.
- During transition, existing `id`-based relationships should continue working.
- New relationship shapes should increasingly preserve both local compatibility and stable cross-app resolution.
- Links should remain additive and migration-safe rather than forcing abrupt key replacement.

Minimal direction:

```js
{
  type: "",
  sourceId: "",
  targetId: "",
  sourceItemUuid: "",
  targetItemUuid: "",
  metadata: {}
}
```

### HubBackup

- `HubBackup` should package portable items, portable links, and app-owned payloads in one durable export/import shape.
- The backup layer should preserve unknown fields where possible.
- The backup layer should not discard app-specific metadata simply because another app does not yet understand it.
- Portable/shared fields should be normalized, but app-owned payloads should remain intact.
- The contract should support forward-compatible additive fields and backward-compatible import behavior.

Minimal direction:

```js
{
  version: 1,
  items: [],
  links: [],
  apps: {
    oa: {},
    mba: {}
  }
}
```

### Preview-first asset policy

- Preview assets are the portable default asset class for hub, sync, backup, and cross-device rendering.
- Preview assets should be sufficient for hub v1.
- Original assets are optional and archival.
- Hub v1 should not require originals to exist, sync, or restore normal browsing behavior.
- The hub should prefer sync-safe preview assets over archival completeness requirements.

### Stable identity rules

- `itemUuid` is the long-term stable identity across apps, backups, sync, relinking, and migrations.
- `id` remains app-local and legacy-active during transition.
- Existing local ids should not be invalidated abruptly.
- Relationship systems may add UUID sidecars before switching canonical resolution logic.
- Stable identity must survive rename operations, app refactors, storage changes, and backup round-trips.

## Stable-link preparation

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

### App ownership rules

- OA owns outfit workflows and outfit records.
- MBA owns board and reference workflows and records.
- The hub should resolve and route shared entities between apps, not own outfit-editing or board-editing workflows itself.
- Shared contracts should support cross-app linking without erasing domain boundaries.

### Compatibility rules

- Unknown fields should be preserved where possible.
- App-specific metadata must not be silently collapsed or dropped.
- Shared schemas should be additive first.
- Import/export should remain backward-compatible where feasible.
- New portable fields should coexist with old local fields during migration.
- Provenance/import/source metadata should move toward convergence instead of diverging between OA and MBA.

---

# Metadata & Lifecycle

## Metadata system

### Philosophy

Metadata should support:
- long-term continuity
- meaningful relationships
- reflective understanding
- durable archival context

The goal is not maximal data collection, but useful long-term pattern recognition and historical continuity.

Metadata should help reveal:
- recurring usage
- evolving taste
- acquisition patterns
- emotional attachment
- practical utility
- aesthetic relationships

Human interpretation is more important than rigid categorization or over-automation.

### Metadata categories

The system should distinguish between:

#### Stable/system metadata
Examples:
- `itemUuid`
- timestamps
- dimensions
- file metadata
- provenance/import metadata
- lifecycle state
- sync metadata

#### Personal/reflective metadata
Examples:
- notes
- fit observations
- wardrobe role
- emotional attachment
- reasons for keeping/selling
- inspiration links
- freeform tags

### Metadata persistence principles

- Stable timestamps should not be overwritten unnecessarily.
- Unknown fields should survive normalization/import/export where feasible.
- Editing an item should update `updatedAt` while preserving:
    - `createdAt`
    - `importedAt`
- Metadata migrations should remain additive where possible.
- Historical continuity matters more than perfect normalization purity.

### Provenance & import metadata

Imported items should preserve provenance metadata where possible:
- original filename
- import timestamp
- dimensions
- source path/namespace
- file metadata
- import source

Useful stable fields:

- `itemUuid`
- `createdAt`
- `updatedAt`
- `importedAt`
- `originalFilename`
- `sourceOriginalFilename`
- `sourceFileSize`
- `sourceImageWidth`
- `sourceImageHeight`
- `sourceLastModified`
- `mimeType`
- `fileExtension`
- `importBatchId`
- `importSource`

### Metadata migration principles

- Existing items should migrate safely with sensible defaults.
- Stable immutable IDs should survive migrations and storage changes.
- Import/export should preserve metadata integrity where feasible.
- App-specific metadata should not be silently discarded during normalization.

## Lifecycle system

### Philosophy

Lifecycle state should describe:
- where an item exists in the ownership/acquisition journey
- how the item behaves operationally
- how the item participates in generation/filtering/history

Lifecycle state is separate from tags.

Tags describe:
- what something is
- what it evokes
- how it relates aesthetically

Lifecycle describes:
- ownership state
- acquisition stage
- practical status

### Long-term lifecycle direction

Possible long-term lifecycle states:

```txt
Inspiration
→ Under Evaluation
→ Wishlist
→ Active Target
→ Grail
→ Owned
→ Maybe Sell
→ Archived
→ Retired
→ Sold 
```

The goal is not separate databases for:

- wishlist
- archive
- sold items
- owned items

Instead:

- one shared item model
- lifecycle/status determines behavior

### Current implemented lifecycle direction

Current lightweight lifecycle ladder:

```txt
Interested → Wishlist → Incoming → Wardrobe → Selling → Sold
```

Rules:

- only `Wardrobe` is generation-enabled by default
- all other lists default excluded
- unknown future non-empty values are preserved
- lifecycle remains intentionally lightweight for now

`Incoming` means:

- acquired/purchased but not physically available yet

No deeper marketplace/history system yet.

### Lifecycle behavior examples

Different lifecycle states may eventually behave differently:

- owned items participate normally in generation
- wishlist items may participate in planning
- inspiration items may influence direction without appearing as owned
- sold items should remain linked historically
- maybe-sell items may require review/filtering
- grail/collector items may need special tracking behavior

### Historical continuity

Historical context matters:

- when something entered the wardrobe
- what replaced what
- why something became core
- why something was sold
- where inspiration came from
- how taste evolved over time

Transition notes may eventually capture:

- acquisition reasoning
- replacement reasoning
- emotional/contextual significance
- wardrobe evolution

---

# Image system

## Image Philosophy

- Primary image: clean isolated flat lay for browsing/system use.
- Secondary image: worn/context image for drape, proportions, styling, and real-life use.
- Detail image: fabric, texture, patina, stitching, fading, repairs.
- Flat lays do not need to be perfect ecommerce images; archival/documentary consistency may fit better.
- Outdoor/RAW/camera images may better capture texture and color than dark indoor iPhone auto.
- Preview images should become the canonical cross-device render asset.
- Original images should be optional archival assets:
    - private
    - quota-limited
    - not required for normal browsing or generation
- Image storage should eventually distinguish between:
    - preview assets
    - thumbnail assets
    - original archival assets

## **Canonical shared image contract**

The canonical shared image shape for OA and MBA should be:

```js
images: {
  original: {
    src: "",
    mimeType: "",
    width: 0,
    height: 0,
    fileSize: 0,
    originalFilename: ""
  },
  preview: {
    src: "",
    mimeType: "",
    width: 0,
    height: 0,
    fileSize: 0,
    originalFilename: ""
  },
  thumbnail: {
    src: "",
    mimeType: "",
    width: 0,
    height: 0,
    fileSize: 0,
    originalFilename: ""
  }
}
```

Meaning of each image asset:
- `images.original`
  archival source image when preserved; may be larger, less processed, or absent
- `images.preview`
  canonical cross-device render asset for normal browsing, boards, outfit rendering, exports, and sync-safe display
- `images.thumbnail`
  optional smaller render asset for dense library/grid views; may fall back to preview when no separate thumbnail exists

## Meaning of `originalPreserved`

- `originalPreserved = true`
  means the system intentionally considers an original archival asset to exist or be preserved for this item
- `originalPreserved = false`
  means the item should be treated as preview-only for archival purposes, even if preview browsing still works normally
- `originalPreserved` should describe archival intent/state, not crop state, not presentation state, and not whether preview rendering is available

## Continued `imageUrl` compatibility role

- `imageUrl` must remain supported for backward compatibility
- `imageUrl` should continue functioning as a preview-facing compatibility mirror of `images.preview.src`
- Existing code and backups may continue reading `imageUrl` until both apps are fully migrated
- `imageUrl` should not remain the long-term canonical image container once both apps are fully normalized around `images.*`

## Local-first behavior now

- Local-first behavior should continue working without backend or sync changes
- `images.preview` should be treated as the canonical local render asset
- `images.thumbnail` may be omitted and fall back to preview
- `images.original` should remain optional
- Normal browsing, outfit generation, board generation, and exports should not require original archival assets
- Backup/import/export behavior must remain backward-compatible during this phase

## Future cloud behavior

- `images.preview` should remain the canonical sync-safe render asset across devices
- `images.thumbnail` should remain optional but preferred for large grids and low-bandwidth views
- `images.original` should remain optional archival storage, potentially private and quota-limited
- Cloud sync should allow items to remain valid even when only preview/thumbnail assets are available locally
- Original archival assets and preview render assets should remain conceptually separate so that storage policy can evolve without changing the item contract

## Migration rule for legacy `imageUrl` items

- Legacy items with only `imageUrl` should migrate additively, not destructively
- During normalization/import, legacy items should gain `images.preview` derived from `imageUrl`
- `imageUrl` must continue being preserved during the compatibility window
- Migration should not assume that a legacy `imageUrl` implies a true preserved original archival asset
- Legacy items should receive safe defaults for missing `images.original`, `images.thumbnail`, and `originalPreserved`

## Current image contract direction

Current direction:
- `images.preview` becomes canonical render asset
- `imageUrl` remains compatibility mirror
- `images.original` remains optional/archival
- `originalPreserved` must never be inferred

Still deferred:
- full original-preservation workflow
- shared asset repository architecture across OA/MBA
- cloud/object-storage-backed media

## What must not change yet

- Do not remove `imageUrl` compatibility yet
- Do not break backward-compatible backup/import behavior without explicit migration handling
- Do not change import/export behavior yet
- Do not rewrite crop, frame scale, offset, or presentation behavior yet
- Do not change the current meaning of persisted crop/presentation fields without explicit migration handling
- Do not require originals for normal browsing, generation, or export yet

---

# Relationships

## Relationship model

- Garment → many outfits.
- Garment → many moodboards.
- Outfit → multiple garment references.
- Moodboard → garment/reference/image relationships.
- One reference can connect to many garments.
- One garment can connect to many references.
- Useful relationship types:
    - inspired by
    - works with
    - similar to
    - overlaps with
    - replaces
    - worn with
    - part of
- Relationships should likely be stored separately from the items themselves.

## OA responsibilities

- Structured outfit composition.
- Outfit generation.
- Garment-slot logic.
- Worn styling contexts.
- Repeated outfit/item usage history.
- Wardrobe reality:
    - what gets worn
    - what works together
    - what becomes core
    - what becomes redundant

### Future OA direction

- notes
- wardrobe roles
- lifecycle tracking
- linked references
- multi-outfit generation
- canvas-style outfit comparison

### Climate system

- > 24°C → Hot
- 16–24°C → Warm
- 8–16°C → Transitional
- < 8°C → Cold

## MBA responsibilities

- Exploratory visual association.
- Moodboards and reference boards.
- Visual inspiration around garments, textures, colors, silhouettes, proportions, and moods.
- Less rigid than OA.
- Helps make sense of visual attraction and recurring aesthetic patterns.
- Can function like an Obsidian-style visual thinking space for taste development.

---

# Large-Library Runtime Architecture

## Metadata-first startup

Startup is now metadata-first rather than media-first.

The app no longer attempts to fully hydrate image-bearing item records during initial boot. Startup loads lightweight item metadata only:

- ids
- itemUuid
- tags
- dimensions
- crop/presentation metadata
- timestamps
- source identity
- lightweight image metadata

This allows:

- significantly lower startup heap pressure
- reduced IndexedDB read spikes
- stable startup on large libraries
- safer recovery behavior after interrupted imports or oversized datasets

Startup state now initializes:

- Library
- boards
- saved boards
- filters
- tag systems
- selection state

without requiring inline image payload hydration.

---

## Metadata-only runtime state

Runtime `items` state is now permanently metadata-only.

React state no longer stores:

- inline preview data URLs
- inline thumbnail payloads
- inline original payloads

This avoids:

- full-library media residency in JS heap
- repeated giant object cloning
- unnecessary React diffing on media payloads
- memory spikes during delete/filter/sort operations

All major runtime systems now operate from metadata:

- Library
- filters/search/sorting
- boards
- saved boards
- generation
- persistence
- selection state

Media is resolved lazily only where needed.

---

## Out-of-line media storage

Preview, thumbnail, and original media were moved out of item records.

Current IndexedDB model:

- `items`
    - metadata-only item records
- `itemMediaAssets`
    - preview/thumbnail payloads
- `originalImageBlobs`
    - original-resolution blobs

This replaces the earlier architecture where every item embedded image payloads directly into the main item record.

Benefits:

- dramatically smaller item records
- reduced serialization cost
- lower startup pressure
- lower persistence pressure
- safer large-library scaling
- future-compatible with chunked/archive backups

Legacy inline-media items remain backward-compatible.

---

## Lazy media resolution

Media is now resolved lazily/on-demand.

UI systems request media only when required:

- Library cards
- board images
- editor preview
- crop editor
- palette extraction
- export paths

Resolution occurs through centralized async media resolution helpers rather than assuming `item.imageUrl` already exists in runtime state.

This preserves:

- metadata-only runtime architecture
- lower memory residency
- compatibility with old inline-media items
- compatibility with new out-of-line media records

---

## Removal of post-startup full hydration

The previous architecture still performed a second full-library `loadItems().getAll()` pass after startup.

That pass:

- reloaded the entire library
- rebuilt runtime state
- created unnecessary memory pressure
- duplicated startup work
- provided little value after media splitting

This pass has been removed.

The app now remains metadata-only after startup rather than transitioning into a fully hydrated runtime model.

---

# Large-library stabilization work

Large-library stabilization included:

- metadata-first startup
- removal of inline media from runtime state
- batched delete operations
- safer persistence behavior
- virtualization startup fixes
- backup hardening
- recovery tooling
- persistence deduplication

The primary goal was transitioning from prototype-scale assumptions toward stable multi-thousand-image library behavior.

This work specifically targeted:

- browser crashes
- corrupted startup states
- runaway memory usage
- oversized persistence writes
- import/export instability
- delete-time crashes
- virtualization reload failures

---

## Safe Mode recovery

A dedicated Safe Mode recovery surface now exists via:

```text
?safeMode=1
```

Safe Mode:

- loads metadata only
- avoids full runtime initialization
- supports large-library recovery workflows
- allows inspection of oversized/corrupted datasets
- supports targeted deletion/recovery operations
- supports metadata backup export

The recovery path exists specifically to avoid requiring full browser storage wipes during failure scenarios.

---

## Bulk delete batching

Bulk delete operations previously executed as repeated single-item deletes with repeated full-store scans.

Delete architecture now:

- batches item deletions
- batches media cleanup
- computes shared itemUuid ownership once
- deletes preview/thumbnail/original media only when last ownership disappears
- avoids repeated full-library scans

This resolved:

- delete-triggered browser crashes
- extreme delete-time memory spikes
- redundant persistence amplification

---

## Persistence dedupe

Persistence behavior was tightened significantly.

Changes:

- duplicate sanitized app-state writes are skipped
- redundant post-delete persistence paths were deduped
- unnecessary object replacement after delete was reduced
- saved board cleanup preserves references when unchanged

This reduced:

- redundant IndexedDB writes
- repeated JSON serialization
- unnecessary saved-board persistence work
- delete-time persistence amplification

---

## Virtualization reload fixes

Library virtualization previously had reload timing failures where:

- only the first column rendered correctly
- remaining columns stayed placeholder/blurred
- measurement occurred before stable layout

Fixes added:

- stronger startup measurement timing
- post-layout remeasurement
- ResizeObserver coverage
- visibility-triggered remeasurement
- virtualization window math extraction/testing

Virtualization remains enabled and lazy-loading behavior remains intact.

---

## Backup hardening + metadata-only backups

Backup/import behavior was hardened substantially.

Added:

- metadata-only backup export
- oversized import warnings/rejections
- validation-before-replacement
- safer app-state sanitization
- backup materialization for out-of-line media
- recovery-oriented backup workflows

The current system still uses single-file JSON backups, but they are now safer and more resilient.

---

