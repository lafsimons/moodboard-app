# Changelog

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