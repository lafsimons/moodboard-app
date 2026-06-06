---
aliases:
  - active context
---
# Active Context

OA = Outfit-App  
MBA = Moodboard-App

Before making changes, read:
- core-outfitmoodboardapp.md
- roadmap-outfitmoodboardapp.md
- active-context-outfitmoodboardapp.md
- sync-cloud-v1-outfitmoodboardapp.md

Preserve ecosystem direction and shared architectural goals.
Current ecosystem layers:

- OA and MBA are current applications.
- Shared taxonomy, entities, media, and relationships belong to the ecosystem layer.
- Hub architecture and knowledge graph concepts belong to future ecosystem evolution.

Avoid isolated app-specific systems when reusable/shared concepts already exist.

Terminology is governed by the Glossary document.
When introducing new concepts, prefer existing glossary terms where possible.

# Local environments

npm run dev -- --host 0.0.0.0

Outfit App:
- /Users/lafsimons/Desktop/outfit-app/

Moodboard App:
- /Users/lafsimons/Desktop/moodboard-app/

---

# Current project state

### **MBA**

Current status:

- Large-library stabilization complete
- Metadata-first runtime established
- Out-of-line media architecture established
- Dashboard and filter architecture largely stabilized
- Nested taxonomy system established
- Original Reconnection v3 is implemented, including known path persistence and resume without full rescan. Large scalable package import has been fixed after TT-scale validation. Recovery scan caching remains open.

Current focus:

- UX refinement
- Mobile refinement
- Generation research
- Taxonomy maturation
- Ecosystem integration

### **OA**

Current status:

- Core wardrobe workflows stable
- Selector and preview interactions largely stabilized
- Dashboard architecture established

Current focus:

- UX refinement
- Mobile refinement
- Saved outfit previews
- Secondary entity systems
- Ecosystem integration

---

# Current priorities

## Documentation / Ecosystem

- Refine ecosystem documentation
- Stabilize taxonomy direction
- Distill architectural decisions
- Establish shared OA/MBA vocabulary
- Define relationship model direction

## MBA

- Mobile audit
- Bulk editor improvements
- Saved board miniature rendering
- Generation research
- Large-library validation

## OA

- Mobile audit
- Bulk editor improvements
- Saved outfit miniature rendering
- Fitpics
- Saved Outfits

---

# Current research tracks

## MBA Generation

Active questions:

- board-centric vs sequence-centric generation
- direction modeling
- diversity logic
- taxonomy-aware weighting
- observability/debugging

## Taxonomy

Active questions:

- provenance vs semantic tags
- mode/* separation
- taxonomy evolution
- cross-library consistency

See:

- taxonomy-outfitmoodboardapp.md

## Ecosystem

Active questions:

- Hub architecture
- Libraries vs Tools model
- Relationships
- Shared entity model
- Text/philosophy nodes
- Knowledge graph direction

See:

- future-concepts-outfitmoodboardapp.md

---

# Sensitive systems

Before modifying:

- Image system
- Metadata & persistence
- Identity & provenance systems
- Generation systems
- Metadata-first runtime architecture

Read Technical Decisions before major changes.

---

# Current implementation guidance

- Preserve metadata-first runtime architecture.
- Preserve out-of-line media storage.
- Preserve local-first behavior.
- Prefer extraction over rewrites.
- Avoid introducing OA-specific logic into MBA.
- Avoid introducing MBA-specific logic into OA.
- Prefer shared concepts over shared UI.
- Prefer extending existing systems over introducing parallel systems.
