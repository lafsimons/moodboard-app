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
- `manifest`, `items`, `appState`: parsed source objects without field removal or
  normalization. Item `sourceMetadata` retains the complete original record.
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

Stage 1B is described below. Stage 1C (board viewing) remains separate work.

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
repair moved-file paths. Folder sync, editing, and board viewing remain deferred.

The Vite plugin provides GET/HEAD `/__folder-library/catalog` and registered media
URLs `/__folder-library/media/:itemUuid/:variant`. Only `image`, `image-thumbs`, and
`image-thumbs-mobile` variants are exposed. The browser catalogue uses an explicit
field allowlist (IDs, tags, descriptive metadata, presentation settings, and media
URLs); raw source records, absolute paths, app state, and private backup files are
not API responses. Mutations, foreign origins/hosts, and non-loopback clients are
rejected. Registered file paths are revalidated on every media request.

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
