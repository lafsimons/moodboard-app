chronologically newest - oldest

# **OA/MBA Continuity Extraction** - Chat "Next Steps for MBA"

## **1. Important Decisions**

### **Decision: Prioritize foundational architecture over UI polish**

**Reasoning**  
The project has reached a stage where long-term architecture provides more leverage than incremental UI improvements. Many UI improvements risk becoming temporary if the ecosystem evolves toward Hub/Libraries/Tools.

**Current status**  
Partially implemented. Reflected in recent prioritization discussions but not fully completed.

---

### **Decision: Asset integrity and provenance are prerequisites for large-scale library work**

**Reasoning**  
Large tagging, renaming, and library-cleanup efforts should not occur until media identity, provenance, originals, and reconnection architecture are trustworthy.

**Current status**  
Partially implemented. Metadata corruption fixes and autosnapshots are completed. Original reconnection/provenance work is underway.

---

### **Decision: Status and Collections are separate concepts**

**Reasoning**  
Lifecycle state and organization are fundamentally different concerns. Status tracks an item’s lifecycle; Collections provide user-defined organization.

**Current status**  
Implemented.

---

### **Decision: Hub should own entities and libraries, not app workflows**

**Reasoning**  
OA and MBA remain specialized tools. The future Hub coordinates entities, relationships, navigation, search, and libraries while apps continue to own their domain workflows.

**Current status**  
Architectural direction established. Not implemented.

---

### **Decision: Libraries and Tools are likely the future ecosystem model**

**Reasoning**  
The project increasingly resembles multiple libraries of information with multiple ways of interacting with them rather than separate standalone applications.

**Current status**  
Conceptual direction only.

---

### **Decision: Fitpics, Saved Outfits, Boards, References, and Wardrobe Items should eventually become first-class entities**

**Reasoning**  
Future relationships, Hub functionality, cross-library navigation, and knowledge graph features require equal treatment of entity types.

**Current status**  
Not implemented. Emerging architectural direction.

---

## **2. Priority Changes**

### **Shift: UI improvements moved down**

**Reasoning**  
The project focus moved away from UI refinement and toward durable infrastructure.

Examples:

- Overlay architecture
- Density modes
- Additional workflow polish
- Local search/sort enhancements

These remain useful but are no longer strategic priorities.

---

### **Shift: Portable knowledge moved near the top of the roadmap**

**Reasoning**  
The user identified portable information as a core requirement:

- Markdown exports
- Entity portability
- Knowledge preservation
- Cross-device usability

This became more important than many UX improvements.

---

### **Shift: Multi-entity architecture became a near-term objective**

**Reasoning**  
Discussion increasingly converged on:

- Wardrobe items
- Fitpics
- Saved outfits
- References
- Boards

becoming equivalent ecosystem entities.

This now appears to be a prerequisite for Hub rather than a distant future feature.

---

### **Shift: Hub thinking moved from speculative to architectural planning**

**Reasoning**  
The project is no longer discussing Hub as a vague future idea. Decisions are increasingly evaluated through the lens of future Hub integration.

---

## **3. Rejected Directions**

### **Rejected: Extensive OA UI polishing before Hub direction is clearer**

**Why rejected**  
Many UI systems may be reworked once OA becomes a tool within a larger ecosystem.

**Replaced by**  
Focus on:

- Entity architecture
- Portability
- Relationships
- Hub prerequisites

---

### **Rejected: Treating OA and MBA as permanently separate application silos**

**Why rejected**  
The user increasingly views them as parts of one ecosystem.

**Replaced by**  
Libraries + Tools thinking and eventual Hub coordination.

---

### **Rejected: Continuing to model OA entities as special-case data structures indefinitely**

**Why rejected**  
Wardrobe Items, Fitpics, and Saved Outfits eventually need shared relationship and navigation capabilities.

**Replaced by**  
Entity normalization direction.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **Hub prerequisites are more important than Hub itself**

A recurring conclusion:

The next step is likely not Hub.

The next step is creating the foundations that make Hub possible:

- Entity normalization
- Portable entities
- Shared entity identities
- Relationships
- Cross-library navigation

---

### **OA is increasingly becoming a tool rather than a standalone application**

The user explicitly questioned the value of further OA-specific polishing because OA may eventually become a tool operating on shared entities.

This is an important strategic shift.

---

### **Multi-entity architecture appears more valuable than additional UI work**

The discussion repeatedly converged on:

“Make things first-class entities before improving how they are displayed.”

This principle appears stronger than many individual backlog items.

---

### **Knowledge preservation is becoming a primary concern**

Portable exports, markdown exports, provenance, originals, backups, and relationships are all manifestations of the same underlying goal:

Preserve accumulated knowledge rather than just application state.

---

## **5. Current Reality / Implementation Notes**

### **Metadata corruption fix appears completed**

Evidence:  
User explicitly stated:

“yea so this is already done”

Referring to the rename/media corruption work.

This may not yet be reflected in backlog state.

---

### **Metadata autosnapshot system appears completed**

Evidence:  
User explicitly stated:

“also autosnapshot”

Referring to completion.

Backlog likely requires updating.

---

### **Original reconnection/provenance work is already underway**

Evidence:  
User stated:

“we started on the originals reconnect and got quite far actually”

Documentation may still make this appear earlier-stage than reality.

---

### **OA currently lags MBA architecturally**

Evidence:  
User explicitly stated:

“oa is behind mba in many regards now”

This appears to reflect actual implementation state.

---

### **Hub considerations are already affecting present-day decisions**

Evidence:  
The user is actively evaluating current feature work against future Hub architecture.

This suggests Hub is already influencing priorities despite not being implemented.

---

## **6. Open Questions**

### **What exactly does the first Hub-ownable entity model look like?**

Questions include:

- Shared base entity schema
- Ownership boundaries
- Entity identity rules
- Migration path

---

### **Should entity normalization happen before relationships?**

The backlog implies:

- Multi-entity architecture
- Entity normalization
- Relationships

But exact sequencing remains unresolved.

---

### **What does Hub actually own?**

Still open:

- Search
- Navigation
- Relationships
- Libraries
- Backup
- Generation entry points

Exact boundaries remain undefined.

---

### **How much of OA survives as a standalone concept?**

Open question:

Will OA remain:

- an application

or become:

- a wardrobe-generation tool operating on shared entities?

---

### **What is the minimum viable relationship system?**

Still unresolved:

- Relationship types
- Storage model
- UX model
- Cross-app behavior

---

## **7. High-Value Quotes**

1. “I think I’m at a point where UI and all other features are important and nice to do, yes, but I want to work on fundamental stuff.”
2. “OA is behind MBA in many regards now.”
3. “It doesn’t make much sense to me to polish the various UI when later I will probably merge them in some way.”
4. “Wardrobe items, saved outfits, fitpics from OA become full entities on the same level and equal to MBA images and text nodes.”
5. “I want to work on fundamental stuff.”
6. “The important thing is: Prompt 1 should happen before any large-scale renaming/tagging cleanup.” _(captures the asset-integrity-first philosophy)_
7. “The Hub should coordinate entities and libraries while preserving app ownership of workflows.”
8. “The same tool should potentially operate across multiple libraries.”
9. “The goal is moving from isolated records toward connected knowledge.”
10. “Relationships become increasingly important relative to individual items.”

These are the pieces of durable project knowledge that appear most likely to remain relevant months from now.

---

# **OA/MBA Continuity Extraction** - Chat "Library Organization Advice"

## **1. Important Decisions**

### **Decision: Preserve MBA Personal Library as a curated, high-signal collection**

- Reasoning: Personal inspiration and research archives serve different purposes. Mixing large archival collections with the main library reduces signal quality for browsing, searching, and board generation.
- Current status: Conceptually decided, not yet implemented structurally.

### **Decision: Treat large archival collections as research libraries rather than part of the Personal Library**

- Reasoning: Collections such as T.T, August Sander, or complete designer archives are gathered for completeness and study rather than because every image is an active inspiration source.
- Current status: Partially implemented (T.T library already exists separately).

### **Decision: Use favorites/curated subsets rather than entire archives for day-to-day inspiration**

- Reasoning: Most research images are not equally valuable for generation. Curated favorites maintain signal quality.
- Current status: Conceptually established.

### **Decision: Hub architecture should support multiple independent libraries rather than a single massive MBA library**

- Reasoning: Different collections have different purposes, growth rates, and usage patterns.
- Current status: Planned, not implemented.

---

## **2. Priority Changes**

### **Shift: Infrastructure and data integrity moved above feature development**

- Reasoning: The project has reached a scale where data durability matters more than adding additional UI features.
- Evidence:
    - Asset Integrity elevated.
    - Metadata autosnapshot backup emphasized.
    - Original file reconnection emphasized.

### **Shift: Mobile portability became a near-term priority**

- Reasoning: Existing libraries need to be usable on iPhone.
- Evidence:
    - Import/export portability was moved near the top of priorities.

### **Shift: Portable knowledge became more important than UI expansion**

- Reasoning: User wants data to remain useful outside the application.
- Evidence:
    - Markdown exports for wardrobe.
    - Long-term focus on data ownership.

### **Shift: Multi-entity architecture moved ahead of many UI improvements**

- Reasoning: Future capabilities depend on a stronger underlying model.
- Evidence:
    - Wardrobe items.
    - Fitpics.
    - Saved outfits.
    - MBA images.
    - Text nodes.
    - All discussed as future first-class entities.

### **Resulting priority sequence**

1. Asset Integrity
2. Mobile Library Portability
3. Portable Knowledge
4. Multi-Entity MBA
5. Entity Normalization
6. Relationships
7. Hub

---

## **3. Rejected Directions**

### **Rejected: Single ever-growing MBA library**

- What was proposed:
    - Store all references, archives, research material, and inspiration in one library.
- Why rejected:
    - Signal degradation.
    - Board generation quality declines.
    - Research archives overwhelm personal inspiration.
- Replaced by:
    - Multiple specialized libraries connected through the future Hub.

### **Rejected: Organizing libraries primarily by image count**

- What was proposed:
    - Use a threshold such as 400+ images to determine separation.
- Why rejected:
    - Curation intent is more important than size.
- Replaced by:
    - Distinction between curated inspiration libraries and archival research libraries.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **Research vs Inspiration is a fundamental distinction**

Collections should be separated based on purpose, not scale.

The important question is:

Is this collection intended for inspiration or preservation?

This distinction may become foundational to future Hub architecture.

### **MBA is evolving from an image library into a knowledge system**

The project direction increasingly treats:

- Images
- Wardrobe items
- Saved outfits
- Fitpics
- Text notes

as equivalent knowledge objects.

This appears larger than a normal MBA feature expansion and may deserve explicit documentation.

### **Hub value comes from relationships between collections, not simply aggregation**

The benefit of the Hub is not “all libraries in one place.”

The benefit is:

- cross-library search
- relationships
- generation across collections
- shared entities

### **Curation quality is a strategic asset**

Repeated discussions imply that maintaining a high-signal library is more important than maximizing library size.

---

## **5. Current Reality / Implementation Notes**

### **Reality: T.T already behaves as a separate research library**

While Hub architecture is not implemented, operationally the project already treats T.T differently from the main MBA library.

### **Reality: Multi-entity thinking is ahead of implementation**

Discussion increasingly assumes:

- Images
- Text nodes
- Wardrobe items
- Fitpics
- Saved outfits

will eventually exist at the same architectural level.

Implementation appears behind conceptual direction.

### **Reality: Board generation is no longer the only core purpose of MBA**

The conversations increasingly position MBA as:

- archive
- research system
- inspiration system
- relationship graph

rather than only a moodboard generator.

---

## **6. Open Questions**

### **How should research libraries contribute to generation?**

Possible options:

- Favorites only
- Curated subsets
- Entire archives
- User-selectable source weighting

Unresolved.

### **What is the ownership boundary of the Hub?**

Unresolved:

- Does Hub own data?
- Or only connect independent libraries?

### **How should entity relationships be represented?**

Unresolved:

- Graph model
- Bidirectional links
- Typed relationships
- Hybrid approach

### **What is the long-term role of text nodes?**

Unresolved:

- Supporting content
- First-class entities
- Knowledge graph nodes

### **What is the migration path from current MBA to multi-entity architecture?**

Conceptual direction exists.  
Implementation strategy remains open.

---

## **7. High-Value Quotes**

