# Core

OA = Outfit-App
MBA = Moodboard-App

# **Vision**

- OA + MBA as a connected aesthetic ecosystem, not two isolated apps.
- Goal: coherent understanding and development of taste/style over time.
- Move beyond inventory-only wardrobe tracking toward aesthetic exploration, relational styling, and reflective documentation.
- Garments become meaningful through repeated use, outfits, references, seasons, moods, and personal context.

# **System philosophy**
- The system should function partly as:
    - wardrobe tool
    - aesthetic archive
    - visual notebook
    - longitudinal self-documentation system
- The goal is coherent understanding of personal taste and real-world usage over time.
- The system should help reveal recurring patterns rather than merely store objects.
- Human interpretation and reflection are more important than algorithmic optimization.

# **Core principles**

- Relationships are more valuable long-term than isolated entries.
- Documentation should capture stable decisions, recurring patterns, and useful reflections — not every temporary detail.
- OA and MBA can stay separate, but should increasingly share concepts, logic, and data shapes.
- The system should support both practical wardrobe use and exploratory taste development.
- Local-first development is valuable, but browser storage should eventually become a cache/offline layer rather than the long-term source of truth.
- Architecture should evolve incrementally through real usage patterns rather than premature abstraction.
- Refactors should prioritize behavioral stability over architectural purity.
- The goal is not maximal data collection, but meaningful pattern recognition and reflective utility.
- Over-automation should be avoided where it weakens intentionality or interpretation.

# **Shared architecture**

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
## **Migration philosophy**
- Data migrations should be additive where possible.
- Behavioral stability is more important than architectural purity.
- Storage providers should remain replaceable implementation details.
- IndexedDB should eventually function primarily as:
    - offline cache
    - local-first layer

  rather than the permanent source of truth.
- Export/import formats should remain durable and backward-compatible where feasible.

# **Shared entity system**

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

## **Portable hub schema direction**

The future shared ecosystem contract should stay portable, additive, and app-owned. The hub should route, resolve, index, and link cross-app data, but should not become the place where domain workflows are owned.

### **HubItem**

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

### **HubLink**

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

### **HubBackup**

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

### **Preview-first asset policy**

- Preview assets are the portable default asset class for hub, sync, backup, and cross-device rendering.
- Preview assets should be sufficient for hub v1.
- Original assets are optional and archival.
- Hub v1 should not require originals to exist, sync, or restore normal browsing behavior.
- The hub should prefer sync-safe preview assets over archival completeness requirements.

### **Stable identity rules**

- `itemUuid` is the long-term stable identity across apps, backups, sync, relinking, and migrations.
- `id` remains app-local and legacy-active during transition.
- Existing local ids should not be invalidated abruptly.
- Relationship systems may add UUID sidecars before switching canonical resolution logic.
- Stable identity must survive rename operations, app refactors, storage changes, and backup round-trips.

### **App ownership rules**

- OA owns outfit workflows and outfit records.
- MBA owns board and reference workflows and records.
- The hub should resolve and route shared entities between apps, not own outfit-editing or board-editing workflows itself.
- Shared contracts should support cross-app linking without erasing domain boundaries.

### **Compatibility rules**

- Unknown fields should be preserved where possible.
- App-specific metadata must not be silently collapsed or dropped.
- Shared schemas should be additive first.
- Import/export should remain backward-compatible where feasible.
- New portable fields should coexist with old local fields during migration.
- Provenance/import/source metadata should move toward convergence instead of diverging between OA and MBA.

# **Metadata & lifecycle**

- Add richer metadata beyond existing style/climate tags.
- Distinguish system metadata from personal/subjective metadata.
- Useful additions:
    - freeform tags
    - notes/comments
    - wardrobe role
    - lifecycle state
    - linked references
- Possible lifecycle:
    - Reference → Wishlist → Owned → Core / Experimental / Maybe Sell → Sold / Archived
- Sold items should remain in the system as historical data.
- Transition notes can capture why something was bought, kept, sold, replaced, or became core.
- Historical context matters:
    - when something entered the wardrobe
    - what replaced what
    - how taste evolved over time
    - where inspiration came from
## **Metadata persistence & provenance**
- Imported items should preserve provenance metadata where possible:
    - original filename
    - import timestamp
    - dimensions
    - source path/namespace
    - file metadata
- Stable timestamps should not be overwritten unnecessarily.
- Historical continuity is important for long-term wardrobe and taste tracking.
## **Stable metadata fields**
- itemUuid
- createdAt
- updatedAt
- importedAt
- originalFilename
- sourceOriginalFilename
- sourceFileSize
- sourceImageWidth
- sourceImageHeight
- sourceLastModified
- mimeType
- fileExtension
- importBatchId
- importSource
## **Metadata migration principles**
- Existing items should migrate safely with sensible defaults.
- Editing an item should update `updatedAt` while preserving:
    - `createdAt`
    - `importedAt`
