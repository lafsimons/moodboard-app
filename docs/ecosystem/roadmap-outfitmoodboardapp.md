# Roadmap

---

# Vision / ecosystem

## Long-term ecosystem direction

- Main hub page with access to OA and MBA.
- Item page showing linked outfits, linked moodboards, and linked references.
- Hover/secondary image showing worn or contextual use.
- Inspector/detail panel showing texture shots.
- Structured dataset export for analysis and backup.
- Graph or cluster view for tags, garments, references, and outfits.
- Cross-device sync.
- Private cloud-backed libraries.
- Optional public/shared boards.
- Durable archival export/import.
- Longitudinal wardrobe/taste history.
- Timeline/history view of wardrobe evolution.

---

## Analytical & relational systems

The system could reveal:
- strongest pairings
- recurring colors
- seasonal use
- underused items
- anchor pieces
- orphan pieces
- acquisition patterns
- wardrobe/taste evolution over time
- silhouette repetition
- fit tendencies
- most-linked references

---
# Infrastructure / architecture

## Infrastructure direction

- Vercel frontend
- Supabase Auth/Postgres
- Cloudflare R2 object storage

---

# Current stabilization state

## Large-library runtime architecture

Current stabilization work completed:
- metadata-first startup
- metadata-only runtime state
- out-of-line media storage
- lazy media resolution
- batched delete cleanup
- persistence dedupe
- virtualization stabilization
- backup hardening
- Safe Mode recovery

Current architecture is now designed to support multi-thousand-image personal libraries before sync/cloud rollout.

# Large-library architecture direction

- archive/chunked backup format
- streaming import/export
- media integrity tools
- export limits/UX
- possible centralized object URL cache layer

## Cross-platform scalable package import/export

- archive/chunked backup format
- streaming import/export
- cross-platform scalable package import/export
- media integrity tools
- export limits/UX
- possible centralized object URL cache layer

### Goal

Make scalable MBA backup package import/export work across:
- desktop browsers
- iPhone/iPad Safari
- iOS browsers (Safari/Chrome/Brave/Firefox)
- Android browsers

without depending exclusively on the File System Access API.

### Current state

Current scalable package import/export architecture works primarily on:
- desktop Chromium browsers
- browsers with File System Access API support

Current limitation:
- iOS/iPadOS browsers do not support the required File System Access API path
- scalable package import currently cannot start on Safari/iOS/iPadOS

This is now an architectural compatibility issue rather than a storage/performance issue.

---

### Requirements

#### Preserve package architecture

- Keep the scalable package format if possible.
- Avoid redesigning the backup format unless necessary.
- Preserve:
  - chunked/scalable package structure
  - large-library support
  - media integrity guarantees
  - incremental import architecture

---

### Cross-platform import path

Add a browser-compatible fallback path using:
- `<input type="file">`
- standard Blob/File APIs
- streamed/chunked reads where possible

instead of requiring:
- `showOpenFilePicker`
- File System Access handles

#### Platform expectations

| Platform | Target support |
|---|---|
| Desktop Chrome/Edge/Brave | Full |
| Android Chrome/Brave | Full |
| iPhone Safari | Supported |
| iPad Safari | Supported |
| Other iOS browsers | Supported |

---

### Import architecture goals

#### Import pipeline

Support:
- progressive/chunked package reading
- incremental IndexedDB writes
- resumable internal import stages where feasible
- explicit progress reporting
- visible failure/error states
- cancellation handling

#### UX

Add:
- clear unsupported-browser detection
- browser compatibility messaging
- import progress UI
- failure recovery guidance
- quota/storage error reporting
- partial import cleanup/recovery handling

Avoid:
- silent failures
- browser-specific dead ends
- hard crashes during large imports

---

### Performance/stability goals

Large-library targets:
- 5k–10k image libraries
- stable import on modern mobile devices
- no full-memory package hydration if avoidable
- minimize duplicate Blob/DataURL allocations

