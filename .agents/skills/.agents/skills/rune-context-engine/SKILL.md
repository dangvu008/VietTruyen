---
name: rune-context-engine
description: "Context window management. Auto-triggered when context is filling up. Triggers smart compaction and preserves critical information across compaction boundaries. Called by L1 orchestrators at context thresholds."
---


# context-engine

> **RUNE COMPLIANCE**: Before ANY code response, you MUST:
> 1. Classify this request (CODE_CHANGE | QUESTION | DEBUG | REVIEW | EXPLORE)
> 2. Route through the correct Rune skill (see skill-router routing table)
> 3. Follow the skill's workflow — do NOT freelance or skip steps
> Violation: writing code without skill routing = incorrect behavior.

## Platform Constraints

- SHOULD: Monitor your context usage. If working on a long task, summarize progress before context fills up.
- MUST: Before summarizing/compacting context, save important decisions and progress to project files.
- SHOULD: Before ending, save architectural decisions and progress to .rune/ directory for future sessions.

## Purpose

Context window management for long sessions. Detects when context is approaching limits, triggers smart compaction preserving critical decisions and progress, and coordinates with session-bridge to save state before compaction. Prevents the common failure mode of losing important context mid-workflow.

Context-engine also enforces Rune's retrieval discipline using [`references/context-retrieval-contract.md`](../../references/context-retrieval-contract.md): when context pressure rises, agents must narrow scope before reading more code.

### Behavioral Contexts

Context-engine also manages **behavioral mode injection** via `contexts/` directory. Three modes are available:

| Mode | File | When to Use |
|------|------|-------------|
| `dev` | `contexts/dev.md` | Active coding — bias toward action, code-first |
| `research` | `contexts/research.md` | Investigation — read widely, evidence-based |
| `review` | `contexts/review.md` | Code review — systematic, severity-labeled |

**Mode activation**: Orchestrators (cook, team, rescue) can set the active mode by writing to `.rune/active-context.md`. The session-start hook injects the active context file into the session. Mode switches mid-session are supported — the orchestrator updates the file and references the new behavioral rules.

**Default**: If no `.rune/active-context.md` exists, no behavioral mode is injected (standard Claude behavior).

## Triggers

- Called by `cook` and `team` automatically at context boundaries
- Auto-trigger: when tool call count exceeds threshold or context utilization is high
- Auto-trigger: before compaction events

## Calls (outbound)

# Exception: L3→L3 coordination
- `session-bridge` (L3): coordinate state save when context critical
- `neural-memory` (L3): flush cross-session learnings before compaction or context reset

## Called By (inbound)

- `cook` (L1): Phase boundaries and when tool count exceeds thresholds
- `team` (L1): before parallel workstream dispatch, after merge
- `rescue` (L1): between refactoring sessions for state persistence
- `context-pack` (L3): when packaging context for sub-agent handoff
- `session-bridge` (L3): coordinates with context-engine for compaction timing

## Execution

### Step 1 — Count tool calls

Count total tool calls made so far in this session. This is the ONLY reliable metric — token usage is not exposed by Claude Code and any estimate will be dangerously inaccurate.

Do NOT attempt to estimate token percentages. Tool count is a directional proxy, not a precise measurement.

### Step 2 — Classify health

Map tool call count to health level:

```
GREEN   (<50 calls)    — Healthy, continue normally
YELLOW  (50-80 calls)  — Load only essential files going forward
ORANGE  (80-120 calls) — Recommend /compact at next logical boundary
RED     (>120 calls)   — Trigger immediate compaction, save state first
```

These thresholds are directional heuristics, not precise limits. Sessions with many large file reads may hit context limits earlier; sessions with mostly Grep/Glob may go longer.

#### Large-File Adjustment

Projects with large source files (Python modules often 500-1500 LOC, Java files similarly) consume significantly more context per read the file call. If the session has read files averaging >500 lines, apply a 0.8x multiplier to all thresholds:

```
Adjusted thresholds (large-file sessions):
GREEN   (<40 calls)    — Healthy, continue normally
YELLOW  (40-65 calls)  — Load only essential files going forward
ORANGE  (65-100 calls) — Recommend /compact at next logical boundary
RED     (>100 calls)   — Trigger immediate compaction, save state first
```

