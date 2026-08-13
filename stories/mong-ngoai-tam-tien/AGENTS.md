# Mộng Ngoại Tầm Tiên — Story Agent Contract

## Status

This story project is the repository-backed source of truth for future story sessions. `manifest.yaml` identifies accepted progress. Chat history is never authoritative.

## Required loading order

Before planning or writing:
1. `manifest.yaml`
2. `canon/story-framework.md`
3. `state/current-state.yaml`
4. `ledgers/open-threads.yaml`
5. `ledgers/knowledge.yaml`
6. current arc planning
7. recent accepted chapters
8. retrieval results for entities/threads referenced by the chapter contract

## Current migration state

The framework is `CANON_CANDIDATE`.
The archived Chapters 1–5 are `DRAFT / NON_CANON / PIPELINE_BYPASSED`.
They are evidence of prior drafting only and MUST NOT be ingested as accepted narrative state until they pass the proper pipeline.

## Prose hard rules

- One paragraph is one coherent unit of progression.
- Do not create artificial weight by putting ordinary single sentences on separate lines.
- Avoid repeated camera-cut prose.
- Dialogue may be short, but long ping-pong sequences must be balanced with action, observation, or narration.
- Use ancient/fantasy calendar language consistently; avoid modern shorthand such as `Thừa Bình 14`.
- Mystery may stay unclear; scene orientation may not.

## Dream/Reality

Track separately: `REAL_TIMELINE`, `DREAM_TIMELINE`, `CROSS_WORLD_RELATIONS`.
No fixed Real/Dream time ratio may be invented without accepted evidence.

## Knowledge authority

Store separately: objective_truth, reader_knowledge, character_knowledge, belief_or_rumor. The protagonist's suspicion is not objective truth.

## Batch entrypoint — mandatory

Before opening any new 5/10 chapter batch, run:

```bash
python scripts/adaptive-audit-gate.py
python scripts/storyctl.py begin --count <5|10>
```

If the adaptive audit gate returns HOLD, DO NOT draft the next chapter. Complete/repair the required memory audit first.

## Batch behavior

5 chapters: plan all five; each chapter gets prewrite/review/edit/re-review; use temporary deltas; run batch continuity/repetition/logic audit; run memory connectivity audit; only then accept and save.

10 chapters: same as 5 + 5; mini-batch audit after each five; full 10-chapter audit before acceptance.

## Adaptive long-horizon gates

Baseline review still applies every 25 chapters, but major memory audits become denser as story length grows:

- Chapters 1–1000: major audit every 100 chapters.
- Chapters 1001–1500: major audit every 75 chapters.
- Chapters 1501–3000: major audit every 50 chapters.
- Above 3000: major audit every 25 chapters.
- From chapter 1000 onward, every 500 chapters (1000, 1500, 2000, 2500, 3000, ...) is a deep integrity audit.

Deep integrity audits must include cold-memory stress testing, projection rebuild/replay, graph and knowledge rebuild checks, long-absent character checks, old-thread/payoff scans, provenance verification, checkpoint-chain verification, and story-wide fact sampling.

## Memory health adaptation

Every major/deep audit records `metrics.overall` as a memory health score.

- `>= 0.95`: normal cadence.
- `0.90–0.95`: next major audit interval is reduced by 50%.
- `< 0.90`: HOLD; rebuild memory projections/graph/knowledge and rerun the audit before continuing.

A required audit that is missing, FAIL, HOLD, or below the health threshold blocks the next chapter.
