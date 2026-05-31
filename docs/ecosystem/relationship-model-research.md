# Relationship Model Research

Garment ↔ Outfit
Garment ↔ Reference
Reference ↔ Board
Outfit ↔ Fitpic
Text ↔ Entity
Future HubLink evolution

---

## Core Relationship Requirements

Relationships should:

- connect any entity type
- support many-to-many relationships
- use stable entity IDs
- survive migrations
- survive sync
- survive import/export
- remain application-independent

## Shared Entity Ecosystem

Long-term direction:

All major objects may eventually participate in a shared entity system.

Examples:

- garments
- outfits
- references
- boards
- fitpics
- text nodes
- philosophy nodes

The goal is to enable relationships without forcing all entities into the same application.

## Relationship Cardinality

Relationships should support:

- one-to-one
- one-to-many
- many-to-many

Examples:

Garment ↔ Outfit
Reference ↔ Board
Outfit ↔ Fitpic
Text ↔ Entity

## Candidate Relationship Types

Garment ↔ Outfit
- appears in
- primary garment of
- worn in

Garment ↔ Reference
- inspired by
- resembles
- references
- derived from

Reference ↔ Board
- included in
- generated into
- related to

Outfit ↔ Fitpic
- documents
- worn as
- variation of

Text ↔ Entity
- discusses
- references
- documents
- explains

## HubLink Direction

HubLink may eventually become the canonical ecosystem-level relationship object.

Entity A
    ↔
 HubLink
    ↔
Entity B

The goal is to support cross-library and cross-application relationships without requiring entities to live inside the same application.

## Relationship Semantics

Possible relationship semantics:

- inspired by
- references
- documents
- derived from
- similar to
- replaces
- part of
- works with

## Relationship / Knowledge Graph Vision

The long-term goal is not simply to store items, images,
boards, outfits, or libraries.

The goal is to build a connected graph of entities and relationships.

Examples:

Person
 ├── wears → Garment
 ├── appears in → Image
 └── influences → Designer

Garment
 ├── belongs to → Collection
 ├── references → Historical Garment
 ├── appears in → Outfit
 └── appears in → Moodboard

Image
 ├── depicts → Garment
 ├── depicts → Person
 ├── belongs to → Library
 └── references → Concept

Board
 ├── contains → Image
 ├── explores → Concept
 └── inspired by → Reference

Outfit
 ├── contains → Garment
 ├── references → Board
 └── expresses → Style

Over time, OA and MBA become different interfaces
onto the same underlying relationship graph.

MBA emphasizes inspiration, references, research,
and discovery.

OA emphasizes garments, outfits, wardrobe management,
and styling.

The underlying entities and relationships may eventually
be shared.

## Open Questions

- Directed vs undirected relationships?
- Typed relationships?
- Relationship metadata?
	- Potential metadata:
		- relationship type
		- creation timestamp
		- source application
		- confidence/strength
		- notes
- Relationship versioning?
- Relationship ownership?
- Storage location?
- Cross-library resolution?