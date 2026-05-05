import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombinedReviewReport } from '../../core/checkers/checker_types';
import type { Project } from '../../types/story';
import type { ChapterWriteResult, SurpriseBranch } from '../../types/surprise';

const {
  buildTemporalWritingContext,
  planChapterBranches,
  writeChapterFromBranch,
  runAllCheckers,
  analyzeChapterStyle,
  executePostWritePipeline,
  syncProjectMemoryBridge,
  getProjectRules,
  getModelForTask,
  callAiModelTracked,
  runPreSaveQualityGate,
  buildChapterContentHash,
  recordPipelineSession,
  useAiStoreGetState,
  getActiveNarrativeStateFactsAtChapter,
  getContinuityWarnings,
  getOpenHooksForProject,
} = vi.hoisted(() => ({
  buildTemporalWritingContext: vi.fn(),
  planChapterBranches: vi.fn(),
  writeChapterFromBranch: vi.fn(),
  runAllCheckers: vi.fn(),
  analyzeChapterStyle: vi.fn(),
  executePostWritePipeline: vi.fn(),
  syncProjectMemoryBridge: vi.fn(),
  getProjectRules: vi.fn(),
  getModelForTask: vi.fn(),
  callAiModelTracked: vi.fn(),
  runPreSaveQualityGate: vi.fn(),
  buildChapterContentHash: vi.fn(),
  recordPipelineSession: vi.fn(),
  useAiStoreGetState: vi.fn(),
  getActiveNarrativeStateFactsAtChapter: vi.fn(),
  getContinuityWarnings: vi.fn(),
  getOpenHooksForProject: vi.fn(),
}));

vi.mock('../ai/context_builder', () => ({
  buildTemporalWritingContext,
}));

vi.mock('../ai/chapter_writer_ai', () => ({
  planChapterBranches,
  writeChapterFromBranch,
}));

vi.mock('../../core/checkers/run_all_checkers', () => ({
  runAllCheckers,
}));

vi.mock('../ai/style_analyzer', () => ({
  analyzeChapterStyle,
}));

vi.mock('../memory/memory_extractor', () => ({
  executePostWritePipeline,
}));

vi.mock('../memory/memory_sync_bridge', () => ({
  syncProjectMemoryBridge,
}));

vi.mock('../../db/narrative_db', () => ({
  getProjectRules,
  getActiveNarrativeStateFactsAtChapter,
}));

vi.mock('../memory/memory_query', () => ({
  getContinuityWarnings,
}));

vi.mock('../memory/pending_hooks_repository', () => ({
  getOpenHooksForProject,
}));

vi.mock('../ai/model_router', () => ({
  getModelForTask,
}));

vi.mock('../../store/use_ai_store', () => ({
  useAiStore: {
    getState: useAiStoreGetState,
  },
}));

vi.mock('../ai/tracked_ai_client', () => ({
  callAiModelTracked,
}));

vi.mock('../ai/pre_save_quality_gate', () => ({
  runPreSaveQualityGate,
}));

vi.mock('../memory/memory_indexer', () => ({
  buildChapterContentHash,
}));

vi.mock('../../core/id', () => ({
  createId: vi.fn(() => 'pipeline-session'),
}));

vi.mock('../../store/use_token_store', () => ({
  useTokenStore: {
    getState: () => ({
      recordPipelineSession,
    }),
  },
}));

import { executeFullWritePipeline } from './full_write_pipeline';

const branch: SurpriseBranch = {
  id: 'branch-1',
  suggestedTitle: 'Nháp thử',
  tensionLevel: 'nudge',
  summary: 'Tóm tắt nhánh',
  surpriseVector: 'Leo thang',
  beatStrategy: 'follow',
  preservedAnchorIds: [],
  challengedExpectation: 'Không dễ dàng',
  foreshadowNow: [],
  impactTrace: [],
  riskScore: 4,
};

