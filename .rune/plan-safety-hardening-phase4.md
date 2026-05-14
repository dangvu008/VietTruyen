# Phase 4: Offline & Network Resilience

> **Priority:** P2 | **Est:** ~200 LOC | **Session:** Single
> **Goal:** Prevent silent failures when user loses network connectivity

## Data Flow

```
navigator.onLine change → useNetworkStatus hook updates
  → Global banner shows/hides
  → AI generation buttons disable with tooltip
  → Publish/Sync buttons disable with tooltip
  → Local-only ops (write, edit, undo) remain functional
```

## Code Contracts

```typescript
// src/hooks/use_network_status.ts — NEW
interface NetworkStatus {
  isOnline: boolean;
  lastOnline: number;         // epoch ms
  downSince: number | null;   // epoch ms when went offline
}

function useNetworkStatus(): NetworkStatus;

// Integration points — guard functions
function requiresNetwork(action: string): boolean;  // check before AI/sync/publish
```

## Tasks

### Wave 1

#### Task 4A: Create useNetworkStatus hook
- **File:** `src/hooks/use_network_status.ts` — new
- **touches:** [src/hooks/use_network_status.ts]
- **provides:** [useNetworkStatus, requiresNetwork]
- **requires:** []
- **Logic:** Listen to `online`/`offline` events. Expose reactive state. Track downtime duration.

### Wave 2

#### Task 4B: Add offline banner to App shell
- **File:** `src/App.tsx`
- **touches:** [src/App.tsx]
- **provides:** [global offline indicator]
- **requires:** [useNetworkStatus]
- **depends_on:** [task-4a]
- **Logic:** When `!isOnline`, show a subtle amber banner below header: "Bạn đang ngoại tuyến — viết bình thường, nhưng AI và đồng bộ tạm ngưng."

#### Task 4C: Guard AI and network-dependent operations
- **File:** `src/components/story-editor/AIAssistantPanel.tsx`, `src/components/pages/CommunityPage.tsx`
- **touches:** [AIAssistantPanel.tsx, CommunityPage.tsx]
- **provides:** [disabled states for network-dependent buttons]
- **requires:** [useNetworkStatus]
- **depends_on:** [task-4a]
- **Logic:** Disable "Viết tiếp", "Plot QA", "Chia sẻ" buttons when offline. Show tooltip: "Cần kết nối mạng."

### Wave 3

#### Task 4D: Tests
- **File:** `src/hooks/use_network_status.test.ts` — new
- **touches:** [src/hooks/use_network_status.test.ts]
- **provides:** [regression tests]
- **requires:** [Task 4A]
- **depends_on:** [task-4a]

## Failure Scenarios

| When | Then | Error Handling |
|------|------|----------------|
| Goes offline mid-AI-stream | Stream buffer (Phase 2) catches partial content | Recovery prompt on reconnect |
| Flaky connection (online→offline→online rapidly) | Debounce status changes (2s) | Prevent UI flicker |
| Offline for hours then reconnect | Trigger sync check on reconnect | Queue pending operations |

## Rejection Criteria

- ❌ DO NOT block local editing when offline — only block network-dependent ops
- ❌ DO NOT use polling to check connectivity — use browser events only
- ❌ DO NOT show intrusive modals — use subtle banner

## Cross-Phase Context

- **Assumes from Phase 2:** AI stream buffer handles crash recovery
- **Assumes from Phase 3:** Quota guard handles storage-side protection
- **Exports for Phase 5:** AI context operations aware of network state

## Acceptance Criteria

- [ ] Offline banner appears within 2s of losing connection
- [ ] AI generation buttons disabled with tooltip when offline
- [ ] Local editing (type, undo/redo, navigate) works normally offline
- [ ] Banner dismisses within 2s of reconnecting
