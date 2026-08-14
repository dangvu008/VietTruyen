# Guardrails

## Non-Negotiables

- Route before acting. For technical work, read `rune-skill-router` first.
- Any code change defaults to `rune-cook`.
- Do not use the removed `.agent-skills` submodule paths.
- Do not resurrect non-canonical routes or flows that [`docs/CANONICAL_AGENT_SPEC.md`](/Users/adm/VietTruyen/docs/CANONICAL_AGENT_SPEC.md) marks as legacy.
- Do not claim completion without proof.
- Prompt instructions should follow [`docs/PROMPT_STANDARD.md`](/Users/adm/VietTruyen/docs/PROMPT_STANDARD.md): English-first, concise, format-driven.

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

## Story Writing — Writer Identity Hard Contract

When an agent directly drafts, continues, rewrites, or creatively reworks story prose, it must operate as a professional novelist/author at top literary craft level (the project's "đại thần văn học" standard), not as an AI completing a prompt or checklist.

Mandatory writer behavior:

- Canon, outline, character sheets, continuity state, chapter contracts, memory and rules are creative substrate and constraints, not a list of facts that must be visibly demonstrated in prose.
- Surface traits, foreshadowing, motifs, lore and setup only when the current scene naturally calls for them.
- Decision priority is: character truth → situational truth → story logic → naturalness → literary effect → sentence beauty.
- Never sacrifice the earlier priorities merely to sound profound, mysterious, poetic, clever, or visibly compliant with a rule.
- Think in POV, scene pressure, emotional residue, subtext, rhythm, reader experience and long-form consequence rather than task-completion signals.
- The prose must not self-identify the writer as AI or leak prompt/rule/checklist/process language.
- Reviewer/editor roles remain separate. A Writer must not self-certify its own draft merely because it followed its generation rationale.

This contract is injected into Writer prose rules and is a default invariant for every story project unless the user explicitly requests a different authorial mode.

## Story Writing — Pre-Writing Framework Review Hard Gate

Before any project is allowed to write Chapter 1, the story framework must pass a dedicated framework review. Chapter-level review is not a substitute for this gate.

Mandatory order:

`Idea / Story Setup → Framework Candidate → F0 Framework Review → Accepted Framework Baseline → Arc/Volume Plan → Chapter Contract → Writer → Chapter Review/Editing → Promotion`

F0 must review at minimum:

- premise and genre promise;
- causal logic and timeline;
- character goals, motivation, agency, knowledge boundaries, and state assumptions;
- worldbuilding ↔ plot ↔ character dependencies;
- power-system rules, limits, costs, and escalation;
- conflict engine, foreshadow/payoff, and long-form sustainability;
- contradiction and cross-story contamination;
- lore overload and premature reveal risk;
- plot-forced behavior;
- trait literalization / proceduralized characterization encoded in the setup;
- whether the framework leaves enough room for natural character and plot development.

Verdict contract:

- `PASS`: create/activate a versioned Framework Baseline and allow formal arc/chapter planning.
- `HOLD`: block Chapter 1 until missing setup/evidence or material risks are resolved.
- `BLOCK/FAIL`: framework must be revised and re-reviewed.

A score must never override `HOLD`, `BLOCK`, or `FAIL`.

Framework artifacts must preserve `project_id/story_id`, version, status, provenance/source, review result, and review timestamp. Candidate framework is not canon merely because it exists. Chapter contracts must reference the active accepted Framework Baseline.

After writing has started, agents must not silently mutate the framework to justify generated prose. Structural changes require:

`Change Proposal → impact scan (canon/timeline/character/arc/accepted chapters) → framework re-review → PASS → new baseline version → supersede old baseline while preserving provenance`.

Any accepted artifacts affected by the change must be marked `NEEDS_REVIEW` or `HOLD` until regression passes.

Re-run F0 at major volume/arc boundaries and after material canon, world-rule, power-system, identity, timeline, or core-character-motivation changes. A chapter reviewer that identifies a systemic setup defect should escalate it as a framework root cause instead of repeatedly patching local prose.

**Fail-closed invariant:** if Chapter 1 has no evidence of `F0 PASS + active Framework Baseline`, the Writer path must STOP/HOLD. This is a hard gate, not an advisory checklist.
