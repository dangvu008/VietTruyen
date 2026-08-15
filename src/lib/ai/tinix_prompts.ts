/**
 * File: tinix_prompts.ts
 * Purpose: Prompt templates ported from tinix-ai/tinix-story for polish, rewrite,
 *          continue, reflection, outline, chapter writing and suggestion operations.
 * Layer: Application (AI)
 * Domain: AI → [text transformation, quality improvement]
 * Deps: genre_descriptions
 */

import { getGenreDescription, getTagDescription, getStyleDescription } from '../../data/genre_descriptions';

// ─── Shared Writing Contracts ────────────────────────────────

const ANTI_AI_RULES = `Tránh các mẫu câu AI phổ biến như: bắt đầu đoạn bằng 'Tuy nhiên', 'Ngoài ra', 'Hơn nữa' liên tục; kết thúc chương quá gọn gàng hoặc giáo điều; sử dụng cụm từ 'một cách + tính từ' quá nhiều; liệt kê ba thứ liền nhau theo kiểu 'cảm thấy X, Y, và Z'. TUYỆT ĐỐI KHÔNG sử dụng ký tự tiếng Trung hoặc văn phong lạm dụng Hán Việt. Phải dùng 100% tiếng Việt tự nhiên, mượt mà.`;

const CREATIVE_RESTRAINT_RULES = `CREATIVE RESTRAINT — DEEP SYSTEM, SIMPLE WRITING:
- Think enough to understand; do not think until you invent a different story.
- Minimum Necessary Invention: nếu văn bản/cảnh vẫn hoạt động tốt mà không cần phát minh thêm, KHÔNG phát minh.
- Giữ nguyên canon, ý nghĩa, quan hệ nhân quả và chapter intent. Không tự thêm lore, phe phái, thân phận bí mật, năng lực, mục tiêu dài hạn, twist, mystery, foreshadowing, symbolism hoặc triết lý chỉ để làm tác phẩm có vẻ sâu hơn.
- Atmospheric detail ≠ Narrative signal. Chi tiết môi trường có thể chỉ là môi trường; không tự biến thành manh mối/điềm báo.
- Author knowledge ≠ Character knowledge ≠ Reader knowledge. Nhân vật chỉ suy luận từ điều họ thực sự biết và bằng chứng có trên trang.
- Hook/cliffhanger/coolpoint/reveal không bắt buộc trong mọi chương. Quiet ending hợp lệ khi scene đã hoàn thành chức năng.
- Khi biên tập: find defects, not opportunities. Correct the broken, preserve the alive. Ưu tiên xóa/giản hóa phần thừa hơn là thay bằng sáng tạo mới.`;

// ─── Style Description Builder ──────────────────────────────

export interface StyleDescriptionInput {
  writingStyle?: string;
  writingTone?: string;
  characterDevelopment?: string;
  plotComplexity?: string;
  genre?: string;
  subGenres?: string[];
}

