## Notes

Research / References
├── Sportswear
├── Workwear
├── T.T
├── Materials
├── Footwear
├── Visual Language
├── Philosophy
 
- collected observations,
- visual studies,
- external systems,
- inspiration structures,
- archive analysis,
- and reference breakdowns.

Research/References is where:

- new ideas enter the ecosystem,
- before they either:
    - become architecture,
    - become taxonomy,
    - become features,
    - or get discarded.

---
Types of notes that belong there:

Visual lineage studies

- French industrial workwear observations
- Maritime cap silhouette study
- 1930s worker proportions
- Denim fading references
- Postman hat references
- Historical layering observations

Garment/material studies

- Moleskin fabric behavior
- Mud dye/logwood dye references
- Knitwear aging/patina
- Workwear repair references
- Historical footwear proportions

Brand/studio studies

- T.T references
- Evan Kinori observations
- Guidi/Ann D silhouette analysis
- Yohji proportion notes
- Brands that balance archival/contemporary well

Reference system ideas

- Semantic moodboard generation ideas
- Knowledge graph concepts
- Relationship systems
- Archive UI inspiration
- Cross-media linking ideas

External software/system inspiration

- Obsidian graph ideas
- Eagle/PureRef observations
- Cosmos/Are.na/Pinterest analysis
- Archive interface studies
- Museum catalog systems
- Metadata system inspiration

Historical/cultural research

- Industrial worker photography
- Rural vs industrial workwear distinctions
- Uniform studies
- Material culture notes
- Clothing anthropology references

Personal visual observations

- Why certain fits feel too “resolved”
- Why ambiguity matters
- Why certain silhouettes work on you
- Notes from real outfit experimentation
- Observations about contemporary reinterpretation

---

## Taxonomy Research

### TAGS MBA

This older structure is actually useful because it shows the distinction you were naturally converging toward before the TT-specific taxonomy became more archival/editorial.
The biggest difference:
old structure:
what the image IS

