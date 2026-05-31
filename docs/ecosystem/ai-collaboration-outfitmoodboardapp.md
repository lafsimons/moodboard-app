
- /Users/lafsimons/Desktop/outfit-app/docs/ecosystem/core-outfitmoodboardapp.md
- /Users/lafsimons/Desktop/outfit-app/docs/ecosystem/roadmap-outfitmoodboardapp.md
- /Users/lafsimons/Desktop/outfit-app/docs/ecosystem/active-context-outfitmoodboardapp.md
- /Users/lafsimons/Desktop/outfit-app/docs/sync-cloud-v1-outfitmoodboardapp.md

## Reminders Codex

I would put this at the top of almost every implementation prompt:
Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md
- docs/ecosystem/sync-cloud-v1-outfitmoodboardapp.md

Preserve existing ecosystem direction and architectural principles.
Avoid introducing isolated app-specific systems when shared concepts already exist.
That is probably enough for 80–90% of prompts.

⸻

Then only add extra contextual reminders when the task is high-risk.
Examples:
For local filter/state tasks
Important:
- Selector/Dashboard/Saved-Outfits filters are local per surface.
- Do not reuse or mutate global wardrobe filter state.
For OA interaction tasks
Important:
- Preserve current outfit generation behavior unless explicitly requested otherwise.
- Avoid introducing automatic rerolls from UI-only actions.
For MBA editor/layout tasks
Important:
- Preserve current compact MBA design direction.
- Avoid introducing larger spacing or multi-row header growth.

⸻

I would not dump huge context blocks into every prompt.
Too much context can make Codex:
* overgeneralize
* touch unrelated files
* start “improving” architecture you did not ask for
Short architectural constraints + focused task prompt is usually best.

## ChatGPT

- “Does this idea already exist somewhere?”
- “Where should this feature belong?”
- “Is this consistent with the architecture?”
- “What are my current priorities?”
- “What changed since the last roadmap review?”
- “Is this a core concept, backlog item, or future idea?”

The next useful step would probably be a documentation audit focused on:

1. Duplicate concepts across documents.
2. Concepts that exist only in chats but not in docs.
3. Roadmap items that should be promoted to Core.
4. Core concepts that are still buried in Working Notes.
5. Missing links between documents.
6. Areas where OA and MBA responsibilities are still not clearly separated.

---

# Product Backlog Prompts

## 1. saved thumbnail/miniature rendering in OA and MBA.

Audit saved thumbnail/miniature rendering in OA and MBA.

Important:
- Consider storage/performance implications.
- Preserve compatibility with older saved outfits/boards.

Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md

Preserve existing ecosystem direction and architectural principles.
Avoid introducing isolated app-specific systems when shared concepts already exist.

Goal:
When saving an outfit or board, the saved miniature should look more like a small screenshot of the actual outfit/board at save time.

Please inspect:
- OA saved outfit thumbnail generation/rendering
- MBA saved board thumbnail generation/rendering
- whether thumbnails are currently generated from item images, layout data, canvas DOM, or separate preview components
- whether a screenshot-style thumbnail can reuse the existing visible outfit/board canvas
- where thumbnail data is stored
- whether saved thumbnails update only on save or also after edits
- any performance/storage risks

Return a concise plan for each app.
Do not implement yet.

—

Implement screenshot-style saved outfit miniatures in OA.

Important:
- Avoid blocking UI noticeably during save.
- Preserve existing saved outfit behavior.

Requirements:
- When saving an outfit, generate a miniature that visually resembles the current outfit layout.
- The miniature should look like a small screenshot/preview of the outfit, not just a generic item collage.
- Preserve current saved outfit data and loading behavior.
- Existing saved outfits without screenshot-style thumbnails should still render safely.
- Avoid blocking the UI noticeably during save.
- Add/update tests where practical.

—

Implement screenshot-style saved board miniatures in MBA.

Important:
- Preserve current board save/load behavior.
- Avoid expensive rerenders during save.

Requirements:
- When saving a board, generate a miniature that visually resembles the current board layout.
- The miniature should look like a small screenshot/preview of the board, including image placement/scale as much as practical.
- Preserve current saved board data and loading behavior.
- Existing saved boards without screenshot-style thumbnails should still render safely.
- Avoid blocking the UI noticeably during save.
- Add/update tests where practical.

