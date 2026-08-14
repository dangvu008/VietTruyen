import { describe, expect, it } from 'vitest';
import { filterWriterSafeTemplateGuidance } from './writer_template_policy';

describe('writer template policy', () => {
  it('keeps register, arc intent and critical red-lines while removing reviewer-only checklist signals', () => {
    const full = [
      '[GENRE TEMPLATE: Test]',
      'USP: power fantasy with reversals',
      '[ERA / REGISTER: cổ phong]',
      'Lời kể: ngôi ba tiết chế',
      'Tránh từ lạc bối cảnh: app, CEO',
      'Xưng hô ưu tiên: ta, ngươi',
      '[ARC: Ch.1-20]',
      'Focus: sống sót',
      'Conflict: truy sát',
      'Growth: học cách tin đồng đội',
      'Sảng điểm khả dụng: phản sát, đoạt bảo',
      'Nhịp triển khai gợi ý: bị ép → phản công → payoff',
      'NÊN: mỗi chương phải có một điểm sảng',
      'Constraint packs: hook-every-chapter, reversal',
      '⛔ TRÁNH: phá hệ thống tu luyện',
    ].join('\n');

    const writer = filterWriterSafeTemplateGuidance(full);

    expect(writer).toContain('[ERA / REGISTER: cổ phong]');
    expect(writer).toContain('Focus: sống sót');
    expect(writer).toContain('Conflict: truy sát');
    expect(writer).toContain('Growth: học cách tin đồng đội');
    expect(writer).toContain('⛔ TRÁNH: phá hệ thống tu luyện');

    expect(writer).not.toContain('USP:');
    expect(writer).not.toContain('Sảng điểm khả dụng:');
    expect(writer).not.toContain('Nhịp triển khai gợi ý:');
    expect(writer).not.toContain('NÊN:');
    expect(writer).not.toContain('Constraint packs:');
  });

  it('is stable for empty guidance', () => {
    expect(filterWriterSafeTemplateGuidance('')).toBe('');
  });
});
