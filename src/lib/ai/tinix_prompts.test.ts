import { describe, expect, it } from 'vitest';
import {
  buildChapterPrompt,
  buildContinuePrompt,
  buildOutlinePrompt,
  buildRewritePrompt,
  buildSuggestPlotPrompt,
} from './tinix_prompts';

describe('tinix prompts creative restraint', () => {
  it('does not force suspense at the end of every continued chapter', () => {
    const prompt = buildContinuePrompt('T', 'C', 'W', 'P', 'S', 'Prev', 2000);
    expect(prompt.user).toContain('quiet ending hợp lệ');
    expect(prompt.user).toContain('Hook/cliffhanger/gợi mở chỉ dùng khi diễn biến hiện có tự sinh ra');
    expect(prompt.user).toContain('Không tự thêm lore');
  });

  it('keeps chapter writing inside the declared scope', () => {
    const prompt = buildChapterPrompt('T', 1, 'Chương', 'Một cảnh yên', 'C', 'W', 'P', 'S', 2000);
    expect(prompt.system).toContain('DEEP SYSTEM, SIMPLE WRITING');
    expect(prompt.user).toContain('quiet ending hợp lệ');
    expect(prompt.user).toContain('Không tự thêm lore, mystery, twist, foreshadowing');
  });

  it('makes outline conflict and suspense contextual instead of mandatory', () => {
    const prompt = buildOutlinePrompt('tiên hiệp', 'T', 'C', 'W', 'P', 'S', 100);
    expect(prompt.user).toContain('xung đột nhỏ KHÔNG bắt buộc');
    expect(prompt.user).toContain('không ép mọi chương phải treo câu hỏi');
    expect(prompt.user).toContain('ít canon debt nhất');
  });

  it('does not force decorative sensory detail or symbolism during rewrite', () => {
    const prompt = buildRewritePrompt('text', 'style');
    expect(prompt.user).toContain('không ép mùi/vị/xúc giác');
    expect(prompt.user).toContain('không tạo symbolism mới');
    expect(prompt.user).toContain('không bắt buộc sáng tạo ẩn dụ mới');
  });

  it('removes fixed twist quotas from plot suggestions', () => {
    const prompt = buildSuggestPlotPrompt('T', 'tiên hiệp');
    expect(prompt.user).toContain('không có quota 2-3 twist');
    expect(prompt.user).toContain('Complexity');
  });
});
