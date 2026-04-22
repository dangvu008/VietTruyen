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
