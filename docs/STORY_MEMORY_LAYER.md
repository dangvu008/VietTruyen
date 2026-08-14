# VietTruyen Story Memory Layer

Status: current architecture on `main` plus Resolver runtime boundary hardening.

## Purpose

Story Memory is the boundary between Writer/Planner/Reviewer agents and long-form story history. It reconstructs the smallest correct working set for the current task rather than asking an LLM to remember thousands of chapters.

`Agent -> StoryMemoryResolver -> project-scoped indexes -> Context Compiler -> bounded working context`

## Authority

- Google Drive: authoritative accepted story artifacts and durable story memory.
- GitHub VietTruyen: executable Story OS, schemas, gates, tests and memory orchestration.
- Notion: operational projection, Kanban, index and AI query surface.
- Narrative Memory indexes: derived project-scoped retrieval indexes, not a second Canon store.
- StoryMemoryResolver: temporary agent-facing working-memory facade.

No inference or retrieval hit becomes Canon solely because an agent found it.

## StoryMemoryResolver

`src/lib/memory/story_memory_resolver.ts`

The resolver validates project identity, invokes project/temporal-scoped hybrid retrieval, compiles evidence through MUST KNOW / MAY USE / DO NOT FORCE / FORBIDDEN policies and returns diagnostics.

The raw retrieval engine lives in `hybrid_memory_raw.ts` and is Resolver-internal. `hybrid_memory_query.ts` is only a compatibility facade for older call sites and delegates back through `StoryMemoryResolver`; it no longer owns a parallel retrieval implementation. This makes the Resolver a real runtime boundary rather than a documentation-only convention.

New Writer/Planner/Reviewer code must call `resolveStoryMemory()` or `buildLongFormWritingContext()` instead of importing the raw engine.

Character Knowledge does **not** get a parallel database or a second `knowledgePack`. It lives in the existing `NarrativeStateFact` store under `character_knowledge:<propositionId>` and is rendered in the normal state pack with `sourceType=character_knowledge`. Diagnostics count these records separately without duplicating them.

## Character epistemic memory

- `character_knowledge_ledger.ts`
- `character_knowledge_state.ts`
- `character_knowledge_extractor.ts`
- `retrieval_pack_builder.ts`
- `context_compiler.ts`

World truth and character belief are independent. The accepted post-write pipeline conservatively auto-extracts only explicit named-character knowledge statements. Implied/pronoun-only knowledge is not automatically promoted. Consistency review checks knowledge leaks without adding another AI checker pass.

Retrieval reserves bounded context capacity for both objective state and character epistemic state so a busy world-state list cannot crowd character knowledge out entirely. High-confidence epistemic boundaries become MUST KNOW. Low-confidence belief/rumor remains DO NOT FORCE and must never be upgraded into certainty merely because it was retrieved.

## Accepted-memory transaction

`memory_extractor.ts` is a stable public facade. The previous implementation remains as `memory_extractor_legacy.ts` for rollback/provenance; accepted writes route through `memory_extractor_safe.ts`.

The runtime contract is:

`ACCEPTANCE PASS -> PREPARE -> PRECOMMIT -> ATOMIC COMMIT -> POST-COMMIT AUDIT CACHE`

PREPARE may call enrichment/summary/scene/hook detectors but must not mutate authoritative memory. PRECOMMIT requires required artifacts and runs deterministic scene timeline checks. The atomic Dexie transaction commits narrative facts, mutations, evidence and Pending Hooks together. Any cross-project record is rejected before mutation.

## Timeline and causality

Causality is fail-closed in Grounded Prose Runtime Gate. Deterministic scene timeline conflicts are checked again in post-write PRECOMMIT. Vague natural-language time markers are not converted into invented numeric ticks.

## Narrative entropy

Entropy is a periodic/offline operational audit, not a Writer checklist. A cheap deterministic sample is recorded after an accepted atomic commit. The audit normally runs every 25 accepted chapters, or earlier under hook pressure with minimum spacing to prevent repeated cost. Reports are operational cache, not Canon.

## storyImpact()

`src/lib/memory/story_impact.ts`

A GitNexus-style read-only blast-radius query for proposed Canon changes. It combines indexed chapter attribute dependencies with bounded traversal of structural NarrativeGraph edges. Semantic-neighbor edges are excluded because similarity alone is not dependency evidence.

Before changing established Canon:

`proposed edit -> storyImpact() -> inspect blast radius -> accepted edit -> propagation/review -> reindex -> projections refresh`

`storyImpact()` never mutates Canon and applies project isolation again at the compiler boundary as defense in depth.

## Scaling invariant

**Unbounded story history, bounded working context.**

A 3,000+ chapter story keeps full durable history outside the model. For a target chapter, Story Memory reconstructs current Canon/state, character knowledge, relevant local/old evidence, active hooks and contradiction risks under a finite context budget.

The limiting engineering problem is retrieval/index quality, not a hard-coded maximum chapter count.
