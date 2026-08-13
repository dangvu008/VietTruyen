# Memory Architecture

This story project follows the long-term narrative memory model inspired by VietTruyenAI.

## Required three parallel representations

1. **Raw accepted prose** — final evidence and exact historical source.
2. **Append-only event log** — location, inventory, knowledge, relationship, injury, realm and other changes.
3. **Current-state projections** — optimized read model; rebuildable and never a source of new truth.

## Hybrid retrieval

Use structured state filters + lexical/BM25/FTS retrieval + graph neighborhood retrieval + optional vector retrieval + temporal filters + provenance.

Vector retrieval is optional and may not become authority.

## Story graph

Nodes: character, location, artifact, faction, technique, mystery/thread, event.

Edges may include located_at, owns, member_of, allied_with, hostile_to, knows, believes, causes, resolves, foreshadows, mirrors, dream_corresponds_to. Edges need valid chapter intervals and provenance.

## Knowledge layers

Never merge:
- objective_truth
- reader_knowledge
- character_knowledge
- belief_or_rumor

## Dream-specific memory

This story additionally requires:
- `REAL_TIMELINE`
- `DREAM_TIMELINE`
- `CROSS_WORLD_RELATIONS`

No fixed Real/Dream time conversion is allowed without accepted evidence.

## Milestone validation

Memory reliability itself is tested at long horizons:
- ch25 drift audit;
- ch100 full memory audit;
- ch500 rebuild/benchmark;
- ch1000 cold-memory/archive integrity.

A memory system that cannot pass its own audit must be repaired before writing continues.
