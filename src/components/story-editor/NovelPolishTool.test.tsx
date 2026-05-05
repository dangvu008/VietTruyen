import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  NovelPolishTool,
  resolveNovelPolishRunText,
} from './NovelPolishTool';

describe('NovelPolishTool', () => {
  it('keeps long chapter source out of the visible panel while preserving run text resolution', () => {
    const chapterText = `Mở đầu chương. ${'Một đoạn văn rất dài cần review. '.repeat(80)}Kết thúc chương.`;

    const html = renderToStaticMarkup(
      <NovelPolishTool
        chapterSourceText={chapterText}
        disabled={false}
        runLabel="Chạy review"
        onRun={vi.fn()}
      />,
    );

    expect(html).toContain('Nguồn đã chọn: Toàn chương');
    expect(html).toContain('ký tự');
    expect(html).toContain('Chạy review');
    expect(html).not.toContain('Mở đầu chương.');
    expect(html).not.toContain('Kết thúc chương.');

    expect(resolveNovelPolishRunText({
      sourceScope: 'chapter',
      customText: '',
      chapterSourceText: chapterText,
    })).toBe(chapterText);
  });

  it('uses manual text only when custom source is selected', () => {
    expect(resolveNovelPolishRunText({
      sourceScope: 'custom',
      customText: 'Dán đoạn riêng.',
      chapterSourceText: 'Nội dung chương.',
    })).toBe('Dán đoạn riêng.');
  });
});
