---
aliases:
  - changelog
---
# Changelog


## MBA 03.06.26
Large scalable package import was hardened for TT-scale libraries. Preview assets are now imported lazily and written in chunks, preventing 1GB preview sets from hanging import or aborting IndexedDB transactions.

## MBA 02.06.26
### Original Reconnection v2

Completed the second-generation Original Recovery system and validated it through a full real-world export/import recovery cycle.

The system can now reconnect original source files to imported MBA items using preserved provenance metadata, namespace-aware matching, recovery reports, metadata enrichment, and controlled recovery workflows.

#### Key Improvements

##### Namespace-Aware Provenance Recovery

Implemented provenance backfill and recovery support for legacy imported libraries.

Added support for:

- `moodboard`
- `wishlist`
- `vintage`

legacy image archives.

Recovery can now use:

- source namespace
- relative source paths
- filename aliases
- original filenames

to identify original source files after export/import cycles.

##### Controlled Vintage Recovery

Added a dedicated vintage recovery path for legacy `images-NNN` items.

Features:

- vintage namespace detection
- legacy filename alias support
- namespace-aware candidate matching
- safe auto-approval of verified vintage matches
- conflict detection and reporting

This resolved the largest remaining unresolved recovery bucket.

##### Metadata Enrichment

Added linked-original metadata enrichment.

For connected originals, MBA can now populate missing provenance metadata including:

- original filename
- file size
- image dimensions
- MIME type
- recovery provenance fields

without overwriting existing metadata.

This creates a significantly stronger recovery baseline for future reconnect operations.

##### Recovery Reporting & Validation

Recovery reports now provide:

- ready
- needs review
- ambiguous
- no match
- plausible candidate statistics

allowing recovery decisions to be audited and validated before applying changes.

##### Portable Provenance Preservation

Extended backup export/import workflows to preserve recovery-critical provenance metadata.

Preserved fields include:

- source namespaces
- relative source paths
- filename aliases
- original filenames
- source metadata

This allows imported libraries to retain enough information for large-scale original reconnection without requiring manual relinking.

##### Provenance Backfill

Implemented controlled provenance backfill workflows for legacy libraries with incomplete source metadata.

Backfill can restore:

- source namespaces
- relative source paths
- filename aliases

from known legacy archive structures without modifying media ownership or item identities.

This enabled recovery of large groups of historical imports that previously lacked sufficient provenance for automated matching.

#### Validation Results

Real-world validation was performed on the production MBA library.

Results:

- ~2,044 original files successfully reconnected
- moodboard archive recovered
- wishlist archive recovered
- vintage archive recovered
- metadata enrichment completed
- export/import cycle verified
- post-import recovery verified

Final recovery scan after import:

- 0 ready recoveries remaining
- only a small number of edge-case unresolved files
- library successfully restored from exported data and originals folder

#### Large-Scale Validation

The recovery system was validated against a real production library containing more than 2,000 linked originals.

Validation included:

- fresh export
- clean import
- original reconnection
- metadata enrichment
- repeated recovery scans
- provenance verification

This confirmed that the recovery architecture functions correctly at real-library scale rather than only in synthetic test scenarios.

#### Architectural Outcome

MBA libraries are now portable and recoverable.

A library can be exported, imported onto another installation, and reconnected to its original source archive while preserving provenance and metadata.

This establishes the first complete end-to-end portability workflow for MBA.

Verified workflow:

Export MBA Library  
→ Import MBA Library  
→ Select Originals Folder  
→ Reconnect Originals  
→ Restore Source Metadata

This significantly reduces dependency on a single local database state and establishes the foundation for future portable-library, Hub, and multi-entity workflows.

#### Known Remaining Improvements

- Recovery apply throughput remains relatively slow on very large libraries (~700 ms/item observed during large reconnect batches)
- Recovery resumability UX can be improved
- Remaining unresolved files are edge-case naming and provenance outliers
- Future work may add direct-path reconnect optimization and stronger original-path preservation
- knownOriginalRelativePath / direct-path reconnect workflow audit

## OA 01.06.26
### **Status & Collections**

