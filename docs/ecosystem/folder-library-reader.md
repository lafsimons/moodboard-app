# Folder library reader (Stage 1A)

This Node-only reader inspects an existing version-1 folder export. It does not
import into IndexedDB, modify files, generate thumbnails, or connect the app UI.

```sh
npm run library:check
npm run library:check -- "/absolute/path/to/library"
```

The default is `library-exports/moodboard-library-2026-09-21`, resolved relative to
the project rather than the caller's working directory. An explicit path is
resolved from the caller's working directory. Invalid input exits with status 1;
a readable library with warnings exits with status 0 and prints warning counts.

## Reader contract

`readFolderLibrary(root)` in `src/lib/folderLibraryReader.node.js` returns:

- `root`: canonical library directory.
- `manifest`, `items`, `appState`: parsed records without field removal or
  normalization. After manual sync, `items` comes from the atomic catalogue and
  `manifest` has updated inventory/folder counts; `baseManifest` retains the original
  export manifest. Item `sourceMetadata` retains the complete original record.
- `assets`: separate resolved entries containing item identity, variant, original
  descriptor, absolute path, existence, regular-file status, and actual byte size.
  The main three variants are `image`, `image-thumbs`, and `image-thumbs-mobile`.
  Registered preserved previews and unknown asset variants are retained too.
- `inventory`: record and registered variant counts, including originals,
  preview fallbacks, and metadata-only records.
- `availableAssets`: counts of regular files for the three rendering variants.
- `warnings`: `{ code, message, ...context }` records with item identity, variant,
  relative path, sizes, or board placement where applicable.

This is an internal filesystem snapshot, **not a browser API response**. Both
resolved paths and raw export provenance can contain absolute local paths. A
future serving layer must deliberately build a client-safe response and expose
only registered media via URLs. This reader does not provide that server.

Required-file/schema errors, conflicting or duplicate identities, manifest count
mismatches, and unsafe paths throw. Missing media, size mismatches, unavailable
originals, metadata-only records, and stale/unresolved/conflicting board links
produce warnings while keeping the records. Board checking covers the working
board and saved boards in `savedOutfits`.

Media is checked with filesystem metadata only, without decoding or hashing.
Raw historical `sourcePath` and nested source image paths are provenance and are
not followed. Registered asset paths and required files are confined to the
canonical root, including existing/dangling symlinks. This is a point-in-time
check; a future media server must revalidate paths when serving files.

## Initial real-library result

1,922 records; 1,895 originals; 26 preview fallbacks; one metadata-only record;
1,921 desktop thumbnails and 1,921 mobile thumbnails. All registered render
assets are present with the recorded sizes. The 29 warnings are 26 unresolved
originals, one absent main image, and its two absent thumbnails. No unresolved
board references were reported.

Stages 1B and 1C are described below.

## Stage 1B — Local read-only browser

Run `npm run dev`, then choose **Open folder library** from the normal library
controls, or open `http://127.0.0.1:5173/?library=folder` when serving on that port.
The existing browser editor remains the default URL. Returning to it performs a
normal page navigation; folder browsing does not import or replace its data.

The folder screen supports name/description/tag search, multiple hierarchical tag
filters (all or any), folder filtering, sorting, paged thumbnails, and a metadata
preview with links to available original images. It uses the app's existing visual
tokens and shared sorting/tag utilities. It is a separate read-only component,
not the editor with hidden buttons. The legacy editor/persistence modules are
lazy-loaded only outside folder mode. Filters, pagination, and selection are
session memory only; refresh resets them.

`Reload library` rereads the export catalogue. It does **not** scan folders or
repair moved-file paths. Explicit metadata saves are described below. Manual sync now uses a separate
**Scan folders → Apply sync** review flow; see [folder sync](folder-library-sync.md).

The Vite plugin provides GET/HEAD `/__folder-library/catalog` and registered media
URLs `/__folder-library/media/:itemUuid/:variant`. Only `image`, `image-thumbs`, and
`image-thumbs-mobile` variants are exposed. The browser catalogue uses an explicit
field allowlist (IDs, tags, descriptive metadata, presentation settings, and media
URLs); raw source records, absolute paths, raw app state, and private backup files are
not API responses. Foreign origins/hosts and non-loopback clients are rejected. The metadata
endpoint below is the only supported mutation. Registered file paths are revalidated on every media request.

An alternative root can be configured in the server environment:

```sh
MOODBOARD_LIBRARY_ROOT="/absolute/path/to/library" npm run dev
```

This variable is server-only; do not use a `VITE_` prefix. The local middleware is
also installed by `npm run preview`. A static upload of `dist/` does not include a
media server or images; this is not cloud/mobile remote access yet.

Validation: unit/integration tests cover client-safe data projection, registered
media, read-only methods, origin/host restrictions, moved/symlinked media, retries,
and tag/search behavior. A headless browser check against the real export verified
search, tag filtering, metadata viewing, the missing-image state, desktop/mobile
layout, reload, and return to the editor. During folder browsing, IndexedDB access
and browser-storage writes were instrumented to fail: none occurred. The legacy
App/storage/repository module graph was not requested in folder mode.


