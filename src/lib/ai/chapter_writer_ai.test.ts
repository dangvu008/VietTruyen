import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getProjectRules,
  buildSurpriseContext,
  buildWritingContext,
  getModelForTask,
  callAiModelTracked,
  callAiStreaming,
  useAiStoreGetState,
  markModelUnavailable,
} = vi.hoisted(() => ({
  getProjectRules: vi.fn(),
  buildSurpriseContext: vi.fn(),
  buildWritingContext: vi.fn(),
  getModelForTask: vi.fn(),
  callAiModelTracked: vi.fn(),
  callAiStreaming: vi.fn(),
  useAiStoreGetState: vi.fn(),
  markModelUnavailable: vi.fn(),
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
  callAiStreaming,
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

import {
  parsePlannerResponse,
  parseWriterResponse,
  resolveChapterWriteTitle,
  writeChapterFromBranch,
} from './chapter_writer_ai';
import { extractWriterVisibleContent } from './writer_response_content';
import type { Project, AiModel } from '../../types/story';
import type { SurpriseBranch } from '../../types/surprise';

function makeProject(): Project {
  return {
    id: 'project-writer',
    title: 'Thiên Mệnh',
    logline: 'Một thiếu niên bước vào cấm địa.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Cổ điển – trầm',
    tone: '',
    styleId: 'style-1',
    narrativeEraRegister: {
      frame: 'period',
      confirmed: true,
      source: 'user',
    },
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
    callAiStreaming.mockReset();
    useAiStoreGetState.mockReset();
    markModelUnavailable.mockReset();

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
      modelHealth: {},
      preferredProvider: undefined,
      markModelUnavailable,
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

  it('keeps prose and removes a trailing ledger block when the model reverses the marker order', () => {
    const response = `Ma Y đứng từ xa, trên một ngọn núi hẻo lánh.

Dưới chân Thiên Dương, bóng của cậu không còn là hình người.

@@LEDGER@@
{"summary":"Thiên Dương nhận ra bản chất của Thiên Hình Ấn.","beatStatus":"hit","usedCharacterNames":["Thiên Dương"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
"""`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Ma Y đứng từ xa, trên một ngọn núi hẻo lánh.\n\nDưới chân Thiên Dương, bóng của cậu không còn là hình người.',
    );

    const parsed = parseWriterResponse(response);
    expect(parsed.content).toContain('Dưới chân Thiên Dương');
    expect(parsed.content).not.toContain('@@LEDGER@@');
    expect(parsed.content).not.toContain('beatStatus');
  });

  it('does not mistake ECOT analysis for prose when content marker is missing', () => {
    const response = `@@ECOT_ANALYSIS@@
Đây là phân tích nội bộ, không phải văn xuôi.
@@LEDGER@@
{"summary":"Lâm Tề vượt qua cổng đá.","beatStatus":"hit","usedCharacterNames":["Lâm Tề"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
Lâm Tề bước qua cổng đá, để mặc hơi lạnh bò dọc sống lưng. Phía sau hắn, tiếng đá khép lại như một lời phán quyết không thể rút về.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Lâm Tề bước qua cổng đá, để mặc hơi lạnh bò dọc sống lưng. Phía sau hắn, tiếng đá khép lại như một lời phán quyết không thể rút về.',
    );
  });

  it('refuses metadata-only writer payloads instead of leaking them into chapter content', () => {
    const response = `@@LEDGER@@
{"summary":"Lâm Tề vượt qua cổng đá.","beatStatus":"hit","usedCharacterNames":["Lâm Tề"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}`;

    expect(() => parseWriterResponse(response)).toThrow(/sentinel contract/i);
  });

  it('extracts only prose when the model returns a serialized chapter JSON object', () => {
    const response = `{"chapter":1,"title":"Linh Gia Cứu Hoang Thần Tố","content":"Sóng xiên thành vách bạc, cuốn từ chân trời trào đến bìa rừng dừa nước. Chiếc thuyền nan buồm dệt lỗ chỗ, trôi lững lờ giữa vùng biển lạ."}`;

    const parsed = parseWriterResponse(response);

    expect(parsed.content).toBe(
      'Sóng xiên thành vách bạc, cuốn từ chân trời trào đến bìa rừng dừa nước. Chiếc thuyền nan buồm dệt lỗ chỗ, trôi lững lờ giữa vùng biển lạ.',
    );
  });

  it('removes trailing quote-brace artifacts from fallback prose', () => {
    const response = 'Lục Phong nhìn la bàn rung lên giữa lòng bàn tay. Cuộc trò chuyện sẽ đến sau."}';

    const parsed = parseWriterResponse(response);

    expect(parsed.content).toBe(
      'Lục Phong nhìn la bàn rung lên giữa lòng bàn tay. Cuộc trò chuyện sẽ đến sau.',
    );
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
      userPrompt: expect.stringContaining('## NGỮ CẢNH VIẾT BỔ SUNG'),
    }));
    const prompt = callAiModelTracked.mock.calls[0][0].userPrompt as string;
    expect(prompt).toContain('## BẢN ĐỒ TÂM LÝ CẢNH');
    expect(prompt).toContain('## KẾ HOẠCH CẢNH GHOSTWRITER');
    expect(prompt).toContain('## RÀNG BUỘC GIỌNG VĂN');
  });

  it('falls back from weak generated chapter titles to outline or chapter number', () => {
    const project = makeProject();

    expect(resolveChapterWriteTitle(project, 0, { ...BRANCH, suggestedTitle: 'Trống' })).toBe('Tiến vào cấm địa');
    expect(resolveChapterWriteTitle({ ...project, outline: [{ ...project.outline[0], title: '' }] }, 0, {
      ...BRANCH,
      suggestedTitle: 'Tên chương',
    })).toBe('Chương 1');
  });

  it('auto-continues an interrupted streaming chapter response before parsing content', async () => {
    callAiStreaming.mockResolvedValue({
      text: `@@LEDGER@@
{"summary":"Lâm Tề mở cổng đá.","beatStatus":"hit","usedCharacterNames":["Lâm Tề"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
@@CONTENT@@
Lâm Tề nâng tay,`,
      completed: false,
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    callAiModelTracked.mockResolvedValue(' để chạm vào khe nứt lạnh buốt trên cổng đá.\n\nTiếng đá thức dậy trong bóng tối.');

    const result = await writeChapterFromBranch({
      project: makeProject(),
      targetChapterIndex: 0,
      mode: 'create',
      tensionLevel: 'nudge',
      branch: BRANCH,
      onChunk: vi.fn(),
    });

    expect(callAiModelTracked).toHaveBeenCalledWith(expect.objectContaining({
      userPrompt: expect.stringContaining('PHẢN HỒI TRƯỚC BỊ CẮT GIỮA CHỪNG'),
    }));
    expect(result.content).toContain('Lâm Tề nâng tay, để chạm vào khe nứt');
  });
});