Replaced the legacy wardrobe list model with separate **Status** and **Collections** fields.

**Status** now represents an item’s lifecycle state (`Interested`, `Wishlist`, `Incoming`, `Wardrobe`, `Selling`, `Sold`) while **Collections** provide user-defined organizational grouping independent of lifecycle. Collections support multi-select assignment, filtering, editing, and outfit generation workflows.

This change removes the previous coupling between item organization and wardrobe state, allowing users to maintain custom collections without affecting lifecycle tracking.

Additional changes:

- Added bulk status editing.
- Added bulk collection management (add, remove, clear).
- Added status and collection filters throughout the wardrobe.
- Added generation-aware collection support.
- Preserved migration compatibility with legacy `list` values.
- Synchronized legacy data during transition to avoid breaking existing libraries.

**Rationale**

- Separate lifecycle management from organization.
- Reduce hardcoded wardrobe modes.
- Enable flexible user-defined grouping.
- Establish a foundation for future multi-library and hub-based organization.

### **Wardrobe Export Improvements**

Expanded wardrobe export capabilities to better support library documentation, archival workflows, and large collections.

New functionality includes:

- Dedicated wardrobe image export mode.
- Multiple export ordering options.
- Improved grid layout consistency and spacing.
- Better handling of large wardrobes during export.
- Optional labels and configurable export settings.
- High-quality full-library image export for documentation and offline reference.

Export generation was refined to produce more predictable and readable outputs across different wardrobe sizes while giving users greater control over presentation and organization.

**Rationale**

- Improve wardrobe archiving and backup workflows.
- Create cleaner visual overviews of large collections.
- Support external documentation and research use cases.
- Enable high-quality exports suitable for long-term reference and sharing.
- Reduce manual work required to create wardrobe overview sheets.

---

## MBA 01.06.26: Asset Integrity Hardening

### Problem

Imported blob-backed media could become detached from items during metadata-only edits such as renaming, tagging, or other non-media updates.

The root cause was a coupling between editable metadata and media ownership. In some save paths, item identity and media references could be regenerated or migrated during ordinary metadata edits, creating conditions where preview assets, thumbnails, or original blobs became disconnected from their items.

Additionally, legacy libraries could contain stale preview references. These broken references could be carried forward into newly generated backup packages, causing import failures due to metadata pointing to media files that were not actually present in the package.

### Solution

Implemented a strict separation between:

- itemUuid → stable entity identity
- id → immutable storage/media ownership key
- name → user-facing editable title

Metadata-only saves now preserve existing media ownership and blob-backed assets without regenerating or migrating media references.

Storage save behavior was refactored to explicitly distinguish:

- New item creation
- Metadata-only updates
- Media replacement
- Media removal

Media replacement and cleanup now occur only during explicit image operations rather than ordinary metadata edits.

### Export Validation & Repair

Backup package generation now validates media references before serialization.

During export:

- Stale preview package paths are removed
- Preview assets are verified before being written into package metadata
- Missing previews are regenerated from original media when possible
- Unrecoverable preview references are omitted from exported metadata
- Export warnings distinguish repaired media from omitted broken media

This prevents newly generated backup packages from containing impossible media references that would later fail during import.

### Validation

Added regression coverage for:

- Imported blob-backed item renames
- Rename + tag edit flows
- Repeated metadata-only saves
- Explicit image replacement
- Explicit image removal
- Preview ownership stability
- Stale preview package-path cleanup
- Export repair from original media
- Export handling of missing preview assets

Verified through:

- Full test suite
- Production build
- Real-library export/import validation
- Detection and reporting of legacy broken media records

### Result

Asset integrity is now significantly more robust.

Metadata-only edits no longer risk media corruption, imported blob-backed assets remain stable across repeated saves, and backup packages are protected against stale or impossible media references inherited from older library states.

---

## MBA 01.06.26: Metadata Autosnapshot Safety System

### Motivation

MBA previously relied on manual backups and export packages for recovery. While media preservation and backup integrity had been significantly improved, metadata work remained vulnerable between full backups.

