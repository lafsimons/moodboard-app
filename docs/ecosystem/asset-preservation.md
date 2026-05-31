# Asset Preservation

## Purpose

Defines how media assets should be preserved,
tracked, reconnected, and evolved over time.

Assets are treated as long-lived canonical objects.
Renders, previews, crops, masks, and exports are treated as derived views.

## Core Principles

The system treats original assets as canonical.

Derived renders, previews, crops, masks,
exports, and generated representations
should be reproducible from canonical data.

Conceptually:

```text
Media Asset
 ├── Original image
 ├── Metadata
 ├── Crop
 ├── Rotation
 ├── Mask
 ├── Render style
 ├── Shadow settings
 └── Derived renders
```

### **Benefits**

#### **Non-destructive**

Always possible to:

- restore original
- change style
- improve mask
- re-render

#### **Future-proof**

When processing improves:

- regenerate entire library
- regenerate selected items
- compare old vs new

#### **Multiple render outputs**

Same source can generate:

- library thumbnail
- selector image
- outfit image
- export image
- miniature preview

without duplicating source data.

### Preview Preservation

Board previews and outfit previews should be treated
as disposable derived renders.

If a preview becomes invalid, missing, or outdated,
it should be regenerated from the canonical asset and metadata.

Previews should never become the primary stored representation.

## File Provenance

Assets should retain provenance information whenever available.

Examples:
- original filename
- source application
- import date
- source URL
- originating library
- linked source asset

Provenance should survive migrations,
exports, imports, and future hub integration.

## Original Reconnection

If an original asset becomes temporarily unavailable,
the system should attempt to reconnect it using
stored provenance and linkage metadata.

Examples:
- source asset id
- linkedSourceApp
- linkedSourceId
- original filename
- checksum/hash (future)

Reconnection should be preferred over duplication.

## Archival Preservation

The system should favor retaining original assets
even when derived representations are regenerated.

Deletion of originals should be deliberate and rare.

Long-term archives should prioritize:
- original fidelity
- provenance
- recoverability
over storage efficiency.

## Asset Identity

Each asset should have a stable identity independent of:

- filename
- storage location
- application
- derived renders

Examples:
- asset id
- source id
- checksum/hash (future)

References, links, and relationships should point to the asset identity rather than individual renders.

---

## MBA ↔ OA Shared Asset System (Future Architecture)

### **Long-term vision**

Shared media hub.

Not:

```text
MBA image
OA image
```

But:

```text
Asset
 ├── Original
 ├── Metadata
 ├── MBA references
 ├── OA references
 └── Derived renders
```

Example:

One original image.

MBA:

- tags
- boards
- inspiration metadata

OA:

- garment metadata
- crop
- mask
- render settings

Both point to same source.

### **Transitional version**

Before shared hub exists:

MBA:

- “Create OA Item”

Process:

- copy image
- create OA item
- store source linkage

Example:

```text
linkedSourceApp: MBA
linkedSourceId: xyz
```

Allows migration later.

