/**
 * File: viet_writer_rules.ts
 * Purpose: Rule constants distilled from Viet-Writer Skill v3.1 (viet-chuyen-nghiep).
 *          Inject into prompt builders to raise Vietnamese prose quality.
 * Layer: Application (AI)
 * Domain: AI → [prompt composition, Vietnamese writing standards]
 * Source: .agents/skills/rune-viet-writer/ — editorial/ + review/
 */

// ─── NHỊP VĂN (editorial/rhythm.md) ────────────────────────────────────────
/**
 * Pacing rules: 70-20-10 paragraph distribution + emotional flow.
 * Source: editorial/rhythm.md §1 và §2
 */
export const VIET_WRITER_RHYTHM_RULES: string = `\
NHỊP VĂN (BẮT BUỘC):
- Phân bố 70-20-10: 70% đoạn trung/dài (3-7 câu) để xây dựng cảnh; 20% đoạn ngắn (1-2 câu) nhấn mạnh hoặc chuyển nhịp; 10% câu đơn đứng độc lập cho insight then chốt và khoảnh khắc dramatic.
- TUYỆT ĐỐI không viết 3+ đoạn liên tiếp cùng độ dài — đơn điệu = mất hút người đọc.
- Đoạn siêu dài (8-12 câu) CHỈ hợp lệ khi cần chuỗi bằng chứng liền mạch, chuỗi logic A→B→C→D, hoặc show-don't-tell đòi hỏi nhiều chi tiết cụ thể. Giới hạn: 1-2 đoạn/chương. Trước và sau đoạn siêu dài phải có đoạn ngắn hoặc câu đơn tạo nhịp thở.
- Tăng tension: setup dài → complication trung → crisis ngắn → câu dramatic đơn. Giải tension: impact đơn → breath ngắn → explanation trung → exploration dài.`;

// ─── HOOK & CLOSE (editorial/hook-close.md) ─────────────────────────────────
/**
 * Opening hooks and chapter endings to drive reader pull.
 * Source: editorial/hook-close.md §1, §2.1, §3
 */
export const VIET_WRITER_HOOK_RULES: string = `\
HOOK & CLOSE CHƯƠNG (BẮT BUỘC):
- Mở chương KHÔNG được bắt đầu bằng "Trong chương này..." hoặc mô tả tẻ nhạt. Phải mở bằng một trong: (a) hành vi cụ thể ai cũng nhận ra, (b) dự đoán/phát ngôn táo bạo, (c) chi tiết sốc hoặc nghịch lý, (d) câu chuyện cụ thể ngay lập tức.
- Delayed Reveal: được treo tên khái niệm/vấn đề trước rồi giải thích sau 2-3 đoạn — tạo tension. Giới hạn: không treo quá 4 đoạn mà không giải thích.
- Kết chương KHÔNG được tóm tắt lại những gì vừa xảy ra. Phải kết bằng: câu hỏi chiến lược, one-liner ám ảnh, hoặc callback quay lại hình ảnh mở đầu khép vòng. Hook cuối chương PHẢI kéo người đọc sang chương tiếp theo.`;

// ─── SHOW, DON'T TELL (editorial/story-core.md) ──────────────────────────────
/**
 * Show-don't-tell with physical manifestation over emotion labelling.
 * Source: editorial/story-core.md §3
 */
export const VIET_WRITER_SHOW_DONT_TELL: string = `\
SHOW — KHÔNG TELL (BẮT BUỘC):
- KHÔNG gọi tên cảm xúc trực tiếp (sợ hãi, vui mừng, tức giận). Thay vào đó: mô tả biểu hiện vật lý, cử chỉ, nhịp thở, ánh mắt, giọng nói. Ví dụ: thay "hắn tức giận" → "hắn siết chặt hàm, ngón tay gõ liên hồi lên bàn".
- Mọi claim trừu tượng phải có ví dụ cụ thể: tên, số liệu, tình huống. Nếu người đọc không hình dung được bằng ảnh — đó là Tell, không phải Show.
- Logic chain phải flow tự nhiên: mỗi bước dẫn từ bước trước (Quan sát → Phản ứng → Phát hiện → Insight). Không nhảy cóc bước.`;

// ─── CHỐNG VĂN AI (review/anti-ai.md) ──────────────────────────────────────
/**
 * Anti-AI prose patterns for chapter writing.
 * Source: review/anti-ai.md §1 và §2
 */
export const VIET_WRITER_ANTI_AI_PROSE: string = `\
PHONG CÁCH KHÔNG-AI (BẮT BUỘC):
- CẤM các từ nối giáo khoa lặp đi lặp lại: "Tuy nhiên", "Bên cạnh đó", "Ngoài ra", "Điều quan trọng là", "Có thể nói rằng", "Tóm lại". Nếu cần chuyển ý, dùng hành động nhân vật hoặc cắt cảnh.
- CẤM over-formatting: không dùng **bold** label kiểu "Key points:", "Note:", "Summary:" trong văn xuôi truyện.
- Tránh paragraph uniformity: đoạn văn KHÔNG được đều nhau. Real writing có chỗ rough, quirky — không hoàn hảo đều đặn.
- Tránh hedging lạm dụng: không phủ mọi claim bằng "có thể", "thường", "có lẽ". Nhân vật và sự kiện phải cam kết rõ ràng.
- Sentence variance bắt buộc: xen kẽ câu ngắn 3-5 chữ và câu phức 20-25 chữ để tạo nhịp đọc tự nhiên.`;

// ─── DẤU CÂU CHUẨN (review/punctuation.md) ──────────────────────────────────
/**
 * Vietnamese punctuation rules — different from English conventions.
 * Source: review/punctuation.md §1
 */
