# THE ORCHESTRA — Kiến trúc Đội Phát Triển Tự Hoạt

Đây là bản tổng hợp toàn diện nhất về Kiến trúc Hệ thống Multi-Agent Tự chủ (Autonomous Multi-Agent Architecture).

Mục tiêu tối thượng của hệ thống này là trị dứt điểm tình trạng ảo giác (hallucination) của các mô hình lớn, ép chúng phải dựa vào thực tế (Terminal và Thị giác) thay vì tự "bịa" ra kết quả thành công, bằng cách tách rời Không gian Não bộ (Thiết kế) và Không gian Tay chân (Thực thi), giao tiếp độc quyền qua File tín hiệu.

## PHẦN 1: CÁCH ĐÓNG GÓI (TẠO TEMPLATE MỘT LẦN DUY NHẤT)

Nếu mục tiêu của bạn là dùng THE ORCHESTRA như một template chung cho nhiều dự án, đây là điểm bắt đầu đúng. Bạn hãy mở Terminal, chọn một thư mục trên máy tính chuyên để lưu trữ các bộ source mẫu, ví dụ `~/Templates`, và chạy toàn bộ khối lệnh bash dưới đây. Nó sẽ tự động tạo ra một thư mục chuẩn mực có tên `ai-agent-boilerplate`.

```bash
# 1. Tạo thư mục Template gốc
mkdir -p ~/Templates/ai-agent-boilerplate
cd ~/Templates/ai-agent-boilerplate

# 2. Khởi tạo cấu trúc tài liệu AI
mkdir -p docs/database docs/workflows docs/features

# 3. Tạo file Bảng công việc rỗng
cat << 'EOF' > docs/BOARD.md
# KANBAN BOARD
## 📝 To Do (Backlog)
## 🏃 In Progress
## ✅ Done
EOF

# 4. Tạo file Thiết kế rỗng (với nhắc nhở dùng Gherkin)
cat << 'EOF' > docs/DESIGN.md
# TÀI LIỆU THIẾT KẾ (SDD)
*Lưu ý cho Antigravity: Hãy điền kiến trúc vào đây. BẮT BUỘC sử dụng cú pháp Given-When-Then (Gherkin) cho các luồng logic phức tạp để đảm bảo Execute Coder viết test chính xác.*

## 1. Tổng quan
## 2. Tech Stack
## 3. Database Schema
## 4. Kịch bản Nghiệp vụ (Gherkin)
EOF

# 5. Tạo luật cho Claude Code / Codex
cat << 'EOF' > CLAUDE.md
# QUY TẮC BẮT BUỘC CHO EXECUTE CODER
1. Đọc `docs/BOARD.md` và lấy task ở cột In Progress.
2. Đọc `docs/DESIGN.md` để nắm kịch bản Gherkin.
3. TUYỆT ĐỐI áp dụng Test-Driven Development (TDD). Viết/cập nhật Test trước khi code logic.
4. Tự chạy lệnh `npm test` (hoặc test framework tương ứng). Không dừng lại cho đến khi Terminal báo PASS.
EOF

# 6. Tạo Script Gác cổng (Watcher)
cat << 'EOF' > watcher.sh
#!/bin/bash
TRIGGER_FILE=".ready_for_claude"
echo "👀 Trình gác cổng AI đang chạy... (Nhấn Ctrl+C để thoát)"
while true; do
  if [ -f "$TRIGGER_FILE" ]; then
    TASK=$(cat "$TRIGGER_FILE")
    rm "$TRIGGER_FILE"
    echo "========================================"
    echo "🚀 Bắt đầu thực thi: $TASK"
    claude "Nhiệm vụ: '$TASK'. Đọc BOARD.md và DESIGN.md. Áp dụng TDD và tự động sửa code cho đến khi PASS test."
    echo "✅ Claude đã hoàn tất. Đang chờ thiết kế mới..."
  fi
  sleep 3
done
EOF

# Cấp quyền thực thi cho script
chmod +x watcher.sh
```

> **Lưu ý tối ưu phần cứng:** File `watcher.sh` này sử dụng vòng lặp với lệnh `sleep 3`. Cách tiếp cận này cực kỳ nhẹ nhàng với tài nguyên hệ thống, đặc biệt phù hợp khi bạn treo ngầm cả ngày trên máy Mac Intel mà không muốn quạt bị hú liên tục hoặc máy bị quá nhiệt.

## PHẦN 2: TƯ DUY KIẾN TRÚC (THE PHILOSOPHY)

