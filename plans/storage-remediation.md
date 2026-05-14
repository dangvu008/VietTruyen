# VietTruyen — Storage Remediation Plan

> Date: 2026-05-13
> Scope: Persistence layer (localStorage / IndexedDB / Supabase), sync pipeline, hydration flow
> Risk Level: High (data-loss bugs in production)
> Strategy: Stop the bleeding first, then unify canonical truth, then optimize

---

## A. Diagnosis Summary

Ứng dụng đang vận hành **5 tầng lưu trữ song song** mà không có *single source of truth*:

| Tầng | Vai trò hiện tại | Vấn đề |
|---|---|---|
| `localStorage` (Zustand `viettruyen-projects`) | Hydration ban đầu, danh sách project | `stripPersistedProject()` xoá sạch content (`src/store/use_project_store.ts:358-361`) |
| `localStorage` (autosave) | Recovery editor | Khoá riêng `viettruyen-autosave-drafts`, không nối vào pipeline chính |
| IndexedDB (Dexie `chapters` table) | Cache chương đầy đủ | `bulkPut()` (`src/db/narrative_db.ts:316,347`) block main thread; không quản lý phiên người dùng |
| Supabase `chapters` / `projects` | Cloud canonical | `syncProjectsFromProvider()` không merge chapters vào state |
| In-memory Zustand state | UI source | Race với 4 tầng trên |

Bốn lớp "guard" đã thêm (`src/lib/storage/online_storage_provider.ts:329-348`, `src/lib/supabase/sync_service.ts:99-167`, `src/store/use_project_store.ts:1536-1559`, `src/store/use_project_store.ts:1890-1899`) chỉ là **mảnh vá chống xoá dữ liệu**, không sửa nguyên nhân gốc: *partialize strip content trước khi hydration hoàn tất* + *không có thứ tự khởi tạo deterministic*.

### Triệu chứng do user báo cáo

1. Chapter có tiêu đề nhưng nội dung trống.
2. Stories biến mất sau rebuild/relogin.
3. Đôi khi load được nội dung chương nhưng mất cấu trúc danh sách chương.
4. UI freeze khi load/save.

### Mapping symptom → root cause

| Triệu chứng | Root cause | File:Line |
|---|---|---|
| Title load, content empty | `stripPersistedProject` xoá content + `syncProjectsFromProvider` không merge chapters | `use_project_store.ts:358-361`, `use_storage_store.ts:200` |
| Stories disappear sau relogin | `void provider.deleteProject(id)` fire-and-forget khi offline | `use_project_store.ts:1255` |
| Mất cấu trúc chapter list | Race giữa Zustand hydrate vs `initStorageProvider` async | `App.tsx:230` |
| UI freeze 30s | Supabase read không có timeout | `use_project_store.ts:820` |
| UI freeze khi persist | `JSON.stringify` huge state main thread | `debounced_local_storage.ts:85` |
| UI freeze khi save 1000+ chapters | `Dexie.bulkPut` lock main thread | `narrative_db.ts:316` |

---

## B. Architectural Decisions (PHẢI chốt trước khi code)

Năm câu hỏi sau quyết định toàn bộ kiến trúc sau remediation:

### Decision 1: Canonical truth cho chapter content?

- **Phương án A (khuyến nghị):** IndexedDB là canonical local, Supabase là canonical cloud, localStorage CHỈ giữ metadata (title, ids, storageMode). Loại bỏ hoàn toàn `chapters[]` khỏi localStorage payload.
- **Phương án B:** Supabase canonical, IndexedDB là read-through cache với TTL.

> Recommendation: **A** — vì loại bỏ được toàn bộ guard logic hiện tại và đơn giản hoá hydration.

### Decision 2: Cloud-first hay Local-first khi login?

