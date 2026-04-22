# Thiết Kế Tổng Thể: VietTruyen (Bản Đặc Tả Tính Năng)

Trạng thái: Canonical (Source of Truth)
Độc giả chính: Founder, PM, Designer, Developer

## 1. VietTruyen là gì?
VietTruyen là một **workspace chuyên dụng dành cho tác giả Việt Nam viết web novel (truyện dài kỳ)** với sự hỗ trợ sâu của AI. 
Sản phẩm **không phải** là một ứng dụng chat AI đơn thuần, mà là một không gian làm việc bản thảo (manuscript workspace) chuyên nghiệp, nơi AI đóng vai trò làm trợ lý định hướng, sửa lỗi và nâng cao chất lượng văn bản.

## 2. Nỗi Đau Của Tác Giả & Cách VietTruyen Giải Quyết (Pain Points & Solutions)

### Nỗi đau 1: Quản lý bối cảnh truyện dài (Canon & Continuity)
- **Vấn đề:** Khi truyện kéo dài hàng trăm chương, tác giả dễ quên chi tiết nhân vật, bối cảnh, quy tắc thế giới, dẫn đến mâu thuẫn cốt truyện (plot hole).
- **Giải pháp:** Hệ thống nền móng truyện (Bible, Nhân vật, Thế giới, Dàn ý) kết hợp cùng **Narrative Memory** (trí nhớ cốt truyện trượt) và **Retcon Analyzer** (phân tích mâu thuẫn), giúp AI luôn nhớ chính xác vũ trụ của dự án.

### Nỗi đau 2: Bí ý tưởng, mất phương hướng
- **Vấn đề:** Không biết viết gì tiếp theo, bí ý tưởng phát triển tình tiết.
- **Giải pháp:** **Surprise Engine** (Động cơ tối ưu bất ngờ) giúp lập kế hoạch các nhánh kịch bản khác nhau, phân tích điểm kịch tính và gợi ý các cú twist hợp lý dựa trên dàn ý.

### Nỗi đau 3: Văn phong bị "đậm mùi AI" hoặc thiếu tự nhiên
- **Vấn đề:** Khi dùng AI để hỗ trợ viết, kết quả thường bị máy móc, dùng nhiều từ ngữ sáo rỗng hoặc từ Hán Việt không cần thiết, tốn thời gian sửa lại đôi khi ngang bằng tự viết.
- **Giải pháp:** 
  - **Self-Reflection Loop** (Vòng lặp tự kiểm duyệt): Bản nháp của AI trước khi đến tay tác giả sẽ tự động trải qua một vòng "tự phê bình" và "viết lại" để đảm bảo chất lượng, hạn chế các cấu trúc câu rườm rà.
  - **8-Mode Polish** (Trau chuốt 8 chế độ): Hệ thống hậu kỳ cho phép chỉnh sửa từng đoạn văn nhanh chóng với các đánh dấu như "Loại bỏ hoàn toàn giọng AI", "Tối ưu đối thoại" hoặc "Tăng cường chi tiết giác quan".

### Nỗi đau 4: Quản lý nhiều phiên bản bản thảo
- **Vấn đề:** Thường copy paste các đoạn văn bản ra nhiều file word khác nhau, rất khó theo dõi tiến độ hoặc lấy lại ý tưởng cũ.
- **Giải pháp:** Hệ thống **Version History** theo cấp độ nhánh (Branching), cho phép quay về phiên bản trước dễ dàng ngay trên hệ thống.

## 3. Kiến Trúc Trải Nghiệm (Information Architecture)

VietTruyen phân tách rõ ràng luồng công việc thành 2 lớp giao diện để tác giả có độ tập trung tối đa, không bị rối.

### Lớp 1: Global Shell (Không Gian Cấp Ứng Dụng)
Dành cho công việc quản lý tổng thể, không phụ thuộc vào dự án nào đang viết.
1. **Dashboard:** Màn hình chào mừng, gợi ý việc tiếp theo nên làm (ví dụ: resume dự án đang viết dở hôm qua).
2. **Kho truyện:** Thư viện quản lý toàn bộ các tác phẩm đã và đang viết.
3. **Phóng tác:** Chức năng mượn nguồn cảm hứng từ tài liệu hoặc truyện có sẵn để tạo dự án mới nhanh.
4. **Cộng đồng:** Xuất bản, đọc, lập workshop lấy phản hồi từ độc giả.
5. **Cài đặt AI:** Quản lý số lượng token, cấu hình Model (chọn GPT-4, Deepseek, Gemini...).

### Lớp 2: Project Workspace (Không Gian Cấp Bản Thảo)
Dành riêng cho một dự án cụ thể khi tải lên.
1. **Bible:** Khai báo bản sắc, chủ đề, định hướng "linh hồn" của bộ truyện.
2. **Nhân vật:** Hồ sơ chi tiết từng nhân vật (tính cách, quan hệ, quá khứ).
3. **Thế giới:** Bối cảnh, không gian, thời gian, quy tắc sức mạnh, luật lệ.
4. **Dàn ý:** Tổng cương toàn truyện và sơ đồ chia chương (Chapter Beats).
5. **Writer (Khu vực Soạn Thảo):** Giao diện Trình soạn thảo nơi tác giả viết hàng ngày, tích hợp AI inline để sinh nháp.
6. **Chapters (Quản Lý Chương):** Xem danh sách toàn tập, tóm tắt chương, phiên bản.
7. **Review (Kiểm Duyệt):** Đánh giá chất lượng toàn bộ chương trước khi chốt.
8. **Export:** Xuất file chuẩn bị đăng tải lên các nền tảng đọc truyện.

