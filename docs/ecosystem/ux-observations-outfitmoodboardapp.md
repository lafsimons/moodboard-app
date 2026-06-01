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
- image preview: description UI ![[Screenshot 2026-05-31 at 14.16.39.png]]
Yes. Looking at the screenshot, I think this is more than “a bit ugly”—it actively discourages using descriptions.

A few issues jump out:

### **1. Description dominates the image**

The image is the primary object.

But when a long description exists, the layout becomes:

```text
Description
Description
Description
Description

Image
```

instead of:

```text
Image

Description
```

or

```text
Image | Description
```

The image gets pushed down and loses visual prominence.

---

### **2. Reading mode and image mode are competing**

You are trying to do two things simultaneously:

- inspect an image
- read research notes

The current modal attempts both in the same canvas.

For long notes like your German knit research, it becomes awkward because you can’t comfortably do either.

---

### **3. Description width is too large**

The text block spans almost the entire modal width.

That makes it feel like a document viewer.

Something like:

```text
┌──────────────┬─────────────┐
│              │             │
│    Image     │ Description │
│              │             │
└──────────────┴─────────────┘
```

would be far easier to scan.

---

### **4. The image loses context**

Your German knit example is a perfect case.

The note is explaining:

- dating
- construction
- material
- provenance

while the image is the evidence.

You want them visible together.

Currently the note pushes the image away from the explanation.

---

### **If I were prioritizing MBA UI**

I’d probably add:

```text
Description display modes

○ Hidden
○ Below image
○ Side panel
```

and default to:

```text
Side panel
```

for longer descriptions.

---

### **Another idea**

Descriptions could behave more like OA metadata:

```text
Image

Tags

Description ▼
```

collapsed by default.

Most of the time you want:

- image
- tags

Only occasionally do you want:

- image
- tags
- 500-word research note

So making descriptions expandable would reduce visual clutter enormously.

---

For your specific use case (German knit research, T.T interviews, archival garment studies), I suspect the ideal experience is:

```text
Large image

Tags

[Show Description]
```

because 90% of browsing is visual, while descriptions are reference material you consult when needed. Right now the UI is treating the description as equally important as the image, which doesn’t match how you actually use MBA.


---

# IDEA: 


Which is why I’d almost separate the concepts:

### **Description**

Short factual note:

```text
1894 quarry workers wearing double-breasted German knit jackets.
```

### **Research note**

Long-form text:

```text
The jacket appears to be jersey knit rather than ribbed...
...
I would date my jacket between 1880s–1920s.
```

Those serve different purposes.
