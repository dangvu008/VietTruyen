/**
 * File: smart_prompts.ts
 * Purpose: AI prompt builders cho Smart Input — yêu cầu AI trả JSON structured
 * Layer: Application (AI)
 * Domain: All pages → [free-text to structured data extraction]
 *
 * Data Contract:
 * - Input: freeText (string) from user's natural language description
 * - Output: { system, user } prompt pair — AI sẽ trả JSON
 */
import { buildJsonObjectSystem } from './prompt_standard';

const SYSTEM_BASE = buildJsonObjectSystem(
  'Vietnamese webnovel structured extractor',
  'Read a free-form story description and extract structured project data',
  [
    'Infer only what is strongly supported by the input.',
    'Use empty strings or empty arrays when data is missing.',
    'Do not add commentary outside the schema.',
  ],
);

export function buildSmartProjectPrompt(freeText: string, storyPreview?: string) {
  const previewContext = storyPreview ? `\n\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';
  return {
    system: SYSTEM_BASE,
    user: `Phân tích mô tả tiểu thuyết sau và trích xuất TOÀN BỘ thông tin có thể:

"${freeText}"${previewContext}

Trả về JSON đúng format sau. Điền đầy đủ gì có thể suy luận, để chuỗi rỗng / mảng rỗng nếu không tìm thấy:
{
  "bible": {
    "genre": "thể loại chính",
    "subGenre": ["tag1", "tag2"],
    "writingStyle": "phong cách viết",
    "title": "tên truyện gợi ý",
    "logline": "mô tả 1 câu",
    "endgame": "đích đến cuối cùng",
    "mainCharacterCount": 2,
    "supportCharacterCount": 3,
    "characterSetup": "mô tả tổng quan nhân vật",
    "worldSetting": "mô tả thế giới quan",
    "mainPlot": "ý tưởng cốt truyện chính"
  },
  "characters": [
    {
      "name": "Tên",
      "role": "Chính/Phụ/Phản diện/Mentor",
      "traits": "tính cách",
      "arc": "hành trình",
      "currentStage": "Khởi đầu"
    }
  ],
  "world": {
    "geography": "bối cảnh",
    "magicSystem": "hệ năng lượng",
    "techLevel": "công nghệ",
    "currency": "tiền tệ",
    "factions": ["phe 1", "phe 2"],
    "rules": "luật thế giới"
  },
  "outline": [
    {
      "title": "Tên nhịp",
      "summary": "Nội dung",
      "focus": "Nhân vật trọng tâm"
    }
  ],
  "foreshadowings": [
    {
      "description": "Mầm mối / bí mật"
    }
  ]
}`,
  };
}

/**
 * Bible Page: extract genre, tags, style, title, logline, characters, world, plot
 */
export function buildSmartBiblePrompt(freeText: string, storyPreview?: string) {
  const previewContext = storyPreview ? `\n\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';
  return {
    system: SYSTEM_BASE,
    user: `Phân tích mô tả sau và trích xuất thông tin tiểu thuyết:

"${freeText}"${previewContext}

Trả về JSON đúng format sau (điền gì có, để chuỗi rỗng nếu không tìm thấy):
{
  "genre": "thể loại chính (1 chuỗi, VD: Đô thị ngôn tình)",
  "subGenre": ["tag1", "tag2", "tag3"],
  "writingStyle": "phong cách viết (1 chuỗi)",
  "title": "tên truyện gợi ý",
  "logline": "mô tả 1 câu gọn",
  "characterSetup": "mô tả nhân vật",
  "worldSetting": "mô tả thế giới quan",
  "mainPlot": "ý tưởng cốt truyện chính",
  "endgame": "đích đến cuối cùng",
  "mainCharacterCount": 2,
  "supportCharacterCount": 3
}`,
  };
}

/**
 * Characters Page: extract array of Character objects
 */
