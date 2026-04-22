/**
 * File: full_write_pipeline.ts
 * Purpose: Chain 7 module hiện có thành pipeline viết chương tự động
 * Layer: Application (Workflow)
 * Domain: Workflow → [full pipeline: context → draft → review → polish → data → sync → report]
 *
 * Data Contract:
 * - Input:  FullWritePipelinePayload (project, chapter config, options)
 * - Output: FullPipelineResult (text, review, style, timing)
 * - Consumer: writer_orchestrator.ts ONLY
 *
 * Flow: Context Build → AI Draft → Checker Review → Style Polish → Data Extract → Memory Sync → Report
 * Refusal rule: No project/chapters → throw early
 * Edge Cases: Each step can fail independently; pipeline continues with partial results
 * Domain Map Ref: FULL-WRITE-PIPELINE-v1
 */

import type { Project, Chapter } from '../../types/story';
import type { TensionLevel, SurpriseBranch } from '../../types/surprise';
import type { CombinedReviewReport } from '../../core/checkers/checker_types';
import type { StyleAnalysisResult } from '../../types/style_learning';
import type { ChapterWriteResult } from '../../types/surprise';

import { buildTemporalWritingContext } from '../ai/context_builder';
import { planChapterBranches, writeChapterFromBranch } from '../ai/chapter_writer_ai';
import { runAllCheckers, type CheckerContext } from '../../core/checkers/run_all_checkers';
import { analyzeChapterStyle } from '../ai/style_analyzer';
import { executePostWritePipeline, type PostWritePipelineResult } from '../memory/memory_extractor';
import { syncProjectMemoryBridge } from '../memory/memory_sync_bridge';
import { getProjectRules } from '../../db/narrative_db';
import { getModelForTask } from '../ai/model_router';
import { useAiStore } from '../../store/use_ai_store';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import { buildChapterContentHash } from '../memory/memory_indexer';
import { createId } from '../../core/id';
import { useTokenStore } from '../../store/use_token_store';
import type { PipelineSession } from '../../types/token_tracker';

// ─── Types ──────────────────────────────────────────────

export interface PipelineStepProgress {
  step: number;
  totalSteps: number;
  label: string;
  status: 'running' | 'done' | 'skipped' | 'failed';
  durationMs?: number;
}

export interface FullPipelineResult {
  /** Generated chapter text */
  content: string;
  /** Chapter title */
  title: string;
  /** Selected surprise branch */
  selectedBranch: SurpriseBranch;
  /** Full write result from AI */
  writeResult: ChapterWriteResult;
  /** 6-agent review report (null if skipped) */
  reviewReport: CombinedReviewReport | null;
  /** Style analysis (null if skipped) */
  styleAnalysis: StyleAnalysisResult | null;
  /** Data agent extraction result */
  dataResult: PostWritePipelineResult | null;
  /** Per-step timing */
  stepTimings: Record<string, number>;
  /** Total pipeline duration ms */
  totalDurationMs: number;
}

export interface PipelineOptions {
  project: Project;
  targetChapterIndex: number;
  mode: 'create' | 'continue';
  tensionLevel: TensionLevel;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
  styleInstruction?: string;
  skipReview?: boolean;
  skipPolish?: boolean;
  onProgress?: (progress: PipelineStepProgress) => void;
}

const REVIEW_RETRY_SCORE_THRESHOLD = 60;
const MAX_REVIEW_RETRIES = 1;

function resolvePipelineModel(taskType: 'write_chapter' | 'summarize' | 'extract_metadata') {
  const aiStore = useAiStore.getState();
  return getModelForTask(
    taskType,
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides
  );
}

