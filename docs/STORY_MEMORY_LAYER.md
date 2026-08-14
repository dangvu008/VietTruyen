# Story Memory Layer — Agent Long-Term Memory Architecture

Status: Implemented V1 core

## 1. Purpose

Story Memory Layer is the memory-support boundary between Writer/Planner/Reviewer agents and long-form story storage.

Its job is not to make the model remember every chapter. Its job is to reconstruct the smallest correct working set for the current task.

Core rule:

`Agent -> StoryMemoryResolver -> project-scoped memory indexes -> Context Compiler -> bounded working context`

Agents SHOULD NOT scan Drive, Notion or thousands of raw chapters ad hoc when the same information is available through Story Memory.

## 2. Authority model

Story Memory is not a second source of truth.

- Google Drive: authoritative accepted story artifacts and durable story memory.
- GitHub VietTruyen: authoritative executable rules, schemas, gates and tests.
- Notion: operational projection, Kanban, indexes and human review surface.
- Narrative Memory indexes: derived/project-scoped machine index used for retrieval.
- Story Memory Resolver: temporary working-memory compiler.

Candidate or inferred memory never becomes Canon solely because retrieval found it.

## 3. V1 components

### StoryMemoryResolver

File: `src/lib/memory/story_memory_resolver.ts`

Canonical facade for agent memory requests.

Input:

- project
- targetChapterIndex
- query
- intent
- optional context compiler limits

Output:

- hybrid memory packs
- compiled policy-labelled context
- writer prompt block
- source-count diagnostics
- runtime warnings
- cross-project/future-memory rejection count

### Hybrid retrieval

File: `src/lib/memory/hybrid_memory_query.ts`

Combines:

- canonical entity snapshots
- current narrative state
- character knowledge state
- open hooks
- narrative graph communities
- semantic/vector recall
- continuity risks
- provenance slots

Retrieval is project-scoped first. Future chapter evidence is rejected while writing earlier chapters.

### Context compiler

File: `src/lib/memory/context_compiler.ts`

All retrieved evidence is classified into:

- MUST KNOW
- MAY USE
- DO NOT FORCE
- FORBIDDEN / CONTRADICTION RISKS

This prevents retrieval from becoming a checklist that the Writer mechanically literalizes into prose.

### Character epistemic memory

Files:

- `src/lib/memory/character_knowledge_ledger.ts`
- `src/lib/memory/character_knowledge_state.ts`
- `src/lib/memory/retrieval_pack_builder.ts`

Objective world truth and character knowledge MUST remain separate.

Example:

- worldTruth = true
- character belief = suspects

The Writer may know both values, but the character may only speak/act from `suspects` until an explicit reveal or confirmation event changes the epistemic state.

### Story impact analysis

File: `src/lib/memory/story_impact.ts`

`storyImpact()` provides GitNexus-style blast-radius analysis for Canon changes.

It combines:

1. indexed chapter attribute dependencies;
2. bounded structural traversal of NarrativeGraph.

It returns:

- affected chapters;
- severity;
- referenced attributes and snippets;
- affected graph nodes;
- graph distance / edge types;
- evidence gaps;
- low / medium / high risk.

Semantic-neighbor edges are intentionally excluded from impact traversal so similarity alone does not create false dependency chains.

## 4. Writer flow

For chapter N:

1. Resolve the projectId and target chapter.
2. Build a scene/task query.
3. Call StoryMemoryResolver.
4. Retrieve only project-scoped evidence valid at chapter N.
5. Separate objective state from character knowledge.
6. Compile evidence into use-policy buckets.
7. Give the bounded context to Writer.
8. Writer creates a candidate chapter.
9. Review + continuity + narrative-value gates run.
10. Only PASS/ACCEPTED output may mutate authoritative story state.
11. Re-extract/reindex accepted memory and refresh Drive/Notion projections.

## 5. Canon edit flow

Before changing an established Canon attribute:

`proposed edit -> storyImpact() -> review blast radius -> apply accepted edit -> propagation tasks -> reindex -> projection refresh`

A high-risk impact report SHOULD block silent mutation and require explicit review/repair of dependent chapters or facts.

## 6. Long-form scaling principle

The chapter count is not the working-context size.

A 3,000-chapter story SHOULD NOT load 3,000 chapters into the model. It should keep durable indexed history and reconstruct a bounded context from:

- current Canon/state;
- current character knowledge;
- local arc/scene context;
- recent chapter state;
- relevant old evidence;
- active hooks;
- contradiction risks.

The practical scaling problem therefore becomes retrieval/index quality rather than raw model context length.

## 7. Failure policy

Story Memory fails closed on identity and temporal boundaries.

- missing projectId: reject;
- cross-project memory: reject;
- future chapter memory for earlier chapter writing: reject;
- low-certainty retrieved material: DO NOT FORCE;
- continuity risk: FORBIDDEN;
- candidate/inferred memory: not Canon until promotion gate passes.

## 8. V2 extension points

The V1 interfaces intentionally leave room for:

- typed knowledge-graph queries;
- `characterState(character, chapter)`;
- `characterKnowledge(character, topic, chapter)`;
- `timeline(from, to)`;
- `relationship(a, b, chapter)`;
- graph neighborhood queries;
- causal-chain queries;
- automatic stale-memory detection;
- richer provenance packs;
- MCP-facing Story Memory tools for ChatGPT/Codex agents.

These should reuse the current resolver, graph and authoritative-memory stores rather than creating parallel Canon stores.

## 9. Non-negotiable design rule

The Writer is a novelist, not a memory database administrator.

Memory selection, validation, temporal reconstruction, project isolation and blast-radius analysis belong to Story Memory Layer. Writer/Planner/Reviewer agents consume its results according to their role.