Thay vì để một AI làm từ A-Z dẫn đến tràn ngữ cảnh, chúng ta áp dụng mô hình Phân rã trách nhiệm (Separation of Concerns) và Giao tiếp qua File (File-based Handshake):

* **"Não bộ & Đôi mắt" (Antigravity/Codex):** Đóng vai trò Product Manager, System Architect và QA. Có khả năng nhìn (Vision) để đọc ảnh UI, thiết kế logic, nhưng bị cấm tự viết code vào project.
* **"Tay chân" (Claude Code/Subagents):** Đóng vai trò Đội trưởng Thực thi (Master Executor). Dùng tính năng Subagent để chia việc (viết test, gõ code), nhưng bị cấm tự sáng tác kiến trúc hay luồng hệ thống ngoài thiết kế.
* **"Nguồn sự thật" (Terminal/Compiler):** AI không có quyền tự đánh giá code của mình. Output của lệnh test (PASS/FAIL) từ Terminal là thước đo nghiệm thu duy nhất.

## PHẦN 3: CẤU TRÚC THƯ MỤC & TÀI LIỆU (THE WORKSPACE)

Dự án phải được bao bọc bởi một hệ sinh thái tài liệu để AI tự đọc hiểu và làm luật.

### 1. Cấu trúc thư mục

```text
/my-project
├── /docs                 # Trụ sở chính không gian thiết kế của AI
│   ├── BOARD.md          # Bảng Kanban (To Do, In Progress, Done)
│   ├── DESIGN.md         # Kiến trúc tổng thể, quy ước chung mã nguồn
│   ├── /database         # Chứa schema.md (Sự thật duy nhất về dữ liệu)
│   └── /workflows        # Chứa user_flow.md (Luồng logic và use cases)
├── /src                  # Mã nguồn gốc dự án
├── CLAUDE.md             # Luật thép dành riêng cho Agent thực thi (Claude/Cursor)
├── .antigravity_rules    # Luật thép dành riêng cho Agent thiết kế (Antigravity)
└── watcher.sh            # Gã gác cổng (Bash script tự động hóa đánh thức AI)
```

### 2. Các File "Luật Thép" Cốt Lõi

* **`.antigravity_rules`**: "Nhiệm vụ của bạn là Thiết kế và QA. Hãy đọc tài liệu/ảnh yêu cầu, phân tích thành components chi tiết. Cập nhật tiến độ vào BOARD.md và luồng dữ liệu vào /docs. Khi xong việc, BẮT BUỘC tạo file tín hiệu `.ready_for_claude` chứa nội dung tên task vừa phân rã."
* **`CLAUDE.md`**: "Nhiệm vụ của bạn là cỗ máy Thực thi. Đọc task đang In Progress ở BOARD.md, bám sát các giới hạn tại DESIGN.md. Tuyệt đối áp dụng cơ chế TDD (Viết đoạn test trước để nó Fail, sau đó code UI/Logic để nó Pass). KHÔNG BAO GIỜ báo cáo hoàn thành nếu test trên Terminal chưa ra output báo PASS."

## PHẦN 4: KÍCH HOẠT TỰ ĐỘNG HÓA (THE WATCHER)

Để các Agent tự làm việc kết nối với nhau mà không cần con người gõ lệnh gọi liên tục, chúng ta sử dụng một process bash script chạy ngầm.

Tạo file `watcher.sh` (cấp quyền `chmod +x watcher.sh`) chạy liên tục trên một tab Terminal riêng. Gấp thêm lệnh `sleep 3` tránh loop ăn CPU:

```bash
#!/bin/bash
TRIGGER_FILE=".ready_for_claude"
echo "👀 Đang theo dõi tín hiệu..."
while true; do
  if [ -f "$TRIGGER_FILE" ]; then
    TASK=$(cat "$TRIGGER_FILE")
    rm "$TRIGGER_FILE" # Xóa ngay lập tức để tránh trigger vòng lặp
    echo "🚀 Bắt đầu gọi Agent thực thi với task: $TASK"
    claude "Nhiệm vụ mới: '$TASK'. 1. Đọc BOARD.md và DESIGN.md. 2. Gọi Subagent để chia nhỏ phần Test, Logic, và UI. 3. Thao tác code và gọi liên tục lệnh test. Chỉ in báo cáo dừng lại khi Terminal xác nhận PASS."
  fi
  sleep 3
done
```

