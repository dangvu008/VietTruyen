/**
 * File: viet_writer_rules.ts
 * Purpose: Rule constants distilled from Viet-Writer Skill v3.1 (viet-chuyen-nghiep).
 *          Inject into prompt builders to raise Vietnamese prose quality.
 * Layer: Application (AI)
 * Domain: AI → [prompt composition, Vietnamese writing standards]
 * Source: .agents/skills/rune-viet-writer/ — editorial/ + review/
 */

// ─── NHỊP VĂN (editorial/rhythm.md) ────────────────────────────────────────
export const VIET_WRITER_RHYTHM_RULES: string = `\
NHỊP VĂN (BẮT BUỘC):
- Phân bố 70-20-10: 70% đoạn trung/dài (3-7 câu) để xây dựng cảnh; 20% đoạn ngắn (1-2 câu) nhấn mạnh hoặc chuyển nhịp; 10% câu đơn đứng độc lập cho insight then chốt và khoảnh khắc dramatic.
- TUYỆT ĐỐI không viết 3+ đoạn liên tiếp cùng độ dài — đơn điệu = mất hút người đọc.
- Đoạn siêu dài (8-12 câu) CHỈ hợp lệ khi cần chuỗi bằng chứng liền mạch, chuỗi logic A→B→C→D, hoặc show-don't-tell đòi hỏi nhiều chi tiết cụ thể. Giới hạn: 1-2 đoạn/chương. Trước và sau đoạn siêu dài phải có đoạn ngắn hoặc câu đơn tạo nhịp thở.
- Tăng tension: setup dài → complication trung → crisis ngắn → câu dramatic đơn. Giải tension: impact đơn → breath ngắn → explanation trung → exploration dài.`;

// ─── HOOK & CLOSE (editorial/hook-close.md) ─────────────────────────────────
export const VIET_WRITER_HOOK_RULES: string = `\
HOOK & CLOSE CHƯƠNG (BẮT BUỘC):
- Mở chương KHÔNG được bắt đầu bằng "Trong chương này..." hoặc mô tả tẻ nhạt. Phải mở bằng một trong: (a) hành vi cụ thể ai cũng nhận ra, (b) dự đoán/phát ngôn táo bạo, (c) chi tiết sốc hoặc nghịch lý, (d) câu chuyện cụ thể ngay lập tức.
- Delayed Reveal: được treo tên khái niệm/vấn đề trước rồi giải thích sau 2-3 đoạn — tạo tension. Giới hạn: không treo quá 4 đoạn mà không giải thích.
- Kết chương KHÔNG được tóm tắt lại những gì vừa xảy ra. Phải kết bằng: câu hỏi chiến lược, one-liner ám ảnh, hoặc callback quay lại hình ảnh mở đầu khép vòng. Hook cuối chương PHẢI kéo người đọc sang chương tiếp theo.`;

// ─── SHOW, DON'T TELL (editorial/story-core.md) ──────────────────────────────
export const VIET_WRITER_SHOW_DONT_TELL: string = `\
SHOW — KHÔNG TELL (BẮT BUỘC):
- KHÔNG gọi tên cảm xúc trực tiếp (sợ hãi, vui mừng, tức giận). Thay vào đó: mô tả biểu hiện vật lý, cử chỉ, nhịp thở, ánh mắt, giọng nói.
- Mọi claim trừu tượng phải có ví dụ cụ thể. Nếu người đọc không hình dung được bằng ảnh — đó là Tell, không phải Show.
- Logic chain phải flow tự nhiên: mỗi bước dẫn từ bước trước (Quan sát → Phản ứng → Phát hiện → Insight). Không nhảy cóc bước.`;

// ─── CHỐNG VĂN AI (review/anti-ai.md) ──────────────────────────────────────
export const VIET_WRITER_ANTI_AI_PROSE: string = `\
PHONG CÁCH KHÔNG-AI (BẮT BUỘC):
- CẤM các từ nối giáo khoa lặp đi lặp lại: "Tuy nhiên", "Bên cạnh đó", "Ngoài ra", "Điều quan trọng là", "Có thể nói rằng", "Tóm lại".
- CẤM over-formatting: không dùng **bold** label kiểu "Key points:", "Note:", "Summary:" trong văn xuôi truyện.
- Tránh paragraph uniformity: đoạn văn KHÔNG được đều nhau.
- Tránh hedging lạm dụng: không phủ mọi claim bằng "có thể", "thường", "có lẽ".
- Sentence variance bắt buộc: xen kẽ câu ngắn và câu phức để tạo nhịp đọc tự nhiên.`;