- **Cloud-first:** login → tải Supabase → ghi đè IndexedDB → ghi đè state. Nhược điểm: mất chỉnh sửa offline chưa upload.
- **Local-first với outbox queue (khuyến nghị):** thay đổi offline được giữ trong outbox table và đẩy lên cloud sau login.

> Recommendation: **Local-first + outbox** — user thường viết offline hàng giờ.

### Decision 3: Conflict resolution cấp project hay cấp chapter?

- Hiện tại `mergeProviderProjects` (`use_project_store.ts:363-415`) resolve cấp project.
- Đề xuất chuyển sang resolve **cấp chapter** vì user edit từng chương.

> Recommendation: **Cấp chapter** với last-write-wins theo `updatedAt`.

### Decision 4: Delete có tombstone không?

- Hiện tại `deleteProject` chỉ xoá local + fire-and-forget cloud. Device A xoá offline, device B sync sẽ kéo project về.
- Cần bảng `project_tombstones` (project_id, deleted_at, user_id) trên Supabase.

> Recommendation: **CÓ tombstone** để đảm bảo multi-device.

### Decision 5: Migration cho user hiện hữu — blocking modal hay background?

- Blocking modal: an toàn nhưng UX kém.
- Background: rủi ro nếu reload giữa chừng.
- **Resumable migration với checkpoint:** mở rộng `migrationCompleted` ở `use_storage_store.ts:62` thành `migrationCheckpoint: { lastProjectId, lastChapterId }`.

> Recommendation: **Resumable + blocking modal nhẹ 5–30s**.

---

## C. Phase 1 — STOP THE BLEEDING (P0, 3 ngày)

Mục tiêu: ngừng mất dữ liệu, ngừng đơ UI. Không refactor lớn.

### Step 1.1 — Await provider init trong App boot [P0, Small]

- **Files:** `src/App.tsx:211-233`, `src/store/use_storage_store.ts:114-179`
- **What:** Thêm state `storageReady: boolean` vào `use_storage_store.ts`. Trong `App.tsx`, chặn render `pageContent` (line 391) cho tới khi `storageReady === true` HOẶC `initError` được set.
- **Cụ thể:**
  - Trong `initProvider` (`use_storage_store.ts:114`), set `storageReady=true` ngay sau `await provider.init()` (line 179) trước khi gọi `syncProjectsFromProvider`.
  - Trong `App.tsx`, sau check `authLoading`, thêm: `if (isAuthenticated && !storageReady && !initError) return <StorageLoadingScreen/>;`
- **Why:** Sửa symptom #1 và #3. Loại bỏ race condition `RC-2 retry` ở `use_project_store.ts:957-1010`.
- **Risk:** Tăng boot perceived 200–500ms. Mitigate bằng skeleton.
- **Test:**
  - Unit: mock `provider.init()` chậm 2s → state set `storageReady` đúng thứ tự.
  - Manual: login → chapter list không bao giờ rỗng trước khi hiển thị.
- **Dependency:** none.

### Step 1.2 — `deleteProject` phải await provider + tombstone [P0, Medium]

- **Files:** `src/store/use_project_store.ts:1244-1258`, `src/lib/storage/online_storage_provider.ts:212-226`
- **What:** Đổi `deleteProject` từ `(id: string) => void` sang `async (id: string) => Promise<void>`. Trước khi xoá local state, gọi `provider.deleteProject(id)` và ghi tombstone vào table `project_tombstones`.
- **Cụ thể:**
  - DDL Supabase: `CREATE TABLE project_tombstones (id uuid primary key, project_id uuid, user_id uuid, deleted_at timestamptz)`.
  - Trong `OnlineStorageProvider.deleteProject`, thêm bước cuối insert vào `project_tombstones`.
  - Trong `syncProjectsFromProvider` (`use_project_store.ts:1782`), trước `mergeProviderProjects`, fetch tombstones và filter.
  - Offline: ghi vào outbox table Dexie (xem Step 2.5), retry khi online.
