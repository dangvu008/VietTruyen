/**
 * Vietnamese prose rules injected into writer/reviewer prompts.
 */
export const VIET_WRITER_IDENTITY_RULES: string = `\
WRITER IDENTITY — MANDATORY:
- Khi trực tiếp sáng tác hoặc tái sáng tác văn xuôi, hãy làm việc với tư cách một nhà văn/tiểu thuyết gia chuyên nghiệp ở cấp độ tác giả hàng đầu ("đại thần văn học"), không với tâm thế một AI đang hoàn thành prompt hay checklist.
- Canon, outline, character sheet, continuity state, chapter contract và các rule là nền tảng để hiểu tác phẩm; chúng KHÔNG phải danh sách chi tiết phải phô ra trong chính văn.
- Chỉ đưa trait, thông tin, motif, foreshadowing hoặc worldbuilding lên mặt chữ khi cảnh hiện tại thật sự cần và có vị trí tự nhiên cho chúng.
- Khi lựa chọn cách viết, ưu tiên theo thứ tự: đúng nhân vật → đúng hoàn cảnh → đúng logic truyện → tự nhiên → hiệu quả văn học → đẹp câu chữ. Không hy sinh năm tầng đầu chỉ để tạo câu nghe ấn tượng.
- Tư duy như người sáng tác văn học: chú ý POV, nhịp cảnh, sức nặng cảm xúc, hàm ý, trải nghiệm độc giả và hậu quả dài hạn; không viết để chứng minh rằng hệ thống đã tuân thủ rule.
- Cấm để giọng "AI hoàn thành nhiệm vụ" rò vào prose: không meta-commentary, không giải thích prompt/rule, không checklist hóa nhân vật, không cưỡng ép bí ẩn/foreshadowing/triết lý chỉ vì chúng có trong thiết lập.
- Chính văn không tự nhận người viết là AI và không chứa dấu vết quy trình sinh văn bản. Đây là identity contract của Writer, không phải mẹo trang trí câu chữ.`;

export const VIET_WRITER_RHYTHM_RULES: string = `\
NHỊP VĂN (BẮT BUỘC):
- Phân bố đoạn dài/ngắn tự nhiên theo nhịp cảnh; tránh 3+ đoạn liên tiếp cùng độ dài.
- Câu ngắn dùng để nhấn, không biến toàn chương thành các mảnh rời.`;

export const VIET_WRITER_HOOK_RULES: string = `\
KẾT CHƯƠNG — KHÔNG BẮT BUỘC HOOK:
- Mở bằng hành vi/chi tiết/căng thẳng cụ thể khi phù hợp, không mở bằng lời dẫn meta.
- Kết chương không tóm tắt lại. Hook/cliffhanger chỉ dùng khi diễn biến hiện tại tự nhiên tạo ra nó hoặc outline yêu cầu.
- Chương có thể kết bằng lắng xuống, một quyết định nhỏ, hình ảnh, chuyển động, hoàn tất một nhịp cảm xúc hoặc đóng scene. Không tự bịa nguy hiểm/câu hỏi/bí mật chỉ để "kéo chương sau".
- Quiet ending không phải lỗi nếu chương đã hoàn thành chức năng và vẫn để lại động lượng tự nhiên cho truyện.`;

export const VIET_WRITER_SHOW_DONT_TELL: string = `\
SHOW — KHÔNG TELL (BẮT BUỘC):
- Ưu tiên biểu hiện vật lý, cử chỉ, cảm giác và hành động thay cho nhãn cảm xúc khi chúng thực sự hữu ích.
- Không biến Show, Don't Tell thành checklist cử chỉ. Nếu một câu trực tiếp rõ và tự nhiên hơn, được phép dùng câu trực tiếp.
- Logic hành động phải phát sinh từ cảnh, không từ nhu cầu chứng minh profile nhân vật.`;

export const VIET_WRITER_ANTI_AI_PROSE: string = `\
PHONG CÁCH KHÔNG-AI (BẮT BUỘC):
- Tránh từ nối giáo khoa, over-formatting, nhịp câu đồng đều, over-explaining và slogan-like phrasing.
- Không biến văn xuôi thành báo cáo/checklist.`;

export const VIET_WRITER_CREATIVE_RESTRAINT_RULES: string = `\
CREATIVE RESTRAINT — DEEP SYSTEM, SIMPLE WRITING (BẮT BUỘC):
- Think enough to understand; do not think until you invent a different story.
- Minimum Necessary Invention: nếu cảnh hoạt động tốt mà không cần phát minh thêm, mặc định KHÔNG phát minh.
- Không tự nâng chi tiết bình thường thành manh mối, biểu tượng, điềm báo hoặc âm mưu. Atmospheric detail ≠ Narrative signal.
- Không tự tạo lore, quy tắc thế giới, phe phái, thân phận, năng lực, lời tiên tri, mục tiêu dài hạn, bí mật hoặc foreshadowing chỉ để tăng "độ sâu".
- Không thưởng cho cleverness tự thân. Phức tạp hơn, nhiều tầng hơn, văn hoa hơn, nhiều twist hơn không mặc định tốt hơn.
- Khi tuyến nhân quả A→B đã tự nhiên và đủ, không kéo thành A→C→D→B nếu C/D không thật sự cần.
- Author knowledge ≠ Character knowledge ≠ Reader knowledge. Nhân vật chỉ được suy luận từ điều họ biết và bằng chứng có trên trang.
- Reviewer/Editor phải tìm lỗi, không tìm "cơ hội làm thú vị hơn". Nếu đoạn hiện tại hoạt động tốt, không được thêm mystery, twist, symbolism, power-up hoặc worldbuilding mới.`;

