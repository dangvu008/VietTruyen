---
description: Apply Systematic QA Testing to verify code functionality and catch regressions
---

## /qa Workflow

This workflow executes rigorous, evidence-based QA on either the current branch changes or a specific feature flow.

### Mode Definition
- **Diff-Aware Mode (Default):** QA is scoped tightly to the `git diff`.
- **Full Scope Mode:** QA visits every reachable state/page described.
- **Quick Smoke Test:** Basic health check (load, console, click paths).

### Step 1: Diff and Dependency Mapping
1. Run `git diff main...HEAD --name-only` to see what changed.
2. Trace the dependencies: Which routes/URLs/pages rely on these modified files?
3. List the exact URLs or UI flows that will be tested.

### Step 2: Test Execution & Verification
For each affected flow:
1. Verify the app is running locally (e.g., localhost:3000). Ask the user to start if not.
2. Navigate logically through the changed interface or API endpoints.
3. Check Browser / Node Console: Are there new warnings or errors thrown? A silent error in the console is a failure.
4. Interaction Edges: Rapid clicking, malformed input string testing, empty states. Does the UI crash?

### Step 3: Health Score & Output
Produce a QA report with a clear rubric:
- **Visual:** Does it look correct? Any overlap? Layout shifts?
- **Functional:** Do all buttons and forms work?
- **Console / Network:** Zero 404s, 500s, or JS console exceptions.

Output the final report to the user and note any necessary immediate fixes.