## Stage 1C — Current-board viewing

Choose **Current board** in folder mode to view the exported working board.
`currentBoard` in the catalogue is an explicit allowlist of board identity,
dimensions, and placement geometry/references; the rest of app state stays private.
Image resolution uses stable UUIDs with legacy-ID fallback. Conflicting identities
produce placeholders rather than a guessed image. Missing media and references
keep their placements. Empty or absent boards are shown without generation.

Rendering reuses `boardBounds.js` for image presentation and layout. Crops,
scaling, rotation, stacking order, and exported placement coordinates are retained.
Desktop thumbnails load for the five-image board; available main/mobile media
can serve as fallbacks if a thumbnail is unavailable.

Pointer dragging pans the viewport only. Plus/minus and Ctrl/Command-scroll zoom;
Fit board restores the fitted view. Arrow keys pan the focused canvas. These
controls never modify placements or persist viewport changes. Switching back to
the library preserves its session filters. Reload/reopening reads the original
export again. No editing, saving, regeneration, or historical-board recovery was
added.

Validation: 570 tests passed, the production build passed, and a browser check
verified the actual five-image board, image loading, pan/zoom/fit, responsive
layout, library switching, reload, and missing/absent-board states. Storage APIs
were instrumented to fail if called; none were called. Before/after hashes of the
manifest, item metadata, and app state were identical. A separate clean install
and build without the sibling hub-core folder also passed using the vendored
package fix from the preceding commit.


## Local metadata editing

Open an image in folder mode to edit its name, description, tags (one per line),
and favorite flag. **Save metadata** explicitly saves the draft. Search, tag
filters, and sorting immediately use the saved values. The viewer stays open if
an edit makes the image fall outside the active filters. Leaving a dirty draft
asks before discarding it; failed saves keep the draft visible. **Load saved
version** retrieves current metadata and asks before replacing a dirty draft.

Edits are stored in `metadata/edits.json`, version 1, as an `items` array keyed by
`itemUuid`. Each entry contains `metadata` with the four editable fields and an
`updatedAt` timestamp. Unedited items use their original exported metadata.
`items.ndjson`, original source metadata, app state/boards, images, thumbnails,
identities, presentation settings, and folder paths are not rewritten. Tags do
not move files. No IndexedDB or browser-storage persistence is involved.

`readFolderLibrary` still returns the untouched export snapshot. The server reads
and validates the optional overlay separately and projects effective metadata to
the browser. `npm run library:check` also validates this file and reports the
number of edited records. A malformed, duplicate, or unknown overlay identity
fails validation rather than being silently ignored or deleted.

`PATCH /__folder-library/items/:itemUuid/metadata` accepts only a revision token
and the four editable fields. It requires JSON, a matching Origin, and the
existing local-client checks. Requests are bounded to 256 KiB. Names are limited
to 1,000 characters, descriptions to 20,000, and tags to 200 entries of at most
200 characters each. Content-based per-item revisions reject stale drafts with
409. Reloading saved metadata resolves a conflict explicitly; there is no forced
overwrite or silent merge.

Saves acquire an exclusive `metadata/edits.lock`, reread the overlay, check the
revision, and write an exact copy of the previous overlay into
`metadata/edit-backups/edits-<time>-<uuid>.json`. The initial backup represents an
empty overlay. A new file is flushed and atomically renamed to `edits.json`;
directory entries are flushed before reporting success. Backup failure prevents
the replacement. Other writers receive a retryable 423 instead of overwriting
one another. Metadata write destinations cannot be symlinks. Unknown top-level
and per-entry overlay fields are retained.

Backups contain metadata edits only and depend on the original exported
`items.ndjson`; keep both when copying/backing up the library. There is no backup
pruning or restore UI yet. To restore an earlier edit version, stop local servers,
preserve the current `edits.json`, copy a chosen backup to `metadata/edits.json`,
run `npm run library:check`, then restart/reload. A crash can leave `edits.lock`:
only remove that file after stopping all local servers and checking that no save
is still running. Uncommitted `.edits-*.tmp` files are not loaded automatically.

Boards remain read-only. Manual folder synchronization is described in
[folder sync](folder-library-sync.md). Edited originals now refresh their thumbnails during sync. Cloud access and
standalone thumbnail repair remain separate follow-ups.

Validation for metadata editing: 579 tests passed, including durable rereads,
exact backups, conflicts/concurrent writers, rejected fields/identities, malformed
overlays, symlink targets, blocked backups, and HTTP write restrictions. A browser
check against a temporary library verified save/reopen, two-tab conflicts,
failed-save draft retention, discard prompts, active-filter changes, metadata-only
editing, and mobile layout. Baseline metadata, board and image bytes remained
identical; browser storage was never called. The real export check still reports
1,922 records and the same 29 warnings, with zero metadata edits created by testing.


After deletion sync, Node `items` retains recoverable records marked with
`syncDeletedAt`. Active inventory, resolved assets and the browser catalogue
exclude these records. Their board placements remain unresolved placeholders.
Restoring the file and applying sync clears the marker without changing its IDs.
