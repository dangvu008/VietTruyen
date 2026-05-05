/**
 * File: bible_prompts.ts
 * Purpose: AI prompt builders for Bible page inline suggestions
 * Layer: Application (AI)
 * Domain: Bible → [AI suggestions for novel setup fields]
 *
 * Data Contract:
 * - Input: Context from project state (genre, tags, style, etc.)
 * - Output: { system: string, user: string } prompt pair
 */
import { buildVietnameseTextSystem } from './prompt_standard';

interface TitlePromptContext {
  genre: string;
  tags: string[];
  writingStyle: string;
  customPrompt?: string;
  storyPreview?: string;
}

interface CharacterPromptContext {
  genre: string;
  tags: string[];
  title: string;
  mainCharacterCount: number;
  supportCharacterCount: number;
  customPrompt?: string;
  storyPreview?: string;
  /** Tóm tắt outline/arc đã vạch sẵn — để gắn nhân vật vào cốt truyện */
  outlineContext?: string;
  /** Gợi ý archetype từ template — để AI sinh đa dạng vai trò */
  archetypeHints?: string;
}

interface WorldPromptContext {
  genre: string;
  tags: string[];
  title: string;
  characters?: string;
  customPrompt?: string;
  storyPreview?: string;
}

interface PlotPromptContext {
  genre: string;
  tags: string[];
  title: string;
  characters?: string;
  worldSetting?: string;
  customPrompt?: string;
  storyPreview?: string;
}

const SYSTEM_BASE = buildVietnameseTextSystem(
  'Vietnamese webnovel concept editor',
  'Generate concise, genre-appropriate creative suggestions for project setup fields',
  [
    'Stay creative but specific.',
    'Do not add long explanations.',
    'Go straight to the requested suggestions.',
  ],
);

export function buildTitlePrompt(ctx: TitlePromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';
  const previewContext = ctx.storyPreview ? `\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${ctx.storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';

  return {
    system: SYSTEM_BASE,
    user: `Gợi ý 5 tên tiểu thuyết hấp dẫn cho:
- Thể loại: ${ctx.genre}
- Chủ đề/Tag: ${tagsStr}
- Phong cách: ${ctx.writingStyle}${custom}${previewContext}

Trả về danh sách đánh số 1-5, mỗi tên một dòng. Không giải thích.`,
  };
}

export function buildCharacterPrompt(ctx: CharacterPromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';
  const previewContext = ctx.storyPreview ? `\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${ctx.storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';
  const totalMin = Math.max(ctx.mainCharacterCount + ctx.supportCharacterCount, 8);
  const outlineBlock = ctx.outlineContext ? `\n- Cốt truyện đã vạch:\n${ctx.outlineContext}` : '';
  const archetypeBlock = ctx.archetypeHints ? `\n- Gợi ý vai trò theo thể loại:\n${ctx.archetypeHints}` : '';

  return {
    system: SYSTEM_BASE,
    user: `Tạo thiết lập nhân vật cho tiểu thuyết:
- Tên truyện: ${ctx.title || '(chưa đặt)'}
- Thể loại: ${ctx.genre}
- Chủ đề: ${tagsStr}
- Tổng nhân vật tối thiểu: ${totalMin}${outlineBlock}${archetypeBlock}${custom}${previewContext}

YÊU CẦU QUAN TRỌNG:
1. Nhân vật PHẢI đa dạng vai trò — KHÔNG chỉ tạo Chính + Phụ đơn giản
2. Bắt buộc có: nhân vật mentor, nhân vật hài hước/comic relief, kẻ phản bội tiềm năng, nhân vật nền tạo bầu không khí
3. Mỗi nhân vật phải gắn với ARC cụ thể trong cốt truyện (nếu có outline)
4. Nhân vật phụ phải có chiều sâu — đôi khi nhân vật phụ là điểm nhấn của truyện
5. KHÔNG thêm nhân vật tùy tiện — mỗi người phải có chức năng narrative rõ ràng

Với mỗi nhân vật, mô tả:
- Tên
- Vai trò narrative (Chính/Phản diện chính/Đồng hành/Mentor/Tình yêu/Hài hước/Kẻ phản bội/Nền sống động/Bí ẩn/Ẩn boss...)
- Tính cách nổi bật
- Chức năng trong cốt truyện — TẠI SAO nhân vật này cần tồn tại
- Xuất hiện ở arc/quyển nào
- Mối quan hệ với nhân vật khác

Sử dụng format rõ ràng, dễ đọc.`,
  };
}

export function buildWorldPrompt(ctx: WorldPromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';
  const charInfo = ctx.characters ? `\n- Nhân vật đã có: ${ctx.characters.substring(0, 200)}...` : '';
  const previewContext = ctx.storyPreview ? `\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${ctx.storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';

  return {
    system: SYSTEM_BASE,
    user: `Tạo thiết lập thế giới quan cho tiểu thuyết:
- Tên truyện: ${ctx.title || '(chưa đặt)'}
- Thể loại: ${ctx.genre}
- Chủ đề: ${tagsStr}${charInfo}${custom}${previewContext}

Bao gồm: Bối cảnh thời đại, Hệ thống quy tắc, Địa điểm quan trọng, Phe phái/Thế lực.
Mô tả ngắn gọn, sinh động.`,
  };
}

export function buildPlotPrompt(ctx: PlotPromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';
  const charInfo = ctx.characters ? `\n- Nhân vật: ${ctx.characters.substring(0, 200)}...` : '';
  const worldInfo = ctx.worldSetting ? `\n- Thế giới quan: ${ctx.worldSetting.substring(0, 200)}...` : '';
  const previewContext = ctx.storyPreview ? `\n--- NỘI DUNG GỐC CỦA TRUYỆN DỰA ĐỂ THAM KHẢO ---\n${ctx.storyPreview}\n--- KẾT THÚC NỘI DUNG GỐC ---\n` : '';

  return {
    system: SYSTEM_BASE,
    user: `Gợi ý ý tưởng cốt truyện chính cho tiểu thuyết:
- Tên truyện: ${ctx.title || '(chưa đặt)'}
- Thể loại: ${ctx.genre}
- Chủ đề: ${tagsStr}${charInfo}${worldInfo}${custom}${previewContext}

Bao gồm: Xung đột cốt lõi, Hướng phát triển chính, Cao trào, Kết thúc dự kiến.
Viết ngắn gọn, hấp dẫn.`,
  };
}