- **Why:** Sửa symptom #2.
- **Risk:** Cần migration Supabase schema + RLS policy mới.
- **Test:**
  - E2E: delete offline → reload → relogin → project không revive.
  - Unit: tombstone fetch failure degrade gracefully.
- **Dependency:** Step 1.1.

### Step 1.3 — Timeout cho mọi Supabase read trong hot path [P0, Small]

- **Files:** `src/lib/storage/online_storage_provider.ts:72-109,111-205,230-259`; `src/store/use_project_store.ts:820`
- **What:** Bọc tất cả `await supabase.from(...)` trong `Promise.race([query, timeout(8000)])`. Timeout → trả empty/null, NOT throw.
- **Cụ thể:** Tạo helper `withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T>` trong `online_storage_provider.ts`. Áp dụng cho `listProjects`, `getProject`, `getProjectChapters`.
- **Why:** Sửa symptom #4.
- **Risk:** User mạng chậm thấy "empty" thay vì wait. Hiển thị banner "Đang đồng bộ cloud — hiển thị bản local".
- **Test:** Mock supabase chậm 30s → load < 9s, banner hiện.
- **Dependency:** none.

### Step 1.4 — `JSON.stringify` huge state → Web Worker [P0, Medium]

- **Files:** `src/lib/storage/debounced_local_storage.ts:73,85`
- **What:** Tạo worker `src/workers/serialize_worker.ts` chạy `JSON.stringify` ngoài main thread. Trong `flushToLocalStorage`, gửi value vào worker, nhận string về và `localStorage.setItem`.
- **Cụ thể:** `flushToLocalStorageSync` (line 68-77, dùng cho `beforeunload`) GIỮ NGUYÊN sync (worker không khả dụng khi tab close).
- **Why:** `JSON.stringify` 1000 chapters block 200–500ms mỗi lần persist.
- **Risk:** Worker không hỗ trợ ở jsdom test. Fallback nếu `Worker` undefined.
- **Test:** Stringify 1000 chapters → main thread không jank > 16ms.
- **Dependency:** none.

### Step 1.5 — Dexie `bulkPut` chunked [P0, Small]

- **Files:** `src/db/narrative_db.ts:314-317,343-350`
- **What:** Chia chapter array thành chunks 50–100 và `await` giữa các chunk.
- **Cụ thể:**
  ```ts
  for (let i = 0; i < chapters.length; i += 80) {
    await narrativeDb.chapters.bulkPut(chapters.slice(i, i + 80));
    await new Promise(r => setTimeout(r, 0));
  }
  ```
- **Why:** Freeze khi migrate hoặc replace 1000+ chapters.
- **Risk:** Replace không còn atomic. Mitigate: transaction wrapper với rollback flag.
- **Test:** Benchmark 1000 chapters: trước 800ms block, sau mỗi chunk < 50ms.
- **Dependency:** none.

---

## D. Phase 2 — FIX SYNC (P1, 7 ngày)

Mục tiêu: thiết lập canonical truth, sửa merge logic, xoá guard mảnh vá.

### Step 2.2 — Migration v1 → v2 (chạy TRƯỚC 2.1) [P1, Medium]

- **Files:** `src/store/use_project_store.ts:2315-2434` (onRehydrateStorage), `src/lib/storage/migrate_indexeddb_to_provider.ts`
- **What:** Trong `onRehydrateStorage`, nếu phát hiện schema cũ (project.chapters có content) → migrate sang Dexie TRƯỚC khi rehydrate strip. Đánh dấu `storageSchemaVersion: 2`.
- **Cụ thể:**
  - Thêm field `storageSchemaVersion: 2` vào persisted state.
  - Trong `onRehydrateStorage`, nếu `state.storageSchemaVersion < 2`:
    - Với mỗi project, gọi `storeChapters(project.chapters.map(toStoredChapter))` chunked theo Step 1.5.
    - Set `storageSchemaVersion = 2`.
    - Flush sync localStorage để chống mất nếu reload.