Detection: count read the file tool calls that returned >500 lines. If ≥3 such calls → activate large-file thresholds for the remainder of the session.

### Step 3 — If YELLOW

Emit advisory to the calling orchestrator:

> "[X] tool calls. Load only essential files. Avoid reading full files when Grep will do."

Additional retrieval rule:

- switch to `graph-first` or `hybrid-impact` mode for any remaining medium/large task context loading
- stop broad directory reads unless no ranked candidate set exists

Do NOT trigger compaction yet. Continue execution.

### Step 4 — If ORANGE

Emit recommendation to the calling orchestrator:

> "[X] tool calls. Recommend /compact at next phase boundary (after current module completes)."

Identify the next safe boundary (end of current loop iteration, end of current file being processed) and flag it.

Additional retrieval rule:

- require candidate ranking before any additional read the file calls
- prefer packet compression over loading extra context into the live window

### Step 5 — If RED

Immediately trigger state save via `the rune-session-bridge skill` (Save Mode) before any compaction occurs.

Pass to session-bridge:
- Current task and phase description
- List of files touched this session
- Decisions made (architectural choices, conventions established)
- Remaining tasks not yet started

After session-bridge confirms save, emit:

> "Context CRITICAL ([X] tool calls, likely near limit). State saved to .rune/. Run /compact now."

Block further tool calls until compaction is acknowledged.

Exception:

- if the next action is a single targeted verification read against an already-ranked file, allow it
- otherwise, no new exploratory reads

### Step 6 — Report

Emit the context health report to the calling skill.

### Step 6b — Context Percentage Advisory

In addition to tool-call counting, monitor context window percentage when available:

| Remaining | Level | Action |
|-----------|-------|--------|
| >35% | SAFE | Continue normally |
| 25-35% | WARNING | Advise: "Context at ~[X]%. Consider /compact at next phase boundary" |
| <25% | CRITICAL | Save state via session-bridge → recommend immediate /compact |

Debounce: emit advisory max once per 5 tool calls to avoid noise.
Tool-call thresholds (Steps 1-2) remain the primary signal. Percentage advisory is supplementary — use when CLI status bar data is available.

## Iterative Retrieval (Context-Loading Strategy)

When loading context for a task (Phase 1 of cook, or onboard), use a 4-phase retrieval loop instead of loading everything at once:

```
1. DISPATCH (broad): Search with initial task keywords → get 5-10 candidate files
2. EVALUATE: Score each file's relevance (0-1). Note codebase-specific terminology discovered
3. REFINE: Use discovered terms to search again with better keywords
4. LOOP: Repeat max 3 cycles. STOP when 3 high-relevance files found (not 10 mediocre ones)
```

**Why**: The first search cycle reveals codebase-specific terms (custom class names, project conventions, internal APIs) that produce much better results in cycle 2. Loading 3 deeply relevant files beats loading 10 surface-level matches.

**Key rule**: Stop at 3 high-relevance files, not 10 mediocre ones. Quality > quantity for context loading.

### Retrieval Escalation Policy

Map health level to retrieval strictness:

| Health | Retrieval Policy | Read Policy |
|--------|------------------|-------------|
| `GREEN` | `local-search` allowed for small tasks | Normal targeted reads |
| `YELLOW` | prefer `graph-first` for medium/large tasks | avoid broad scans |
| `ORANGE` | require ranked candidates before reading | packetize before reading more |
| `RED` | no exploratory retrieval | compact or stop |

### Index Freshness Gate

When GitNexus-backed retrieval is in play, classify the index as `fresh`, `stale`, or `missing` before relying on graph output.

Check:

- whether `.gitnexus/` exists
- whether candidate paths still exist locally
- whether recent structural changes likely outdate the index

Policy:

- `fresh`: use ranked candidates normally
- `stale`: use graph output only to prioritize, then verify locally
- `missing`: fall back to local search and lower confidence

Never let stale graph output justify more context loading than a local fallback would require.

## Compaction Technique: Structured Summary with Continuation Point

