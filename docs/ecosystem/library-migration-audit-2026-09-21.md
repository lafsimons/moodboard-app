# Library migration audit — 2026-09-21

Read-only inspection of `/Users/lafsimons/Documents/originals/backup/`, the originals folder above it, and `/Users/lafsimons/Downloads/moodboard-original-recovery-2026-09-21.json`. No source files or browser records were modified.

## Backup contents and integrity

- Directory package: 1,922 records, with unique nonempty item UUIDs and unique legacy IDs.
- 1,921 preview files, totaling 310,259,794 bytes. All 1,921 decoded successfully with Pillow.
- `images-059` has no exported preview. This agrees with the package's single export warning; metadata remains present.
- 378 preview records have file-size metadata that differs from the actual exported bytes. These files decode successfully; the mismatch alone does not establish corruption. Recompute technical asset metadata from actual files during migration rather than carrying these values forward unchecked.
- `appState.json`, the JSON backup, and the metadata-only backup each contain zero saved boards (`savedOutfits`) and a current board with five placements. All five item IDs and UUIDs resolve in the package. Preserve this working board.
- This package is explicitly preview-only. Original metadata and linkage fields do not mean original binaries are included. The exporter deliberately sets `originalPreserved: false` in package records.

## Original file checks

- All 1,862 previously recorded original relative paths exist, allow an initial byte read, and match recorded byte sizes. This is a path/readability/size check, not a complete decode or pixel-identity verification.
- The other 33 previously linked records are `discord_1` through `discord_33`: each has a uniquely matching filename under `Discord/` and matching recorded file size. Proposed path associations have not been applied to the app.
- The recovery report still lists 27 unresolved records. Additional candidates below are evidence for review, not changes to that report.

## Additional candidate comparisons

Compared exported previews with candidate originals after EXIF orientation, RGB conversion, and resizing both to 128 × 128. Mean absolute channel difference is on a 0–255 scale. This is a screening measure, not proof of identity; retain existing UUIDs and avoid automatically merging distinct records.

| Item | Candidate relative path | Mean pixel difference |
| --- | --- | ---: |
| images-557-2 | vintage/vintage-images-557.png | 0.336 |
| images-683 2 | vintage/vintage-images-683.png | 0.323 |
| vintage-images-014 | vintage/vintage-images-014.jpg | 0.966 |
| vintage-images-017.jpg | vintage/vintage-images-017.jpg | 1.351 |
| vintage-images-038.jpg | vintage/vintage-images-038.jpg | 1.728 |
| vintage-images-041.jpg | vintage/vintage-images-041.jpg | 0.688 |
| IMG_2250 | Fashion/Vintage/IMG_2250.WEBP | 64.098 |

The first six are strong pixel-similarity candidates with consistent aspect ratios. `IMG_2250` has both substantial pixel difference and a different aspect ratio; do not use the name alone to link it. `images-059` has no exported preview to compare against its filename candidate, `moodboard/moodboard-images-059.png`.

## Tags and folder planning

Every record has tags. Existing tag families are `people`, `period`, `medium`, `subject`, `origin`, `brand`, `attribute`, and `category`.

There are 8 records with multiple brand tags, 70 with multiple medium tags, and 57 with multiple subject tags. No record has multiple people tags. Folder assignment therefore needs explicit precedence and a fallback; all tags must remain in metadata regardless of the single chosen physical location. A category preview should precede copying or renaming files.

Exclude the `backup/` directory from original-image discovery and future folder indexing: it sits inside the originals root and contains exported derivatives and records, not additional source items.

## Next steps

1. Review the six strong candidates and the unviewable `images-059` candidate without silently accepting uncertain matches.
2. Preserve available previews for unresolved originals and keep their unresolved status explicit.
3. Produce a dry-run export manifest with stable IDs, proposed readable names, tag-based destination paths, and separate original/preview associations. Preserve raw records, the current board, and saved library views.
4. Verify any intended saved boards that are absent from these exports before calling this a complete backup of all historical work.
