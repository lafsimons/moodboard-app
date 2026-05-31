# UX Observations

## Purpose

Captures UX observations, friction points, usability audits,
and interaction patterns observed during development.

This document is not a backlog.
Items here may later become roadmap initiatives,
implementation tasks, or design decisions.

---

## Mobile UX Audit

**Preview UX**
    Especially now that you want:
* next/previous
* click/tap zoom
* image inspection
Check:
* accidental close taps
* safe-area spacing
* swipe conflicts
* double-tap vs single-tap behavior later

**Filter panel ergonomics**
    Your nested tag system is now complex enough that mobile can become painful.
Check:
* tag row height
* expand targets
* chip overflow
* scroll trapping
* keyboard overlap
* sticky controls
* collapse behavior

**Library selection behavior**
    At 6k+ items:
* accidental selections
* long-press behavior
* bulk actions discoverability
    matter much more on mobile.

**Controls panel density**
    Likely still desktop-biased.
Especially:
* saved views
* grouped/any/all
* sort controls
* expand/collapse
* generation controls

**Board interaction**
    Especially:
* fit behavior
* accidental pan
* zoom floor/ceiling
* toolbar overlap
* image tap targets

**Mobile performance**
    This is the hidden one.
Check:
* opening Library
* scrolling long filtered results
* repeated filter changes
* preview opening/closing
* memory after long sessions

---

## UX Principles

Current UX work should prioritize:

- Interaction consistency
- Density and information efficiency
- Friction reduction
- Predictable behavior
- Mobile usability

Large-scale visual redesigns should generally be avoided unless they solve a specific usability problem.

---

## Recurring UX Opportunities

### Shared
- show in library
- miniature previews

### OA
- improve flat lays
- better image background removal
- controls redesign
- fitpics search/filter

### MBA
...