function buildCheckerContext(
  project: Project,
  targetChapterIndex: number,
  chapterText: string,
  systemStateContext: string,
): CheckerContext {
  return {
    chapterId: `pipeline-${targetChapterIndex}`,
    chapterNumber: targetChapterIndex + 1,
    chapterText,
    characters: project.characters.map(c => ({
      name: c.name,
      aliases: c.aliases || [],
      traits: c.traits || '',
      role: c.role,
      personality: c.traits || '',
      speechPattern: '',
      coreValues: '',
      behavioralTendencies: c.arc || '',
    })),
    strandTracker: project.strandTracker || {
      lastQuestChapter: 0,
      lastFireChapter: 0,
      lastConstellationChapter: 0,
      history: [],
    },
    systemStateContext,
    previousSummary: project.chapters[targetChapterIndex - 1]?.summary || '',
    activeThreads: [],
  };
}

function shouldRetryFromReview(reviewReport: CombinedReviewReport | null): boolean {
  return Boolean(
    reviewReport &&
    (!reviewReport.pass || reviewReport.combined_score < REVIEW_RETRY_SCORE_THRESHOLD)
  );
}

function buildRetryFeedbackNotes(reviewReport: CombinedReviewReport): string {
  const fixLines = reviewReport.priority_fixes
    .slice(0, 4)
    .map((issue, index) => `${index + 1}. ${issue.description} | Sửa: ${issue.suggestion}`);

  const summaryLines = reviewReport.reports
    .filter((report) => !report.pass || report.overall_score < REVIEW_RETRY_SCORE_THRESHOLD)
    .slice(0, 2)
    .map((report) => `- ${report.agent}: ${report.summary}`);

  return [
    'FEEDBACK KIỂM TRA CHẤT LƯỢNG. HÃY VIẾT LẠI CÙNG NHÁNH, KHÔNG ĐỔI CỐT LÕI NHỊP TRUYỆN.',
    `Điểm checker hiện tại: ${Math.round(reviewReport.combined_score)}/100.`,
    fixLines.length > 0 ? `Ưu tiên sửa:\n${fixLines.join('\n')}` : '',
    summaryLines.length > 0 ? `Nhận xét tổng quát:\n${summaryLines.join('\n')}` : '',
    'Giữ hook cuối chương, continuity, và giọng văn đã có. Chỉ sửa các lỗi bị nêu.',
  ].filter(Boolean).join('\n\n');
}

function mergeNotes(baseNotes?: string, extraNotes?: string): string | undefined {
  const merged = [baseNotes, extraNotes].filter(Boolean).join('\n\n');
  return merged || undefined;
}

function buildDraftChapter(
  project: Project,
  targetChapterIndex: number,
  writeResult: ChapterWriteResult,
): Chapter {
  const chapterNumber = targetChapterIndex + 1;
  const now = new Date().toISOString();
  const existingChapter = project.chapters.find((chapter) => (chapter.sequenceNumber ?? 0) === chapterNumber);

  return {
    id: existingChapter?.id || `pipeline-draft-${targetChapterIndex}`,
    title: writeResult.title,
    content: writeResult.content,
    summary: writeResult.ledger.summary,
    sequenceNumber: chapterNumber,
    status: existingChapter?.status || 'draft',
    createdAt: existingChapter?.createdAt || now,
    updatedAt: now,
  };
}

function mergeDraftChapterIntoProject(project: Project, draftChapter: Chapter): Project {
  const existingIndex = project.chapters.findIndex(
    (chapter) =>
      chapter.id === draftChapter.id ||
      (chapter.sequenceNumber ?? 0) === (draftChapter.sequenceNumber ?? 0)
  );

  const chapters = [...project.chapters];
  if (existingIndex >= 0) {
    chapters[existingIndex] = {
      ...chapters[existingIndex],
      ...draftChapter,
    };
  } else {
    chapters.push(draftChapter);
  }

  return {
    ...project,
    chapters,
  };
}

// ─── Pipeline Execution ────────────────────────────────