---

## 2. Selector local search/filter/sort

Audit OA local collection controls for Selector, Saved Outfits, and Fitpics. (done)

Important:
- Selector filters/search/sort are local to the selector only.
- Do not mutate or reuse global wardrobe filter state.
- Preserve slot validity and generation behavior.

Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md

Preserve existing ecosystem direction and architectural principles.
Avoid introducing isolated app-specific systems when shared concepts already exist.

Goal:
- Add local search/filter/sort controls to multiple local collections without affecting global Wardrobe state.

Please inspect:
- Outfit item selector from Outfit view
- Saved Outfits view
- Fitpics view, if present/currently implemented
- Existing Wardrobe search/filter/sort logic

Return a concise implementation plan covering:
- which controls should be shared/reused
- which state should remain local per view
- what filters make sense for each collection
- whether Saved Outfits/Fitpics have enough metadata to filter meaningfully
- where tests should be added

Do not implement yet.

—

Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md

Implement the first slice of OA local collection controls: shared pure helpers + Selector-local controls only.

Use the audit plan as direction:
- Share pure collection-control primitives, not a global store.
- Keep all selector controls local to the selector.
- Do not mutate Wardrobe search/filter/sort state.
- Do not implement Saved Outfits controls yet.
- Do not implement Fitpics controls yet.

Requirements:

1. Extract/reuse pure helpers
- Extract shared search/filter/sort primitives from existing Wardrobe/Dashboard logic where sensible.
- Prefer pure helper functions over App-level duplicated logic.
- Keep shared logic data-shape driven where practical.
- Do not introduce a global collection-controls store.

2. Selector-local controls
- Add local search/filter/sort controls to the Outfit item selector opened from Outfit view.
- These controls affect only the currently open selector.
- Controls must reset or remain scoped appropriately when switching selector slots.
- Filtering must apply after building the slot-valid candidate pool, not before.
- Preserve slot validity rules.
- Preserve exclude behavior.
- Preserve reroll/generation behavior.
- Preserve existing selector open/close behavior.

3. Independence from Wardrobe
- Selector search/filter/sort must not read from or write to Wardrobe filters/sort/search.
- Wardrobe controls must remain unchanged when using selector controls.
- Selector controls must not filter the Wardrobe view.

4. Tests
- Add/update helper tests for extracted pure functions.
- Add regression coverage where practical to confirm selector-local controls do not mutate Wardrobe state or generation semantics.

Do not implement Dashboard, Saved Outfits, or Fitpics controls in this task.



—

1. Add local Sort, Filter, and Search controls to the OA outfit item selector.

Requirements:
- Controls only affect the currently open selector.
- Do not change global Wardrobe search/filter/sort state.
- Filtering applies only to the selected slot candidate pool.
- Preserve slot validity rules.
- Reuse existing Wardrobe control logic where sensible.
- Keep selector state independent.
- Do not change Saved Outfits or Fitpics in this task.

— go to 3. Dashboard local filters next, then:

2. Add local Search, Sort, and Filter controls to OA Saved Outfits.

Requirements:
- Controls only affect Saved Outfits.
- Do not change global Wardrobe search/filter/sort state.
- Search should match outfit name/title if present and item names/tags inside the saved outfit.
- Sort should support at least newest/oldest if timestamps exist.
- Filter should use only reliable saved-outfit metadata; do not invent new required metadata.
- Preserve existing saved outfit open/load/delete behavior.

—

3. Fitpics later (probably audit-first)

Add lightweight local Search/Sort controls to OA Fitpics, if the current data model supports it.

Requirements:
- Controls only affect Fitpics.
- Do not change global Wardrobe state.
- Search should match title/name/notes/tags only if those fields exist.
- Sort should support newest/oldest if timestamps exist.
- Do not add a complex filter UI unless Fitpics already have meaningful metadata to filter by.
- Preserve existing Fitpic behavior.

---

## 3. Dashboard local filters

Audit OA Dashboard filter state and analytics data flow.

Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md

Preserve existing ecosystem direction and architectural principles.
Avoid introducing isolated app-specific systems when shared concepts already exist.

