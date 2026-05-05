# Session Log

[2026-04-19 17:20] — Bootstrapped repo-local Rune routing so future agent sessions use installed skills proactively.
[2026-04-20 17:33] — Implemented persistent story-editor Muse chat, seeded writer chats from linked Creation Chat discussion, and included recent history in editor AI prompts.
[2026-04-25 16:52] — Fixed upload chapter parser dropping detail content when PDF/DOC extraction repeats chapter headings as page headers; heading-only blocks are skipped and covered by source_ingest.test.ts.
[2026-04-25 18:08] — Integrated cost-aware literary model presets, Smart Routing scoring, persisted AI settings migration, and tracked prompt compaction for token savings.
[2026-04-26 14:10] — Fixed Creation Chat handoff so framework confirmation batch-writes chapter bodies before opening writer, blocks title-only handoff on failures, and retries remaining empty chapters from chat.
[2026-04-26 15:20] — Switched local AI runtime toward OpenRouter: disabled local proxy in `.env.local`, added `VITE_PREFER_OPENROUTER`, and deprioritized OpenRouter DeepSeek V4 Flash auto-routing after upstream 429s.
[2026-04-26 15:50] — Fixed uploaded/adapted chapter hydration so provider metadata-only rows no longer mask IndexedDB chapter content; new provider-backed uploads now save project snapshots before chapter replacement.
[2026-04-27 05:16] — Implemented P0-1 full write pipeline quality modes: fast skips post-draft AI maintenance, balanced skips checker review, quality preserves the existing full pipeline.
[2026-04-27 05:25] — Implemented P0-2 by allowing prompt cache reuse for branch planning, style analysis, and outline planner calls while leaving chapter drafting unchanged.
[2026-04-27 05:28] — Implemented P0-3 by widening prompt-cache TTL/capacity and hashing normalized request metadata instead of prompt text alone.
[2026-04-27 21:18] — Added Novel Polish inside the Story Editor Muse panel with raw text input, five polish modes, `polish_style` model routing, and focused prompt-contract tests.
[2026-04-27 21:32] — Integrated Novel Polish into the adaptation screen as an inline preflight tool with result preview, copy/prompt injection actions, and shared caller-configurable UI labels.
[2026-04-28 06:05] — Verified writer continuity `P1-1` is already implemented in production code and added direct HSC regression tests plus targeted integration verification for `publish_pipeline` and `memory_indexer`.
[2026-04-28 06:10] — Implemented `P1-2` by making plot Q&A consult local hybrid memory before shallow heuristics or AI, and added focused regressions for local-first answers and AI fallback.
[2026-05-02 08:46] — Added `viettruyen-canon-v1` hybrid export: zip package with Markdown canon docs, JSON snapshots, context-map indexes, and a lightweight story graph, exposed via ExportPage as `CANON ZIP`.
[2026-05-04 05:26] — Added persistent story debug trace across AI generation, streaming, workflow, storage persist/hydrate, auth login/logout, and close/reload lifecycle; verified with focused Vitest and build.
[2026-05-05 21:23] — Added Chữa Canon plot direction preview before rewrite queue: AI proposes 2-3 route choices, the selected direction is persisted on SurgerySpec, and rewrite/QA tasks receive that direction as guidance.
