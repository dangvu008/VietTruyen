/**
 * File: tinix_prompts.ts
 * Purpose: Prompt templates ported from tinix-ai/tinix-story for polish, rewrite,
 *          continue, reflection, and chapter summary operations.
 * Layer: Application (AI)
 * Domain: AI → [text transformation, quality improvement]
 * Deps: genre_descriptions
 *
 * These prompts complement the existing creation_prompts.ts (brainstorm/framework)
 * and surprise_prompts.ts (branch planning/writing) with post-generation tools.
 */

import { getGenreDescription, getTagDescription, getStyleDescription } from '../../data/genre_descriptions';

// ─── Anti-AI Tone Baseline ──────────────────────────────────

const ANTI_AI_RULES = `Tránh các mẫu câu AI phổ biến như: bắt đầu đoạn bằng 'Tuy nhiên', 'Ngoài ra', 'Hơn nữa' liên tục; kết thúc chương quá gọn gàng hoặc giáo điều; sử dụng cụm từ 'một cách + tính từ' quá nhiều; liệt kê ba thứ liền nhau theo kiểu 'cảm thấy X, Y, và Z'. TUYỆT ĐỐI KHÔNG sử dụng ký tự tiếng Trung hoặc văn phong lạm dụng Hán Việt. Phải dùng 100% tiếng Việt thuần túy, mượt mà tự nhiên.`;

// ─── Style Description Builder ──────────────────────────────

export interface StyleDescriptionInput {
  writingStyle?: string;
  writingTone?: string;
  characterDevelopment?: string;
  plotComplexity?: string;
  genre?: string;
  subGenres?: string[];
}

/**
 * Build a rich style description block for AI prompts,
 * combining user settings with genre/tag descriptions from tinix-story data.
 */
export function buildStyleDescription(input: StyleDescriptionInput): string {
  const parts: string[] = [];

  if (input.writingStyle) {
    const desc = getStyleDescription(input.writingStyle);
    parts.push(`Phong cách viết: ${input.writingStyle}${desc ? ` — ${desc}` : ''}`);
  }
  if (input.writingTone) parts.push(`Giọng điệu: ${input.writingTone}`);
  if (input.characterDevelopment) parts.push(`Xây dựng nhân vật: ${input.characterDevelopment}`);
  if (input.plotComplexity) parts.push(`Độ phức tạp cốt truyện: ${input.plotComplexity}`);

  if (input.genre) {
    const genreDesc = getGenreDescription(input.genre);
    if (genreDesc) parts.push(`\nHướng dẫn viết riêng cho thể loại ${input.genre}: ${genreDesc}`);
  }

  if (input.subGenres?.length) {
    const tagLines = input.subGenres.map((tag) => {
      const desc = getTagDescription(tag);
      return desc ? `- ${tag}: ${desc}` : `- ${tag}`;
    });
    parts.push(`\nCác chủ đề con (Tag) bổ sung:\n${tagLines.join('\n')}\nHãy kết hợp chặt chẽ các đặc điểm của những chủ đề này.`);
  }

  return parts.join('\n');
}

// ─── Reflection (Self-Check) ────────────────────────────────

export function buildReflectionPrompt(
  chapterRequirements: string,
  draftContent: string,
  targetWords: number,
): { system: string; user: string } {
  return {
    system: `Bạn là một biên tập viên xuất sắc kiêm chuyên gia thẩm định văn học. Khả năng của bạn là phát hiện các lỗi logic, sự lan man, sai tính cách nhân vật và lỗi ngôn ngữ trong các bản thảo, sau đó trực tiếp viết lại chúng thành một phiên bản hoàn hảo tuyệt đối.`,
    user: `Dưới đây là Dàn Ý yêu cầu và Bản Nháp của chương truyện.

【Dàn ý & Yêu cầu chương】
${chapterRequirements}

【Bản nháp hiện tại】
${draftContent}

Hãy ĐỌC KỸ bản nháp trên, đối chiếu với dàn ý để phát hiện những chỗ lan man, sai logic, hoặc văn phong chưa đạt.
Sau đó, HÃY VIẾT LẠI một phiên bản hoàn chỉnh, súc tích, mạch lạc hơn nhưng vẫn phải giữ độ dài tương đương (khoảng ${targetWords} chữ).

TUYỆT ĐỐI tuân thủ các quy tắc sau:
1. CHỈ xuất kết quả là nội dung chương truyện đã được tối ưu hóa. KHÔNG thêm bất kỳ nhận xét, phân tích, tiêu đề hoặc từ ngữ dư thừa nào khác.
2. Bắt buộc sử dụng 100% TIẾNG VIỆT thuần túy. TUYỆT ĐỐI cấm các ký tự tiếng Trung hoặc văn phong rườm rà Hán Việt.`,
  };
}