export const VIET_WRITER_PUNCTUATION_RULES: string = `\
DẤU CÂU TIẾNG VIỆT (BẮT BUỘC):
- Dấu câu [. , ! ? : ; ...] LUÔN sát từ phía trước, cách từ phía sau. Sai: "Xin chào , tôi là An ." Đúng: "Xin chào, tôi là An."
- Ngoặc đơn: cách trước ngoặc mở, cách sau ngoặc đóng, nội dung sát ngoặc bên trong. Ví dụ: "Ông ta nói (rất to) rằng..."
- CẤM em-dash "—" trong văn xuôi. Dùng gạch ngang "-" có cách hai bên nếu cần.
- CẤM Oxford comma: "nhanh hơn, sạch hơn và đúng hơn" — KHÔNG phải "nhanh hơn, sạch hơn, và đúng hơn".
- Hạn chế dấu hai chấm (:). Thay bằng từ nối tự nhiên: "là", "rằng", "như sau", "thì", "mà".
- Nhiều tính từ cùng bổ nghĩa cho một thực thể: KHÔNG dùng dấu phẩy giữa chúng. Sai: "Sự thật hiển nhiên, không thể phủ nhận." Đúng: "Sự thật hiển nhiên không thể phủ nhận."`;

// ─── NGÔN NGỮ TỰ NHIÊN (review/natural.md) ───────────────────────────────────
/**
 * Rules for natural Vietnamese — no code-switching, no English-style formatting.
 * Source: review/natural.md §1-4
 */
export const VIET_WRITER_NATURAL_RULES: string = `\
NGÔN NGỮ TỰ NHIÊN (BẮT BUỘC):
- Viết thuần Việt. KHÔNG trộn tiếng Anh trong câu trừ thuật ngữ phổ biến (AI, CEO, KPI, marketing).
- KHÔNG dùng headers (##, ###) trong storytelling/blog/truyện. Dùng câu chuyển ý tự nhiên.
- KHÔNG dùng bullet points trong văn xuôi truyện. Chuyển thành câu văn liền mạch.
- Ký hiệu nối câu đa dạng — không lặp cùng kiểu quá 2-3 lần: dấu phẩy, ngoặc đơn, ngoặc kép, ngắt câu mới, từ nối "mà/để/nơi/với/rằng/vì/nhưng", gạch ngang (dùng rất ít).`;

// ─── COMPOSITE BLOCKS ────────────────────────────────────────────────────────

/**
 * Full prose quality block for chapter WRITING prompts.
 * Combines: rhythm + hook + show-dont-tell + anti-AI prose.
 * Token cost: ~280 tokens. Keep below 300.
 */
export const VIET_WRITER_PROSE_RULES: string = [
  '## TIÊU CHUẨN VĂN XUÔI TIẾNG VIỆT CHUYÊN NGHIỆP',
  VIET_WRITER_RHYTHM_RULES,
  VIET_WRITER_HOOK_RULES,
  VIET_WRITER_SHOW_DONT_TELL,
  VIET_WRITER_ANTI_AI_PROSE,
].join('\n\n');

/**
 * Compact review block for POLISH / EDITING prompts.
 * Combines: anti-AI prose + punctuation + natural language.
 * Token cost: ~200 tokens.
 */
export const VIET_WRITER_REVIEW_RULES: string = [
  '## TIÊU CHUẨN BIÊN TẬP TIẾNG VIỆT CHUYÊN NGHIỆP',
  VIET_WRITER_ANTI_AI_PROSE,
  VIET_WRITER_PUNCTUATION_RULES,
  VIET_WRITER_NATURAL_RULES,
].join('\n\n');

/**
 * Anti-AI deep rules for the `anti_ai_tic` polish pass.
 * More detailed than VIET_WRITER_ANTI_AI_PROSE — used in surgical editing.
 * Token cost: ~180 tokens.
 */
export const VIET_WRITER_ANTI_AI_DEEP: string = `\
TIÊU CHUẨN PHÁ VÂN TAY AI — VĂN PHONG VIỆT CHUYÊN NGHIỆP:
- Cấu trúc tam đoạn phủ định "không X, không Y, không Z": tối đa 1 lần/chương. Các lần còn lại phải viết lại bằng cấu trúc khác (2 vế, 4 vế, câu đơn có phân từ).
- Cấu trúc tam đoạn khẳng định "X, Y, Z" cùng độ dài và cùng từ loại: tối đa 1 lần/chương.
- Mở câu bằng cùng một trạng từ/liên từ ("Rồi", "Và rồi", "Bỗng", "Đột nhiên") lặp ≥ 3 lần trong đoạn: vi phạm — phải đa dạng.
- Câu kết đoạn kiểu tổng kết triết lý ("... như chính định mệnh đã an bài", "... như thể thời gian ngừng lại"): tối đa 1 lần/chương.
- Paragraph uniformity: đếm câu/đoạn — nếu quá đều → vi phạm. Real writing: đoạn ngắn xen đoạn dài, không đều đặn.
- Transition overuse: "Tuy nhiên", "Bên cạnh đó", "Ngoài ra" lặp > 3 lần → phải thay bằng hành động nhân vật hoặc cắt cảnh.
- Over-hedging: mọi claim đều có "có thể", "thường", "có lẽ" → thiếu cam kết. Sự kiện phải dứt khoát.
- KHÔNG tự thêm metaphor mới khi sửa. Bỏ metaphor vi phạm = thay bằng miêu tả cụ thể (hành động, cảm giác, chi tiết vật chất).`;
