# Folder library and mobile access

Status: proposed implementation plan, 2026-09-13. No migration or cloud connection has been performed.

## Intended experience

Keep the existing moodboard app, including library browsing, metadata editing, board creation, and board layouts. Bring in tt-library's folder-based workflow: place images in folders, explicitly sync, and browse the resulting catalogue. Images, metadata, and boards should remain recoverable outside the browser. The first mobile milestone is browsing the same library and saved boards on a phone; desktop remains the editor initially.

Cloudflare R2 is the likely intended media service based on the earlier discussion and tt-library configuration. The exact account, bucket, and access configuration still need verification. Treat this personal library as private by default; do not copy tt-library's public access settings automatically.

## Later visual direction

The user also prefers tt-library's look and its presentation of different categories (2026-09-13). Use the actual tt-library interface as the reference for a later library UI pass, preserving MBA's metadata editing and board features. This is a presentation preference as well as a storage preference. Category-led browsing and the overall visual treatment should be revisited after the folder sync and mobile access foundation; they do not expand the immediate migration scope. Keep category metadata available to the browsing layer without committing to a new taxonomy yet.

## Existing foundations

- tt-library uses `public/images/`, editable sources under `metadata/`, and a generated `src/data/archive.json`; `sync:archive` rebuilds its catalogue.
- MBA currently persists through `src/lib/storage.js` and repository adapters. `src/repositories/syncRepository.js` exposes local bookkeeping, not remote replication.
- `src/lib/backupPackage.js` already supports a directory package with `manifest.json`, `items.ndjson`, `appState.json`, and `media/previews/`. Its asset policy is preview-only: it must not be presented as a complete originals backup.
- `src/repositories/boardsRepository.js` preserves item UUID references and board UUIDs alongside legacy IDs. Saved boards also have wrapper names and descriptions. Preserve both the wrapper and the layout.
- The current working board must be captured during migration even though it is not a saved board. Existing board normalization and deduplication are not a lossless archival format; retain raw exported records before normalization.
- `vite.config.js` sets cross-origin isolation headers in development and preview. Remote image delivery and board export need verification with the actual production headers.

Related history: the pinned task “Integrate tt-library R3 sync” under outfit-app, and `outfit-app/docs/ecosystem/library-architecture-proposal.md`. The older `sync-cloud-v1-outfitmoodboardapp.md` describes a broader Supabase/R2 direction; this plan proposes a smaller staged route and does not imply that either remote design is implemented.

## Storage boundaries

1. **Image folders:** originals, previews, and thumbnails already live in the folder library that will be synced (user clarification, 2026-09-13). Preserve the existing folder structure and index/sync these variants together. Reuse the supplied previews and thumbnails; generation is only a fallback for missing variants, not a required separate workflow. Never replace originals with previews.
2. **Catalogue:** portable item records with stable UUIDs, relative file paths, provenance, and file fingerprints. Folder sync updates file facts and discovers new files.
3. **Editable metadata:** app edits saved as portable records keyed by item UUID. Folder indexing cannot overwrite tags, notes, or other user-edited fields. Initially keep external source metadata and app overrides distinct; an explicit cleared value must override an old source value too.
4. **Boards:** portable records preserving names, descriptions, layout, item references, and existing fields. Capture the desktop working draft separately; phone viewing must not overwrite it.
5. **Browser storage:** continue using the current local persistence during migration. Only call it a disposable cache once a complete restore from durable storage is verified.

## Backup direction

User clarification, 2026-09-13: routine app backups should focus on metadata and boards. Originals, previews, and thumbnails are already ordinary local files mirrored to cloud storage, so the app should no longer routinely package image binaries into backups.

- Back up catalogue identities, relative paths and variant associations, source metadata, app edits, tags, complete saved boards, and the working draft. Include library/schema information needed to restore the records and reconnect media.
- Keep versioned metadata/board snapshots so mistakes can be undone; syncing the latest state is not a substitute for that history.
- Restore app records from these small backups and reconnect to the local or cloud media library. Do not require another full image import.
- The existing media-heavy backup/export and recovery UI becomes a migration/legacy concern. Retire it from the normal workflow after the new restore path is verified; preserve the ability to read old backups during transition.
- The initial migration export remains necessary for any records or image variants that currently exist only in browser storage. Verify those assets have reached the folder library before treating the browser copy as disposable.

Local and cloud image copies remove the need for routine image backups inside this app. They are not automatically independent historical backups: a sync that propagates accidental deletion can remove both copies. Missing-file handling stays non-destructive, and any media deletion/version retention policy must be explicit.