## 4. Hành Trình Người Dùng Cốt Lõi (Core User Flow)

Flow chính chuẩn mực nhất (Mọi flow khác phải tập trung phục vụ flow này):
1. **Khởi tạo:** Đăng nhập → Mở **Kho truyện** tạo dự án mới.
2. **Dựng nền:** Tác giả khai báo các thông tin trụ cột theo luồng logic: **Bible → Nhân vật → Thế giới → Dàn ý.**
3. **Vào guồng viết:** Mở **Writer**, chọn chương cần viết. Tác giả có thể tự viết hoặc gạch đầu dòng để AI viết nháp dựa trên bối cảnh đã lưu.
4. **Hậu kỳ:** Dùng công cụ **Polish** (thuộc tab **Review/Chapters**) để quét văn bản, xóa giọng điệu AI, tăng chi tiết giác quan, tìm lỗi logic.
5. **Đóng gói:** Sang **Export** tải bản thảo xuống dưới định dạng MD/Docx.

## 5. Quy Tắc Thiết Kế Trải Nghiệm & UI (UX Principles)

1. **Write-First (Viết là trung tâm):** Mọi tính năng AI nâng cao (như Surprise Engine, Retcon, Narrative Memory) chỉ hoạt động ngầm để hỗ trợ. Không được hiện diện tranh giành không gian màn hình chính của Trình soạn thảo (Writer).
2. **Không phải Chat-App:** UI phải có cảm giác giống một phần mềm biên tập bản thảo chuyên nghiệp (như Notion, Word, Ulysses). Kết quả của AI trả về dưới dạng in-line (cùng dòng) hoặc sidebar (khối bên) thay vì giao diện bong bóng tin nhắn (bubble style) trừ phần Plot Q&A.
3. **Giảm thiểu Cognitive Load (Khối lượng nhận thức):** Thông tin nào không thuộc giai đoạn này thì ẩn đi. Ví dụ: Đang ở màn dựng hình nhân vật sẽ không hiển thị nút Export.
4. **Chế độ Guest không quyết định sản phẩm:** Người dùng đăng nhập (Login user) mới là đối tượng trải nghiệm chính thức, mọi quyết định thiết kế ưu tiên flow có đăng nhập.

## 6. Mức Độ Hợp Tác Với AI (Spectrum of AI Co-Creation)

VietTruyen được thiết kế linh hoạt để hỗ trợ nhiều tệp tác giả khác nhau thông qua 4 cấp độ can thiệp của AI:

### Cấp độ 1: Thủ công / Chuyên nghiệp (AI cực ít can thiệp)
*Tác giả là người kiểm soát tuyệt đối, AI đóng vai trò "Biên tập viên thầm lặng".*
- **Quy trình:** Tác giả tự gõ từng chữ, tự triển khai văn xuôi và hội thoại.
- **Vai trò AI:** Nhập cuộc khi cần kiểm tra mâu thuẫn (Retcon Analyzer), brainstorm nhanh khi bí ý tưởng (Surprise Engine), hoặc rà soát lỗi chính tả/ngữ pháp ở khâu cuối cùng. Tôn trọng tối đa giọng văn cá nhân.

### Cấp độ 2: Đồng sáng tác / Bạn đồng hành (AI can thiệp ~30% - 50%)
*Tác giả là người viết chính, AI là "Trợ lý mở rộng".*
- **Quy trình:** Tác giả tự viết các diễn biến cốt lõi, lời thoại đinh. Ở các đoạn nối cảnh, chuyển mốc thời gian hay miêu tả môi trường dài dòng, tác giả giao cho AI.
- **Vai trò AI:** Sinh ra các đoạn văn ngắn (Inline Draft) dựa trên một ý tưởng cho trước (Ví dụ: "Miêu tả cảnh trời mưa trút nước"). Tác giả đọc lại, sửa vài từ và giữ lại.

### Cấp độ 3: Đạo diễn / Tổng trình duyệt (AI can thiệp ~70% - 85%)
*Tác giả là Đạo diễn (Architect), AI là người "Chấp bút" (Ghostwriter).*
- **Quy trình:** Tác giả hiếm khi trực tiếp gõ văn xuôi. Công việc của họ là xây dựng bối cảnh (Bible) thật chặt chẽ và vạch ra các định hướng nhịp độ (Chapter Beats).
- **Vai trò AI:** Nhận các gạch đầu dòng diễn biến và sinh ra bản nháp trọn vẹn toàn chương. Tác giả sau đó sử dụng công cụ **8-Mode Polish** (đặc biệt là mục "Xóa hoàn toàn giọng điệu AI", "Làm gai góc đối thoại") để "nắn" lại câu chữ của AI cho có chiều sâu như tác phẩm thật. Phù hợp cho tốc độ sản xuất cao cấp.

### Cấp độ 4: Tự động hóa / Ý tưởng tản mạn (AI can thiệp >90%)
*Tác giả là Người ra lệnh (Prompter), AI tự biên tự diễn.*
- **Quy trình:** Tác giả đưa vào một ý tưởng lỏng lẻo cho vui (Ví dụ: "Chương này nam chính đi bắt nạt đám du côn chọc ghẹo loli").
- **Vai trò AI:** Tự phân bổ số lượng chữ, đoạn văn, lời thoại. Cấp độ này tiện lợi nhưng văn phong dễ bị "rỗng", tác giả chủ yếu xài nút "Regenerate" chứ không tập trung sửa chi tiết. *(Lưu ý: VietTruyen phục vụ cả tính năng này, nhưng định hướng Product sẽ tập trung chăm chút trải nghiệm cho Cấp độ 2 và 3 hơn).*
