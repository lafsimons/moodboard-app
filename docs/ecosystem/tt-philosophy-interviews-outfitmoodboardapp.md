# [[tt-philosophy-interviews-outfitmoodboardapp|T.T - Philosophy - Interviews]]

---

# **T.T. Archive Metadata & File Naming Discussion**

## **Core realization**

For previous T.T. seasons, image ordering was manually reconstructed in Freeform to match the official website. This successfully preserved visual browsing order inside MBA, but important metadata such as lot numbers and colorways were lost during the process.

For SS26 and future seasons, the goal became preserving both:

- website image order
- product metadata

without creating a large manual tagging burden.

---

## **Revised filename strategy**

Instead of generic numbered filenames:

```text
ss26-0001.jpg
```

preserve key product information directly in filenames:

```text
ss26-lot112-black-01.jpg
ss26-lot112-black-02.jpg
ss26-lot112-ivory-01.jpg
ss26-lot113-akitasugi-dark-blue-01.jpg
```

This preserves:

- season
- lot number
- colorway
- image sequence

while maintaining correct ordering.

The image sequence can be zero-padded later through automation if needed.

---

## **Lot metadata vs color metadata**

### **Lot metadata**

Lot numbers appear highly valuable because:

- T.T. is organized around lots
- lots are stable identifiers across seasons, lookbooks, product pages, and resale listings
- lots enable future grouping, filtering, and relationship systems
- lots are referenced naturally when discussing garments

Lot metadata is considered structural information.

### **Color metadata**

Color metadata is useful but lower priority.

Color can often be inferred visually from the image itself, while lot information cannot.

Therefore:

- preserve color if it can be done cheaply
- avoid extensive manual color tagging projects

---

## **Recommended archive scope**

Full lot coverage is only worthwhile for:

- official website product images
- official lookbook images

Lot-tagging every:

- Instagram image
- Grailed listing
- customer photo
- random reference image

would require disproportionate effort.

The official product ecosystem provides the highest value per minute invested.

---

## **Future metadata extraction**

Because lot and color are now embedded in filenames, future MBA functionality could automatically derive:

```text
season/ss26
lot/112
color/black
```

from:

```text
ss26-lot112-black-01.jpg
```

This removes the need for immediate manual tagging.

---

## **Product descriptions and website information**

The most valuable remaining information on the T.T. website is not color or tags but official product information.

Examples:

- product names
- historical references
- fabric descriptions
- dye explanations
- construction details
- measurements
- materials
- pricing
- country of origin

Unlike color, this information cannot be reconstructed later from images.

---

## **Priority shift**

The discussion concluded that preserving official website information may be more valuable than additional image tagging.

Suggested extraction priority:

1. Lot number
2. Product name
3. Season
4. Colorways
5. Product description
6. Materials
7. Measurements
8. Product URL

Images alone do not preserve this knowledge.

---

## **Website archival lesson**

Using “Save Page As…” successfully captured all product images.

However, the saved HTML and supporting files were deleted, leaving only the images.

Going forward, official product page information should also be preserved whenever possible, either as:

- saved HTML pages
- markdown notes
- database entries
- future automated extraction

before product pages disappear or change.

---

## **Current conclusion**

The current SS26 workflow is significantly better than the previous Freeform-based workflow because it preserves:

- official image order
- lot numbers
- colorways

without requiring extensive manual tagging.

Next archival priority:

- finish remaining SS26/AW26 image imports
- preserve official website product information
- continue tagging MBA Personal Library and T.T. Research Library
- avoid large-scale retroactive metadata projects unless they provide clear value