# Spec: Imported Editor Recovery

## Objective
Khi người dùng mở project phóng tác/upload trong `editor` mà chapter content không load được, hệ thống phải cho phép:
- thử `load lại` từ storage hiện có;
- nếu vẫn thất bại, `khôi phục lại toàn bộ chapters` từ snapshot nguồn import gần nhất;
- khi khôi phục thành công, chapters lỗi cũ phải bị ghi đè/xóa khỏi project hiện tại.

Success cho người dùng:
- Không bị kẹt ở editor rỗng mà không có hướng xử lý.
- Không cần upload lại ngay nếu snapshot nguồn import vẫn còn trong máy.

## Assumptions
1. Đây là lỗi phục hồi nội dung trên cùng một máy/browser, nên có thể dùng IndexedDB local làm source snapshot.
2. Không thêm migration Supabase trong lát cắt này.
3. `sourceImportJobs` trong Dexie có thể giữ thêm field không-index để cache raw source text.

## Commands
Build: `npm run build`
Test all: `npm run test:run`
Target test: `npm run test:run -- imported_project_recovery`

## Project Structure
`src/components/story-editor` → UI editor và empty-state recovery.
`src/lib/adaptation` → logic lưu snapshot import và phục hồi chapters.
`src/db/narrative_db.ts` → persistence Dexie cho source import snapshot.
`src/components/pages/AdaptationPage.tsx` → điểm import/upload chính để lưu snapshot.

## Code Style
Ưu tiên helper thuần, testable bằng dependency injection thay vì nhét logic phục hồi trực tiếp vào component.

```ts
const result = await restoreImportedProjectFromSnapshot(projectId, {
  getLatestSourceImportJob,
  replaceProjectChapters,
});
```

## Testing Strategy
- Unit test cho helper lưu snapshot import.
- Unit test cho helper phục hồi chapters từ snapshot.
- Không thêm browser E2E ở lát cắt này; dùng test logic + build/typecheck làm proof chính.

## Boundaries
- Always: giữ fallback hiện có `hydrateProjectChapters`, chỉ thêm nhánh recovery khi hydrate thất bại.
- Ask first: migration schema Supabase, thay đổi semantics `uploadProject`.
- Never: sync chapter rỗng lên provider để “dọn” dữ liệu cũ.

## Success Criteria
- Imported project có nút `Tải lại nội dung` như hiện tại.
- Nếu retry hydration vẫn rỗng nhưng Dexie có snapshot nguồn import, người dùng có thể khôi phục toàn bộ chapters từ snapshot đó.
- Recovery phải dùng `replaceProjectChapters` để ghi đè danh sách chapters lỗi.
- Nếu không có snapshot nguồn import, UI phải báo rõ là cần import lại thay vì im lặng thất bại.

## Open Questions
- Chưa thêm flow “upload lại file ngay trong editor”; lát cắt này chỉ mở đường recovery từ snapshot local.
