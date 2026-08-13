# Rune + Story OS — Project Instructions

## Existing Rune instructions

Rune remains available as the coding-assistant skill ecosystem under `.agents/skills/`.

## Story OS routing — mandatory

This repository also hosts long-form fiction projects. When the user asks to create, continue, review, edit, summarize, audit, or manage a story, route to **Story OS** before generic Rune behavior.

Active story is declared in `story.yaml`.

For requests such as:
- `Viết tiếp 5 chương`
- `Viết tiếp 10 chương`
- `Tiếp tục truyện`
- `Review 5 chương gần nhất`
- `Kiểm tra bộ nhớ truyện`

the agent MUST:

1. Read `story.yaml`.
2. Read the active story `manifest.yaml`.
3. Read `stories/<story_id>/AGENTS.md`.
4. Bootstrap/read the per-story memory namespace.
5. Load accepted canon/state/evidence through Story OS retrieval.
6. Never infer the next chapter from chat memory when repository state is available.

## Pre-Production / IP Development routing — mandatory for new stories

Before Story Bible, Story OS has a separate pre-production layer defined by `config/story-os/preproduction-pipeline.yaml` and `config/story-os/preproduction-gate.md`.

Trigger it when the user:
- asks to create a new story or new IP;
- says they are stuck for ideas;
- asks for a commercially promising concept;
- wants to write a genre they do not understand well;
- asks to research market/genre/reference patterns before designing a story.

Mode A — user already has a concrete concept:
`IDEA_INTAKE -> CONCEPT_VALIDATION -> STORY_DNA -> STORY_BIBLE -> LONG_TERM_OUTLINE -> ARC/VOLUME -> CHAPTER_PIPELINE`

Mode B — discovery or unfamiliar genre:
`MARKET_INTELLIGENCE -> GENRE_RESEARCH -> REFERENCE_ANALYSIS -> IDEA_MINING -> CONCEPT_GENERATION -> CONCEPT_EVALUATION -> RED_TEAM -> TOP_3_5_SHORTLIST -> LONGFORM_STRESS_TEST -> APPROVAL -> STORY_DNA -> STORY_BIBLE`

Fail-closed rules:
- Do not jump from a vague “make me a good story” prompt directly to Story Bible or prose.
- Current-market claims require fresh research; trend is evidence of reader need, not a template to imitate.
- Reference analysis may retain only abstract craft patterns, not renamed plots, scene sequences, or derivative imitation.
- Do not auto-select Top 1 and start writing. Present 3–5 strong concepts with audience fit, novelty, risks and long-form potential unless the user has already explicitly approved one.
- Long-form concepts require the checkpoint stress test at 1/10/30/100/300/500/1000 before promotion.
- Pre-production research remains RESEARCH/PROPOSED and must never enter canon or accepted history.
- Story DNA defines why readers keep reading; Story Bible defines world/canon. Do not merge them.

Existing stories with accepted canon do not rerun market/genre research merely to continue chapters. They enter the established Story OS retrieval/writing pipeline unless the user explicitly asks for strategic repositioning or concept redesign.

## Non-negotiable long-form pipeline

For each chapter:

`RETRIEVE -> PREWRITE -> DRAFT -> REVIEW -> EDIT -> RE-REVIEW -> CHAPTER_CANDIDATE -> TEMP_DELTA`

For each 5-chapter mini-batch:

`CHAPTER_CANDIDATES -> CROSS_CHAPTER_REVIEW -> NARRATIVE_QUALITY_AUDIT -> BATCH_EDIT -> REGRESSION_REVIEW -> MEMORY_CONNECTIVITY_AUDIT`

Only after PASS:

`ATOMIC_ACCEPT -> INGEST_ACCEPTED_PROSE -> APPEND_DURABLE_EVENTS -> UPDATE_CURRENT_STATE -> UPDATE_KNOWLEDGE -> UPDATE_GRAPH -> UPDATE_THREADS -> REBUILD_PROJECTION -> CHECKPOINT`

For a 10-chapter request, execute two 5-chapter mini-batches and then a final 10-chapter review before acceptance.

## Memory architecture — mandatory

Each story owns its own memory namespace. SQLite is a derived read model/cache, not the sole source of truth.

Durable memory consists of:
- accepted raw prose;
- repo-backed event ledger;
- knowledge ledger;
- graph-edge ledger;
- thread ledger;
- checkpoints and memory-health receipts.

Accepted prose outranks all projections. Planning/drafts must never enter accepted memory.

Use the story manifest to resolve the memory engine and durable writer. For this repository the standard commands are:

```bash
python scripts/memory-ledger.py bootstrap
python scripts/story-memory.py retrieve ...
python scripts/memory-ledger.py verify
python scripts/story-memory.py rebuild
python scripts/story-memory.py checkpoint ...
```

Before `gate` or `commit`, use the fail-closed wrapper:

```bash
python scripts/storyctl-memory-safe.py gate
python scripts/storyctl-memory-safe.py commit
```

A memory receipt missing durable-ledger verification, retrieval evidence, provenance, or projection/event agreement MUST HOLD.

## Adaptive milestone audits

Baseline drift review: every 25 accepted chapters.

Major memory audit cadence becomes denser with story length:
- Chapters 1–1000: every 100 chapters.
- Chapters 1001–1500: every 75 chapters.
- Chapters 1501–3000: every 50 chapters.
- Above 3000: every 25 chapters.

Deep integrity audits occur from chapter 1000 onward every 500 chapters:
`1000, 1500, 2000, 2500, 3000, ...`

Deep audits must include cold-memory stress tests, projection replay/rebuild, graph and knowledge checks, dormant-character checks, old-thread/payoff scans, provenance verification, checkpoint-chain verification, and story-wide fact sampling.

Memory health policy:
- overall `>= 0.95`: normal cadence;
- `0.90–0.95`: halve the next major-audit interval;
- `< 0.90`: HOLD + rebuild + rerun audit.

A required milestone audit that fails MUST block the next chapter.

## Authority

Default precedence:

`canon_static > canon_dynamic > published_evidence > planning > derived_runtime`

Additional rules:
- Raw accepted prose beats summaries/projections if they conflict.
- Planning does not prove an event happened.
- Objective truth is not automatically reader knowledge or character knowledge.
- Draft/non-canon prose must never update accepted memory.
- Cross-world similarity is not automatically a confirmed relation.
- If evidence is insufficient, HOLD rather than invent continuity.

## Engine

VietTruyenAI is the reference engine. Use `scripts/bootstrap-viettruyenai-engine.sh` to create/update the local engine checkout under `.engine/VietTruyenAI` when available.

Project-specific story state remains in this repository and must not be written back into the engine repository.

## User-facing default

If the user says only `Viết tiếp 5 chương`, do not ask them to remember chapter numbers or upload a resume pack. Resolve the latest accepted checkpoint from the repository, retrieve relevant memory, run the required workflow, then return only the reviewed/final candidate output plus a concise audit/commit status.

If a blocking contradiction cannot be safely resolved, return HOLD with the exact evidence conflict instead of silently altering canon.
