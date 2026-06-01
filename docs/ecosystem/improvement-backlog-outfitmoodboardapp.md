---
aliases:
  - Backlog
---
# Product Backlog

# Active

## Provenance/original reconnection architecture

Later, not urgent.

Design and implement a provenance-safe original media reconciliation architecture.

Current issue:
Display names, imported filenames, external filenames, and media identity are conceptually mixed.

Implement clear separation:

Per item:

* immutable internal ID
* editable display title
* immutable original imported filename
* optional external/current filename aliases
* media storage references

Goal:
Support future:

* reconnect originals
* dedupe
* provenance tracking
* media reconciliation
* sync/migration

Add:

1. provenance metadata schema
2. filename alias/history support
3. original-file reconciliation preparation
4. migration for existing libraries
5. matching helpers using:
    * filename
    * dimensions
    * file size
    * mime type

Do NOT implement full perceptual hashing yet.
Prepare architecture only.

Run:
npm test – –runInBand
npm run build

The important thing is: Prompt 1 should happen before any large-scale renaming/tagging cleanup.

---

# Planned

## Saved miniature rendering

### **OA**
- Screenshot-style saved outfit miniatures
- Preserve compatibility with existing saved outfits
- Avoid blocking save operations
- Reuse outfit rendering where practical

### **MBA**
- Screenshot-style saved board miniatures
- Preserve compatibility with existing saved boards
- Avoid expensive save-time rerenders
- Reuse board rendering where practical

---

## Local collection controls

### OA Selector
- Local search
- Local filter
- Local sort
- Independent from Wardrobe state
- Shared collection-control helpers where appropriate

### OA Saved Outfits
- Local search
- Local filter
- Local sort
- Independent from Wardrobe state

### OA Fitpics
- Lightweight local search
- Lightweight local sort
- Independent from Wardrobe state

---

## Dashboard-local analytics filters

- Dashboard-specific filter state
- Independent from Wardrobe filters
- Analytics operate on filtered subsets
- Preserve Dashboard/Wardrobe filter separation

---

## Filtering & sorting improvements

- Name A–Z sorting
- Shift-click exclude interactions
- Removable active filter pills
- Faster filter workflows

---

## Accessory systems

### Accessory visibility
- Per-item accessory visibility
- Persisted visibility state
- Separate visual visibility from generation eligibility
- Global accessory visibility controls

### Accessory UX
- Auto-enable accessories on equip
- Consistent quick actions
- Cleaner accessory presentation

---

## Layering controls

- User-controlled layer retention when disabling layering
- Preserve locks
- Avoid automatic rerolls
- Remember preferred keep-inner / keep-outer behavior

---

## Outfit interaction redesign

### Outfit actions
- Compact Actions dropdown
- Consolidated slot actions
- Reduced hover clutter

### Preview actions
- Simplified preview action hierarchy
- Context-aware outfit controls
- Reduced button density

---

## MBA Editing & Library Management

- Bulk rename
- Manage Tags improvements
- Create tags directly from Manage Tags
- A–Z / numeric sorting controls

## Shared Bulk Editing

- Improve OA bulk editor
- Improve MBA bulk editor
- Shared operation-based bulk-edit architecture

---

## Library navigation

### MBA
- Show in Library from board images
- Preserve board context
- Reveal and focus corresponding library item

---

## Crop improvements

### MBA
- Crop aspect-ratio presets
    - Original
    - 4:3
    - 4:5
    - 16:9

---

## Wardrobe export improvements

### OA
- Dedicated wardrobe image export
- Multiple export ordering modes
- Improved layout consistency
- Better support for large wardrobes
- Optional labels and export settings
- full library image export: export current filtered set up to a maximum, warn/block very large exports. Also export images in higher quality

---

## Status & Collections

### Status
- Interested
- Wishlist
- Incoming
- Wardrobe
- Selling
- Sold

### Collections
- User-defined multi-select organizational groups
- Filterable
- Editable
- Generation-aware

Goals:
- Separate lifecycle state from organization
- Reduce hardcoded wardrobe modes
- Preserve migration compatibility

---

# Long-Term Backlog

## OA

### Rendering & Image Systems
- Improve cropping workflow, live crop preview in outfit grid
- Improve image card sizing and presentation
- Investigate transparent PNG auto-fit via visible pixel bounds detection
- Explore visibleBounds metadata for improved garment presentation

### Mobile UX
- Mobile wardrobe controls below cards
- Improve bottom-sheet behavior