When compaction is triggered (RED or approved ORANGE), generate a **structured summary** that replaces the full conversation history while preserving therapeutic continuity — the ability to resume exactly where work left off.

### Summary Structure

The compaction summary MUST include these sections in order:

```markdown
## Compaction Summary (generated at [tool call count])

### Topics Covered
- [bullet list of distinct topics/tasks worked on this session]

### Key Decisions Made
- [decision]: [rationale] — affects [files/modules]

### Active Threads
- [what was being worked on when compaction triggered — the "where we are now" anchor]
- Current file: [path], current function/section: [name]
- Partial progress: [what's done vs what remains in the immediate task]

### Emotional/Priority Context
- [user urgency level, blocking issues, deadlines mentioned]
- [any user frustrations or preferences expressed this session]

### Continuation Point
> Resume: [exact next action to take — not vague "continue working" but specific "implement the validation logic in src/auth/validate.ts:47 using the Zod schema defined in Step 2"]
```

### Why This Structure

Most compaction loses the **continuation point** — the agent knows WHAT was discussed but not WHERE to resume. The "Active Threads" and "Continuation Point" sections solve this by preserving:
1. The exact file and function being edited
2. What's done vs remaining in the current micro-task
3. The specific next action (not a summary of the plan, but the next concrete step)

### Rules

- Summary MUST be <500 tokens — if longer, you're summarizing too much detail
- "Active Threads" section is the most critical — get this wrong and the agent restarts from scratch
- Never include full file contents in the summary — only paths and line references
- Include user tone/urgency signals — these are lost in pure technical summaries
- If retrieval artifacts exist, include ranked file paths and excluded context instead of re-summarizing whole modules

## Incremental Stream Processing

When processing streaming LLM output (e.g., in skills that invoke AI calls or process tool output incrementally), use **sentence-level buffering** instead of waiting for the full response:

### Pattern: Buffer → Detect Boundary → Act

```
1. ACCUMULATE: Feed incoming chunks into a text buffer
2. DETECT: Check for sentence boundaries:
   - Primary: 40+ chars ending in . ! ? ; :
   - Secondary: paragraph break (\n\n) with 15+ chars accumulated
   - Never split mid-word or mid-code-block
3. EXTRACT: Remove the complete sentence from the buffer
4. ACT: Process the extracted sentence immediately (e.g., queue for TTS, parse for structured data, update progress display)
5. CONTINUE: Keep accumulating the next sentence while processing the current one
```

### When to Use

- **Skills that stream AI responses to the user**: process and display incrementally instead of waiting for the full response
- **Background note-taking**: extract key points from streaming output as they arrive
- **Progress reporting**: detect milestone keywords in streaming output to update progress

### When NOT to Use

- **Code generation**: wait for the full code block — partial code is useless
- **JSON output**: accumulate until the closing brace — partial JSON can't be parsed
- **Short responses** (<100 chars expected): overhead of boundary detection exceeds benefit

## Artifact Folding (Large Output Management)

When tool results are excessively large, they consume disproportionate context without proportionate value. **Artifact folding** saves the full output to a file and replaces it in context with a compact preview.

### When to Fold

| Condition | Action |
|-----------|--------|
| Tool output > 4000 characters | Fold to artifact |
| Tool output > 120 lines | Fold to artifact |
| Multiple tool outputs from the same command class (e.g., 5+ Grep results) | Fold all into single artifact |
| Code block output > 200 lines | Fold to artifact |

### Folding Procedure

1. **Save full output** to `.rune/artifacts/artifact-{timestamp}-{tool}.md`:
   ```markdown
   # Artifact: {tool_name} output
   Generated: {timestamp}
   Command: {tool_call_summary}
   
   {full_output}
   ```

2. **Replace in context** with a compact preview:
   ```
   [FOLDED: {tool_name} output — {line_count} lines, {char_count} chars]
   Preview (first 10 lines):
   {first_10_lines}
   ...
   Full output: .rune/artifacts/artifact-{timestamp}-{tool}.md
   Use Read to access the full artifact if needed.
   ```

