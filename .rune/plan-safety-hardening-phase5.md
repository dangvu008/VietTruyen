# Phase 5: AI Context Enhancement

> **Priority:** P2 | **Est:** ~300 LOC | **Session:** Multi (may need iteration)
> **Goal:** Reduce AI "amnesia" for long-form fiction (>20 chapters)

## Data Flow

```
context_builder.ts receives chapter request
  → Check story length: ≤20 chapters → current 18K budget (unchanged)
  → >20 chapters → adaptive budget: 24K-28K based on model
  → Enhance HSC: summary budget 1500→2500 chars for long stories
  → Entity retrieval: top 4 → dynamic based on chapter mentions (up to 8)
  → Foreshadowing auto-detect: scan for unresolved planted items
```

## Code Contracts

```typescript
// src/lib/ai/context_builder.ts — MODIFY
// Adaptive budget calculation
function calculateContextBudget(chapterCount: number, model: string): number;
// Currently: const CONTEXT_MAX_CHARS = 18000;
// After: dynamic based on chapter count and model context window

// src/lib/ai/foreshadow_tracker.ts — NEW
interface UnresolvedForeshadow {
  plantedInChapter: number;
  description: string;
  chaptersSincePlanted: number;
  urgency: 'low' | 'medium' | 'high';  // high if >15 chapters unresolved
}

function detectUnresolvedForeshadows(project: Project, currentChapter: number): UnresolvedForeshadow[];
```

## Tasks

### Wave 1

#### Task 5A: Adaptive context budget
- **File:** `src/lib/ai/context_builder.ts`
- **touches:** [src/lib/ai/context_builder.ts]
- **provides:** [calculateContextBudget]
- **requires:** []
- **Logic:** Replace `const CONTEXT_MAX_CHARS = 18000` with function. Rules: ≤20 chapters → 18K, 21-50 → 22K, 51-100 → 25K, 100+ → 28K. Cap based on model's max input.
- **Edge case:** Model with small context window → clamp to model limit minus output reservation

#### Task 5B: Create foreshadow_tracker.ts
- **File:** `src/lib/ai/foreshadow_tracker.ts` — new
- **touches:** [src/lib/ai/foreshadow_tracker.ts]
- **provides:** [detectUnresolvedForeshadows]
- **requires:** []
- **Logic:** Scan project.foreshadowings + ledger entries for `foreshadowPlanted`. Compare against `foreshadowResolved`. Flag unresolved items with urgency based on chapters elapsed.

### Wave 2

#### Task 5C: Enhance HSC summary budget for long stories
- **File:** `src/lib/ai/context_builder.ts`
- **touches:** [src/lib/ai/context_builder.ts]
- **provides:** [better long-form summaries in context]
- **requires:** [Task 5A]
- **depends_on:** [task-5a]
- **Logic:** When adaptive budget > 18K, allocate extra budget to HSC section: summary budget 1500→2500 chars. Increase entity retrieval from top 4 to top 8 when >30 chapters.

#### Task 5D: Inject foreshadow reminders into writing context
- **File:** `src/lib/ai/context_builder.ts`
- **touches:** [src/lib/ai/context_builder.ts]
- **provides:** [foreshadow awareness in AI context]
- **requires:** [Task 5B]
- **depends_on:** [task-5b]
- **Logic:** Add "[FORESHADOW_REMINDERS]" section to context when unresolved items exist with urgency ≥ medium. Budget: 300 chars max.

### Wave 3

#### Task 5E: Tests
- **File:** `src/lib/ai/context_builder.test.ts`, `src/lib/ai/foreshadow_tracker.test.ts`
- **touches:** [context_builder.test.ts, foreshadow_tracker.test.ts]
- **provides:** [regression + new feature tests]
- **requires:** [Task 5A-5D]
- **depends_on:** [task-5a, task-5b]
- **Tests:** Budget scales with chapter count, HSC budget increases for long stories, foreshadow detection identifies unresolved items, urgency calculation correct

## Failure Scenarios

| When | Then | Error Handling |
|------|------|----------------|
| Adaptive budget exceeds model limit | Clamp to model.maxInputTokens - outputReservation | Dynamic cap |
| No foreshadowings in project | Skip foreshadow section entirely | Graceful empty check |
| Very large HSC summary | Truncate at budget limit, preserve most recent entries | Existing truncation logic |

## Rejection Criteria

- ❌ DO NOT change to vector/embedding-based retrieval in this phase — keep deterministic
- ❌ DO NOT increase budget beyond 28K — diminishing returns + cost
- ❌ DO NOT make foreshadow tracker a required dependency — inject optionally
- ❌ DO NOT modify entity graph schema

## Cross-Phase Context

- **Assumes from Phase 1:** Plot QA apiKey fixed, AI fallback functional
- **Assumes from Phase 4:** Network status available for AI operations
- **Exports for Phase 6:** Foreshadow tracker data available for surgery/retcon workflows

## Acceptance Criteria

- [ ] 50-chapter story gets 22K context budget (vs 18K before)
- [ ] HSC summary section uses 2500 chars for long stories
- [ ] Entity retrieval returns up to 8 entities for >30-chapter stories
- [ ] Unresolved foreshadows with urgency ≥ medium appear in writing context
- [ ] All tests pass: `npm test -- --run context_builder foreshadow_tracker`