### Outfit & Wardrobe Systems
- Linked references
- Wardrobe-role metadata
- Multi-outfit generation
- Canvas-style outfit comparison

### Overlay Architecture
- Unify overlay systems:
  - Preview overlay
  - Filter popovers
  - Select actions
  - Edit drawers
  - Saved outfits
  - Manage dialogs

Goal:
- Shared overlay/modal architecture

### Display & Density
- Comfortable density mode
- Compact density mode

Requirements:
- Preserve image aspect ratio
- Preserve selection behavior
- Preserve preview behavior
- Persistent preference
- Avoid implementation before card layout stabilizes

### Generation & Data Model
- Dresses/Jumpsuits slot integration
- TopInner accepting Outerwear review
- Guided-score floor review
- Defaults configuration-table refactor
- Generation fixture datasets

---

## MBA

### Scale & Reliability
- Validate higher image counts after metadata/media split
- Define practical backup/export limits
- Add media integrity tools
- Original media storage
- Original media export
- Original media relinking tools
- MBA full library image export: export current filtered set up to a maximum, warn/block very large exports. Also export images in higher quality

### Tag System
- Infinite nesting support
- Keyboard interaction improvements
- Hierarchy rename edge cases
- Add an MBA-only curated library sort option based on tag-combination priority.
	- Problem: Simple type priority is not enough. For the Taiga/reference archive, sorting should support compound tag priorities such as:
	- source/website + type/garment before
	- source/ig + type/garment before
	- type/retailer
	- Add a new sort option: Curated.
- MBA Tags filter sort:
aw21
ss22
aw22
ss23
aw23
ss24
aw24
ss25
aw25
ss26
aw26
etc

### Crop System
- Crop boundary edge cases on extreme aspect ratios
- Oversized crop UI on tall images

### Generation
- Ordered board generation

### Media integrity tools

Potential future tooling:
- orphaned media detection
- orphaned metadata detection
- missing preview/original validation
- integrity repair utilities
- media compaction tools

These become more important with separated metadata/media storage.

### Export limits / UX

Very large visual exports are currently impractical at extreme library sizes.

Future UX work may include:

- filtered export limits
- export warnings
- chunked rendering
- paginated exports
- staged rendering/export pipelines

### Possible future object URL cache layer

Current lazy media resolution already revokes object URLs correctly, but object URL creation remains decentralized.

Possible future optimization:

- centralized object URL cache
- LRU eviction
- shared resolver cache
- ref-counted object URL reuse

This is not currently required, but may become useful for extremely large libraries or future multi-panel/media-heavy workflows.

### Moodboard app cleanup

- rename remaining outfit-app identifiers
- clean obsolete copied root files
- separate app identity from shared infrastructure
- improve repo structure before public sharing

---

## Shared Ecosystem

### Relationships
- Linked references
- Shared relationship model
- Shared entity relationships

Support relationships between:
- Wardrobe Items
- Outfits
- Fitpics
- MBA References
- Saved Boards

Preserve local-first compatibility.

### Secondary Entity Systems

OA:
- Fitpics
- Saved Outfits

MBA:
- Saved Boards

### Shared Media & Reference Model
- Normalize Fitpics ↔ MBA references
- Shared media/reference shape
- Shared compatibility layer

### Backups

Snapshot reasons:
- interval
- before-import
- before-bulk-edit
- before-delete
- manual

Track changes since:
- last autosnapshot
- last full backup
- last import

If a pre-operation snapshot fails, block the risky operation unless the user explicitly overrides.

Autosnapshots should be debounced and not created after every individual edit.

Future phase:
- snapshot restore UI
- metadata-only restore preserving media assets
- manual metadata checkpoint creation
- backup overdue reminders

---

# Research Required

## MBA Generation

Open questions:
- Board-centric vs sequence-centric generation
- Direction modeling
- Diversity balancing
- Taxonomy-aware weighting
- Generation observability/debugging
- Long-term generation architecture

Related:
- mba-generation-research.md

---

## Relationships

Open questions:
- Relationship types
- Relationship storage architecture
- Cross-app relationship model
- Relationship UX patterns
- Reference ↔ garment linking
- Outfit ↔ reference linking
- Many-to-many relationship behavior

Related:
- relationship-model-research.md

---

## Taxonomy

