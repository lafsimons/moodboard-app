---
aliases:
  - roadmap
---
# Roadmap

# Vision

## Long-term ecosystem direction

- Main hub page with access to OA and MBA.
- Item page showing linked outfits, linked moodboards, and linked references.
- Hover/secondary image showing worn or contextual use.
- Inspector/detail panel showing texture shots.
- Structured dataset export for analysis and backup.
- Graph or cluster view for tags, garments, references, and outfits.
- Cross-device sync.
- Private cloud-backed libraries.
- Optional public/shared boards.
- Durable archival export/import.
- Longitudinal wardrobe/taste history.
- Timeline/history view of wardrobe evolution.

## Analytical & relational systems

The system could reveal:
- strongest pairings
- recurring colors
- seasonal use
- underused items
- anchor pieces
- orphan pieces
- acquisition patterns
- wardrobe/taste evolution over time
- silhouette repetition
- fit tendencies
- most-linked references

## Ecosystem Structure

Libraries
- Wardrobe
- References
- Boards
- Fitpics
- Future collections

Tools
- Outfit generation
- Board generation
- Search
- Relationships
- Analytics

Libraries store information.
Tools operate on information.

---

# Current State

Current architecture supports multi-thousand-image local-first libraries and is considered stable enough for future sync/cloud foundations.
Portable library reliability now includes not only backup format validity but also import/export scalability at 5k–10k item scale.

## Backup & Import Architecture

Future work:

- Cross-platform scalable package import/export
- Archive/chunked backup format
- Streaming import/export
- Media integrity tooling
- Export scalability improvements
- Optional object URL caching

Current limitation:

- Scalable package import currently depends on File System Access APIs and is not fully compatible with iOS/iPadOS browsers.

Goal:

- Preserve the existing package format.
- Support desktop and mobile browsers.
- Enable incremental imports, progress reporting, recovery handling, and bounded-memory processing.
- Maintain large-library compatibility and media integrity guarantees.

# Near-term priorities  

Documentation
- Consolidate ecosystem documentation
- Finalize shared schema direction
- Maintain lightweight architecture docs

App Work
- Stabilize repository-boundary refactors
- Improve import provenance metadata
- Continue OA/MBA architectural separation

Pre-Sync Foundations
- Standardize storage contracts
- Standardize backup formats
- Complete UUID rollout
- Extract reusable shared infrastructure

# Major Future Systems
## Relationship Layer

- Cross-entity relationships
- Reference ↔ garment linking
- Outfit ↔ reference linking
- Fitpic ↔ outfit linking
- Relationship exploration

## Shared Entity & Media Model

- Shared entity identity
- Shared media architecture
- Shared metadata normalization
- Shared relationship conventions


## Original Media Architecture

- Original/preview separation
- Media reconciliation
- High-resolution workflows
- Archival preservation

## Ecosystem Layer

- Shared navigation
- Shared search
- Shared libraries
- Cross-app workflows

## Sync & Cloud

- Supabase-based synchronization
- Cloud media storage
- Relationship-safe synchronization
- Migration tooling
- Cross-device media synchronization
- Preview-first sync workflows

## Reliability & Performance

- Render audits
- Memory audits
- Relationship scaling
- Mobile Safari validation

## History & Recovery

- Undo system
- Change history
- Recovery tooling

---
# Deferred systems

Not priority yet:

- accounts
- public sharing
- collaborative features
- large storage migrations
- object-storage relinking

## **Taxonomy & Navigation**

- keyboard navigation
- saved filter presets
- recent tags
- pinned branches
- taxonomy scaling improvements
- semantic browsing systems
- relationship-based navigation

## **MBA UX / Interface Evolution**

- sticky search bar
- filter density refinements
- compact mode ideas
- selection visibility improvements
- chip UX refinements
- mobile filter adaptations
