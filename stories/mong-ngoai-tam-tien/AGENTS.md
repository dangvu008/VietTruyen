# Mộng Ngoại Tầm Tiên — Story Agent Contract

## Status

This story project is the repository-backed source of truth for future story sessions. `manifest.yaml` identifies accepted progress. Chat history is never authoritative.

## Required loading order

Before planning or writing:
1. `manifest.yaml`
2. `canon/story-framework.md`
3. run `python scripts/story-memory.py init` if memory DB is absent
4. retrieve story memory for the target chapter
5. `state/current-state.yaml`
6. `ledgers/open-threads.yaml`
7. `ledgers/knowledge.yaml`
8. current arc planning
9. recent accepted chapters
10. retrieval results for entities/threads referenced by the chapter contract

## Current migration state

The framework is `CANON_CANDIDATE`.
The archived/revised Chapters 1–6 are `DRAFT / NON_CANON / HOLD_FOR_REVISION` until all gates pass.
They are evidence of prior drafting only and MUST NOT be ingested as accepted narrative state until they pass the proper pipeline.

## Long-horizon memory — mandatory

Every story has its own memory namespace and SQLite database. For this story:

```text
stories/mong-ngoai-tam-tien/memory/story.db
```

The memory engine is:

```bash
python scripts/story-memory.py
```

Raw accepted prose is the highest narrative evidence. Event/state/knowledge/graph data are projections and must retain provenance.

Before drafting a new chapter/batch, retrieve relevant memory rather than relying on chat context:

```bash
python scripts/story-memory.py retrieve \
  --target-chapter <N> \
  --query "<chapter/arc goal and relevant entities>" \
  --entity <entity-id> \
  --output <context-file>
```

After a chapter is accepted, and only after acceptance:

```text
accepted prose
→ memory ingest
→ accepted events
→ current-state projection
→ knowledge layers
→ graph edges
→ open-thread synchronization
```

After each accepted batch:

```bash
python scripts/story-memory.py rebuild
python scripts/story-memory.py checkpoint --chapter <last-accepted-chapter>
```

The memory connectivity receipt must verify that accepted evidence only was ingested, knowledge layers were preserved, timelines are complete, graph edges have provenance, and rebuilt state matches events. Missing or inconsistent memory evidence = HOLD.

### Memory knowledge layers

Never merge these layers:
- `objective_truth`
- `reader_knowledge`
- `character_knowledge`
- `belief_or_rumor`

The protagonist's suspicion, resemblance, rumor, dream interpretation, or cross-world similarity is not objective truth.

### Dream/Reality memory

Track separately:
- `REAL_TIMELINE`
- `DREAM_TIMELINE`
- `CROSS_WORLD_RELATIONS`

Cross-world relations remain `UNCONFIRMED_RELATION` until independently supported by accepted evidence.

### Memory health

Major/deep audits must record memory health. Use `story-memory.py health` after benchmark/audit results are available.

- overall `>= 0.95`: normal cadence
- `0.90–0.95`: degraded; halve the next major-audit interval
- `< 0.90`: HOLD; rebuild and rerun audit

At deep milestones, cold-memory tests must deliberately retrieve facts from the whole story, including very early chapters, dormant characters, old items, old promises, and long-resolved/long-open threads.

## Prose hard rules

- One paragraph is one coherent unit of progression.
- Do not create artificial weight by putting ordinary single sentences on separate lines.
- Avoid repeated camera-cut prose.
- Dialogue may be short, but long ping-pong sequences must be balanced with action, observation, or narration.
- Use ancient/fantasy calendar language consistently; avoid modern shorthand such as `Thừa Bình 14`.
- Mystery may stay unclear; scene orientation may not.
- Repeated rhetorical templates such as `Không phải X / Mà là Y` are monitored by the rolling narrative-quality gate.

## Identity / time / evidence hard rules

- Age, relative time, calendar year, and elapsed-time claims must reconcile before acceptance.
- `approximately`, `looks about`, or uncertain records must be explicitly treated as uncertain evidence, never silently used to repair an author inconsistency.
- A suspicion, resemblance, rumor, coincidence, or protagonist belief MUST NOT be promoted to objective truth without accepted evidence.
- Careful protagonist behavior must remain fallible: he may ask the wrong question, miss a fact, misread evidence, revisit a source, or act before certainty.
- A single side character must not become a multi-purpose clue dispenser without a causal reason.

## Dream/Reality

Track separately: `REAL_TIMELINE`, `DREAM_TIMELINE`, `CROSS_WORLD_RELATIONS`.
No fixed Real/Dream time ratio may be invented without accepted evidence.
Cross-world similarities remain `UNCONFIRMED_RELATION` until independently supported.
A newly introduced Dream clue should not normally be answered immediately in Reality. Require search, cost, failed attempts, delay, or an independent causal source unless an approved exception exists.

## Batch entrypoint — mandatory

Before opening any new 5/10 chapter batch, run:

```bash
python scripts/adaptive-audit-gate.py
python scripts/storyctl.py begin --count <5|10>
```

If the adaptive audit gate returns HOLD, DO NOT draft the next chapter. Complete/repair the required memory audit first.

## Per-chapter quality gate — mandatory

After chapter candidate + editorial re-review, create/update the chapter narrative-quality receipt and run the batch quality gate before acceptance:

```bash
python scripts/narrative-quality-gate.py templates --batch <batch-name>
python scripts/narrative-quality-gate.py check --batch <batch-name>
```

The semantic receipt must explicitly evaluate identity/age, calendar/timeline, evidence-vs-inference, knowledge provenance, cross-world causality, coincidence budget, clue density, source concentration, protagonist fallibility, world independence, and item-persistence rules.

A `NOT_APPLICABLE` result requires a written reason. Missing receipt = HOLD.

## Batch behavior

5 chapters: plan all five; each chapter gets prewrite/review/edit/re-review; use temporary deltas; run batch continuity/repetition/logic audit; run narrative-quality batch audit; run memory connectivity audit; only then accept and save.

10 chapters: same as 5 + 5; mini-batch audit after each five; full 10-chapter audit before acceptance.

For Chapters 1–10 specifically:
- no more than 3 major central-mystery escalations per 5 chapters unless explicitly approved;
- at least one chapter per 5 must progress through ordinary life, relationship, practical investigation, exploration, failure, or preparation rather than escalating the central mystery;
- cross-world confirmation requires real-world agency before being treated as meaningful evidence.

## Adaptive long-horizon gates

Baseline review still applies every 25 chapters, but major memory audits become denser as story length grows:

- Chapters 1–1000: major audit every 100 chapters.
- Chapters 1001–1500: major audit every 75 chapters.
- Chapters 1501–3000: major audit every 50 chapters.
- Above 3000: major audit every 25 chapters.
- From chapter 1000 onward, every 500 chapters (1000, 1500, 2000, 2500, 3000, ...) is a deep integrity audit.

Deep integrity audits must include cold-memory stress testing, projection rebuild/replay, graph and knowledge rebuild checks, long-absent character checks, old-thread/payoff scans, provenance verification, checkpoint-chain verification, and story-wide fact sampling.

A required audit that is missing, FAIL, HOLD, or below the health threshold blocks the next chapter.
