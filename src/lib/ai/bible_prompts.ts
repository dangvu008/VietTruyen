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

interface TitlePromptContext {
  genre: string;
  tags: string[];
  writingStyle: string;
  customPrompt?: string;
}

interface CharacterPromptContext {
  genre: string;
  tags: string[];
  title: string;
  mainCharacterCount: number;
  supportCharacterCount: number;
  customPrompt?: string;
}

interface WorldPromptContext {
  genre: string;
  tags: string[];
  title: string;
  characters?: string;
  customPrompt?: string;
}

interface PlotPromptContext {
  genre: string;
  tags: string[];
  title: string;
  characters?: string;
  worldSetting?: string;
  customPrompt?: string;
}

const SYSTEM_BASE = `Bạn là một chuyên gia sáng tạo tiểu thuyết mạng Việt Nam. 
Hãy trả lời bằng tiếng Việt, ngắn gọn, sáng tạo, và phù hợp với thể loại được yêu cầu.
Không giải thích dài dòng, đi thẳng vào nội dung gợi ý.`;

export function buildTitlePrompt(ctx: TitlePromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';

  return {
    system: SYSTEM_BASE,
    user: `Gợi ý 5 tên tiểu thuyết hấp dẫn cho:
- Thể loại: ${ctx.genre}
- Chủ đề/Tag: ${tagsStr}
- Phong cách: ${ctx.writingStyle}${custom}

Trả về danh sách đánh số 1-5, mỗi tên một dòng. Không giải thích.`,
  };
}

export function buildCharacterPrompt(ctx: CharacterPromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';

  return {
    system: SYSTEM_BASE,
    user: `Tạo thiết lập nhân vật cho tiểu thuyết:
- Tên truyện: ${ctx.title || '(chưa đặt)'}
- Thể loại: ${ctx.genre}
- Chủ đề: ${tagsStr}
- Số nhân vật chính: ${ctx.mainCharacterCount}
- Số nhân vật phụ: ${ctx.supportCharacterCount}${custom}

Với mỗi nhân vật, mô tả ngắn gọn: Tên, Tuổi, Tính cách, Vai trò, Mối quan hệ.
Sử dụng format rõ ràng, dễ đọc.`,
  };
}

export function buildWorldPrompt(ctx: WorldPromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';
  const charInfo = ctx.characters ? `\n- Nhân vật đã có: ${ctx.characters.substring(0, 200)}...` : '';

  return {
    system: SYSTEM_BASE,
    user: `Tạo thiết lập thế giới quan cho tiểu thuyết:
- Tên truyện: ${ctx.title || '(chưa đặt)'}
- Thể loại: ${ctx.genre}
- Chủ đề: ${tagsStr}${charInfo}${custom}

Bao gồm: Bối cảnh thời đại, Hệ thống quy tắc, Địa điểm quan trọng, Phe phái/Thế lực.
Mô tả ngắn gọn, sinh động.`,
  };
}

export function buildPlotPrompt(ctx: PlotPromptContext) {
  const tagsStr = ctx.tags.length > 0 ? ctx.tags.join(', ') : 'không có';
  const custom = ctx.customPrompt ? `\nYêu cầu thêm: ${ctx.customPrompt}` : '';
  const charInfo = ctx.characters ? `\n- Nhân vật: ${ctx.characters.substring(0, 200)}...` : '';
  const worldInfo = ctx.worldSetting ? `\n- Thế giới quan: ${ctx.worldSetting.substring(0, 200)}...` : '';

  return {
    system: SYSTEM_BASE,
    user: `Gợi ý ý tưởng cốt truyện chính cho tiểu thuyết:
- Tên truyện: ${ctx.title || '(chưa đặt)'}
- Thể loại: ${ctx.genre}
- Chủ đề: ${tagsStr}${charInfo}${worldInfo}${custom}

Bao gồm: Xung đột cốt lõi, Hướng phát triển chính, Cao trào, Kết thúc dự kiến.
Viết ngắn gọn, hấp dẫn.`,
  };
}
