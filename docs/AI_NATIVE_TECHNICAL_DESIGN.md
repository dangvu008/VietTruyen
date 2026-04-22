# VietTruyen: AI-Native Technical Design Blueprint
**(Bản Thiết Kế Kỹ Thuật Đặc Tả Dành Riêng Cho Solo Founder Dùng AI)**

Tài liệu này phân tích kiến trúc, các tính năng cốt lõi, bóc tách thách thức kỹ thuật và đưa ra giải pháp cụ thể giúp một người tự xây dựng ứng dụng (Solo Founder) có thể phối hợp làm việc trơn tru nhất với các AI Agents (như Cursor, Antigravity, Copilot).

---

## 1. Triết lý Kiến trúc (AI-Native Architecture)

Hệ thống được xây dựng bởi AI cần có thiết kế tránh sự kềnh càng và rối rắm (spaghetti code), vì AI Agent dễ bị "ảo giác" hoặc mất bối cảnh nếu nhồi nhét quá nhiều logic vào một nơi. 

*   **De-coupled State (Tách bạch trạng thái):** Tách rõ Dữ liệu Nội dung (nội dung truyện) và Trạng thái Giao diện (đang loading, đang gọi API).
*   **Micro-files & Single Responsibility:** Chia nhỏ logic thành các hàm, files (dưới 250 dòng). Mỗi file làm đúng 1 nhiệm vụ.
*   **100% Strict TypeScript:** Giai đoạn đầu có vẻ tốn thời gian, nhưng Type chặt chẽ giúp AI tự động phát hiện lỗi và sửa chính xác hơn.
*   **Offline-first:** Trình xem & gõ text phải phản hồi lập tức. Xử lý lưu trữ ngầm, không để UI phải chờ đợi mạng.

---

## 2. Các Tính năng Cốt lõi & Phân tích Bài toán

### 2.1. Kiến trúc Giao diện 2 lớp (Dual-Shell IA)
*   **Tính năng:** Môi trường được chia thành Global Shell (Dashboard, Mạng xã hội, Kho dự án) và Project Workspace (Không gian làm việc riêng của 1 bản thảo).
*   **Bài toán kỹ thuật:** Chuyển đổi qua lại giữa 2 shell này rất dễ gây xung đột State hoặc rò rỉ bộ nhớ (memory leaks) nếu giữ chung một cấu trúc Routing.
*   **Giải pháp:** 
    *   Tách hoàn toàn `global_page_registry` và `project_page_registry` như đã định hình. 
    *   Bên trong Project Workspace, State được quản lý độc lập bởi Zustand (`use_project_store`). Khi thoát ra Global, dọn dẹp (reset) `project_store` để tránh rác bộ nhớ.

### 2.2. Trình soạn thảo kết hợp AI Orchestration (Writer Workflow)
*   **Tính năng:** Người dùng gõ nháp hoặc gạch đầu dòng, AI dựa trên các Dàn ý (Outline) / Thế giới (World) để tự động chuyển thành văn xuôi ngay trong lúc gõ (In-line) hoặc qua tab kế bên (Sidebar).
*   **Bài toán kỹ thuật:** Gọi LLM mất nhiều thời gian (10 - 20s). Nếu UI bị khóa (block) trong thời gian đó, trải nghiệm người dùng sẽ cực tệ. AI Agent khi lập trình rất dễ đưa await API trực tiếp vào Component UI làm giật lag ứng dụng.
*   **Giải pháp:**
    *   **Workflow State Machine:** Sử dụng `use_workflow_session_store.ts` để quản lý luồng: `idle` → `context_building` → `drafting` → `polishing`. Component UI chỉ việc đăng ký (subscribe) theo state này để hiển thị Spinner hoặc Skeleton rành mạch.

### 2.3. Narrative Memory (Trí nhớ Cốt truyện cho LLM)
*   **Tính năng:** AI biết rõ nhân vật A ghét nhân vật B, hay luật phép thuật của thế giới, mà tác giả không cần phải nhắc lại liên tục ở mỗi chương.
*   **Bài toán kỹ thuật:** Nếu gửi nguyên bộ truyện 50 chương vào Context Window của AI sẽ gây nổ token, tốn cực nhiều tiền và bị "trôi bối cảnh" (Lost in the middle).
*   **Giải pháp:** 
    *   Xây dựng hệ thống cấu trúc (Structured Data): `Characters`, `World Rules`.
    *   Khi gọi AI viết một đoạn: Hệ thống tự trích xuất "Bản đồ RAG" nhỏ gọn (Chỉ lấy tóm tắt 3 chương trước đó + Rules cốt lõi + Đặc điểm nhân vật xuất hiện trong cảnh hiện tại) chèn vào System Prompt.

---

## 3. Thách thức Kỹ thuật Khó nhất & Khắc phục