This work introduces a lightweight metadata recovery layer focused on protecting:

- Tags and taxonomy work
- Metadata enrichment
- Board organization
- App configuration
- Ontology development
- General library curation

without duplicating image/media data.

### Metadata Snapshots

Implemented a dedicated IndexedDB metadataSnapshots store.

Snapshots contain:

- Item metadata
- Board metadata
- Relevant app state
- Snapshot metadata and provenance

Snapshots explicitly exclude:

- Preview blobs
- Thumbnail blobs
- Original blobs
- Package media
- Inline image payloads

Snapshots are stored as complete metadata states rather than incremental diffs, enabling future recovery workflows from a single snapshot.

### Dirty-State Tracking

Added separate tracking for:

- Changes since last metadata snapshot
- Changes since last full backup/export

The system tracks changed item sets and metadata activity independently from media operations.

### Automatic Snapshot Creation

Metadata snapshots are now created automatically:

- Every 20 minutes when metadata is dirty
- When the tab becomes hidden
- Before high-risk operations including:
  - Import
  - Bulk edit
  - Delete

Snapshot creation is serialized to prevent overlapping writes during heavy editing sessions.

### Retention

Implemented rolling retention:

- Retains the most recent 40 snapshots
- Automatically prunes older entries
- Keeps storage growth bounded and predictable

### Archive Status Integration

Expanded Archive Status with metadata safety reporting:

- Last metadata snapshot
- Snapshot reason
- Dirty state since snapshot
- Dirty state since full backup
- Changed item count since backup
- Snapshot health status
- Metadata export provenance
- Backup provenance

### Local Safety State

Introduced a dedicated local-only safety layer:

- Snapshot bookkeeping
- Dirty tracking
- Snapshot health state

This data persists locally across reloads but is intentionally excluded from portable backup formats.

### Import Durability Hardening

While implementing autosnapshots, several persistence issues were discovered and resolved:

- Import commit ordering race conditions
- Local state overwrite scenarios during import
- Bootstrap failures caused by missing snapshot stores
- IndexedDB schema migration edge cases
- Startup fallback paths incorrectly reverting to defaults

Library restoration now remains functional even if snapshot metadata is unavailable.

### Provenance Improvements

Archive reporting was refined to distinguish between:

- Full backup exports
- Metadata-only exports
- Backup imports
- Import source/format information

Metadata exports no longer reset full-backup recovery baselines, preserving the distinction between lightweight metadata exports and true backup events.

### Result

The recovery hierarchy is now:

text Live Library     ↓ Metadata Autosnapshots     ↓ Full Backup Exports     ↓ Scalable Backup Packages     ↓ External Backup Storage 

This provides continuous protection for metadata work while preserving the existing asset-integrity and backup architecture.

---

## MBA 01.06.26: Original Reconnection v1

**Source Provenance & Reconnection Preparation**

- Introduced `sourceFilenameAliases`.
- Standardized provenance around existing `source*` fields.
- Added filename alias normalization and preservation.
- Added provenance-aware matching helpers.
- Established additive filename history support without changing media ownership.
- Preserved provenance through:
    - metadata saves
    - backups
    - package export/import
    - metadata autosnapshots
- Prepared future original reconnection, dedupe, migration, and reconciliation workflows.
- Explicitly separated:
    - display title (`name`)
    - source provenance (`sourceOriginalFilename`)
    - render metadata (`originalFilename`)
    - stable identity (`itemUuid`)

Result:

```text
Source provenance became a first-class recovery layer,
allowing future original-file matching without introducing
asset identity migrations, perceptual hashing, or storage rewrites.
```

### **Motivation**

MBA intentionally treats previews as the canonical portable render asset while originals remain optional archival attachments.

This architecture provides strong portability and backup behavior, but previously there was no structured way to restore missing originals after:

- backup package import
- device migration
- local media loss
- original-file cleanup
- archival recovery workflows

The goal of Original Reconnection v1 was to introduce a safe recovery path without changing preview-first behavior, storage ownership, identity contracts, or backup architecture.

### **Architecture**

