import { describe, expect, it } from 'vitest';
import type { Chapter } from '../../types/story';
import {
  deriveChapterUIStatus,
  getChapterCompletionAction,
  isProbablyInterruptedChapter,
  MIN_COMPLETE_CHAPTER_WORDS,
} from './editor_types';

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'chapter-1',
    title: 'Chương thử nghiệm',
    content: '',
    status: 'draft',
    createdAt: '2026-05-04T00:00:00.000Z',
    updatedAt: '2026-05-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('chapter editor status derivation', () => {
  it('marks explicit partial/failed generation as interrupted', () => {
    expect(
      deriveChapterUIStatus(makeChapter({ generationStatus: 'partial', content: 'Một đoạn đang dở.' }), false, false),
    ).toBe('interrupted');

    expect(
      deriveChapterUIStatus(makeChapter({ generationStatus: 'failed', content: 'Một đoạn lỗi giữa chừng.' }), false, false),
    ).toBe('interrupted');
  });

  it('does not show very short draft content as completed legacy content', () => {
    const shortLegacyChapter = makeChapter({
      content: Array.from({ length: MIN_COMPLETE_CHAPTER_WORDS - 1 }, () => 'chữ').join(' '),
      status: 'revised',
    });

    expect(isProbablyInterruptedChapter(shortLegacyChapter)).toBe(true);
    expect(deriveChapterUIStatus(shortLegacyChapter, false, false)).toBe('interrupted');
  });

  it('allows final and long draft chapters to show normal completion states', () => {
    const finalShortChapter = makeChapter({
      content: 'Đoạn ngắn nhưng đã duyệt.',
      status: 'final',
    });
    const longDraftChapter = makeChapter({
      content: Array.from({ length: MIN_COMPLETE_CHAPTER_WORDS }, () => 'chữ').join(' '),
      status: 'draft',
    });

    expect(deriveChapterUIStatus(finalShortChapter, false, false)).toBe('approved');
    expect(deriveChapterUIStatus(longDraftChapter, false, false)).toBe('edited');
  });

  it('returns a completion action for interrupted chapters based on available content', () => {
    const partialChapter = makeChapter({
      content: 'Đoạn văn bị dừng giữa chừng.',
      generationStatus: 'partial',
    });
    const failedEmptyChapter = makeChapter({
      content: '',
      generationStatus: 'failed',
    });

    expect(getChapterCompletionAction(partialChapter, 'interrupted')).toEqual({
      label: 'Hoàn thiện',
      title: 'AI sẽ viết tiếp từ phần đang dở để hoàn thiện chương.',
      mode: 'continue',
    });

    expect(getChapterCompletionAction(failedEmptyChapter, 'interrupted')).toEqual({
      label: 'Hoàn thiện',
      title: 'AI sẽ dựng lại chương này từ đầu vì nội dung hiện tại không còn usable.',
      mode: 'regenerate',
    });

    expect(getChapterCompletionAction(makeChapter({ content: 'Đủ dài.' }), 'edited')).toBeNull();
  });
});
