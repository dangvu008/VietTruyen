import { describe, expect, it } from 'vitest';

import type { BrainstormResult } from '../../types/narrative_memory';
import { deriveCreationTargetChapterCount, estimateCreationCost } from './creation_cost_estimator';

const BRAINSTORM_MODEL = {
  modelId: 'gemini-2.0-flash',
  modelName: 'Gemini 2.0 Flash',
};

const PLAN_MODEL = {
  modelId: 'gemini-2.5-pro-preview-06-05',
  modelName: 'Gemini 2.5 Pro',
};

const WRITE_MODEL = {
  modelId: 'anthropic/claude-sonnet-4',
  modelName: 'Claude Sonnet 4',
};

const SUMMARIZE_MODEL = {
  modelId: 'openai/gpt-4o-mini',
  modelName: 'GPT-4o Mini',
};

function buildFramework(): BrainstormResult {
  return {
    bible: {
      genre: 'Tiên hiệp',
      subGenre: ['xuyên không'],
      writingStyle: 'Nhịp nhanh',
      title: 'Thiên Cơ Sai Lệch',
      logline: 'Một kỹ sư dữ liệu xuyên vào giới tu tiên.',
      endgame: 'Lật lại luật thiên cơ.',
      mainCharacterCount: 2,
      supportCharacterCount: 4,
      characterSetup: 'Một người tỉnh táo giữa thế giới hỗn loạn.',
      worldSetting: 'Thế giới tu luyện bị một hệ thống cổ đại kiểm soát.',
      mainPlot: 'Từ sinh tồn cá nhân thành chiến tranh quy tắc.',
    },
    characters: [
      {
        name: 'Lâm Vũ',
        role: 'Main',
        traits: 'Bình tĩnh, lý trí',
        arc: 'Từ sống sót thành người sửa luật chơi',
        currentStage: 'Khởi đầu',
      },
    ],
    world: {
      geography: 'Tam giới tách tầng',
      magicSystem: 'Thiên cơ vận hành như một runtime',
      techLevel: 'Tiên hiệp',
      currency: 'Linh thạch',
      factions: ['Thiên Cung', 'Tà Hội'],
      rules: 'Mỗi lần đột phá đều phải trả giá.',
    },
    outline: Array.from({ length: 5 }, (_, index) => ({
      title: `Arc ${index + 1}`,
      summary: `Tóm tắt arc ${index + 1}`,
      focus: 'Lâm Vũ',
    })),
    chapterSkeleton: Array.from({ length: 10 }, (_, index) => ({
      title: `Chương ${index + 1}`,
      summary: `Tóm tắt chương ${index + 1}`,
      keyEvents: ['Sự kiện A', 'Sự kiện B'],
      entityRefs: ['Lâm Vũ'],
    })),
    foreshadowings: [{ description: 'Thiên cơ đang nói dối.' }],
  };
}

describe('estimateCreationCost', () => {
  it('estimates setup plus whole-story budget before the first AI call', () => {
    const result = estimateCreationCost({
      phase: 'describe',
      originalIdea: 'Một kỹ sư dữ liệu xuyên vào thế giới tu tiên.',
      answers: {},
      currentTopicIndex: 0,
      chatHistory: [],
      plotPreview: null,
      framework: null,
      acceptedChapterCount: 0,
      brainstormModel: BRAINSTORM_MODEL,
      planModel: PLAN_MODEL,
      writeModel: WRITE_MODEL,
      summarizeModel: SUMMARIZE_MODEL,
    });

    expect(result.remainingDiscussTurns).toBe(6);
    expect(result.targetChapterCount).toBe(60);
    expect(result.setupInputTokens).toBeGreaterThan(0);
    expect(result.fullStoryInputTokens).toBeGreaterThan(result.setupInputTokens);
    expect(result.tasks.some((task) => task.id === 'story_pipeline')).toBe(true);
  });

  it('derives whole-story target chapters from the framework arc count', () => {
    expect(deriveCreationTargetChapterCount(buildFramework(), 0)).toBe(60);
  });

  it('uses pipeline history to scale remaining chapter estimate in compose phase', () => {
    const result = estimateCreationCost({
      phase: 'compose',
      originalIdea: 'Một kỹ sư dữ liệu xuyên vào thế giới tu tiên.',
      answers: {
        conflict: 'Chống lại hệ thống cổ đại',
      },
      currentTopicIndex: 4,
      chatHistory: [],
      plotPreview: null,
      framework: buildFramework(),
      acceptedChapterCount: 2,
      brainstormModel: BRAINSTORM_MODEL,
      planModel: PLAN_MODEL,
      writeModel: WRITE_MODEL,
      summarizeModel: SUMMARIZE_MODEL,
      avgTokensPerPipeline: 24000,
    });

    expect(result.setupInputTokens).toBe(0);
    expect(result.remainingChapterCount).toBe(58);
    expect(result.chapterPipelineSource).toBe('history');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe('story_pipeline');
  });
});
