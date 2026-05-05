# Spec: Story Graph RAG for Writing and Adaptation

## Objective
Nâng cấp memory system hiện tại của VietTruyen từ hybrid retrieval cơ bản sang mô hình story-native Graph RAG, lấy cảm hứng từ cách GitNexus tiền tính cấu trúc để retrieval ổn định, tiết kiệm token, và ít bỏ sót quan hệ quan trọng.

Mục tiêu người dùng:
- Khi sáng tác tiếp chương mới, AI lấy đúng canon, đúng cụm nhân vật/sự kiện liên quan, và đúng ngữ cảnh semantic gần nhất.
- Khi phóng tác, AI không chỉ nhớ truyện đang viết mà còn truy được đoạn nguồn liên quan, các quyết định đã đổi so với nguyên tác, và các ràng buộc continuity phát sinh từ các quyết định đó.

Success looks like:
- `context_builder` nhận được retrieval packs có cấu trúc thay vì danh sách context phẳng.
- `plot_qa` trả lời dựa trên canon pack + graph pack + semantic pack + adaptation provenance khi có dữ liệu.
- Memory retrieval có intent rõ ràng: `writing_scene`, `continuation`, `adaptation`, `plot_qa`, `retcon_review`.

## Assumptions
1. Storage hiện tại (`Dexie` + `StorageProvider`) vẫn là source of truth cho project/chapter và không thay trong phase này.
2. Narrative memory hiện tại là nền móng đúng và sẽ được mở rộng, không bị thay mới hoàn toàn.
3. “Phóng tác” cần support mapping giữa source material và adapted project, nhưng chưa bắt buộc ingest thêm backend/service ngoài local-first flow hiện có.
4. Mục tiêu trước mắt là retrieval quality và context stability, không phải UI graph visualization.

## Tech Stack
- Frontend/runtime: React 18 + TypeScript + Vite
- Local persistence: Dexie (`src/db/narrative_db.ts`)
- Current memory/index pipeline:
  - `src/lib/memory/memory_indexer.ts`
  - `src/lib/memory/narrative_graph_builder.ts`
  - `src/lib/memory/vector_query.ts`
  - `src/lib/memory/hybrid_memory_query.ts`
  - `src/lib/ai/context_builder.ts`
  - `src/lib/ai/plot_qa.ts`

## Commands
- Test all: `npm run test:run`
- Test hybrid retrieval: `npm run test:run -- src/lib/memory/hybrid_memory_query.test.ts`
- Test vector retrieval: `npm run test:run -- src/lib/memory/vector_query.test.ts`
- Build: `npm run build`
- Dev: `npm run dev`

## Project Structure
- `src/lib/memory/` → indexing, graph building, retrieval, rerank, sync
- `src/lib/ai/` → prompt/context assembly and writing/QA flows
- `src/types/` → graph, embedding, memory, adaptation contracts
- `src/db/` → Dexie schema and persistence helpers
- `docs/specs/` → feature specs and architecture notes

## Domain Notes
Repo chưa có Domain Map chính thức cho feature này. Trong scope spec này, feature chạm 4 domain:
- `NarrativeMemory` → entity timeline, dependency graph, continuity state
- `NarrativeGraph` → nodes, edges, communities, salience, path relevance
- `ContextSelection` → retrieval intent, context pack assembly, token budgeting
- `Adaptation` → source span mapping, divergence log, provenance retrieval

## Current State
Current system already has:
- narrative graph nodes for `character`, `foreshadowing`, `arc`, `chapter`, `world`, `faction`
- vector embeddings for `scene`, `chapter_summary`, `canon_fact`, `character_note`, `world_note`
- hybrid retrieval that returns:
  - `hardCanon`
  - `graphContext`
  - `semanticContext`
  - `warnings`