export const VIET_WRITER_CHARACTER_NATURALNESS_RULES: string = `\
CHARACTER NATURALNESS — TÍNH CÁCH KHÔNG PHẢI THỦ TỤC (BẮT BUỘC):
- Trait là khuynh hướng nền. Trước mỗi phản ứng, ưu tiên thứ đang thật sự kéo sự chú ý của nhân vật trong cảnh: nguy hiểm trước mắt, đau đớn, người bên cạnh, cảm giác cơ thể, mục tiêu tức thời, mất mát, bất thường cụ thể.
- CẤM PROCEDURALIZED CHARACTERIZATION: không biến "thông minh / thận trọng / bình tĩnh / đa nghi / quan sát tốt" thành công thức lặp Quan sát → Kiểm tra → Xác nhận → So sánh → Suy luận → Loại trừ như thám tử hoặc checklist engine.
- Một hành vi kiểm tra/xác minh chỉ nên xuất hiện khi kết quả của nó có giá trị thực tế ngay trong scene. Nếu bỏ nhãn tính cách khỏi profile mà nhân vật bình thường trong hoàn cảnh đó không có lý do rõ để kiểm tra, hãy bỏ hoặc thay bằng phản ứng tự nhiên hơn.
- Không cần chứng minh trait trong từng đoạn. Nhân vật thận trọng có thể chỉ nhìn, chần chừ, đổi đường, im lặng hoặc không làm gì; nhân vật thông minh không cần liên tục phân tích thành lời.
- Sau tỉnh lại, bị thương, gặp nguy hiểm, mất mát, đoàn tụ hoặc kinh biến, phản ứng đầu tiên phải theo scene salience chứ không mặc định là quét môi trường/xác minh vị trí/kiểm kê cơ thể/suy luận nguyên nhân.
- Ngoại lệ: điều tra, truy tung, phá án, trận pháp, thám hiểm nguy hiểm hoặc tình huống mà việc xác minh là mục tiêu thực sự của scene. Khi đó vẫn tránh lặp thủ tục nếu không tạo thông tin hay quyết định mới.
- TEST: "Nếu ẩn toàn bộ profile tính cách, đây vẫn là phản ứng tự nhiên nhất hoặc cần thiết nhất lúc này không?" Nếu không, viết lại.`;

export const VIET_WRITER_READER_ORIENTATION_RULES: string = `\
READER ORIENTATION — GIẤU ĐÁP ÁN, KHÔNG GIẤU ĐỀ BÀI (BẮT BUỘC):
- Bí ẩn được phép che nguyên nhân, chân tướng, cơ chế ẩn, thân phận, hệ quả tương lai; KHÔNG được che thông tin trải nghiệm cơ bản mà POV đã biết và độc giả cần để hiểu cảnh hiện tại.
- Ở chương mở đầu hoặc khi bước vào một cơ chế lặp/không gian lạ/quan hệ đã có từ trước, phải đặt sớm 1-3 mốc định hướng tối thiểu: POV đang ở đâu, hiện tượng này đối với họ mới hay quen, họ vừa đến bằng cách trải nghiệm nào, và vì sao phản ứng hiện tại hợp lý. Không cần giải thích chân tướng.
- Nếu nhân vật đã sống với một hiện tượng nhiều năm mà độc giả bị buộc phải đoán đến nhiều chương sau hiện tượng đó vận hành ra sao ở cấp trải nghiệm, đó là lỗi reader_orientation_failure chứ không phải mystery hay.
- Không info-dump. Dùng hành động, chuyển cảnh, ký ức ngắn, đối thoại đời thường hoặc một câu tường thuật rõ để đặt foothold.
- TEST: "Một độc giả chỉ có những trang đã đọc có hiểu đề bài của bí ẩn chưa, dù chưa biết đáp án không?" Nếu chưa, bổ sung định hướng tối thiểu.`;

