# Folder library boards

Open the local app with `?library=folder`. Filter the library, then choose **Current board**. The eligible count includes every matching page, nested folders, search and the selected all/any tag rule. **Generate board** explicitly replaces the current working board using the existing guided/random generator and layout logic. The image count is 1–30, capped by the available pool. Empty pools disable generation and keep the current board.

Available originals and preview fallbacks can be generated. Deleted records and records without usable media cannot. Filters, metadata edits and file sync never regenerate a board automatically.

## Keeping boards

Generation and opening a saved board automatically save the current board. Enter a name and choose **Save a copy** to keep an independent snapshot with a new UUID. Opening it restores its geometry, generation settings and filter snapshot without generating anything. Later generation leaves saved copies unchanged.

Pan, zoom, Fit and viewport resizing only change the view. File moves retain UUID/legacy-ID links. Crops refresh media after sync; deleted images retain their placements as placeholders. Manual placement editing, replacement, undo and dedicated filter views remain deferred.

## Files and API

`metadata/boards.json` is a version-1 document:

- `current`: `{ board, settings, filters }`.
- `saved`: named snapshots with `id`, `name`, `createdAt`, `board`, `settings`, `filters`.
- Each board has `id`, `boardUuid`, `width`, `height`, and placement `images`.
- Placements retain `id`, `referenceItemUuid`, `referenceId`, `x`, `y`, `width`, `height`, `rotation`, `zIndex`.
- Settings contain `imageCount` and `generationMode`; filters contain `search`, `folder`, `tags`, `tagMode`, `sort`.

Before that file exists, reads project the exported app-state board without writing. Valid exported generation settings are restored; otherwise defaults are 15 and Guided. The original app-state export and browser database are untouched.

`GET /__folder-library/boards` returns `{ state, revision }`. `PUT` accepts the same envelope, requires the local same-origin JSON request, and validates identities, geometry and settings. It uses the shared `metadata/edits.lock`, writes a versioned backup under `metadata/board-backups`, and replaces the document atomically. The revision represents the previous bytes; stale writes receive HTTP 409. Retrying an identical completed save is idempotent.

The interface retains unsaved work after failure and offers Retry. On a conflict, **Load saved boards** discards the local draft after confirmation. **Keep unsaved board as a copy** appends the local board to the newest document while preserving the other tab's current board. It then loads that latest current board; the recovered copy is available in the list. Closing/reloading with unsaved work triggers the browser's leave-page warning. Unsaved drafts are not persisted to browser storage.

## Verification

`npm test` covers the generator adapter, preservation of existing generator behaviour, filter semantics, board document validation, durable storage, backups, failed saves, revisions and endpoint restrictions. `npm run library:check` additionally reads board state and prints placement/saved-copy counts without writing.

`node scripts/check-folder-boards-browser.cjs` runs a temporary-library Chromium check on port 5175. It requires Playwright and its Chromium installation. `PLAYWRIGHT_MODULE` can point to an external Playwright module; `CHROMIUM_PATH` can select an existing Chromium executable. It exercises generation, copies, reopening, empty pools, viewport changes, failed-save retry, two-tab conflict recovery, file moves/crops/deletion placeholders and forbids browser-storage writes. It removes its temporary library on exit and never opens the real export. Screenshots are written under `/tmp`.