1. “The distinction is not image count, but curation intent.”
2. “A collection begins to justify its own library when it functions as an archive rather than a curated inspiration source.”
3. “The Personal Library should remain a high-signal, curated collection.”
4. “Research libraries are gathered for completeness, not preference.”
5. “Most research images are valuable for study but not for generation.”
6. “The benefit of the Hub is relationships, not aggregation.”
7. “Portable knowledge is more important than application-specific storage.”
8. “The project is moving from image management toward knowledge management.”
9. “Data integrity comes before feature expansion.”
10. “Different collections should be separated by purpose, not by size.”

This extraction contains only conclusions and decisions that appear durable beyond the immediate discussion.

---

# **OA/MBA Continuity Extraction** - Chat "The Meaning of a "N"-Jacket"

## **1. Important Decisions**

### **Decision: MBA taxonomy should prioritize retrieval over description**

**Reasoning**

The purpose of tagging is not to perfectly describe images. The purpose is to reliably retrieve important reference categories later.

Examples repeatedly identified as high-value retrieval targets:

- German knits
- Black moleskin
- Wool farmer jackets
- Coal miner jackets

**Status:** Partially implemented

Subject hierarchy now contains dedicated garment-family categories and is being actively expanded.

---

### **Decision: Provenance/source should be preserved explicitly**

**Reasoning**

Source context itself became valuable knowledge.

Examples:

```text
medium/book/avant
medium/book/la-france-travaille
medium/book/nous-etions-des-paysans
```

Users may later want:

- all AVANT references
- all La France Travaille references
- all archival book references

independent of image content.

**Status:** Implemented

---

### **Decision: Reference tags should represent why an image was saved**

**Reasoning**

A distinction emerged between:

```text
What is visible?
```

and

```text
Why was this saved?
```

Examples:

```text
reference/material-culture
reference/modern-reinterpretation
reference/philosophy
reference/patina
```

The second dimension proved more useful for research retrieval.

**Status:** Implemented but still early

---

### **Decision: Period and Era should be separate concepts**

**Reasoning**

Many images can be confidently identified as archival while exact dating remains unknown.

Example:

```text
period/archival
```

can exist long before:

```text
era/1910s
era/1930s
```

are assigned.

**Status:** Implemented

---

### **Decision: Origin should represent primary cultural provenance**

**Reasoning**

Origin should not represent:

- photo location
- nationality of wearer
- indirect inspiration

Instead it should represent the primary subject being documented.

Examples:

- T.T reference → Japan
- Brass reference → Japan
- French black moleskin → France
- German knit → Germany

**Status:** Implemented as working taxonomy principle

---

## **2. Priority Changes**

### **Retrieval quality moved ahead of taxonomy expansion**

**Reasoning**

The problem shifted from:

```text
Need more tags
```

to:

```text
Need better retrieval
```

The emphasis moved toward:

- coverage
- consistency
- meaningful categories

rather than creating additional taxonomy branches.

---

### **Subject hierarchy became the primary focus**

**Reasoning**

Subject-level garment families produced the highest retrieval value.

Examples:

```text
subject/garment/jacket/black-moleskin
subject/garment/jacket/wool-farmers-jacket
subject/garment/top/german-knit
```

These became more important than broader categories.

---

### **Era enrichment became a future priority**

**Reasoning**

Large amounts of archival material are currently grouped under:

```text
period/archival
```

Future value likely comes from gradual dating into:

```text
era/1900s
era/1910s
era/1920s
era/1930s
era/1940s
```

---

## **3. Rejected Directions**

### **Rejected: Every image must have an origin**

**Why rejected**

Many images:

- fit photos
- portraits
- object details
- interiors

do not have a meaningful origin assignment.

Forcing origin decreases taxonomy quality.

**Replaced by**

Origin only when it improves retrieval.

---

### **Rejected: Origin should reflect photo location**

**Why rejected**

Leads to inconsistent tagging.

Example:

A T.T fit photo in Paris could become France despite the reference being fundamentally Japanese.

**Replaced by**

Origin = primary cultural provenance.

---

### **Rejected: Reference tags should be heavily applied**

**Why rejected**

Reference categories lose meaning if applied everywhere.

**Replaced by**

Sparse use reserved for genuinely important research dimensions.

---

### **Rejected: Fully descriptive tagging**

**Why rejected**

Perfect description creates excessive maintenance cost while adding little retrieval value.

**Replaced by**

Tagging for future retrieval.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **MBA taxonomy is evolving into a research archive taxonomy**

The dominant dimensions are becoming:

```text
origin
subject
lineage
period
medium
reference
```

rather than traditional fashion dimensions.

This appears to be a significant philosophical evolution.

---

### **Provenance may become one of the strongest retrieval dimensions**

Book sources are becoming collections in their own right.

Examples:

```text
medium/book/avant
medium/book/la-france-travaille
```

function almost like libraries within the library.

---

### **Signal extraction is becoming the primary challenge**

The project increasingly faces:

```text
How do I find what matters?
```

rather than:

```text
How do I collect more references?
```

This may have major implications for future MBA design.

---

### **Subject archetypes may be early forms of entities**

Examples:

```text
German knit
Black moleskin
Wool farmer jacket
Coal miner jacket
```

behave increasingly like knowledge objects rather than simple tags.

This supports the broader entity-normalization direction.

---

### **Sparse tagging appears superior to exhaustive tagging**

The conversation repeatedly converged on:

```text
Few useful tags
>
Many descriptive tags
```

as a long-term archive principle.

---

## **5. Current Reality / Implementation Notes**

### **Origin system is substantially complete**

Coverage reached roughly 85–95% during the review process.

The remaining images increasingly appear to be cases where origin may not be meaningful.

---

### **Subject hierarchy is now the most valuable retrieval layer**

Current usage shows meaningful concentrations around:

```text
german-knit
black-moleskin
wool-farmers-jacket
```

indicating the approach is already producing value.

---

### **Period/archival has proven useful**

Initial uncertainty about the category appears resolved.

The category has become large enough to function as a meaningful retrieval bucket.

---

### **Reference tags remain intentionally sparse**

Current usage indicates:

```text
modern-reinterpretation
material-culture
```

are being used selectively.

This aligns with the intended purpose of reference tags.

---

### **Source tagging is producing high value at low cost**

The conversation repeatedly reinforced that:

```text
medium/book/*
```

provides excellent retrieval value without requiring heavy additional tagging.

---

## **6. Open Questions**

### **Should provenance evolve beyond tagging?**

The increasing importance of:

```text
medium/book/*
medium/film/*
medium/text/*
```

raises the question of whether sources should eventually become first-class entities.

---

### **What is the long-term relationship between period and era?**

Current model:

```text
period/archival
+
era/1930s
```

works well, but the final conceptual relationship remains undefined.

---

### **When should a garment family become an entity?**

Examples:

```text
German knit
Black moleskin
Coal miner jacket
```

are beginning to function as more than tags.

The threshold for entity promotion remains unresolved.

---

### **How should archival research notes integrate with images?**

The conversation highlighted a growing distinction between:

```text
image metadata
```

and

```text
research knowledge
```

Future handling remains open.

---

## **7. High-Value Quotes**

1. “The problem is not collecting references anymore. The problem is finding what matters.”
2. “Tag for retrieval, not description.”
3. “Why was this saved?” is often more important than “What is visible?”
4. “Origin should describe the primary subject, not the photo location.”
5. “Provenance is knowledge.”
6. “A few useful tags are better than many descriptive tags.”
7. “Period can exist before precise dating.”
8. “Subject archetypes provide more value than broad categories.”
9. “Source collections are becoming collections within the collection.”
10. “Signal extraction is becoming more important than acquisition.”

# **OA/MBA Continuity Extraction** - Chat "Document Structure Review"

## **1. Important Decisions**

### **Decision: Introduce dedicated research/architecture documents instead of forcing everything into Core**

**Reasoning**

- Many topics (MBA generation, relationships, UX observations, asset preservation) are not settled architecture.
- Mixing hypotheses and accepted decisions creates confusion.

**Current status**

- Implemented.

---

### 

### 

### **Decision: Create**

**`MBA Generation Research`**

**as a research document rather than a specification**

**Reasoning**

- Findings such as board-centric generation, direction modeling, taxonomy-aware weighting, and observability are still research conclusions, not accepted architecture.
- The document should preserve discoveries rather than imply decisions.

**Current status**

- Implemented.

---

### 

### 

### **Decision: Create**

**`Asset Preservation`**

**as a dedicated architectural philosophy document**

**Reasoning**

- Asset preservation emerged as a foundational principle:
    - originals are canonical
    - renders are derived
    - previews are disposable
    - provenance and reconnection matter
- This is broader than a technical implementation detail.

**Current status**

- Implemented.

---

### **Decision: Add a formal project glossary**

**Reasoning**

- Terminology drift was beginning to appear across Hub, Relationships, MBA Generation, Asset Preservation, and Core.
- Future architecture discussions require consistent vocabulary.

**Current status**

- Implemented.

---

### **Decision: Treat assets as long-lived canonical objects**

**Reasoning**

- Enables non-destructive workflows.
- Supports future re-rendering.
- Preserves archival fidelity.
- Supports future hub architecture.

**Current status**

- Accepted architecture.
- Partially implemented.

---

### **Decision: Separate research, architecture, backlog, and UX knowledge**

**Reasoning**

- Different document types serve different purposes.
- Prevents roadmap, research, and implementation tasks from becoming mixed together.

**Current status**

- Implemented.

---

### **Decision: Use Libraries as first-class containers**

**Reasoning**

- Hub discussions clarified that “Library” better describes the architecture than “Collection.”
- Collections may later exist inside libraries, but libraries are the primary unit.

**Current status**

- Implemented in terminology.

---

## **2. Priority Changes**

### **Shift from UI features toward foundational architecture**

**Previous focus**

- UI polish
- generation tweaks
- workflow refinements

**New focus**

- asset integrity
- portability
- entity architecture
- relationships
- hub evolution

**Reasoning**

- The applications are already functional.
- The next bottlenecks are structural rather than UX-related.

---

### **Mobile library portability moved near the top of priorities**

**Reasoning**

- The user cannot currently use the main libraries on iPhone.
- This limits practical usefulness more than many new features.
- Export/import becomes a real-world test of architecture.

**Resulting priority order**

```text
Asset Integrity
Mobile Library Portability
Portable Knowledge
Multi-Entity MBA
Entity Normalization
Relationships
Hub
```

---

### **Relationships and Hub became longer-term milestones**

**Reasoning**

- Discussion concluded that relationships depend on entity normalization.
- Hub depends on relationships and normalized entities.

**Result**

- Hub is no longer viewed as the immediate next feature.
- It became the final stage of a progression.

---

### **Observability/debugging moved ahead of MBA generation scoring changes**

**Reasoning**

- Generation architecture audits concluded that visibility into decisions is more important than immediately changing scoring behavior.

**Current status**

- Accepted priority direction.

---

## **3. Rejected Directions**

### **Treating MBA generation improvements as primarily weight/scoring tuning**

**What was proposed**

- Continue adjusting weights and generation scoring.

**Why rejected**

- Audits revealed deeper architectural issues:
    - no true direction model
    - sequence-centric generation
    - weak observability

**Replaced by**

- Direction modeling research.
- Observability/debug-first approach.

---

### **Broad visual redesigns**

**What was proposed**

- Larger UX redesign efforts.

**Why rejected**

- Current bottlenecks are interaction consistency and architecture.
- Visual changes would provide less value.

**Replaced by**

- Focus on friction reduction and foundational architecture.

---

### **Jumping directly to a full Hub implementation**

**What was proposed**

- Hub as the next major project.

**Why rejected**

- Prerequisites are not complete:
    - entity normalization
    - relationships
    - portable knowledge
    - asset integrity

**Replaced by**

- Incremental progression toward Hub.

---

### **Treating “Direction Tags” as actual generation direction**

**What was proposed**

- Existing board tags effectively acting as direction.

**Why rejected**

- Audits identified that board tags describe generated results, not intended direction.

**Replaced by**

- Distinction between:
    - Seed Direction
    - Board Tags / Current Board Tags

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **The project has entered a new phase**

The ecosystem is moving from:

```text
Can it work?
```

to:

```text
What is this system becoming?
```

The focus has shifted from features to structure.

---

### **The real architecture progression is:**

```text
Asset Integrity
    ↓
Mobile Library Portability
    ↓
Portable Knowledge
    ↓
Multi-Entity MBA
    ↓
Entity Normalization
    ↓
Relationships
    ↓
Hub
```

This sequence emerged repeatedly and appears to be the actual strategic evolution path.

---

### **Text Nodes are not primarily a feature**

The important step is:

```text
MBA supports multiple entity types.
```

Text nodes are simply the first non-image entity.