export function buildSmartCharacterPrompt(
  freeText: string,
  existingNames: string[],
  storyPreview?: string,
  outlineContext?: string,
  archetypeHints?: string,
) {
  const existing = existingNames.length > 0 ? `\nNhân vật đã có: ${existingNames.join(', ')}. KHÔNG tạo trùng.` : '';
  const previewContext = storyPreview ? `\n\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';
  const outlineBlock = outlineContext ? `\n\nCỐT TRUYỆN ĐÃ VẠCH (gắn nhân vật vào đây):\n${outlineContext}` : '';
  const archetypeBlock = archetypeHints ? `\n\nGỢI Ý VAI TRÒ THEO THỂ LOẠI:\n${archetypeHints}` : '';
  return {
    system: SYSTEM_BASE,
    user: `Phân tích mô tả nhân vật sau và trích xuất danh sách nhân vật:

"${freeText}"${existing}${outlineBlock}${archetypeBlock}${previewContext}

YÊU CẦU:
1. Đa dạng vai trò — KHÔNG chỉ tạo "Chính" và "Phụ"
2. Mỗi nhân vật phải có chức năng narrative rõ ràng
3. Nhân vật phụ phải có chiều sâu, có thể là điểm nhấn

Trả về JSON đúng format:
{
  "characters": [
    {
      "name": "Tên nhân vật",
      "role": "Chính/Phản diện chính/Phụ quan trọng/Đồng hành/Tình yêu/Đối thủ/Mentor/Hài hước/Kẻ phản bội/Gác cổng/Bí ẩn/Nền sống động/Nhân chứng/Chất xúc tác/Biến chuyển/Ẩn boss",
      "narrativeFunction": "Tại sao nhân vật này cần tồn tại trong truyện",
      "traits": "tính cách nổi bật",
      "arc": "hành trình nhân vật",
      "currentStage": "giai đoạn hiện tại (VD: Khởi đầu)",
      "appearsInArcs": ["Quyển 1", "Quyển 3"],
      "relationships": [{"with": "Tên NV khác", "type": "sư đồ/đối thủ/tình nhân/..."}]
    }
  ]
}`,
  };
}

/**
 * World Page: extract WorldRules fields
 */
export function buildSmartWorldPrompt(freeText: string, storyPreview?: string) {
  const previewContext = storyPreview ? `\n\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';
  return {
    system: SYSTEM_BASE,
    user: `Phân tích mô tả thế giới sau và trích xuất thông tin:

"${freeText}"${previewContext}

Trả về JSON đúng format:
{
  "geography": "bối cảnh địa lý",
  "magicSystem": "hệ năng lượng / phép thuật / tu luyện",
  "techLevel": "trình độ công nghệ",
  "currency": "tiền tệ / đơn vị trao đổi",
  "factions": ["phe phái 1", "phe phái 2"],
  "rules": "luật thế giới, cấm kỵ, quy tắc"
}`,
  };
}

/**
 * Outline Page: extract array of OutlineBeat objects
 */
export function buildSmartOutlinePrompt(freeText: string, existingCount: number, storyPreview?: string) {
  const previewContext = storyPreview ? `\n\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';
  return {
    system: SYSTEM_BASE,
    user: `Phân tích mô tả dàn ý sau và tạo danh sách nhịp (beats):

"${freeText}"${previewContext}

Đã có ${existingCount} nhịp. Tạo thêm nhịp mới dựa trên mô tả trên.

Trả về JSON đúng format:
{
  "beats": [
    {
      "title": "Tên nhịp ngắn gọn",
      "summary": "Mô tả nội dung, xung đột, kết quả",
      "focus": "Nhân vật trọng tâm"
    }
  ]
}`,
  };
}

/**
 * Foreshadowing Page: extract array of foreshadowing items
 */
export function buildSmartForeshadowingPrompt(freeText: string, storyPreview?: string) {
  const previewContext = storyPreview ? `\n\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';
  return {
    system: SYSTEM_BASE,
    user: `Phân tích mô tả sau và trích xuất danh sách phục bút (foreshadowing):

"${freeText}"${previewContext}

Trả về JSON đúng format:
{
  "foreshadowings": [
    {
      "description": "Chi tiết bí ẩn hoặc mầm mối sẽ được lật mở sau"
    }
  ]
}`,
  };
}
