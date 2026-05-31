# **Technical Decisions**

This document records finalized or semi-finalized architectural conclusions.

Use it for:

- why an architecture was chosen
- why an alternative was rejected
- migration decisions
- persistence philosophy
- image handling decisions
- relationship model decisions

This is decision memory, not a backlog, roadmap, or changelog.

Structure:

- Problem
- Decision
- Reasoning
- Consequences

---

## **Decision: Metadata-only runtime state**

### **Problem**

Large image libraries caused increasing memory pressure, slow startup behavior, expensive state updates, and instability when full image payloads were stored inside runtime item records.

### **Decision**

Runtime item state should remain metadata-only.

Image payloads should be resolved lazily only when required by a UI surface or operation.

### **Reasoning**

The vast majority of application logic operates on metadata rather than image payloads.

Keeping runtime state metadata-only:

- reduces startup memory pressure
- reduces React state size
- reduces serialization overhead
- reduces persistence amplification
- improves scalability for large libraries

### **Consequences**

- Do not reintroduce full-library media hydration.
- Do not store inline preview/original payloads in runtime item state.
- Filtering, searching, generation, selection, and persistence should operate on metadata.
- Media should be resolved on demand.

---

## **Decision: Out-of-line media storage**

### **Problem**

Embedding preview, thumbnail, and original media directly inside item records created oversized records and made large libraries increasingly fragile.

### **Decision**

Store metadata separately from media payloads.

### **Reasoning**

Separating metadata from media:

- keeps item records lightweight
- reduces IndexedDB read/write pressure
- improves startup behavior
- improves scalability
- prepares the architecture for future backup and sync systems

### **Consequences**

- Metadata remains the primary runtime representation.
- Media assets are stored separately.
- Media ownership and cleanup must be handled explicitly.
- Legacy inline-media items remain backward-compatible.

---

## **Decision: Lazy media resolution**

### **Problem**

Many application paths assumed image data was already loaded into memory.

This increased memory usage and created unnecessary startup work.

### **Decision**

Media should be resolved lazily and only when required.

### **Reasoning**

Most workflows do not need image payloads immediately.

Lazy resolution:

- reduces startup cost
- reduces memory residency
- improves scalability
- works naturally with metadata-first runtime architecture

### **Consequences**

- UI surfaces request media when needed.
- Media access should use centralized helpers.
- Code should not assume image payloads already exist in runtime state.

---

## **Decision: Preview-first asset policy**

### **Problem**

Original-resolution images are valuable for archival purposes but too expensive to require for normal browsing, backup, sync, and rendering workflows.

### **Decision**

Preview assets are the canonical portable render asset.

Originals remain optional archival assets.

### **Reasoning**

Preview assets:

- are smaller
- are sync-safe
- are sufficient for normal application behavior
- reduce storage requirements

Originals remain useful but should not block normal workflows.

### **Consequences**

- Browsing must not require originals.
- Generation must not require originals.
- Exports must not require originals.
- Sync should function without originals.
- `originalPreserved` describes archival intent, not render state.

---

## **Decision: Additive migration philosophy**

(general rule)

### **Problem**

Destructive migrations create unnecessary risk for long-lived personal archives.

### **Decision**

Migrations should be additive whenever feasible.

### **Reasoning**

Additive migrations preserve compatibility, reduce risk, and allow gradual architectural evolution.

### **Consequences**

- Existing fields should not be removed abruptly.
- Legacy and new fields may coexist during transition periods.
- New capabilities should be layered onto existing data rather than replacing it.

---

## **Decision: Additive identity migration**

(specific application of that rule)

### **Problem**

Long-term relationships require stable identifiers, but existing application behavior still relies on legacy local IDs.

### **Decision**

Introduce stable UUIDs additively rather than replacing legacy IDs immediately.

### **Reasoning**

An additive migration:

- preserves compatibility
- avoids breaking existing data
- supports gradual adoption
- reduces migration risk

### **Consequences**

- `itemUuid` remains the long-term identity.
- Existing `id` fields remain active during transition.
- Relationship systems may carry both legacy IDs and UUID sidecars.
- Existing datasets must continue functioning.

---

## **Decision: Local-first architecture remains active**

### **Problem**

The ecosystem needs future sync capability while remaining fully usable without cloud infrastructure.

### **Decision**

Maintain a local-first architecture.

IndexedDB remains the active persistence layer until future sync systems are mature.

### **Reasoning**

Local-first behavior:

- improves reliability
- reduces complexity
- supports offline use
- avoids premature cloud coupling

### **Consequences**

- Backend services must not become mandatory.
- Persistence boundaries should remain clean.
- Storage providers should remain replaceable implementation details.
- Future sync should layer on top of existing local-first behavior.