This is an architectural milestone, not merely a content feature.

---

### **Portable knowledge may be more important than additional app features**

Markdown exports are increasingly viewed as:

- archival preservation
- AI-readable knowledge
- interoperability layer
- future hub foundation

rather than simple export functionality.

---

### **Hub should emerge from entities and relationships**

The Hub is increasingly viewed as:

```text
the natural result of normalized entities and relationships
```

rather than a standalone feature to build first.

---

## **5. Current Reality / Implementation Notes**

### **Documentation system is now considered structurally complete**

Evidence:

- Core
- Roadmap
- Active Context
- Technical Decisions
- Changelog
- Taxonomy
- Asset Preservation
- MBA Generation Research
- Relationship Research
- UX Observations
- Glossary

Discussion repeatedly concluded that documentation restructuring has reached diminishing returns.

---

### **Glossary was added after terminology audit**

Implemented terminology work included:

- Library vs Collection
- Asset terminology
- Relationship terminology
- Direction terminology

This appears newer than some uploaded files.

---

### **Asset Preservation document matured significantly**

The uploaded version may lag behind the later conversation.

Newer concepts introduced include:

- Preview Preservation
- File Provenance
- Original Reconnection
- Archival Preservation

---

### **UX Observations was intentionally converted from a backlog dump into a knowledge document**

The purpose became:

- audits
- principles
- recurring UX opportunities

rather than implementation tasks.

---

## **6. Open Questions**

### **What is the final entity model?**

Candidate entities include:

- OA Item
- Outfit
- Fitpic
- MBA Reference
- Board
- Text Node
- Library

But the final entity system remains undefined.

---

### **What does the first relationship implementation look like?**

Questions remain:

- relationship types
- relationship UX
- relationship creation workflows
- relationship browsing

---

### **What is the first practical Hub milestone?**

Potential candidates:

- cross-library search
- entity index
- relationship browser
- navigation layer

Not yet decided.

---

### **How should board direction be modeled?**

MBA generation research identified:

- board tags ≠ direction
- current direction model is insufficient

The replacement model remains unresolved.

---

### **How far should asset identity go?**

Potential future concepts:

- checksums
- persistent asset IDs
- cross-library asset identity

Still open.

---

## **7. High-Value Quotes**

1. Assets are treated as long-lived canonical objects. Renders, previews, crops, masks, and exports are treated as derived views.

2. The goal is not to store images, outfits, or boards. The goal is to build connected entities and relationships.

3. Board tags describe the result. They do not describe the intended direction.

4. Start with observability/debug, not scoring changes.

5. The important thing is not text nodes. The important thing is that MBA supports multiple entity types.

6. The Hub should emerge from entities and relationships rather than being built first.

7. Portable knowledge is as important as portable libraries.

8. The next bottlenecks are structural rather than UX-related.

9. Protect the archive before expanding the ecosystem.

10. Asset Integrity → Mobile Library Portability → Portable Knowledge → Multi-Entity MBA → Entity Normalization → Relationships → Hub.

---

# **OA/MBA Continuity Extraction** - Chat "Document Integration Review"

## **1. Important Decisions**

### **Decision: OA and MBA remain independent applications**

**Reasoning:** Different domains, workflows, and ownership boundaries. Shared concepts should emerge through ecosystem services rather than application merging.

**Status:** Implemented philosophically and architecturally.

---

### **Decision: Adopt a local-first architecture**

**Reasoning:** Personal archive and wardrobe data must remain usable without cloud infrastructure. Sync is an enhancement, not a dependency.

**Status:** Implemented.

---

### **Decision: Introduce additive identity migration instead of breaking rewrites**

**Reasoning:** Preserve compatibility while preparing for sync, relationships, and future ecosystem services.

**Examples:**

- itemUuid
- outfitUuid
- boardUuid
- relationship UUID sidecars

**Status:** Implemented.

---

### **Decision: Metadata/media separation**

**Reasoning:** Large libraries exposed the limits of embedding media directly into runtime state and backups.

**Status:** Implemented.

---

### **Decision: Hub is an ecosystem layer, not a super-application**

**Reasoning:** Users must retain the ability to work within individual libraries independently.

**Status:** Documented direction.

---

### **Decision: Distinguish Libraries from Tools**

**Reasoning:** Data and workflows should evolve independently.

**Status:** Conceptual architecture established.

---

### **Decision: Relationships become ecosystem-level objects**

**Reasoning:** Long-term value comes from connecting entities rather than merely storing them.

**Status:** Research/design phase.

---

### **Decision: Taxonomy, metadata, relationships, and lifecycle are separate concepts**

**Reasoning:** Prevents overloading tags with responsibilities they should not own.

**Status:** Documented principle.

---

### **Decision: OA image handling should become non-destructive**

**Reasoning:** Preserve originals and allow future regeneration.

**Status:** Planned architecture.

---

### **Decision: Shared media architecture should treat renders as derived assets**

**Reasoning:** Future-proofing, regeneration, archival preservation, and cross-app reuse.

**Status:** Architectural direction established.

---

## **2. Priority Changes**

### **Shift: Stability before features**

Originally much effort went into UI iteration and feature expansion.

Priority shifted toward:

- large-library stabilization
- backup reliability
- persistence safety
- recovery tooling
- media architecture

**Reasoning:** Real-world library scale exposed architectural risks.

---

### **Shift: Sync moved later**

Earlier discussions frequently referenced sync/cloud.

Current direction:

- stabilize identities
- stabilize backups
- stabilize relationships
- stabilize media

before sync rollout.

**Reasoning:** Sync amplifies existing architectural problems.

---

### **Shift: Hub moved later**

Hub remains important but was deliberately pushed behind:

- entity identity
- relationship architecture
- backup portability
- media architecture

**Reasoning:** Hub without shared foundations would create coupling without value.

---

### **Shift: Relationship architecture became more important**

Initially relationships were a future idea.

Current direction treats relationships as one of the most important long-term ecosystem systems.

**Reasoning:** Relationships create meaning and discovery beyond archival storage.

---

### **Shift: Asset preservation became a first-class concern**

Originally focused on image handling.

Evolved into:

- provenance
- originals
- archival exports
- media reconciliation
- human-readable preservation

**Reasoning:** Years of tagging and research effort became valuable enough to preserve independently of the app.

---

## **3. Rejected Directions**

### **Rejected: Merge OA and MBA into one application**

**Why rejected:**  
Different workflows and responsibilities.

**Replaced by:**  
Hub + ecosystem services architecture.

---

### **Rejected: One giant unified library**

**Why rejected:**  
Would destroy independent workflows and collection boundaries.

**Replaced by:**  
Multi-library ecosystem.

---

### **Rejected: Hub as application launcher only**

**Why rejected:**  
Too shallow to justify existence.

**Replaced by:**  
Hub as discovery, relationship, indexing, and ecosystem layer.

---

### **Rejected: Destructive image editing**

**Why rejected:**  
Destroys provenance and limits future improvements.

**Replaced by:**  
Original + edit metadata + derived render model.

---

### **Rejected: Tags for everything**

**Why rejected:**  
Taxonomy became overloaded.

**Replaced by:**  
Separation of:

- taxonomy
- metadata
- relationships
- lifecycle

---

### **Rejected: Cloud-first architecture**

**Why rejected:**  
Introduces dependency and complexity too early.

**Replaced by:**  
Local-first with future sync.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **The documentation itself became part of the architecture**

The project evolved from conversation-driven development into document-driven development.

The system now depends on:

- Core
- Roadmap
- Active Context
- Technical Decisions
- Changelog

acting as persistent architectural memory.

---

### **The real product is gradually becoming an aesthetic knowledge system**

Many discussions moved beyond:

- outfits
- moodboards

toward:

- references
- relationships
- philosophy
- historical lineage
- knowledge graph behavior

This theme exists across documents but is more obvious in discussion than in any single document.

---

### **Preservation matters as much as generation**

A recurring conclusion:

Generation features are valuable.

Preserving years of organization, tagging, provenance, and relationships is equally valuable.

---

### **The ecosystem increasingly values entity identity over application ownership**

Repeated discussions converged on:

“Applications own workflows. Entities outlive applications.”

This principle appears indirectly but is not strongly stated everywhere.

---

## **5. Current Reality / Implementation Notes**

### **Changelog maturity is much higher than roadmap maturity**

Many foundational systems are already implemented:

- UUID migration
- media architecture
- large-library stabilization
- backup hardening
- virtualization stabilization
- recovery tooling

The project is substantially more mature than a casual roadmap reader would assume.

---

### **Repository-boundary architecture is now a real concern**

Multiple discussions shifted attention toward:

- reusable infrastructure
- storage contracts
- shared entity concepts

This appears partly documented but remains an active architectural concern.

---

### **Documentation structure itself is now stabilized**

Recent work converged on roughly:

- Core
- Roadmap
- Active Context
- Backlog
- Technical Decisions
- Changelog
- Research docs

This is effectively the project’s operating system.

---

## **6. Open Questions**

### **Relationship Architecture**

- Directed vs undirected relationships?
- Relationship ownership?
- Relationship metadata?
- Relationship versioning?
- Relationship storage location?
- Cross-library resolution?

---

### **Hub Architecture**

- How much functionality belongs in Hub versus ecosystem services?
- What becomes a library?
- What becomes a tool?

---

### **Asset Preservation**

- Original reconciliation workflows
- Long-term archive formats
- Human-readable exports
- Media identity matching

---

### **Text Nodes**

- How deeply should text participate in generation?
- How should text be surfaced in discovery workflows?
- How should text relationships be represented?

---

### **Sync**

- Conflict resolution strategy
- Relationship-safe synchronization
- Cross-device media strategy

---

## **7. High-Value Quotes**

1. Applications own workflows. Entities outlive applications.
2. The Hub should coordinate libraries, not replace them.
3. Libraries store knowledge. Tools operate on knowledge.
4. Tags describe entities. Relationships connect entities.
5. Taxonomy describes what something is. Relationships describe how things connect.
6. Preserve independent collections, enable combined workflows.
7. The goal is not simply a Moodboard App and an Outfit App.
8. The ecosystem should remain local-first even if sync exists.
9. Images explain texts, and texts explain images.
10. The long-term value comes from relationships, not isolated records.

---

# **OA/MBA Continuity Extraction** - Chat "OA item editor ideas"

## **1. Important Decisions**

### **Decision: Move toward a Hub-based multi-library ecosystem**

- Reasoning: The number of collections is growing beyond a single MBA and OA. Independent app instances create friction for navigation, search, generation, and linking.
- Current status: Not implemented.

### **Decision: Libraries should remain independent first-class entities**

- Reasoning: Independent backups, exports, permissions, and management are valuable even if libraries become accessible through a common Hub.
- Current status: Concept defined, not implemented.

### **Decision: Future architecture should support relationships across library boundaries**

- Reasoning: References, boards, outfits, fitpics, and items should eventually be able to link to one another regardless of which library they live in.
- Current status: Not implemented.

### **Decision: OA image handling should become non-destructive**

- Reasoning: Background removal quality, rendering styles, and segmentation will improve over time. Preserving originals prevents irreversible quality loss.
- Current status: Not implemented.

### **Decision: Preserve original images and generate derived renders**

- Reasoning: Enables reprocessing, style switching, mask refinement, and future pipeline improvements without re-importing assets.
- Current status: Not implemented.

### **Decision: Treat image editing outputs as derived views rather than canonical files**

- Reasoning: A single source image may require different render styles for different contexts.
- Current status: Not implemented.

### **Decision: MBA and OA should eventually share a common asset model**

- Reasoning: The same source image may simultaneously function as a reference in MBA and an item image in OA.
- Current status: Not implemented.

### **Decision: Rendering should prioritize material preservation over perfect cutouts**

- Reasoning: Clean PNG-style extraction removes shadows, depth, texture, dye variation, and physicality, especially for dark garments and footwear.
- Current status: Design principle established, not implemented.

---

## **2. Priority Changes**

### **Shift: From individual app architecture toward ecosystem architecture**

- Previous focus: MBA and OA as largely separate products.
- New focus: Hub, libraries, relationships, and shared assets.
- Reasoning: Collection growth revealed architectural limitations.

### **Shift: From image editing as utility tooling toward media architecture**

- Previous focus: Better background removal.
- New focus: Original assets, masks, derived renders, render styles, and non-destructive workflows.
- Reasoning: Recent image-processing discussions exposed long-term architectural implications.

### **Shift: From item images as final outputs toward asset-based workflows**

