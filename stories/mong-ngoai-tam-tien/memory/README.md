# Story Memory — Mộng Ngoại Tầm Tiên

This directory is the durable memory namespace for this story.

## Authority

1. Accepted chapter prose is the highest narrative evidence.
2. `events.jsonl`, `knowledge.jsonl`, `edges.jsonl`, and `threads.jsonl` are durable, repo-backed ledgers with provenance.
3. `story.db` is a derived SQLite read model/cache. It may be deleted and rebuilt; it is never the sole source of truth.

## Bootstrap

```bash
python scripts/memory-ledger.py bootstrap
```

## Durable writes

For accepted memory mutations, prefer the ledger wrapper so the repo-backed ledger and SQLite projection stay synchronized:

```bash
python scripts/memory-ledger.py event ... --source chapters/chXXXX.md
python scripts/memory-ledger.py knowledge ... --source chapters/chXXXX.md
python scripts/memory-ledger.py edge ... --source chapters/chXXXX.md
python scripts/memory-ledger.py thread ... --source chapters/chXXXX.md
```

Run:

```bash
python scripts/memory-ledger.py verify
```

before memory-connectivity PASS.

## Retrieval

```bash
python scripts/story-memory.py retrieve --target-chapter N --query "..." --entity entity-id
```

Retrieval uses current state + open threads + knowledge + graph neighbors + FTS5 over accepted prose. Vector retrieval may be added later but can never become authority.

## Long-horizon rule

If memory health drops below 0.90, stop new chapters, rebuild projections and rerun the memory audit. Deep milestones must test cold facts from across the whole story, not only recent chapters.
