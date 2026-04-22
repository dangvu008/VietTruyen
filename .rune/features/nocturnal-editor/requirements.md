# Requirements Document: Đập đi xây lại giao diện Nocturnal Editor
Created: 2026-04-19 | BA Session: Phân tích thiết kế Nocturnal Editor từ Mockup

## Context
Người dùng muốn xóa bỏ giao diện Story Editor hiện tại và thay thế bằng một layout hoàn toàn mới làm theo đúng mockup "The Nocturnal Editor". Giao diện mới có phong cách tối (dark theme) tĩnh lặng với tone màu đen/nâu sẫm và điểm nhấn màu vàng hổ phách (amber/gold), sử dụng typography serif sang trọng cho phần viết và font sans-serif cho UI.

## Stakeholders
- Primary user: Nhà văn sáng tác truyện dài, cần một giao diện đẹp, cảm hứng, tập trung cao độ nhưng vẫn tích hợp AI mạnh mẽ.

## User Stories
US-1: Là một người kể chuyện, tôi muốn giao diện viết mang phong cách chuyên nghiệp (Nocturnal) để có cảm hứng sáng tác.
  AC-1.1: GIVEN ở trang viết WHEN nhìn vào màn hình THEN thấy màu nền tối (dark brown/black) và điểm nhấn Amber.
US-2: Là người viết, tôi muốn thấy danh sách chương gọn gàng bên trái kèm số lượng từ.
  AC-2.1: GIVEN ô sidebar trái WHEN hiển thị danh sách chương THEN phải có thanh active màu vàng và số từ bên phải.
US-3: Là người viết, tôi muốn một trình soạn thảo (Editor) nằm giữa với font chữ serif lớn, căn lề rộng rãi.
  AC-3.1: GIVEN editor WHEN xem tiêu đề THEN hiển thị Tựa phần (Phần II) và Tên chương rất lớn (font Serif).
US-4: Là người tương tác với AI, tôi muốn khung The Muse bên phải hiển thị chat history mượt mà với các nút thao tác nhanh.
  AC-4.1: GIVEN khung chat AI WHEN AI trả lời THEN hiển thị chữ đang generate và có nút "Chèn vào bản thảo" màu vàng.

## Scope
### In Scope
- Đập bỏ layout `StoryWorkspace.tsx` và xây dựng lại layout 3 cột + Topbar + Footer theo chuẩn Mockup.
- **Topbar**: Cập nhật Logo (The Nocturnal Editor vàng), Breadcrumb (Drafts > Novel > Chapter), Tokens, Nút Export.
- **Left Sidebar**: Đổi tên thành "Story Navigator", danh sách chương có kèm word count, active state màu amber có viền trái. Nút New Chapter dạng outline.
- **Center Editor**: 
  - Phần title cực lớn bằng font Serif.
  - Floating mode toggle (Viết, Đọc, Review, Diff).
  - Thanh toolbar in-line (B, I, '', AI Rewrite).
  - Footer của khung editor chứa thanh Versions timeline và thông số (Đã lưu, số lượng từ, thời gian đọc).
- **Right Sidebar (The Muse)**: 
  - Giao diện chat đổi thành dạng bubble nổi bật. Bubble user màu xám, Bubble AI màu nâu/đen có nút "Chèn vào bản thảo".
  - Quick actions (Viết tiếp, Review, Plot Q&A).
  - Khung selector "Đoạn hiện tại".
- **Global Footer**: Cập nhật thông số SESSION, WORDS ADDED bên trái, SYNCING bên phải.
- Áp dụng hệ thống biến CSS/Tailwind cho palette "Nocturnal" (Nền siêu tối, chữ off-white/beige, điểm nhấn Amber/Gold).

### Out of Scope
- Chỉnh sửa logic AI back-end (chỉ thay đổi UI front-end hiển thị).
- Thay đổi schema database.

### Assumptions
- Dự án đã cài đặt Tailwind CSS và Lucide React.
- Typography: Sẽ sử dụng font chữ Serif mặc định của hệ thống (như `font-serif` của Tailwind) cho phần nội dung và sans-serif cho UI. Mặc dù có thể cần import Google Font như `Merriweather` hoặc `Playfair Display` để giống ảnh nhất.

## Non-Functional Requirements
| NFR | Requirement | Measurement |
|-----|-------------|-------------|
| Aesthetics | Giao diện phải cực kỳ sang trọng, "Wowed at first glance" ("wow" factor) đúng tiêu chí của hướng dẫn phát triển Frontend. | Review bằng mắt so với mockup. |
| Contrast | Các mảng màu tối phải phân tách rõ ràng mà không bị hòa vào nhau (sử dụng borders mảnh hoặc chênh lệch độ sáng 1-2%). | DevTools |

## Next Step
→ Hand off to the rune-plan skill for implementation planning