- Previous assumption: Processed image becomes the item image.
- New direction: Original image remains canonical; processed outputs become generated representations.
- Reasoning: Enables future reprocessing and cross-app usage.

---

## **3. Rejected Directions**

### **Rejected: Treating processed cutouts as canonical item images**

- What was proposed:
    - Store final background-removed image as the item’s image.
- Why it was rejected:
    - Prevents future improvements.
    - Causes irreversible quality loss.
    - Makes reprocessing difficult.
- Replaced by:
    - Original asset + edit metadata + derived renders.

### **Rejected: Pure PNG-style extraction as the ideal rendering target**

- What was proposed:
    - Aggressive background removal and perfectly isolated objects.
- Why it was rejected:
    - Removes shadows, depth, material character, and realism.
    - Particularly harmful for dark shoes, bags, denim, leather, and naturally dyed items.
- Replaced by:
    - Physicality-preserving rendering philosophy.

### **Rejected: Viewing MBA and OA images as separate image systems**

- What was proposed:
    - Independent image ownership inside each app.
- Why it was rejected:
    - Creates duplication and prevents meaningful cross-app relationships.
- Replaced by:
    - Shared asset concept and future hub architecture.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **Assets should be treated as canonical objects**

A recurring conclusion was:

- Assets are long-lived.
- Masks, crops, previews, renders, board placements, and cutouts are derived.

This emerged as a foundational architectural principle.

### **Libraries should not own images**

The deeper emerging model is:

```text
Asset
  ↓
Entity
  ↓
Library
```

Libraries own entities.  
Entities reference assets.

This is a significant architectural distinction that may not yet be explicitly documented.

### **Physicality preservation is becoming a design philosophy**

The discussions repeatedly concluded that fashion objects should retain:

- shadow information
- texture
- dimensionality
- dye variation
- material character

The goal is not perfect extraction but believable representation.

### **Different surfaces may require different rendering strategies**

A single universal render may be the wrong abstraction.

Potential future render targets:

- Library
- Outfit canvas
- Board canvas
- Miniature preview
- Export/share image

Each may require different rendering priorities.

### **OA and MBA are evolving toward a shared media foundation**

The discussions increasingly suggest:

- common asset concepts
- common import concepts
- common rendering concepts

rather than separate image pipelines.

---

## **5. Current Reality / Implementation Notes**

### **MBA image handling is becoming the reference model**

Recent discussion repeatedly used MBA’s storage and import approach as the preferred direction for future OA image handling.

Evidence:

- Desire to keep imported images untouched.
- Desire to preserve source assets.
- Desire to generate derived outputs.

### **Hub architecture exists as a strategic direction but not an implementation plan**

The Hub concept is now fairly mature conceptually, but development is not currently focused on building it.

Evidence:

- Explicit discussion that current development does not require immediate Hub implementation.
- Focus remains on future-proofing IDs and relationships.

### **Cross-app linking is now considered desirable**

Discussion established a concrete future workflow:

```text
MBA Image
    ↓
Create OA Item
```

with linkage retained between source and destination.

This appears to be a meaningful product direction even though implementation details remain unresolved.

### **Image rendering concerns exposed architectural issues**

The conversations began as outfit image critiques but repeatedly led to architecture discussions around:

- asset ownership
- render generation
- media workflows
- non-destructive editing

This suggests image architecture is becoming a larger concern than originally documented.

---

## **6. Open Questions**

### **Should MBA and OA ultimately share a single asset database?**

Unresolved:

- Shared source assets
- Copied assets with references
- Hybrid model

### **How should assets physically exist before the Hub exists?**

Unresolved:

- Duplicate files between apps
- Shared storage layer
- Migration strategy

### **What should the first version of cross-app linking look like?**

Unresolved:

- Direct asset sharing
- Copy with relationship metadata
- Hub-dependent implementation

### **Should rendering styles be user-selectable?**

Examples:

- Catalog
- Natural
- Editorial
- High Contrast

Direction discussed but not decided.

### **Should render styles be item-level or surface-level?**

Unresolved:

- Per item
- Per library
- Per view
- Mixed approach

### **Should there be a shared import workspace?**

Unresolved:

- Single import flow for OA and MBA
- Separate imports with shared asset layer
- Hub-only feature

---

## **7. High-Value Quotes**

1. “The goal is a personal visual knowledge ecosystem, not simply a Moodboard App and an Outfit App.”
2. “Assets should be treated as long-lived canonical objects; renders should be treated as derived views.”
3. “The goal is not perfect cutout quality. The goal is preserving material identity.”
4. “Libraries should remain independent but become connected.”
5. “The Hub should enable interaction across collections without requiring those collections to merge.”
6. “The same source image may function as both a reference and an item.”
7. “Original images should remain untouched.”
8. “Physicality is more important than visual uniformity.”
9. “Relationships should be possible across library boundaries.”
10. “The future system should think in assets, entities, libraries, and relationships.”

---

## **8. Ignore**

The following were intentionally excluded because they are not durable project knowledge:

- Specific outfit critiques
- Morosino, bag, denim, sunglasses examples
- Shadow strength discussions at image level
- UI layout suggestions
- Mobile vs desktop presentation differences
- Background-removal implementation details
- Specific rendering controls and sliders
- One-off editor UI concepts
- Visual styling preferences not tied to architecture
- Minor workflow details and technical implementation minutiae

---

# **OA/MBA Continuity Extraction** - Chat "revising docs"

## **1. Important Decisions**

### **Decision: Replace “Working Notes” with “Active Context”**

- Reasoning: The document had evolved into an AI operational context file rather than human working notes. Its primary purpose is onboarding Codex/AI to current project state, constraints, priorities, and sensitive systems.
- Current status: Implemented.

### **Decision: Establish a formal documentation architecture**

- Reasoning: The project had accumulated enough architectural complexity that documentation needed explicit separation between canonical truth, research, architecture, operations, and history.
- Current status: Implemented.
- Resulting structure:
    - Core
    - Roadmap
    - Active Context
    - Sync Cloud
    - Taxonomy
    - Research / References
    - T.T / Philosophy / Interviews
    - UX Observations
    - MBA Generation Research
    - Technical Decisions
    - Future Concepts
    - Product Backlog
    - AI Collaboration
    - Completed Decisions / Changelog

### **Decision: Treat MBA generation as a research domain**

- Reasoning: Guided mode discussions revealed that generation evolution consists largely of unresolved observations, audits, hypotheses, and future experimentation rather than finalized architecture.
- Current status: Implemented via dedicated MBA Generation Research document.

### **Decision: Separate taxonomy specification from taxonomy reasoning**

- Reasoning: Taxonomy had become a mixture of final ontology and historical exploration. Future maintenance will require a clean canonical taxonomy while preserving reasoning history.
- Current status: Partially implemented.

### **Decision: Use Active Context as AI onboarding rather than project history**

- Reasoning: Codex benefits more from current priorities and constraints than from historical implementation detail.
- Current status: Not yet fully reflected in Active Context.

### **Decision: Treat AI collaboration as a first-class project system**

- Reasoning: Prompt design, context layering, architectural reminders, and safe implementation patterns have become significant determinants of project quality.
- Current status: Implemented through AI Collaboration documentation.

### **Decision: Treat text/philosophy entries as potential first-class MBA entities**

- Reasoning: Long-term vision is a semantic ecosystem where images and texts explain each other through shared tags and relationships.
- Current status: Conceptual only.

---

## **2. Priority Changes**

### **Shift: MBA stabilization → ecosystem evolution**

- Reasoning:
    - Large-library stabilization largely complete.
    - Metadata/media architecture stabilized.
    - Focus moving toward taxonomy, relationships, generation, and ecosystem design.
- Status: Ongoing.

### **Shift: Infrastructure urgency reduced**

- Reasoning:
    - Metadata-first runtime architecture succeeded.
    - Large-library performance issues largely resolved.
    - Immediate value now lies more in knowledge architecture and relationships.
- Status: Ongoing.

### **Shift: Mobile audits moved higher**

- Reasoning:
    - Desktop workflows are substantially stabilized.
    - Remaining friction increasingly concentrated on mobile interaction.
- Status: Active.

### **Shift: Generation work moved from implementation to research**

- Reasoning:
    - Guided mode audits revealed deeper architectural questions than simple scoring adjustments.
- Status: Active.

### **Shift: Taxonomy became strategic infrastructure**

- Reasoning:
    - Increasing recognition that generation, retrieval, relationships, future AI systems, and semantic linking all depend on ontology quality.
- Status: Active.

---

## **3. Rejected Directions**

### **Rejected: Treating direction tags as actual generation direction**

- What was proposed:
    - Current guided mode treated board statistics as board intent.
- Why rejected:
    - Observed board characteristics are not the same as generation direction.
- Replaced by:
    - Future direction modeling and board-centric generation research.

### **Rejected: Broad visual redesign as current priority**

- What was proposed:
    - Large UI redesign passes.
- Why rejected:
    - Current bottlenecks are interaction consistency, density, discoverability, and friction reduction.
- Replaced by:
    - UX audits and targeted interaction improvements.

### **Rejected: Over-documenting AI prompts with massive context blocks**

- What was proposed:
    - Large contextual prompt dumps for Codex.
- Why rejected:
    - Encourages overreach, unrelated refactors, and architectural drift.
- Replaced by:
    - Small architectural constraints + focused implementation prompts.

### **Rejected: Treating provenance metadata as the primary MBA taxonomy axis**

- What was proposed:
    - Increasingly provenance-heavy classification.
- Why rejected:
    - Retrieval and generation benefit more from semantic clustering than exhaustive provenance.
- Replaced by:
    - Content-first, semantic-first taxonomy philosophy.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **MBA is evolving into a knowledge graph, not a moodboard application**

The text/philosophy node concept implies a long-term shift from:

- visual archive  
    to:
- interconnected knowledge archive

Images, texts, boards, fitpics, garments, references, and philosophy are increasingly being viewed as equal entities in a semantic ecosystem.

### **Sportswear research is becoming strategically important**

The project currently has a strong workwear/material culture foundation but a weaker understanding of archival sportswear and athletic lineage.

Sportswear research may become a balancing force preventing the ecosystem and wardrobe philosophy from collapsing into predictable heritage/workwear archetypes.

### **The documentation system itself is becoming infrastructure**

The project now effectively contains:

- human cognition layer
- AI operational layer
- canonical architecture layer
- research layer

This distinction emerged organically and appears strategically important.

### **Active Context should become radically more current-state focused**

The current document still contains too much historical implementation state. Future evolution should move history into Changelog and decisions into Technical Decisions.

### **Taxonomy reasoning history has long-term value**

The discussions that produced the taxonomy are themselves important intellectual infrastructure and should be preserved rather than deleted.

---

## **5. Current Reality / Implementation Notes**

### **Documentation structure has evolved beyond existing guidance**

Several older documents still reference:

- working-notes.md
- earlier document structures

while the project now uses a more mature documentation architecture.

### **MBA stabilization is effectively further along than some docs imply**

Current discussions treat:

- metadata-first runtime
- media separation
- filter architecture
- dashboard architecture

as largely solved foundations rather than active projects.

### **Product Backlog contains historical prompt archives**

The document appears to contain:

- completed work
- future work
- abandoned ideas
- implementation prompts

without clear separation.

### **UX Observations contains backlog content**

The document increasingly mixes:

- observations
- implementation plans
- feature backlog items

and may need separation.

### **Active Context still contains significant historical context**

Current usage suggests it should increasingly become:

- current priorities
- current risks
- current research tracks

rather than implementation history.

---

## **6. Open Questions**

### **Relationship architecture**

How should relationships ultimately work between:

- OA items
- outfits
- fitpics
- MBA references
- boards
- text/philosophy nodes

### **Text nodes**

Should texts become true first-class entities or remain a specialized MBA extension?

### **Taxonomy evolution**

Should semantic roles eventually be separated into:

