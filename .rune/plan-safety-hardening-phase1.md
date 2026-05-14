# Phase 1: Critical Hotfixes

> **Priority:** P0 | **Est:** ~30 LOC | **Session:** Single
> **Goal:** Fix 2 confirmed bugs — export chapter ordering + Plot QA dead apiKey

## Data Flow

```
[Export Bug]  exporter.ts → buildSections() → chapters indexed BACKWARDS → wrong output
[Plot QA Bug] AiAssistant.tsx → answerPlotQuestion(apiKey: '') → always fails AI guard
```

## Code Contracts

```typescript
// exporter.ts:86 — FIX numbering to use (index + 1) instead of (length - index)
// No new interfaces needed

// AiAssistant.tsx — FIX apiKey to use store value
// answerPlotQuestion(question, chapters, { model, apiKey }) — apiKey must be non-empty
```

## Tasks

### Wave 1 (parallel-safe)

#### Task 1A: Fix export chapter numbering
- **File:** `src/core/exporter.ts` — line 86
- **touches:** [src/core/exporter.ts]
- **provides:** [correct chapter ordering in exports]
- **requires:** []
- **Change:** Replace `project.chapters.length - index` with `index + 1`
- **Before:** `Chương ${project.chapters.length - index}: ${chapter.title}`
- **After:** `Chương ${index + 1}: ${chapter.title}`
- **Edge case:** Empty chapters array → already guarded by line 85 check

#### Task 1B: Fix Plot QA apiKey passthrough
- **File:** `src/components/story-editor/AIAssistantPanel.tsx`
- **touches:** [src/components/story-editor/AIAssistantPanel.tsx]
- **provides:** [working Plot QA AI fallback]
- **requires:** []
- **Change:** Find where `answerPlotQuestion` is called with `apiKey: ''`
- **Fix:** Replace with `apiKey` from `useAiStore.getState().apiKey` or equivalent
- **Edge case:** User has no API key set → existing guard in plot_qa.ts handles gracefully

### Wave 2 (depends on Wave 1)

#### Task 1C: Add/verify tests
- **File:** `src/core/exporter.test.ts` — new or existing
- **touches:** [src/core/exporter.test.ts]
- **provides:** [regression test for export ordering]
- **requires:** [Task 1A]
- **depends_on:** [task-1a]
- **Test:** Export 3 chapters → verify output contains "Chương 1" before "Chương 2" before "Chương 3"
- **Test:** Export 0 chapters → verify "Chưa có chương." output

#### Task 1D: Verify Plot QA integration
- **File:** `src/lib/ai/plot_qa.test.ts` — verify existing tests
- **touches:** [src/lib/ai/plot_qa.test.ts]
- **provides:** [regression test for apiKey guard]
- **requires:** [Task 1B]
- **depends_on:** [task-1b]
- **Test:** Call answerPlotQuestion with valid apiKey → should NOT return 'insufficient' source
- **Test:** Call with empty apiKey → should return 'insufficient' gracefully

## Failure Scenarios

| When | Then | Error Handling |
|------|------|----------------|
| Export with 0 chapters | Show "Chưa có chương." | Already handled by line 85-88 |
| Plot QA with no API key configured | Return local search results | Existing guard: `if (!model \|\| !apiKey)` |
| Plot QA API call fails | Return keyword-match fallback | Existing try/catch in answerPlotQuestion |

## Rejection Criteria

- ❌ DO NOT change chapter data model or storage format
- ❌ DO NOT modify plot_qa.ts core logic — only fix the caller (UI layer)
- ❌ DO NOT add new dependencies for these fixes

## Cross-Phase Context

- **Assumes from prior:** Nothing — this is Phase 1
- **Exports for future:** Working export + Plot QA → Phase 5 (AI Context) builds on functional Plot QA

## Acceptance Criteria

- [ ] `grep -n 'chapters.length - index' src/core/exporter.ts` returns 0 results
- [ ] `grep -rn "apiKey: ''" src/components/` returns 0 results for Plot QA calls
- [ ] `npm test -- --run` passes with no regressions
- [ ] Manual test: export 3-chapter project → chapters appear in correct 1,2,3 order
