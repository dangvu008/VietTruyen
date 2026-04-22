# Rune Contract

## routing

- The installed source of truth for skills is `.agents/skills/`, not `.agent-skills/`.
- Every technical request starts by checking `rune-skill-router`.
- Any code modification routes to `rune-cook` unless the intent is more specific (`rune-review`, `rune-debug`, `rune-plan`, `rune-design`, `rune-team`, `rune-rescue`, `rune-deploy`, `rune-launch`, `rune-db`).
- If the user asks for autopilot, autonomous execution, or "làm hết", fall back to `rune-cook` or `rune-team` unless a real `rune-autopilot` skill is installed.
- Code responses must include Rune routing proof.

## product

- Canonical product truth: `docs/CANONICAL_AGENT_SPEC.md`.
- Architecture truth for AI-assisted implementation: `docs/AI_NATIVE_TECHNICAL_DESIGN.md`.
- Do not promote legacy/demo pages back into the canonical navigation without explicit product intent.

## implementation

- Stack: React 18, Vite 5, TypeScript, Zustand, Tauri v2.
- Prefer strict typing and small modules.
- Preserve existing store ownership and route registries.

## continuity

- After non-trivial work, update `.rune/decisions.md`, `.rune/progress.md`, and `.rune/session-log.md`.
- Use `.rune/metrics/routing-overrides.json` for future adaptive rules instead of hardcoding shortcuts into prompts.
