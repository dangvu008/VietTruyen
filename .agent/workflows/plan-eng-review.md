---
description: Run Garry Tan's Engineering Plan Review to ensure technical rigor and minimal diffs
---

## /plan-eng-review Workflow

This workflow is the counterpart to the CEO review, focusing purely on engineering rigor, testing, and implementation strategy before writing code.

### Priority Hierarchy
If context is tight, prioritize: Step 0 > Test Diagram > Opinionated Recommendations > Everything else.

### Engineering Preferences to Enforce
- **DRY is important**: Flag repetition aggressively.
- **Well-tested code is non-negotiable**: Too many tests > too few tests.
- **Engineered enough**: Avoid under-engineering (hacky) AND over-engineering (premature abstraction).
- **Thoughtfulness > Speed**: Err on the side of handling more edge cases.
- **Bias toward explicit**: Clever code is bad code. Explicit code is good code.
- **Minimal Diff**: Achieve the exact goal touching the fewest abstractions and files.

### Required Output Sections
1. **NOT in scope**: Explicitly state what we are NOT doing in this step.
2. **Architecture Review**: Evaluate file additions. If it touches >8 files or introduces >2 services, challenge the complexity.
3. **Diagrams**: Generate ASCII diagrams for data flow, state machines, and dependencies.
4. **Failure Modes**: Document what happens when the DB is down, API times out, or data is malformed.
5. **Test Plan Breakdown**: Recommend unit, integration, and UI tests needed.

Present these to the user and wait for their approval before jumping into `/edit` or code execution.
