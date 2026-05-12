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

  it('defines quick polish modes first in user-facing order', () => {
    const quickModes = NOVEL_POLISH_MODES.filter((mode) => mode.category === 'quick');
    expect(quickModes.map((mode) => mode.id)).toEqual([
      'comprehensive',
      'find_errors',
      'remove_ai_tone',
      'enhance_details',
      'optimize_dialogue',
    ]);
  });

  it('defines the deep 5-pass modes followed by the critique-then-fix two-agent mode', () => {
    const deepModes = NOVEL_POLISH_MODES.filter((mode) => mode.category === 'deep');
    expect(deepModes.map((mode) => mode.id)).toEqual([
      'anti_ai_tic',
      'metaphor_sanity',
      'consistency_audit',
      'pacing_by_scene_type',
      'lexical_surgery',
      'critique_then_fix',
    ]);
  });

  it('anti_ai_tic mode enforces max 1 occurrence per pattern per chapter', () => {
    const instruction = buildNovelPolishInstruction({
      mode: 'anti_ai_tic',
      rawText: 'Không gợn sóng, không tiếng gió, không cả tiếng thủy thủ. Cây cầu trước mặt.',
    });

    expect(instruction).toContain('không X, không Y, không');
    expect(instruction).toContain('tối đa 1 lần/chương');
    expect(instruction).toContain('Rồi');
    expect(instruction).toContain('Đột nhiên');
    expect(instruction).toContain('BẢO TỒN');
  });

  it('metaphor_sanity mode applies the 3-gate test', () => {
    const instruction = buildNovelPolishInstruction({
      mode: 'metaphor_sanity',
      rawText: 'Mây đen cuộn lại như vết thương đang lành trên da trời.',
    });

    expect(instruction).toContain('3-GATE TEST');
    expect(instruction).toContain('GATE 1 (LOGIC)');
    expect(instruction).toContain('GATE 2 (SETTING)');
    expect(instruction).toContain('GATE 3 (NECESSITY)');
    // The instruction should call out the archetypal dead metaphor.
    expect(instruction).toContain('mây đen cuộn lại như vết thương đang lành');
  });

  it('consistency_audit mode produces a four-section report without rewriting', () => {
    const mode = getNovelPolishMode('consistency_audit');
    const instruction = buildNovelPolishInstruction({
      mode: 'consistency_audit',
      rawText: 'Lục Phong rút tay khỏi vạt áo, mười ngón chân bấm vào ván gỗ.',
    });

    expect(mode.outputKind).toBe('report');
    expect(instruction).toContain('STATE INTRODUCED');
    expect(instruction).toContain('CONTRADICTIONS');
    expect(instruction).toContain('DANGLING DETAILS');
    expect(instruction).toContain('LAZY TRANSITIONS');
    expect(instruction).toContain('TUYỆT ĐỐI KHÔNG rewrite');
  });

  it('pacing_by_scene_type mode encodes explicit per-scene sentence budgets', () => {
    const instruction = buildNovelPolishInstruction({
      mode: 'pacing_by_scene_type',
      rawText: 'Đoàn hạm đội bảy chiếc bổ nhào vào mạn tàu.',
    });

    expect(instruction).toContain('action:');
    expect(instruction).toContain('5–10 chữ');
    expect(instruction).toContain('tension:');
    expect(instruction).toContain('contemplative:');
    expect(instruction).toContain('dialogue:');
    expect(instruction).toContain('20–30 chữ');
  });

  it('lexical_surgery mode flags dubious Han-Viet and era violations as a report', () => {
    const mode = getNovelPolishMode('lexical_surgery');
    const instruction = buildNovelPolishInstruction({
      mode: 'lexical_surgery',
      rawText: 'Ánh nắng tan biệt nơi vực thẳm, mang sức nặng của ngàn năm im tiếng súng.',
    });

    expect(mode.outputKind).toBe('report');
    expect(instruction).toContain('HÁN VIỆT NGHI VẤN');
    expect(instruction).toContain('ERA/CONTEXT VIOLATIONS');
    expect(instruction).toContain('WRONG CONTEXT WORDS');
    expect(instruction).toContain('DEAD METAPHORS');
    expect(instruction).toContain('tiếng súng');
    expect(instruction).toContain('TUYỆT ĐỐI KHÔNG rewrite');
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
