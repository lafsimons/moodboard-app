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