Proposed durable directory:

```text
Library/
  manifest.json
  images/                    # existing structure, including previews/thumbnails
  metadata/items.ndjson      # catalogue identity and source metadata
  metadata/edits.ndjson      # app-owned field overrides
  boards/saved.ndjson        # complete saved-board records
  boards/desktop-draft.json
  generated/catalog.json     # replaceable browsing dataset
```

This layout is illustrative, not an instruction to reorganize the existing media folders. Inspect their actual structure and naming to map originals, previews, and thumbnails to the same item. Do not index each variant as a separate library item or assume filename matching is unambiguous.

JSON/NDJSON preserve the current richer records without prematurely flattening them to CSV. CSV can remain an external editing/import surface with an explicit field mapping later. A desktop write mechanism is required for saving durable edits: a local service or a supported writable-directory workflow. Browser-local saves must visibly distinguish pending durable saves from completed ones.

## Manual sync behavior

- Present one Sync library action, with distinct scan/save/upload stages and a useful completion or error report.
- Preserve existing UUIDs and legacy references. A relative path is a location, not the permanent identity.
- Recognize unchanged files; match moved files using persisted identity and fingerprints only when unambiguous. Identical file bytes can belong to distinct intentional records; do not merge them automatically.
- Sync existing preview and thumbnail files alongside originals, preserving their variant associations. Report missing or ambiguous associations rather than guessing. Use thumbnails for the grid and previews for browsing where available.
- Flag missing files without removing metadata or board placements. Folder absence is not an instruction to delete library records.
- Preserve in-app edits on every catalogue rebuild. Unknown record fields must survive migration and round trips.
- Upload media before publishing the catalogue revision that references it. Publish a complete revision only after all required objects are available, retaining the previous usable revision on failure.
- Keep image payload processing bounded, reusing the existing chunked export lessons instead of loading the entire library into memory.

## Implementation sequence

### 1. Establish a recoverable baseline

Use the running browser library or an explicit user-selected export, not repository sample data. Export item records, saved boards, the working board, metadata, and available previews. Inventory originals separately. Produce counts and lists of unresolved media/references, and verify a restore in isolated storage. Keep the current browser library intact.

Next code deliverable: a non-destructive migration reader and report for the existing directory backup format. It should inventory records and media, preserve raw app state, and flag duplicate/missing identities and unresolved board references. It must not run the destructive backup replacement path.

### 2. Build folder-backed desktop sync

Implement stable file-to-item identity, generated catalogue output, durable metadata edits, and complete board save/load. Connect through the existing repository boundaries so existing editor behavior remains intact. Establish the desktop save mechanism before claiming that edits are stored outside the browser.

### 3. Publish a private mobile-readable revision

Verify the existing cloud setup without exposing credentials. Add authenticated access to catalogue and media, a desktop-only publishing path, and a deployed mobile reader using the same library/board UI where practical. Keep storage credentials out of frontend code. Publishing images alone is insufficient: the same revision must include effective metadata and saved boards.

### 4. Add editing from the phone

After mobile reading works, add authenticated writes with revision checks and explicit conflict handling. A stale phone must not overwrite newer desktop edits through whole-library last-write-wins. This step is required before describing the system as two-way device sync.

## Acceptance checks

- A fresh browser can load the published library, search its metadata, and view saved board layouts without importing a large backup manually.
- Existing desktop tags, notes, board names, placements, and the working draft survive migration.
- Adding a folder image and syncing makes it available on the phone.
- Syncing twice creates no duplicate records; an unambiguous move keeps board links intact.
- Rebuilding the catalogue preserves app edits, including intentionally cleared fields.
- Missing files remain visible as unresolved records and do not silently delete board content.
- A failed upload leaves the previous complete cloud revision usable.
- Actual remote images work in library viewing and board rendering/export with production headers.
- Restoring from the durable package reproduces metadata and boards. Missing originals are reported honestly rather than inferred from available previews.
- Routine backups contain metadata, boards, and media links without image binaries; restoring one reconnects to existing media files and preserves variant associations.

## Inputs still needed during implementation

- The actual active browser library or a current directory export, and the original image root(s).
- Confirmation of the intended cloud account/bucket through existing configuration, plus a private access and app hosting setup.
- Choice of desktop durable-save mechanism after checking the current browser and deployment workflow.

These do not block building the migration reader/report against local fixtures. They do block claiming that the real library is migrated or available on the phone.
