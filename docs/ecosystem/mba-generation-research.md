# MBA Generation Research

## Purpose

This document captures audits, experiments, architectural observations,
and unresolved research related to MBA generation.

Items in this document are not necessarily accepted decisions.
Many findings represent hypotheses, future directions,
or areas requiring further validation.

## Research Areas

- board-centric vs sequence-centric
- direction modeling
- diversity logic
- taxonomy-aware weighting
- observability

## Generation Architecture Audits

### Guided Mode Audit

This is a very strong audit. It surfaced the right architectural problems instead of just “tuning weights.”
The most important findings are probably these:
1. MBA guided mode has no true board seed/direction model
2. shared tags dominate too strongly
3. generation is sequence-centric, not board-centric
4. previous-image logic is arbitrary after layout randomization
5. OA architectural carryover still surrounds MBA generation
6. random/non-guided mode is still heavily OA-backed
That is the real picture now.
The strongest insight in the whole audit is probably this:
“Direction tags” are not actual direction.
That means the system currently presents:
observed board statistics
as if they were:
intentional generation guidance
Those are very different.
The audit also correctly identified the hidden architectural split:
MBA guided mode itself
!=
MBA generation architecture overall
The scorer itself is already fairly MBA-native. The surrounding infrastructure still partially thinks in OA terms.
I would prioritize next steps like this:

Immediate:
- fix misleading debug terminology
- add candidate-level debug mode
- fix reroll debug persistence
- explicitly separate “board direction” from “board result”

Near-term:
- reduce shared-tag dominance
- move from previous-image penalties toward board-wide diversity
- weaken/remove parent-group redundancy
- rethink dominantTag entirely

Later:
- isolate MBA generation module from OA generation infrastructure
- redesign non-guided/random MBA mode to be MBA-native
- eventually move toward board-centric composition scoring

I would not immediately jump into:
global composition AI-style optimization
The current weighted-random incremental approach is actually reasonable for MBA. It just needs:
* clearer direction modeling
* cleaner diversity logic
* less OA residue
* better observability/debugging
One additional thing the audit hints at but does not fully state:
tag semantics are currently overloaded
Because:
* exact tags
* parent groups
* metadata families
* included filters all partially overlap conceptually.
You may eventually want explicit taxonomy semantics like:
source/*
season/*
publisher/*
subject/*
garment/*
fit/*
event/*
person/*
with different weighting behavior per family instead of treating all exact tags equally.
That is likely where the system naturally evolves next after the debug/cleanup phase.

—

Start with observability/debug, not scoring changes.
First implementation should be narrow:
1. Fix misleading debug wording: Direction tags → Board tags or Current board tags Then add a separate Filter direction / Seed direction field only if it reflects actual input.
2. Fix guided reroll debug persistence: when reroll returns guidedDebugEntry, merge/update it in guidedDebugPayload.
3. Add candidate-level debug behind a flag: top 25 candidates per selection step with:
    * candidate id
    * raw score
    * final weight
    * rank
    * breakdown
    * selected flag
Do not change weights yet. Once you can see rejected candidates, the scoring changes will be much safer.
First implementation prompt should focus on observability/debugging only.