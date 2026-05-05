import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  TEMPLATE_META,
  buildTemplateData,
  generateTemplate,
} from './convert_templates';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MD_DIR = path.resolve(__dirname, '../src/data/genre_templates');

type ConflictPattern = {
  type: string;
  source: string;
  resolution: string;
};

type TemplateDraft = {
  conflictPatterns: ConflictPattern[];
  outlineArcs: Array<{ title: string; chapterRange: string }>;
  targetChapterCount?: number;
  languageRegister?: { eraLabel: string };
};

const DEGRADED_TEMPLATE_FILES = [
  '历史脑洞.md',
  '古言.md',
  '豪门总裁.md',
  '克苏鲁.md',
  '黑暗题材.md',
  '电竞.md',
  '幻想言情.md',
  '女频悬疑.md',
  '多子多福.md',
  '直播文.md',
  '现实题材.md',
  '民国言情.md',
  '知乎短篇.md',
  '替身文.md',
  '悬疑灵异.md',
  '系统流.md',
  '都市异能.md',
] as const;

function readMarkdown(filename: string): string {
  return fs.readFileSync(path.join(MD_DIR, filename), 'utf-8');
}

function getTemplateMeta(filename: string) {
  const meta = TEMPLATE_META[filename];
  if (!meta) {
    throw new Error(`Missing TEMPLATE_META for ${filename}`);
  }

  return meta;
}

function buildDraft(
  filename: string,
  preservedFields: Record<string, unknown> = {},
): TemplateDraft {
  return buildTemplateData(
    filename,
    readMarkdown(filename),
    getTemplateMeta(filename),
    preservedFields,
  ) as TemplateDraft;
}

describe('convert_templates conflict parser', () => {
  it('parses explicit conflict tables for ceo romance templates', () => {
    expect(buildDraft('豪门总裁.md').conflictPatterns).toMatchInlineSnapshot(`
      [
        {
          "resolution": "证明自己",
          "source": "门不当户不对",
          "type": "身份差距",
        },
        {
          "resolution": "打破契约",
          "source": "不能动真心",
          "type": "契约束缚",
        },
        {
          "resolution": "独立自强",
          "source": "不想被施舍",
          "type": "自尊",
        },
        {
          "resolution": "获得认可",
          "source": "长辈",
          "type": "家族反对",
        },
        {
          "resolution": "坚定选择",
          "source": "前任/追求者",
          "type": "情敌",
        },
        {
          "resolution": "共同面对",
          "source": "公司",
          "type": "商业危机",
        },
        {
          "resolution": "真相大白",
          "source": "过去",
          "type": "身世秘密",
        },
      ]
    `);
  });

  it('falls back to cool-pattern conflicts for cthulhu templates with no dedicated conflict section', () => {
    expect(buildDraft('克苏鲁.md').conflictPatterns).toMatchInlineSnapshot(`
      [
        {
          "resolution": "规则必须前后自洽，可验证",
          "source": "密室/遗迹/仪式文本无法理解",
          "type": "规则破译",
        },
        {
          "resolution": "代价必须真实落地到后续剧情",
          "source": "无法“无伤通关”",
          "type": "代价取胜",
        },
        {
          "resolution": "反转不靠“突然告知”，靠线索回收",
          "source": "看似结案，实则只是更深层入口",
          "type": "假真相反转",
        },
        {
          "resolution": "情绪锚点要提前埋设",
          "source": "主角濒临崩溃",
          "type": "理智守线",
        },
      ]
    `);
  });

  it('extracts staged conflict labels from urban superpower templates', () => {
    const conflictPatterns = buildDraft('都市异能.md').conflictPatterns;

    expect(conflictPatterns).toHaveLength(3);
    expect(conflictPatterns.map((pattern) => pattern.type)).toEqual([
      '隐秘期 (The Hidden Era)',
      '爆发期 (The Outbreak Era)',
      '新秩序期 (The New Order)',
    ]);
    expect(conflictPatterns[0].source).toContain('隐藏身份');
    expect(conflictPatterns[1].source).toContain('势力洗牌');
    expect(conflictPatterns[2].source).toContain('种族战争');
  });
});

describe('convert_templates integrity', () => {
  it.each(DEGRADED_TEMPLATE_FILES)(
    'builds non-empty conflict patterns for %s',
    (filename) => {
      const draft = buildDraft(filename);

      expect(draft.conflictPatterns.length).toBeGreaterThan(0);
      expect(draft.outlineArcs.length).toBeGreaterThan(0);
    },
  );

  it('keeps preserved manual fields when regenerating template source', () => {
    const source = generateTemplate(
      '克苏鲁.md',
      readMarkdown('克苏鲁.md'),
      getTemplateMeta('克苏鲁.md'),
      {
        languageRegister: {
          eraLabel: 'custom-register',
        },
      },
    );

    expect(source).toContain('"eraLabel": "custom-register"');
  });

  it('keeps chapter count derivation intact for outline-driven templates', () => {
    const draft = buildDraft('电竞.md');

    expect(draft.targetChapterCount).toBe(700);
    expect(draft.outlineArcs[0].chapterRange).toBe('1-80');
  });
});
