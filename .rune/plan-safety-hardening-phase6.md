# Phase 6: Workflow Resilience & i18n Completion

> **Priority:** P2-P3 | **Est:** ~250 LOC | **Session:** Single
> **Goal:** Make multi-step workflows resumable and complete i18n coverage

## Data Flow

```
[Surgery/Retcon Resume]
  Surgery starts → persist session to localStorage (vt-surgery-session-{projectId})
  Each step completes → update persisted session
  App closes mid-surgery → session survives in localStorage
  App reopens → detect orphaned session → offer resume/discard

[i18n Completion]
  Audit all hardcoded Vietnamese strings → replace with t() calls
  Add missing keys to locale files
```

## Code Contracts

```typescript
// src/lib/surgery/surgery_session_persist.ts — NEW
interface PersistedSurgerySession {
  projectId: string;
  type: 'surgery' | 'retcon';
  currentStep: number;
  totalSteps: number;
  partialResults: unknown[];   // serializable intermediate data
  startedAt: number;
  lastUpdatedAt: number;
}

function persistSurgerySession(session: PersistedSurgerySession): void;
function loadSurgerySession(projectId: string): PersistedSurgerySession | null;
function clearSurgerySession(projectId: string): void;
function hasOrphanedSession(projectId: string): boolean;
```

## Tasks

### Wave 1

#### Task 6A: Create surgery session persistence
- **File:** `src/lib/surgery/surgery_session_persist.ts` — new
- **touches:** [src/lib/surgery/surgery_session_persist.ts]
- **provides:** [persistSurgerySession, loadSurgerySession, clearSurgerySession]
- **requires:** []
- **Logic:** Store in localStorage with key `vt-surgery-session-{projectId}`. Serialize intermediate results. Clear on completion or user discard.

#### Task 6B: Audit and fix hardcoded Vietnamese strings
- **File:** multiple files (App.tsx, DashboardPage.tsx, modals, confirm dialogs)
- **touches:** [src/App.tsx, src/components/pages/DashboardPage.tsx, src/components/shared/TokenDashboard.tsx]
- **provides:** [complete i18n coverage for core UI]
- **requires:** []
- **Logic:** grep for Vietnamese strings outside locale files. Replace with `t('key')`. Add keys to `src/lib/i18n/` locale files (vi.ts, en.ts).
- **Priority strings:** "Đang tải...", "Tác phẩm mới", "Dự án mới", confirm dialog texts

### Wave 2

#### Task 6C: Integrate session persistence into surgery/retcon stores
- **File:** `src/store/use_surgery_store.ts`, `src/store/use_retcon_store.ts`
- **touches:** [use_surgery_store.ts, use_retcon_store.ts]
- **provides:** [resumable surgery/retcon workflows]
- **requires:** [Task 6A]
- **depends_on:** [task-6a]
- **Logic:** After each step, call persistSurgerySession. On store init, check hasOrphanedSession. If yes, set flag for UI to show resume prompt.

#### Task 6D: Resume prompt UI
- **File:** `src/components/story-editor/StoryWorkspace.tsx`
- **touches:** [StoryWorkspace.tsx]
- **provides:** [surgery resume banner]
- **requires:** [Task 6C]
- **depends_on:** [task-6c]
- **Logic:** On mount, check for orphaned surgery session. Show banner: "Phiên phẫu thuật cốt truyện chưa hoàn tất. Tiếp tục hoặc hủy?"

### Wave 3

#### Task 6E: Tests
- **File:** `src/lib/surgery/surgery_session_persist.test.ts`
- **touches:** [surgery_session_persist.test.ts]
- **provides:** [regression tests]
- **requires:** [Task 6A]
- **depends_on:** [task-6a]

## Failure Scenarios

| When | Then | Error Handling |
|------|------|----------------|
| Surgery session data corrupted | Discard session, log warning | Try/catch on JSON.parse |
| Session from older app version | Version check → discard if incompatible | Version field in session |
| i18n key missing in a locale | Fallback to Vietnamese (default) | Existing t() fallback logic |

## Rejection Criteria

- ❌ DO NOT persist full chapter content in surgery session — only references + diffs
- ❌ DO NOT remove existing Vietnamese strings from locale files — add English equivalents
- ❌ DO NOT change surgery algorithm — only add persistence layer

## Cross-Phase Context

- **Assumes from Phase 3:** Trash manager available for discarded surgery results
- **Assumes from Phase 5:** Foreshadow tracker data available as surgery input
- **Exports for Phase 7:** i18n patterns established for community page strings

## Acceptance Criteria

- [ ] Surgery workflow interrupted mid-step → resumable on next app load
- [ ] Retcon session interrupted → resumable on next app load
- [ ] No hardcoded Vietnamese in App.tsx, DashboardPage.tsx
- [ ] `grep -rn "Đang tải" src/App.tsx` returns 0 results (replaced with t() call)
- [ ] Tests pass: `npm test -- --run surgery_session_persist`
