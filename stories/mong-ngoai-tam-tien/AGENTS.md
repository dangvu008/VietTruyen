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

## Batch behavior

5 chapters: plan all five; each chapter gets prewrite/review/edit/re-review; use temporary deltas; run batch continuity/repetition/logic audit; run memory connectivity audit; only then accept and save.

10 chapters: same as 5 + 5; mini-batch audit after each five; full 10-chapter audit before acceptance.

## Long-horizon gates

- 25: drift audit
- 100: full memory audit
- 500: deep rebuild + benchmark
- 1000: archival integrity audit

Fail => next chapter blocked.
