# Phase 7: Community Safety

> **Priority:** P3 | **Est:** ~200 LOC | **Session:** Single
> **Goal:** Add basic safety rails for community features

## Data Flow

```
[Rate Limiting]
  User submits comment → check in-memory rate limiter (max 5 comments/minute)
  Exceeded → show message: "Vui lòng chờ trước khi bình luận tiếp."

[Block/Mute]
  User clicks "Chặn" on a commenter → save to localStorage blocklist
  Blocked user's comments → hidden in feed (client-side filter)

[Content Guard]
  Comment submitted → basic profanity check (Vietnamese word list)
  Detected → soft-block: "Bình luận chứa nội dung không phù hợp. Vui lòng chỉnh sửa."
```

## Code Contracts

```typescript
// src/lib/community/rate_limiter.ts — NEW
interface RateLimiter {
  canAct(userId: string, action: string): boolean;
  record(userId: string, action: string): void;
  getRemainingCooldown(userId: string, action: string): number;  // ms
}

function createRateLimiter(maxActions: number, windowMs: number): RateLimiter;

// src/lib/community/block_list.ts — NEW
function blockUser(userId: string): void;
function unblockUser(userId: string): void;
function isBlocked(userId: string): boolean;
function getBlockList(): string[];

// src/lib/community/content_guard.ts — NEW
function checkContent(text: string): { clean: boolean; reason?: string };
```

## Tasks

### Wave 1

#### Task 7A: Create rate_limiter.ts
- **File:** `src/lib/community/rate_limiter.ts` — new
- **touches:** [src/lib/community/rate_limiter.ts]
- **provides:** [createRateLimiter]
- **requires:** []
- **Logic:** Sliding window rate limiter. In-memory (resets on page reload = acceptable). Default: 5 comments/min, 2 likes/sec.

#### Task 7B: Create block_list.ts
- **File:** `src/lib/community/block_list.ts` — new
- **touches:** [src/lib/community/block_list.ts]
- **provides:** [blockUser, unblockUser, isBlocked]
- **requires:** []
- **Logic:** Persist blocklist in localStorage (`vt-blocklist`). Simple string array of user IDs.

#### Task 7C: Create content_guard.ts
- **File:** `src/lib/community/content_guard.ts` — new
- **touches:** [src/lib/community/content_guard.ts]
- **provides:** [checkContent]
- **requires:** []
- **Logic:** Basic Vietnamese profanity word list (20-30 common terms). Normalize diacritics before matching. Return clean/dirty + reason.

### Wave 2

#### Task 7D: Integrate into CommunityPage
- **File:** `src/components/pages/CommunityPage.tsx`
- **touches:** [CommunityPage.tsx]
- **provides:** [rate limiting, block UI, content filtering in community]
- **requires:** [Task 7A, 7B, 7C]
- **depends_on:** [task-7a, task-7b, task-7c]
- **Logic:** Before postComment → check rate limiter + content guard. Filter displayed comments by blocklist. Add "Chặn" button next to comment author name (for non-own comments).

### Wave 3

#### Task 7E: Tests
- **File:** `src/lib/community/rate_limiter.test.ts`, `src/lib/community/block_list.test.ts`
- **touches:** [rate_limiter.test.ts, block_list.test.ts, content_guard.test.ts]
- **provides:** [regression tests]
- **requires:** [Task 7A, 7B, 7C]
- **depends_on:** [task-7a, task-7b, task-7c]

## Failure Scenarios

| When | Then | Error Handling |
|------|------|----------------|
| Rate limit exceeded | Show cooldown timer, disable submit button | Countdown display |
| Blocklist corrupted | Reset to empty array, log warning | Try/catch on parse |
| Content guard false positive | User can still submit after editing | Soft block, not hard block |
| Workshop contribution blocked by content guard | Same treatment as comments | Consistent UX |

## Rejection Criteria

- ❌ DO NOT implement server-side rate limiting — client-side only for MVP
- ❌ DO NOT create comprehensive profanity AI — basic word list is sufficient
- ❌ DO NOT prevent reading blocked user's stories — only hide comments
- ❌ DO NOT modify Supabase schema for blocklist — client-side localStorage only

## Cross-Phase Context

- **Assumes from Phase 6:** i18n patterns established for community strings
- **Assumes from Phase 4:** Network status available for community operations
- **Exports:** Final phase — no exports needed

## Acceptance Criteria

- [ ] 6th comment within 1 minute → blocked with cooldown message
- [ ] Blocked user's comments hidden from feed
- [ ] Profane comment → soft-blocked with edit suggestion
- [ ] "Chặn" button visible on other users' comments
- [ ] All tests pass: `npm test -- --run rate_limiter block_list content_guard`
