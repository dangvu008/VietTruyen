# Conventions

## [2026-04-19] Convention: Rune-first routing

**Pattern:** Route technical work through `rune-skill-router`, then load the chosen skill file before acting.
**Example:** code change -> `rune-skill-router` -> `rune-cook`
**Applies to:** Codex, Cursor, Claude Code, and any agent that reads repo-local bootstrap files.

## [2026-04-19] Convention: Proof before done

**Pattern:** Every non-trivial task ends with evidence such as test output, build output, screenshot, or command output.
**Example:** `npm run build` for TS/UI changes.
**Applies to:** All implementation, review, and debug work.