Important:
- Dashboard filters are local to Dashboard only.
- Wardrobe filters must remain untouched.
- Dashboard filters only affect analytics/stats/charts.

Goal:
Dashboard filters should be independent from Wardrobe filters.

Requirements:
- Dashboard filters must not change Wardrobe filters.
- Wardrobe filters must stay exactly as they were when navigating back from Dashboard.
- Dashboard filters only affect Dashboard graphics, stats, and analytics info.
- No Dashboard filters active = analytics use the full wardrobe dataset.
- Dashboard filters active = analytics use only the filtered subset.
- Search can remain hidden/disabled in Dashboard for now.

Please inspect:
- where Dashboard currently reads filter/search state
- whether it is reusing Wardrobe filter state
- which Dashboard charts/stats depend on filtered data
- what local Dashboard filter state should look like
- any tests that should be added

Do not implement yet. Return a concise implementation plan.

—

Implement local Dashboard filters in OA.

Requirements:
- Dashboard has its own local filter state, separate from Wardrobe.
- Changing Dashboard filters must not modify Wardrobe filters.
- Navigating between Dashboard and Wardrobe must preserve each surface’s own filters.
- Dashboard filters apply only to Dashboard analytics:
  - charts
  - graphics
  - counts/stats
  - summaries/info panels
- No Dashboard filters active = use all wardrobe items for analytics.
- Dashboard search remains hidden/disabled for now.
- Preserve existing Dashboard layout except for the earlier search-hidden/filter-position adjustment.
- Add/update tests where practical to confirm Dashboard and Wardrobe filter state are independent.

---

## 4. OA — Add Name A–Z Sorting

Add alphabetical sorting (Name A–Z) where missing across OA wardrobe/outfit item views.

Requirements:
- Sort using the item display name.
- Handle missing/empty names gracefully.
- Preserve existing sort modes and defaults.
- Ensure sorting works together with:
  - filters
  - search
  - generation-related views where applicable

Run:
- npm test -- --runInBand
- npm run build

## 5. OA — Filter UX Improvements

Improve several small but high-impact OA filtering interactions.

Requirements:
- Add shift-click exclude behavior to wardrobe filters.
- Add shift-click exclude behavior to outfit filters.
- Improve active filter pills:
  - existing active filter pills should become directly removable
  - add a small × affordance on hover/tap
  - clicking it removes only that specific filter
- Add alphabetical sorting (Name A–Z) where missing in wardrobe/outfit item views.

Goals:
- reduce filter friction
- improve iterative filtering speed
- preserve existing filtering/generation behavior
- keep interactions lightweight and fast

Run:
- npm test -- --runInBand
- npm run build

---

## 6. Accessory visibility system 

Please inspect the current OA accessory/layering display logic and propose an implementation plan for per-item accessory visibility.

Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md

Preserve existing ecosystem direction and architectural principles.
Avoid introducing isolated app-specific systems when shared concepts already exist.

Important:
- Preserve current outfit generation behavior.
- Separate visual visibility from inventory existence/generation eligibility.

Goal:
- Each inventory item should have a toggle to enable/disable its visible square/accessory marker in outfit display.
- When toggling layering/accessory display globally on/off, it should enable/disable all relevant accessory visibility states.

Please identify:
- where the current visible square/accessory marker is controlled
- what state should be stored per inventory item
- whether this should be persisted in item metadata
- how the global toggle should interact with individual item toggles
- any edge cases before implementation

Do not implement yet. Return a concise plan and recommended data shape.

—

Implement per-item accessory visibility in OA based on the agreed plan.

Important:
- Hidden accessory indicators should not remove items from inventory or generation.
- Preserve import/export compatibility.

Requirements:
- Add a persisted per-item toggle controlling whether the visible square/accessory marker appears for that item.
- The toggle should be available in the item editor.
- Disabled items should still exist in inventory and generation; only the visual square/accessory marker is hidden.
- Global layering/accessory visibility toggle should be able to enable/disable all relevant item visibility states.
- Preserve existing outfit generation behavior.
- Preserve existing item metadata during import/export.
- Add/update tests for persistence and display behavior where applicable.

---

## 7. OA — Accessory UX Improvements

Improve accessory interactions and presentation.

