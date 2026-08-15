# Deep Writing Mode

## Mục tiêu

Deep Writing Mode dành cho người dùng muốn AI viết **kỹ hơn ở cấp độ văn học** mà không làm cốt truyện phức tạp hơn một cách giả tạo.

Deep Writing không phải Deep Plotting.

> Đi sâu vào cách viết, không tự mở rộng phạm vi sáng tạo.

Trong runtime hiện tại, lựa chọn `quality` trong selector **Nhanh / Cân bằng / Sâu** chính là Deep Writing Mode. Người dùng có thể đổi mode trực tiếp ở thanh trên của Story Editor trước khi sinh chương hoặc batch generate.

## Ba mode người dùng

### Nhanh (`fast`)

- Ưu tiên tốc độ.
- Candidate-only.
- Bỏ qua các bước review/polish/gate đắt tiền.
- Không promote accepted memory.

### Cân bằng (`balanced`)

- Chạy pre-save gate, polish, grounded prose, narrative value, data + memory sync khi PASS.
- Không chạy full checker review.
- Phù hợp viết nháp thường ngày cần an toàn continuity nhưng không muốn chi phí tối đa.

### Sâu / Deep Writing (`quality`)

- Bật Deep Writing craft contract trước Writer.
- Bắt buộc full review và polish path; `skipReview`/`skipPolish` không được âm thầm hạ cấp mode.
- Chạy pre-save quality gate, checker review, style analysis, grounded prose, narrative value, continuity và fail-closed promotion.
- Chỉ PASS mới được mutate authoritative state và accepted memory.

## Deep Writing Craft Contract

### 1. Scene Intent Lock

Writer xác định chức năng thật của cảnh, tuyến hành động vật lý và thay đổi tối thiểu cảnh phải đạt. Không tự đổi branch, nâng stakes hoặc thêm subplot.

### 2. POV & Knowledge Boundary

`Author knowledge ≠ Character knowledge ≠ Reader knowledge`.

Nội tâm và suy luận chỉ được sinh từ dữ kiện nhân vật thực sự biết trên trang.

### 3. Character Interiority

Đi sâu vào phản ứng, lựa chọn, né tránh, chú ý, cảm giác thân thể và ký ức gần khi chúng tự nhiên phát sinh từ scene.

Trait vẫn là khuynh hướng nền, không phải performance requirement.

### 4. Scene Embodiment

Làm rõ không gian, vị trí, chuyển động và continuity vật thể. Chỉ chọn giác quan có giá trị cho khoảnh khắc; không ép đủ mọi giác quan.

`Atmospheric detail ≠ Narrative signal`.

### 5. Prose Craft

Tăng độ chính xác của động từ, nhịp câu, hình ảnh và chuyển đoạn. Cắt over-explaining, triết lý gượng, ẩn dụ phô diễn và câu tổng kết cảm xúc máy móc.

### 6. Micro-Continuity

Giữ liên tục:

- vị trí;
- vật thể;
- thương thế;
- thời gian;
- xưng hô;
- mức hiểu biết;
- trạng thái cảm xúc;
- hậu quả từ đoạn/chương trước.

### 7. Minimum Necessary Invention

Deep Writing **không cấp thêm creative budget**.

Creative Complexity Governor vẫn là trần tuyệt đối. Nếu scene vận hành tốt mà không cần lore/entity/twist/mystery/foreshadowing/symbolism mới thì không được phát minh.

### 8. Revision Standard

`Correct the broken, preserve the alive.`

Deep mode được phép suy nghĩ và kiểm tra kỹ hơn nhưng reviewer không được trở thành đồng tác giả. Khi đoạn đang sống, đúng truyện và tự nhiên, để nó yên.

## Runtime flow

```text
User selects mode
    -> fast / balanced / quality(Deep Writing)
    -> Full Write Intent
    -> Deep Writing directive injected only for quality
    -> Complexity Governor remains active
    -> Branch Planning
    -> Writer
    -> Pre-save Gate
    -> Full Checker Review
    -> Style / Grounded Prose / Narrative Value
    -> Acceptance PASS/HOLD/FAIL
    -> Accepted Memory only on PASS
```

## Invariant

Deep Writing phải làm độc giả cảm thấy **nhà văn đã viết kỹ hơn**, không phải **planner đã nghĩ nhiều hơn**.
