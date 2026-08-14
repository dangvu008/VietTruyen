# VietTruyen Memory Authority & Notion Projection Policy

Status: Canonical architecture contract

## 1. No dual authority

VietTruyen MUST NOT treat Google Drive and Notion as two co-equal story-memory stores.

- Google Drive: authoritative accepted story artifacts and durable story memory.
- GitHub VietTruyen: authoritative executable system rules, schemas, gates, tests and pipeline behavior.
- Notion: operational memory, Kanban, index, query layer and AI-friendly projection.
- ChatGPT/Codex/Notion AI: reasoning agents; new conclusions are candidates until promoted.

## 2. Projection provenance

Every Notion memory projection SHOULD carry:

- projectId
- memory type
- source authority
- source URL/ID
- source hash or revision when available
- last synced timestamp
- freshness: fresh/stale/unknown
- AI status: projection/candidate/quarantined

Missing or mismatched projectId blocks use in a writing context.

## 3. Conflict resolution

- Story fact conflict: Drive wins.
- Runtime/system rule conflict: GitHub wins.
- Notion edits never mutate Canon directly.
- AI output never becomes Canon merely because it is plausible.

## 4. One-way reconciliation

Reconciliation flows from authority to projection:

`Drive/GitHub -> provenance check -> Notion projection refresh`

If source hash/revision changes, the projection becomes stale. Cross-project projection is quarantined.

## 5. Notion AI contract

Notion AI MAY summarize, search, group and propose insights over projections.

Notion AI MUST NOT:

- declare a candidate as Canon;
- resolve conflicts against Drive/GitHub in its own favor;
- mix story projects before projectId filtering;
- use stale/quarantined records as current truth;
- rewrite authoritative state directly from an inferred summary.

## 6. Writing context

Retrieved memory must be compiled before reaching the writer:

- MUST KNOW: current Canon/state that cannot be violated.
- MAY USE: relevant context used only when natural.
- DO NOT FORCE: valid background context that must not be inserted merely to demonstrate recall.
- FORBIDDEN: continuity contradictions and hard constraints.

## 7. Accepted-state promotion

Only ACCEPTED chapters that pass quality and continuity gates may mutate authoritative story state.

Editing an already accepted chapter requires:

`re-extract -> reindex -> reconcile -> refresh projections`

## 8. Long-form scaling

Story history is unbounded; writer working context is bounded. Retrieval MUST scope by projectId first, then relevance, then compile by policy.

## 9. Implementation references

- `src/lib/memory/memory_authority.ts`
- `src/lib/memory/notion_projection.ts`
- `src/lib/memory/projection_reconciliation.ts`
- `src/lib/memory/context_compiler.ts`
- `src/lib/memory/character_knowledge_ledger.ts`
- `src/lib/memory/timeline_gate.ts`
- `src/lib/memory/causal_continuity.ts`
- `src/lib/memory/narrative_entropy_audit.ts`
- `src/lib/memory/authoritative_promotion.ts`
