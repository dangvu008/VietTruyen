# Universal Agent Brief

Use this when a task needs a portable, low-token execution contract.

## Canonical Brief

```text
Objective: [what to change]
Scope: [files/modules allowed]
Do Not Touch: [protected areas]
Stop And Ask: [risky actions]
Done When: [observable outcome]
Verify: [smallest valid test/build/check]
```

## Rules

- Keep the brief in English unless the task explicitly requires another language.
- Keep each line short and operational.
- Prefer file/module scope over vague product scope.
- Define completion with observable behavior, not intent.
- Define one concrete verification step.

## Example

```text
Objective: Fix login validation in the auth UI.
Scope: src/auth/*, related tests only.
Do Not Touch: package.json, DB schema, deploy config.
Stop And Ask: adding deps, deleting files, schema changes.
Done When: invalid email is blocked, empty password is blocked, valid input still submits.
Verify: run the smallest relevant test command.
```

## Relationship To Project Docs

- Global rules: `AGENTS.md`
- Safety and canonical routes: `GUARDRAILS.md`
- Product truth: `docs/CANONICAL_AGENT_SPEC.md`
- Prompt wording: `docs/PROMPT_STANDARD.md`