- **Why:** Bảo vệ user hiện hữu khỏi mất content khi rollout 2.1.
- **Risk:** Migration đồng bộ khi rehydrate chậm 500ms với 1000 chapters. Mitigate bằng chunk + progress modal.
- **Test:**
  - Idempotent: chạy 2 lần không duplicate.
  - Count Dexie === count localStorage trước/sau migration.
- **Dependency:** Step 1.5.

### Step 2.1 — Xoá `chapters[]` khỏi localStorage payload [P1, Large]

- **Files:** `src/store/use_project_store.ts:347-361,2286-2314`
- **What:** Thay vì strip content thành `''`, loại bỏ hoàn toàn `chapters` array khỏi payload localStorage. Chapter chỉ tồn tại trong IndexedDB và Supabase.
- **Cụ thể:**
  ```ts
  const stripPersistedProject = (project: Project): Project => {
    return {
      ...project,
      chapters: [],
      chapterIds: project.chapters.map(c => ({
        id: c.id,
        sequenceNumber: c.sequenceNumber,
        title: c.title,
      })),
    };
  };
  ```
  Field metadata `chapterIds` đủ cho UI render danh sách trước hydration.
- **Why:** Sửa gốc rễ. Khi không còn stripped chapters trong state, các check ở `online_storage_provider.ts:329-348`, `sync_service.ts:111-167` trở nên thừa.
- **Risk:** Migration mạnh: user hiện hữu sẽ "mất" chapters cho tới khi IndexedDB hydrate. Cần Step 2.2 chạy TRƯỚC.
- **Test:**
  - Unit: persist 100 chapters → re-hydrate → `state.projects[0].chapters.length === 0` nhưng `chapterIds.length === 100`.
  - E2E: reload → list chương hiển thị trong 100ms.
- **Dependency:** Step 1.1 + Step 2.2.
- **Feature flag:** `LOCALSTORAGE_INCLUDE_CHAPTERS=true` trong 2 tuần đầu để kill switch.

### Step 2.3 — `syncProjectsFromProvider` MUST merge chapters [P1, Medium]

- **Files:** `src/store/use_project_store.ts:1782-1871`, `src/lib/storage/online_storage_provider.ts:111-205`
- **What:** Sau `provider.getProject(summary.id)`, gọi thêm `provider.getProjectChapters(summary.id)` và gắn vào `providerProject.chapters` TRƯỚC khi `mergeProviderProjects`. Hiện `getProject` trả `chapters: []` (line 193).
- **Cụ thể:**
  ```ts
  const providerProjects = await Promise.all(
    summaries.map(async (s) => {
      const [p, ch] = await Promise.all([
        provider.getProject(s.id),
        provider.getProjectChapters(s.id),
      ]);
      return p ? { ...p, chapters: ch } : null;
    })
  );
  ```
- **Why:** Sửa symptom #1. Hiện `providerHasContent = false` vì provider trả empty.
- **Risk:** N+1 query. Cần `getAllProjectsWithChapters` ở provider (1 join query) HOẶC giới hạn concurrency 4.
- **Test:**
  - Mock 10 projects × 50 chapters → merged content khớp provider.
  - Provider trả 5/10 projects có chapters → 5 còn lại không bị xoá.
- **Dependency:** Step 1.3.

### Step 2.4 — Last-write-wins cấp chapter [P1, Medium]

- **Files:** `src/store/use_project_store.ts:363-415`
- **What:** Viết lại `mergeProviderProjects`: với mỗi project trùng id, merge chapters theo `chapter.id` so sánh `chapter.updatedAt`. Xoá heuristic `localHasContent / providerHasContent` (line 377-398).
- **Cụ thể:** Tạo helper `mergeChapterByUpdatedAt(localChapters: Chapter[], providerChapters: Chapter[]): Chapter[]`.
- **Why:** Heuristic hiện tại sai khi cả 2 bên đều có content khác nhau.
- **Risk:** Phải đảm bảo `chapter.updatedAt` cập nhật mọi lúc khi user edit (kiểm tra mọi mutation path).
- **Test:**
  - Local mới hơn → giữ local.
  - Provider mới hơn → ghi local.
  - Cùng `updatedAt` → giữ local (user agency).