---

## **Decision: Preserve unknown and app-specific metadata**

### **Problem**

Normalization, migration, and backup operations can accidentally discard information that another version of the application may still require.

### **Decision**

Unknown fields and app-specific metadata should be preserved whenever possible.

### **Reasoning**

Long-term durability is more important than aggressive normalization.

Preservation:

- improves forward compatibility
- improves backward compatibility
- reduces migration risk
- protects future functionality

### **Consequences**

- Import/export should avoid destructive cleanup.
- Normalization should be additive.
- Shared schemas must not silently discard app-specific fields.
- Future ecosystem services must preserve information they do not understand.

---

## **Decision: Compatibility-first import/export**

### **Problem**

Import/export systems become fragile when schema evolution assumes perfect version alignment.

### **Decision**

Import/export behavior should prioritize compatibility over schema purity.

### **Reasoning**

Backups are a long-term durability mechanism.

Users must be able to move data between versions safely.

### **Consequences**

- Additive migrations are preferred.
- Existing backups should remain importable whenever feasible.
- Legacy fields may coexist with newer fields during transition periods.
- Import systems should repair or normalize rather than reject compatible data.

---

## **Decision: Shared concepts before shared UI**

### **Problem**

Extracting shared UI too early creates coupling between applications that still have different workflows.

### **Decision**

Prioritize shared concepts, data models, and infrastructure before shared UI components.

### **Reasoning**

Shared architecture is more stable than shared interface design.

OA and MBA currently share many concepts but still differ substantially in workflows and interaction models.

### **Consequences**

Prioritize extraction of:

- metadata systems
- image systems
- persistence systems
- identity systems
- filter infrastructure
- selection infrastructure

Avoid prematurely extracting:

- full editors
- full toolbars
- application shells
- workflow-specific interfaces

The goal is shared architecture first, shared UI later.

## **Decision: Repository boundary architecture**

### **Problem**

Application logic, persistence logic, backup logic, and media handling can easily become tightly coupled, making future migrations, sync work, and storage changes difficult.

### **Decision**

Repository boundaries should isolate major persistence responsibilities.

### **Reasoning**

Clear boundaries reduce coupling and allow storage implementations to evolve without forcing large application rewrites.

### **Consequences**

Repositories should isolate:

- item persistence
- app-state persistence
- backup/import/export
- media/original handling

UI and business logic should not depend directly on storage implementation details.

---

## **Decision: Storage providers are implementation details**

### **Problem**

Persistence technologies will likely change over time as local-first, sync, and cloud capabilities evolve.

### **Decision**

Storage providers should remain replaceable implementation details.

### **Reasoning**

The ecosystem should not become tightly coupled to IndexedDB, Supabase, or any future storage layer.

### **Consequences**

- Persistence should be accessed through abstractions.
- Storage migrations should not require large application rewrites.
- Future sync/cloud work should build on existing contracts rather than replacing them.

---

## **Decision: Stable identity is foundational**

### **Problem**

Relationships, sync, relinking, migrations, and long-term archival integrity require identifiers that survive renames, storage changes, and application evolution.

### **Decision**

Stable immutable identifiers are foundational ecosystem infrastructure.

### **Reasoning**

Human-facing names and runtime IDs are not sufficiently durable for long-term relationship management.

### **Consequences**

- Stable identifiers must survive migrations.
- Stable identifiers must survive storage changes.
- Stable identifiers must survive backup round-trips.
- Relationship systems should increasingly move toward stable identity resolution.

---

## **Decision: Shared reusable infrastructure over duplicated infrastructure**

### **Problem**

Implementing the same underlying infrastructure separately in OA and MBA creates maintenance drift and duplicated work.

### **Decision**

Shared infrastructure should be preferred once a concept has stabilized.

### **Reasoning**

Many ecosystem concerns are identical across both applications even when workflows differ.

### **Consequences**

Strong candidates for shared infrastructure include:

- image systems
- metadata systems
- persistence systems
- import/export systems
- identity systems
- filter infrastructure
- selection infrastructure

Extraction should remain incremental and low-risk.

---

## **Decision: Shared architecture before shared workflows**

### **Problem**

OA and MBA share many concepts but still serve different purposes and workflows.

### **Decision**

Align architecture first while preserving app-specific workflows.

### **Reasoning**

Shared concepts are more stable than shared behavior.

Premature workflow unification increases complexity and reduces clarity.

### **Consequences**

- OA retains outfit-specific workflows.
- MBA retains board-specific workflows.
- Shared systems should focus on infrastructure and contracts.
- Workflow ownership remains app-specific.

---

## **Decision: Structured metadata, media, and storage remain separate concerns**