Prefer:
- streaming
- incremental decode/write
- bounded memory usage

---

### Validation

Test:
- desktop Chromium
- Android Chrome
- iPhone Safari
- iPad Safari

Stress-test:
- multi-thousand image package imports
- interrupted imports
- low-storage conditions
- quota exhaustion handling
- recovery after tab reload/crash

Run:
- `npm run build`
- `npm test -- --runInBand`

#### Success criteria

- scalable package imports work on iOS/iPadOS browsers
- desktop scalable workflow remains intact
- package format remains compatible
- large-library imports remain stable
- import failures are surfaced clearly
- no File System Access API hard dependency remains

## Future backup/media direction

Current JSON backup works after slimming duplicated image payloads, but it still embeds preview images inline and still relies on full in-memory JSON materialization.

This is acceptable short-term, but not scalable for very large libraries.

Long-term direction:
- metadata backup should stay small
- media assets should be stored separately
- previews/originals should become separate image assets
- app records should reference stable media IDs/URLs instead of embedding all image data inline
- cloud sync should eventually store media in object storage

Current backups still:
- materialize entire JSON payloads
- rely on `readAsText`
- rely on full `JSON.parse`

Future backup architecture will likely move toward:
- manifest-based archive format
- chunked metadata files / NDJSON
- separated media payloads
- streaming import/export
- optional zip/tar packaging

Likely future structure:

```text
manifest.json
appState.json
items.ndjson
media/previews/
media/thumbnails/
media/originals/
```

Also MBA has already been stabilized around slimmer backup/media handling. Later compare OA’s backup shape and potentially reuse the same backup-slimming and media-separation rules across both apps.

## Media integrity tools

Potential future tooling:

- orphaned media detection
- orphaned metadata detection
- missing preview/original validation
- integrity repair utilities
- media compaction tools

These become more important with separated metadata/media storage.

## Export limits / UX

Very large visual exports are currently impractical at extreme library sizes.

Future UX work may include:

- filtered export limits
- export warnings
- chunked rendering
- paginated exports
- staged rendering/export pipelines

## Possible future object URL cache layer

Current lazy media resolution already revokes object URLs correctly, but object URL creation remains decentralized.

Possible future optimization:

- centralized object URL cache
- LRU eviction
- shared resolver cache
- ref-counted object URL reuse

This is not currently required, but may become useful for extremely large libraries or future multi-panel/media-heavy workflows.

---

# Near-term priorities  

### Documentation

- Distill essential points from old conversations.
- Keep documentation simple initially.
- Core structure:
    - `core.md`
    - `working-notes.md`
    - optional `roadmap.md`
- Stable architecture belongs in `core.md`.
- Temporary ideas, fixes, and implementation notes belong in `working-notes.md`.
- Document the future portable shared schema before hub/sync/cloud implementation expands.
- Use `sync-cloud-v1-outfitmoodboardapp.md` as the concrete first implementation spec for private sync/cloud rollout.

### App work

- Stabilize repository-boundary refactors in OA and MBA.
- Preserve source filenames/folders during imports.
- Add richer import/source metadata to OA.
- Use MBA repository abstraction patterns for future cloud migration.
- Defer bulk original relinking until object-storage architecture is stable.
- Do not merge OA and MBA yet.
- Defer sync/public sharing until local data models and repository boundaries are stable.
- OA slot-key leakage still existing in MBA debug/render paths
- eventual separation of MBA guided generation from OA slot architecture

### Pre-sync foundation cleanup

Before implementing accounts/sync/cloud:
- extract reusable modules from App.jsx
- standardize storage shapes
- standardize backup/export structure
- standardize portable hub item/link/backup contract
- remove duplicated OA/MBA infrastructure
- keep feature work moving while gradually modularizing shared systems
- complete missing additive stable UUID fields for any syncable non-item entities before rollout

# Major future phases

### Major future system phases