new TT structure:
where the image comes FROM
Your current TT taxonomy is already stronger architecturally.
For example:
Old:
medium/outfit
medium/item
medium/book
These mix:
* subject
* format
* source object type
Whereas the newer structure separates:
* source
* platform
* medium
* subject
* project
* season
which is much more composable.
Example:
season/aw23
source/official
platform/website
medium/film
subject/concept
project/aw23-philosophy
This is far more expressive than:
medium/movie
context/editorial
because each axis is independent.
What I would carry over from the old DB:
context/*
is actually still valuable conceptually.
But I would probably rename it to something like:
mode/*
or
intent/*
Examples:
mode/lookbook
mode/editorial
mode/concept
mode/archive
mode/documentation
Because this layer answers:
what role does this image play?
which is different from:
* medium
* subject
* source
Right now your TT taxonomy slightly overloads subject/* with semantic role.
Example:
subject/lookbook
subject/concept
Those are not really subjects in the same way:
subject/garment
subject/fit
So long-term I think:
* subject/* should describe content
* another axis should describe editorial/function/context
You do not need to refactor now, but the old DB accidentally reveals this separation pretty clearly.


—


does this image belong in the same visual/conceptual space?
So I would think about MBA tags in layers of importance:
High-value tags (strongly affect generation/filtering):
subject/*
mood/*
material/*
color/*
silhouette/*
era/*
style/*
designer/*
project/*
Medium-value tags:
source/*
platform/*
medium/*
Useful mostly for:
* filtering
* provenance
* specific retrieval
* niche clustering
Low-value / optional:
exact publication origin
exact uploader
exact repost chain
unless personally meaningful.
Your instinct:
“what makes sense so I can find them quickly”
is actually correct.
Because over-tagging provenance in MBA can dilute the generation signal.
Example:
These probably belong together visually:
* screenshot from IG
* retailer product shot
* your own fitpic
* archival photo
* movie still
if they share:
material
tone
shape
mood
silhouette
lighting
texture
That is much more important than:
platform/ig
platform/website
source/retailer
So I would structure MBA around:
1. semantic content
2. visual language
3. conceptual role
4. provenance (optional/supporting)
not the reverse.
Honestly, your newer TT taxonomy risks becoming slightly too provenance-heavy for the broader MBA use case.
You already noticed this implicitly when you said:
“it doesn’t really matter exactly for each if all tags are filled”
That is a sign the taxonomy is drifting beyond the actual retrieval/generation needs.
So for broad MBA I would strongly prioritize:
* fast tagging
* incomplete-but-useful tagging
* semantic clustering
* generation coherence
* discoverability
over:
* exhaustive metadata correctness.
That is probably the right long-term direction for MBA specifically.

—


Then medium/photo is actually a good tag.
But in your case it means:
this image originates from a historical photographic artifact
not:
this is a photograph instead of a drawing
That distinction matters.
So I would keep it, but probably rename slightly for clarity long-term.
Possible options:
medium/photo
simple and fine if you already understand it internally.
Or more explicit:
medium/archival-photo
medium/historical-photo
medium/photograph
I would avoid:
medium/photography
because that sounds stylistic/disciplinary.
Honestly your meaning is closest to:
source/archive
medium/photo
combined.
Example:
source/archive
medium/photo
era/1930s
subject/fit
That becomes extremely expressive and future-proof.
Especially because later you may distinguish:
medium/photo
medium/publication
medium/document
medium/film
medium/interview
while separately distinguishing provenance:
source/archive
source/official
source/editorial
source/community
That separation is strong.
So in your case:
* keep medium/photo
* add source/archive
* optionally later add era/*
That is already very coherent.

—

subject/*  = what is shown
medium/*   = media form
source/*   = provenance/publisher
platform/* = where published
mode/*     = editorial/function role
project/*  = grouping
season/*   = chronology

—

subject/*
mood/*
material/*
color/*
silhouette/*
lighting/*
texture/*
era/*
style/*

—


source/vintage
origin/eu/france
lineage/workwear
garment/jacket
material/moleskin
color/faded-indigo
fit/wide
fit/relaxed
texture/worn
texture/repaired
reference/pre-1960 reference/1930s-1950s
era/uncertain
era/prewar-ish
image-type/fitpic

— 

source/contemporary/*
* source/contemporary-photo
* source/runway
* source/lookbook
* source/streetstyle
* source/editorial
* source/social-media

source/archival/*
* source/archival/archival-photo
* source/archival/vintage-snapshot
* source/archival/studio-portrait
* source/archival/catalog
* source/archival/military-documentation
* source/archival/book

—

### TAGS T.T

Is this:
- what the image IS
- where it came from
- what it belongs to
- what medium it is
- what event/project it references
- or what it visually contains?

—

season/*   → when / collection context
source/*   → provenance / authority
platform/* → delivery surface
subject/*  → what role the reference plays
medium/*   → presentation format
project/*  → specific body of work
event/*    → contextual occurrence
collab/*   → relationship between entities

—

Task:
Improve MBA reference tag display and preview metadata UI.

Context:
MBA tags are now structured as taxonomy families, e.g.
- season/aw21
- subject/lookbook
- platform/website
- publisher/official
- medium/film
- project/aw23-philosophy
- collab/...

On cards, the compact display intentionally hides family prefixes and shows only values, e.g.
aw21 • lookbook • website • official.

Need to make display order stable and taxonomy-driven, not based on tag insertion order.

Requirements:
1. Add centralized taxonomy display ordering.
   - Create/extend a helper that orders tags by a configured family priority.
   - Initial family order:
     - season
     - subject
     - medium
     - platform
     - publisher
     - project
     - event
     - collab
     - brand
     - remaining/unknown
   - Within a family, keep stable alphabetical or existing value order.
   - Use this helper anywhere compact tag labels are shown.

2. Keep compact card display.
   - Continue showing values only, not full `family/value`.
   - Example:
     - `season/aw21`, `subject/lookbook`, `platform/website`, `publisher/official`
     - displays as `aw21 • lookbook • website • official`
   - Do not make cards visually heavier.

3. Improve preview metadata.
   - Preview header may keep compact tags.
   - Add an Info button or compact metadata toggle.
   - When opened, show the full tag tree / full taxonomy paths for the selected reference.
   - Example:
     - season/aw21
     - subject/lookbook
     - platform/website
     - publisher/official
   - Prefer a small overlay/panel/popover, not always-visible clutter.

4. Hide preview action buttons more.
   - Current preview top-right button row is too visually prominent.
   - Make actions less dominant:
     - collapse secondary actions behind `More`
     - or reduce opacity until hover/focus
     - or keep only Next/Previous/Close visible and move Exclude/Favorite/Edit/Delete into More
   - Preserve keyboard/navigation behavior.
   - Preserve mobile usability.

5. Fix description wrapping.
   - Long descriptions currently wrap strangely in preview.
   - Ensure description/metadata text wraps predictably:
     - normal whitespace handling
     - no awkward single-character columns
     - bounded max-width
     - readable line height
     - scroll if long
   - Preserve full text content.

Implementation notes:
- Avoid hardcoding display ordering inside card components.
- Put taxonomy display helpers in a reusable file, e.g. `taggingUx.js` or a new `tagDisplay.js`.
- Do not change tag storage format.
- Do not rename existing tags automatically.
- Do not change generation scoring in this task.

Tests:
- compact tags sort by taxonomy family priority, not insertion order
- compact tag display strips family prefixes correctly
- unknown families appear last but remain visible
- preview info panel shows full tag paths
- card display remains compact
- description wrapping handles long text
- preview navigation/close still works
- mobile preview remains usable

Run:
npm run build
npm test -- --runInBand

—



## Researching Sportswear

### A) Vintage Sportswear Research Direction

Current wardrobe/research strength is primarily:

- European/French workwear
- Belgian/French moleskin
- archival utility clothing
- industrial/rural lineage
- material aging/patina
- historical workwear silhouettes

This area already feels intuitive:

- proportions
- layering
- textures
- material combinations
- visual balance
- historical references

A weaker / less-developed area currently is:  
vintage sportswear and archival athletic clothing.

This is important because many existing interests and wardrobe pieces already connect naturally to this space:

- T.T sweatshirts/hoodies
- T.T athletic reinterpretations
- archival sneakers
- Ann D sneakers
- military-athletic crossover references
- jersey/fleece materials
- minimal athletic silhouettes

The issue is not lack of garments, but lack of:

- visual vocabulary
- historical anchors
- reference density
- internalized styling language

Key realization:

Vintage sportswear operates on different principles than vintage workwear.

Workwear often emphasizes:

- utility
- material weight
- patina
- labor/history
- irregularity
- rugged layering

Sportswear often emphasizes:

- movement
- rhythm
- athletic proportion
- compression/release
- youthful silhouettes
- jersey/fleece textures
- simplicity
- mobility

Important stylistic direction:

The goal is NOT:  
“perfect heritage repro sportswear.”

The more interesting direction is:

- softened references
- ambiguity
- crossover styling
- modern reduction
- historical memory rather than costume
- understated athletic influence

This likely aligns more naturally with:

- wide trousers + athletic tops
- refined footwear + jersey/fleece
- archival athletic references in otherwise modern outfits
- softer/more abstract sportswear integration

Potential research directions:

- 1930s–60s athletic wear
- collegiate sportswear
- military PT clothing
- boxing/rowing/training wear
- early sweat/fleece development
- vintage athletic footwear
- Japanese reinterpretations of sportswear archives
- post-athletic/minimal styling approaches

Potential MBA research cluster:

- lineage/sportswear
- lineage/athletic
- material/jersey
- material/fleece
- subject/athletic-wear
- reference/movement
- reference/athletic-proportion
- reference/minimal-athletic
- reference/post-athletic
- reference/modern-reinterpretation
- era/1930s-1960s

Long-term importance:

Sportswear research may become an important counterbalance preventing the overall wardrobe/system from drifting too deeply into:

- pure heritage archetypes
- overly resolved workwear styling
- predictable repro menswear aesthetics

The goal is a broader visual language where:

- workwear
- athletic wear
- archival references
- modern silhouettes
- minimalism
- philosophy/material culture  
    can coexist more fluidly.

### B) Research directions that would probably help most:

- 1930s–60s athletic wear
    - track
    - rowing
    - military PT
    - collegiate
    - boxing
    - mountaineering
    - sweat/fleece development
- Early jersey/sweat evolution
    - loopwheel
    - undergarment → outerwear transition
    - cropped athletic proportions
- Vintage athletic footwear
    - track shoes
    - training shoes
    - military sneakers
    - basketball
    - tabi/rubber sole history
    - minimalist leather trainers
- Japanese reinterpretations
    - T.T
    - early Visvim
    - Anatomica
    - Nigel Cabourn sportswear side
    - older Undercover athletic references
    - archival military athletics

- Non-heritage styling approaches  
    Because your instinct is correct:  
    you do not want:  
    “perfect repro heritage sportswear guy.”
    
    You seem more interested in:
    
    - ambiguity,
    - crossover,
    - softened references,
    - historical memory rather than costume,
    - modern reduction.
This would fit very naturally into MBA as a dedicated research cluster:

- lineage/sportswear
- reference/athletic-proportion
- reference/movement
- material/jersey
- material/fleece
- subject/athletic-wear
- era/1930s-1960s
- reference/minimal-athletic
- reference/post-athletic
- reference/modern-reinterpretation

---

# Footwear Discussion Summary

## Core Realization

The discussion started from evaluating footwear options for a wardrobe centered around:

- Taiga Takahashi (T.T)
- Vintage European workwear (especially Belgian moleskin)
- Guidi
- Ann Demeulemeester
- Wide or relaxed trousers
- An appreciation for aging materials, historical references, and understated design

A recurring theme emerged: footwear should support the silhouette and garments rather than dominate the outfit.

---

## Morosino

The Morosino occupies the "earthy workwear" category.

### Strengths

- Rounded, substantial toe.
- Excellent with Belgian moleskin and faded denim.
- Strong aging potential.
- Feels relaxed rather than formal.
- Similar mood to Birkenstock Bostons in spirit despite being a leather derby.

### Character

- Grounded.
- Rugged.
- Organic.
- Comfortable-looking.
- Visibly handmade.

### Best With

- Vintage workwear.
- Chore coats.
- Moleskin.
- Denim.
- Knitwear.

The Morosino fills a genuine gap in the wardrobe and would likely become a frequent everyday shoe.

---

## Guidi 992

The 992 occupies the "dark artisanal elegance" category.

### Strengths

- Elegant silhouette.
- Low profile.
- Excellent under wider trousers.
- Preserves the elongated line appreciated in shoes like the New Balance 990v3.
- Works especially well with monochromatic and darker outfits.

### Character

- Architectural.
- Refined.
- Quiet.
- Intentional.

### Best With

- Black T.T outfits.
- Sumi dye pieces.
- Mud dye pieces.
- More minimal wardrobes.

The 992 is not competing with the Morosino. They solve different problems.

---

## New Balance 990v3 Connection

A key realization was that much of the attraction to the 990v3 comes from:

- The elongated shape.
- Low-profile toe.
- Smooth transition from vamp to toe.
- The way wide trousers drape over it.

This explains part of the attraction to the 992.

The appreciation is less about sneakers and more about silhouette.

---

## Technical Footwear Gap

A missing category was identified:

### Desired Category

A technical black shoe that still feels elegant.

Not:

- Salomon XT-6.
- Chunky trail runners.
- Modern gorpcore.

But something closer to:

- Approach shoes.
- Vintage mountain footwear.
- Climbing-adjacent shoes.
- Scarpa Mojito-type footwear.

### Why

The goal is a technical shoe that still preserves:

- Clean silhouette.
- Low profile.
- Elegant trouser drape.
- Historical or utilitarian character.

---

## Scarpa Mojito Discussion

The Mojito remains interesting but uncertain.

Concerns include:

- Actual toe shape in person.
- Visual bulk.
- Whether it looks too much like a hiking shoe.

The conclusion was that an in-person try-on is essential because silhouette matters more than specifications.

---

## Vintage / Approach Footwear Direction

A broader interest emerged in:

- Vintage approach shoes.
- Old Italian mountain footwear.
- Climbing shoes.
- Technical footwear with historical roots.

This category feels coherent with:

- T.T philosophy.
- Vintage workwear.
- Guidi.
- Appreciation of functional objects.

The category itself may be more interesting than any single modern model.

---

## Minezo

Initially Minezo appeared to occupy a minimal leather sneaker category.

Further discussion showed stronger similarities to:

- T.T x Brass Clinch footwear.
- Historical leather trainers.
- Low-profile heritage footwear.

### Strengths

- Elegant.
- Restrained.
- Low profile.
- Quiet.

### Concerns

- Potentially too refined.
- Might be admired more than worn.

Minezo became more interesting after being compared directly to T.T footwear.

---

## T.T x Brass Clinch Milne Shoe

The Milne emerged as the most philosophically "T.T" shoe.

### Why

The shoe is repeatedly used in T.T lookbooks and reflects the same values as the clothing:

- Historical without being costume.
- Elegant without being formal.
- Functional without appearing rugged.
- Minimal without being sterile.

### Characteristics

- Extremely low profile.
- Softly squared toe.
- Close to the ground.
- Almost disappears beneath the trouser hem.

### Key Observation

The Milne does not function as a dress shoe.

It functions almost like a historical everyday trainer.

Its role is to support the outfit rather than become the focus.

### Limitation

Extremely difficult to acquire due to rarity and low production numbers.

The conclusion was that the Milne represents an ideal but should not become an obsession because it may simply never become available.

---

## Carmina Wholecut Oxford

The Carmina was recognized as objectively beautiful but somewhat disconnected from the rest of the wardrobe.

### Why

- Too polished.
- Too formal.
- Too perfect.

Compared with:

- Belgian moleskin.
- T.T.
- Guidi.
- Vintage workwear.

It felt like the least natural fit.

---

## Final Footwear Categories

Three distinct directions emerged:

### 1. Workwear / Earthy

- Morosino
- Vintage approach shoes
- Mountain footwear

### 2. Dark Artisanal

- Guidi 992
- Guidi 995
- Ann D sneakers

### 3. Historical Minimalism

- Milne
- Minezo
- Historical trainer-inspired footwear

---

## Main Conclusion

The footwear that most closely embodies the Taiga Takahashi philosophy is the Milne.

The footwear most likely to become long-term daily favorites are the Morosino and Guidi 992 because they integrate naturally into the existing wardrobe while offering distinct silhouettes and roles.

The broader realization is that the underlying attraction is not to specific brands but to a consistent set of qualities:

- Low profile.
- Close to the ground.
- Rounded or softly squared toe.
- Historical references.
- Functional origins.
- Minimal visual noise.
- Strong silhouette under wider trousers.
- Ability to age beautifully over time.

---

# Tagging Process

That’s actually where I think the highest ROI is now.

Not creating new taxonomy branches.

Not designing new tag structures.

Just gradually improving coverage.

Looking at your counts, you already have the framework. The problem is probably:

```text
Image A:
brand/t.t
subject/fit

Image B:
brand/t.t
subject/fit
origin/asia/japan

Image C:
brand/t.t
subject/fit
origin/asia/japan
reference/modern-reinterpretation
```

So retrieval becomes inconsistent.

---

If it were my archive, I would stop thinking:

“What new tags do I need?”

and start thinking:

“Which existing tags are missing most often?”

For example:

### **Pass 1: Origin**

Filter:

```text
NOT origin/*
```

Then rapidly add:

```text
origin/eu/france
origin/usa
origin/asia/japan
```

to hundreds of images.

---

### **Pass 2: Period**

Filter:

```text
period/archival
```

Then gradually add:

```text
era/1900s
era/1910s
era/1920s
era/1930s
era/1940s
```

where obvious.

---

### **Pass 3: Subject archetypes**

Look at:

```text
subject/garment/jacket
```

and identify:

```text
black-moleskin
wool-farmers-jacket
german-knit
indigo-linen
atelier-coat
```

This is probably where the most future value sits.

---

### **Pass 4: Modern interpretation**

This one may actually be missing from many images.

For example:

- Brass
- Clinch
- Taiga Takahashi
- Freewheelers
- vintage-inspired Japanese brands

could often receive:

```text
reference/modern-reinterpretation
```

---

What I would _not_ do is try to fully tag every image.

At 4,000+ images that’s a trap.

Instead:

```text
Image has 1 useful tag
↓
Add 1–2 missing tags
↓
Move on
```

Over time you’ll get:

```text
brand
subject
origin
```

on 90% of images.

Then:

```text
period
lineage
reference
```

on the images where they matter.

That’s usually enough to make an archive feel complete without turning tagging into a full-time job.