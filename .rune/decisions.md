# Decisions Log

## [2026-04-19 17:20] Decision: Rune skills load from `.agents/skills`

**Context:** Root agent bootstrap files pointed at the removed `.agent-skills` submodule, which made the repo advertise skills that were no longer present on disk.
**Decision:** Treat `.agents/skills` plus `skill-index.json` as the installed source of truth for Rune in this repository.
**Rationale:** The actual Rune mesh is present there, including `rune-skill-router`, `rune-cook`, and `rune-session-bridge`.
**Impact:** `AGENTS.md`, `GUARDRAILS.md`, `.cursorrules`, and `.rune/*` bootstrap files.

## [2026-04-19 17:20] Decision: Default code workflow routes through `rune-cook`

**Context:** The user wants agents to proactively choose the right skill and optimize for results instead of manual prompting.
**Decision:** Any code change defaults to `rune-cook`; other technical intents can override only when clearly more specific.
**Rationale:** `rune-skill-router` explicitly declares `rune-cook` as the default implementation route for ambiguous code work.
**Impact:** Future Codex/Cursor sessions, repo-level agent contracts, and `.rune/contract.md`.

## [2026-04-20 17:33] Decision: Story editor chat persists per `projectId/chapterId` and seeds from creation discussion only

**Context:** The Muse panel inside the writer/editor lost history on navigation and did not continue the prior creation discussion after handoff from the larger Creation Chat page.
**Decision:** Add a dedicated persisted story-editor chat store keyed by `projectId -> chapterId`, and lazily seed each chapter from `useCreationChatStore` only when that chapter has no existing Muse history.
**Rationale:** The writer needs durable, chapter-scoped chat continuity without overloading the editor with compose artifacts; seeding only `text`/`suggestions` discussion avoids leaking full draft/framework payloads into the wrong chapter.
**Impact:** `StoryWorkspace`, `AIAssistantPanel`, new story-editor chat helpers/store, localStorage persistence, and future handoff behavior between creation chat and writer.

## [2026-04-25 18:08] Decision: Smart Routing is cost-aware for literary AI tasks

**Context:** The creation workflow needed cheap, specialized literary models and automatic model selection that optimizes token spend instead of only choosing by `fast/balanced/quality` tier.
**Decision:** Extend `AiModel` with price, context window, and capability metadata; score automatic routing by task cost, context fit, tier, and literary capabilities; keep manual model and per-task overrides authoritative.
**Rationale:** Literary writing has different model needs per step: discussion and metadata should be cheap, planning needs context/reasoning, and chapter writing benefits from creative-writing specialists. Cost-aware routing lets the app default to cheaper capable models while still letting users force premium models.
**Impact:** `model_router`, AI model presets, AI settings UI, token/cost estimators, persisted AI store migration, and tracked AI calls.

## [2026-04-26 14:10] Decision: Creation Chat handoff requires generated chapter bodies

**Context:** Framework confirmation could create chapter shells/titles but still hand off to the writer with empty chapter content if batch writing failed.
**Decision:** Treat chapter body generation as part of framework confirmation. Only auto-open the writer when batch compose succeeds for all empty chapters; otherwise stay in Creation Chat with a retryable error.
**Rationale:** The user intent is "AI creates the story content", not title-only chapter scaffolding that requires manual per-chapter regeneration.
**Impact:** `creation_orchestrator`, Creation Chat handoff UI, batch compose progress/error handling, and creation orchestrator regression tests.

## [2026-04-27 05:16] Decision: Full write pipeline quality modes are opt-in

**Context:** The token optimization backlog needs P0-1 quality modes so expensive post-draft steps can be skipped deliberately.
**Decision:** Add `QualityMode = 'fast' | 'balanced' | 'quality'`, default to `quality`, and route full write pipeline steps from that mode.
**Rationale:** Defaulting to `quality` preserves existing writer behavior, while `fast` skips review/polish/data/memory and `balanced` skips checker review but keeps polish plus memory maintenance.
**Impact:** `workflow` payload typing, `executeFullWritePipeline`, workflow orchestrator passthrough, and full write pipeline regression tests.

## [2026-04-27 05:25] Decision: P0-2 only removes backlog-listed skipCache overrides

**Context:** The tracker says to remove five `skipCache: true` overrides from planning and style-analysis calls, but the codebase currently has a sixth override in `writeChapterFromBranch`.
**Decision:** Remove the five listed overrides and leave `writeChapterFromBranch` unchanged.
**Rationale:** The write call is not in the task scope and may still rely on bypassing cache for fresh chapter generation; changing it without an explicit task would couple P0-2 to a separate behavioral decision.
**Impact:** `chapter_writer_ai`, `style_analyzer`, and `outline_planner` now use default prompt-cache behavior for planning/style tasks only.

## [2026-04-27 05:28] Decision: Prompt cache keys include request metadata

**Context:** The previous prompt cache hashed only `systemPrompt + userPrompt`, which allowed collisions across different providers, models, response formats, and generation settings.
**Decision:** Change the prompt cache contract to hash a normalized request payload including provider, model, task type, base URL, response format, temperature, top-p, and prompts.
**Rationale:** Prompt text alone is not enough to identify a semantically equivalent AI request. Cache hits must be safe across the newly cache-enabled planning/style calls from P0-2.
**Impact:** `prompt_cache` API shape changed, `tracked_ai_client` now passes structured key input, and cache TTL/capacity were increased for better reuse.

## [2026-04-27 21:18] Decision: Novel Polish lives inside Writer Muse

**Context:** The requested Novel Polish workflow needs raw text input plus five editing modes, but canonical navigation says not to add top-level tabs without explicit product intent.
**Decision:** Implement Novel Polish as a focused tool inside the existing Story Editor Muse panel and route its AI call through the `polish_style` task type.
**Rationale:** This keeps polishing in the canonical writer/editor surface while still giving users a dedicated raw-text workflow.
**Impact:** `AIAssistantPanel`, `NovelPolishTool`, `novel_polish` prompt contract, and Smart Routing usage for polish calls.

## [2026-04-27 21:32] Decision: Adaptation uses Novel Polish as an inline preflight tool

**Context:** The user approved integrating Novel Polish into the adaptation flow, but the adaptation screen does not have an editor-like draft/proposal surface.
**Decision:** Reuse `NovelPolishTool` inside `AdaptationPage`, run it directly with `polish_style`, and show the result inline with actions to copy or inject into the adaptation prompt.
**Rationale:** This gives phóng tác a preflight editing step without creating a second chat workflow or duplicating polish logic.
**Impact:** `AdaptationPage` now exposes polish before import confirmation, while `NovelPolishTool` accepts caller-specific source text labels.

## [2026-04-28 06:10] Decision: Plot Q&A prefers local memory retrieval over shallow project heuristics

**Context:** Plot questions in shared assistant surfaces could be answered from stale project fields like `character.currentStage` before the richer local narrative memory stack had a chance to contribute newer extracted facts or semantic evidence.
**Decision:** Route plot questions through local memory retrieval first, then fall back to the older deterministic heuristics, and only then use AI fallback if local evidence is insufficient.
**Rationale:** `P1-2 Local-first plot query` is about cost reduction and better factual grounding. Local memory is both cheaper and often more up-to-date than raw project fields for continuity-sensitive questions.
**Impact:** `plot_qa`, shared assistant surfaces, Story Editor Muse plot Q&A, and future local-memory-first query work.
