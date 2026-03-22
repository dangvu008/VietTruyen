---
description: Run a Two-Pass Pre-Landing Code Review on the current branch
---

## /review Workflow

This workflow simulates a strict, senior-level code review before merging changes to main.

### Step 1: Branch Check
Identify the current branch. If you are on `main` or there are no uncommitted/differing changes, output "Nothing to review" and stop.

### Step 2: The Two-Pass Review
Analyze the `git diff` against the base branch (usually `main`) in two distinct passes.

**Pass 1: CRITICAL (Security & Trust)**
- **SQL & Data Safety**: Look for injection vectors, missing authorization checks (e.g., Row Level Security gaps), lack of input sanitization.
- **LLM/Trust Boundaries**: Are we trusting external input or AI output without validation? Is there prompt injection risk?
- **Silent Failures**: Did we swallow an exception? Did we use an empty `catch` block?

**Pass 2: INFORMATIONAL (Quality & Maintainability)**
- **Conditional Side Effects**: Are state mutations hidden inside seemingly pure functions?
- **Magic Numbers & String Coupling**: Are there hardcoded IDs or URLs?
- **Dead Code & Consistency**: Unused variables, logs left behind, styling inconsistencies.
- **Test Gaps**: Did the core logic change without a corresponding test update?

### Step 3: Output Findings
Present ALL findings clearly. 
For CRITICAL issues, stop and ask the user how they want to proceed:
- Option A: Fix it now
- Option B: Acknowledge (Won't fix)
- Option C: False positive

If the user selects A, apply the fixes automatically using the appropriate tools.
