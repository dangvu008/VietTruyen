# Spec: Chapter Completion Actions

## Objective
Cho phép tác giả hoàn thiện nhanh các chương đang ở trạng thái `Tạo dở` hoặc lỗi tạo nội dung ngay từ danh sách chương, thay vì phải mở chương rồi mới thao tác trong editor pane.

## Commands
- Dev: `npm run dev:ui`
- Test: `npm run test:run`
- Type check + build: `npm run build`

## Project Structure
- `src/components/story-editor/StoryWorkspace.tsx` → orchestration cho workflow viết tiếp / dựng lại chương
- `src/components/story-editor/EditorTopbar.tsx` → dropdown danh sách chương ở topbar
- `src/components/story-editor/AIAssistantPanel.tsx` → mục lục chương ở panel phải
- `src/components/story-editor/editor_types.ts` → logic suy diễn trạng thái và action UI
- `src/components/story-editor/editor_types.test.ts` → test cho logic trạng thái/action

## Code Style
Ưu tiên thêm helper nhỏ, đặt tên theo ý định, không nhân đôi điều kiện trạng thái ở nhiều component UI.

## Testing Strategy
- Unit test cho helper quyết định chapter nào có action `Hoàn thiện`
- Chạy `npm run test:run`
- Chạy `npm run build` để bắt lỗi TypeScript và render integration

## Boundaries
- Always: giữ nguyên semantics hiện tại của `AI tạo lại từ đầu` và `AI tiếp tục chương dở`
- Ask first: đổi wording trạng thái nghiệp vụ ngoài phạm vi feature này
- Never: tự ý thay đổi pipeline AI hoặc schema lưu chapter

## Success Criteria
- Chapter list hiển thị nút/action `Hoàn thiện` cho chương `Tạo dở` hoặc lỗi tạo nội dung
- Bấm action sẽ mở đúng chapter và chạy luồng phù hợp:
  - có nội dung dở → viết tiếp
  - không có nội dung usable → dựng lại từ đầu
- Các nút hiện có trong editor pane vẫn hoạt động như cũ
- Test và build pass

## Open Questions
- Chưa thêm bulk action cho nhiều chương lỗi cùng lúc; phạm vi hiện tại là thao tác từng chương.