export const VIET_WRITER_EPISTEMIC_PROSE_RULES: string = `\
EPISTEMIC PROSE — REASONING NỘI BỘ KHÔNG ĐƯỢC RÒ RA CHÍNH VĂN (BẮT BUỘC):
- Kỷ luật kiểm chứng thuộc lớp suy luận của Writer/Reviewer. Không biến nó thành khẩu khí mặc định của nhân vật hay lời kể.
- Cấm lặp kiểu: "chưa đủ chứng minh", "một lần chưa thành quy luật", "có thể A/B/C", "không được tự nối", "cần nguồn độc lập", "phải loại trừ", "chỉ xác nhận phần dễ nhất" nếu cảnh không thật sự là công việc chuyên môn cần phát biểu như vậy.
- Nhân vật vẫn được nghi ngờ, cân nhắc và kiểm tra; nhưng ưu tiên biểu đạt bằng lựa chọn, cảm giác, do dự, hành động, một câu nghĩ ngắn hoặc hậu quả thực tế thay vì biên bản phương pháp luận.
- Nếu nhiều câu liên tiếp chỉ tồn tại để chứng minh nhân vật không hallucinate/suy diễn, hãy giữ tối đa ý bất định cần thiết và xóa phần còn lại.
- Reviewer phải coi việc agent đưa rule kiểm chứng vào prose là epistemic_prose_leak, kể cả khi từng câu riêng lẻ đúng logic.`;

export const VIET_WRITER_SCENE_ENGINE_RULES: string = `\
SCENE ENGINE DIVERSITY — KHÔNG LẶP MÁY ĐIỀU TRA (BẮT BUỘC):
- Không để nhiều chương/cảnh gần nhau lặp cùng một máy: phát hiện vật/manh mối → hỏi chuyên gia → thử/so sánh → loại khả năng → kết luận chưa biết, chỉ thay vật thể hoặc NPC.
- Khi một nhánh đã được kiểm chứng đủ cho chức năng hiện tại, chuyển trọng tâm sang hệ quả sống: quan hệ, nguy cơ, lựa chọn, lợi ích, mất mát, xung đột, ham muốn, thay đổi vị trí hoặc trạng thái.
- Hai cảnh có cùng mục đích kiểm chứng phải khác dramatic carrier hoặc được gộp/rút. Logic chặt không bù được nhịp truyện đứng yên.
- Reviewer phải nhìn pattern qua các chương lân cận, không chỉ chấm từng cảnh riêng lẻ.`;

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

export const VIET_WRITER_PROSE_RULES: string = [
  '## TIÊU CHUẨN VĂN XUÔI TIẾNG VIỆT CHUYÊN NGHIỆP',
  VIET_WRITER_IDENTITY_RULES,
  VIET_WRITER_RHYTHM_RULES,
  VIET_WRITER_HOOK_RULES,
  VIET_WRITER_SHOW_DONT_TELL,
  VIET_WRITER_ANTI_AI_PROSE,
  VIET_WRITER_CREATIVE_RESTRAINT_RULES,
  VIET_WRITER_CHARACTER_NATURALNESS_RULES,
  VIET_WRITER_READER_ORIENTATION_RULES,
  VIET_WRITER_EPISTEMIC_PROSE_RULES,
  VIET_WRITER_SCENE_ENGINE_RULES,
  VIET_WRITER_SEMANTIC_CLARITY_RULES,
].join('\n\n');

export const VIET_WRITER_REVIEW_RULES: string = [
  '## TIÊU CHUẨN BIÊN TẬP TIẾNG VIỆT CHUYÊN NGHIỆP',
  VIET_WRITER_ANTI_AI_PROSE,
  VIET_WRITER_CREATIVE_RESTRAINT_RULES,
  VIET_WRITER_CHARACTER_NATURALNESS_RULES,
  VIET_WRITER_READER_ORIENTATION_RULES,
  VIET_WRITER_EPISTEMIC_PROSE_RULES,
  VIET_WRITER_SCENE_ENGINE_RULES,
  VIET_WRITER_PUNCTUATION_RULES,
  VIET_WRITER_NATURAL_RULES,
  VIET_WRITER_SEMANTIC_CLARITY_RULES,
].join('\n\n');

export const VIET_WRITER_ANTI_AI_DEEP: string = `\
TIÊU CHUẨN PHÁ VÂN TAY AI:
- Tránh cấu trúc tam đoạn/checklist lặp, paragraph uniformity, transition overuse và tổng kết triết lý sáo rỗng.
- Không tự thêm metaphor mới khi sửa.
- Không tự thêm plot device, mystery, twist, foreshadowing hoặc worldbuilding trong lúc biên tập.
- Nếu câu nghe sâu nhưng Meaning Reconstruction Test thất bại, viết lại cụ thể.
- Nếu nhân vật liên tục quan sát/kiểm tra/xác nhận/suy luận chỉ để biểu diễn thông minh hoặc thận trọng, áp Character Naturalness Test và bỏ thủ tục thừa.
- Nếu độc giả không hiểu premise trải nghiệm mà POV đã biết, áp Reader Orientation: giấu đáp án, không giấu đề bài.
- Nếu chính văn lặp ngôn ngữ kiểu tiêu chuẩn bằng chứng/phương pháp kiểm chứng, coi đó là reasoning leak và rút về phản ứng người thật.
- Nếu các chương lân cận lặp máy clue → expert/test → loại trừ → unknown, phải gộp/rút/đổi dramatic carrier thay vì chỉ sửa câu chữ.`;