// ─── Polish Modes (8 types) ─────────────────────────────────

export type PolishMode =
  | 'general'
  | 'find_errors'
  | 'suggest_improvements'
  | 'direct_modify'
  | 'remove_ai_flavor'
  | 'enhance_details'
  | 'optimize_dialogue'
  | 'improve_pacing';

const POLISH_MODE_PROMPTS: Record<PolishMode, string> = {
  general: 'Hãy trau chuốt toàn diện văn bản sau, nâng cao chất lượng văn phong, làm cho ngôn ngữ mượt mà hơn, sinh động hơn, có sức truyền cảm hơn.',
  find_errors: 'Hãy kiểm tra kỹ văn bản sau, tìm ra các lỗi (bao gồm lỗi chính tả, lỗi ngữ pháp, lỗi logic, dùng từ không phù hợp v.v.), và đề xuất sửa đổi.',
  suggest_improvements: 'Hãy đọc văn bản sau, đưa ra gợi ý cải thiện cụ thể, bao gồm hướng tối ưu về cốt truyện, nhân vật, đối thoại, miêu tả v.v.',
  direct_modify: 'Hãy trực tiếp sửa đổi và tối ưu văn bản sau, nâng cao chất lượng văn phong, làm cho nó chuyên nghiệp và hoàn thiện hơn.',
  remove_ai_flavor: 'Hãy loại bỏ dấu vết AI trong văn bản sau, làm cho nó tự nhiên hơn, giống sáng tác của con người hơn, thêm chiều sâu cảm xúc.',
  enhance_details: 'Hãy tăng cường chi tiết cho văn bản sau, thêm miêu tả môi trường, miêu tả tâm lý, miêu tả giác quan v.v., làm cho nội dung phong phú lập thể hơn.',
  optimize_dialogue: 'Hãy tối ưu phần đối thoại trong văn bản sau, làm cho đối thoại tự nhiên hơn, phù hợp với tính cách nhân vật hơn, có cá tính hơn.',
  improve_pacing: 'Hãy điều chỉnh nhịp điệu của văn bản sau, tối ưu tốc độ triển khai cốt truyện, làm cho câu chuyện hấp dẫn hơn.',
};

export function buildPolishPrompt(
  text: string,
  mode: PolishMode,
  customRequirements?: string,
): { system: string; user: string } {
  let prompt = POLISH_MODE_PROMPTS[mode];
  if (customRequirements) {
    prompt += `\n\nYêu cầu bổ sung: ${customRequirements}`;
  }
  prompt += `\n\nVăn bản gốc:\n${text}\n\nChỉ xuất ra văn bản đã trau chuốt hoặc gợi ý, không có nội dung khác.`;

  return {
    system: 'Bạn là biên tập văn học và chuyên gia trau chuốt chuyên nghiệp, giỏi nâng cao chất lượng văn bản.',
    user: prompt,
  };
}

// ─── Rewrite With Style ─────────────────────────────────────

export function buildRewritePrompt(
  text: string,
  styleDescription: string,
): { system: string; user: string } {
  return {
    system: 'Bạn là biên tập viên tiểu thuyết xuất sắc, giỏi cải thiện văn bản bằng lối viết sinh động và tinh tế.',
    user: `Hãy viết lại văn bản gốc theo phong cách sau, giữ nguyên ý nghĩa và cốt truyện, nhưng thêm nhiều chi tiết:

Yêu cầu phong cách: ${styleDescription}

Văn bản gốc:
${text}

【Yêu cầu quan trọng】
1. Phải xuất ra toàn bộ nội dung tiểu thuyết đã viết lại, số từ tương đương với bản gốc
2. Tuyệt đối không chỉ xuất ra "viết lại thành công" v.v.
3. Phải xuất ra văn bản viết lại thực sự, bao gồm chi tiết miêu tả phong phú
4. Tăng cường các giác quan: mùi, vị, xúc giác, không chỉ thị giác và thính giác
5. Thêm chi tiết môi trường phản ánh tâm trạng nhân vật
6. Sử dụng ẩn dụ và so sánh sáng tạo, tránh sáo rỗng
7. Không xuất ra bất kỳ văn bản giải thích hoặc thông báo xác nhận nào`,
  };
}

