import { describe, expect, it } from 'vitest';
import { ensureChapterSequenceNumbers, extractSequenceNumberFromTitle } from './chapter_order';

describe('chapter_order', () => {
  it('parses chapter number from title', () => {
    expect(extractSequenceNumberFromTitle('Chương 108 - Mưa máu')).toBe(108);
    expect(extractSequenceNumberFromTitle('Chapter 12')).toBe(12);
  });

  it('preserves existing array order when titles are not parseable', () => {
    const chapters = ensureChapterSequenceNumbers([
      {
        id: 'ch_first',
        title: 'Mở màn',
        content: '',
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'ch_second',
        title: 'Biến cố',
        content: '',
        status: 'draft',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ]);

    expect(chapters[0].sequenceNumber).toBe(1);
    expect(chapters[1].sequenceNumber).toBe(2);
  });

  it('preserves array order when parsed chapter numbers are duplicated', () => {
    const chapters = ensureChapterSequenceNumbers([
      {
        id: 'draft-1',
        title: 'Chương 1: Hồ Nữ',
        content: '',
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'full-1',
        title: 'Chương 1: Hồ Nữ',
        content: 'Nội dung',
        status: 'revised',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ]);

    expect(chapters[0].sequenceNumber).toBe(1);
    expect(chapters[1].sequenceNumber).toBe(2);
  });
});
