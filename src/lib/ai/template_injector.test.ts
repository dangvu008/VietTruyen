import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTemplateStore } = vi.hoisted(() => {
  let customTemplates: any[] = [];

  return {
    mockTemplateStore: {
      getState: () => ({ customTemplates }),
      setState: (next: { customTemplates: any[] }) => {
        customTemplates = next.customTemplates;
      },
    },
  };
});

vi.mock('../../store/use_template_store', () => ({
  useTemplateStore: mockTemplateStore,
}));

import {
  injectTemplateToFrameworkPrompt,
  injectTemplateToWriterPrompt,
} from './template_injector';

describe('template_injector', () => {
  beforeEach(() => {
    mockTemplateStore.setState({ customTemplates: [] });
  });

  it('adds ancient register guidance and warns against modern vocabulary for ancient genres', () => {
    const prompt = injectTemplateToWriterPrompt('Cổ đại ngôn tình', [], 0);

    expect(prompt).toContain('[GENRE TEMPLATE: Cổ Đại Ngôn Tình]');
    expect(prompt).toContain('[ERA / REGISTER: cổ đại / lịch sử / cung trạch]');
    expect(prompt).toContain('Tránh từ lạc bối cảnh:');
    expect(prompt).toContain('Xưng hô ưu tiên:');
    expect(prompt).toContain('Xưng hô cấm/hạn chế:');
    expect(prompt).toContain('tôi');
    expect(prompt).toContain('thành phố');
    expect(prompt).toContain('Giang Nam');
    expect(prompt).toContain('giữ khoảng cách, thị uy, hoặc đối đầu');
  });

  it('selects the matching arc from regenerated converted templates by chapter range', () => {
    const prompt = injectTemplateToWriterPrompt('Cổ đại ngôn tình', [], 150);

    expect(prompt).toContain('[ARC: 卷二：步步为营 (81-180章, 25%)]');
    expect(prompt).not.toContain('[ARC: 卷一：初入深宫/大宅 (1-80章, 20%)]');
  });

  it('adds modern register guidance for urban genres during framework generation', () => {
    const prompt = injectTemplateToFrameworkPrompt('Đô thị ngôn tình', ['romance']);

    expect(prompt).toContain('REGISTER NGÔN NGỮ');
    expect(prompt).toContain('Bối cảnh ưu tiên: hiện đại / đô thị');
    expect(prompt).toContain('Từ vựng ưu tiên: thành phố');
    expect(prompt).toContain('Từ/cụm nên tránh: kinh thành');
    expect(prompt).toContain('Xưng hô ưu tiên:');
    expect(prompt).toContain('tôi');
    expect(prompt).toContain('anh');
  });

  it('injects opportunity arc, best practices, and constraint packs into framework prompts', () => {
    const prompt = injectTemplateToFrameworkPrompt('Tiên hiệp', []);

    expect(prompt).toContain('🧭 Nhịp triển khai / opportunity arc:');
    expect(prompt).toContain('1. Tin đồn');
    expect(prompt).toContain('✅ Thực hành tốt:');
    expect(prompt).toContain('🧩 Constraint packs: Pack M01, Pack M02, Pack U03');
  });

  it('uses regenerated genre data instead of empty fallback slices for cthulhu templates', () => {
    const prompt = injectTemplateToFrameworkPrompt('Cthulhu', ['lovecraft']);

    expect(prompt).toContain('调查档案流');
    expect(prompt).toContain('真相层级');
    expect(prompt).toContain('规则破译');
    expect(prompt).toContain('Pack M21, Pack U04');
  });

  it('prefers explicit template pronoun rules over generic fallback inference', () => {
    mockTemplateStore.setState({
      customTemplates: [
        {
          id: 'custom-ancient',
          name: 'Custom Cổ Phong',
          coreSellingPoint: 'Cổ phong bi kịch.',
          tags: ['ancient', 'custom'],
          subGenres: [],
          worldRules: [],
          coolPatterns: [],
          conflictPatterns: [],
          outlineArcs: [],
          pitfalls: [],
          bestPractices: [],
          entityTags: [],
          languageRegister: {
            eraLabel: 'cổ phong đặc chế',
            narrationStyle: 'ngôi ba trang trọng, tránh khẩu ngữ hiện đại',
            hanVietDensity: 'dense',
            hanVietGuidance: 'Dùng Hán Việt đậm, ưu tiên danh xưng phong kiến.',
            dictionGuidance: 'Kẻ thù nói thẳng, thân mật nói kín ý.',
            preferredTerms: ['phủ', 'trấn'],
            avoidTerms: ['thành phố'],
            preferredPronouns: ['ta', 'ngươi', 'thiếp', 'chàng'],
            forbiddenPronouns: ['tôi', 'anh', 'em'],
            dialogueRules: [
              {
                context: 'đối đầu với kẻ thù',
                preferredPairs: ['ta - ngươi'],
                forbiddenPairs: ['tôi - anh'],
                note: 'Không mềm giọng hay dùng cặp thân mật.',
              },
            ],
          },
        },
      ],
    });

    const prompt = injectTemplateToWriterPrompt('custom', ['ancient'], 0);

    expect(prompt).toContain('[ERA / REGISTER: cổ phong đặc chế]');
    expect(prompt).toContain('Xưng hô ưu tiên: ta, ngươi, thiếp, chàng');
    expect(prompt).toContain('Xưng hô cấm/hạn chế: tôi, anh, em');
    expect(prompt).toContain('đối đầu với kẻ thù');
    expect(prompt).toContain('ta - ngươi');
  });

  it('does not imply ta-nguoi is exclusive to enemies in ancient fallback guidance', () => {
    const prompt = injectTemplateToWriterPrompt('Tiên hiệp', [], 0);

    expect(prompt).toContain('giữ khoảng cách, thị uy, hoặc đối đầu');
    expect(prompt).toContain('không chỉ là thù địch');
  });
});
