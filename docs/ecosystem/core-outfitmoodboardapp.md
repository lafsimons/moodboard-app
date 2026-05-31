# Core

## Philosophy

### Vision

- OA = Outfit-App
- MBA = Moodboard-App
- OA + MBA as a connected aesthetic ecosystem rather than isolated applications.
- The goal is coherent understanding and development of taste, style, and personal aesthetics over time.
- Move beyond inventory-only wardrobe tracking toward aesthetic exploration, relational styling, and reflective documentation.
- Garments become meaningful through repeated use, outfits, references, seasons, moods, and personal context.

### System philosophy

The ecosystem should function partly as:

- wardrobe tool
- aesthetic archive
- visual notebook
- longitudinal self-documentation system

The goal is coherent understanding of personal taste and real-world usage over time.

The system should help reveal recurring patterns rather than merely store objects.

Human interpretation and reflection are more important than algorithmic optimization.

### Interaction direction

#### OA interaction direction

OA is:

- outfit-oriented
- action-oriented
- state-oriented

Do not casually change core interaction assumptions without workflow validation.

#### MBA interaction direction

MBA is:

- exploration-oriented
- browsing-oriented
- reference-oriented

Do not casually merge OA interaction assumptions into MBA.

### Core principles

- Relationships are more valuable long-term than isolated entries.
- The ecosystem should increasingly move from isolated records toward connected entities.
- Documentation should capture stable decisions, recurring patterns, and useful reflections.
- OA and MBA should increasingly share concepts, logic, and data shapes.
- The ecosystem should support both practical wardrobe use and exploratory taste development.
- Architecture should evolve incrementally through real usage patterns rather than premature abstraction.
- Refactors should prioritize behavioral stability over architectural purity.
- The goal is not maximal data collection but meaningful pattern recognition and reflective utility.
- Over-automation should be avoided where it weakens intentionality or interpretation.

### Development philosophy

- Prefer extraction over rewrites.
- Preserve behavior during refactors.
- Shared utility logic before shared UI abstractions.
- Avoid simultaneous architectural and UI redesigns.
- Add regression coverage around sensitive systems.

---

## Architecture

### Shared architecture

- Keep OA and MBA independent applications.
- Avoid merging unless there is a clear need.
- Long-term direction is a shared ecosystem with separate application ownership.
- Shared concepts should increasingly converge.
- Workflow ownership should remain app-specific.

### Ownership

- OA owns outfits.
- MBA owns boards and references.
- Future ecosystem services route, resolve, and connect entities rather than owning workflows.

### Shared reusable systems

The ecosystem should gradually move toward shared reusable infrastructure rather than duplicated implementations.

Priority areas:

- image systems
- metadata systems
- persistence systems
- identity systems
- filter infrastructure
- selection infrastructure

Shared architecture is more important than shared UI.

### Shared vs app-specific logic

Reusable systems:

- library infrastructure
- tag editing
- metadata filtering
- image handling
- bulk editing
- persistence and backup systems

OA-specific:

- outfit generation
- outfit slot logic
- climate/style scoring

MBA-specific:

- board layout
- spatial canvas behavior
- moodboard generation

---

## Identity & Sync

### Shared entity system

- Stable identities are foundational.
- Garments own their primary information.
- Outfits and boards reference garments rather than duplicating garment data.
- Relationships should survive renames, lifecycle changes, migrations, and storage changes.

### Portable ecosystem direction

Future ecosystem contracts should remain:

- portable
- additive
- app-owned
- backward-compatible

Core concepts:

- HubItem
- HubLink
- HubBackup

The ecosystem should support cross-app relationships without collapsing application boundaries.

---

## Metadata & Lifecycle

### Metadata philosophy

Metadata should support:

- continuity
- relationships
- reflection
- archival context

The goal is useful long-term understanding rather than maximal data collection.

### Metadata categories

Stable metadata:

- identity
- timestamps
- provenance
- lifecycle
- sync information

Reflective metadata:

- notes
- observations
- emotional significance
- inspiration
- freeform tags

### Lifecycle philosophy

Lifecycle describes:

- ownership state
- acquisition stage
- practical status

Tags describe:

- meaning
- aesthetics
- relationships

Lifecycle and tags should remain separate concepts.

### Long-term lifecycle direction

The ecosystem should eventually support a richer ownership and archival journey while remaining centered around a shared item model rather than separate databases.

### Historical continuity

Historical context matters.

The system should help preserve:

- acquisition history
- wardrobe evolution
- replacement decisions
- usage patterns
- taste development

---

## Image System

### Image philosophy

Image roles:

- primary image
- worn/context image
- detail image

Preview assets should function as the primary render asset.

Original assets should remain optional archival assets.

The system should distinguish between:

- preview assets
- thumbnail assets
- original assets

### Physicality Preservation Philosophy

This became one of the most important design insights.
Goal is not: perfect cutout
Goal is: preserve material identity
Preserve:
- shadows
- depth
- shape collapse
- asymmetry
- texture
- dye variation
- reflections
- edge softness
Avoid:
- overly clean masks
- clipped blacks
- flattened textures
- “PNG icon” appearance
This emerged from:
- Morosinos
- logwood bag
- denim examples
- sunglasses examples

### Surface-Specific Rendering

Not every screen should use the same render.
Examples:

**Library**
- cleaner
- easier scanning

**Outfit canvas**
- more natural
- more grounded

**Miniature previews**
- simplified
- readable at small sizes

**Exports**
- highest quality

This is probably preferable to forcing a single render style everywhere.

### Canonical shared image contract

The ecosystem should move toward a shared image model supporting:

- original assets
- preview assets
- thumbnail assets

while preserving backward compatibility during transition.

---

## Relationships

### Relationship philosophy

Relationships are first-class ecosystem concepts.

Examples:

- inspired by
- works with
- similar to
- overlaps with
- replaces
- worn with
- part of

Relationships should eventually support navigation, discovery, and historical understanding.

### OA responsibilities

OA focuses on:

- outfit composition
- outfit generation
- wardrobe reality
- usage history
- styling context

### MBA responsibilities

MBA focuses on:

- visual exploration
- reference collection
- aesthetic association
- moodboards
- taste development

## Ecosystem layers

The ecosystem may eventually be understood as:

### Libraries
Collections of information.

Examples:
- OA Wardrobe
- OA Wishlist
- MBA Personal
- MBA Research

### Tools
Ways of interacting with information.

Examples:
- Outfit generation
- Board generation
- Search
- Relationships
- Analytics

Libraries store information.
Tools operate on information.

Future ecosystem evolution should prefer reusable tools over isolated library-specific implementations.