// ─── Continue Writing ───────────────────────────────────────

export function buildContinuePrompt(
  novelTitle: string,
  characterSetting: string,
  worldSetting: string,
  plotIdea: string,
  styleDesc: string,
  previousContent: string,
  targetWords: number,
): { system: string; user: string } {
  return {
    system: `Bạn là nhà văn tiểu thuyết dài kỳ xuất sắc, giỏi sáng tác câu chuyện hấp dẫn và kết nối cốt truyện tự nhiên. ${ANTI_AI_RULES}`,
    user: `Hãy viết tiếp chương tiếp theo của tiểu thuyết «${novelTitle}».

【Thiết lập hiện có】
Thiết lập nhân vật: ${characterSetting}
Thế giới quan: ${worldSetting}
Cốt truyện chính: ${plotIdea}

【Yêu cầu phong cách】
${styleDesc}

【Ôn lại trước đó】(1500 từ gần nhất)
${previousContent}

【Yêu cầu viết tiếp】
1. Viết tiếp chương mới tự nhiên dựa trên nội dung trước
2. Giữ tính mạch lạc với phần trước, bao gồm tính cách nhân vật, phát triển cốt truyện, phong cách đối thoại v.v.
3. Số từ khoảng ${targetWords}
4. TUYỆT ĐỐI KHÔNG lặp lại nội dung đã có. Không bắt đầu bằng việc tóm tắt hoặc nhắc lại cảnh cuối cùng.
5. Kết thúc để lại yếu tố hồi hộp hoặc gợi mở phù hợp
6. Chỉ xuất ra nội dung viết tiếp, KHÔNG có tiêu đề chương, KHÔNG giải thích, KHÔNG có phần suy nghĩ/phân tích.`,
  };
}

// ─── Chapter Summary ────────────────────────────────────────

export function buildChapterSummaryPrompt(
  chapterTitle: string,
  chapterContent: string,
): { system: string; user: string } {
  return {
    system: 'Bạn là biên tập nội dung chuyên nghiệp, giỏi chiết xuất cốt truyện cốt lõi và thông tin quan trọng của chương.',
    user: `Hãy tạo tóm tắt ngắn gọn cho chương sau (100-200 từ).

Tiêu đề chương: ${chapterTitle}

Nội dung chương:
${chapterContent}

Yêu cầu:
1. Giữ lại cốt truyện chính và thông tin nhân vật
2. Nêu bật xung đột cốt lõi và bước ngoặt của chương
3. Ngôn ngữ ngắn gọn rõ ràng
4. Chỉ xuất ra nội dung tóm tắt, không có giải thích khác`,
  };
}

// ─── Comprehensive Polish + Suggest ─────────────────────────

export function buildComprehensivePolishPrompt(
  text: string,
  extraRequirements?: string,
): { system: string; user: string } {
  const extraBlock = extraRequirements ? `\n${extraRequirements}\n` : '';
  return {
    system: 'Bạn là biên tập văn học chuyên nghiệp, giỏi phân tích văn bản, tìm lỗi và trau chuốt tối ưu.',
    user: `Hãy phân tích và tối ưu toàn diện văn bản sau:

1. **Tìm lỗi**: Kiểm tra lỗi chính tả, lỗi ngữ pháp, lỗi logic, dùng từ không phù hợp v.v.
2. **Đưa gợi ý**: Đưa ra gợi ý cải thiện cụ thể, bao gồm cốt truyện, nhân vật, đối thoại, miêu tả v.v.
3. **Sửa trực tiếp**: Cung cấp phiên bản đã trau chuốt tối ưu

Văn bản gốc:
${text}
${extraBlock}
Hãy xuất ra theo định dạng sau:
---
【Lỗi phát hiện】
（Liệt kê các lỗi phát hiện）

【Gợi ý cải thiện】
（Liệt kê gợi ý cải thiện）

【Văn bản đã trau chuốt】
（Văn bản đã sửa trực tiếp）
---`,
  };
}

// ─── Outline Generation ─────────────────────────────────────

