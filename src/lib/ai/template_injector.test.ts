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

  it('keeps genre-derived register as a non-authoritative proposal', () => {
    const prompt = injectTemplateToWriterPrompt('Cổ đại ngôn tình', [], 0);

    expect(prompt).toContain('[GENRE TEMPLATE: Cổ Đại Ngôn Tình]');
    expect(prompt).toContain('[TEMPLATE REGISTER PROPOSAL: cổ đại / lịch sử / cung trạch]');
    expect(prompt).toContain('Story Setup đã xác nhận');
    expect(prompt).not.toContain('Xưng hô ưu tiên:');
    expect(prompt).not.toContain('cường độ 1–5');
  });

  it('selects the matching arc from regenerated converted templates by chapter range', () => {
    const prompt = injectTemplateToWriterPrompt('Cổ đại ngôn tình', [], 150);

    expect(prompt).toContain('[ARC: 卷二：步步为营 (81-180章, 25%)]');
    expect(prompt).not.toContain('[ARC: 卷一：初入深宫/大宅 (1-80章, 20%)]');
  });

  it('does not let urban genre templates override confirmed setup choices', () => {
    const prompt = injectTemplateToFrameworkPrompt('Đô thị ngôn tình', ['romance']);

    expect(prompt).toContain('GỢI Ý REGISTER TỪ TEMPLATE (KHÔNG AUTHORITATIVE)');
    expect(prompt).toContain('Tham khảo bối cảnh thường gặp: hiện đại / đô thị');
    expect(prompt).toContain('Không dùng để ghi đè WRITING_STYLE hoặc ERA_FRAME');
    expect(prompt).not.toContain('Từ vựng ưu tiên: thành phố');
    expect(prompt).not.toContain('Xưng hô ưu tiên:');
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

    expect(prompt).toContain('[TEMPLATE REGISTER PROPOSAL: cổ phong đặc chế]');
    expect(prompt).toContain('Story Setup đã xác nhận');
    expect(prompt).not.toContain('Xưng hô ưu tiên: ta, ngươi, thiếp, chàng');
    expect(prompt).not.toContain('Xưng hô cấm/hạn chế: tôi, anh, em');
    expect(prompt).not.toContain('ta - ngươi');
  });

  it('does not emit inferred pronoun rules from an ancient genre template', () => {
    const prompt = injectTemplateToWriterPrompt('Tiên hiệp', [], 0);

    expect(prompt).toContain('[TEMPLATE REGISTER PROPOSAL: cổ phong / tiên hiệp / võ hiệp]');
    expect(prompt).not.toContain('ta - ngươi');
    expect(prompt).not.toContain('không chỉ là thù địch');
  });
});