- subject/*
- mode/*
- source/*
- medium/*
- platform/*  
    rather than continuing to overload certain families?

### **Generation evolution**

Should MBA move toward:

- board-centric composition
- direction modeling
- taxonomy-aware weighting
- graph-aware generation

and in what order?

### **Hub architecture**

What is the final relationship between:

- libraries
- tools
- hub
- cross-library workflows

### **Sportswear ontology**

How should archival athletic/sportswear lineage integrate into the broader MBA taxonomy and research model?

---

## **7. High-Value Quotes**

1. “The system is not only about visual similarity.”
2. “Images explain texts, and texts explain images.”
3. “Generation research should start with observability, not scoring changes.”
4. “Semantic content should be prioritized over provenance.”
5. “Incomplete-but-useful tagging is more valuable than exhaustive metadata correctness.”
6. “The goal is historical memory rather than costume.”
7. “The Hub starts to look less like an application launcher and more like a layer that allows independent collections to interact.”
8. “The project now has a human cognition layer and an AI operational layer.”
9. “Taxonomy is not tag organization; it is semantic system design.”
10. “Sportswear research may become a counterbalance preventing the system from drifting into pure heritage archetypes.”

---

# **OA/MBA Continuity Extraction** - Chat "Image renaming suggestion"

## **1. Important Decisions**

### **Decision: Preserve T.T. lot and color metadata in filenames instead of relying on manual tags**

- Reasoning:
    - Previous workflow preserved image order but lost lot and color information.
    - Filenames can preserve season, lot, color, and sequence simultaneously.
    - Metadata can later be parsed automatically into tags if desired.
- Current status:
    - Partially implemented.
    - Adopted for SS26 imports and intended going forward.

---

### **Decision: Treat official T.T. product assets as a higher-value archival source than general reference images**

- Reasoning:
    - Official product pages contain unique information that cannot be reconstructed later.
    - Product images, descriptions, materials, dye notes, construction details, and measurements are primary-source data.
    - Random Instagram or resale images provide lower information density.
- Current status:
    - Not fully implemented.
    - Accepted as future archival direction.

---

### **Decision: Focus lot-level metadata efforts on official product images and lookbooks**

- Reasoning:
    - Full lot coverage across all references would require disproportionate effort.
    - Official assets form the structural backbone of the archive.
- Current status:
    - Planned.

---

### **Decision: Preserve product-level information separately from image-level information**

- Reasoning:
    - Product descriptions belong to the product entity, not individual images.
    - Information should eventually exist once per lot rather than duplicated across images.
- Current status:
    - Concept accepted.
    - Not yet implemented.

---

### **Decision: Preserve website information before attempting perfect archive tagging**

- Reasoning:
    - Website content is time-sensitive and may disappear.
    - Tags can always be added later.
    - Lost product descriptions are much harder to recover.
- Current status:
    - Planned next phase.

---

## **2. Priority Changes**

### **Shift: Product information preservation moved above archive enrichment**

- Previous emphasis:
    - Tagging
    - Archive cleanup
    - Metadata refinement
- New emphasis:
    - Capturing official product data from the T.T. website.
- Reasoning:
    - Product descriptions, measurements, materials, and historical notes are irreplaceable.

---

### **Shift: Finish SS26/AW26 ingestion before large retroactive cleanup projects**

- Reasoning:
    - Current-season information is easiest to preserve while available.
    - Older archive cleanup has diminishing returns.
- Status:
    - Active priority.

---

### **Shift: Metadata preservation over metadata perfection**

- Reasoning:
    - Embedding lot/color into filenames preserves value immediately.
    - Avoids large-scale manual tagging projects.
- Status:
    - Active workflow direction.

---

## **3. Rejected Directions**

### **Rejected: Full manual lot tagging across all T.T. references**

- What was proposed:
    - Comprehensive lot assignment for all archive images.
- Why rejected:
    - Excessive effort.
    - Poor return on time invested.
- Replaced by:
    - Lot coverage for official assets plus filename-based preservation.

---

### **Rejected: Extensive manual color tagging**

- What was proposed:
    - Dedicated color tagging workflow.
- Why rejected:
    - Color is often visually obvious.
    - Lower value than lot information.
- Replaced by:
    - Preserving color in filenames.

---

### **Rejected: Using descriptions on every image**

- What was proposed:
    - Adding descriptions image-by-image.
- Why rejected:
    - Product information belongs at the product level.
    - Creates duplication and maintenance burden.
- Replaced by:
    - Product-level metadata preservation.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **Official product information is one of the highest-value archival assets**

The archive should not be viewed as primarily an image collection. Product pages contain historical context, design intent, fabric information, dye information, and construction details that may ultimately be more valuable than additional image tagging.

---

### **T.T. archive is evolving from an image archive into a product knowledge archive**

The archive increasingly centers around:

```text
Season
 └─ Lot
     ├─ Metadata
     ├─ Description
     ├─ Product Images
     ├─ Lookbook Images
     └─ Related References
```

rather than flat collections of images.

---

### **Filenames can function as a lightweight metadata system**

For T.T., structured filenames preserve significant information without requiring an immediate tagging system.

Example:

```text
ss26-lot113-akitasugi-dark-blue-01.jpg
```

already contains:

- season
- lot
- color
- sequence

and can be parsed later.

---

### **Preservation should be prioritized over organization**

If forced to choose:

- preserve information now
- organize it later

rather than the reverse.

This emerged repeatedly during discussion of website descriptions and archival workflows.

---

## **5. Current Reality / Implementation Notes**

### **Previous seasons already preserve image ordering**

- Image order was manually reconstructed in Freeform.
- Resulting MBA browsing experience is already strong.
- However, lot and color metadata were lost during that process.

---

### **New SS26 workflow preserves significantly more information**

Current filenames preserve:

- season
- lot
- color
- image sequence

This represents a meaningful improvement over prior workflows.

---

### **Official website information is currently at risk**

Evidence:

- Images were saved using “Save Page As…”
- HTML and supporting files were later deleted.
- Product descriptions and metadata were not preserved.

This created awareness that text content is more fragile than images.

---

### **Archive curation is becoming a larger workload than application development**

Discussion suggests a transition from:

- building MBA/OA functionality

toward:

- image organization
- metadata preservation
- archival curation

as the dominant workload.

---

## **6. Open Questions**

### **Should MBA eventually support product entities separate from images?**

Potential model:

```text
Lot
 ├─ Metadata
 ├─ Description
 ├─ Images
 └─ Relationships
```

instead of storing everything at image level.

---

### **Should filename parsing become a first-class import feature?**

Potential capability:

```text
ss26-lot112-black-01.jpg
```

↓

```text
season/ss26
lot/112
color/black
```

automatically.

---

### **What is the best long-term method for preserving website product information?**

Possibilities discussed:

- HTML archives
- Markdown exports
- Structured database records
- Automated extraction

No final approach chosen.

---

### **How much effort should be spent retroactively enriching older T.T. seasons?**

Current direction favors limited backfill, but no definitive cutoff has been established.

---

## **7. High-Value Quotes**

1. “The filenames themselves are becoming a lightweight metadata system.”
2. “Preserve information now, organize it later.”
3. “Product descriptions are harder to recover than tags.”
4. “Official product assets form the backbone of the archive.”
5. “Lot metadata is structural; color metadata is enrichment.”
6. “The goal is not perfect metadata coverage but preserving high-value information.”
7. “A product page contains more information density than most reference images.”
8. “The archive is gradually becoming a product knowledge archive rather than an image archive.”
9. “One description maintained once is better than repeating information across twenty images.”
10. “Website information disappears; images usually survive.”

# **OA/MBA Continuity Extraction** - Chat "Export Metadata as MD"

## **1. Important Decisions**

### **Decision: Human-readable archive export should exist alongside JSON backups**

**Reasoning**

- JSON backups are ideal for restoration.
- Human-readable exports protect years of metadata work even if the app, codebase, hosting, or database disappear.
- Long-term preservation is becoming a major project concern.

**Current status**

- Not implemented.

---

### **Decision: Archive export should use one Markdown file per entity/reference**

**Reasoning**

- Preserves metadata independently from the application.
- Future-proof and software-independent.
- Easily imported into tools like Obsidian.
- Supports future relationship graphs.

**Current status**

- Not implemented.

---

### **Decision: Stable IDs are becoming foundational infrastructure**

**Reasoning**

- Required for future linking.
- Required for archive exports.
- Required for future hub architecture.
- Required for cross-library relationships.

**Current status**

- Partially implemented / architectural requirement identified.

---

### **Decision: Future architecture should preserve independent libraries rather than merging everything**

**Reasoning**

- T.T library and Personal library serve different purposes.
- Users should always be able to work inside a single focused collection.
- Aggregation should be optional.

**Current status**

- Not implemented.

---

### **Decision: Hub should be a layer above collections, not a replacement for them**

**Reasoning**

- Existing workflows remain intact.
- Combined search, generation and linking become possible.
- Reduces friction without destroying separation.

**Current status**

- Conceptual.

---

### **Decision: Libraries and tools should eventually be treated as separate concepts**

**Reasoning**

- Data sources and workflows scale differently.
- Outfit generation and board generation are workflows.
- Personal MBA, T.T MBA and OA are data collections.

**Current status**

- Conceptual.

---

## **2. Priority Changes**

### **Shift toward data longevity and preservation**

**Previous focus**

- Features
- UX
- Generation workflows
- UI refinement

**New focus**

- Stable IDs
- Export formats
- Backups
- Portability
- Long-term ownership of data

**Reasoning**

- Libraries are becoming substantial assets:
    - T.T MBA (~6,000 images)
    - Personal MBA (~2,000 images)
    - OA wardrobe (~171 items)
- Risk of losing accumulated metadata work becomes meaningful.

---

### **Hub architecture increased in importance**

**Previous assumption**

- Separate OA and MBA applications.

**New direction**

- Ecosystem of libraries connected through a shared layer.

**Reasoning**

- Real-world usage already involves multiple independent collections.

---

### **Library abstraction becoming more important than app abstraction**

**Reasoning**

- User increasingly thinks in terms of collections and knowledge bases rather than applications.
- Future growth likely involves more libraries rather than more apps.

---

## **3. Rejected Directions**

### **Rejected: One giant merged library**

**Proposed**

- Combine everything into a single collection/database.

**Why rejected**

- Loses separation between:
    - Personal inspiration
    - T.T research
    - Wardrobe data
- Makes backups and organization harder.
- Weakens focused workflows.

**Replaced by**

- Independent libraries + optional aggregate views.

---

### **Rejected: Hub as a simple application launcher**

**Proposed**

- Hub mainly launches OA or MBA.

**Why rejected**

- Does not solve cross-library workflows.
- Adds little value beyond navigation.

**Replaced by**

- Hub as a relationship/search/generation layer above collections.

---

### **Rejected: Thinking primarily in terms of MBA vs OA**

**Proposed**

- Separate generation systems tied to separate apps.

**Why rejected**

- Doesn’t scale to multiple libraries.
- Doesn’t support cross-source workflows.

**Replaced by**

- Libraries (data) + Tools (workflows).

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **Data longevity is becoming a first-class architectural concern**

The project is moving beyond app functionality and toward long-term knowledge preservation.

Questions increasingly revolve around:

- How to preserve metadata
- How to survive migrations
- How to avoid lock-in
- How to retain value independent of the software

This appears to be an emerging project philosophy.

---

### **Libraries are emerging as first-class entities**

Future architecture should not assume:

- One MBA library
- One OA collection

Instead:

```text
Account
 └─ Libraries
```

appears to be the more scalable model.

---

### **Hub should enable aggregation without forcing aggregation**

Key principle:

Separation should remain the default.  
Aggregation should be optional.

This appears important enough to become a design principle.

---

### **The ecosystem is evolving toward a personal knowledge system**

The project is no longer only:

- Moodboards
- Outfit generation

It is becoming:

- Visual archive
- Research system
- Wardrobe system
- Inspiration system
- Knowledge graph

This direction was strongly implied throughout the discussion.

---

### **Cross-library relationships are likely more important than future cloud features**

Relationships between:

- References
- Boards
- Wardrobe items
- Outfits
- Libraries

may become a defining capability of the ecosystem.

---

## **5. Current Reality / Implementation Notes**

### **OA already functions as a unified ecosystem**

The discussion initially implied separate OA collections.

Actual reality:

```text
OA
├─ Wardrobe
├─ Wishlist
├─ Interested
└─ Fitpics
```

already exist within a shared system and shared database.

The current fragmentation exists primarily between:

```text
MBA Personal
MBA T.T
OA
```

not inside OA itself.

---

### **Hub motivation is already validated by real usage**

This is not a speculative future need.

The user actively maintains:

- MBA Personal (~2k images)
- MBA T.T (~6k images)
- OA

and experiences friction switching between them.

---

### **Board generation already demonstrates the value of cross-library workflows**

The user explicitly values:

collecting ideas and resurfacing them through board generation

This suggests future generation systems should be able to operate across libraries rather than being confined to individual applications.

---

## **6. Open Questions**

### **What should the canonical Hub UI look like?**

Possibilities:

- Dedicated Hub interface
- MBA evolved into Hub
- Lightweight library selector
- Dashboard-centric approach

Unresolved.

---

### **How should cross-library relationships be modeled?**

Examples:

- MBA Reference ↔ OA Item
- MBA Board ↔ OA Outfit
- Reference ↔ Reference across libraries

No final relationship model yet.

---

### **What should the first implementation of library abstraction look like?**

Questions include:

- Separate databases?
- Shared database with library IDs?
- Hybrid architecture?

Unresolved.

---

### **What is the correct timeline for Hub development?**

Questions:

- After archive export?
- After cloud sync?
- Before cloud sync?

No final prioritization.

---

### **How should generation tools evolve?**

Open question:

Should generation remain app-specific or become generic workflows operating on arbitrary libraries?

No final answer.

---

## **7. High-Value Quotes**

1. “The Hub should add aggregation, not replace separation.”
2. “Users should never lose the ability to work inside a single library exactly as they do today.”
3. “Libraries are data. Generation is a tool.”
4. “The goal is not one giant library.”
5. “The Hub is not primarily an application launcher.”
6. “Aggregation should be optional, not mandatory.”
7. “JSON is the restore format. Markdown is the human-readable archive.”
8. “The ecosystem should distinguish between libraries and tools.”
9. “The long-term goal is a personal visual knowledge ecosystem.”
10. “The value is not only collecting references, but resurfacing them through generation and relationships.”

# **OA/MBA Continuity Extraction** - Chat "MBA Library Tagging Strategy"

## **1. Important Decisions**

### **Decision: Treat scalable export/import as the canonical recovery and normalization pipeline**

- Reasoning:
    - Export/import successfully repaired prior media inconsistencies.
    - Imported libraries became fully healthy with aligned item/media counts and zero missing media.
    - The pipeline effectively acts as a compaction and normalization pass.
- Current status:
    - Implemented and validated.

---

### **Decision: Separate TT archive and general MBA archive as independent libraries**

- Reasoning:
    - The user now maintains a large general MBA library (~2k images) and a much larger TT-focused archive (~6k images).
    - Different purposes, tagging requirements, and research goals.
- Current status:
    - Implemented operationally.

---

### **Decision: Prioritize ontology/tagging work over filename cleanup**

- Reasoning:
    - Semantic tagging is more valuable and harder to recreate than filename normalization.
    - Current rename workflows still contain media-linkage bugs.
    - File naming can be reconstructed later.
- Current status:
    - Active working principle.

---

### **Decision: Subject classification should use semantic subject categories**

- Reasoning:
    - `subject/fit` and `subject/garment` describe what the image is primarily about.
    - More useful than image-format categories such as “fitpic”.
    - Supports hybrid references (fit + garment).
- Current status:
    - Partially implemented in tagging practice.

---

### **Decision: Provenance, filenames, display titles, and media identity must be separated**

- Reasoning:
    - Current naming/media issues stem from multiple concepts being conflated.
    - Future original-file reconciliation requires stable provenance metadata.
- Current status:
    - Not implemented.
    - Accepted architectural direction.

---

### **Decision: Metadata autosnapshots should become a core safety feature**

- Reasoning:
    - The largest risk is now loss of tagging and ontology work rather than media loss.
    - User frequently forgets manual backups.
- Current status:
    - Planned, prioritized for next development cycle.

---

## **2. Priority Changes**

### **Backup infrastructure moved to highest architectural priority**

- Previous focus:
    - Storage integrity, exports, media corruption.
- New focus:
    - Preventing loss of semantic work.
- Reasoning:
    - Storage layer is now largely stable.
    - Tagging effort is the most valuable asset.

---

### **Ontology/tagging work moved ahead of provenance cleanup**

- Reasoning:
    - Filename cleanup and original-file reconciliation can be deferred.
    - Building the archive knowledge structure is more important now.
- Status:
    - Active.

---

### **Metadata autosnapshots prioritized before restore/history UI**

- Reasoning:
    - Creating recovery points is more important than viewing them.
    - Safety first, convenience second.
- Status:
    - Planned.

---

## **3. Rejected Directions**

### **Rejected: Pause tagging until rename/media architecture is fixed**

- Why rejected:
    - Tagging workflows are stable enough.
    - Renaming is the specific unsafe operation.
- Replaced by:
    - Continue tagging.
    - Avoid renaming.

---

### **Rejected: Use filenames as primary organizational structure**

- Why rejected:
    - Filenames are inconsistent.
    - They are mutable and unreliable.
    - Semantic organization is more valuable.
- Replaced by:
    - Tags, provenance metadata, and display titles.

---

### **Rejected: Force every image into a single subject category**

- Why rejected:
    - Many references are simultaneously fit references and garment references.
- Replaced by:
    - Multi-subject tagging such as:
        - `subject/fit`
        - `subject/garment/jacket`

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **MBA is increasingly a knowledge archive, not just a moodboard tool**

The most valuable asset is now:

- ontology
- tagging
- curation
- relationships
- provenance

rather than the image files themselves.

---

### **Export/import functions as a library normalization process**

Beyond backup and recovery, scalable export/import effectively:

- compacts data
- repairs inconsistencies
- removes broken media relationships
- converges libraries toward a canonical structure

This appears to be an emergent architectural property.

---

### **Semantic structure is more valuable than file naming**

A future loss of filenames is recoverable.  
A future loss of ontology work is not.

This should influence future prioritization.

---

### **Subject classification and presentation classification are different concepts**

The conversation implicitly established:

Subject:

- fit
- garment
- detail
- material

Presentation:

- mirror
- flatlay
- editorial
- product

These should remain separate dimensions.

---

### **Provenance should become a first-class archival concern**

Future reconciliation work will require:

- original imported filename
- display title
- current external filename
- media identity

to be treated as distinct concepts.

---

## **5. Current Reality / Implementation Notes**

### **Libraries have been validated through full export/import recovery cycles**

Evidence:

- Healthy integrity reports.
- Zero missing media after re-import.
- Successful scalable exports.

This appears operationally proven.

---

### **Rename/title save path remains unsafe**

Evidence:

- Renaming references can still break media linkage.
- Re-attaching images repairs items.
- Integrity reports show media issues appear after rename actions.

Current reality:

- Renaming should be avoided.

---

### **Current archive structure already relies heavily on blob-backed imported previews**

Evidence:

- Imported libraries show nearly all assets as blob-backed imported previews.

Implication:

- Future media architecture must preserve this model.

---

### **Subject taxonomy is evolving beyond flat tagging**

Observed direction:

- source
- origin
- lineage
- garment
- material
- condition
- reference
- subject

This is more mature than a generic tag system.

---

## **6. Open Questions**

### **How should provenance metadata be modeled?**

Open:

- original filename
- external filename
- display title
- aliases/history
- media identity

Need final schema.

---

### **How should original-file reconciliation work?**

Open:

- filename matching
- dimension matching
- size matching
- future perceptual matching

No final design yet.

---

### **Should condition and texture become separate dimensions?**

Examples:

- `condition/worn`
- `condition/repaired`  
    vs
- `texture/hairy`
- `texture/slubby`

Not yet finalized.

---

### **How far should temporal tagging go?**

Open questions:

- reference/pre-1960
- reference/1930s-1950s
- era/prewar-ish
- era/uncertain

Temporal ontology remains unresolved.

---

### **Should presentation taxonomy exist separately from subject taxonomy?**

Potential:

- `subject/fit`
- `subject/garment`

vs

- `presentation/mirror`
- `presentation/flatlay`
- `presentation/editorial`

Not yet decided.

---

## **7. High-Value Quotes**

1. “The valuable work now is ontology/tagging, not filenames.”
2. “Preserve semantic structure first.”
3. “A future loss of filenames is recoverable. A future loss of ontology work is not.”
4. “MBA is becoming a research archive and visual knowledge base, not just a moodboard app.”
5. “Subject and presentation are different dimensions.”
6. “Export/import is acting as a canonicalization layer.”
7. “Semantic organization should take priority over filename normalization.”
8. “Provenance, filenames, display titles, and media identity are separate concepts.”
9. “The most important safety feature now is protecting metadata work.”
10. “Continue tagging. Avoid renaming.”

---

## **8. Ignore**

Excluded:

- Detailed rename bug investigation
- Media orphan counts
- Integrity report specifics
- Browser/File System Access debugging
- Vercel deployment troubleshooting
- Individual tagging decisions for specific garments
- UI layout discussions
- Temporary repair workflows
- Specific implementation prompts and test instructions
- One-off vintage garment dating discussions

# **OA/MBA Continuity Extraction** - Chat "Mobile select-mode bug fix"

## **1. Important Decisions**

### **Decision: Mobile Library should prioritize browsing density over large thumbnails**

- Reasoning: The Library is primarily a visual reference archive. Showing more images simultaneously improves scanning, comparison, and discovery.
- Current status: Implemented.
- Evidence: Mobile Library moved to a 3-column layout, with virtualization updated to support it correctly.

### **Decision: Mobile select mode should be a dedicated interaction state**

- Reasoning: Keeping normal browsing controls visible during selection created visual clutter and excessive header height.
- Current status: Implemented.
- Evidence: Dedicated compact select-mode toolbar replaced the normal browsing controls during selection.

### **Decision: Saved Views belong inside Filter rather than as a top-level command**

- Reasoning: Saved Views behave more like filter/display presets than a primary action. A separate Views button increased header complexity without providing distinct functionality.
- Current status: Implemented.
- Evidence: Views functionality moved into Filter and the standalone Views control removed.

### **Decision: Mobile interaction changes should be implemented incrementally in isolated passes**

- Reasoning: Large UI rewrites were producing regressions and making validation difficult. Smaller passes reduce risk and make rollback easier.
- Current status: Implemented as workflow.
- Evidence: Changes were intentionally split into:
    1. Multi-select fix
    2. Compact selection toolbar
    3. Density experiment
    4. Views merge
    5. Future search redesign

---

## **2. Priority Changes**

### **Mobile Library interaction simplification moved ahead of broader architecture work**

- Reasoning: The Library is one of the most frequently used MBA surfaces and was carrying interaction debt.
- Result:
    
    - Multi-select fix
    - Select-mode redesign
    - Density improvements
    - Views consolidation  
        were prioritized before larger feature work.

### **Search redesign explicitly deferred**

- Reasoning: Search affects interaction architecture more deeply than the other changes and was likely to introduce additional state-management complexity.
- Result: Search was intentionally postponed until after Library stabilization.

### **Interaction stabilization prioritized over new functionality**

- Reasoning: Multiple regressions surfaced during the Views merge and Filter changes. Fixing interaction correctness became more important than adding new features.
- Result: Significant effort was spent resolving overlay, dismissal, pointer-event, and click-through issues before proceeding.

---

## **3. Rejected Directions**

### **Separate top-level Views control**

- What was proposed:
    - Keep Views as an independent Library command.
- Why rejected:
    - Increased header complexity.
    - Functionally overlapped with filtering/presets.
- Replaced with:
    - Views integrated into Filter.

### **Combining all mobile Library changes into one large pass**

- What was proposed:
    - Density changes, search redesign, views consolidation, and selection redesign simultaneously.
- Why rejected:
    - High regression risk.
    - Difficult to isolate problems.
- Replaced with:
    - Sequential pass-based implementation.

### **Hardcoding mobile grid assumptions throughout the codebase**

- What was proposed:
    - Directly embedding mobile column counts and sizing values into multiple systems.
- Why rejected:
    - Difficult to tune or revert.
- Replaced with:
    - Centralized mobile grid configuration.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **Library headers were consuming too much visual attention**

A recurring conclusion was that the MBA Library should feel like a browsing surface first and a control surface second.

This principle drove:

- Select-mode redesign
- Views consolidation
- Future search redesign discussions
- Mobile density increases

### **Density can be increased without harming usability if image quality is consistent**

The 3-column experiment worked because the MBA collection is relatively coherent and visually readable. The project may be able to favor higher information density than typical Pinterest-style interfaces.

### **Overlay interaction quality matters more than feature count**

A disproportionate amount of implementation effort was spent on:

- outside click handling
- dismissal behavior
- click-through prevention
- mobile pointer interaction

This reinforces that interaction correctness is a first-class product concern.

### **UI simplification should generally happen through consolidation rather than addition**

The successful direction repeatedly involved:

- removing controls
- merging surfaces
- reducing header layers  
    rather than introducing new UI elements.

---

## **5. Current Reality / Implementation Notes**

### **Mobile Library uses a 3-column grid**

- Implemented.
- Virtualization updated to support the new layout.
- Appears to be working well in practice.

### **Mobile select mode has a dedicated compact toolbar**

- Implemented.
- Normal browsing controls are hidden while selecting.

### **Saved Views now live inside Filter**

- Implemented.
- Standalone Views button removed.
- Views section is collapsed by default.

### **Significant overlay/event infrastructure has been modified**

- Multiple regressions were discovered and fixed around:
    - outside-click dismissal
    - panel containment
    - pointer events
    - click-through behavior
- Current implementation includes special handling to prevent underlying interactions when dismissing Filter.

### **Search redesign remains unimplemented**

- Explicitly deferred.
- Still planned.

---

## **6. Open Questions**

### **Should search become a dedicated mode rather than a permanent control?**

Still unresolved.

Questions include:

- Should search expand when activated?
- Should other controls temporarily disappear?
- Should search collapse automatically?
- Should desktop and mobile share the same behavior?

### **Should image count move into the control row?**

Partially discussed but deferred.

Question:

- Is the remaining Library header height worth further reduction?

### **Is 3-column density permanently better than 2-column density?**

The experiment looks successful, but long-term usage validation was intentionally left open.

---

## **7. High-Value Quotes**

1. “The library should feel like a browsing surface first and a control surface second.”
2. “Views is basically a filter/view preset surface, not a top-level command.”
3. “Start with the bug first. Then refine the header state.”
4. “Keep changes small and localized.”
5. “Interaction correctness is more important than adding new controls.”
6. “Make density changes easy to tune or revert.”
7. “Avoid introducing a second source of truth.”
8. “Simplify through consolidation rather than adding more UI.”
9. “The real test is scanning, selecting, and browsing over time, not first impressions.”
10. “Stop when the interaction model feels intentional, not when every idea has been implemented.”

---

## **8. Ignore**

No durable project knowledge emerged from:

- Specific CSS/layout values
- Exact column widths or gutter sizes
- Individual pointer-event fixes
- Overlay implementation details
- Prompt wording iterations
- Test counts/build outputs
- One-off regression fixes

These were implementation details rather than long-term product decisions.

---

# **OA/MBA Continuity Extraction** - Chat "Image Import Crash Fix"

## **1. Important Decisions**

### **Decision: MBA generation scoring should prioritize content relationships over organizational metadata**

- Reasoning: `project`, `theme`, `source`, and similar metadata were reinforcing each other multiple times, producing flat candidate pools and weak diversity.
- Current status: Implemented.

### **Decision: Separate content tags from metadata tags in guided board generation**

- Reasoning: Content coherence (garments, mood, subjects, materials, etc.) should drive visual relationships, while metadata should only provide light directional influence.
- Current status: Implemented.

### **Decision: Guided generation remains weighted-random rather than deterministic**

- Reasoning: The goal is coherent discovery, not always selecting the highest-scoring candidate.
- Current status: Implemented.

### **Decision: Mobile MBA library becomes preview-first**

- Reasoning: Mobile users browse visually; selection is secondary. Desktop remains management-first.
- Current status: Implemented.

### **Decision: Mobile selection requires explicit Select mode**

- Reasoning: Avoid conflict between browsing and bulk-management workflows.
- Current status: Implemented.

### **Decision: Mobile preview becomes a dedicated fullscreen viewer**

- Reasoning: Floating desktop-style modals are inappropriate for phone usage.
- Current status: Implemented.

### **Decision: Mobile library should behave as a fullscreen surface rather than a nested panel**

- Reasoning: The desktop panel metaphor wastes space and exposes underlying board UI.
- Current status: Implemented.

### **Decision: MBA mobile library cards should become image-first tiles**

- Reasoning: Names, tags, and card chrome reduce browsing density and are rarely needed during exploration.
- Current status: Implemented.

### **Decision: Mobile preview metadata should be hidden by default**

- Reasoning: Images are primary; metadata is secondary.
- Current status: Implemented.

### **Decision: Mobile preview navigation should use swipe gestures**

- Reasoning: More natural image-browser behavior.
- Current status: Implemented.

### **Decision: Board zoom should use two-finger gestures rather than browser zoom**

- Reasoning: Prevent browser-level page zoom and improve board interaction.
- Current status: Implemented.

---

## **2. Priority Changes**

### **Mobile UX moved significantly up in priority**

- Originally most effort focused on generation, tagging, and desktop workflows.
- Mobile library browsing emerged as a major usage mode and received multiple dedicated passes.

### **Guided generation quality moved above new generation features**

- Focus shifted from adding generation capabilities toward improving candidate ranking, diversity, and scoring behavior.
- Reasoning: Existing generation was functional but not producing enough score separation.

### **MBA library browsing experience became a near-term priority**

- Fullscreen browsing, preview-first interaction, density improvements, swipe navigation, and gesture handling were prioritized.
- Reasoning: MBA increasingly functions as a visual archive rather than merely a tagged database.

### **Taxonomy evolution prioritized over feature expansion**

- Discussion repeatedly returned to improving tagging quality and organizational structure rather than adding entirely new systems.
- Reasoning: Better tagging improves generation, filtering, discovery, and long-term scalability simultaneously.

---

## **3. Rejected Directions**

### **Rejected: Mobile desktop-style interaction model**

- Proposed:
    - Single tap selects
    - Secondary gesture opens preview
- Rejected because browsing is the dominant mobile use case.
- Replaced with:
    - Tap = preview
    - Explicit Select mode = selection

### **Rejected: Separate mobile library implementation**

- Proposed:
    - Dedicated mobile route/screen/state system
- Rejected because it would create duplicate logic.
- Replaced with:
    - Mobile-specific behavior layered on top of existing library architecture.

### **Rejected: Strong metadata-driven generation**

- Proposed:
    - Heavy weighting of project/theme/source relationships.
- Rejected because it created candidate saturation and repeated pools.
- Replaced with:
    - Content-driven scoring with lighter metadata influence.

### **Rejected: Floating mobile preview modal**

- Proposed:
    - Reuse desktop preview shell.
- Rejected because it wastes space and feels unnatural on phones.
- Replaced with:
    - Fullscreen viewer.

### **Rejected: Framed card-based mobile library**

- Proposed:
    - Traditional cards with borders and metadata.
- Rejected because images are the primary content.
- Replaced with:
    - Image-first tile grid.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **MBA is increasingly an image browser rather than a database manager**

The recent mobile decisions consistently move MBA toward a gallery-first experience where metadata exists primarily to support discovery, filtering, and generation.

### **Content relationships are more important than taxonomy purity**

The scoring discussions suggest that generation quality comes primarily from meaningful visual/content relationships rather than perfect metadata coverage.

### **Metadata should support generation, not dominate it**

Project/source/theme information is useful context but should rarely overpower visual/content similarity.

### **Mobile and desktop serve different primary jobs**

Desktop:

- management
- tagging
- editing
- bulk actions

Mobile:

- browsing
- inspiration
- discovery
- consumption

This distinction appears increasingly foundational.

### **MBA taxonomy should optimize for retrieval and generation, not completeness**

Repeated discussion suggests not every image needs every possible tag. The goal is useful retrieval and useful generation.

### **Visual density is a strategic objective**

MBA gains value when users can scan many images quickly. Mobile changes consistently favored more visible imagery and less interface chrome.

---

## **5. Current Reality / Implementation Notes**

### **Guided generation scoring has undergone a major refinement**

Implemented changes include:

- content-vs-metadata separation
- reduced metadata influence
- progressive overuse penalties
- stronger diversity penalties
- dominant-tag logic improvements

This appears more advanced than older generation documentation may imply.

### **Mobile MBA experience is substantially ahead of earlier plans**

Implemented:

- preview-first browsing
- fullscreen preview
- swipe navigation
- explicit select mode
- fullscreen library shell
- image-dominant cards
- pinch-to-zoom handling

### **Mobile library architecture remains unified**

Despite significant UX differences, mobile continues to reuse existing library systems rather than introducing separate data flows.

### **Mobile fullscreen shell became the actual implementation direction**

The previous desktop-inspired overlay approach was effectively abandoned after testing.

---

## **6. Open Questions**

### **Should Views become part of Filter?**

Discussion leaned toward:

- Filter containing saved views/presets
- Removing Views as a separate top-level control

No final decision yet.

### **Should mobile search become a temporary mode?**

Concept discussed:

- Search starts as a button
- Expands when activated
- Other controls temporarily disappear

No final decision.

### **Should mobile library use a 3-column image grid?**

User expressed preference that 3 columns may be superior.  
No final decision yet.

### **What is the final MBA taxonomy structure outside TT?**

The TT taxonomy is relatively mature.  
The broader MBA archive still has unresolved questions around:

- vintage decomposition
- mode/context axes
- archival classification

### **How much metadata should be required?**

An ongoing tension remains between:

- complete tagging
- practical tagging effort

No definitive rule established.

---

## **7. High-Value Quotes**

1. “The goal is coherent discovery, not deterministic selection.”
2. “Content relationships should drive generation; metadata should provide context.”
3. “MBA is primarily a visual archive.”
4. “Mobile is for browsing; desktop is for management.”
5. “The image should be the dominant element.”
6. “Tags exist to help retrieval and generation, not to achieve completeness.”
7. “Generation quality improves more from better relationships than from more metadata.”
8. “Preview-first is the natural mobile interaction model.”
9. “Visual density increases the value of the library.”
10. “Reuse existing architecture whenever possible instead of creating parallel mobile systems.”

## **8. Ignore**

The following discussion areas appear non-durable and should not be preserved:

- Individual mobile spacing tweaks
- Specific button placements
- Card border styling iterations
- Temporary CSS fixes
- Preview control visual polish
- Zoom-scroll bug investigations
- Candidate score screenshots
- Specific generation test runs
- One-off library layout experiments
- Individual UI refinement passes that did not produce architectural decisions

---

# **OA/MBA Continuity Extraction** - Chat "Plan Completeness Assessment"

## **1. Important Decisions**

### **Decision: Treat stability and scaling as the highest-priority work before major feature expansion.**

- Reasoning:
    - MBA already reached ~4,158 images.
    - Backup exports reached ~850 MB.
    - Large-library crashes and import failures became real constraints rather than theoretical concerns.
- Current status:
    - Partially implemented.
    - Crash investigation and backup hardening prompts created and prioritized first.

---

### **Decision: Use audit-first implementation prompts for non-trivial changes.**

- Reasoning:
    - Direct implementation prompts increasingly caused risk of regressions and architectural drift.
    - Audits allow inspection of current state before modifying behavior.
- Current status:
    - Implemented workflow.
    - Most new prompts follow audit → implementation pattern.

---

### **Decision: Local controls should be independent per surface.**

- Reasoning:
    - Wardrobe, Dashboard, Selector, Saved Outfits, and Fitpics have different purposes.
    - Shared global filter state creates coupling and confusing behavior.
- Current status:
    - Partially implemented.
    - Elevated to architectural principle.

---

### **Decision: Preserve shared concepts through shared helpers, not global stores.**

- Reasoning:
    - Shared logic is desirable.
    - Shared UI state is not.
    - Reuse should occur at the helper/primitive level.
- Current status:
    - Architectural direction established.
    - Implementation ongoing.

---

### **Decision: Accessory visibility must be separate from generation eligibility.**

- Reasoning:
    - Visual presentation and inventory existence are different concerns.
    - Hidden accessory indicators should not affect generation or inventory.
- Current status:
    - Not yet implemented.
    - Architecture defined.

---

### **Decision: Status and Collections are separate concepts.**

- Reasoning:
    - Existing “list” field mixes lifecycle state and organizational grouping.
    - Status is singular.
    - Collections are flexible user-defined groupings.
- Current status:
    - Planned.
    - Migration architecture defined.

---

### **Decision: Screenshot-style miniatures should replace simplistic saved previews.**

- Reasoning:
    - Saved outfits and boards should visually represent actual saved state.
    - Better support future documentation, sharing, and navigation.
- Current status:
    - Audit and implementation planned.

---

### **Decision: Use phased roadmap structure instead of flat backlog accumulation.**

- Reasoning:
    - Growing project complexity made flat lists difficult to prioritize.
    - Dependency-aware sequencing became necessary.
- Current status:
    - Implemented in roadmap structure.

---

## **2. Priority Changes**

### **Stability moved above feature development.**

- Previous direction:
    - Continue adding interaction and workflow features.
- New direction:
    - Fix large-library crashes.
    - Harden backup import/export.
    - Audit rendering and persistence systems.
- Reasoning:
    - Real-world library size exposed scaling limits.

---

### **Thumbnail/rendering work moved earlier.**

- Previous position:
    - Shared feature enhancement.
- New position:
    - Persistence/rendering infrastructure.
- Reasoning:
    - Touches save architecture, storage behavior, future exports, and compatibility.

---

### **Status + Collections moved later.**

- Previous assumption:
    - Medium-priority organizational feature.
- New position:
    - Late-stage migration.
- Reasoning:
    - Touches filtering, generation, bulk edit, metadata, import/export, and migration logic.

---

### **Ecosystem evolution separated from stabilization.**

- Previous:
    - Appeared as immediate next steps.
- New:
    - Dedicated post-stabilization roadmap area.
- Reasoning:
    - Relationship model and shared media architecture are ecosystem-level work, not feature work.

---

## **3. Rejected Directions**

### **Rejected: Shared/global filter state across surfaces.**

- Proposed:
    - Reuse filter state between Wardrobe, Dashboard, Selector, Saved Outfits, etc.
- Rejected because:
    - Creates coupling.
    - Produces surprising behavior.
    - Makes surfaces dependent on one another.
- Replaced with:
    - Shared helper logic + independent local state.

---

### **Rejected: Direct implementation without system audits.**

- Proposed:
    - Implement requested changes immediately.
- Rejected because:
    - Increased risk of regressions.
    - Encouraged duplicated logic.
- Replaced with:
    - Audit-first workflow.

---

### **Rejected: Treating accessory visibility as inventory state.**

- Proposed:
    - Visibility tied to generation/existence.
- Rejected because:
    - Mixes presentation and inventory concerns.
- Replaced with:
    - Independent visual visibility state.

---

### **Rejected: Continuing to overload the existing “list” concept.**

- Proposed:
    - Add more list-like wardrobe categories.
- Rejected because:
    - Mixed lifecycle and organization semantics.
- Replaced with:
    - Status + Collections model.

---

## **4. Important Conclusions Not Yet Reflected In Documentation**

### **Stable implementation contracts are becoming necessary.**

The project is reaching a scale where:

- filter semantics
- metadata semantics
- persistence guarantees
- sorting behavior
- generation guarantees

should be documented as contracts rather than rediscovered through prompts.

---

### **Prompt throughput is becoming a real project constraint.**

The primary bottleneck is increasingly:

- rate limits
- context size
- implementation coordination

rather than feature ideas.

This is driving the need for:

- stronger documentation
- reusable architectural principles
- more carefully scoped prompts

---

### **The project has shifted from feature accumulation to system refinement.**

Current work increasingly focuses on:

- architecture
- persistence
- scalability
- consistency
- interaction models

rather than adding new features.

This is a meaningful stage transition.

---

### **Shared helper architecture is preferred over shared UI state.**

This principle appears repeatedly but may not be explicitly documented as a core architectural rule.

---

### **Development workflow itself has become a project asset.**

Current workflow:

1. Use app
2. Identify friction
3. Prioritize
4. Convert to audit prompt
5. Implement narrowly
6. Re-test

This process is producing higher-quality outcomes than speculative planning.

---

## **5. Current Reality / Implementation Notes**

### **Roadmap structure is more mature than earlier documentation implied.**

Current roadmap now distinguishes:

- Stability / Scaling
- Core interaction stabilization
- UX redesign
- Mobile work
- Ecosystem evolution

This represents a meaningful organizational improvement.

---

### **Large-library support is no longer hypothetical.**

Evidence:

- MBA library ~4,158 images.
- Backup exports ~850 MB.
- Large-library crash investigation prioritized first.

---

### **Status + Collections is intentionally delayed.**

Current roadmap places it after:

- filtering stabilization
- sorting stabilization
- interaction stabilization

This reflects increased awareness of migration complexity.

---

### **Mobile work has become a dedicated workstream.**

A formal “Mobile Quick Wins” section now exists covering:

- OA mobile audit
- MBA mobile audit
- batch mobile fixes

This appears more structured than earlier planning.

---

### **Ecosystem evolution is now explicitly separated from stabilization work.**

The roadmap distinguishes:

- immediate stabilization  
    from
- long-term ecosystem architecture

which was less explicit previously.

---

## **6. Open Questions**

### **Relationship model structure**

- How should many-to-many relationships be represented?
- What becomes the canonical entity identifier model?

---

### **Shared media/reference model**

- What exact common shape should Fitpics and MBA references share?
- How much normalization is appropriate?

---

### **Saved miniature storage strategy**

- Store screenshots?
- Store derived thumbnails?
- Hybrid approach?

---

### **Long-term import/export architecture**

- Single-file backups?
- Split backups?
- Chunked backups?
- Future cloud compatibility?

---

### **Bulk editor convergence**

- How much logic should be shared between OA and MBA?
- What remains app-specific?

---

## **7. High-Value Quotes**

1. “Shared logic is desirable. Shared UI state is not.”
2. “Separate visual visibility from inventory existence.”
3. “Stability before feature expansion.”
4. “Prefer extraction over rewrites.”
5. “Audit first, implement second.”
6. “Use shared helpers, not global stores.”
7. “The project is transitioning from feature accumulation to system refinement.”
8. “Local state per surface.”
9. “Status represents lifecycle. Collections represent organization.”
10. “Real usage should drive prioritization.”

---

# Analysis

After reviewing the continuity extracts you uploaded, most of the major architectural themes are already present in your current documentation. The continuity files are valuable primarily because they reveal emphasis, sequencing, and a few recurring principles that are easy to lose over time.

# **OA/MBA Continuity Audit**

## **1. New Information**

### **A. The actual strategic progression is clearer than the documentation**

This sequence appeared repeatedly across multiple extracts:

```text
Asset Integrity
↓
Mobile Library Portability
↓
Portable Knowledge
↓
Multi-Entity MBA
↓
Entity Normalization
↓
Relationships
↓
Hub
```

The docs contain most of these concepts individually, but the continuity extracts repeatedly converged on this exact dependency chain.

Why it matters:

- It explains why Hub keeps getting deferred.
- It explains why entity normalization matters.
- It explains why portability is increasingly important.

---

### **B. Applications own workflows; entities outlive applications**

This appeared repeatedly but is not strongly emphasized everywhere.

The recurring principle:

```text
Applications = workflow layer

Entities = durable knowledge layer
```

Examples:

- Wardrobe Item
- Outfit
- Fitpic
- MBA Reference
- Board
- Text Node

should eventually outlive OA and MBA themselves.

This is arguably one of the strongest architectural themes across the continuity extracts.

---

### **C. Libraries vs Tools emerged as a major architectural model**

Repeated across multiple chats:

```text
Libraries store knowledge

Tools operate on knowledge
```

This is slightly different from the older:

```text
OA
MBA
Hub
```

mental model.

The newer thinking is:

```text
Libraries
↓
Tools
↓
Hub
```

where OA and MBA increasingly resemble tools.

---

### **D. Preservation became equal in importance to generation**

This appears repeatedly and is stronger than many current docs imply.

Not just:

- backups
- exports
- originals

but:

- ontology
- relationships
- provenance
- knowledge preservation

The continuity extracts consistently treat preservation as a first-class product concern.

---

### **E. Research vs Inspiration emerged as a foundational distinction**

This appears repeatedly in library discussions.

The important distinction:

```text
Research Library
≠
Inspiration Library
```

The split is based on purpose, not size.

This could become important later for:

- generation
- Hub
- library architecture
- weighting

---

### **F. MBA is evolving into a knowledge system**

Repeated across multiple continuity files.

Not merely:

```text
Image Archive
```

but increasingly:

```text
Knowledge Archive
```

containing:

- Images
- Texts
- References
- Boards
- Relationships
- Philosophy
- Research

The docs imply this, but the continuity extracts show it becoming a dominant theme.

---

## **2. Documentation Gaps**

### **Gap: Strategic Dependency Chain**

Suggested location:

- Core
- Roadmap

Reason:

The progression toward Hub is repeatedly discussed but not always captured as an explicit dependency graph.

---

### **Gap: Applications vs Entities Principle**

Suggested location:

- Core
- Technical Decisions

Reason:

This is becoming a foundational ecosystem rule.

---

### **Gap: Libraries vs Tools Model**

Suggested location:

- Core
- Hub documentation

Reason:

Appears repeatedly as the emerging ecosystem abstraction.

---

### **Gap: Research vs Inspiration Library Distinction**

Suggested location:

- Library architecture research
- Hub research

Reason:

Likely to affect future generation systems.

---

### **Gap: Preservation Equals Generation**

Suggested location:

- Core
- Asset Preservation

Reason:

Repeatedly emerged as project philosophy.

---

## **3. Contradictions**

### **Contradiction: Hub urgency**

Documentation often presents Hub as a future architectural milestone.

Continuity extracts repeatedly conclude:

```text
Hub is not the next step.
Hub prerequisites are the next step.
```

Recommended resolution:

Explicitly document that:

```text
Hub emerges from:
- normalized entities
- portable knowledge
- relationships
```

rather than being a standalone project.

---

### **Contradiction: Multi-entity architecture timing**

Some docs frame this as future work.

Continuity discussions increasingly treat it as:

```text
Near-term prerequisite work
```

Recommended resolution:

Move Multi-Entity MBA closer to active architectural planning.

---

### **Contradiction: OA as standalone application**

Documentation still occasionally reads as if OA remains the primary boundary.

Continuity discussions increasingly frame OA as:

```text
A specialized tool operating on future shared entities.
```

Recommended resolution:

No roadmap change required, but worth clarifying in architecture docs.

---

## **4. Repeated Themes**

### **Product Philosophy**

- Preservation matters as much as creation.
- Knowledge is more valuable than images.
- Curation quality is more important than collection size.
- Retrieval matters more than description.

---

### **Architecture**

- Applications own workflows.
- Entities outlive applications.
- Libraries store knowledge.
- Tools operate on knowledge.
- Hub coordinates relationships.
- Assets are canonical.
- Renders are derived.

---

### **UX**

- Browsing surfaces first.
- Control surfaces second.
- Consolidation beats expansion.
- Density is usually beneficial.
- Mobile and desktop serve different purposes.

---

### **Prioritization**

Repeated priority order:

```text
Integrity
↓
Portability
↓
Knowledge Preservation
↓
Entities
↓
Relationships
↓
Hub
```

---

### **Development Process**

- Audit first.
- Implement second.
- Prefer extraction over rewrites.
- Use shared helpers rather than shared UI state.
- Real usage drives prioritization.

---

## **5. Rejected Directions Worth Remembering**

### **Build Hub first**

Rejected because:

- Missing prerequisites.

Replaced with:

- Entities
- Relationships
- Portability

---

### **Merge OA and MBA**

Rejected because:

- Different workflows.

Replaced with:

- Independent tools
- Shared ecosystem

---

### **One giant library**

Rejected because:

- Signal degradation.

Replaced with:

- Multiple purpose-driven libraries

---

### **Cloud-first architecture**

Rejected because:

- Complexity too early.

Replaced with:

- Local-first architecture

---

### **Destructive media workflows**

Rejected because:

- Loss of provenance and future flexibility.

Replaced with:

- Original + derived render model

---

### **Taxonomy for description**

Rejected because:

- Poor retrieval value.

Replaced with:

- Taxonomy for retrieval

---

## **6. Current Reality vs Documentation**

### **Already completed but historically treated as future**

Based on continuity extracts:

- Asset Integrity
- Metadata Autosnapshots
- Original Reconnection
- Large Library Stabilization
- UUID Infrastructure
- Media Architecture Split

are substantially further along than older planning discussions assumed.

---

### **Multi-Entity MBA appears closer than documentation suggests**

Not implemented.

But conceptually it is already driving many architectural decisions.

---

### **Relationships have become more important than sync**

Many older discussions placed sync/cloud very high.

Continuity extracts repeatedly elevate:

```text
Relationships
```

above:

```text
Sync
```

as the more strategically important long-term capability.

---

## **7. Master Chat Continuity Notes**

These are the highest-value pieces of durable knowledge that repeatedly surfaced across the continuity extracts:

1. Applications own workflows. Entities outlive applications.
2. Libraries store knowledge. Tools operate on knowledge.
3. Hub should emerge from entities and relationships rather than being built first.
4. Preservation is now as important as generation.
5. Retrieval is more important than perfect description.
6. Curation quality is more important than collection size.
7. Research libraries and inspiration libraries serve fundamentally different purposes.
8. Asset Integrity → Portability → Entities → Relationships → Hub is the recurring architectural progression.
9. MBA is gradually evolving from a moodboard application into a personal knowledge system.
10. The project has entered a structural phase where architecture, preservation, portability, and relationships provide more leverage than most UI or workflow features.

Of all the uploaded continuity extracts, points 1, 3, 4, 8, and 9 appear most likely to remain relevant 12+ months from now.