Implemented a dedicated Original Reconnection domain layer.

Responsibilities are separated into:

- candidate metadata extraction
- provenance-based matching
- confidence classification
- repository-level reconnect transactions
- original availability detection
- missing-original handling

The implementation reuses the existing provenance architecture:

- `itemUuid`
- `sourceOriginalFilename`
- `sourceFilenameAliases`
- `sourceFileSize`
- `sourceImageWidth`
- `sourceImageHeight`
- `sourceLastModified`
- `relinkStatus`

No new asset identity model was introduced.

### **Item-First Reconnection Workflow**

Added a conservative per-item reconnection flow.

Workflow:

```text
Missing Original
    ↓
Select File
    ↓
Match & Classify
    ↓
Review
    ↓
Confirm
    ↓
Attach Original
```

Users can now:

- reconnect a missing original
- replace an existing original
- review candidate confidence before linking
- explicitly override low-confidence matches when desired

No automatic relinking occurs.

### **Confidence-Based Matching**

Introduced provenance-driven matching using:

- canonical filenames
- filename aliases
- file size
- dimensions
- MIME type
- last modified metadata

Match results are classified as:

- exact
- strong
- possible
- weak
- none

This provides a future foundation for larger-scale reconnection workflows while remaining completely user-controlled in v1.

### **Storage Ownership**

Original Reconnection v1 preserves all existing ownership rules.

No storage migrations were introduced.

Ownership remains:

```text
Item Metadata
    ↓
itemUuid
    ↓
Original Blob

Item Metadata
    ↓
itemId
    ↓
Preview / Thumbnail Assets
```

Successful reconnection restores the original blob under the existing `itemUuid`.

Previews and thumbnails remain untouched.

### **Recovery Behavior**

Added explicit original-state handling:

- original preserved
- original missing
- original linked

If an original becomes unavailable:

- preview rendering continues normally
- the item degrades gracefully to preview-only mode
- missing state can be surfaced and repaired later

Normal browsing never depends on original availability.

### **Backup Compatibility**

Original Reconnection intentionally preserves the existing backup philosophy.

Package backups remain:

```text
Metadata
+
Previews
+
Thumbnails
```

Originals remain excluded.

After package export/import:

- previews remain fully functional
- provenance metadata survives
- originals return to a reconnectable state

This behavior is intentional and validates the preview-first architecture.

### **Safety Integration**

Original reconnection is now treated as a recovery-sensitive operation.

Before reconnection or replacement:

- metadata autosnapshot integration is invoked
- users are warned if snapshot creation fails
- reconnection remains user-controlled

This aligns original recovery with the broader metadata safety architecture.

### **Result**

MBA now supports a complete original recovery lifecycle:

```text
Import
    ↓
Preview-Only Library
    ↓
Reconnect Original
    ↓
Original Preserved
    ↓
Backup Package Export
    ↓
Backup Package Import
    ↓
Reconnectable Original State
```

This establishes the first formal original-media recovery workflow while preserving:

- preview-first rendering
- stable identities
- additive migrations
- local-first architecture
- future OA/MBA shared-media evolution
- future sync/cloud compatibility

---

# OA + MBA — Stability & Scaling

## Large-Library Stabilization

Completed the transition from prototype-scale assumptions toward stable multi-thousand-image library behavior.

Implemented:

- Metadata-first startup
- Metadata-only runtime state
- Out-of-line media storage
- Lazy media resolution
- Removal of post-startup full hydration
- Batched delete operations
- Persistence deduplication
- Virtualization stabilization
- Backup hardening
- Recovery tooling

Resolved:

- Browser crashes
- Corrupted startup states
- Runaway memory usage
- Oversized persistence writes
- Import/export instability
- Delete-time crashes
- Virtualization reload failures

---

## Core Interaction Improvements

Implemented:

- Fixed selector exclude behavior triggering unnecessary generation
- Disabled automatic selector opening on desktop item click
- Outfit single-click selects
- Outfit double-click opens preview
- Added Unlock All Slots control
- Persisted editor window positions
- Persisted Add Images window positions

---

