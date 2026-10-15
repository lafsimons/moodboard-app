# Proposed library export — dry run

No images have been copied or renamed. This is a proposed layout for review, not a completed export.

## Coverage

- 1,922 items; 1,921 previews.
- 1,862 originals mapped by saved path and size; 33 Discord path proposals.
- 27 originals unresolved; six strong candidates and one candidate without a preview remain separate for review.
- 5 records have multiple choices within the selected tag family; alphabetical selection is provisional.
- No destination collisions; filenames retain full item UUIDs.
- Current five-image board will be preserved. Missing historical saved boards are deferred at the user’s request.

## Folder rule

Named books and films → people → brands → interiors → garments/other subjects → existing vintage/moodboard tags → other. Each image has one physical location; all tags remain available for app browsing. Folders are independent of future app categories.

The user-selected structure mirrors tt-library: `public/images/`, `public/image-thumbs/`, and `public/image-thumbs-mobile/`, with matching relative folders and filename stems. Thumbnail extensions follow their encoding. Existing exported previews are retained under `preserved-previews/` as migration material; optimized desktop/mobile thumbnails have not been generated. Missing originals remain explicit rather than being silently replaced with previews. Readable titles are retained; generic image names gain the folder subject. A full stable UUID follows the readable name.

## Proposed groups

| Folder | Images |
| --- | ---: |
| Archive/Moodboard | 36 |
| Archive/Other | 42 |
| Archive/Vintage | 190 |
| Books/August Sander | 11 |
| Books/Avant | 63 |
| Books/La France Travaille | 46 |
| Books/Nous Etions Des Paysans | 24 |
| Books/Street Life In London | 19 |
| Books/Vintage Menswear | 4 |
| Brands/Artisanal | 161 |
| Brands/Brass | 24 |
| Brands/Guidi | 15 |
| Brands/Guidi Rossellini | 90 |
| Brands/John Alexander Skelton | 408 |
| Brands/Minezo | 61 |
| Brands/Paul Harnden | 70 |
| Brands/Rigards | 2 |
| Brands/William Lennon | 8 |
| Brands/Yohji | 28 |
| Films/Elephant Man | 2 |
| Films/Perfect Days | 11 |
| Films/There Will Be Blood | 67 |
| Garments/Accessory | 4 |
| Garments/Footwear | 9 |
| Garments/Headwear | 1 |
| Garments/Jacket | 25 |
| Garments/Knit | 8 |
| Garments/Other | 73 |
| Interiors | 69 |
| Objects | 7 |
| People/Aapo | 54 |
| People/August Sander | 37 |
| People/David Lynch | 4 |
| People/Differentapproach | 3 |
| People/Doug Bihlmaier | 17 |
| People/Exsar | 2 |
| People/Jakob Hetzer | 1 |
| People/Jamesbrown | 20 |
| People/Joseph | 1 |
| People/Jq | 1 |
| People/Ken Ijima | 6 |
| People/Lukas Mauve | 20 |
| People/Lullijoakim | 14 |
| People/Olo | 7 |
| People/Patrick Stangbye | 11 |
| People/Philip | 43 |
| People/Rbot | 1 |
| People/Rmn | 7 |
| People/Sock2 | 2 |
| People/Yogi | 31 |
| Style/Fits | 62 |

## Filename examples

- `public/images/Books/Street Life In London/Street Life In London - images-080--28f7c6cc-a3b7-4154-bf34-b93efb94b470.jpg`
- `public/images/Films/Elephant Man/Elephant Man - images-1284--54e4224b-2213-4b94-8606-a9b4805d3f91.png`
- `public/images/People/August Sander/August Sander-1--570fcc65-e946-4a63-8044-594d764eacba.png`
- `preserved-previews/Brands/Guidi Rossellini/GR-1--365dbe06-e457-4aac-bce9-2a44f1212350.webp`
- `public/images/Interiors/Interiors - images-1149--71e551b0-9bcc-4949-9a61-19c0e3d59d8b.jpg`
- `public/images/Archive/Vintage/Vintage - images-074--b368e608-7fb5-4635-9bfc-d099e9895dfb.jpg`

## Records needing folder choice review

- images-449: brand/artisanal, brand/paul-harnden → Brands/Artisanal
- images-452: brand/artisanal, brand/paul-harnden → Brands/Artisanal
- images-455: brand/artisanal, brand/paul-harnden → Brands/Artisanal
- images-458: brand/artisanal, brand/paul-harnden → Brands/Artisanal
- images-461: brand/artisanal, brand/paul-harnden → Brands/Artisanal

## Preservation requirements

The eventual export must also retain complete raw metadata, app state, saved library views, provenance, and an ID/path manifest. This map is not itself a complete metadata backup. Original and preview technical metadata must be read from the files, because 378 exported preview byte-size fields were stale. Missing originals and the missing images-059 preview remain explicit.
