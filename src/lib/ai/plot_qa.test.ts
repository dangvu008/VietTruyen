import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiModel, Project } from '../../types/story';

const callAiModelTrackedMock = vi.hoisted(() => vi.fn());
const retrieveForPlotQaMock = vi.hoisted(() => vi.fn());

vi.mock('./tracked_ai_client', () => ({
  callAiModelTracked: callAiModelTrackedMock,
}));

vi.mock('../memory/hybrid_memory_query', () => ({
  retrieveForPlotQa: retrieveForPlotQaMock,
}));

import { answerPlotQuestion } from './plot_qa';

function makeProject(): Project {
  return {
    id: 'project-plot',
    title: 'Thiên Mệnh',
    logline: 'Một thiếu niên bước vào cấm địa.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 30,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: 'Bắc vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: [],
      rules: '',
      facts: [],
    },
    characters: [
      {
        id: 'char-1',
        name: 'Lâm Tề',
        role: 'Chính',
        arc: '',
        currentStage: 'Luyện Khí',
        traits: 'Gan lì',
        aliases: [],
        facts: [],
      },
    ],
    outline: [],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chương 1',
        summary: 'Lâm Tề tiến vào cấm địa.',
        content: 'Sương mù mở ra trước cổng đá cổ.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'chapter-2',
        title: 'Chương 2',
        summary: 'Lâm Tề bộc lộ cảnh giới Trúc Cơ.',
        content: 'Áp lực linh lực dồn nén quanh thân thể hắn.',
        sequenceNumber: 2,
        status: 'draft',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
  };
}

const MODEL: AiModel = {
  id: 'model-1',
  name: 'Balanced',
  provider: 'openrouter',
  modelId: 'openai/gpt-4o-mini',
  description: '',
  isCustom: false,
  tier: 'balanced',
};

describe('plot_qa', () => {
  beforeEach(() => {
    callAiModelTrackedMock.mockReset();
    retrieveForPlotQaMock.mockReset();
  });

  it('answers from local memory retrieval before invoking AI when retrieval has strong signals', async () => {
    retrieveForPlotQaMock.mockResolvedValue({
      canonPack: [{ id: 'canon-1', title: 'Lâm Tề', body: '- Lâm Tề: vai trò=Chính, cảnh giới=Trúc Cơ', score: 1, sourceType: 'canon_fact' }],
      graphPack: [{ id: 'graph-1', title: 'Lâm Tề / Cấm địa', body: '- Trọng tâm: Lâm Tề (character) | Cấm địa (chapter)', score: 1, sourceType: 'community' }],
      semanticPack: [{ id: 'semantic-1', title: 'scene', body: '- [scene] Lâm Tề bộc lộ cảnh giới Trúc Cơ ngay trước cổng đá cổ.', score: 1, sourceType: 'scene' }],
      riskPack: [],
      provenancePack: [],
      warnings: ['Continuity: Không để lộ cảnh giới quá sớm'],
    });

    const result = await answerPlotQuestion({
      project: makeProject(),
      question: 'Lâm Tề hiện tại đã tới cảnh giới nào?',
      model: MODEL,
      apiKey: '__proxy__',
    });

    expect(result.source).toBe('local');
    expect(result.answer).toContain('Trúc Cơ');
    expect(result.answer).toContain('cổng đá cổ');
    expect(callAiModelTrackedMock).not.toHaveBeenCalled();
  });

  it('falls back to AI when neither heuristics nor local retrieval can answer confidently', async () => {
    retrieveForPlotQaMock.mockResolvedValue({
      canonPack: [],
      graphPack: [],
      semanticPack: [],
      riskPack: [],
      provenancePack: [],
      warnings: [],
    });
    callAiModelTrackedMock.mockResolvedValue('AI fallback answer');

    const result = await answerPlotQuestion({
      project: makeProject(),
      question: 'Liệu lời thề ở cấm địa sẽ dẫn đến hậu quả dây chuyền gì?',
      model: MODEL,
      apiKey: '__proxy__',
    });

    expect(result.source).toBe('ai');
    expect(result.answer).toBe('AI fallback answer');
    expect(callAiModelTrackedMock).toHaveBeenCalledTimes(1);
  });
});