Requirements:
- If accessories are currently disabled and the user clicks `Equip` on an accessory:
  - automatically enable accessories
  - immediately equip the selected accessory
- Add the same hover/quick actions to accessory items that normal wardrobe items have where applicable:
  - quick edit
  - quick select
- Remove accessory shadow styling for cleaner visual integration with outfits.

Goals:
- improve accessory usability
- make accessory cards behave more consistently with normal items
- reduce interaction friction
- preserve existing generation/equip behavior

Run:
- npm test -- --runInBand
- npm run build

---

## 8. OA layering toggle behavior for outer/top slots

Audit OA layering toggle behavior for outer/top slots.

Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md

Preserve existing ecosystem direction and architectural principles.
Avoid introducing isolated app-specific systems when shared concepts already exist.

Important:
- Preserve locked slots where possible.
- Avoid automatic rerolls when toggling layering.

Goal:
When layering is turned off, I want control over which currently equipped outer/top item stays visible/equipped.

Please inspect:
- how layering on/off currently changes outfit slots
- how TopInner / TopOuter / Outerwear are represented
- what happens when both inner and outer items are equipped
- whether current behavior removes/hides one item or regenerates/reassigns slots
- where this state should be controlled from

Return a concise recommendation for:
- how the app should decide which item stays when layering is turned off
- whether the user should choose manually at toggle time or set a preference
- what UI pattern would fit best
- any risks for generation/locking behavior

Do not implement yet.

—

Important:
- Turning layering off should not regenerate the outfit automatically.
- Preserve lock behavior and slot consistency.

When turning layering off:
- if only one top/outer item exists, keep it
- if both inner and outer exist, show a small choice:
  "Keep inner" / "Keep outer"
- remember the last choice as the default
- do not regenerate the outfit automatically
- preserve locked slots where possible

---

## 9. Selector controls / actions dropdown / preview redesign

Audit OA outfit item actions before redesigning controls.

Before making changes, read:

- docs/ecosystem/core-outfitmoodboardapp.md
- docs/ecosystem/roadmap-outfitmoodboardapp.md
- docs/ecosystem/working-notes-outfitmoodboardapp.md

Preserve existing ecosystem direction and architectural principles.
Avoid introducing isolated app-specific systems when shared concepts already exist.

Please inspect the current actions available from Outfit view, item selector, and preview view.

I want to consolidate actions into a cleaner pattern later:
- Lock
- Reroll
- Previous
- Next
- Remove
- Edit
- Preview
- Select/Replace

Please return:
- where each action currently lives
- which actions are slot-level vs item-level
- which actions depend on selector state
- which actions depend on locked/equipped state
- a recommended grouping for a future compact Actions dropdown

Do not implement yet.

—

Refactor OA Outfit view hover actions into a compact Actions dropdown.

Important:
- Preserve existing action behavior.
- Keep hover UI compact and low-noise.
- Do not redesign preview view in this task.

Requirements:
- Keep the existing direct hover affordance minimal.
- Add an Actions dropdown for outfit item actions.
- Include applicable actions:
  - Lock / Unlock
  - Reroll
  - Previous
  - Next
  - Remove
  - Edit
- Use icons where existing icons already exist.
- Preserve all current behavior for each action.
- Disable or hide actions that are not applicable for the current slot/item state.
- Do not redesign preview view in this task.
- Do not change selector filtering/sorting in this task.

—

Redesign OA item preview action layout to reduce button clutter.

Important:
- Reduce clutter without hiding important actions.
- Preserve contextual outfit controls when opened from Outfit view.

Requirements:
- Keep item information readable.
- Group actions into clearer hierarchy:
  - primary contextual action: Equip / Unequip
  - item actions: Favorite, Edit
  - outfit/slot actions where relevant: Lock, Reroll, Previous, Next, Remove
- Use an Actions dropdown for secondary outfit/slot actions if the preview was opened from Outfit view.
- Use a heart icon for Favorite.
- Equip/Unequip should use the same visual style as other preview buttons, not a black primary button.
- Preserve existing functionality.
- Do not change item editor layout in this task.

---

## 10. MBA — Board Image “Show in Library” Action

Add a `Show in Library` action for images selected from board view.

