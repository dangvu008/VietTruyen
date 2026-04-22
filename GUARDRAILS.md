# Guardrails

## Non-Negotiables

- Route before acting. For technical work, read `rune-skill-router` first.
- Any code change defaults to `rune-cook`.
- Do not use the removed `.agent-skills` submodule paths.
- Do not resurrect non-canonical routes or flows that [`docs/CANONICAL_AGENT_SPEC.md`](/Users/adm/VietTruyen/docs/CANONICAL_AGENT_SPEC.md) marks as legacy.
- Do not claim completion without proof.

## ACE Guide

- `ACE 1-3 / LITE`: single-file mechanical changes.
- `ACE 4-6 / MED`: multi-file features, behavior changes, routing/state changes.
- `ACE 7-10 / HEAVY`: architecture, cross-domain refactors, migrations, security-sensitive work.

For `ACE >= 4`, rephrase the task, identify touched domains/files, and surface ambiguity before implementation.

## Evidence

At least one of:

- test output
- build/typecheck output
- screenshot for UI work
- concrete diff summary
- command output for infra/config work

## Project-Specific Constraints

- Global vs project workspace boundaries are canonical.
- `dashboard`, `projects`, `adaptation`, `community`, `ai-settings` are the global tabs.
- `bible`, `characters`, `world`, `outline`, `writer`, `chapters`, `review`, `export` are the project tabs.
- `studio`, `brainstorm`, `writing-wizard`, `memory`, `analytics`, `foreshadowing`, `genre-library`, `chua-canon` are not canonical top-level routes unless product truth changes.
