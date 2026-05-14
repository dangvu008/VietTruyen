# Plan: VietTruyen Safety & Hardening

> **Goal:** Fix 17 unhandled user behaviors identified in challenge analysis
> **Scope:** Data safety → AI reliability → UX gaps → Community
> **Principle:** "Nền tảng an toàn trước, AI thông minh sau"

## Phases

| # | Phase | Priority | Status | Est. LOC |
|---|-------|----------|--------|----------|
| 1 | Critical Hotfixes | P0 | ✅ | ~30 |
| 2 | Editor Safety Net (Undo/Redo + AI Buffer) | P0 | ✅ | ~350 |
| 3 | Data Protection (Trash + Quota Guard) | P1 | ✅ | ~250 |
| 4 | Offline & Network Resilience | P2 | ✅ | ~200 |
| 5 | AI Context Enhancement | P2 | ✅ | ~300 |
| 6 | Workflow Resilience & i18n | P2-P3 | ✅ | ~250 |
| 7 | Community Safety | P3 | ✅ | ~200 |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Undo engine | In-memory ring buffer (50 ops) | Simple, no deps, covers 95% cases |
| Soft delete | 30-day trash with localStorage flag | No schema change, reversible |
| Quota guard | Proactive check before setItem | Prevent silent data loss |
| Offline | Global hook + UI banner | Minimal footprint, high visibility |
| Context window | Adaptive budget (18K→28K) + HSC tuning | Balance quality vs token cost |

## Architecture Impact

```
src/hooks/use_undo_redo.ts          ← NEW (Phase 2)
src/hooks/use_network_status.ts     ← NEW (Phase 4)
src/lib/storage/quota_guard.ts      ← NEW (Phase 3)
src/lib/storage/trash_manager.ts    ← NEW (Phase 3)
src/core/exporter.ts                ← FIX (Phase 1)
src/components/story-editor/        ← MODIFY (Phase 2, 4)
src/store/use_project_store.ts      ← MODIFY (Phase 3)
src/lib/ai/context_builder.ts       ← MODIFY (Phase 5)
src/lib/ai/plot_qa.ts               ← FIX (Phase 1)
```

## Risks

| Risk | Mitigation |
|------|------------|
| Undo/redo perf on large chapters | Ring buffer capped at 50 ops, debounced snapshots |
| Quota guard false positives | Only warn at 80%, block at 95% |
| Context expansion = higher API cost | Adaptive: only expand when story > 20 chapters |

## Outcome Block

**What Was Planned:** 7-phase hardening roadmap covering data safety, AI fixes, UX, and community
**Immediate Next Action:** Execute Phase 1 — fix export bug and Plot QA apiKey (2 one-line fixes)
**How to Measure:**

| Check | Command |
|-------|---------|
| Export ordering | `grep -n 'chapters.length - index' src/core/exporter.ts` → should return 0 |
| Plot QA apiKey | `grep -n "apiKey: ''" src/components` → should return 0 |
| Tests pass | `npm test -- --run` |
