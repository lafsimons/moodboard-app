# Roadmap

# **Long-term ecosystem direction**

- Main hub page with access to OA and MBA.
- Item page showing linked outfits, linked moodboards, and linked references.
- Hover/secondary image showing worn context.
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

# **Analytical & relational systems**

The system could reveal:
- strongest pairings
- recurring colors
- seasonal use
- underused items
- anchor pieces
- orphan pieces
- acquisition patterns
- wardrobe/taste evolution over time

---

# **Infrastructure direction**

- Vercel frontend
- Supabase Auth/Postgres
- Cloudflare R2 object storage

---

# **Near-term priorities**

## Documentation
- Distill essential points from old conversations.
- Keep documentation simple initially.
- Core structure:
    - `core.md`
    - `working-notes.md`
    - optional `roadmap.md`
- Stable architecture belongs in `core.md`.
- Temporary ideas, fixes, and implementation notes belong in `working-notes.md`.

## App work
- Stabilize repository-boundary refactors in OA and MBA.
- Preserve source filenames/folders during imports.
- Add richer import/source metadata to OA.
- Use MBA repository abstraction patterns for future cloud migration.
- Defer bulk original relinking until object-storage architecture is stable.
- Do not merge OA and MBA yet.
- Defer sync/public sharing until local data models and repository boundaries are stable.

## Pre-sync foundation cleanup

Before implementing accounts/sync/cloud:
- extract reusable modules from App.jsx
- standardize storage shapes
- standardize backup/export structure
- remove duplicated OA/MBA infrastructure
- keep feature work moving while gradually modularizing shared systems

## Moodboard app cleanup

- rename remaining outfit-app identifiers
- clean obsolete copied root files
- separate app identity from shared infrastructure
- improve repo structure before public sharing