## UI Refinements

Implemented:

- Removed selection and click shadows
- Improved preview equip/unequip behavior
- Added favorite heart actions
- Simplified Dashboard search and filter layout
- Improved Manage panel layouts
- Improved toolbar stability during selection workflows

---

# MBA — Interaction & Layout Stabilization

## Navigation & Window Management

Implemented:

- Removed Back to Library action from Boards
- Added toggle-close behavior for Boards
- Added toggle-close behavior for Dashboard
- Added toggle-close behavior for Editor
- Added toggle-close behavior for Library
- Persisted editor window positions
- Persisted Add Images window positions

## Filters & Management

Implemented:

- Moved Manage Tags into Filter panel
- Simplified Manage actions
- Improved filter interaction flow
- Improved panel attachment behavior

## Item Editor Improvements

Implemented:

- Reorganized editor layout
- Moved Favorite and Show on Cards controls into primary metadata area
- Reduced image section width
- Unified image control styling
- Improved image action hierarchy
- Added adjustable editor width
- Reduced spacing and oversized gaps
- Improved control alignment

## Visual Polish

Implemented:

- More subtle favorite heart presentation
- Hover-only favorite affordance
- Improved technical-control hierarchy
- Improved destructive action separation
- Improved overall editor density and consistency

---

# Implemented Foundations

## OA Foundations

Implemented:

- Explicit select/manage mode
- Bulk editing and batch operations
- Preview overlay system
- Additive itemUuid support
- Additive provenance metadata
- images.* normalization
- Normalized backup import
- Persisted wardrobe and library filters
- Compact generation Lists controls

## MBA Foundations

Implemented:

- Nested freeform tagging
- Board canvas workflows
- Multi-select interactions
- Preview overlay
- Additive itemUuid support
- Additive referenceItemUuid support
- Rich import metadata pipeline
- Portable-core preservation updates
- Backup normalization and import preparation

## Shared Identity & Sync Preparation

Implemented:
- Additive itemUuid migration
- Additive outfitItemUuids
- Migration-safe UUID backfill
- Source identity metadata
- Additive outfitUuid
- Additive boardUuid

Notes:
- Legacy id compatibility preserved
- UUID sidecars introduced additively
- Runtime UUID migration deferred

## Shared Ecosystem Foundations

Implemented:

- Additive relationship UUID sidecars
- Shared image contract direction
- Additive provenance and import metadata
- Portable backup preparation
- Compatibility-first migrations
- Local-first IndexedDB persistence
- Metadata/media architecture split
- Dashboard architecture
- Filter architecture redesign
- Local collection-controls architecture
- Initial mobile stabilization passes
- Repository-boundary architecture

## Recovery & Reliability

Implemented:

- Safe Mode recovery surface
- Metadata-only recovery workflows
- Metadata-only backup export
- Recovery-oriented backup tooling
- Validation-before-replacement imports
- Oversized import protection

## Bulk Delete & Persistence Improvements

Implemented:

- Batched item deletion
- Batched media cleanup
- Shared ownership cleanup checks
- Persistence deduplication
- Reduced serialization overhead
- Reduced delete-time persistence amplification

## Virtualization Stabilization

Implemented:

- Improved startup measurement timing
- Post-layout remeasurement
- ResizeObserver integration
- Visibility-triggered remeasurement
- Virtualization math extraction and testing

Result:

- Stable library virtualization
- Stable lazy loading
- Improved reload reliability

## Architectural Refactoring

Extracted modules:

- itemModel
- imagePresentation
- appStateModel
- selectionModel
- bulkEdit
- importMetadata
- backupImport

Extracted components:

- ConfirmationDialog
- PreviewOverlay
- WardrobeSelectionBar

## Large-Library Runtime Architecture

Completed:

- Metadata-first startup
- Metadata-only runtime state
- Out-of-line media storage
- Lazy media resolution
- Batched delete cleanup
- Persistence deduplication
- Virtualization stabilization
- Backup hardening
- Safe Mode recovery

The current architecture is designed to support multi-thousand-image personal libraries before sync and cloud rollout.