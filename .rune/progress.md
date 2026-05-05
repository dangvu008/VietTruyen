# Progress

## [2026-04-19 17:20] Session Summary

**Completed:**
- [x] Replaced broken root skill bootstrap with repo-local Rune instructions.
- [x] Added `.rune` contract, decisions, conventions, and metrics stubs for session continuity.
- [x] Prepared Cursor-facing rules to read from `.agents/skills`.

**In Progress:**
- [ ] Keep validating future work against the new Rune bootstrap.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Start with `rune-skill-router`.
- Load `rune-cook` for code changes unless a more specific Rune route is obvious.
- Update `.rune` state files after any non-trivial implementation.

## [2026-04-20 17:33] Session Summary

**Completed:**
- [x] Added persisted Muse chat storage for the writer editor keyed by `projectId/chapterId`.
- [x] Seeded empty chapter chats from the linked Creation Chat discussion so editor handoff can resume prior conversation.
- [x] Updated The Muse prompt builder to include recent chat history, so AI continues the discussion instead of ignoring visible messages.
- [x] Added focused tests for chat seed/transcript helpers and persisted story-editor chat store.
- [x] Verified with `npm run test:run -- src/components/story-editor/story_editor_chat_history.test.ts src/store/use_story_editor_chat_store.test.ts`.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Manually smoke-test Creation Chat -> Writer handoff in the UI to confirm seeded discussion appears on chapter detail as expected.
- Consider whether chapter deletion should also prune persisted Muse chat history.

## [2026-04-25 18:08] Session Summary

**Completed:**
- [x] Added low-cost literary model presets for Gemini Flash-Lite, DeepSeek V4 Flash, Mistral Small Creative, MythoMax, Qwen Flash, GPT-4.1 Nano/Mini, and Claude Haiku.
- [x] Upgraded Smart Routing to score models by token price, task fit, context window, tier, and capabilities.
- [x] Added central prompt compaction in tracked AI calls when `autoSummarize` and `contextSize` are enabled.
- [x] Migrated persisted AI settings to enrich old models with price/context metadata and append missing defaults.
- [x] Verified focused routing/client tests and production build.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Smoke-test Smart Routing in AI Settings with real provider keys.
- Consider adding a visible per-call "chosen because" explanation if users need transparency into auto model choices.

## [2026-04-26 14:10] Session Summary

**Completed:**
- [x] Tightened Creation Chat framework confirmation so it batch-writes chapter bodies before opening the writer.
- [x] Added failure gating: if batch writing leaves chapters empty, the flow stays in chat and shows a retryable error instead of handing off title-only chapters.
- [x] Updated batch writing to pass the latest in-memory project state into each subsequent chapter write.
- [x] Added regression coverage for successful all-chapter body generation and failed batch generation.
- [x] Verified with `npm test -- --run src/store/use_creation_chat_store.test.ts src/lib/ai/creation_orchestrator.test.ts`.
- [x] Verified with `npx tsc --noEmit` and `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Smoke-test a real provider-backed Creation Chat run to confirm latency and token budget are acceptable for writing all initial chapters.

## [2026-04-27 05:16] Session Summary

**Completed:**
- [x] Implemented P0-1 Quality Mode trong Pipeline.
- [x] Added `QualityMode` to workflow payloads and `qualityMode` to `PipelineOptions`.
- [x] Routed full write pipeline review, polish, data extraction, and memory sync steps from quality mode.
- [x] Passed `qualityMode` through `writer_orchestrator`.
- [x] Added regression tests for default quality behavior, fast mode, and balanced mode.
- [x] Verified with `npm run test:run -- src/lib/workflow/full_write_pipeline.test.ts`.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Wire UI/runtime callers to choose `qualityMode` explicitly where token savings should be user-visible.

## [2026-04-27 05:25] Session Summary

**Completed:**
- [x] Implemented P0-2 by removing `skipCache: true` from the five backlog-listed planning/style calls.
- [x] Kept `writeChapterFromBranch` unchanged because it is outside the listed task scope.
- [x] Verified the scoped removal with `rg` and a successful `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Decide separately whether chapter drafting itself should opt into cache reuse or stay fresh-only.

