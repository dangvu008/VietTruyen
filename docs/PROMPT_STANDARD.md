# Prompt Standard

Status: canonical  
Version: v1

## Goal

Use concise, English-first prompts for all agent and runtime AI calls.

## Default Structure

```text
Role: [who the model is]
Task: [what it must do]
Context: [only if needed]
Output: [text | JSON object | JSON array]
Rules:
- [hard constraint]
- [hard constraint]
```

## Rules

- Write prompt instructions in English by default.
- Keep prompts short. Prefer hard constraints over long explanation.
- Keep user-facing output language separate from prompt language.
- Use `Output:` to force format instead of repeating it in prose.
- For historical or cultural writing, lock `time`, `region`, and `register`.
- Mark modern explanations explicitly when they are allowed.
- For structured extraction, require `valid JSON only`.
- Do not mix product docs, architecture rationale, and execution rules in one prompt.

## Good Pattern

```text
Role: Plot editor.
Task: Turn the notes into a usable chapter brief.
Output: valid JSON object only. No markdown. No extra text.
Rules:
- Keep canon consistent.
- Use natural Vietnamese in content fields.
- Leave missing fields empty instead of guessing.
```

## Bad Pattern

- Long roleplay paragraphs.
- Repeating the same constraint in multiple sections.
- Mixing Vietnamese control instructions with English format rules.
- Telling the model what not to do in ten different ways.
