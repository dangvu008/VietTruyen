---
description: Automated pre-flight checks, testing, and PR creation workflow
---

## /ship Workflow

This workflow automates the final steps before and during the creation of a Pull Request, minimizing human error and ensuring quality.

### Step 1: Pre-Flight
1. Ensure the working directory is clean. If there are uncommitted changes, analyze them and commit them in atomic, bisectable chunks with descriptive commit messages.
2. Check the current branch. If on `main`, stop. You cannot ship directly to main.

### Step 2: Testing & Observability Checks
1. Ensure tests are passing: Run local unit tests or the test suite matching the modified files (e.g., `npm run test`, `pytest`).
2. Ensure there are no ESLint/TypeScript errors via `npm run lint` or `tsc --noEmit`.
3. If tests fail, stop and prompt the user to fix them. Do not proceed.

### Step 3: CHANGELOG and TODOS
1. Did this change address an item in `TODOS.md` or a known issue tracking file? Update it to mark the item as complete.
2. If the project maintains a `CHANGELOG.md`, automatically summarize the commits and prepend a new entry under an "[Unreleased]" heading.

### Step 4: Version Bump (If Applicable)
Determine if a version bump is required based on Semantic Versioning (SemVer). If the project is an app or package that requires versioning, propose the bump (patch vs minor vs major) to the user.

### Step 5: Push and PR
1. Run `git push -u origin <current_branch>`.
2. Generate a comprehensive PR description summarizing the "Why", "What changed", and "Testing steps".
3. Use `gh pr create` (if available) to submit the pull request, or manually display the git push output so the user can click the PR link.