// ─── SEMANTIC CLARITY / MYSTERY CLARITY ─────────────────────────────────────
export const VIET_WRITER_SEMANTIC_CLARITY_RULES: string = `\
SEMANTIC CLARITY — BÍ ẨN NHƯNG PHẢI HIỂU ĐƯỢC CÂU (BẮT BUỘC):
- Bí ẩn về THÔNG TIN được phép; mơ hồ về NGHĨA CƠ BẢN CỦA CÂU thì không. Có thể giấu danh tính, nguyên nhân, quy luật, nguồn gốc hoặc ý nghĩa sâu xa, nhưng người đọc vẫn phải hiểu câu đang mô tả hành động, cảm giác, vật thể hay hiện tượng gì.
- CẤM AI PSEUDO-PROSE: cụm từ nghe huyền bí/thâm sâu nhưng không thể diễn giải ổn định bằng tiếng Việt thông thường; cấm ghép Hán-Việt tùy tiện, abstract-noun stacking, ẩn dụ không có quan hệ semantic rõ, hoặc tự chế thuật ngữ chỉ để tạo cảm giác cao siêu.
- MEANING RECONSTRUCTION TEST: với câu/cụm từ đáng ngờ, phải có thể paraphrase bằng tiếng Việt đơn giản mà KHÔNG bổ sung thông tin mới. Nếu không paraphrase được ổn định hoặc có nhiều cách hiểu cơ bản mâu thuẫn nhau, phải viết lại.
- Thuật ngữ worldbuilding/proper noun mới chỉ hợp lệ khi có chủ ý và được context/canon định nghĩa hoặc có đủ manh mối trên trang để độc giả nhận biết chức năng. Không được coi từ lạ là sâu sắc chỉ vì nghe cổ phong.
- Ưu tiên danh từ/động từ cụ thể và quan hệ nhân-quả rõ. Không đánh đổi khả năng hiểu để lấy vẻ huyền ảo.
- MYSTERY CLARITY INVARIANT: độc giả có thể chưa biết "đó là gì" hoặc "vì sao xảy ra", nhưng phải hiểu "đang xảy ra chuyện gì" trong câu.`;

// ─── DẤU CÂU CHUẨN (review/punctuation.md) ──────────────────────────────────
export const VIET_WRITER_PUNCTUATION_RULES: string = `\
DẤU CÂU TIẾNG VIỆT (BẮT BUỘC):
- Dấu câu [. , ! ? : ; ...] LUÔN sát từ phía trước, cách từ phía sau.
- Ngoặc đơn: cách trước ngoặc mở, cách sau ngoặc đóng, nội dung sát ngoặc bên trong.
- CẤM em-dash "—" trong văn xuôi. Dùng gạch ngang "-" có cách hai bên nếu cần.
- CẤM Oxford comma.
- Hạn chế dấu hai chấm (:). Thay bằng từ nối tự nhiên khi phù hợp.
- Nhiều tính từ cùng bổ nghĩa cho một thực thể: KHÔNG dùng dấu phẩy giữa chúng.`;

// ─── NGÔN NGỮ TỰ NHIÊN (review/natural.md) ───────────────────────────────────
export const VIET_WRITER_NATURAL_RULES: string = `\
NGÔN NGỮ TỰ NHIÊN (BẮT BUỘC):
- Viết thuần Việt. KHÔNG trộn tiếng Anh trong câu trừ thuật ngữ phổ biến khi bối cảnh cho phép.
- KHÔNG dùng headers trong văn xuôi truyện.
- KHÔNG dùng bullet points trong văn xuôi truyện.
- Ký hiệu nối câu đa dạng, không lặp cùng kiểu quá 2-3 lần.`;

export const VIET_WRITER_PROSE_RULES: string = [
  '## TIÊU CHUẨN VĂN XUÔI TIẾNG VIỆT CHUYÊN NGHIỆP',
  VIET_WRITER_RHYTHM_RULES,
  VIET_WRITER_HOOK_RULES,
  VIET_WRITER_SHOW_DONT_TELL,
  VIET_WRITER_ANTI_AI_PROSE,
  VIET_WRITER_SEMANTIC_CLARITY_RULES,
].join('\n\n');

export const VIET_WRITER_REVIEW_RULES: string = [
  '## TIÊU CHUẨN BIÊN TẬP TIẾNG VIỆT CHUYÊN NGHIỆP',
  VIET_WRITER_ANTI_AI_PROSE,
  VIET_WRITER_PUNCTUATION_RULES,
  VIET_WRITER_NATURAL_RULES,
  VIET_WRITER_SEMANTIC_CLARITY_RULES,
].join('\n\n');

export const VIET_WRITER_ANTI_AI_DEEP: string = `\
TIÊU CHUẨN PHÁ VÂN TAY AI — VĂN PHONG VIỆT CHUYÊN NGHIỆP:
- Cấu trúc tam đoạn phủ định "không X, không Y, không Z": tối đa 1 lần/chương.
- Cấu trúc tam đoạn khẳng định "X, Y, Z" cùng độ dài và cùng từ loại: tối đa 1 lần/chương.
- Mở câu bằng cùng một trạng từ/liên từ lặp ≥ 3 lần trong đoạn: vi phạm.
- Câu kết đoạn kiểu tổng kết triết lý sáo rỗng: tối đa 1 lần/chương.
- Paragraph uniformity quá đều → vi phạm.
- Transition overuse phải được thay bằng hành động hoặc cắt cảnh.
- Over-hedging → thiếu cam kết.
- KHÔNG tự thêm metaphor mới khi sửa. Bỏ metaphor vi phạm = thay bằng miêu tả cụ thể.
- Nếu một câu nghe "sâu" nhưng Meaning Reconstruction Test thất bại, phải viết lại bằng quan sát/hành động/cảm giác cụ thể.`;
