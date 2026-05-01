import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getProjectRules,
  buildSurpriseContext,
  buildWritingContext,
  getModelForTask,
  callAiModelTracked,
  useAiStoreGetState,
} = vi.hoisted(() => ({
  getProjectRules: vi.fn(),
  buildSurpriseContext: vi.fn(),
  buildWritingContext: vi.fn(),
  getModelForTask: vi.fn(),
  callAiModelTracked: vi.fn(),
  useAiStoreGetState: vi.fn(),
}));

vi.mock('../../db/narrative_db', () => ({
  getProjectRules,
}));

vi.mock('./context_builder', () => ({
  buildSurpriseContext,
  buildWritingContext,
}));

vi.mock('./model_router', () => ({
  getModelForTask,
}));

vi.mock('./tracked_ai_client', () => ({
  callAiModelTracked,
}));

vi.mock('./streaming_ai_client', () => ({
  callAiStreaming: vi.fn(),
}));

vi.mock('../../store/use_ai_store', () => ({
  useAiStore: {
    getState: useAiStoreGetState,
  },
}));

vi.mock('./surprise_engine', async () => {
  const actual = await vi.importActual<typeof import('./surprise_engine')>('./surprise_engine');
  return {
    ...actual,
    extractAnchors: vi.fn(() => ({
      endgame: [],
      characterTruth: [],
      establishedFact: [],
      foreshadowingPlanted: [],
      all: [],
    })),
    detectExpectation: vi.fn(() => ({
      dominantExpectation: '',
      alternativeExpectations: [],
      setupSignals: [],
      confidence: 0.8,
    })),
    validateDivergence: vi.fn(() => ({
      score: 0,
      issues: [],
      preservedAnchorIds: [],
    })),
  };
});

import { parsePlannerResponse, parseWriterResponse, writeChapterFromBranch } from './chapter_writer_ai';
import type { Project, AiModel } from '../../types/story';
import type { SurpriseBranch } from '../../types/surprise';