export function buildOutlinePrompt(
  genre: string,
  title: string,
  characterSetting: string,
  worldSetting: string,
  plotIdea: string,
  styleDesc: string,
  totalChapters: number,
  customPrompt?: string,
): { system: string; user: string } {
  const customBlock = customPrompt ? `Yêu cầu chuyên biệt của tác giả:\n${customPrompt}\n\n` : '';
  return {
    system: 'Bạn là nhà hoạch định dàn ý tiểu thuyết chuyên nghiệp, giỏi xây dựng khung truyện hấp dẫn.',
    user: `Hãy tạo dàn ý đầy đủ cho một tiểu thuyết thể loại ${genre}, tiêu đề: «${title}».

Thiết lập nhân vật: ${characterSetting}

Thế giới quan: ${worldSetting}

Cốt truyện chính: ${plotIdea}

Yêu cầu phong cách: ${styleDesc}

${customBlock}Yêu cầu:
1. Tổng cộng khoảng ${totalChapters} chương
2. Mỗi chương theo định dạng nghiêm ngặt: Chương X: Tiêu đề chương - Mô tả cốt truyện ngắn gọn (50-100 từ)
3. Cốt truyện mạch lạc, có mở đầu - phát triển - cao trào - kết thúc, nhân vật phát triển hợp lý
4. Chỉ xuất ra danh sách dàn ý, không có nội dung khác
5. Dàn ý phải hấp dẫn, lôi cuốn, có yếu tố hồi hộp
6. Phân bổ chương theo cấu trúc 3 hồi:
   - Hồi 1 (25% số chương): Giới thiệu, xây dựng thế giới, thiết lập xung đột
   - Hồi 2 (50% số chương): Phát triển, leo thang, bước ngoặt giữa truyện
   - Hồi 3 (25% số chương): Cao trào, giải quyết, kết thúc
7. Mỗi chương phải có xung đột nhỏ hoặc tiến triển rõ ràng, không có chương 'chữ lót'`,
  };
}

// ─── Chapter Writing ────────────────────────────────────────

export function buildChapterPrompt(
  novelTitle: string,
  chapterNum: number,
  chapterTitle: string,
  chapterDesc: string,
  characterSetting: string,
  worldSetting: string,
  plotIdea: string,
  styleDesc: string,
  targetWords: number,
  continuityPrompt?: string,
  contextPrompt?: string,
  customPrompt?: string,
): { system: string; user: string } {
  const continuityBlock = continuityPrompt ? `\n${continuityPrompt}` : '';
  const contextBlock = contextPrompt ? `\n${contextPrompt}` : '';
  const customBlock = customPrompt ? `\n\n[Yêu cầu bổ sung của tác giả]:\n${customPrompt}` : '';

  return {
    system: `Bạn là nhà văn tiểu thuyết dài kỳ xuất sắc, sáng tác những câu chuyện chạm đến trái tim. Hãy viết với phong cách tự nhiên của con người. ${ANTI_AI_RULES}`,
    user: `Hãy viết Chương ${chapterNum} của tiểu thuyết «${novelTitle}».

Tiêu đề chương: ${chapterTitle}
Dàn ý chương này: ${chapterDesc}

Thiết lập tổng thể:
Nhân vật: ${characterSetting}
Thế giới quan: ${worldSetting}
Cốt truyện chính: ${plotIdea}

Yêu cầu phong cách: ${styleDesc}

Yêu cầu cụ thể:
1. Nội dung khoảng ${targetWords} từ
2. Cốt truyện tuân thủ nghiêm ngặt dàn ý chương, mạch lạc với toàn bộ sách
3. Đối thoại tự nhiên mang cá tính riêng của từng nhân vật, miêu tả tâm lý tinh tế, miêu tả cảnh vật sinh động
4. Kết thúc để lại yếu tố hồi hộp hoặc gợi mở cho chương tiếp
5. Sử dụng kỹ thuật 'Show don't Tell': thể hiện cảm xúc qua hành động và chi tiết
6. Cân bằng giữa hành động, đối thoại và miêu tả nội tâm
7. Chỉ xuất ra nội dung chính, KHÔNG có tiêu đề chương, KHÔNG giải thích, KHÔNG meta-talk.
8. TUYỆT ĐỐI KHÔNG lặp lại bất kỳ đoạn văn hay lời dẫn nào đã xuất hiện ở phần trước.${continuityBlock}${contextBlock}${customBlock}`,
  };
}

// ─── Suggestion Prompts ─────────────────────────────────────

