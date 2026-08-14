/**
 * Vietnamese prose rules injected into writer/reviewer prompts.
 */
export const VIET_WRITER_RHYTHM_RULES: string = `\
NHỊP VĂN (BẮT BUỘC):
- Phân bố đoạn dài/ngắn tự nhiên theo nhịp cảnh; tránh 3+ đoạn liên tiếp cùng độ dài.
- Câu ngắn dùng để nhấn, không biến toàn chương thành các mảnh rời.`;
export const VIET_WRITER_HOOK_RULES: string = `\
HOOK & CLOSE CHƯƠNG (BẮT BUỘC):
- Mở bằng hành vi/chi tiết/căng thẳng cụ thể, không mở bằng lời dẫn meta.
- Kết chương không tóm tắt lại; ưu tiên chuyển động hoặc câu hỏi thực sự phát sinh từ truyện.`;
export const VIET_WRITER_SHOW_DONT_TELL: string = `\
SHOW — KHÔNG TELL (BẮT BUỘC):
- Ưu tiên biểu hiện vật lý, cử chỉ, cảm giác và hành động thay cho nhãn cảm xúc.
- Logic hành động phải phát sinh từ cảnh, không từ nhu cầu chứng minh profile nhân vật.`;
export const VIET_WRITER_ANTI_AI_PROSE: string = `\
PHONG CÁCH KHÔNG-AI (BẮT BUỘC):
- Tránh từ nối giáo khoa, over-formatting, nhịp câu đồng đều, over-explaining và slogan-like phrasing.
- Không biến văn xuôi thành báo cáo/checklist.`;

export const VIET_WRITER_CHARACTER_NATURALNESS_RULES: string = `\
CHARACTER NATURALNESS — TÍNH CÁCH KHÔNG PHẢI THỦ TỤC (BẮT BUỘC):
- Trait là khuynh hướng nền. Trước mỗi phản ứng, ưu tiên thứ đang thật sự kéo sự chú ý của nhân vật trong cảnh: nguy hiểm trước mắt, đau đớn, người bên cạnh, cảm giác cơ thể, mục tiêu tức thời, mất mát, bất thường cụ thể.
- CẤM PROCEDURALIZED CHARACTERIZATION: không biến "thông minh / thận trọng / bình tĩnh / đa nghi / quan sát tốt" thành công thức lặp Quan sát → Kiểm tra → Xác nhận → So sánh → Suy luận → Loại trừ như thám tử hoặc checklist engine.
- Một hành vi kiểm tra/xác minh chỉ nên xuất hiện khi kết quả của nó có giá trị thực tế ngay trong scene. Nếu bỏ nhãn tính cách khỏi profile mà nhân vật bình thường trong hoàn cảnh đó không có lý do rõ để kiểm tra, hãy bỏ hoặc thay bằng phản ứng tự nhiên hơn.
- Không cần chứng minh trait trong từng đoạn. Nhân vật thận trọng có thể chỉ nhìn, chần chừ, đổi đường, im lặng hoặc không làm gì; nhân vật thông minh không cần liên tục phân tích thành lời.
- Sau tỉnh lại, bị thương, gặp nguy hiểm, mất mát, đoàn tụ hoặc kinh biến, phản ứng đầu tiên phải theo scene salience chứ không mặc định là quét môi trường/xác minh vị trí/kiểm kê cơ thể/suy luận nguyên nhân.
- Ngoại lệ: điều tra, truy tung, phá án, trận pháp, thám hiểm nguy hiểm hoặc tình huống mà việc xác minh là mục tiêu thực sự của scene. Khi đó vẫn tránh lặp thủ tục nếu không tạo thông tin hay quyết định mới.
- TEST: "Nếu ẩn toàn bộ profile tính cách, đây vẫn là phản ứng tự nhiên nhất hoặc cần thiết nhất lúc này không?" Nếu không, viết lại.`;

export const VIET_WRITER_SEMANTIC_CLARITY_RULES: string = `\
SEMANTIC CLARITY — BÍ ẨN NHƯNG PHẢI HIỂU ĐƯỢC CÂU (BẮT BUỘC):
- Bí ẩn về thông tin được phép; mơ hồ về nghĩa cơ bản của câu thì không.
- Cấm pseudo-prose, ghép Hán-Việt tùy tiện, abstract-noun stacking và thuật ngữ tự chế không có nghĩa/context ổn định.
- Meaning Reconstruction Test: wording đáng ngờ phải paraphrase được bằng tiếng Việt đơn giản mà không thêm thông tin.
- Worldbuilding term mới hợp lệ nếu canon/context định nghĩa hoặc prose cho độc giả đủ functional foothold.`;
export const VIET_WRITER_PUNCTUATION_RULES: string = `\
DẤU CÂU TIẾNG VIỆT (BẮT BUỘC): dấu câu sát từ trước, cách từ sau; tránh lạm dụng dấu hai chấm và em-dash.`;
export const VIET_WRITER_NATURAL_RULES: string = `\
NGÔN NGỮ TỰ NHIÊN (BẮT BUỘC): viết tiếng Việt tự nhiên, không headers/bullets trong chính văn, không biến nội tâm thành checklist.`;
export const VIET_WRITER_PROSE_RULES: string = ['## TIÊU CHUẨN VĂN XUÔI TIẾNG VIỆT CHUYÊN NGHIỆP', VIET_WRITER_RHYTHM_RULES, VIET_WRITER_HOOK_RULES, VIET_WRITER_SHOW_DONT_TELL, VIET_WRITER_ANTI_AI_PROSE, VIET_WRITER_CHARACTER_NATURALNESS_RULES, VIET_WRITER_SEMANTIC_CLARITY_RULES].join('\n\n');
export const VIET_WRITER_REVIEW_RULES: string = ['## TIÊU CHUẨN BIÊN TẬP TIẾNG VIỆT CHUYÊN NGHIỆP', VIET_WRITER_ANTI_AI_PROSE, VIET_WRITER_CHARACTER_NATURALNESS_RULES, VIET_WRITER_PUNCTUATION_RULES, VIET_WRITER_NATURAL_RULES, VIET_WRITER_SEMANTIC_CLARITY_RULES].join('\n\n');
export const VIET_WRITER_ANTI_AI_DEEP: string = `\
TIÊU CHUẨN PHÁ VÂN TAY AI:
- Tránh cấu trúc tam đoạn/checklist lặp, paragraph uniformity, transition overuse và tổng kết triết lý sáo rỗng.
- Không tự thêm metaphor mới khi sửa.
- Nếu câu nghe sâu nhưng Meaning Reconstruction Test thất bại, viết lại cụ thể.
- Nếu nhân vật liên tục quan sát/kiểm tra/xác nhận/suy luận chỉ để biểu diễn thông minh hoặc thận trọng, áp Character Naturalness Test và bỏ thủ tục thừa.`;