export function buildStyleDescription(input: StyleDescriptionInput): string {
  const parts: string[] = [];

  if (input.writingStyle) {
    const desc = getStyleDescription(input.writingStyle);
    parts.push(`Phong cách viết: ${input.writingStyle}${desc ? ` — ${desc}` : ''}`);
  }
  if (input.writingTone) parts.push(`Giọng điệu: ${input.writingTone}`);
  if (input.characterDevelopment) parts.push(`Xây dựng nhân vật: ${input.characterDevelopment}`);
  if (input.plotComplexity) {
    parts.push(`Độ phức tạp cốt truyện: ${input.plotComplexity} — đây là trần/định hướng, không phải quota phải làm mọi cảnh phức tạp.`);
  }

  if (input.genre) {
    const genreDesc = getGenreDescription(input.genre);
    if (genreDesc) parts.push(`\nHướng dẫn viết riêng cho thể loại ${input.genre}: ${genreDesc}`);
  }

  if (input.subGenres?.length) {
    const tagLines = input.subGenres.map((tag) => {
      const desc = getTagDescription(tag);
      return desc ? `- ${tag}: ${desc}` : `- ${tag}`;
    });
    parts.push(`\nCác chủ đề con (Tag) bổ sung:\n${tagLines.join('\n')}\nChỉ dùng đặc điểm của tag khi hợp cảnh; không biến tag thành checklist phải biểu diễn.`);
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
    system: `Bạn là biên tập viên văn học chuyên nghiệp. Nhiệm vụ là phát hiện và sửa lỗi thật: logic, continuity, lệch nhân vật, lan man, câu khó hiểu và dấu vết AI. Không viết lại chỉ để làm văn bản "ấn tượng hơn". ${CREATIVE_RESTRAINT_RULES}`,
    user: `Dưới đây là Dàn Ý yêu cầu và Bản Nháp của chương truyện.

【Dàn ý & Yêu cầu chương】
${chapterRequirements}

【Bản nháp hiện tại】
${draftContent}

Đối chiếu bản nháp với dàn ý. Chỉ sửa những span thật sự có vấn đề; giữ nguyên những đoạn đang sống, tự nhiên và đúng truyện. Nếu cấu trúc scene đang hoạt động, không tự thêm biến cố, manh mối, ẩn dụ, bí mật hay tầng nghĩa mới.
Mục tiêu độ dài khoảng ${targetWords} chữ, nhưng không được bơm chi tiết vô nghĩa chỉ để đạt số chữ.

TUYỆT ĐỐI tuân thủ:
1. CHỈ xuất nội dung chương truyện sau biên tập; không nhận xét, phân tích, tiêu đề hay meta-text.
2. Dùng tiếng Việt tự nhiên; không ký tự tiếng Trung, không lạm dụng Hán-Việt.
3. Find defects, not opportunities. Correct the broken, preserve the alive.`,
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
  general: 'Trau chuốt văn bản ở những chỗ thật sự cần để câu chữ mượt, rõ và tự nhiên hơn; không đồng nhất hóa giọng văn hoặc làm mọi câu bóng bẩy.',
  find_errors: 'Kiểm tra lỗi chính tả, ngữ pháp, logic, continuity, dùng từ và câu khó hiểu. Chỉ nêu lỗi có căn cứ; không coi lựa chọn văn phong hợp lệ là lỗi.',
  suggest_improvements: 'Đưa ra gợi ý chỉ cho những điểm đang cản trở logic, nhân vật, nhịp, đối thoại hoặc độ rõ. Không đề xuất plot/lore/twist mới chỉ để làm truyện thú vị hơn.',
  direct_modify: 'Trực tiếp sửa các lỗi và điểm yếu thực sự; giữ nguyên nội dung đang hoạt động tốt, không over-edit.',
  remove_ai_flavor: 'Loại bỏ dấu vết AI, over-explaining, nhịp câu máy móc và câu sáo. Không tự thêm chiều sâu cảm xúc, backstory hay symbolism không có trong bản gốc.',
  enhance_details: 'Chỉ bổ sung chi tiết ở nơi độc giả thiếu thông tin cảm giác/không gian cần thiết cho scene. Không bắt buộc đủ mọi giác quan, không biến chi tiết thành foreshadowing hoặc biểu tượng.',
  optimize_dialogue: 'Tối ưu đối thoại cho tự nhiên, đúng quan hệ và giọng nhân vật; không thêm lời thoại để giải thích lore hoặc thể hiện trait theo checklist.',
  improve_pacing: 'Điều chỉnh nhịp bằng cắt, gộp, sắp xếp hoặc làm rõ vật liệu đã có. Không bịa hook, twist, danger hay mystery mới để tăng tốc.',
};

export function buildPolishPrompt(
  text: string,
  mode: PolishMode,
  customRequirements?: string,
): { system: string; user: string } {
  let prompt = POLISH_MODE_PROMPTS[mode];
  if (customRequirements) prompt += `\n\nYêu cầu bổ sung: ${customRequirements}`;
  prompt += `\n\n${CREATIVE_RESTRAINT_RULES}\n\nVăn bản gốc:\n${text}\n\nChỉ xuất ra văn bản đã trau chuốt hoặc gợi ý theo đúng mode, không có nội dung khác.`;

  return {
    system: `Bạn là biên tập văn học chuyên nghiệp. Chất lượng đến từ độ chính xác, tự nhiên và đúng tác phẩm, không từ việc làm mọi thứ phức tạp hơn. ${CREATIVE_RESTRAINT_RULES}`,
    user: prompt,
  };
}

// ─── Rewrite With Style ─────────────────────────────────────

export function buildRewritePrompt(
  text: string,
  styleDescription: string,
): { system: string; user: string } {
  return {
    system: `Bạn là biên tập viên tiểu thuyết chuyên nghiệp. Viết lại để đúng phong cách và tự nhiên hơn nhưng không sáng tạo vượt scope. ${CREATIVE_RESTRAINT_RULES}`,
    user: `Hãy viết lại văn bản gốc theo phong cách sau, giữ nguyên ý nghĩa, cốt truyện, sự kiện, tri thức nhân vật và quan hệ nhân quả.

Yêu cầu phong cách: ${styleDescription}

Văn bản gốc:
${text}

【Yêu cầu quan trọng】
1. Xuất toàn bộ văn bản viết lại, độ dài xấp xỉ bản gốc; không kéo dài chỉ để thêm trang trí.
2. Không meta-text hoặc thông báo "viết lại thành công".
3. Chỉ bổ sung chi tiết khi cần cho độ rõ, không khí hoặc cảm xúc đã tồn tại trong scene.
4. Giác quan được dùng chọn lọc theo điều nhân vật thật sự chú ý; không ép mùi/vị/xúc giác vào mọi cảnh.
5. Không ép môi trường phải phản chiếu tâm trạng, không tạo symbolism mới nếu bản gốc không có chức năng đó.
6. Ẩn dụ/so sánh chỉ dùng khi tự nhiên và có ích; không bắt buộc sáng tạo ẩn dụ mới.
7. Cấm thêm lore, mystery, twist, foreshadowing, entity quan trọng, power-up hoặc động cơ bí mật ngoài văn bản gốc/yêu cầu tác giả.`,
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
    system: `Bạn là nhà văn tiểu thuyết dài kỳ chuyên nghiệp, giỏi nối tiếp câu chuyện tự nhiên. ${ANTI_AI_RULES}\n${CREATIVE_RESTRAINT_RULES}`,
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
1. Viết tiếp tự nhiên dựa trên nội dung trước; ưu tiên tuyến nhân quả đơn giản nhất đủ để scene vận hành.
2. Giữ continuity nhân vật, plot và đối thoại; không dùng tri thức tác giả mà nhân vật chưa biết.
3. Số từ khoảng ${targetWords}; không bơm filler hoặc phát minh thêm để đạt quota.
4. Không lặp lại nội dung đã có; không mở đầu bằng tóm tắt cảnh trước.
5. Kết chương theo trạng thái tự nhiên của scene. Hook/cliffhanger/gợi mở chỉ dùng khi diễn biến hiện có tự sinh ra; quiet ending hợp lệ.
6. Không tự thêm lore, phe phái, bí mật, năng lực, twist hoặc foreshadowing chỉ vì có thể.
7. Chỉ xuất nội dung viết tiếp, không tiêu đề chương, giải thích hay phần suy nghĩ/phân tích.`,
  };
}

// ─── Chapter Summary ────────────────────────────────────────

export function buildChapterSummaryPrompt(
  chapterTitle: string,
  chapterContent: string,
): { system: string; user: string } {
  return {
    system: 'Bạn là biên tập nội dung chuyên nghiệp, chỉ chiết xuất những gì thật sự có trong chương; không suy diễn thêm plot hoặc ý nghĩa.',
    user: `Hãy tạo tóm tắt ngắn gọn cho chương sau (100-200 từ).

Tiêu đề chương: ${chapterTitle}

Nội dung chương:
${chapterContent}

Yêu cầu:
1. Giữ cốt truyện chính và thông tin nhân vật có thật trong chương.
2. Nêu xung đột/bước ngoặt nếu có; nếu chương lắng hoặc chuyển tiếp thì nêu tiến triển thực tế thay vì bịa bước ngoặt.
3. Ngôn ngữ ngắn gọn rõ ràng.
4. Không suy diễn foreshadowing, động cơ hay bí mật chưa được văn bản xác nhận.
5. Chỉ xuất nội dung tóm tắt.`,
  };
}

// ─── Comprehensive Polish + Suggest ─────────────────────────

export function buildComprehensivePolishPrompt(
  text: string,
  extraRequirements?: string,
): { system: string; user: string } {
  const extraBlock = extraRequirements ? `\n${extraRequirements}\n` : '';
  return {
    system: `Bạn là biên tập văn học chuyên nghiệp. Chỉ sửa lỗi thật và điểm yếu có bằng chứng; không biến việc review thành đồng sáng tác. ${CREATIVE_RESTRAINT_RULES}`,
    user: `Hãy phân tích và tối ưu văn bản sau theo nguyên tắc: correct the broken, preserve the alive.

1. **Tìm lỗi**: chính tả, ngữ pháp, logic, continuity, dùng từ, character mismatch, câu khó hiểu, over-explaining hoặc creative overreach.
2. **Gợi ý**: chỉ gợi ý cách sửa từ vật liệu đang có; không đề xuất thêm lore, twist, mystery, symbolism, foreshadowing hoặc biến cố chỉ để tăng độ hấp dẫn.
3. **Sửa trực tiếp**: sửa tối thiểu đủ giải quyết lỗi; giữ nguyên đoạn tốt.

Văn bản gốc:
${text}
${extraBlock}
${CREATIVE_RESTRAINT_RULES}

Hãy xuất theo định dạng:
---
【Lỗi phát hiện】
（Chỉ liệt kê lỗi có căn cứ）

【Gợi ý cải thiện】
（Ưu tiên giản hóa/sửa từ vật liệu hiện có）

【Văn bản đã trau chuốt】
（Văn bản sau sửa tối thiểu cần thiết）
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
    system: `Bạn là nhà hoạch định dàn ý tiểu thuyết chuyên nghiệp. Dùng độ phức tạp đúng mức cần thiết; không đánh đồng nhiều twist/lore với chất lượng. ${CREATIVE_RESTRAINT_RULES}`,
    user: `Hãy tạo dàn ý đầy đủ cho một tiểu thuyết thể loại ${genre}, tiêu đề: «${title}».

Thiết lập nhân vật: ${characterSetting}

Thế giới quan: ${worldSetting}

Cốt truyện chính: ${plotIdea}

Yêu cầu phong cách: ${styleDesc}

${customBlock}Yêu cầu:
1. Tổng cộng khoảng ${totalChapters} chương.
2. Mỗi chương: Chương X: Tiêu đề - Mô tả ngắn 50-100 từ.
3. Toàn truyện có progression rõ và nhân vật phát triển hợp lý; cường độ được phép lên/xuống tự nhiên.
4. Chỉ xuất danh sách dàn ý.
5. Hồi hộp/twist chỉ dùng tại điểm truyện thật sự cần; không ép mọi chương phải treo câu hỏi.
6. Cấu trúc 3 hồi là khung tham chiếu, không phải công thức cứng cho từng chương.
7. Mỗi chương phải có chức năng hoặc thay đổi/tiến triển cụ thể; xung đột nhỏ KHÔNG bắt buộc. Chương lắng, hồi phục, quan hệ, di chuyển hoặc setup hợp lệ nếu có chức năng.
8. Ưu tiên cách triển khai đơn giản nhất hoàn thành arc với ít canon debt nhất.`,
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
    system: `Bạn là nhà văn tiểu thuyết dài kỳ chuyên nghiệp. Viết như nhà văn, không như AI đang hoàn thành checklist. ${ANTI_AI_RULES}\n${CREATIVE_RESTRAINT_RULES}`,
    user: `Hãy viết Chương ${chapterNum} của tiểu thuyết «${novelTitle}».

Tiêu đề chương: ${chapterTitle}
Dàn ý chương này: ${chapterDesc}

Thiết lập tổng thể:
Nhân vật: ${characterSetting}
Thế giới quan: ${worldSetting}
Cốt truyện chính: ${plotIdea}

Yêu cầu phong cách: ${styleDesc}

Yêu cầu cụ thể:
1. Nội dung khoảng ${targetWords} từ; không bơm filler để đạt quota.
2. Tuân thủ dàn ý chương và continuity toàn truyện; không tự nâng scope.
3. Đối thoại, tâm lý và cảnh vật phải tự nhiên theo scene; không biểu diễn trait như checklist.
4. Kết chương theo nhịp tự nhiên. Hook/cliffhanger/gợi mở chỉ khi dàn ý hoặc diễn biến hiện có thật sự dẫn tới nó; quiet ending hợp lệ.
5. Show, Don't Tell là công cụ, không phải luật phải biến mọi cảm xúc thành chuỗi cử chỉ.
6. Cân bằng hành động/đối thoại/nội tâm theo nhu cầu scene, không theo tỷ lệ máy móc.
7. Không tự thêm lore, mystery, twist, foreshadowing, symbolism, power-up hoặc entity quan trọng ngoài dàn ý/context.
8. Chỉ xuất nội dung chính, không tiêu đề chương, giải thích hay meta-talk.
9. Không lặp lại đoạn văn/lời dẫn đã xuất hiện ở phần trước.${continuityBlock}${contextBlock}${customBlock}`,
  };
}

// ─── Suggestion Prompts ─────────────────────────────────────

export function buildSuggestTitlePrompt(
  genre: string,
  styleDesc?: string,
  customPrompt?: string,
): { system: string; user: string } {
  let systemPrompt = 'Bạn là chuyên gia đặt tên và định vị tiểu thuyết. Ưu tiên tên đúng chất truyện, gợi hình và dễ nhớ; không cố làm bí hiểm hoặc phức tạp chỉ để gây tò mò.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  let userPrompt = `Hãy đưa ra khoảng 10 gợi ý tên cho một tiểu thuyết.

Thể loại: ${genre}

Yêu cầu:
- Tên súc tích, phản ánh đúng đặc trưng thể loại và premise; mức độ bí ẩn chỉ vừa đủ nếu phù hợp.
- Mỗi tên kèm một câu mô tả nội dung sơ bộ, không tự bịa thêm đại twist/lore ngoài premise.
- Chỉ trả JSON nguyên bản.
- Cấu trúc: {"suggestions": [{"title": "Tên 1", "description": "Mô tả 1"}]}`;

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
  let systemPrompt = 'Bạn là chuyên gia xây dựng nhân vật. Chiều sâu đến từ động cơ, mâu thuẫn và hành vi nhất quán, không từ việc nhồi nhiều bí mật/backstory.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  return {
    system: systemPrompt,
    user: `Hãy đề xuất thiết lập nhân vật cho một tiểu thuyết.

Tiêu đề dự kiến: ${title}
Thể loại: ${genre}
- Nhân vật chính: ${numMainChars}
- Nhân vật phụ/phản diện: ${numSubChars}

Mỗi nhân vật cần:
1. Vai trò.
2. Tên, ngoại hình đủ nhận diện và 2-4 đặc điểm tính cách cốt lõi.
3. Kỹ năng/sức mạnh chỉ khi thể loại/premise cần.
4. Xuất thân và động cơ ở mức đủ giải thích hành vi.

Không tự thêm thân phận bí mật, bi kịch quá khứ, năng lực đặc biệt hay quan hệ ngầm chỉ để tạo chiều sâu. Chỉ trả nội dung ý tưởng.`,
  };
}

export function buildSuggestWorldPrompt(
  title: string,
  genre: string,
  styleDesc?: string,
): { system: string; user: string } {
  let systemPrompt = 'Bạn là chuyên gia worldbuilding. Xây đúng lượng thế giới cần cho premise; mỗi luật mới tạo canon debt nên chỉ thêm khi có chức năng.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  return {
    system: systemPrompt,
    user: `Hãy đề xuất thế giới quan khoảng 150-200 từ cho tiểu thuyết.

Tiêu đề dự kiến: ${title}
Thể loại: ${genre}

Chỉ mô tả các quy luật, sức mạnh, cấu trúc xã hội hoặc lịch sử thật sự cần để premise vận hành. Không tạo thêm hệ thống/phân tầng/phe phái chỉ để thế giới có vẻ đồ sộ. Chỉ trả nội dung ý tưởng.`,
  };
}

export function buildSuggestPlotPrompt(
  title: string,
  genre: string,
  characterSetting?: string,
  worldSetting?: string,
  styleDesc?: string,
): { system: string; user: string } {
  let systemPrompt = 'Bạn là chuyên gia thiết kế cốt truyện. Ưu tiên nhân quả rõ, động cơ tự nhiên và ít canon debt; complexity phải được câu chuyện kiếm được.';
  if (styleDesc) systemPrompt += `\n\n${styleDesc}`;

  return {
    system: systemPrompt,
    user: `Hãy đề xuất cốt truyện chính khoảng 200-250 từ cho tiểu thuyết này.

Tiêu đề: ${title}
Thể loại: ${genre}

${characterSetting ? `Thiết lập nhân vật: ${characterSetting}` : ''}
${worldSetting ? `Thế giới quan: ${worldSetting}` : ''}

Yêu cầu:
- Có mục tiêu/động lực trung tâm và progression rõ.
- Xung đột chỉ ở mức premise cần; không bắt buộc phải có cả xung đột bên ngoài lẫn nội tâm nếu một loại đã đủ mạnh.
- Bước ngoặt là tùy chọn và phải xuất phát từ nhân quả đã gieo; không có quota 2-3 twist.
- Không tự thêm phe phái, tiên tri, thân phận bí mật, đại âm mưu hoặc hệ thống mới nếu premise không cần.
- Kết thúc để lại dư vị phù hợp thể loại.
- Chỉ trả nội dung ý tưởng.`,
  };
}