- **Dependency:** Step 2.3.

### Step 2.5 — Outbox queue cho offline mutations [P1, Large]

- **Files:** `src/db/narrative_db.ts` (thêm table `outbox`), `src/store/use_project_store.ts` (nhiều caller)
- **What:** Mọi mutation hiện gọi `syncProjectMetadataToProvider`/`syncProviderProjectChapters`/`syncProviderDeleteChapter` (line 1273, 1397, 1492, ...) sẽ:
  1. Ghi vào local outbox table trước.
  2. Online → flush outbox lên Supabase.
  3. Offline/provider null → giữ outbox, retry khi `initProvider` thành công.
- **Cụ thể:**
  - Schema: `{ id, opType: 'project_save'|'chapter_save'|'chapter_delete'|'project_delete', payload, createdAt, retries }`.
  - `flushOutbox()` chạy sau `provider.init()` thành công (`use_storage_store.ts:179`).
- **Why:** Sửa symptom #2 cho offline mutations.
- **Risk:** Outbox tăng Dexie size. Cleanup khi flush thành công, retry limit 5 lần.
- **Test:**
  - Offline → create + edit + delete → online → Supabase state đúng.
  - Idempotent: retry không tạo duplicate.
- **Dependency:** Step 1.2.

### Step 2.6 — Xoá guards mảnh vá [P1, Small]

- **Files:**
  - `src/lib/storage/online_storage_provider.ts:326-348` (FIX P0-5 guard)
  - `src/lib/supabase/sync_service.ts:99-167` (split fullChapters/strippedChapters)
  - `src/store/use_project_store.ts:1536-1559` (replaceProjectChapters re-merge guard)
  - `src/store/use_project_store.ts:1890-1899,1974-1995` (P0-3, P0-4 guards)
- **What:** Sau khi 2.1 đảm bảo không còn stripped chapters trong state, xoá toàn bộ guard. Giữ chỉ assertion log nếu bug ngoài dự kiến.
- **Why:** Giảm complexity. Mỗi guard là point of failure tiềm tàng.
- **Risk:** Nếu 2.1 thiếu sót, xoá guard mở lại lỗ. Làm sau cùng.
- **Test:** Toàn bộ test suite pass.
- **Dependency:** Step 2.1 + 2.3 + 2.4 soak test 1 tuần.

---

## E. Phase 3 — PERFORMANCE & UX (P2/P3, 10 ngày)

### Step 3.1 — Progressive hydration [P2, Large]

- **Files:** `src/store/use_project_store.ts:778-1080,1617-1780`
- **What:** Thay vì await toàn bộ chapters trước khi set state, stream từng chapter vào state. Dùng cursor Dexie `.each()` thay vì `.sortBy('sequenceNumber')`.
- **Why:** Project 1000 chapters hydrate 2–5s. Stream → first chapter render trong 100ms.
- **Risk:** Component subscribed selector phải tolerant với chapters lớn dần.
- **Test:** TTI cho 500 chapters < 500ms.
- **Dependency:** Step 2.1.

### Step 3.2 — Debounce `syncProjectMetadataToProvider` [P2, Medium]

- **Files:** `src/store/use_project_store.ts:1090-1156` + 15 caller sites
- **What:** Mỗi mutation gọi sync ngay → user gõ 10 phím = 10 Supabase call. Bọc debounce 1s + coalesce theo projectId.
- **Risk:** Mất dữ liệu nếu reload trong window. Mitigate: `flushAllPendingProviderSyncs()` trong `beforeunload`.
- **Test:** 10 mutation trong 500ms → 1 Supabase call.
- **Dependency:** none.

