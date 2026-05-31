# Taxonomy

## **Taxonomy Principles**

```text
Taxonomy should describe what something is.

Relationships should describe how things connect.

Metadata should describe objective properties.

Lifecycle should describe status and workflow state.
```

---

## **Taxonomy vs Metadata**

Examples:

**Taxonomy**

```text
lineage/workwear
origin/eu/france
material/moleskin
reference/patina
```

Used for:

- browsing
- filtering
- grouping
- generation

---

**Metadata**

```text
original filename
capture date
import source
image dimensions
camera metadata
season
SKU
```

Used for:

- provenance
- auditing
- recovery
- import/export

Not normally used as semantic tags.

---

## **Taxonomy vs Relationships**

Taxonomy:

```text
lineage/workwear
reference/patina
```

Relationship:

```text
Garment A inspired by Reference B
Fitpic documents Outfit C
Board contains Reference D
```

Relationships connect entities.

Tags describe entities.

---

## **Taxonomy vs Lifecycle**

Lifecycle is mutable state.

Examples:

```text
wishlist
incoming
wardrobe
selling
sold
```

These should probably not be tags.

They are workflow state.

This becomes especially important because you already moved OA toward Statuses in the roadmap.

---

## **Provenance vs Semantic Tags**

This is probably the most important missing section.

Example:

**Provenance**

```text
source/vintage
source/official
source/retailer
medium/editorial
origin/japan
```

Describes where something came from.

---

**Semantic**

```text
lineage/workwear
reference/patina
subject/garment
material/moleskin
```

Describes what it means.

The distinction becomes important because provenance tends to be objective while semantic tags are interpretive.

---

## Canonical taxonomy

### Personal Moodboard Library

medium/*
* book
* film
* editorial
* runway
* photo
* personal
* screenshot
* scan
* ig (maybe)
* text
    * medium/text/interview
    * medium/text/article
	(Potentially even excerpts/highlights attached as notes.)

lineage/*
* lineage/workwear/rural
* lineage/workwear/maritime
* lineage/workwear/mining
* lineage/workwear/atelier
* lineage/workwear/industrial
* lineage/military
* lineage/outdoor
* lineage/sportswear

reference/*
- (only add more if the image was saved for a specific reason)
* reference/silhouette
* reference/layering
* reference/cap-proportions
* reference/fabric-behavior
* reference/tonal-balance
* reference/patina
* reference/fit
* reference/philosophy
* reference/material-culture
* reference/garment-essence
* reference/modern-reinterpretation

subject/*
- subject/garment/*
- subject/fit
- subject/interior
- subject/landscape/nature
* subject/object
* subject/portrait
* subject/concept
* subject/lookbook
- …

era/*
* era/1900s
* era/1910s
* era/1920s
* era/1930s
* era/1940s
* era/pre-1950s
* era/postwar
- 

origin/*
- origin/eu/france
- origin/eu/*
- origin/usa
- origin/china
- origin/japan

period/*
- period/archival

### T.T library

season/*
source/*
    official
    retailer
    staff
    editorial
    community
platform/*
    website
    ig
subject/*
    garment
    fit
    lookbook
    concept
    store
event/*
collab/*
medium/*
    film
    publication
    editorial
    interview
    campaign
    archive
    document
project/*
    tt-archive

## Taxonomy Growth Rules

Prefer:
- extending existing branches
- adding tags only when recurring patterns emerge
- stable naming conventions

Avoid:
- one-off tags
- duplicate meanings
- excessively specific branches
- tags that belong in metadata or relationships

