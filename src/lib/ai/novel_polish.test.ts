import { describe, expect, it } from 'vitest';

import {
  buildParagraphPolishInstruction,
  buildNovelPolishStorySource,
  buildNovelPolishInstruction,
  getNovelPolishMode,
  isNovelPolishFailureResponse,
  NOVEL_POLISH_MODES,
  splitNovelPolishRawText,
} from './novel_polish';
import { estimateTokens } from './token_estimator';

describe('novel_polish', () => {
  it('builds a focused paragraph polish instruction with character context', () => {
    const instruction = buildParagraphPolishInstruction({
      mode: 'internal_monologue',
      rawText: 'Lan nhìn cánh cửa khép lại. Cô im lặng rất lâu.',
      characterContext: '- Lan: sợ bị bỏ rơi; luôn che giấu tổn thương bằng im lặng.',
    });

    expect(instruction).toContain('Task: Rewrite the selected paragraph');
    expect(instruction).toContain('Intent: Deepen internal monologue');
    expect(instruction).toContain('Character context:');
    expect(instruction).toContain('Lan: sợ bị bỏ rơi');
    expect(instruction).toContain('Lan nhìn cánh cửa khép lại.');
    expect(instruction).toContain('Rewrite only the selected paragraph');
  });

  it('locks shorten mode to a narrower output without adding new events', () => {
    const instruction = buildParagraphPolishInstruction({
      mode: 'shorten',
      rawText: 'Một đoạn văn dài cần cắt gọn nhưng vẫn giữ ý chính.',
    });

    expect(instruction).toContain('Intent: Shorten and tighten');
    expect(instruction).toContain('Make it about 20-35% shorter');
    expect(instruction).toContain('Do not add new events');
  });

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

  it('adds chunk metadata when polishing a long chapter in multiple parts', () => {
    const instruction = buildNovelPolishInstruction({
      mode: 'comprehensive',
      rawText: 'Đoạn mở đầu của chương.',
      chunkIndex: 2,
      chunkCount: 4,
    });

    expect(instruction).toContain('phần 2/4');
    expect(instruction).toContain('giữ continuity');
  });

  it('builds a whole-story source while skipping empty chapters', () => {
    const storySource = buildNovelPolishStorySource([
      {
        id: 'ch-1',
        title: 'Mở màn',
        content: 'Bình minh phủ lên bến cảng.',
        sequenceNumber: 1,
      },
      {
        id: 'ch-2',
        title: 'Chương trống',
        content: '   ',
        sequenceNumber: 2,
      },
      {
        id: 'ch-3',
        title: '',
        content: 'Đêm xuống rất chậm.',
        sequenceNumber: 3,
      },
    ]);

    expect(storySource.chapters).toEqual([
      {
        chapterId: 'ch-1',
        heading: 'Chương 1: Mở màn',
        rawText: 'Bình minh phủ lên bến cảng.',
      },
      {
        chapterId: 'ch-3',
        heading: 'Chương 3',
        rawText: 'Đêm xuống rất chậm.',
      },
    ]);
    expect(storySource.rawText).toContain('Chương 1: Mở màn');
    expect(storySource.rawText).toContain('Chương 3');
    expect(storySource.rawText).not.toContain('Chương trống');
  });

  it('splits long raw text into token-safe chunks without dropping content', () => {
    const rawText = Array.from({ length: 6 }, (_, index) =>
      `Đoạn ${index + 1}: ${'mưa bụi giăng đầy lối cũ '.repeat(90)}`.trim(),
    ).join('\n\n');

    const chunks = splitNovelPolishRawText(rawText, 700);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => estimateTokens(chunk) <= 700)).toBe(true);
    expect(chunks.join('\n\n')).toContain('Đoạn 1:');
    expect(chunks.join('\n\n')).toContain('Đoạn 6:');
  });

  it('classifies refusal-like responses as polish failures', () => {
    expect(isNovelPolishFailureResponse('Không thể thực hiện nhiệm vụ trau chuốt toàn diện theo yêu cầu đề ra.')).toBe(true);
    expect(isNovelPolishFailureResponse('Tôi không thể hỗ trợ yêu cầu này.')).toBe(true);
  });

  it('does not mark valid review output as a polish failure', () => {
    expect(isNovelPolishFailureResponse('Không phát hiện lỗi chính tả đáng kể, nhưng đoạn hai còn hơi lặp nhịp.')).toBe(false);
    expect(isNovelPolishFailureResponse('Gió tuyết của Bắc Vực vẫn còn vương trên vạt áo bào đen...')).toBe(false);
  });
});
