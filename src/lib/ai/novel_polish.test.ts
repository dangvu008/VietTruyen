import { describe, expect, it } from 'vitest';

import {
  buildNovelPolishInstruction,
  getNovelPolishMode,
  NOVEL_POLISH_MODES,
} from './novel_polish';

describe('novel_polish', () => {
  it('defines the five requested polish modes in user-facing order', () => {
    expect(NOVEL_POLISH_MODES.map((mode) => mode.id)).toEqual([
      'comprehensive',
      'find_errors',
      'remove_ai_tone',
      'enhance_details',
      'optimize_dialogue',
    ]);
  });

  it('builds an editor instruction that preserves the raw text contract', () => {
    const instruction = buildNovelPolishInstruction({
      mode: 'enhance_details',
      rawText: 'Cô mở cửa. Trời lạnh.',
    });

    expect(instruction).toContain('Tăng chi tiết');
    expect(instruction).toContain('Phóng to các chi tiết miêu tả cảm quan');
    expect(instruction).toContain('Cô mở cửa. Trời lạnh.');
    expect(instruction).toContain('giữ nguyên sự kiện');
  });

  it('marks find-errors mode as a report instead of rewrite output', () => {
    const mode = getNovelPolishMode('find_errors');
    const instruction = buildNovelPolishInstruction({
      mode: 'find_errors',
      rawText: 'Anh đi vào phòng và cô ấy đang đang nhìn.',
    });

    expect(mode.outputKind).toBe('report');
    expect(instruction).toContain('liệt kê lỗi');
    expect(instruction).toContain('không viết lại toàn bộ');
  });
});