## PHẦN 5: VÒNG LẶP THỰC CHIẾN (END-TO-END WORKFLOW)

Khi bạn muốn code một tính năng mới bất kỳ, ví dụ màn hình giỏ hàng, vòng lặp sẽ chạy khép kín:

1. **Khởi tạo định hướng (User → Antigravity):** Bạn quăng một bức ảnh thiết kế và ý tưởng tính năng đưa cho Antigravity.
2. **Thiết kế & Bẻ gãy (Antigravity):**
   - Nhờ khả năng Vision, nó bóc tách chính xác bố cục lưới.
   - Cập nhật `BOARD.md` đưa task vào diện *In Progress*.
   - Đổ data spec kỹ thuật như màu sắc, spacing, component name vào `DESIGN.md`.
   - Sinh file `$ echo "Implement Cart UI Component" > .ready_for_claude`.
3. **Bàn giao tự động (Watcher → Claude Code):** Kịch bản `watcher.sh` chộp lấy file, tự động xóa cờ hiệu và truyền script sang gọi Claude Code dậy để code.
4. **Thực thi kỷ luật (Claude Code + Subagents):**
   - Đọc doc, phân công Subagent phụ viết file Test. Code Test báo Fail.
   - Gọi Subagent ráp logic và Component UI.
   - Chạy lệnh test ở Terminal ngầm. Đọc lỗi log và fix đến bước có mã xanh.
   - Đánh dấu `[x]` vào `BOARD.md` và tắt agent.
5. **Nghiệm thu chống mù chữ (Visual QA):** Bạn xem UI qua mắt thường, nếu chức năng đúng nhưng màu sắc hoặc kích thước khác thiết kế Figma, bạn chụp ảnh kết quả đẩy ngược lại cho Antigravity: *"Tính năng đúng nhưng UI bị lệch. Xem lại ảnh và tạo task fix CSS"*.

## PHẦN 6: CÁCH SỬ DỤNG (KHI CÓ DỰ ÁN MỚI)

Bây giờ bạn đã có bộ khuôn mẫu lưu tại `~/Templates/ai-agent-boilerplate`. Bất cứ khi nào bạn có ý tưởng làm một dự án mới, ví dụ một ứng dụng React hay một mini game, hãy làm theo quy trình 3 bước sau:

### Bước 1: Nhân bản Template cho dự án mới

Mở Terminal và copy thư mục template sang dự án mới của bạn:

```bash
cp -R ~/Templates/ai-agent-boilerplate ~/Documents/du-an-moi
cd ~/Documents/du-an-moi

# Init project (Ví dụ với React)
# npm create vite@latest . -- --template react-ts
```

### Bước 2: Bật "Hệ thống tự động"

Mở một tab Terminal riêng biệt hoặc một split terminal trong IDE, chạy script gác cổng và thu nhỏ nó lại:

```bash
./watcher.sh
```

### Bước 3: Vận hành dây chuyền (Bằng Antigravity)

Lúc này, toàn bộ quá trình code của bạn chỉ còn xoay quanh việc giao tiếp với Antigravity.

- Bạn kéo thả ảnh màn hình giao diện, Figma hoặc web mẫu, vào Antigravity.
- Bạn ra lệnh: *"Tôi muốn xây dựng giao diện này. Cậu hãy phân tích ảnh, viết thiết kế vào docs/DESIGN.md, cập nhật task vào docs/BOARD.md. Xong việc, hãy tạo file `.ready_for_claude` kèm nội dung 'Implement Header UI'."*
- Antigravity thiết kế xong -> Script `watcher.sh` sẽ bắt được tín hiệu -> Claude Code tự động nhảy vào viết Test và gõ code cho đến khi hoàn thành.
- Bạn mở trình duyệt nghiệm thu. Nếu có lỗi CSS nhỏ, lại chụp ảnh quăng vào Antigravity: *"Sửa lại lề của nút bấm này, giao task cho Claude"*.

---

**TỔNG KẾT:**
Đó là cách đóng gói toàn bộ sức mạnh của nhiều AI lại thành một cỗ máy phát triển phần mềm cục bộ, an toàn, có tính kỷ luật cao và không bao giờ bị ảo giác kết quả. Bằng kiến trúc chia rẽ chuyên môn THE ORCHESTRA, chúng ta ép hệ thống vận hành như một nhà máy phần mềm thu nhỏ, xác nhận mọi kết luận bằng Terminal thực tế thay vì bằng niềm tin của model.
