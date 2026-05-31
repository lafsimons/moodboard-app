# Future Concepts

## Human-Readable Archive / Markdown Export

Long-term archival export format for MBA (and potentially OA).

Goal:  
Ensure that all metadata, tagging work, relationships, and organizational effort remain accessible even if the application, codebase, database, or hosting platform no longer exists.

Concept:  
Add an additional export format alongside the existing JSON backup system.

The export generates a human-readable archive containing:

- Original images
- One Markdown file per image/reference
- Machine-readable JSON backup
- Optional relationship data between MBA and OA entities

Example structure:

```text
MBA Archive Export/
├─ images/
├─ metadata/
│  ├─ mba_ref_000001.md
│  ├─ mba_ref_000002.md
│  └─ ...
├─ library.json
├─ manifest.json
└─ index.md
```

Each Markdown file contains:

- Stable ID
- Original filename
- Favorite status
- Tags
- Import metadata
- Read-only image metadata
- Notes/descriptions (if added in the future)
- Linked OA items, outfits, boards, or references (future)

Example:

```yaml
---
id: mba_ref_000001
originalFilename: images-014.jpg
favorite: true

tags:
  - source/vintage
  - origin/eu/france
  - garment/jacket
  - material/moleskin

linkedItems:
  - oa_item_203

linkedBoards:
  - mba_board_017
---
```

Benefits:

- Human-readable without the app
- Searchable in any text editor
- Importable into Obsidian or other knowledge-management tools
- Easy to parse with scripts or future AI systems
- Preserves years of tagging and research work independently from the application
- Acts as a second layer of backup beyond JSON/database exports

Future extension:

If OA and MBA gain stable cross-app relationships, the export can include Obsidian-style wiki links and reference graphs between:

- MBA references
- MBA boards
- OA wardrobe items
- OA outfits

This would allow the archive to function as both a backup and a browsable knowledge graph.

Not required for current development, but valuable as a long-term preservation and portability feature.

## Text & Philosophy Nodes

Core concept:

* Texts/interviews/philosophy excerpts are stored as first-class entries in MBA, not just notes.
* They participate in the same generation/retrieval system as images through shared tags:
    * lineage/*
    * reference/*
    * era/*
    * origin/*
    * etc.

Example:
A T.T philosophy entry could contain:

* quote preview/snippet
* full translated text
* source metadata
* linked archival photos
* linked runway/editorial images
* linked personal fitpics
* linked garments/material references
* linked notes

Generation idea:

* During board generation, relevant quotes/excerpts can appear contextually alongside images.
* Clicking the quote expands/open the full text entry.
* Texts and images can surface each other bidirectionally.

Goal:

* MBA becomes less “Pinterest/moodboard” and more:
    * interconnected visual archive
    * material culture/philosophy system
    * aesthetic knowledge graph

Important philosophy:

* The system is not only about visual similarity.
* It connects:
    * images
    * philosophy
    * historical lineage
    * material references
    * personal interpretation
    * mood/context

Potential UI direction:

* subtle quote card appears inside generation
* expandable side panel/modal
* connected references underneath
* “related images / related texts / related fits”
* lightweight, contextual, non-dominant presentation

Key idea:
Images explain texts, and texts explain images.

---

## OA Item Editor / Image Editing

### **Core principle**

Move from a destructive “background removal tool” to a non-destructive image editing workflow.

Current:

- import image
- remove background
- save final result

Target:

- import image
- preserve original
- store edits separately
- generate render from original + edit settings

Store original images as immutable assets and persist edits as metadata rather than overwriting source files.

### **Editing controls**

#### **Background**

- Transparent
- Off-white
- Light grey

#### **Render Style**

- Catalog
- Natural
- Editorial
- High Contrast

#### **Shadow**

- None
- Soft
- Medium
- Strong

#### **Future**

- Edge softness
- Preserve dark detail
- Warmth
- Texture contrast
- Background color picker

### **Mask editing**

Future:

- Add to mask brush
- Remove from mask brush
- Refine edge
- Restore removed area
- Re-run segmentation

### **Preview modes**

Important because segmentation issues are often invisible on one background:

- Transparent
- Light background
- Dark background
- Outfit preview

---

## Import Workspace (possible future)

The Asset Inbox acts as a staging area before content becomes application-specific records.

Before assets become OA or MBA records.

Flow:

```text
Import
    ↓
Asset Inbox
    ↓
Assign to:
- OA
- MBA
- Both
```

Possible actions:

- duplicate detection
- crop
- segmentation
- tag assignment
- batch processing

This could eventually become the shared entry point for the whole ecosystem.