### 💥 Thách thức #1: Đồng bộ Dữ liệu Cục bộ & Đám mây (Hybrid Sync)
*   **Nguyên nhân:** Website dạng viết truyện đòi hỏi gõ chữ không được có độ trễ (Zero-latency). Nhưng phải đề phòng mất điện, sập mạng là mất bài.
*   **Cách giải quyết cho AI Code:** 
    *   Dùng kiến trúc **Local-First**. Nội dung soạn thảo được lưu ngay vào IndexedDB (Front-end) mỗi 2 giây.
    *   Xây dựng một Worker chạy ngầm (Supabase Sync Service): Quét những thay đổi chưa đồng bộ và từ từ đẩy lên Server bất kể lúc nào mạng kết nối lại.

### 💥 Thách thức #2: Maintainability bởi AI - "Trôi dạt Codebase" (Code Drift)
*   **Nguyên nhân:** Đặc quyền của Solo Founder sử dụng AI là tốc độ Dev cực cháy. Nếu AI sửa tới lui nhiều lần, các tệp dài ra thành hàng ngàn dòng, không kiểm soát được lỗi logic nữa.
*   **Cách giải quyết:**
    *   Bảo trì các tệp **CANONICAL_SPEC (Nguồn Chân Lý)**. Trước khi cho AI code một chức năng, buộc nó phải dọc "Luật lệ của dự án" để không tự ý import thư viện bừa bãi hay xóa mất kiến trúc cũ.
    *   Tách nhỏ Store: Không gộp tất tật vào một `appStore`. Chia thành `project_store` (chứa dữ liệu), `workflow_store` (chứa trạng thái luồng), `ui_store` (chức năng bật tắt Sidebar/Modal).

### 💥 Thách thức #3: Retcon Analyzer (Phân tích Logic ngược)
*   **Nguyên nhân:** Tác giả thay đổi quá khứ (Ví dụ sửa tóc nam chính từ Đen sang Trắng ở chương 1). Làm sao để phát hiện và nhắc nhở thay đổi này cho 10 chương sau đã lỡ viết?
*   **Cách giải quyết:**
    *   Khi có thay đổi trong Document `Bible/Character`, kích hoạt một Event `ON_CANON_CHANGED`.
    *   LLM nhận một tệp tin Diff (Phần cũ - Phần mới) và tự động rà quét các Chương đã hoàn thành (ưu tiên dùng Model nhanh / rẻ như Gemini Flash hoặc Claude 3.5 Haiku) để tạo ra `Impact Report` (Bản dự kiến Xung đột). Hệ thống chỉ tạo "Cảnh báo đỏ" chứ tuyệt đối không lấy quyền tự động sửa văn bản của tác giả.

### 💥 Thách thức #4: Cân bằng Giọng Hành Văn (8-Mode Polish)
*   **Nguyên nhân:** Văn của AI lúc nào cũng có mùi "Sáo rỗng", "Văn mẫu", quá nhiều tính từ.
*   **Cách giải quyết:**
    *   Trong Pipeline, bản nháp AI sinh ra không đưa thẳng cho User, mà đưa vào **Vòng lặp tự kiểm duyệt (Self-Reflection Loop)**.
    *   Sử dụng System prompt với **Few-Shot Prompting**: Cung cấp khoảng 3 ví dụ "Đoạn văn bị AI hóa" và "Đoạn văn con người đã sửa" để AI học tone giọng trước khi xuất kết quả cuối.

---

## 4. Kế hoạch Hành động (Roadmap Recommendation)

Là một Solo Founder, bạn cần phân tách tiến độ để dễ quản lý các AI Agent làm việc:

1.  **Phase 1: Foundation (Khung Sườn Chết)** 
    *   Thiết lập xong Dual Toolshell Router, Layout, IndexedDB, Schema Typescript chuẩn xác. Chưa gọi API của bất kỳ AI nào.
2.  **Phase 2: Editor & Core Entities (Linh hồn dữ liệu)**
    *   Hoàn thiện màn hình soạn thảo văn bản, CRUD nhân vật, bối cảnh, dàn ý chuẩn (Lưu cục bộ tốt).
3.  **Phase 3: The AI Engine (Động cơ Nhận thức)**
    *   Nhúng Workflow luồng viết bài, cài đặt Prompt Engineering trích xuất Context. Sinh ra văn xuôi.
4.  **Phase 4: Curation & Polish (Trải nghiệm Thượng hạng)**
    *   Hệ thống Retcon, Polish văn phong, Sync ngầm với Supabase. Cấu hình bảo mật Cloud.

*Bản thiết kế này phục vụ làm "Prompt Ngữ Cảnh" hoàn hảo mỗi khi bạn giao task lớn cho AI thao tác.*