Requirements:
- When an image is selected/clicked in board view, provide a `Show in Library` action.
- Clicking it should:
  - open the Library view
  - reveal the corresponding library image
  - select or focus that image
- Preserve context cleanly:
  - do not lose the current board
  - do not mutate image metadata
  - do not trigger generation or filtering changes unintentionally
- Handle cases where the image no longer exists in the library gracefully.

Run:
- npm test -- --runInBand
- npm run build

---

## 11. MBA — Crop Preset Improvements

Improve crop controls by adding common aspect-ratio presets.

Requirements:
- Add crop preset options:
  - Original
  - 4:3
  - 4:5
  - 16:9
- Preserve existing custom/manual crop behavior if present.
- Preserve existing crop persistence behavior.
- Keep the crop workflow lightweight and fast.
- Applying a preset should update the crop preview clearly before saving/applying.
- Avoid changing unrelated editor behavior.

Run:
- npm test -- --runInBand
- npm run build

---

## 12. OA — Wardrobe Image Export Improvements

Improve wardrobe image export for sharing/documentation.

This refers specifically to exporting a visual wardrobe overview image, not JSON backup export.

Requirements:
- Add a dedicated wardrobe image export mode/layout.
- Allow choosing export order:
  - current visible order
  - alphabetical
  - randomized
- Improve visual layout consistency:
  - cleaner spacing
  - more consistent image sizing
  - better alignment/grid behavior
- Support large wardrobe exports more gracefully.
- Keep exports visually clean for:
  - wardrobe documentation
  - sharing
  - archiving/reference

Nice to have:
- configurable background color
- configurable padding/gap size
- optional item labels/names
- export aspect ratio presets

Run:
- npm test -- --runInBand
- npm run build

---

## 13. OA — Replace “List” With Status + Collections System

Refactor the current wardrobe “list” model into two separate concepts:

1. Status (system lifecycle state)
2. Collections (user-defined organizational groupings)

Current lists:
- Interested
- Wishlist
- Incoming
- Wardrobe
- Selling
- Sold

should become a singular status field instead.

Requirements:

### Status
- Rename current list concept to status.
- Status remains singular (one status per item).
- Existing statuses:
  - Interested
  - Wishlist
  - Incoming
  - Wardrobe
  - Selling
  - Sold
- Preserve all existing filtering/generation behavior tied to current lists/statuses.

Example:
js status: "wardrobe" 

### Collections
Add a new multi-select collections system for user-defined organizational groupings.

Examples:
- Artisanal
- Active
- Beaters
- Summer
- Travel
- Gym
- Rain
- etc.

### Required UI integration points

Add `status` and `collections` support everywhere the old list/lifecycle field is currently used.

Required areas:
- Item editor
  - show `Status` as a singular lifecycle field
  - show `Collections` as a multi-select editable field
  - allow creating/selecting collections from the editor

- Wardrobe filter
  - allow filtering by Status
  - allow filtering by Collections
  - collections should behave like normal multi-select filters

- Bulk actions / bulk edit
  - allow changing Status for selected items
  - allow adding/removing Collections for selected items
  - do not overwrite all collections unless explicitly intended

- Controls / generation filter
  - allow generation to be constrained by Status
  - allow generation to be constrained by Collections
  - preserve existing generation behavior unless filters are actively set

Requirements:
- users can create/edit/remove collections
- items can belong to multiple collections
- collections should support filtering
- collections should remain lightweight organizational metadata
- avoid introducing complex hierarchy/nesting
- do not duplicate wardrobe logic

Example:
js collections: ["artisanal", "summer"] 

### UX Goals
The distinction should be:

- Status = lifecycle/state of the item
- Collections = flexible personal organization

The goal is to avoid repeatedly hardcoding special wardrobe modes such as “functional wardrobe,” “active wardrobe,” etc.

### Important
- Preserve migration compatibility with existing data.
- Existing items/lists should migrate automatically into the new status field.
- Avoid large-scale UI redesign during this refactor.
- Keep filtering/editing flows intuitive.

Migration:
- Existing item `list` values should migrate to `status`.
- Existing filtering/generation code that references `list` should be updated to use `status`.
- New `collections` should default to an empty array.

Run:
- npm test -- --runInBand
- npm run build