Open questions:
- Provenance vs semantic tags
- Taxonomy growth rules
- Mode/* separation
- Cross-library consistency
- Tag governance
- Long-term taxonomy maintenance

Related:
- taxonomy-outfitmoodboardapp.md

---

## Asset Preservation

Open questions:
- Original image preservation strategy
- Preview/original synchronization
- Reconnection workflows
- Provenance architecture
- Long-term archival strategy
- Local vs cloud archival responsibilities

Related:
- asset-preservation.md

---

## Hub Architecture

Open questions:
- Libraries vs Tools model
- Hub responsibilities
- Cross-library navigation
- Cross-library search
- Shared entity resolution
- Relationship routing
- Long-term ecosystem structure

Related:
- hub-architecture.md

### Cross-platform import path

Add a browser-compatible fallback path using:
- `<input type="file">`
- standard Blob/File APIs
- streamed/chunked reads where possible

instead of requiring:
- `showOpenFilePicker`
- File System Access handles

#### Platform expectations

| Platform                  | Target support |
| ------------------------- | -------------- |
| Desktop Chrome/Edge/Brave | Full           |
| Android Chrome/Brave      | Full           |
| iPhone Safari             | Supported      |
| iPad Safari               | Supported      |
| Other iOS browsers        | Supported      |

## Future backup/media direction

Current JSON backup works after slimming duplicated image payloads, but it still embeds preview images inline and still relies on full in-memory JSON materialization.

This is acceptable short-term, but not scalable for very large libraries.

Long-term direction:
- metadata backup should stay small
- media assets should be stored separately
- previews/originals should become separate image assets
- app records should reference stable media IDs/URLs instead of embedding all image data inline
- cloud sync should eventually store media in object storage

Current backups still:
- materialize entire JSON payloads
- rely on `readAsText`
- rely on full `JSON.parse`

Future backup architecture will likely move toward:
- manifest-based archive format
- chunked metadata files / NDJSON
- separated media payloads
- streaming import/export
- optional zip/tar packaging

Likely future structure:

```text
manifest.json
appState.json
items.ndjson
media/previews/
media/thumbnails/
media/originals/
```

Also MBA has already been stabilized around slimmer backup/media handling. Later compare OA’s backup shape and potentially reuse the same backup-slimming and media-separation rules across both apps.

---
# Future / Speculative

## Hub

Long-term evolution from separate applications toward a unified ecosystem layer.

Potential capabilities:
- Cross-library search
- Cross-library navigation
- Shared entity resolution
- Shared relationship graph
- Unified backup/import/export
- Shared generation entry points

The hub should coordinate entities and libraries while preserving app ownership of workflows.

---

## Libraries vs Tools

Potential ecosystem structure:

### **Libraries**

Collections of information:
- MBA Personal
- MBA T.T Research
- OA Wardrobe
- OA Wishlist
- OA Interested
- OA Fitpics
- Future research libraries

### **Tools**

Ways of interacting with libraries:
- Outfit generation
- Board generation
- Search
- Relationships
- Analytics
- Future AI-assisted exploration

The same tool should potentially operate across multiple libraries.

---

## Relationship Graph

Long-term relationship layer connecting:
- Wardrobe items
- Outfits
- Fitpics
- MBA references
- Boards
- Notes
- Future entities

Possible relationship types:
- inspired by
- worn with
- works with
- similar to
- replaces
- references
- part of

The goal is moving from isolated records toward connected knowledge.

---

## Text & Knowledge Nodes

Future support for non-image entities.

Examples:
- Philosophy notes
- Interview excerpts
- Research notes
- Brand documents
- Personal observations
- Design principles

These could eventually participate in relationships alongside garments and references.

---

## Personal Aesthetic Knowledge Graph

Long-term direction:

The ecosystem becomes:
- wardrobe tool
- reference archive
- visual notebook
- knowledge graph

Relationships become increasingly important relative to individual items.

The goal is understanding:
- recurring patterns
- influences
- preferences
- aesthetic evolution
- wardrobe evolution
over time.

---

## Cross-Library Generation

Potential future capability:
Generation systems operate across multiple libraries rather than within a single collection.

Examples:
- Outfit generation informed by references
- Board generation informed by wardrobe contents
- Mixed-library exploration
- Relationship-aware generation

---

## Shared Entity Model

Long-term convergence toward portable ecosystem entities.

Potential entities:
- Garments
- References
- Outfits
- Boards
- Fitpics
- Notes
- Documents

Entities remain app-owned while participating in shared ecosystem relationships.

---
# Non-goals

- monorepo rewrite
- premature shared UI framework
- fully automated styling AI
- aggressive normalization
- mandatory cloud dependency
- ideas for URLs: 
	- atelier.so
	- wear.atelier.so
	- boards.atelier.so
