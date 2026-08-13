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
4. Load accepted canon/state/evidence through the Story OS memory workflow.
5. Never infer the next chapter from chat memory when repository state is available.

## Non-negotiable long-form pipeline

For each chapter:

`PREWRITE -> DRAFT -> REVIEW -> EDIT -> RE-REVIEW -> CHAPTER_CANDIDATE -> TEMP_DELTA`

For each 5-chapter mini-batch:

`CHAPTER_CANDIDATES -> CROSS_CHAPTER_REVIEW -> BATCH_EDIT -> REGRESSION_REVIEW -> MEMORY_CONNECTIVITY_AUDIT`

Only after PASS:

`ATOMIC_ACCEPT -> UPDATE_EVENT_LOG -> UPDATE_CURRENT_STATE -> UPDATE_KNOWLEDGE -> UPDATE_GRAPH -> UPDATE_THREADS -> CHECKPOINT`

For a 10-chapter request, execute two 5-chapter mini-batches and then a final 10-chapter review before acceptance.

## Milestone audits

Mandatory:
- every 25 accepted chapters: drift audit;
- every 100 accepted chapters: full memory audit;
- every 500 accepted chapters: deep rebuild + retrieval benchmark;
- every 1000 accepted chapters: archival integrity + cold-memory stress test.

A required milestone audit that fails MUST block the next chapter.

## Authority

Default precedence:

`canon_static > canon_dynamic > published_evidence > planning > derived_runtime`

Additional rules:
- Raw accepted prose beats summaries/projections if they conflict.
- Planning does not prove an event happened.
- Objective truth is not automatically reader knowledge or character knowledge.
- Draft/non-canon prose must never update accepted memory.
- If evidence is insufficient, HOLD rather than invent continuity.

## Engine

VietTruyenAI is the reference engine. Use `scripts/bootstrap-viettruyenai-engine.sh` to create/update the local engine checkout under `.engine/VietTruyenAI` when available.

Project-specific story state remains in this repository and must not be written back into the engine repository.

## User-facing default

If the user says only `Viết tiếp 5 chương`, do not ask them to remember chapter numbers or upload a resume pack. Resolve the latest accepted checkpoint from the repository, run the required workflow, then return only the reviewed/final candidate output plus a concise audit/commit status.

If a blocking contradiction cannot be safely resolved, return HOLD with the exact evidence conflict instead of silently altering canon.