Current gaps:
- graph is not rich enough for adaptation provenance or scene-level relation tracing
- retrieval buckets are too coarse for different writing intents
- no first-class “conflict/risk pack” for continuity risk clusters
- no first-class adaptation source mapping in retrieval result
- context builder still consumes retrieval as mostly formatted strings rather than structured packs

## Proposed Architecture
Use a story-native Graph RAG pipeline:

1. **Index**
- Extract chapter/entity/timeline/dependency as today
- Add scene-level and adaptation-level source records
- Precompute graph communities, salience, and retrieval helper metadata

2. **Graph**
- Expand graph model from basic entity connectivity to story-operational nodes
- Store nodes/edges that explain why a context pack is relevant, not just what exists

3. **Search**
- Keep vector search for semantic recall
- Add graph-aware seed selection and pack assembly by intent
- Add continuity risk pack and adaptation provenance pack

4. **Consumption**
- `context_builder` selects retrieval intent based on scene and task
- `plot_qa` uses higher-canon profile with optional provenance support
- future adaptation UI can inspect the same structured packs without duplicating logic

## Data Model Changes

### 1. Narrative Graph Expansion
Extend `NarrativeNodeType` in `src/types/narrative_graph.ts`:
- `scene`
- `beat`
- `motif`
- `source_span`
- `retcon_event`

Extend `NarrativeEdgeType`:
- `scene_membership`
- `beat_alignment`
- `motif_echo`
- `source_derives_to`
- `retcon_targets`
- `continuity_risk`
- `semantic_neighbor`

Add optional metadata fields to `NarrativeNode` and `NarrativeEdge`:
- `attributes?: Record<string, string>`
- `confidence?: number`
- `origin?: 'project' | 'source_material' | 'derived' | 'ai_enriched'`

### 2. Memory Embedding Expansion
Extend `MemoryEmbeddingContentType` in `src/types/memory_embedding.ts`:
- `source_span`
- `adaptation_note`
- `motif_note`
- `retcon_note`

Extend `MemoryEmbeddingRecord`:
- `sourceProjectId?: string`
- `sourceReferenceId?: string`
- `provenanceType?: 'original' | 'adapted' | 'commentary'`

### 3. Retrieval Result Reshape
Replace current `HybridMemoryResult` with pack-oriented structure:

```ts
interface RetrievalPackItem {
  id: string;
  title: string;
  body: string;
  score: number;
  sourceType: string;
  nodeIds?: string[];
  chapterIndex?: number;
}

interface HybridMemoryResult {
  canonPack: RetrievalPackItem[];
  graphPack: RetrievalPackItem[];
  semanticPack: RetrievalPackItem[];
  riskPack: RetrievalPackItem[];
  provenancePack: RetrievalPackItem[];
  warnings: string[];
}
```

Compatibility rule:
- During rollout, keep string rendering adapters so `context_builder` and `plot_qa` can migrate incrementally.

### 4. Adaptation Contracts
Add a new adaptation-memory type file, likely `src/types/adaptation_memory.ts`, with:
- `AdaptationSourceSpan`
- `AdaptationLink`
- `DivergenceRecord`

Core fields:
- source chapter/span id
- adapted chapter/scene id
- relationship: `kept | changed | omitted | invented | merged | split`
- rationale
- confidence

### 5. Narrative State Schema v1
Add first-class continuity state records to `src/types/narrative_memory.ts` and Dexie:
- `NarrativePredicateDefinition`
- `NarrativeStateFact`
- `NarrativeStateMutation`
- `NarrativeStateEvidence`

Design rules:
- `predicate` is open-ended string with runtime registry normalization
- canon state lives in `NarrativeStateFact`, not in embeddings
- chapter extraction proposes `NarrativeStateMutation`, then rules decide commit/review
- each state fact must retain evidence linkage for traceability

## Retrieval Intents
Introduce explicit retrieval intents:
- `writing_scene`
- `continuation`
- `adaptation`
- `plot_qa`
- `retcon_review`