- Backup/import/export should preserve metadata integrity.
- Stable immutable IDs should survive migrations and storage changes.

# **Image system**

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

## **Meaning of `originalPreserved`**

- `originalPreserved = true`
  means the system intentionally considers an original archival asset to exist or be preserved for this item
- `originalPreserved = false`
  means the item should be treated as preview-only for archival purposes, even if preview browsing still works normally
- `originalPreserved` should describe archival intent/state, not crop state, not presentation state, and not whether preview rendering is available

## **Continued `imageUrl` compatibility role**

- `imageUrl` must remain supported for backward compatibility
- `imageUrl` should continue functioning as a preview-facing compatibility mirror of `images.preview.src`
- Existing code and backups may continue reading `imageUrl` until both apps are fully migrated
- `imageUrl` should not remain the long-term canonical image container once both apps are fully normalized around `images.*`

## **Local-first behavior now**

- Local-first behavior should continue working without backend or sync changes
- `images.preview` should be treated as the canonical local render asset
- `images.thumbnail` may be omitted and fall back to preview
- `images.original` should remain optional
- Normal browsing, outfit generation, board generation, and exports should not require original archival assets
- Backup/import/export behavior must remain backward-compatible during this phase

## **Future cloud behavior**

- `images.preview` should remain the canonical sync-safe render asset across devices
- `images.thumbnail` should remain optional but preferred for large grids and low-bandwidth views
- `images.original` should remain optional archival storage, potentially private and quota-limited
- Cloud sync should allow items to remain valid even when only preview/thumbnail assets are available locally
- Original archival assets and preview render assets should remain conceptually separate so that storage policy can evolve without changing the item contract

## **Migration rule for legacy `imageUrl` items**

- Legacy items with only `imageUrl` should migrate additively, not destructively
- During normalization/import, legacy items should gain `images.preview` derived from `imageUrl`
- `imageUrl` must continue being preserved during the compatibility window
- Migration should not assume that a legacy `imageUrl` implies a true preserved original archival asset
- Legacy items should receive safe defaults for missing `images.original`, `images.thumbnail`, and `originalPreserved`

## **What must not change yet**

- Do not remove `imageUrl` compatibility yet
- Do not change backup payload behavior yet
- Do not change import/export behavior yet
- Do not rewrite crop, frame scale, offset, or presentation behavior yet
- Do not change the current meaning of persisted crop/presentation fields without explicit migration handling
- Do not require originals for normal browsing, generation, or export yet

# **Relationship model**

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

# **OA responsibilities**

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
## **Future OA direction**
- notes
- wardrobe roles
- lifecycle tracking
- linked references
- multi-outfit generation
- canvas-style outfit comparison

## OA Garment Lifecycle / Acquisition Pipeline

OA should eventually support garment lifecycle states instead of treating every item as simply owned.

Possible lifecycle states:
- inspiration
- under evaluation
- wishlist
- active target
- grail
- owned
- maybe sell
- archived
- retired
- sold

The goal is not to create separate databases for wishlist, archive, sold, and owned items. The goal is one garment/item model with a lifecycle/status field.

These states have different behavior:
- owned items can be used in normal outfit generation
- wishlist or active-target items may be used for planning outfits
- inspiration items may inform style direction but should not appear as owned wardrobe items
- sold/retired items should remain linked to historical outfits, fitpics, and notes
- maybe-sell items remain owned but may need filtering or review views
- grail/investment/collector pieces may need different priority or acquisition tracking

This supports a future acquisition pipeline:
inspiration → under evaluation → wishlist/active target → owned → archived/retired/sold

Lifecycle state should be treated separately from tags. Tags describe what an item is or evokes; lifecycle state describes where the item sits in the wardrobe/acquisition process.

## **Climate system**
- > 24°C → Hot
- 16–24°C → Warm
- 8–16°C → Transitional
- < 8°C → Cold
# **MBA responsibilities**

- Exploratory visual association.
- Moodboards and reference boards.
- Visual inspiration around garments, textures, colors, silhouettes, proportions, and moods.
- Less rigid than OA.
- Helps make sense of visual attraction and recurring aesthetic patterns.
- Can function like an Obsidian-style visual thinking space for taste development.

# Shared reusable systems

The ecosystem should gradually move toward shared reusable infrastructure rather than duplicating app-specific implementations.

Examples of reusable/shared systems:
- image import
- image compression
- image storage
- metadata/tagging
- library grid virtualization
- selection + bulk editing
- export/import backup
- local persistence
- sync-ready storage abstractions

OA and MBA may remain separate apps, but should increasingly share foundational modules and data concepts.

# Shared vs app-specific logic

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