3. **On compaction**: Artifact files survive compaction — the continuation summary references them by path. This means large outputs are preserved across compaction boundaries without consuming context.

## Output Format

```markdown
## Context Health Report
- **Health**: [GREEN | YELLOW | ORANGE | RED]
- **Tool Calls**: [count]
- **Retrieval Policy**: [local-search | graph-first | hybrid-impact | compact-now]
- **Index Status**: [fresh | stale | missing | not-applicable]
- **Recommended Action**: [next step]

### Context Controls
- [specific do/don't guidance for remaining reads]

### Retrieval Guidance
- **Candidate Requirement**: [required | recommended | not-needed]
- **Packetize Next**: [yes | no]
- **Excluded Reads**: [what should not be loaded]

### Continuation Boundary
- [next safe compaction or handoff boundary]
```

## Returns

| Field | Type | Description |
|-------|------|-------------|
| `health` | enum | `GREEN` / `YELLOW` / `ORANGE` / `RED` |
| `retrieval_policy` | enum | `local-search` / `graph-first` / `hybrid-impact` / `compact-now` |
| `index_status` | enum | `fresh` / `stale` / `missing` / `not-applicable` |
| `recommended_action` | string | Immediate next action for the caller |
| `boundary` | string | Next safe phase boundary or compaction point |

## Constraints

1. MUST treat rising context pressure as a retrieval problem before treating it as a summarization problem.
2. MUST tighten retrieval policy as health degrades.
3. MUST report index freshness honestly when graph retrieval is referenced.
4. MUST NOT authorize exploratory broad reads in `ORANGE` or `RED`.
5. MUST NOT mistake artifact folding for permission to load more context.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Treating tool count as permission for broad reads while context is already semantically saturated | HIGH | Apply retrieval escalation and stop at minimum sufficient context |
| Trusting stale graph output and loading the wrong files | HIGH | Check `Index Status`, verify candidates locally |
| Compaction summary repeats full module context instead of preserving retrieval artifacts | MEDIUM | Reference ranked files and artifact paths, not broad summaries |
| Packetization delayed until after too many reads | MEDIUM | Require packetize-next at `ORANGE` before further exploratory reads |

## Done When

- Context health classified
- Retrieval policy classified
- Index freshness reported when applicable
- Recommended action emitted
- Next safe boundary identified

## Cost Profile

~100-300 tokens input, ~150-400 tokens output. Haiku. Very low cost; should trigger earlier than compaction to save more expensive downstream context.

**Scope guardrail**: Do not perform code discovery for the caller. Only classify context pressure, enforce retrieval policy, and prepare for compaction or packetization.

### Rules

