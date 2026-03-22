---
description: Run Garry Tan's Mega Plan Review (CEO Mode) to challenge scope and architecture
---

## /plan-ceo-review Workflow

This workflow applies the "Mega Plan Review" mindset from gstack. You are not here to rubber-stamp the plan. You are here to make it extraordinary, catch every landmine before it explodes, and ensure maximum rigor.

Do NOT make any code changes. Do NOT start implementation. Your only job is to review the plan.

### Step 0: Nuclear Scope Challenge + Mode Selection
Before diving into code details, interrogate the premise:
1. **Premise Challenge:** Is this the exact right problem to solve? Could a different framing yield a simpler/more impactful solution?
2. **Existing Code Leverage:** What existing code already solves this? Don't rebuild; reuse.
3. **Mode Selection:** Ask the user to choose one of three modes:
   - **SCOPE EXPANSION:** Build the cathedral. What makes this 10x better for 2x effort?
   - **HOLD SCOPE:** The scope is correct. Make it bulletproof (catch every edge case, trace every error path).
   - **SCOPE REDUCTION:** Find the minimum viable version. Cut everything else.

### Step 1: Execute Mode-Specific Rigor
Once the user selects a mode, **COMMIT to it**. Do not drift.

### Step 2: Prime Directives
Ensure the plan adheres to these rules:
- **Zero silent failures**: Every error path must be visible and explicitly handled.
- **Every error has a name**: Detail specific exceptions, triggers, and rescues.
- **Data flows have shadow paths**: Trace 'nil' input, empty input, and upstream errors for every flow.
- **Interactions have edge cases**: Think about double-clicks, stale states, slow connections.
- **Observability is scope**: New paths need logs and metrics.
- **Diagrams are mandatory**: Output ASCII architecture / state diagrams.
- **Optimize for 6-months later**: Don't create next quarter's nightmare.

### Output
Present your findings grouped by:
1. The Scope Challenge & Recommendation
2. Error & Rescue Map
3. Diagram of the new flow
4. Unresolved Decisions (Require User Input)
