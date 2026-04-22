# AGENTS.md

This repository uses the installed Rune skill mesh in [`.agents/skills`](/Users/adm/VietTruyen/.agents/skills).

## Default Bootstrap

1. For any technical request, read [`.agents/skills/rune-skill-router/SKILL.md`](/Users/adm/VietTruyen/.agents/skills/rune-skill-router/SKILL.md) first.
2. If the request changes code, route to [`.agents/skills/rune-cook/SKILL.md`](/Users/adm/VietTruyen/.agents/skills/rune-cook/SKILL.md) unless a more specific Rune skill clearly applies.
3. Persist durable context in [`.rune/`](/Users/adm/VietTruyen/.rune) using the session-bridge pattern.
4. Use [`.agents/skills/skill-index.json`](/Users/adm/VietTruyen/.agents/skills/skill-index.json) to discover installed skills before guessing.

## Repo Truth

- Canonical product and navigation truth lives in [`docs/CANONICAL_AGENT_SPEC.md`](/Users/adm/VietTruyen/docs/CANONICAL_AGENT_SPEC.md).
- Architecture intent for AI-assisted development lives in [`docs/AI_NATIVE_TECHNICAL_DESIGN.md`](/Users/adm/VietTruyen/docs/AI_NATIVE_TECHNICAL_DESIGN.md).
- Current stack is React 18 + Vite 5 + TypeScript + Zustand + Tauri v2.

## Project Rules

- Do not treat legacy/demo pages as canonical top-level routes.
- Keep project data ownership in `use_project_store` unless the existing architecture explicitly says otherwise.
- Prefer strict types, micro-files, and proof artifacts over “looks right”.
- Start every code response with Rune routing proof:
  `> Routed: rune:<skill> | Type: <TYPE> | Confidence: <LEVEL>`

## Direct Skill Routes

- Code change: `rune-cook`
- Debug only: `rune-debug`
- Review/audit: `rune-review`
- Planning/architecture: `rune-plan`
- UI system/design direction: `rune-design`
- Large parallel task: `rune-team`
- Refactor/legacy rescue: `rune-rescue` or `rune-surgeon`
- Deploy/ship: `rune-deploy` or `rune-launch`

If uncertain, route to `rune-cook`.