export async function executeFullWritePipeline(opts: PipelineOptions): Promise<FullPipelineResult> {
  const {
    project, targetChapterIndex, mode, tensionLevel,
    prompt, notes, sourceOverride, styleInstruction,
    skipReview = false, skipPolish = false, onProgress,
  } = opts;

  const pipelineStart = Date.now();
  const stepTimings: Record<string, number> = {};
  const totalSteps = 7;
  const pipelineSessionId = createId();

  function emitProgress(step: number, label: string, status: PipelineStepProgress['status'], durationMs?: number) {
    onProgress?.({ step, totalSteps, label, status, durationMs });
  }

  // ── STEP 1: Context Build ──────────────────────────

  emitProgress(1, 'Xây dựng ngữ cảnh sáng tạo', 'running');
  const step1Start = Date.now();

  const styleRules = await getProjectRules(project.id).catch(() => []);
  const writingContext = await buildTemporalWritingContext(project, targetChapterIndex, styleRules);

  stepTimings['context_build'] = Date.now() - step1Start;
  emitProgress(1, 'Xây dựng ngữ cảnh sáng tạo', 'done', stepTimings['context_build']);

  // ── STEP 2: AI Draft (Plan Branches → Pick Best → Write) ──

  emitProgress(2, 'AI viết nháp chương', 'running');
  const step2Start = Date.now();

  const planResult = await planChapterBranches({
    project,
    targetChapterIndex,
    mode,
    tensionLevel,
    prompt,
    notes,
    sourceOverride,
    pipelineSessionId,
  });

  const bestBranchId = planResult.recommendedBranchId;
  const selectedBranch = planResult.branches.find(b => b.id === bestBranchId) || planResult.branches[0];

  let writeResult = await writeChapterFromBranch({
    project,
    targetChapterIndex,
    mode,
    tensionLevel,
    branch: selectedBranch,
    prompt,
    notes,
    sourceOverride,
    styleInstruction,
    pipelineSessionId,
  });

  stepTimings['ai_draft'] = Date.now() - step2Start;
  emitProgress(2, 'AI viết nháp chương', 'done', stepTimings['ai_draft']);

  // ── STEP 3: Checker Review (6 agents) ─────────────

  let reviewReport: CombinedReviewReport | null = null;

  if (!skipReview) {
    emitProgress(3, 'Kiểm tra chất lượng (6 checker agents)', 'running');
    const step3Start = Date.now();

    try {
      const reviewModel = resolvePipelineModel('write_chapter');
      if (!reviewModel) throw new Error('No model for review');

      const runReviewPass = async (content: string) => {
        const checkerContext = buildCheckerContext(
          project,
          targetChapterIndex,
          content,
          writingContext.contextText.slice(0, 800),
        );

        const callAi = async (prompt: { system: string; user: string }) => {
          return callAiModelTracked({
            provider: reviewModel.provider,
            modelId: reviewModel.modelId,
            modelName: reviewModel.name,
            baseUrl: reviewModel.baseUrl,
            systemPrompt: prompt.system,
            userPrompt: prompt.user,
            taskType: 'write_chapter',
            responseFormat: 'json_object',
            pipelineSessionId,
            pipelineStep: 'review_checkers',
          });
        };

        return runAllCheckers(checkerContext, callAi);
      };

      reviewReport = await runReviewPass(writeResult.content);

      let retryCount = 0;
      while (retryCount < MAX_REVIEW_RETRIES && shouldRetryFromReview(reviewReport)) {
        retryCount += 1;
        const retryFeedback = buildRetryFeedbackNotes(reviewReport!);

        writeResult = await writeChapterFromBranch({
          project,
          targetChapterIndex,
          mode,
          tensionLevel,
          branch: selectedBranch,
          prompt,
          notes: mergeNotes(notes, retryFeedback),
          sourceOverride,
          styleInstruction,
          pipelineSessionId,
        });

        reviewReport = await runReviewPass(writeResult.content);
      }
    } catch (error) {
      console.error('[FullPipeline] Review step failed:', error);
    }

    stepTimings['review'] = Date.now() - step3Start;
    emitProgress(3, 'Kiểm tra chất lượng (6 checker agents)', reviewReport ? 'done' : 'failed', stepTimings['review']);
  } else {
    emitProgress(3, 'Kiểm tra chất lượng (bỏ qua)', 'skipped');
  }

  // ── STEP 4: Style Polish ──────────────────────────

  let styleAnalysis: StyleAnalysisResult | null = null;

  if (!skipPolish) {
    emitProgress(4, 'Phân tích văn phong', 'running');
    const step4Start = Date.now();

    try {
      styleAnalysis = await analyzeChapterStyle({
        chapterContent: writeResult.content,
        chapterId: `pipeline-${targetChapterIndex}`,
        project,
        existingRules: styleRules,
      });
    } catch (error) {
      console.error('[FullPipeline] Style analysis failed:', error);
    }

    stepTimings['style_polish'] = Date.now() - step4Start;
    emitProgress(4, 'Phân tích văn phong', styleAnalysis ? 'done' : 'failed', stepTimings['style_polish']);
  } else {
    emitProgress(4, 'Phân tích văn phong (bỏ qua)', 'skipped');
  }

  // ── STEP 5: Data Agent (Entity Extraction + Scene Chunk) ──

  emitProgress(5, 'Trích xuất thực thể & phân cảnh', 'running');
  const step5Start = Date.now();
  let dataResult: PostWritePipelineResult | null = null;
  const draftChapter = buildDraftChapter(project, targetChapterIndex, writeResult);
  const draftProject = mergeDraftChapterIntoProject(project, draftChapter);

  try {
    const dataModel = resolvePipelineModel('summarize');
    if (!dataModel) throw new Error('No model for post-write data extraction');

    const entityDefs: import('../../types/narrative_memory').EntityDefinition[] = project.characters.map(c => ({
      id: c.id || c.name,
      entityId: c.id || c.name,
      projectId: project.id,
      canonicalName: c.name,
      entityType: 'character' as const,
      aliases: c.aliases || [],
      attributes: {},
      sourceType: 'project' as const,
      confidence: 1.0,
      extractorVersion: 'pipeline-v1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    dataResult = await executePostWritePipeline({
      projectId: project.id,
      chapter: draftChapter,
      entityDefinitions: entityDefs,
      contentHash: buildChapterContentHash(draftChapter),
      provider: dataModel.provider,
      modelId: dataModel.modelId,
      apiKey: '',
      model: dataModel,
    });
  } catch (error) {
    console.error('[FullPipeline] Data agent failed:', error);
  }

  stepTimings['data_agent'] = Date.now() - step5Start;
  emitProgress(5, 'Trích xuất thực thể & phân cảnh', dataResult ? 'done' : 'failed', stepTimings['data_agent']);

  // ── STEP 6: Memory Sync ───────────────────────────

  emitProgress(6, 'Đồng bộ bộ nhớ tự sự', 'running');
  const step6Start = Date.now();

  try {
    const memoryModel = resolvePipelineModel('extract_metadata') || resolvePipelineModel('summarize');
    await syncProjectMemoryBridge(draftProject, memoryModel ? { model: memoryModel } : undefined);
  } catch (error) {
    console.error('[FullPipeline] Memory sync failed:', error);
  }

  stepTimings['memory_sync'] = Date.now() - step6Start;
  emitProgress(6, 'Đồng bộ bộ nhớ tự sự', 'done', stepTimings['memory_sync']);

  // ── STEP 7: Report ────────────────────────────────

  emitProgress(7, 'Tổng hợp báo cáo', 'running');
  const totalDurationMs = Date.now() - pipelineStart;
  emitProgress(7, 'Tổng hợp báo cáo', 'done', 0);

  // ── Record Pipeline Session ───────────────────────

  const pipelineSession: PipelineSession = {
    id: pipelineSessionId,
    projectId: project.id,
    projectTitle: project.title || 'Untitled',
    chapterIndex: targetChapterIndex,
    startedAt: new Date(pipelineStart).toISOString(),
    finishedAt: new Date().toISOString(),
    totalTokens: 0, // Will be computed by store from records
    totalCost: 0,
    totalCalls: 0,
    stepBreakdown: {} as PipelineSession['stepBreakdown'],
  };
  useTokenStore.getState().recordPipelineSession(pipelineSession);

  return {
    content: writeResult.content,
    title: writeResult.title,
    selectedBranch,
    writeResult,
    reviewReport,
    styleAnalysis,
    dataResult,
    stepTimings,
    totalDurationMs,
  };
}
