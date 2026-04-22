## Thêm action insertChapter vào Project Store (Store Layer)

### 1. Data Flow
```text
[ChapterSidebar] --(onInsertChapter)--> [StoryWorkspace] --(insertChapter)--> [use_project_store]
                                             \--> prefillPrompt -> [AIAssistantPanel]
```

### 2. Code Contracts
```typescript
interface ProjectState {
  // Thêm mới
  insertChapter: (id: string, chapter: Chapter, insertAtSequence: number) => void;
}
```

### 3. Tasks
#### Task 1a: Cập nhật interface `ProjectState` trong `use_project_store.ts`
- **File**: `src/store/use_project_store.ts` — modify
- Thêm `insertChapter: (id: string, chapter: Chapter, insertAtSequence: number) => void;`

#### Task 1b: Triển khai hàm `insertChapter` trong Store
- **File**: `src/store/use_project_store.ts` — modify
- Hàm cần chèn `chapter` vào luồng `allChapters`, xử lý vòng qua từng chapter để `Math.max` hoặc tịnh tiến `sequenceNumber`. Cụ thể: vòng đời duyệt qua `project.chapters`, với mọi chapter cũ có `sequenceNumber >= insertAtSequence`, cập nhật `sequenceNumber += 1`. Sau đó `unshift` hoặc phân bổ chapter mới vào rồi dùng provider (Indexeddb / Server) để cập nhật.

### 4. Failure Scenarios
| Error Cond | Detect By | Handling / User visible outcome |
|---|---|---|
| Invalid Sequence | `insertAtSequence <= 0` | Fallback insertAtSequence = 1. |
| DB Write Fails | `provider.replaceProjectChapters` throws | Catch và hiển thị lỗi, console warn. |

### 5. Rejection Criteria
- **DO NOT** dùng `Array.prototype.splice` thẳng mà bỏ quên việc cập nhật `sequenceNumber` nội tại của từng cấu trúc Chapter, vì DB lưu trữ cần số thự tự rõ ràng.
- **DO NOT** bỏ quên việc cập nhật vào cơ sở dữ liệu `useStorageStore`.

### 6. Cross-Phase Context
- **Assumes**: Hàm chèn hoạt động đúng thứ tự khi Phase 2 được chạy.
- **Exports**: `insertChapter` API để UI gọi được.

### 7. Acceptance Criteria
- Sau khi gọi hàm `insertChapter` vào project, một program test hoặc dev tools xác nhận rằng các chapter sau đó có thứ tự bị đẩy, chapter chèn được gắn đúng `sequenceNumber = insertAtSequence`.

### 8. Test Tasks
- (Trong tương lai nếu có unit tests): Test luồng store của insertChapter.

### Outcome
**What Was Planned**: Thay đổi cốt lõi trong Store để quản lý và đẩy sequenceNumber.
**Next Action**: Implement Phase 1: `use_project_store.ts`.
**How to Measure**: Kiểm tra dữ liệu được chèn trong Redux-DevTools / Zustand-Logger.