### Step 3.3 — Autosave drafts → Dexie [P2, Medium]

- **Files:** `src/lib/storage/autosave_draft_store.ts` toàn bộ
- **What:** Chuyển từ `viettruyen-autosave-drafts` localStorage sang Dexie table `chapter_drafts` (TTL 7 ngày).
- **Why:** Một nguồn truth, dễ recover.
- **Risk:** Migration drafts hiện tại. Giữ legacy reader fallback 30 ngày.
- **Dependency:** none.

### Step 3.4 — Telemetry storage health dashboard [P3, Medium]

- **Files:** `src/lib/debug/story_debug_trace.ts` + aggregator mới
- **What:** Aggregate `chapters.persist.complete`, `project.hydrate.*`, `provider.init.*` thành health dashboard ở Settings → Storage. Hiển thị: hydration fail count, latency p95, outbox backlog.
- **Dependency:** Phase 2 xong.

---

## F. Migration Strategy cho User Hiện Hữu

1. **Phát hiện schema cũ:** kiểm `storageSchemaVersion` trong persisted state. Thiếu hoặc < 2 → user cũ.
2. **Banner blocking nhẹ:** modal "Đang nâng cấp kho lưu trữ — đừng tắt trình duyệt" 5–30s.
3. **Migration tuần tự** (Step 2.2):
   - Đếm `localStorage chapters` còn content.
   - Mỗi project: `storeChapters(toStoredChapter(c))` chunked.
   - Verify count Dexie === localStorage trước khi flag.
   - Set `storageSchemaVersion = 2`, flush sync.
4. **Rollback flag:** giữ `localStorage:viettruyen-projects-backup-v1` (copy nguyên trạng) trong 30 ngày.
5. **Telemetry:** log từng migration step để hỗ trợ debug user.

---

## G. Rollback Strategy

Mỗi step có exit criteria và rollback plan:

| Step | Rollback action |
|---|---|
| 1.1 (await provider) | Revert `App.tsx` block render; polling trong `onRehydrateStorage` vẫn hoạt động. |
| 1.2 (deleteProject + tombstone) | Vô hiệu fetch tombstone trong `syncProjectsFromProvider`. Project bị tombstone trên cloud sẽ revive — chấp nhận như cũ. |
| 1.4 (worker stringify) | Disable worker, dùng main thread `JSON.stringify`. |
| 2.1 (xoá chapters khỏi localStorage) | **Không thể rollback nếu đã release rộng** — user mới sau release không có chapters trong localStorage. Mitigate: feature flag `LOCALSTORAGE_INCLUDE_CHAPTERS=true` trong 2 tuần đầu. |
| 2.2 (migration) | Restore từ `viettruyen-projects-backup-v1`. |
| 2.5 (outbox) | Disable outbox flush; mutation fire-and-forget như cũ (mất offline updates nhưng không corrupt). |
| 2.6 (xoá guards) | Revert PR — guards là phụ vệ. |

**Nguyên tắc:** Mỗi PR = 1 step. Feature flag cho step rủi ro cao (2.1, 2.5). Soak test 48h trước khi enable 100% user.

---

## H. Pitfalls — Những điều KHÔNG được làm

