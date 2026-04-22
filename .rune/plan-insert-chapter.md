# Goal: Insert Chapter & AI Continuity Discussion

Thêm tính năng cho phép người dùng chèn một chương mới vào giữa các chương cũ. Sau khi chèn, hệ thống tự động gọi The Muse để khởi tạo thảo luận lập kế hoạch, ngăn ngừa gián đoạn mạch truyện.

## Phases
| Phase | Title | Tình trạng |
|---|---|---|
| Phase 1 | Cập nhật logic chèn dữ liệu cốt lõi (Store) | ⬚ Pending |
| Phase 2 | Giao diện điều khiển (UI) và Tích hợp The Muse AI | ⬚ Pending |

## Key Decisions
- **Thao tác chèn**: Sẽ có một nút `+` nhỏ xuất hiện khi hover giữa 2 thẻ chương trên sidebar (hoặc tuỳ chọn góc trên thẻ), nhằm giúp người dùng xác định rõ vị trí thay vì ấn đại nút.
- **Auto-shift Index**: Store sẽ xử lý nâng toán học cho SequenceNumber thông qua hàm helper.
- **AI Tự động**: Giao diện tập trung prefill vào ô nhập text chứ không để AI nói chuyện trước để người dùng có thể can thiệp thêm chỉ dẫn nếu cần trước khi Enter.

## Architecture
- `src/store/use_project_store.ts` thêm `insertChapter`.
- `ChapterSidebar.tsx`: Render trigger chèn.
- `AIAssistantPanel.tsx` / `StoryWorkspace.tsx`: Nắm giữ state prefill "Thảo luận chuyển tiếp chương" (Bridging prompt).

## Dependencies / Risks
- Khả năng lệch state (IndexedDB vs in-memory) khi chỉnh sửa `sequenceNumber` thay đổi toàn bộ mảng. Nên tận dụng helper `ensureChapterSequenceNumbers`.
