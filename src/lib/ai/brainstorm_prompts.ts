/**
 * File: brainstorm_prompts.ts
 * Purpose: AI prompt builders cho Brainstorm flow — interactive dialogue + auto-generation
 * Layer: Application (AI)
 * Domain: Brainstorm → [idea expansion, chapter skeleton generation]
 *
 * Data Contract:
 * - Input: freeText (user idea), optional context (previous messages)
 * - Output: { system, user } prompt pair → AI trả JSON
 */

const BRAINSTORM_SYSTEM = `Bạn là chuyên gia sáng tạo tiểu thuyết mạng Việt Nam cấp cao nhất.
Nhiệm vụ: Brainstorm cùng người viết — mở rộng ý tưởng, đặt câu hỏi thú vị, gợi ý hướng đi.
Phong cách: Nhiệt tình, sáng tạo, thực tế. Hiểu sâu về webnovel Trung/Việt.
LUÔN trả lời bằng tiếng Việt.`;

const EXTRACTION_SYSTEM = `Bạn là chuyên gia sáng tạo tiểu thuyết mạng Việt Nam.
Nhiệm vụ: Phân tích cuộc brainstorm và trích xuất TOÀN BỘ thông tin thành cấu trúc dự án.
LUÔN trả về JSON hợp lệ. Không giải thích, không markdown — CHỈ JSON.`;

/**
 * Brainstorm Phase 1: Interactive dialogue
 * AI sẽ mở rộng ý tưởng, đặt câu hỏi, gợi ý
 */
export function buildBrainstormDialoguePrompt(
  userIdea: string,
  previousMessages: Array<{ role: 'user' | 'ai'; content: string }>
) {
  const context = previousMessages.length > 0
    ? `\n\nCuộc trò chuyện trước đó:\n${previousMessages.map((m) => `${m.role === 'user' ? 'NGƯỜI VIẾT' : 'AI'}: ${m.content}`).join('\n')}`
    : '';

  return {
    system: BRAINSTORM_SYSTEM,
    user: `${context}

NGƯỜI VIẾT nói: "${userIdea}"

Hãy phản hồi theo format sau:
1. PHÂN TÍCH ngắn gọn ý tưởng (2-3 câu)
2. MỞ RỘNG — gợi ý 2-3 hướng phát triển thú vị
3. CÂU HỎI — 2-3 câu hỏi quan trọng giúp định hình câu chuyện rõ hơn (nhân vật? conflict? thế giới?)
4. GỢI Ý TÊN TRUYỆN — 3 cái tên hấp dẫn

Giữ ngắn gọn, đi thẳng vào trọng tâm. Tối đa 300 words.`,
  };
}

/**
 * Brainstorm Phase 2: Extract everything into structured project
 * Chạy sau khi user hoàn tất brainstorm, extract ra JSON
 */
export function buildBrainstormExtractionPrompt(
  allMessages: Array<{ role: 'user' | 'ai'; content: string }>
) {
  const conversation = allMessages
    .map((m) => `${m.role === 'user' ? 'NGƯỜI VIẾT' : 'AI'}: ${m.content}`)
    .join('\n\n');

  return {
    system: EXTRACTION_SYSTEM,
    user: `Phân tích toàn bộ cuộc brainstorm sau và trích xuất ĐẦẦY ĐỦ thông tin:

${conversation}

Trả về JSON đúng format sau. Điền chi tiết nhất có thể. Sáng tạo thêm nếu cần:

{
  "bible": {
    "genre": "thể loại chính",
    "subGenre": ["tag1", "tag2", "tag3"],
    "writingStyle": "phong cách viết phù hợp nhất",
    "title": "tên truyện hay nhất từ brainstorm",
    "logline": "mô tả 1 câu gọn nhất",
    "endgame": "đích đến cuối cùng của câu chuyện",
    "mainCharacterCount": 2,
    "supportCharacterCount": 3,
    "characterSetup": "mô tả tổng quan setup nhân vật",
    "worldSetting": "mô tả thế giới quan",
    "mainPlot": "ý tưởng cốt truyện chính + xung đột + cao trào"
  },
  "characters": [
    {
      "name": "Tên",
      "role": "Chính/Phụ/Phản diện/Mentor",
      "traits": "tính cách chi tiết",
      "arc": "hành trình phát triển",
      "currentStage": "Khởi đầu"
    }
  ],
  "world": {
    "geography": "bối cảnh địa lý chi tiết",
    "magicSystem": "hệ năng lượng / tu luyện / dị năng",
    "techLevel": "trình độ công nghệ",
    "currency": "tiền tệ",
    "factions": ["phe phái 1", "phe phái 2"],
    "rules": "luật thế giới, cấm kỵ, quy tắc"
  },
  "outline": [
    {
      "title": "Tên nhịp (arc/phase)",
      "summary": "Nội dung chính, xung đột, kết quả",
      "focus": "Nhân vật trọng tâm"
    }
  ],
  "chapterSkeleton": [
    {
      "title": "Chương 1: [Tên]",
      "summary": "Tóm tắt nội dung chương",
      "keyEvents": ["sự kiện 1", "sự kiện 2"],
      "entityRefs": ["tên nhân vật/entity xuất hiện"]
    }
  ],
  "foreshadowings": [
    {
      "description": "Mầm mối bí ẩn sẽ lật mở sau"
    }
  ]
}

Tạo ít nhất:
- 3-5 nhân vật (có đủ chính + phụ + phản diện)
- 5-10 outline beats  
- 10-20 chapter skeleton (tùy quy mô truyện)
- 3-5 foreshadowings`,
  };
}

/**
 * Auto-generate chapter skeleton from outline
 * Khi user đã có outline, tạo chi tiết chapters
 */
export function buildChapterSkeletonPrompt(
  projectContext: {
    title: string;
    genre: string;
    characters: string;
    worldSetting: string;
    mainPlot: string;
    endgame: string;
    outline: Array<{ title: string; summary: string }>;
    targetChapters: number;
  }
) {
  return {
    system: EXTRACTION_SYSTEM,
    user: `Dựa trên thông tin dự án sau, tạo CHAPTER SKELETON chi tiết:

TRUYỆN: ${projectContext.title}
THỂ LOẠI: ${projectContext.genre}
NHÂN VẬT: ${projectContext.characters}
THẾ GIỚI: ${projectContext.worldSetting}
CỐT TRUYỆN: ${projectContext.mainPlot}
ĐÍCH ĐẾN: ${projectContext.endgame}
MỤC TIÊU: ${projectContext.targetChapters} chương

DÀN Ý:
${projectContext.outline.map((b, i) => `${i + 1}. ${b.title}: ${b.summary}`).join('\n')}

Trả về JSON:
{
  "chapters": [
    {
      "title": "Chương N: [Tên chương hấp dẫn]",
      "summary": "Tóm tắt chi tiết nội dung chương (3-5 câu)",
      "keyEvents": ["sự kiện quan trọng 1", "sự kiện 2", "sự kiện 3"],
      "entityRefs": ["tên nhân vật/entity xuất hiện trong chương"]
    }
  ]
}

Tạo đúng ${Math.min(projectContext.targetChapters, 30)} chương (nếu target > 30 thì tạo 30 chương đầu).
Mỗi chương phải có ít nhất 2 key events và 1 entity ref.
Phân bổ outline beats đều vào các chương.`,
  };
}