### **Problem**

Metadata, media assets, and storage implementations can easily become entangled.

### **Decision**

Metadata, media, and persistence layers should remain conceptually separate.

### **Reasoning**

Each layer evolves independently and benefits from clear ownership and responsibilities.

### **Consequences**

- Metadata contracts should not depend on storage technology.
- Media architecture should not depend on persistence implementation.
- Storage providers should not dictate metadata shape.
- Future sync systems should operate across clearly defined layers.

---

## **Decision: App ownership boundaries**

### **Problem**

Future hub architecture risks centralizing responsibilities that belong to individual applications.

### **Decision**

Applications own workflows. The hub owns routing, resolution, indexing, and relationships.

### **Reasoning**

OA and MBA remain the authoritative owners of their domain behavior.

The hub should coordinate entities, not absorb application responsibilities.

### **Consequences**

- OA owns outfit workflows.
- MBA owns board and reference workflows.
- The hub resolves entities and relationships.
- The hub should not become a third application containing domain workflows.

---

## **Decision: Portable ecosystem contracts**

### **Problem**

Cross-app relationships, backups, sync, and future ecosystem services require a portable shared contract.

### **Decision**

Shared ecosystem contracts should remain portable, additive, and app-owned.

### **Reasoning**

The ecosystem needs interoperability without forcing applications into a lowest-common-denominator model.

### **Consequences**

- HubItem remains a portable shared entity shape.
- HubLink remains a portable relationship shape.
- HubBackup remains a portable backup container.
- App-specific metadata must remain preserved.
- Shared contracts should evolve additively.

## Decision: Independent applications, shared ecosystem

### Problem

OA and MBA increasingly share concepts, metadata, identity systems, relationships, and future ecosystem goals.

This creates pressure to merge applications prematurely.

### Decision

OA and MBA remain independent applications while gradually aligning around shared ecosystem concepts and infrastructure.

### Reasoning

The applications solve different problems and support different workflows.

OA focuses on wardrobe management and outfit composition.

MBA focuses on exploration, references, and aesthetic research.

Shared architecture provides value without requiring workflow convergence.

### Consequences

- OA remains outfit-focused.
- MBA remains reference-focused.
- Shared infrastructure may continue expanding.
- Workflow ownership remains application-specific.
- Future ecosystem services should coordinate applications rather than replace them.

---

## Decision: Relationship-first ecosystem direction

### Problem

Traditional wardrobe systems and image libraries primarily store isolated records.

Over time, isolated records provide less value than the connections between them.

### Decision

The ecosystem should increasingly be designed around entities and relationships rather than isolated collections.

### Reasoning

Relationships provide context, continuity, discovery, and long-term meaning.

The most valuable future capabilities depend on relationships:

- references influencing garments
- garments influencing outfits
- outfits connecting to fitpics
- boards connecting to references
- future text nodes connecting to all entity types

### Consequences

- Stable identity becomes critical infrastructure.
- Relationship systems become first-class ecosystem systems.
- Future entity types should support relationships.
- Future Hub architecture should remain relationship-aware.
- Relationship data should increasingly survive migrations, storage changes, and application evolution.

---

## Decision: Canonical image asset model

### Problem

Historically, image handling mixed previews, originals, compatibility fields, and rendering responsibilities.

This created ambiguity around which asset represents the canonical image.

### Decision

The ecosystem adopts a three-tier image model:

- original
- preview
- thumbnail

images.preview is the canonical render asset.

### Reasoning

Different image assets serve different purposes.

Previews support normal application behavior.

Thumbnails support dense browsing.

Originals support archival preservation.

Separating these responsibilities improves flexibility and future compatibility.

### Consequences

- images.preview becomes the primary rendering asset.
- images.thumbnail remains optional.
- images.original remains archival.
- Future sync systems should primarily operate on previews.
- Asset responsibilities remain clearly separated.

---

## Decision: Previews before originals

### Problem

Original-image preservation, archival storage, and file reconciliation are valuable long-term goals but introduce substantial complexity.

Waiting for a complete originals architecture would slow development unnecessarily.

### Decision

The ecosystem prioritizes preview-first workflows.

Original preservation remains an additive future capability.

### Reasoning

Preview assets already support:

- browsing
- outfit generation
- board generation
- exports
- backups
- future sync preparation

Most ecosystem value can be delivered without requiring archival originals.

### Consequences

- Original-preservation systems remain optional.
- Preview workflows should continue progressing independently.
- Future original-storage systems must integrate without disrupting preview-first behavior.
- Architectural decisions should not assume originals are always available.

# Infrastructure direction

- Vercel frontend
- Supabase Auth/Postgres
- Cloudflare R2 object storage