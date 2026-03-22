---
description: Weekly Engineering Retrospective summarizing GitHub activity, code quality, and focus
---

## /retro Workflow

This workflow acts as an Engineering Manager parsing the week’s commits to produce a high-signal retrospective of what was accomplished, what slowed us down, and what should be improved next.

### Step 1: Gather Raw Data
Fetch Git activity for the specified interval (default 7 days):
`git log --since=7.days.ago --stat --no-merges`

### Step 2: Compute Metrics
Analyze the raw data to extract:
1. **Focus Score:** Were commits clustered around a single feature/epic, or scattered across 15 different domains?
2. **Commit Type Breakdown:** Categorize by `fix:`, `feat:`, `refactor:`, `chore:`, etc.
3. **Hotspot Analysis:** Which files changed the most frequently? High churn in a single file indicates poor architecture or changing requirements.
4. **PR Size Distribution:** Did we ship big 1,000-line diffs, or atomic 50-line diffs?

### Step 3: Write the Narrative
Present a structured Retrospective Table to the user:
- **Summary:** Lines added/removed, total commits.
- **Top Team Wins:** The 3 most impactful things shipped.
- **Things to Improve (The "Hurts"):** What files had too much churn? Was there an over-representation of bug fixes?
- **Habits for Next Week:** Actionable advice (e.g., "Break PRs down smaller", "Extract logic from `utils.ts` due to high churn").