After that, the “important” things become more architectural/product-level rather than UI firefighting. 
The most important long-term system phases after that are probably:

**1. Shared entity/media model**
Very important. Not necessarily a full monorepo/shared package yet. But:
- shared image/reference shape
- shared IDs
- shared relationship conventions
- shared metadata normalization
This becomes critical once:
- outfits
- references
- fitpics
- boards
- garments
start linking heavily.

**2. Relationship layer**
Probably the most important long-term feature. Because this is where the ecosystem becomes: meaningful instead of just archival. Examples:
- this fitpic uses these garments
- this outfit inspired this moodboard
- this reference influenced this saved outfit
- this garment appears in these boards
- this silhouette appears repeatedly

**3. Originals/high-quality media handling**
Eventually important. Especially because:
- exports
- boards
- fitpics
- previews
- crops
- zooming
will increasingly want: preview image + original image separation.

**4. Shared shell / ecosystem timing**
Do not build the shared shell yet.
OA and MBA should first stabilize independently:
- local interaction systems
- filtering/search architecture
- image/original handling
- metadata/entity systems
- persistence/import/export
- shared helper extraction
Prefer incremental shared concepts/helpers over early app coupling.
The shared shell/hub should begin only once real cross-app workflows exist, such as:
- OA outfit → MBA board workflows
- shared image library
- shared tags/favorites
- fitpics referencing outfits/items/boards
- shared auth/workspaces
- shared navigation/session state
Until then:
- keep apps independently deployable
- keep architecture loosely coupled
- share pure helpers/systems incrementally

**5. Sync architecture**
Not urgent immediately. But after relationships stabilize:
- local-only object assumptions become dangerous
- IDs matter more
- migrations matter more
- relationship integrity matters more
Eventually:
- Supabase/R2/shared media storage becomes the next major system phase.

**6. Performance/stability pass**
- render audits
- save throttling audits
- relationship graph performance
- virtualization consistency
- memory pressure checks
- mobile Safari sanity
Especially once relationships/media grow.

**7. Undo/history system**
Not urgent, but high-value later.
Once:
- boards
- outfits
- relationships
- bulk actions
become richer,  undo/history becomes disproportionately valuable.

### Moodboard app cleanup

- rename remaining outfit-app identifiers
- clean obsolete copied root files
- separate app identity from shared infrastructure
- improve repo structure before public sharing

### Post-foundation direction

After those steps, I don’t think there are any major urgent UI restructures left. At that point you’ll have:
- stable ecosystem language
- mature card systems
- stable toolbar architecture
- editors/bulk editors
- mobile sanity
- fitpic/reference compatibility
- saved systems
- relationship direction

---
# Deferred systems

Not priority yet:

- accounts
- public sharing
- cloud sync
- collaborative features
- large storage migrations
- object-storage relinking

## **Taxonomy & Navigation**

- keyboard navigation
- saved filter presets
- recent tags
- pinned branches
- taxonomy scaling improvements
- semantic browsing systems
- relationship-based navigation

## **MBA UX / Interface Evolution**

- sticky search bar
- filter density refinements
- compact mode ideas
- selection visibility improvements
- chip UX refinements
- mobile filter adaptations

# Experimental ideas

### Experimental taxonomy ideas

Potential long-term nested taxonomy direction:

subject/fashion
    interior
    architecture
    textile
    object
    tailoring
    military
    nature

context/
	campaign
	runway
	fitpic
	archive
	product
	detail
	documentary
	street

region/
    american
    french
    belgian
    dutch
    japanese

vintage/
    workwear
    militaria
    tailoring

brand/
people/
publication/
artist/
store/
-> entity/

---

# Non-goals

- monorepo rewrite
- premature shared UI framework
- fully automated styling AI
- aggressive normalization
- mandatory cloud dependency
- ideas for URLs: 
	- atelier.so
	- wear.atelier.so
	- boards.atelier.so

---