## [2026-04-27 05:28] Session Summary

**Completed:**
- [x] Implemented P0-3 by changing prompt cache keys from prompt-only hashing to normalized request hashing.
- [x] Increased prompt cache TTL from 5 minutes to 30 minutes and max entries from 20 to 100.
- [x] Updated `tracked_ai_client` to pass provider/model/request metadata into cache lookup and write-through.
- [x] Added focused regression tests for prompt cache separation and caller metadata forwarding.
- [x] Verified with `npm run test:run -- src/lib/ai/prompt_cache.test.ts src/lib/ai/tracked_ai_client.test.ts`.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Validate whether cache keys should eventually include any future task budget or reasoning-mode flags if those begin to change AI output semantics.

## [2026-04-27 06:03] Session Summary

**Completed:**
- [x] Fixed empty chapter generation path so editor and creation-chat callers request `qualityMode: fast` with review/polish skipped, allowing draft content to return before expensive post-processing.
- [x] Hardened chapter writer parsing so multi-line `@@LEDGER@@` JSON no longer discards valid AI output.
- [x] Strengthened chapter writer prompt to require detailed Vietnamese prose, not summaries/outlines/meta replies.
- [x] Added parser regression coverage for multi-line writer ledger JSON.
- [x] Verified with `npm test -- --run src/lib/ai/chapter_writer_ai.test.ts src/lib/workflow/full_write_pipeline.test.ts src/lib/ai/creation_orchestrator.test.ts`.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Smoke-test one real provider-backed empty-chapter generation from the Writer UI to confirm the selected model can produce the requested 1.800-3.000 word output within provider limits.

## [2026-04-27 21:18] Session Summary

**Completed:**
- [x] Added the Novel Polish prompt contract with five modes: Comprehensive, Find Errors, Remove AI Tone, Enhance Details, and Optimize Dialogue.
- [x] Added `NovelPolishTool` inside the Story Editor Muse panel for raw text input and mode selection.
- [x] Routed Novel Polish calls through `polish_style`; Find Errors returns a report without auto-creating a draft proposal.
- [x] Verified with `npm run test:run -- src/lib/ai/novel_polish.test.ts`.
- [x] Verified with `npm run build`.
- [x] Started Vite dev server at `http://127.0.0.1:5173/` and confirmed HTTP 200.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] Browser screenshot verification was not run because Playwright is not installed in this workspace.

**Next Session Should:**
- Smoke-test Novel Polish with a real configured provider from the Writer UI and verify each mode's output shape.

## [2026-04-27 21:32] Session Summary

**Completed:**
- [x] Reused `NovelPolishTool` in the adaptation flow with caller-specific source labels instead of editor-only wording.
- [x] Added inline `Novel Polish` support to `AdaptationPage` using the `polish_style` task route and tracked AI client.
- [x] Added an inline result panel with copy and "Đưa vào prompt" actions for adaptation preflight.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] Real provider smoke-test for adaptation polish was not run in this session.

**Next Session Should:**
- Run one end-to-end adaptation polish call against a configured provider and verify the prompt injection UX with long excerpts.

## [2026-04-28 05:40] Session Summary

**Completed:**
- [x] Translated the Writer Muse / Novel Polish surface from mixed English-Vietnamese to Vietnamese-first labels.
- [x] Renamed visible Story Editor strings such as `The Muse`, polish mode labels, token badges, copy tooltip, loading state labels, and `Export`.
- [x] Updated the adaptation-side reuse of `NovelPolishTool` to use Vietnamese title and error messages.
- [x] Fixed a pre-existing JSX `->` token issue in `AdaptationPage.tsx` that blocked `npm run build`.
- [x] Verified with `npm run test:run -- src/lib/ai/novel_polish.test.ts`.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] Real UI screenshot verification was not run in this session.

**Next Session Should:**
- Smoke-test the Writer and Adaptation polish panels with a real provider to confirm the new Vietnamese labels fit comfortably on smaller screens.

## [2026-04-28 06:05] Session Summary

