# Glossary

| **Term**                            | **Use this meaning**                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ecosystem**                       | The full OA + MBA + future Hub system.                                                                                                           |
| **OA**                              | Outfit-App; owns wardrobe, outfits, outfit generation, styling context.                                                                          |
| **MBA**                             | Moodboard-App; owns references, boards, visual exploration, research/taste development.                                                          |
| **Hub**                             | Ecosystem layer above apps/libraries. Coordinates search, relationships, indexing, navigation, backup orchestration. Does not own app workflows. |
| **Library**                         | First-class user-facing container of content. Examples: Personal MBA, T.T MBA, OA Wardrobe, OA Fitpics.                                          |
| **Collection**                      | Subgroup or organizational grouping inside a library. Avoid using it as a synonym for Library.                                                   |
| **Archive**                         | Preservation-oriented library/export/context. Use when archival fidelity and provenance matter.                                                  |
| **Entity**                          | Any object that can participate in relationships: OA item, MBA reference, board, outfit, fitpic, text node, philosophy node, library.            |
| **Asset**                           | Canonical media object or media record. Use for the media layer, not for every visible image.                                                    |
| **Original**                        | Original source file belonging to an asset. Usually archival.                                                                                    |
| **Preview Asset**                   | Portable render asset used for normal browsing/sync/runtime display.                                                                             |
| **Render**                          | Derived visual representation generated from asset + metadata/settings.                                                                          |
| **Preview**                         | Small/portable derived render used in UI, sync, miniature cards, etc.                                                                            |
| **Thumbnail**                       | Smaller preview variant. Use only when size/scale distinction matters.                                                                           |
| **Image**                           | Generic visible visual content. Avoid when you mean Asset, Original, Preview, or Reference.                                                      |
| **Reference**                       | MBA domain object: an image/reference entry used for boards, inspiration, research, and taste development.                                       |
| **Board**                           | MBA composition made from references/images.                                                                                                     |
| **Moodboard**                       | User-facing concept. Prefer **Board** in technical/docs context.                                                                                 |
| **OA Item**                         | Canonical OA object representing a wardrobe/inventory object.                                                                                    |
| **Garment**                         | Real-world clothing/accessory represented by an OA Item, or a garment depicted in a reference.                                                   |
| **Wardrobe Item**                   | Acceptable user-facing synonym for OA Item, but avoid in architecture docs.                                                                      |
| **Inventory Item**                  | Avoid unless discussing generic inventory systems. Prefer OA Item.                                                                               |
| **Outfit**                          | OA composition made from OA Items.                                                                                                               |
| **Fitpic**                          | Real-world worn image/documentation of an outfit or garment.                                                                                     |
| **Relationship**                    | First-class semantic edge between entities.                                                                                                      |
| **HubLink**                         | Implementation/storage object for cross-app/cross-library relationships.                                                                         |
| **Link**                            | Informal verb only. Avoid as a noun unless specifically referring to HubLink.                                                                    |
| **Reference relationship**          | Avoid. Use either **Reference** as MBA object or **Relationship** as graph edge.                                                                 |
| **Taxonomy**                        | Semantic classification: what something is/means.                                                                                                |
| **Tag**                             | Concrete taxonomy label applied to an entity/reference/item.                                                                                     |
| **Metadata**                        | Objective or operational properties: filename, import date, dimensions, SKU, provenance.                                                         |
| **Lifecycle**                       | Status/workflow state: wishlist, incoming, wardrobe, selling, sold.                                                                              |
| **Provenance**                      | Where something came from and how it entered the system.                                                                                         |
| **Direction**                       | Intended generation target/theme.                                                                                                                |
| **Seed Direction**                  | Explicit input used to guide generation.                                                                                                         |
| **Board Tags / Current Board Tags** | Observed tags present in a generated/current board. Not the same as direction.                                                                   |
| **Dominant Tag**                    | Existing/scorer-derived heuristic. Treat as implementation detail, not conceptual direction.                                                     |