1. **Đừng strip content trong `partialize` rồi sync ngược lên Supabase.** Đây là nguồn của 4 lớp guard. Logic "nếu tất cả chapters empty thì block upload" (`sync_service.ts:99-167`) phải biến mất khi Phase 2 xong, KHÔNG giữ "for safety".
2. **Đừng gọi `loadProjectWithFullChapters` trong path mutation** (line 1888 trong `syncProjectToCloud`, line 1972 trong `autoSync`). Function tốn 100–800ms vì 3 lớp fallback. Mutation path phải lấy in-memory state trực tiếp.
3. **Đừng dùng `void provider.X()` cho destructive ops.** Ngoài `deleteProject` còn `syncProviderDeleteChapter` (line 1492), cleanup orphans (line 379 provider) đều fire-and-forget.
4. **Đừng tin `chapter.content === ''` nghĩa là "user xoá".** Hiện tại nó nghĩa là "chưa hydrate". Sau Step 2.1, empty content thực sự là intent của user.
5. **Đừng trộn `storageMode: 'indexeddb' | 'local' | 'provider' | 'cloud' | 'inline'`.** Hiện có 5 giá trị, `canonicalProjectStorageMode` (line 91) quy về 3. Đề xuất union chỉ còn `'local' | 'cloud' | 'inline'`.
6. **Đừng concurrent gọi `provider.init()`.** `App.tsx:230` chạy effect mỗi lần authState đổi, có thể trigger 2 lần khi `getCurrentSession` + `onAuthStateChange` cùng phát. Đã có guard line 122-140 nhưng cancel previous effect cleanup.
7. **Đừng để `migrateProjectsToDexie` (line 2107) chạy trên main thread.** Gọi `Promise.all(projects.map(loadProjectWithFullChapters))` có thể vỡ với 50+ projects. Chunk concurrency 3.
8. **Đừng để `onRehydrateStorage` poll provider 5s** (line 2371-2377). Sau Step 1.1, provider sẵn sàng trước khi rehydrate → xoá poll.

---

## I. Timeline & Effort Summary

```
Phase 1 (3 ngày) — P0:
  1.1 Await provider → block UI              [Small,  no dep]
  1.2 deleteProject + tombstone              [Medium, dep 1.1]
  1.3 Timeout Supabase reads                 [Small,  no dep]
  1.4 Worker JSON.stringify                  [Medium, no dep]
  1.5 Chunked Dexie bulkPut                  [Small,  no dep]

Phase 2 (7 ngày) — P1:
  2.2 Migration v1 → v2                      [Medium, dep 1.5]
  2.1 Xoá chapters[] khỏi localStorage       [Large,  dep 2.2 + 1.1]
  2.3 syncProjectsFromProvider merge chapters [Medium, dep 1.3]
  2.4 Merge cấp chapter                      [Medium, dep 2.3]
  2.5 Outbox queue                           [Large,  dep 1.2]
  2.6 Xoá guards mảnh vá                     [Small,  dep 2.1+2.3+2.4]

Phase 3 (10 ngày) — P2/P3:
  3.1 Progressive hydration                  [Large,  dep 2.1]
  3.2 Debounce metadata sync                 [Medium, no dep]
  3.3 Autosave drafts → Dexie                [Medium, no dep]
  3.4 Telemetry dashboard                    [Medium, dep Phase 2]
```

**Total:** ~20–25 working days cho 1 senior dev với test coverage đầy đủ.

---

## J. Critical Files Reference

- `src/store/use_project_store.ts` — biggest blast radius, đọc kỹ trước mỗi step
- `src/store/use_storage_store.ts` — provider lifecycle
- `src/lib/storage/online_storage_provider.ts` — Supabase wrapper
- `src/lib/supabase/sync_service.ts` — sync logic cũ
- `src/lib/storage/debounced_local_storage.ts` — localStorage perf
- `src/db/narrative_db.ts` — Dexie schema
- `src/App.tsx` — boot sequence

---

## K. Open Questions (cần user trả lời trước khi start)

- [ ] **D1:** Canonical truth = IndexedDB local + Supabase cloud, localStorage chỉ metadata? (recommended)
- [ ] **D2:** Local-first + outbox queue, không phải cloud-first? (recommended)
- [ ] **D3:** Conflict resolution cấp chapter (last-write-wins theo `updatedAt`)? (recommended)
- [ ] **D4:** Có dùng `project_tombstones` table cho delete multi-device? (recommended)
- [ ] **D5:** Migration v1→v2 dùng resumable + blocking modal nhẹ 5–30s? (recommended)