function makeProject(): Project {
  return {
    id: 'project-pipeline',
    title: 'Pipeline Test',
    logline: '',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 20,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 1,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: '',
      magicSystem: '',
      techLevel: '',
      currency: '',
      factions: [],
      rules: '',
      facts: [],
    },
    characters: [
      {
        id: 'char-1',
        name: 'Lâm Tề',
        role: 'Chính',
        arc: 'Đi lên',
        currentStage: 'Luyện Khí',
        traits: 'Gan lì',
        aliases: [],
        facts: [],
      },
    ],
    outline: [
      { id: 'beat-1', title: 'Mở màn', summary: 'Lâm Tề bước vào hiểm địa', focus: 'Lâm Tề' },
    ],
    chapters: [],
    foreshadowings: [
      {
        id: 'f-1',
        description: 'Tăng viện đến muộn: Đội tiếp viện vẫn chưa xuất hiện',
        isResolved: false,
        createdAt: '2026-01-01',
      },
    ],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function makeWriteResult(content: string, summary: string): ChapterWriteResult {
  return {
    title: 'Nháp thử',
    content,
    ledger: {
      summary,
      beatStatus: 'hit',
      usedCharacterNames: ['Lâm Tề'],
      introducedEntities: [],
      foreshadowPlanted: [],
      preservedAnchorIds: [],
    },
    divergence: {
      level: 'safe',
      score: 90,
      issues: [],
      followUpActions: [],
    },
    selectedBranch: branch,
    contextUsage: {
      rawTokens: 1000,
      cleanTokens: 900,
      reducedTokens: 100,
      reductionPercent: 10,
    },
  };
}

function makeReview(pass: boolean, score: number): CombinedReviewReport {
  return {
    chapterId: 'pipeline-0',
    chapterNumber: 1,
    reports: [
      {
        agent: 'reader_pull',
        chapter: 1,
        overall_score: score,
        pass,
        issues: pass ? [] : [{
          id: 'issue-1',
          severity: 'high',
          description: 'Hook cuối chương còn yếu',
          suggestion: 'Kết bằng lựa chọn sống còn',
        }],
        metrics: {},
        summary: pass ? 'Ổn định.' : 'Cần siết hook và nhịp cuối chương.',
      },
    ],
    combined_score: score,
    pass,
    priority_fixes: pass ? [] : [{
      id: 'issue-1',
      severity: 'high',
      description: 'Hook cuối chương còn yếu',
      suggestion: 'Kết bằng lựa chọn sống còn',
    }],
    suggestedRevisionTasks: pass ? [] : ['1. Hook cuối chương còn yếu -> Kết bằng lựa chọn sống còn'],
    guidedRevisionPrompt: pass ? 'Chương đạt review.' : 'Vá continuity và hook cuối chương.',
    reviewedAt: '2026-01-01',
  };
}

describe('executeFullWritePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    buildTemporalWritingContext.mockResolvedValue({
      contextText: 'context',
      tokenEstimate: 100,
      rawTokenEstimate: 120,
      reducedTokenCount: 20,
      reductionPercent: 16,
      sections: [],
      validationPass: true,
      warnings: [],
    });
    getProjectRules.mockResolvedValue([]);
    getActiveNarrativeStateFactsAtChapter.mockResolvedValue([]);
    getContinuityWarnings.mockResolvedValue([]);
    getOpenHooksForProject.mockResolvedValue([]);
    planChapterBranches.mockResolvedValue({
      anchors: { endgame: [], characterTruth: [], establishedFact: [], foreshadowingPlanted: [], all: [] },
      expectation: { dominantExpectation: '', alternativeExpectations: [], setupSignals: [], confidence: 0.8 },
      branches: [branch],
      recommendedBranchId: branch.id,
    });
    writeChapterFromBranch
      .mockResolvedValueOnce(makeWriteResult('draft-one', 'summary-one'))
      .mockResolvedValueOnce(makeWriteResult('draft-two', 'summary-two'));
    runAllCheckers
      .mockResolvedValueOnce(makeReview(false, 45))
      .mockResolvedValueOnce(makeReview(true, 82));
    analyzeChapterStyle.mockResolvedValue({
      chapterId: 'pipeline-0',
      corrections: [],
      summary: 'Ổn',
      overallScore: 8,
      categoryCounts: {},
    });
    executePostWritePipeline.mockResolvedValue({
      extraction: { metadata: {}, dependencies: [], timelineFacts: [] },
      summary: { chapter_id: 'pipeline-draft-0' },
      scenes: [],
      extractedState: [],
      stateMutations: [],
      summaryTiers: { chapter: '', arc: '', storySoFar: '' },
      embeddingJobs: [],
      activeHooks: [],
      timingReport: { durationMs: 12 },
    });
    syncProjectMemoryBridge.mockResolvedValue(undefined);
    buildChapterContentHash.mockReturnValue('content-hash');
    callAiModelTracked.mockResolvedValue('{}');
    runPreSaveQualityGate.mockImplementation(async ({ chapterContent }: { chapterContent: string }) => ({
      content: `${chapterContent}-presave`,
      report: {
        approved: true,
        originalScore: 72,
        revisedScore: 88,
        issues: [],
        appliedChanges: ['Làm câu chữ tự nhiên hơn trước khi lưu.'],
      },
    }));

    const reviewModel = { id: 'review', name: 'Review Model', provider: 'openai', modelId: 'review-model', isCustom: false, tier: 'quality', description: '' };
    const summarizeModel = { id: 'summary', name: 'Summary Model', provider: 'openai', modelId: 'summary-model', isCustom: false, tier: 'fast', description: '' };
    const memoryModel = { id: 'memory', name: 'Memory Model', provider: 'openai', modelId: 'memory-model', isCustom: false, tier: 'fast', description: '' };

    useAiStoreGetState.mockReturnValue({
      models: [reviewModel, summarizeModel, memoryModel],
      activeModelId: 'auto',
      taskModelOverrides: {},
    });
    getModelForTask.mockImplementation((taskType: string) => {
      if (taskType === 'summarize') return summarizeModel;
      if (taskType === 'extract_metadata') return memoryModel;
      return reviewModel;
    });
  });

  it('retries once from checker feedback and syncs memory with the final draft project snapshot', async () => {
    const project = makeProject();

    const result = await executeFullWritePipeline({
      project,
      targetChapterIndex: 0,
      mode: 'create',
      tensionLevel: 'nudge',
      notes: 'Giữ nhịp nhanh.',
    });

    expect(writeChapterFromBranch).toHaveBeenCalledTimes(2);
    expect(writeChapterFromBranch.mock.calls[1][0]).toEqual(expect.objectContaining({
      notes: expect.stringContaining('Điểm checker hiện tại: 45/100.'),
    }));

    expect(executePostWritePipeline).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai',
      modelId: 'summary-model',
      chapter: expect.objectContaining({
        content: 'draft-two-presave',
        summary: 'summary-two',
        sequenceNumber: 1,
      }),
    }));

    expect(syncProjectMemoryBridge).toHaveBeenCalledWith(
      expect.objectContaining({
        chapters: expect.arrayContaining([
          expect.objectContaining({
            content: 'draft-two-presave',
            summary: 'summary-two',
            sequenceNumber: 1,
          }),
        ]),
      }),
      {
        model: expect.objectContaining({ modelId: 'memory-model' }),
      },
    );

    expect(runAllCheckers).toHaveBeenCalledWith(
      expect.objectContaining({
        activeThreads: expect.arrayContaining(['Tăng viện đến muộn: Đội tiếp viện vẫn chưa xuất hiện']),
        chapterIntent: expect.stringContaining('Mở màn'),
      }),
      expect.any(Function),
    );

    expect(runPreSaveQualityGate).toHaveBeenCalledTimes(2);
    expect(runAllCheckers).toHaveBeenLastCalledWith(
      expect.objectContaining({ chapterText: 'draft-two-presave' }),
      expect.any(Function),
    );
    expect(result.content).toBe('draft-two-presave');
    expect(result.preSaveReport?.revisedScore).toBe(88);
    expect(result.reviewReport?.combined_score).toBe(82);
  });

  it('skips review, polish, data extraction, and memory sync in fast quality mode', async () => {
    const progressEvents: Array<{ step: number; status: string; label: string }> = [];

    const result = await executeFullWritePipeline({
      project: makeProject(),
      targetChapterIndex: 0,
      mode: 'create',
      tensionLevel: 'nudge',
      qualityMode: 'fast',
      onProgress: (progress) => progressEvents.push(progress),
    });

    expect(writeChapterFromBranch).toHaveBeenCalledTimes(1);
    expect(runAllCheckers).not.toHaveBeenCalled();
    expect(runPreSaveQualityGate).not.toHaveBeenCalled();
    expect(analyzeChapterStyle).not.toHaveBeenCalled();
    expect(executePostWritePipeline).not.toHaveBeenCalled();
    expect(syncProjectMemoryBridge).not.toHaveBeenCalled();
    expect(result.reviewReport).toBeNull();
    expect(result.preSaveReport).toBeNull();
    expect(result.styleAnalysis).toBeNull();
    expect(result.dataResult).toBeNull();
    expect(result.stepTimings).not.toHaveProperty('data_agent');
    expect(result.stepTimings).not.toHaveProperty('memory_sync');
    expect(progressEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ step: 3, status: 'skipped' }),
      expect.objectContaining({ step: 4, status: 'skipped' }),
      expect.objectContaining({ step: 5, status: 'skipped' }),
      expect.objectContaining({ step: 6, status: 'skipped' }),
    ]));
  });

  it('skips checker review but keeps polish and memory maintenance in balanced quality mode', async () => {
    const result = await executeFullWritePipeline({
      project: makeProject(),
      targetChapterIndex: 0,
      mode: 'create',
      tensionLevel: 'nudge',
      qualityMode: 'balanced',
    });

    expect(writeChapterFromBranch).toHaveBeenCalledTimes(1);
    expect(runAllCheckers).not.toHaveBeenCalled();
    expect(runPreSaveQualityGate).toHaveBeenCalledTimes(1);
    expect(analyzeChapterStyle).toHaveBeenCalledTimes(1);
    expect(executePostWritePipeline).toHaveBeenCalledTimes(1);
    expect(syncProjectMemoryBridge).toHaveBeenCalledTimes(1);
    expect(result.reviewReport).toBeNull();
    expect(result.preSaveReport?.approved).toBe(true);
    expect(result.styleAnalysis?.overallScore).toBe(8);
    expect(result.dataResult?.summary.chapter_id).toBe('pipeline-draft-0');
  });
});
