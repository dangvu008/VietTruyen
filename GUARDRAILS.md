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

## Story Writing — Reader Orientation Hard Gate

**Core rule: hide the answer, not the question.** Mystery may withhold cause, true identity, hidden mechanism, future consequence or author-only truth. It must not withhold basic experiential information that the POV already knows and a cold reader needs in order to understand the current scene.

A chapter must be `HOLD` when any of the following is true:

- a recurring phenomenon is familiar to the POV but the reader is forced to wait multiple chapters to understand how it is experienced at a basic level;
- a major transition occurs but the reader cannot tell the minimum practical frame — where the POV is, whether the event is new/familiar, or what immediately preceded the transition — even though the POV knows it;
- the POV reacts calmly/intimately to a situation that appears inexplicable to the reader only because known backstory/premise has been withheld;
- the draft treats premise delivery itself as mystery instead of preserving mystery around the cause or deeper truth.

Repair rules:

- add only 1–3 early footholds through action, transition, short memory, ordinary dialogue or a concise narrator sentence;
- do not dump lore or explain the hidden mechanism;
- after repair, a cold reader must understand the *problem/premise* while still not knowing the *answer*.

`reader_orientation_failure` is a high-severity pre-save issue when it affects Chapter 1, a major world transition, a new POV entry, or a recurring mechanism that drives the plot.

## Story Writing — Epistemic Prose / Reasoning Leak Hard Gate

Evidence discipline belongs primarily to Writer/Reviewer reasoning. It must not become a default narrative voice or character trait.

Flag `epistemic_prose_leak` when prose repeatedly uses method-language such as:

- “chưa đủ để chứng minh” / “một lần chưa thành quy luật”;
- explicit source validation or “independent confirmation” language;
- enumerated alternative explanations merely to show caution;
- repeated reminders not to infer, not to connect clues, or to eliminate hypotheses;
- lab/checklist phrasing that exists mainly to prove the character is rational, cautious or non-hallucinatory.

Uncertainty is allowed and often desirable. Express it through human perception, hesitation, action, omission, conflicting desire, consequence or one concise thought. Do not turn a novel into a verification report.

**Fail rule:** if removing the methodological wording preserves the same plot fact and uncertainty, prefer removal/simplification unless the scene is explicitly professional investigation, scientific work, legal proof, forensic work, puzzle-solving or another context that naturally requires formal reasoning.

## Story Writing — Scene Engine Diversity Gate

Review nearby chapters as a sequence, not only one chapter at a time.

Flag `repetitive_investigation_structure` when multiple adjacent chapters substantially repeat:

`clue/object → ask/search expert → test/compare → eliminate possibilities → conclude UNKNOWN`

while only changing the object, location or NPC.

A repeated investigation beat is acceptable only when it materially changes at least one of: relationship, risk, decision, goal, possession, location, character state, irreversible consequence, or reader understanding at a new level.

When the pattern repeats without such change, compress/merge the checks or change the dramatic carrier. Tight logic does not compensate for static dramaturgy.

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
- reader-orientation requirements for Chapter 1 and every core recurring mechanism: what the POV already knows that readers must understand immediately vs what truth may remain intentionally hidden;
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