export function buildSuggestTitlePrompt(
  genre: string,
  styleDesc?: string,
  customPrompt?: string,
): { system: string; user: string } {
  let systemPrompt = 'Bạn là chuyên gia thiết kế cốt truyện, phát triển nhân vật và xây dựng thế giới quan cho tiểu thuyết sáng tạo. Những ý tưởng bạn đưa ra phải vô cùng sáng tạo, hấp dẫn, chi tiết và có chiều sâu.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  let userPrompt = `Hãy đưa ra khoảng 10 gợi ý tên cho một tiểu thuyết.

Thể loại: ${genre}

Yêu cầu:
- Tên truyện phải thật súc tích, ấn tượng, gây tò mò, phản ánh đúng đặc trưng thể loại.
- Đi kèm mỗi tên truyện là một câu mô tả ngắn gọn nội dung sơ bộ.
- BẮT BUỘC chỉ trả về kết quả dưới định dạng JSON nguyên bản.
- Cấu trúc JSON bắt buộc: {"suggestions": [{"title": "Tên 1", "description": "Mô tả 1"}]}`;

  if (customPrompt) userPrompt += `\n\nYêu cầu bổ sung của tác giả:\n${customPrompt}`;

  return { system: systemPrompt, user: userPrompt };
}

export function buildSuggestCharPrompt(
  title: string,
  genre: string,
  numMainChars: number,
  numSubChars: number,
  styleDesc?: string,
): { system: string; user: string } {
  let systemPrompt = 'Bạn là chuyên gia thiết kế cốt truyện, phát triển nhân vật và xây dựng thế giới quan cho tiểu thuyết sáng tạo.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  return {
    system: systemPrompt,
    user: `Hãy đưa ra ý tưởng thiết lập chi tiết về các nhân vật cho một tiểu thuyết.

Tiêu đề dự kiến: ${title}
Thể loại: ${genre}
Số lượng yêu cầu:
- Nhân vật chính: ${numMainChars} người
- Nhân vật phụ/phản diện: ${numSubChars} người

Yêu cầu đối với mỗi nhân vật:
1. Nêu rõ vai trò (Chính/Phụ/Phản diện)
2. Tên, ngoại hình và đặc điểm tính cách nổi bật
3. Trình độ, kỹ năng hoặc sức mạnh đặc biệt
4. Bối cảnh xuất thân và động cơ cốt lõi

Hãy mô tả sâu sắc và có chiều sâu. Chỉ trả về nội dung ý tưởng.`,
  };
}

export function buildSuggestWorldPrompt(
  title: string,
  genre: string,
  styleDesc?: string,
): { system: string; user: string } {
  let systemPrompt = 'Bạn là chuyên gia thiết kế cốt truyện và xây dựng thế giới quan cho tiểu thuyết sáng tạo.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  return {
    system: systemPrompt,
    user: `Hãy đưa ra ý tưởng thiết lập thế giới quan (khoảng 150-200 từ) cho một tiểu thuyết.

Tiêu đề dự kiến: ${title}
Thể loại: ${genre}

Yêu cầu: Chỉ ra các quy luật độc đáo, sức mạnh, cấu trúc xã hội hoặc bối cảnh lịch sử. Chỉ trả về nội dung ý tưởng.`,
  };
}

export function buildSuggestPlotPrompt(
  title: string,
  genre: string,
  characterSetting?: string,
  worldSetting?: string,
  styleDesc?: string,
): { system: string; user: string } {
  let systemPrompt = 'Bạn là chuyên gia thiết kế cốt truyện cho tiểu thuyết sáng tạo.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  return {
    system: systemPrompt,
    user: `Hãy đưa ra ý tưởng cốt truyện chính (khoảng 200-250 từ) cho tiểu thuyết này.

Tiêu đề: ${title}
Thể loại: ${genre}

${characterSetting ? `Thiết lập nhân vật: ${characterSetting}` : ''}
${worldSetting ? `Thế giới quan: ${worldSetting}` : ''}

Yêu cầu:
- Cốt truyện cần có điểm nhấn đầu truyện, bước ngoặt giữa truyện và xung đột cốt lõi rõ ràng
- Xung đột bên ngoài (đối thủ, thế lực, nhiệm vụ) và xung đột nội tâm (mâu thuẫn, lựa chọn khó khăn)
- Ít nhất 2-3 bước ngoặt bất ngờ nhưng hợp logic
- Kết thúc để lại dư vị (happy ending hoặc open ending tùy thể loại)
- Chỉ trả về nội dung ý tưởng.`,
  };
}
