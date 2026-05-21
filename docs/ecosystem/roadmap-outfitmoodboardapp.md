# Roadmap

---

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

## Infrastructure direction

- Vercel frontend
- Supabase Auth/Postgres
- Cloudflare R2 object storage

---

## Near-term priorities

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

### Pre-sync foundation cleanup

Before implementing accounts/sync/cloud:
- extract reusable modules from App.jsx
- standardize storage shapes
- standardize backup/export structure
- standardize portable hub item/link/backup contract
- remove duplicated OA/MBA infrastructure
- keep feature work moving while gradually modularizing shared systems
- complete missing additive stable UUID fields for any syncable non-item entities before rollout

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

**4. Sync architecture**
Not urgent immediately. But after relationships stabilize:
- local-only object assumptions become dangerous
- IDs matter more
- migrations matter more
- relationship integrity matters more
Eventually:
- Supabase/R2/shared media storage becomes the next major system phase.

**5. Performance/stability pass**
- render audits
- save throttling audits
- relationship graph performance
- virtualization consistency
- memory pressure checks
- mobile Safari sanity
Especially once relationships/media grow.

**6. Undo/history system**
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

### Future backup/media direction

Current JSON backup works after slimming duplicated image payloads, but it still embeds preview images inline.

This is acceptable short-term, but not scalable for very large libraries.

Long-term direction:
- metadata backup should stay small
- media assets should be stored separately
- previews/originals should become separate image assets
- backup may need to become metadata JSON + media folder/zip
- cloud sync should eventually store media in object storage
- app records should reference stable media IDs/URLs instead of embedding all image data inline

Also MBA has been fixed now, but then later compare OA’s backup shape and maybe reuse the same backup-slimming rules across both apps.

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

## Deferred systems

Not priority yet:

- accounts
- public sharing
- cloud sync
- collaborative features
- large storage migrations
- object-storage relinking

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

## Non-goals (for now)

- monorepo rewrite
- premature shared UI framework
- fully automated styling AI
- aggressive normalization
- mandatory cloud dependency

