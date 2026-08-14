# VietTruyen — Long-Form Story Memory Architecture

Status: Canonical design extension
Scope: ChatGPT + Codex + VietTruyen Story OS + Google Drive + Notion

## 1. Operating model

- **ChatGPT** is the creative/editorial interface: receives author intent, critique, approvals and corrections.
- **Codex** is the reasoning and execution brain: reads the repository, compiles context, runs writing/review flows, applies systemic fixes and synchronizes artifacts.
- **VietTruyen repository** is the Story OS: rules, schemas, retrieval, context compilation, gates, tests and orchestration contracts.
- **Google Drive** is durable story storage: authoritative chapter artifacts, canon snapshots, accepted state, summaries, archives and handoff material.
- **Notion** is the control plane/Kanban: project/chapter status, review state, open work, decisions and links. Notion is not the primary narrative database.

The model must remain recoverable when a ChatGPT/Codex session ends. Durable truth lives outside the model context.

## 2. Scale principle

VietTruyen MUST NOT hard-code a maximum story chapter count.

Design invariant:

> unbounded story history, bounded working context

A 10,000-chapter story is stored as durable history. When writing one chapter, only a compact working set is compiled into model context.

## 3. Memory hierarchy

### L0 — Immediate context
Recent accepted chapters/scenes and the current chapter brief. Highest detail.

### L1 — Arc memory
Current arc goals, conflicts, active cast, progress, unresolved beats and local constraints.

### L2 — Volume memory
Compressed volume-level history and cross-arc changes.

### L3 — Entity/state memory
Structured current state for characters, relationships, locations, items, factions, powers, objectives, injuries and constraints.

World truth and character knowledge MUST be distinguishable. A fact existing in canon does not imply that every character knows it.

### L4 — Global canon
Stable world rules, terminology, geography, systems, historical facts and invariants.

### L5 — Deep archive
Full historical chapters, old snapshots and source spans. Retrieved only when relevant.

## 4. Accepted-state rule

Only an **ACCEPTED** chapter may mutate authoritative story state.

Flow:

WRITE -> REVIEW -> GATE -> ACCEPT -> COMMIT -> EXTRACT MEMORY -> UPDATE STATE -> SNAPSHOT -> INDEX -> SYNC CONTROL PLANE

Draft/rejected content may be preserved for provenance/version history but MUST NOT silently enter Canon or current state.

## 5. Context Compiler

Raw retrieval results MUST NOT be injected directly into the writer prompt.

The Context Compiler classifies retrieved material into four use policies:

- **MUST_KNOW** — required facts/constraints; omission risks contradiction.
- **MAY_USE** — relevant supporting context; use only when naturally needed.
- **DO_NOT_FORCE** — valid context that must not be explicitly demonstrated merely because it was retrieved. Prevents trait/lore literalization.
- **FORBIDDEN** — contradiction warnings, invalid states, known failure patterns and constraints the chapter must not violate.

The compiler applies a bounded budget, deduplication and priority ordering. This prevents context overload and 'AI proving it remembers' by forcing retrieved traits/lore into prose.

## 6. Story isolation / anti-contamination

Every story artifact and memory record MUST carry `projectId`/Story_ID.

Retrieval order:

1. Hard-filter by project/story namespace.
2. Apply entity/arc/chapter filters.
3. Perform lexical/vector/graph retrieval inside that namespace.
4. Compile the bounded context package.

Cross-story retrieval is forbidden unless explicitly operating in a reference/adaptation mode, and reference material must remain provenance-tagged and non-canonical by default.

## 7. Structured continuity

Long-form memory is not just prose summaries. VietTruyen tracks structured state and transitions:

- entity state and snapshots
- relationship state
- location and inventory
- abilities/power state
- objectives and constraints
- event mutations
- open hooks/foreshadowing
- chapter dependencies
- timeline facts
- provenance

State changes should be representable as `S1 -> event/mutation -> S2`.

## 8. Temporal and causal continuity

Chronology and causality are separate checks.

### Timeline
Track relative/absolute story time, durations, location and event ordering. A new time jump must be validated before promotion.

### Causal chain
Important progression should preserve:

Cause -> Decision -> Action -> Consequence -> New State

A chapter can be chronologically valid yet narratively mechanical if causal links are missing.

## 9. Narrative entropy control

Long stories require periodic audits in addition to chapter-level review.

Audit for:

- character drift
- dialogue-voice convergence
- repeated plot structures
- repeated prose/motifs
- power creep
- forgotten entities
- unresolved hooks
- world-rule erosion
- thematic drift
- generic/AI-like prose homogenization

Recommended cadence is configurable by story; no fixed chapter-count limit is part of the architecture.

## 10. Planner hierarchy

Local chapter quality is insufficient for a long novel. Planning is hierarchical:

Novel Planner -> Volume Planner -> Arc Planner -> Chapter Planner

Every chapter should have an explicit contribution to its enclosing arc. Filler detection should consider whether the chapter changes information, decision, relationship, risk, objective, state or reader expectation.

## 11. Writer/Critic separation

Writing and evaluation are separate passes/roles, even if executed by the same underlying model:

Planner -> Writer -> Continuity Critic -> Logic/Causality Critic -> Character Critic -> Prose Editor -> Final Gate

Critics receive the minimum context required for their task to reduce confirmation bias and context pollution.

## 12. Editorial feedback memory

Author corrections are first-class data.

A correction such as 'this makes the protagonist behave like a detective' should be handled as:

1. Fix the local text.
2. Capture a candidate failure pattern/editorial preference.
3. Determine whether it is systemic or story-specific.
4. If validated, promote it to a rule/gate with provenance.
5. Add a regression example when feasible.

This lets VietTruyen learn how the author wants the story written without turning every one-off edit into a universal rule.

## 13. Drive contract

Drive stores durable authoritative artifacts and archives. Recommended per-story namespace:

`Stories/<Story_ID>/`

- `00-Manifest/`
- `01-Canon/`
- `02-Outline/`
- `03-Chapters/Draft/`
- `03-Chapters/Accepted/`
- `04-Memory/Summaries/`
- `04-Memory/State/`
- `04-Memory/Timeline/`
- `04-Memory/Hooks/`
- `04-Memory/Snapshots/`
- `05-Review/`
- `06-Handoff/`
- `99-Archive/`

Shared pipeline/Story OS documents must remain outside individual story Canon folders.

## 14. Notion contract

Notion is a human control surface, not the canonical long-form store. It should track:

- story/project status
- chapter workflow: Planned -> Drafting -> Review -> Revision -> Accepted -> Published
- review failures and gates
- open threads/tasks
- arc/volume progress
- editorial decisions
- links to authoritative Drive/GitHub artifacts

When Notion lags behind a rapid edit sequence, the latest accepted Drive artifact remains authoritative and Notion must be reconciled from that version.

## 15. Reliability invariants

1. No cross-story Canon promotion.
2. No draft content mutates accepted state.
3. No raw retrieval dump into writer context.
4. Every context item retains provenance/source type.
5. Character knowledge is not inferred from world truth without evidence.
6. Recent state beats stale summary when they conflict.
7. Superseded facts are retained for provenance, not treated as active truth.
8. Retrieval failure degrades gracefully to structured canon/state rather than hallucinated reconstruction.
9. User edits to accepted chapters trigger re-extraction/reindex/reconciliation.
10. Story scale is constrained by storage/index/retrieval quality, not a fixed chapter maximum.