Intent behavior:
- `writing_scene`: favors current-scene canon, local semantic scenes, on-stage graph cluster
- `continuation`: favors previous chapter tail, unresolved foreshadowing, temporal adjacency
- `adaptation`: favors source spans, divergence records, adapted canon, graph links from source to current scene
- `plot_qa`: favors canon facts, entity snapshots, chapter summaries, minimal semantic noise
- `retcon_review`: favors impacted chapters, continuity risk clusters, retcon events

## Precompute Layer
Inspired by GitNexus, add precomputed relational intelligence at index time:
- community detection on expanded graph
- node salience / cluster salience
- chapter-to-cluster affinity
- source-span to adaptation-scene linkage
- continuity risk cluster scoring
- motif recurrence summaries

This is the key upgrade: the LLM should receive already-grouped context packs, not raw search hits plus guesswork.

## Indexing Pipeline Changes
Update `src/lib/memory/memory_indexer.ts` flow:
1. extract chapter memory
2. enrich with AI if configured
3. build scene sources
4. rebuild narrative graph
5. compute retrieval helper metadata
6. rebuild HSC
7. upsert expanded memory embeddings

Add a helper layer:
- `src/lib/memory/retrieval_pack_builder.ts`
- `src/lib/memory/adaptation_link_builder.ts`
- `src/lib/memory/continuity_risk_analyzer.ts`

## Consumption Changes

### `src/lib/memory/hybrid_memory_query.ts`
Refactor from “run 4 queries and stringify” to:
- resolve intent profile
- fetch canonical facts/snapshots
- fetch graph seeds and graph packs
- fetch semantic candidates
- optionally fetch provenance data
- return structured packs

### `src/lib/ai/context_builder.ts`
Use intent-aware retrieval:
- scene classification informs intent
- route chooses pack weights and token budgets
- formatter renders packs into prompt sections:
  - `Primary Canon`
  - `Relevant Narrative Cluster`
  - `Semantic Scene Recall`
  - `Continuity Risks`
  - `Adaptation Provenance`

### `src/lib/ai/plot_qa.ts`
Use pack-aware answer composition:
- answer from canon pack first
- support “related cluster” explanation second
- mention provenance pack when question is adaptation-related

## Testing Strategy
- Unit tests:
  - graph builder new node/edge types
  - retrieval intent routing
  - pack builder ordering and truncation
  - adaptation provenance retrieval
  - continuity risk clustering
- Integration tests:
  - `hybrid_memory_query.test.ts` returns packs by intent
  - `context_builder` includes correct sections for adaptation and continuation
  - `plot_qa` prefers canon pack over semantic noise
- Regression tests:
  - existing vector retrieval behavior remains valid for non-adaptation projects
  - no-project-source mode still works when provenance data is absent

## Boundaries
- Always:
  - preserve current storage contracts unless explicitly migrated
  - keep rollout backward-compatible at API boundaries during migration
  - verify with retrieval-focused tests before claiming quality gains
- Ask first:
  - Dexie schema breaking changes
  - adding new third-party graph/vector dependency
  - introducing remote adaptation storage or sync service
- Never:
  - replace current memory pipeline wholesale in one step
  - couple UI pages directly to raw Dexie tables when retrieval services should own formatting
  - block normal writing flow on adaptation-only features

## Success Criteria
- `HybridMemoryResult` supports structured retrieval packs with intent-aware assembly.
- Writing context can include graph pack and risk pack without manual string hacks.
- Adaptation projects can retrieve source provenance alongside current canon.
- Existing non-adaptation writing flow still builds and passes retrieval tests.
- Retrieval code remains local-first and compatible with current storage strategy.

## Implementation Plan

### Phase 1: Retrieval Contract Foundation
Focus: types and service boundaries, no behavior-rich adaptation logic yet.

Tasks:
- Define pack-oriented retrieval result types
- Add retrieval intents and profiles
- Add formatting adapters for backward compatibility

