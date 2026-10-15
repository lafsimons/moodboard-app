# Simple library proposal

This supersedes the earlier detailed tag-derived folder proposal. The first separate export was built on 2026-09-21 at `library-exports/moodboard-library-2026-09-21/`. Folder sync and app integration are not implemented yet.

## Everyday workflow

1. Put new images in `images/Inbox/`.
2. Move them into the folder where you would naturally look for them.
3. Run Sync library to update the app and thumbnail folders.
4. Edit tags and metadata in the app. Tags provide additional ways to find an image without moving or duplicating it.

## Starting folders

```text
public/
  images/
    Inbox/
    Brands/
      Ann D/
      Arcteryx/
      Artisanal/
      Brass/
      Guidi/
      Guidi Rossellini/
      John Alexander Skelton/
      Minezo/
      Paul Harnden/
      Rigards/
      Taiga Takahashi/
      William Lennon/
      Yohji/
    Vintage/
      Asia/
        Hongkong/
        Japan/
      China/
      EU/
        Belgium/
        Finland/
        France/
        Germany/
        Ireland/
        Italy/
        Netherlands/
        Norway/
        Spain/
        Sweden/
        UK/
      Russia/
      USA/
    People/
      Aapo/
      August Sander/
      David Lynch/
      Differentapproach/
      Doug Bihlmaier/
      Exsar/
      Jakob Hetzer/
      Jamesbrown/
      Joseph/
      JQ/
      Ken Ijima/
      Lukas Mauve/
      Lullijoakim/
      Olo/
      Patrick Stangbye/
      Philip/
      Rbot/
      RMN/
      Sock2/
      Yogi/
    Media/
      Books/
        August Sander/
        Avant/
        La France Travaille/
        Nous Etions des Paysans/
        Street Life in London/
        Vintage Menswear/
      Films/
        Elephant Man/
        Perfect Days/
        There Will Be Blood/
    Interiors/
    Objects/
  image-thumbs/
  image-thumbs-mobile/
```

These are starting examples, not required categories. General vintage images may live directly in `Vintage/`. Media can have subfolders such as `Books/` and `Films/`, with other types added as needed. People has one subfolder per existing person tag. Media images without a book or film collection live directly in `Media/`; there is no Text subfolder or References folder. Vintage mirrors the existing origin hierarchy, including its current root-level China and Russia tags. General or unknown-origin vintage images can stay directly in `Vintage/`. Each image has one main location. Both thumbnail roots mirror the image folders and filename stems, with extensions appropriate to their encoding.

Folders are freely editable: rename, move, add, or reorganize them inside `images/`, then sync. Sync maintains the thumbnail trees; users should not have to reorganize all three trees manually. Stable image IDs and a portable catalogue preserve metadata and board references when paths change. Uncertain moves are flagged for reconnection, and missing files do not automatically delete records.

Keep the catalogue, app edits, and boards outside `public/` in portable metadata files. Routine app backups cover these records and their image links; they do not repackage the image library. Cloud access remains a later step and should be private by default.

## First deliverable

Create a separate local export for review, leaving the originals folder and browser library intact:

- Copy verified originals with readable names and stable IDs.
- Generate desktop and mobile thumbnails from those originals.
- Preserve existing exported previews and all raw metadata separately during migration.
- Keep unresolved originals explicit. Available previews remain usable, but must not be labelled as originals; `images-059` has no exported preview.
- Assign initial folders conservatively from existing metadata. Ambiguous assignments go to Inbox for manual sorting instead of creating many automatic categories.
- Preserve the current board; recovery of historical saved boards is deferred at the user's request.

Verify the exported files and their associations before switching the app to the folder library. Then implement manual folder sync and durable in-app metadata saving, followed by cloud/mobile access and the later tt-library-inspired UI pass.

## Full tag review — 2026-09-21

Reviewed all 92 distinct tags across 1,922 exported records. This expanded tree is a menu of useful collection homes, not an instruction to create every folder or assign records automatically. Small brand collections may remain in `Brands/` until a subfolder is useful. Keep the existing tag spelling as metadata; display labels above are only folder proposals.

- Named book collections: Avant (63 tagged images), La France Travaille (46), Nous Etions des Paysans (24), Street Life in London (19), August Sander (11), Vintage Menswear (4). “August Sander” is the current source tag, not a verified book title.
- Named film collections: There Will Be Blood (67), Perfect Days (11), Elephant Man (2).
- `Brands/Artisanal/` represents the existing broad collection tag (161 images), not a specific brand.
- Vintage mirrors all existing `origin/...` paths, with readable folder labels. Preserve the source hierarchy rather than silently moving China or Russia into a different region. Country tags alone must not classify modern designer images as vintage.
- People contains one folder for each of the 20 existing person tags. Specific books tagged August Sander can still live in Media/Books/August Sander; folder membership is separate from retaining people tags.
- Interiors (80 tagged images) and Objects (7) remain proposed main folders. Media images not assigned to Books or Films live directly in Media, including the 35 text-tagged images where no more specific collection applies.
- No References folder. Items without a clear home stay in Inbox pending deliberate sorting.
- Work, military, athletic, garment type, patina, boro, era, photo, and Instagram screenshot remain tags by default. Country tags additionally inform the chosen Vintage location. They do not each require physical folders. Medium/personal has only one tagged record and does not require its own folder now.

Counts are tag membership counts, not final export folder counts: an image can have several tags. The user chooses one primary home; source, brand, and person tags remain available regardless. Do not infer a fixed global precedence from this tree. The old export map and its automatic folder precedence are superseded for organization purposes; regenerate assignments after the simplified structure is agreed.

## First export result

- 1,922 full metadata records, preserving every original field under `sourceMetadata`.
- 1,895 copied originals validated by decoding and source/destination SHA-256 equality. Associations use previously recorded path/size or the 33 Discord filename/size matches; this does not prove every historical association visually.
- 26 clearly labelled preview fallbacks in the image tree and one metadata-only record (`images-059`). Unconfirmed original candidates were not substituted.
- 1,921 desktop thumbnails (maximum 1,200 pixels on the long edge) and 1,921 mobile thumbnails (maximum 560 pixels), with orientation applied, no upscaling, and matching folder/filename stems.
- All 1,921 exported previews retained separately, plus the untouched backup metadata, original recovery report, app state, and five validated working-board links.
- Initial folder assignment uses named book/film, person, specific brand, interiors/objects, vintage origin, generic media, then Inbox. Competing specific collections remain in Inbox. This is a documented migration default, not an enforced organization rule. There are 128 Inbox records for later sorting.
- Approximately 3.60 GB total. Source files and browser data were not changed. The export is Git-ignored and has not been uploaded or connected to the app.
