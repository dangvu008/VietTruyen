import { describe, expect, it } from 'vitest';
import { normalizeLiteparsePdfResponse } from './parse_pdf_liteparse_tauri';

describe('parse_pdf_liteparse_tauri', () => {
  it('normalizes liteparse metadata into ParsedDocument shape', () => {
    expect(
      normalizeLiteparsePdfResponse({
        text: '  Chuong 1\nNoi dung  ',
        pageCount: 2,
        metadata: {
          transport: 'stdin',
          ocr: 'disabled',
        },
      })
    ).toEqual({
      text: 'Chuong 1\nNoi dung',
      pageCount: 2,
      metadata: {
        engine: 'liteparse',
        runtime: 'tauri',
        transport: 'stdin',
        ocr: 'disabled',
      },
    });
  });

  it('rejects empty liteparse output', () => {
    expect(() => normalizeLiteparsePdfResponse({ text: '   ' })).toThrow(
      'LiteParse trả về tài liệu rỗng.'
    );
  });
});