**Completed:**
- [x] Audited backlog item `P1-1` against the live codebase and confirmed the production slice already exists: `summary_cache` types, Dexie `summaryCache`, HSC retrieval in `context_builder`, and AI enricher wiring in `executePostWritePipeline`.
- [x] Added direct regression coverage for hierarchical summary cache build, cache reuse, and long-range retrieval in `src/lib/memory/hierarchical_summary_cache.test.ts`.
- [x] Verified dependent integrations still pass with `publish_pipeline` and `memory_indexer`.

**In Progress:**
- [ ] UI/task-card completion state for `P1-1` may still need a separate product-side update if the checklist should auto-reflect verified implementation.

**Blocked:**
- [ ] No blocker on the code path itself; remaining mismatch is tracking/status visibility, not implementation.

**Next Session Should:**
- Decide whether the optimization task dashboard should derive completion from code/test state or continue using manual status toggles.

## [2026-04-28 06:10] Session Summary

**Completed:**
- [x] Scoped `P1-2` as “use local narrative memory before AI fallback for plot questions”.
- [x] Added `retrieveForPlotQa()` as a plot-query wrapper over the hybrid memory path.
- [x] Changed `answerPlotQuestion()` precedence to prefer local memory retrieval before shallow project heuristics and AI fallback.
- [x] Added focused regressions for local-memory-first behavior and AI fallback in `src/lib/ai/plot_qa.test.ts`.
- [x] Verified with focused Vitest on `plot_qa` and `hybrid_memory_query`.

**In Progress:**
- [ ] No active implementation items inside this slice.

**Blocked:**
- [ ] No blocker in code. Remaining product decision is whether the task UI should mark `P1-2` done automatically or manually.

**Next Session Should:**
- Consider whether plot Q&A needs a richer deterministic formatter for specific question types like timeline order or payoff tracking.

## [2026-05-02 08:46] Session Summary

**Completed:**
- [x] Added a new hybrid `viettruyen-canon-v1` export bundle for long-story storage.
- [x] The bundle now emits `Markdown` canon docs, raw `JSON` snapshots, `context-map` indexes, and a lightweight structural graph in one zip.
- [x] Wired the new export path into `ExportPage` as `CANON ZIP`.
- [x] Added focused regression coverage for bundle structure, chapter frontmatter, graph edges, and zip packaging.
- [x] Verified with `npm run test:run -- src/lib/canon/canon_bundle.test.ts`.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] None.

**Next Session Should:**
- Add import/rehydration support for `viettruyen-canon-v1` so exported bundles can round-trip back into the app or a backend worker.
- Consider feeding `indexes/context-map.json` directly into the existing memory/RAG bootstrap path.

## [2026-05-04 05:26] Session Summary

**Completed:**
- [x] Added persistent `story_debug_trace` infrastructure with console output and localStorage retention.
- [x] Instrumented AI tracked calls, AI streaming chunks, workflow sessions, Creation Chat batch compose, project chapter persist/hydrate, storage provider init, auth login/logout, and app close/reload lifecycle.
- [x] Added regression coverage for debug trace persistence/truncation.
- [x] Verified with focused Vitest for debug, project, generation, auth, and app-session stores.
- [x] Verified with `npm run build`.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] No blocker. Build still emits pre-existing Vite warnings about externalized Node modules and large chunks.

**Next Session Should:**
- Use browser DevTools console filter `[StoryDebug]` while reproducing a real failed chapter generation, then inspect `localStorage["viettruyen-debug-trace"]` after reload/logout/login.

## [2026-05-05 21:23] Session Summary

**Completed:**
- [x] Added AI plot direction analysis that returns 2-3 story-route options before plot surgery rewrite.
- [x] Added `PlotDirectionPreview` to the Chữa Canon impact scan tab.
- [x] Persisted the selected route in `SurgerySpec.selectedPlotDirection`.
- [x] Injected the selected route into arc, chapter, and QA rewrite instructions.
- [x] Added focused regression tests for prompt/JSON parsing and selected-direction instruction formatting.

**In Progress:**
- [ ] No active implementation items from this change set.

**Blocked:**
- [ ] No blocker. Build still emits pre-existing Vite warnings about externalized Node modules and large chunks.

**Next Session Should:**
- Smoke-test the Chữa Canon flow with a real AI provider and a blocked scan to verify option quality in a real story project.