Checkpoint:
- build passes
- retrieval tests updated for pack structure

### Phase 2: Graph and Pack Enrichment
Focus: richer graph + precomputed relevance.

Tasks:
- extend node/edge types
- add scene/beat/motif/retcon graph edges
- implement retrieval pack builder and risk pack generation

Checkpoint:
- graph builder tests pass
- context builder renders new sections for writing/continuation

### Phase 3: Adaptation Provenance
Focus: source-aware phóng tác support.

Tasks:
- define adaptation source span + divergence record types
- add embedding/index support for source spans
- wire provenance pack into adaptation retrieval intent

Checkpoint:
- adaptation retrieval tests pass
- plot QA can cite source/adaptation linkage

## Task Breakdown

### Task 1: Introduce retrieval intent and pack contracts
- Acceptance:
  - new retrieval result type exists
  - compatibility adapter exists for old string-based consumers
  - no storage change required
- Verify:
  - `npm run test:run -- src/lib/memory/hybrid_memory_query.test.ts`
- Files:
  - `src/types/memory_embedding.ts`
  - `src/lib/memory/memory_retrieval_profile.ts`
  - `src/lib/memory/hybrid_memory_query.ts`

### Task 2: Expand narrative graph vocabulary
- Acceptance:
  - node/edge types cover scene, beat, motif, source span, retcon event
  - graph builder can emit at least scene and beat nodes without breaking old consumers
- Verify:
  - graph-related unit tests
  - `npm run build`
- Files:
  - `src/types/narrative_graph.ts`
  - `src/lib/memory/narrative_graph_builder.ts`

### Task 3: Build retrieval pack assembler
- Acceptance:
  - graph, semantic, canon, risk packs are ranked separately
  - pack size and truncation are deterministic
- Verify:
  - new unit tests for pack builder
- Files:
  - `src/lib/memory/retrieval_pack_builder.ts`
  - `src/lib/memory/hybrid_memory_query.ts`

### Task 4: Integrate pack-aware writing context
- Acceptance:
  - `context_builder` renders pack-based sections
  - scene routing selects intent and budget
- Verify:
  - `context_builder` tests
  - `npm run build`
- Files:
  - `src/lib/ai/context_builder.ts`
  - `src/lib/ai/scene_memory_router.ts`

### Task 5: Add adaptation provenance contracts and indexing
- Acceptance:
  - source span and divergence records are modeled
  - adaptation retrieval can return provenance pack when data exists
- Verify:
  - adaptation retrieval tests
- Files:
  - `src/types/adaptation_memory.ts`
  - `src/lib/memory/vector_query.ts`
  - `src/lib/memory/hybrid_memory_query.ts`

### Task 6: Upgrade plot QA and retcon review consumers
- Acceptance:
  - `plot_qa` uses pack ordering
  - retcon flows can consume risk pack
- Verify:
  - `plot_qa` tests
  - targeted memory tests
- Files:
  - `src/lib/ai/plot_qa.ts`
  - `src/lib/memory/continuity_risk_analyzer.ts`

## Risks and Mitigations
- Risk: graph model expands too fast and becomes noisy
  - Mitigation: phase rollout, add salience thresholds, gate low-confidence nodes
- Risk: pack structure breaks current string-based prompt assembly
  - Mitigation: add compatibility adapter and migrate consumers incrementally
- Risk: adaptation provenance requires source ingestion not yet standardized
  - Mitigation: make provenance pack optional and no-op when source links are absent
- Risk: token usage increases
  - Mitigation: pack budgets and intent-specific truncation

## Open Questions
- Source material for phóng tác sẽ được lưu như project song song, document import, hay một adaptation-specific table?
- Divergence records do user tạo, AI đề xuất, hay cả hai?
- Có cần UI để sửa source-to-adaptation links ngay từ phase 1 không, hay chỉ cần service contracts trước?