function makeProject(): Project {
  return {
    id: 'project-writer',
    title: 'Thiên Mệnh',
    logline: 'Một thiếu niên bước vào cấm địa.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 20,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    mainPlot: 'Lâm Tề phải sống sót trong cấm địa.',
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
    outline: [
      { id: 'beat-1', title: 'Tiến vào cấm địa', summary: 'Lâm Tề bước qua cổng đá.', focus: 'Lâm Tề' },
    ],
    chapters: [],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

const MODEL: AiModel = {
  id: 'model-1',
  name: 'Balanced',
  provider: 'openai',
  modelId: 'gpt-test',
  description: '',
  isCustom: false,
  tier: 'balanced',
};

const BRANCH: SurpriseBranch = {
  id: 'branch-1',
  suggestedTitle: 'Cổng đá mở hé',
  tensionLevel: 'nudge',
  summary: 'Lâm Tề chạm vào cổng đá và nhận ra có thứ gì đó đang dò xét hắn.',
  surpriseVector: 'Áp lực vô hình',
  beatStrategy: 'follow',
  preservedAnchorIds: [],
  challengedExpectation: '',
  foreshadowNow: [],
  impactTrace: [],
  riskScore: 4,
};

describe('chapter_writer_ai parsers', () => {
  beforeEach(() => {
    getProjectRules.mockReset();
    buildSurpriseContext.mockReset();
    buildWritingContext.mockReset();
    getModelForTask.mockReset();
    callAiModelTracked.mockReset();
    useAiStoreGetState.mockReset();

    getProjectRules.mockResolvedValue([]);
    buildSurpriseContext.mockResolvedValue({
      contextText: '## SURPRISE CONTEXT\nÁp lực từ cổng đá cổ dồn lên vai Lâm Tề.',
      tokenEstimate: 120,
      rawTokenEstimate: 140,
      reducedTokenCount: 20,
      reductionPercent: 14,
      sections: [],
      validationPass: true,
      warnings: [],
    });
    buildWritingContext.mockResolvedValue({
      contextText: '## BẢN ĐỒ TÂM LÝ CẢNH\n- Muốn: sống sót\n\n## KẾ HOẠCH CẢNH GHOSTWRITER\n- Mục tiêu cảnh: giữ áp lực\n\n## RÀNG BUỘC GIỌNG VĂN\n- Cấm cụm dễ lộ giọng AI: tuy nhiên',
      tokenEstimate: 100,
      rawTokenEstimate: 120,
      reducedTokenCount: 20,
      reductionPercent: 16,
      sections: [],
      validationPass: true,
      warnings: [],
    });
    getModelForTask.mockReturnValue(MODEL);
    useAiStoreGetState.mockReturnValue({
      models: [MODEL],
      activeModelId: MODEL.id,
      taskModelOverrides: {},
    });
    callAiModelTracked.mockResolvedValue(`@@LEDGER@@
{"summary":"Lâm Tề bước qua cổng đá.","beatStatus":"hit","usedCharacterNames":["Lâm Tề"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
@@CONTENT@@
Lâm Tề bước qua cổng đá.`);
  });

  it('parses planner JSON wrapped in code fences and filters invalid anchor ids', () => {
    const response = `\`\`\`json
    {
      "branches": [
        {
          "id": "branch_1",
          "suggestedTitle": "Nhánh 1",
          "summary": "Tóm tắt 1",
          "surpriseVector": "Bất ngờ 1",
          "beatStrategy": "follow",
          "preservedAnchorIds": ["anchor:3:a1", "invalid"],
          "challengedExpectation": "Kỳ vọng 1",
          "foreshadowNow": ["Clue 1"],
          "impactTrace": ["Hệ quả 1"],
          "riskScore": 2
        },
        {
          "id": "branch_2",
          "suggestedTitle": "Nhánh 2",
          "summary": "Tóm tắt 2",
          "surpriseVector": "Bất ngờ 2",
          "beatStrategy": "delay",
          "preservedAnchorIds": ["anchor:2:a2"],
          "challengedExpectation": "Kỳ vọng 2",
          "foreshadowNow": ["Clue 2"],
          "impactTrace": ["Hệ quả 2"],
          "riskScore": 4
        },
        {
          "id": "branch_3",
          "suggestedTitle": "Nhánh 3",
          "summary": "Tóm tắt 3",
          "surpriseVector": "Bất ngờ 3",
          "beatStrategy": "replace",
          "preservedAnchorIds": ["anchor:1:a3"],
          "challengedExpectation": "Kỳ vọng 3",
          "foreshadowNow": ["Clue 3"],
          "impactTrace": ["Hệ quả 3"],
          "riskScore": 12
        }
      ]
    }
    \`\`\``;

    const branches = parsePlannerResponse(response, 'nudge', ['anchor:3:a1', 'anchor:2:a2', 'anchor:1:a3']);
    expect(branches).toHaveLength(3);
    expect(branches[0].preservedAnchorIds).toEqual(['anchor:3:a1']);
    expect(branches[2].riskScore).toBe(10);
  });

  it('parses writer output with sentinel contract into ledger and content', () => {
    const response = `@@LEDGER@@
{"summary":"Lâm Tề thử máu giả để dò phong ấn.","beatStatus":"delay","usedCharacterNames":["Lâm Tề"],"introducedEntities":[],"foreshadowPlanted":["Vết nứt xanh trên cổng"],"preservedAnchorIds":["anchor:3:a1"]}
@@CONTENT@@
Lâm Tề lấy ra giọt máu giả, để nó rơi lên cổng đá.

Phong ấn không mở, nhưng một đường nứt xanh nhạt hiện lên rồi biến mất.`;

    const parsed = parseWriterResponse(response);
    expect(parsed.ledger.summary).toContain('Lâm Tề');
    expect(parsed.ledger.beatStatus).toBe('delay');
    expect(parsed.content).toContain('Phong ấn không mở');
  });

  it('parses writer output when ledger JSON spans multiple lines', () => {
    const response = `@@LEDGER@@
{
  "summary": "Lâm Tề đối mặt mật thất.",
  "beatStatus": "hit",
  "usedCharacterNames": ["Lâm Tề"],
  "introducedEntities": [],
  "foreshadowPlanted": [],
  "preservedAnchorIds": ["anchor:1:a1"]
}
@@CONTENT@@
Lâm Tề đứng trước mật thất, nghe tiếng đá cũ rạn ra trong bóng tối.`;

    const parsed = parseWriterResponse(response);

    expect(parsed.ledger.summary).toBe('Lâm Tề đối mặt mật thất.');
    expect(parsed.ledger.beatStatus).toBe('hit');
    expect(parsed.content).toContain('mật thất');
  });

  it('injects ghostwriter runtime context into the actual chapter-writing prompt', async () => {
    await writeChapterFromBranch({
      project: makeProject(),
      targetChapterIndex: 0,
      mode: 'create',
      tensionLevel: 'nudge',
      branch: BRANCH,
    });

    expect(buildWritingContext).toHaveBeenCalled();
    expect(callAiModelTracked).toHaveBeenCalledWith(expect.objectContaining({
      userPrompt: expect.stringContaining('## GHOSTWRITER RUNTIME CONTEXT'),
    }));
    const prompt = callAiModelTracked.mock.calls[0][0].userPrompt as string;
    expect(prompt).toContain('## BẢN ĐỒ TÂM LÝ CẢNH');
    expect(prompt).toContain('## KẾ HOẠCH CẢNH GHOSTWRITER');
    expect(prompt).toContain('## RÀNG BUỘC GIỌNG VĂN');
  });
});
