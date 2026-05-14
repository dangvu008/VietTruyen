# Phase 3: Data Protection (Trash + Quota Guard)

> **Priority:** P1 | **Est:** ~250 LOC | **Session:** Single
> **Goal:** Prevent permanent data loss from accidental deletion and localStorage overflow

## Data Flow

```
[Soft Delete]
  User clicks "Xóa" → rich confirmation modal (not window.confirm)
  → move to trash (localStorage key: vt-trash-{id}) with 30-day TTL
  → remove from active projects
  Dashboard "Thùng rác" tab → list trashed items → restore or permanent delete

[Quota Guard]
  Before any localStorage.setItem → estimate payload size
  At 80% quota → show warning banner
  At 95% quota → block new projects, suggest export/cleanup
  On QuotaExceededError → catch, show actionable error, prevent data loss
```

## Code Contracts

```typescript
// src/lib/storage/trash_manager.ts — NEW
interface TrashedItem {
  id: string;
  type: 'project' | 'chapter';
  data: unknown;         // serialized project/chapter
  trashedAt: number;     // epoch ms
  expiresAt: number;     // trashedAt + 30 days
  title: string;         // for display
}

function moveToTrash(item: TrashedItem): void;
function restoreFromTrash(id: string): unknown;
function permanentDelete(id: string): void;
function listTrash(): TrashedItem[];
function cleanExpired(): void;    // called on app init

// src/lib/storage/quota_guard.ts — NEW
interface QuotaStatus {
  usedBytes: number;
  totalBytes: number;     // estimated ~5MB
  percentUsed: number;
  level: 'ok' | 'warning' | 'critical';
}

function checkQuota(): QuotaStatus;
function estimatePayloadSize(value: unknown): number;
function canSafelyWrite(key: string, value: unknown): boolean;
```

## Tasks

### Wave 1 (foundations)

#### Task 3A: Create trash_manager.ts
- **File:** `src/lib/storage/trash_manager.ts` — new
- **touches:** [src/lib/storage/trash_manager.ts]
- **provides:** [moveToTrash, restoreFromTrash, permanentDelete, listTrash, cleanExpired]
- **requires:** []
- **Logic:** Store trashed items in separate localStorage keys (`vt-trash-{id}`). TTL = 30 days. cleanExpired() runs on app init.
- **Edge case:** Trash itself hitting quota → permanentDelete oldest items first

#### Task 3B: Create quota_guard.ts
- **File:** `src/lib/storage/quota_guard.ts` — new
- **touches:** [src/lib/storage/quota_guard.ts]
- **provides:** [checkQuota, canSafelyWrite]
- **requires:** []
- **Logic:** Estimate total localStorage usage by iterating keys. Estimate 5MB total (conservative). Provide status levels: ok (<80%), warning (80-95%), critical (>95%).

### Wave 2 (integration)

#### Task 3C: Replace window.confirm with trash flow
- **File:** `src/components/pages/DashboardPage.tsx`, `src/components/creation/ChapterSidebarPanel.tsx`
- **touches:** [DashboardPage.tsx, ChapterSidebarPanel.tsx]
- **provides:** [soft delete UI for projects and chapters]
- **requires:** [trash_manager from Wave 1]
- **depends_on:** [task-3a]
- **Logic:** Replace `window.confirm` → rich modal with 3 options: Cancel, Move to Trash, Delete Forever. Default = Move to Trash.

#### Task 3D: Add quota guard to debounced storage
- **File:** `src/lib/storage/debounced_local_storage.ts`
- **touches:** [src/lib/storage/debounced_local_storage.ts]
- **provides:** [quota-aware storage writes]
- **requires:** [quota_guard from Wave 1]
- **depends_on:** [task-3b]
- **Logic:** Wrap `localStorage.setItem` in `canSafelyWrite` check. On failure → `console.error` + emit event for UI notification. Catch `QuotaExceededError` explicitly.

### Wave 3 (UI + tests)

#### Task 3E: Trash tab on Dashboard + Quota banner
- **File:** `src/components/pages/DashboardPage.tsx`
- **touches:** [DashboardPage.tsx]
- **provides:** [trash list UI, quota warning banner]
- **requires:** [Task 3A, 3B]
- **depends_on:** [task-3a, task-3b]
- **Logic:** Add "Thùng rác" tab on Dashboard. Show list of trashed items with restore/delete buttons. Show quota warning banner when level = 'warning' or 'critical'.

#### Task 3F: Tests
- **File:** `src/lib/storage/trash_manager.test.ts`, `src/lib/storage/quota_guard.test.ts`
- **touches:** [trash_manager.test.ts, quota_guard.test.ts]
- **provides:** [regression tests]
- **requires:** [Task 3A, 3B]
- **depends_on:** [task-3a, task-3b]

## Failure Scenarios

| When | Then | Error Handling |
|------|------|----------------|
| Trash itself full (too many items) | Auto-purge oldest expired items | cleanExpired() before moveToTrash() |
| localStorage completely full | Show modal: "Xuất dữ liệu trước khi tiếp tục" | Block new writes, offer export |
| Restore from trash but project ID conflicts | Generate new ID, append "(Restored)" to title | ID collision check |

## Rejection Criteria

- ❌ DO NOT use IndexedDB for trash — keep in localStorage for simplicity
- ❌ DO NOT permanently delete without explicit second confirmation
- ❌ DO NOT hide quota warnings — must be visible on main dashboard
- ❌ DO NOT change Zustand persist middleware signature

## Cross-Phase Context

- **Assumes from Phase 2:** Undo/redo available for in-session recovery; trash handles cross-session
- **Exports for Phase 4:** Quota guard status feeds into offline indicator (storage + network combined)

## Acceptance Criteria

- [ ] Deleting a project moves it to trash (not permanent delete)
- [ ] Trashed project restorable within 30 days
- [ ] Quota warning shown when localStorage > 80%
- [ ] `QuotaExceededError` caught and displayed as user-friendly message
- [ ] All tests pass: `npm test -- --run trash_manager quota_guard`