- **Never fold user messages** — only tool outputs
- **Never fold error outputs** — errors need full visibility for debugging
- **Never fold outputs < 1000 chars** — folding overhead exceeds savings
- **Fold preemptively in YELLOW/ORANGE** — don't wait for RED to start managing output size
- **Clean up artifacts** at session end: artifacts older than the current session can be deleted (they're already in git history or irrelevant)

### Why

A single search file contents across a large codebase can return 3000+ lines. Without folding, this consumes ~4000 tokens of context — often more than the rest of the conversation combined. Folding preserves the information (accessible via Read) while keeping context lean. Combined with the Structured Summary compaction technique, artifact folding enables much longer productive sessions.

## Context Health Levels

```
GREEN   (<50 calls)    — Healthy, continue normally
YELLOW  (50-80 calls)  — Load only essential files
ORANGE  (80-120 calls) — Recommend /compact at next logical boundary
RED     (>120 calls)   — Save state NOW via session-bridge, compact immediately
```

Note: These are tool call counts, NOT token percentages. Claude Code does not expose context utilization to skills. Tool count is a directional signal only.

## Strategic Compact Decision Table

When ORANGE or RED is reached, use this table to determine whether compaction is safe at the current boundary:

| Transition | Compact? | Reason |
|-----------|----------|--------|
| Research → Planning | YES | Research findings summarize well; key decisions survive |
| Planning → Implementation | YES | Plan is in files (.rune/plan-*.md); context can reload from artifacts |
| Debug → Next feature | YES | Debug findings are in Debug Report; fix has the diagnosis |
| Mid-implementation (Phase 4) | **CONDITIONAL** | Safe ONLY at task boundaries within Phase 4 (after a file is fully written + tested). Never mid-file-edit. See Mid-Loop Compaction below |
| After failed approach → Pivot | YES | Failed approach should be discarded; fresh context helps |
| Quality (Phase 5) → Verify | **NO** | Quality findings reference specific file:line in current context |
| After commit (Phase 7) | YES | Work is persisted in git; safe boundary |

**What survives compaction**: Task description, file paths mentioned, key decisions, plan reference, current phase.
**What is lost**: Full file contents read, intermediate reasoning, exact error messages, tool output details.

### Mid-Loop Compaction (Phase 4 Emergency)

> From goclaw (nextlevelbuilder/goclaw, 832★): "Compact during run, not just at session boundary."

When context hits RED during Phase 4 (implementation), compaction IS possible at **clean split points**:

1. **Find a clean boundary**: completed task within the phase (file fully written + tests pass for that file)
2. **Flush state first**: call `session-bridge` to save progress, then call `neural-memory` to capture decisions
3. **Split 70/30**: preserve 70% of remaining context for continuation, summarize 30% of completed work
4. **Never break tool pairs**: compaction MUST NOT split a `tool_use` from its `tool_result` — always keep pairs together
5. **Inject continuation marker**: after compaction, include: "Resuming Phase 4. Tasks [1-3] complete. Currently on task 4. Plan file: `.rune/plan-X-phaseN.md`"

**Timeout fallback**: If clean boundary can't be found within 30 seconds, create `.rune/.continue-here.md` and pause instead.

**Skip if**: Context is ORANGE (not RED), or fewer than 3 tasks remain in the phase.

## Context Budget Audit (Baseline Cost Awareness)

MCP tool schemas and agent descriptions consume significant baseline context before any work begins. This section helps identify and reduce invisible context waste.

### Token Cost Reference

| Source | Approx. Cost | Loaded When |
|--------|-------------|-------------|
| Each MCP tool schema | ~500 tokens | Session start (always) |
| Each agent description | ~200-400 tokens | Every `Task()` invocation |
| CLAUDE.md | ~100-2000 tokens | Session start (always) |
| Skill SKILL.md (full load) | ~500-3000 tokens | When skill is invoked |

### Budget Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| Max MCP servers | <10 active | Disable unused MCP servers in settings |
| Max MCP tools | <80 total | Remove or consolidate bloated MCP servers |
| Agent descriptions | Only load needed | Use specific `subagent_type` to avoid loading all descriptions |
| CLAUDE.md size | <150 lines | Move detailed docs to `.rune/` files, keep CLAUDE.md as index |

### Audit Procedure

When context health is YELLOW or worse, or when onboard detects >80 MCP tools:

1. Count total MCP tool schemas loaded (from session start messages)
2. Count agent descriptions available
3. Estimate baseline cost: `(tools × 500) + (agents × 300) + CLAUDE.md tokens`
4. If baseline >15% of estimated context window → flag as **Context Budget Warning**
5. Rank MCP servers by tool count — suggest disabling servers with most tools and least usage

### Report Addition

When Context Budget Warning fires, append to Context Health report:

```
### Context Budget
- **Baseline cost**: ~[N]k tokens ([X]% of estimated window)
- **MCP tools loaded**: [count] across [N] servers
- **Top consumers**: [server1] ([N] tools), [server2] ([N] tools)
- **Recommendation**: Disable [server] to save ~[N]k tokens
```

---
> **Rune Skill Mesh** — 62 skills, 215+ connections, 14 extension packs
> [Landing Page](https://rune-kit.github.io/rune) · [Source](https://github.com/rune-kit/rune) (MIT)
> **Rune Pro** ($49 lifetime) — product, sales, data-science, support packs → [rune-kit/rune-pro](https://github.com/rune-kit/rune-pro)
> **Rune Business** ($149 lifetime) — finance, legal, HR, enterprise-search packs → [rune-kit/rune-business](https://github.com/rune-kit/rune-business)