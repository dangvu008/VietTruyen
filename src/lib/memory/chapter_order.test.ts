import { describe, expect, it } from 'vitest';
import { ensureChapterSequenceNumbers, extractSequenceNumberFromTitle } from './chapter_order';

describe('chapter_order', () => {
  it('parses chapter number from title', () => {
    expect(extractSequenceNumberFromTitle('Chương 108 - Mưa máu')).toBe(108);
    expect(extractSequenceNumberFromTitle('Chapter 12')).toBe(12);
  });

  it('falls back to newest-first array order when titles are not parseable', () => {
    const chapters = ensureChapterSequenceNumbers([
      {
        id: 'ch_newest',
        title: 'Đêm trước biến cố',
        content: '',
        status: 'draft',
        createdAt: '2026-01-03',
        updatedAt: '2026-01-03',
      },
      {
        id: 'ch_oldest',
        title: 'Khởi đầu',
        content: '',
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);

    expect(chapters[0].sequenceNumber).toBe(2);
    expect(chapters[1].sequenceNumber).toBe(1);
  });
});
