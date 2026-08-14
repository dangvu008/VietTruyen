/**
 * File: full_write_pipeline.ts
 * Purpose: Chain các module thành pipeline viết chương tự động.
 * Layer: Application (Workflow)
 * Domain: Workflow → [context → draft → review → grounded prose → acceptance → data → sync → report]
 *
 * Data Contract:
 * - Input:  FullWritePipelinePayload (project, chapter config, options)
 * - Output: FullPipelineResult (candidate text + acceptance evidence + optional promoted data)
 * - Consumer: writer_orchestrator.ts ONLY
 *
 * Authoritative safety invariant:
 * - Non-authoritative steps may fail and still return a Candidate.
 * - Data/state/hook/memory mutation MUST NOT run before acceptance PASS.
 * - Missing required evidence is HOLD, never implicit PASS.
 * Domain Map Ref: FULL-WRITE-PIPELINE-v2-FAIL-CLOSED
 */

import type { Project, Chapter } from '../../types/story';
import type { TensionLevel, SurpriseBranch } from '../../types/surprise';
import type { CombinedReviewReport } from '../../core/checkers/checker_types';
import type { StyleAnalysisResult } from '../../types/style_learning';
import type { ChapterWriteResult } from '../../types/surprise';
import type { QualityMode } from '../../types/workflow';
import type { GroundedProseRuntimeGateArtifact } from '../../types/grounded_prose';
import type { PipelineAcceptanceDecision } from '../memory/authoritative_promotion';

import { buildTemporalWritingContext } from '../ai/context_builder';
import { planChapterBranches, writeChapterFromBranch } from '../ai/chapter_writer_ai';
import { runAllCheckers } from '../../core/checkers/run_all_checkers';
import type { CheckerContext } from '../../core/checkers/checker_types';
import { analyzeChapterStyle } from '../ai/style_analyzer';
import { executePostWritePipeline, type PostWritePipelineResult } from '../memory/memory_extractor';
import { syncProjectMemoryBridge } from '../memory/memory_sync_bridge';
import { getActiveNarrativeStateFactsAtChapter, getProjectRules } from '../../db/narrative_db';
import { getModelForTask } from '../ai/model_router';
import { useAiStore } from '../../store/use_ai_store';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import { runPreSaveQualityGate, type PreSaveQualityReport } from '../ai/pre_save_quality_gate';
import { buildChapterContentHash } from '../memory/memory_indexer';
import { createId } from '../../core/id';
import { useTokenStore } from '../../store/use_token_store';
import type { PipelineSession } from '../../types/token_tracker';
import { getContinuityWarnings } from '../memory/memory_query';
import { getOpenHooksForProject } from '../memory/pending_hooks_repository';
import { decidePipelineAcceptance } from './pipeline_acceptance_adapter';
import { runGroundedProseRuntimeGate } from './grounded_prose_runtime_gate';
import { saveGroundedProseGateReceipt } from './grounded_prose_receipt_store';

// ─── Types ──────────────────────────────────────────────

export interface PipelineStepProgress {
  step: number;
  totalSteps: number;
  label: string;
  status: 'running' | 'done' | 'skipped' | 'failed';
  durationMs?: number;
}

export interface FullPipelineResult {
  /** Generated candidate chapter text. */
  content: string;
  title: string;
  selectedBranch: SurpriseBranch;
  writeResult: ChapterWriteResult;
  reviewReport: CombinedReviewReport | null;
  styleAnalysis: StyleAnalysisResult | null;
  preSaveReport: PreSaveQualityReport | null;
  /** Grounded prose hard-gate artifact. Null only in fast/candidate-only mode. */
  groundedProseGate: GroundedProseRuntimeGateArtifact | null;
  /** Canonical PASS/HOLD/FAIL decision controlling authoritative mutation. */
  acceptanceDecision: PipelineAcceptanceDecision;
  /** Non-null only when accepted data extraction actually ran. */
  dataResult: PostWritePipelineResult | null;
  stepTimings: Record<string, number>;
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
  qualityMode?: QualityMode;
  onProgress?: (progress: PipelineStepProgress) => void;
  onChunk?: (chunk: string, accumulated: string) => void;
  signal?: AbortSignal;
}

const REVIEW_RETRY_SCORE_THRESHOLD = 60;
const MAX_REVIEW_RETRIES = 1;
const DEFAULT_QUALITY_MODE: QualityMode = 'quality';

interface QualityStepPlan {
  runPreSaveGate: boolean;
  runReview: boolean;
  runPolish: boolean;
  runGroundedProseGate: boolean;
  runDataAgent: boolean;
  runMemorySync: boolean;
}

function buildQualityStepPlan(
  qualityMode: QualityMode,
  skipReview: boolean,
  skipPolish: boolean,
): QualityStepPlan {
  if (qualityMode === 'fast') {
    return {
      runPreSaveGate: false,
      runReview: false,
      runPolish: false,
      runGroundedProseGate: false,
      runDataAgent: false,
      runMemorySync: false,
    };
  }

  if (qualityMode === 'balanced') {
    return {
      runPreSaveGate: true,
      runReview: false,
      runPolish: !skipPolish,
      runGroundedProseGate: true,
      runDataAgent: true,
      runMemorySync: true,
    };
  }

  return {
    runPreSaveGate: true,
    runReview: !skipReview,
    runPolish: !skipPolish,
    runGroundedProseGate: true,
    runDataAgent: true,
    runMemorySync: true,
  };
}

function resolvePipelineModel(taskType: 'write_chapter' | 'summarize' | 'extract_metadata') {
  const aiStore = useAiStore.getState();
  return getModelForTask(
    taskType,
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides,
    aiStore.modelHealth,
    [],
    aiStore.preferredProvider
  );
}

async function buildCheckerContext(
  project: Project,
  targetChapterIndex: number,
  chapterText: string,
  systemStateContext: string,
): Promise<CheckerContext> {
  const currentBeat = project.outline[targetChapterIndex];
  const nextBeat = project.outline[targetChapterIndex + 1];
  const effectiveChapterIndex = Math.max(1, targetChapterIndex);
  const [stateFacts, openHooks, continuityTasks] = await Promise.all([
    getActiveNarrativeStateFactsAtChapter(project.id, effectiveChapterIndex).catch(() => []),
    getOpenHooksForProject(project.id).catch(() => []),
    getContinuityWarnings(project.id, effectiveChapterIndex).catch(() => []),
  ]);
  const activeThreads = [
    ...project.foreshadowings
      .filter((item) => !item.isResolved)
      .slice(0, 5)
      .map((item) => item.description),
    ...openHooks.slice(0, 4).map((hook) => hook.description),
    ...project.outline
      .slice(targetChapterIndex + 1, targetChapterIndex + 3)
      .map((beat) => [beat.title, beat.summary].filter(Boolean).join(': '))
      .filter(Boolean),
  ];

  return {
    chapterId: `pipeline-${targetChapterIndex}`,
    chapterNumber: targetChapterIndex + 1,
    chapterText,
    characters: project.characters.map(c => ({
      name: c.name,
      aliases: c.aliases || [],
      traits: c.traits || '',
      role: c.role,
      personality: [c.traits, c.psychology?.selfDeception, c.psychology?.hiddenDesire].filter(Boolean).join(' | '),
      speechPattern: '',
      coreValues: c.psychology?.coreWound || '',
      behavioralTendencies: [c.arc, c.psychology?.bodyLanguage].filter(Boolean).join(' | '),
    })),
    strandTracker: project.strandTracker || {
      lastQuestChapter: 0,
      lastFireChapter: 0,
      lastConstellationChapter: 0,
      history: [],
    },
    systemStateContext,
    previousSummary: project.chapters[targetChapterIndex - 1]?.summary || '',
    activeThreads,
    chapterIntent: [
      currentBeat?.title,
      currentBeat?.summary,
      currentBeat?.focus ? `Focus: ${currentBeat.focus}` : '',
    ].filter(Boolean).join(' | '),
    futureTarget: nextBeat
      ? [nextBeat.title, nextBeat.summary, nextBeat.focus ? `Focus: ${nextBeat.focus}` : ''].filter(Boolean).join(' | ')
      : project.endgame || '',
    storyStateFacts: stateFacts.slice(0, 8).map((fact) => ({
      subjectId: fact.subjectId,
      predicate: fact.predicate,
      value: fact.value,
      validFromChapter: fact.validFromChapter,
      confidence: fact.confidence,
    })),
    activeHooks: openHooks.slice(0, 5).map((hook) => ({
      id: hook.id,
      description: hook.description,
      plantedChapterIndex: hook.plantedChapterIndex,
      expectedPayoffBy: hook.expectedPayoffBy,
      confidence: hook.confidence,
    })),
    continuityWarnings: continuityTasks.slice(0, 4).map((task) => task.recommendedAction),
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
    'Giữ continuity và giọng văn đã có. Chỉ sửa lỗi bị nêu; không ép hook/payoff nếu cảnh không tạo ra chúng.',
  ].filter(Boolean).join('\n\n');
}

function mergeNotes(baseNotes?: string, extraNotes?: string): string | undefined {
  const merged = [baseNotes, extraNotes].filter(Boolean).join('\n\n');
  return merged || undefined;
}

async function runPreSaveGateForWriteResult(opts: {
  project: Project;
  targetChapterIndex: number;
  writeResult: ChapterWriteResult;
  pipelineSessionId: string;
}): Promise<{ writeResult: ChapterWriteResult; report: PreSaveQualityReport | null }> {
  const model = resolvePipelineModel('write_chapter');
  if (!model) return { writeResult: opts.writeResult, report: null };

  const result = await runPreSaveQualityGate({
    project: opts.project,
    targetChapterIndex: opts.targetChapterIndex,
    chapterTitle: opts.writeResult.title,
    chapterContent: opts.writeResult.content,
    chapterSummary: opts.writeResult.ledger.summary,
    model,
    pipelineSessionId: opts.pipelineSessionId,
  });

  return {
    writeResult: {
      ...opts.writeResult,
      content: result.content,
    },
    report: result.report,
  };
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
    skipReview = false, skipPolish = false,
    qualityMode = DEFAULT_QUALITY_MODE,
    onProgress, onChunk, signal,
  } = opts;

  const pipelineStart = Date.now();
  const stepTimings: Record<string, number> = {};
  const totalSteps = 7;
  const pipelineSessionId = createId();
  const stepPlan = buildQualityStepPlan(qualityMode, skipReview, skipPolish);

  function emitProgress(step: number, label: string, status: PipelineStepProgress['status'], durationMs?: number) {
    onProgress?.({ step, totalSteps, label, status, durationMs });
  }

  // ── STEP 1: Context Build ──────────────────────────
  emitProgress(1, 'Xây dựng ngữ cảnh sáng tạo', 'running');
  const step1Start = Date.now();
  const styleRules = await getProjectRules(project.id).catch(() => []);
  const writingContext = await buildTemporalWritingContext(project, targetChapterIndex, styleRules);
  stepTimings['context_build'] = Date.now() - step1Start;
  emitProgress(1, 'Xây dựng ngữ cảnh sáng tạo', writingContext.validationPass ? 'done' : 'failed', stepTimings['context_build']);

  // ── STEP 2: AI Draft ───────────────────────────────
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
    onChunk,
    signal,
  });

  let preSaveReport: PreSaveQualityReport | null = null;
  if (stepPlan.runPreSaveGate) {
    const preSaveStart = Date.now();
    try {
      const preSaveResult = await runPreSaveGateForWriteResult({
        project,
        targetChapterIndex,
        writeResult,
        pipelineSessionId,
      });
      writeResult = preSaveResult.writeResult;
      preSaveReport = preSaveResult.report;
    } catch (error) {
      console.error('[FullPipeline] Pre-save quality gate failed:', error);
    }
    stepTimings['pre_save_quality_gate'] = Date.now() - preSaveStart;
  }

  stepTimings['ai_draft'] = Date.now() - step2Start;
  emitProgress(2, 'AI viết nháp chương', 'done', stepTimings['ai_draft']);

  // ── STEP 3: Checker Review ─────────────────────────
  let reviewReport: CombinedReviewReport | null = null;

  if (stepPlan.runReview) {
    emitProgress(3, 'Kiểm tra chất lượng (6 checker agents)', 'running');
    const step3Start = Date.now();

    try {
      const reviewModel = resolvePipelineModel('write_chapter');
      if (!reviewModel) throw new Error('No model for review');

      const runReviewPass = async (content: string) => {
        const checkerContext = await buildCheckerContext(
          project,
          targetChapterIndex,
          content,
          writingContext.contextText.slice(0, 800),
        );

        const callAi = async (reviewPrompt: { system: string; user: string }) => {
          return callAiModelTracked({
            provider: reviewModel.provider,
            modelId: reviewModel.modelId,
            modelName: reviewModel.name,
            baseUrl: reviewModel.baseUrl,
            systemPrompt: reviewPrompt.system,
            userPrompt: reviewPrompt.user,
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

        if (stepPlan.runPreSaveGate) {
          try {
            const preSaveResult = await runPreSaveGateForWriteResult({
              project,
              targetChapterIndex,
              writeResult,
              pipelineSessionId,
            });
            writeResult = preSaveResult.writeResult;
            preSaveReport = preSaveResult.report;
          } catch (error) {
            console.error('[FullPipeline] Pre-save quality gate retry pass failed:', error);
          }
        }

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

  // ── STEP 4: Style + Grounded Prose hard gate ──────
  let styleAnalysis: StyleAnalysisResult | null = null;
  if (stepPlan.runPolish) {
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
  }

  let groundedProseGate: GroundedProseRuntimeGateArtifact | null = null;
  if (stepPlan.runGroundedProseGate) {
    const groundedStart = Date.now();
    try {
      groundedProseGate = await runGroundedProseRuntimeGate({
        project,
        targetChapterIndex,
        chapterTitle: writeResult.title,
        chapterContent: writeResult.content,
        pipelineSessionId,
      });
      saveGroundedProseGateReceipt(project.id, targetChapterIndex + 1, groundedProseGate);
    } catch (error) {
      console.error('[FullPipeline] Grounded prose runtime gate failed:', error);
    }
    stepTimings['grounded_prose_gate'] = Date.now() - groundedStart;
  }

  const continuityWarnings = qualityMode === 'fast'
    ? []
    : await getContinuityWarnings(project.id, Math.max(1, targetChapterIndex)).catch(() => null);
  const continuityPassed = qualityMode === 'fast'
    ? false
    : continuityWarnings !== null && continuityWarnings.length === 0;

  const acceptanceDecision = decidePipelineAcceptance({
    qualityMode,
    contextValidationPassed: writingContext.validationPass,
    continuityPassed,
    preSaveGateRequired: qualityMode !== 'fast',
    preSaveReport,
    // Quality mode may be configured to skip review, but doing so makes the
    // required evidence absent and therefore HOLD rather than silently PASS.
    reviewRequired: qualityMode === 'quality',
    reviewReport,
    literaryPassed: groundedProseGate?.decision === 'PASS',
    coldReaderPassed: groundedProseGate?.coldReader?.pass === true,
    fatalError: qualityMode !== 'fast' && groundedProseGate?.decision !== 'PASS',
  });

  const step4Status: PipelineStepProgress['status'] = qualityMode === 'fast'
    ? 'skipped'
    : acceptanceDecision.verdict === 'PASS' ? 'done' : 'failed';
  emitProgress(
    4,
    qualityMode === 'fast'
      ? 'Quality hard gates (candidate-only mode)'
      : `Quality hard gates → ${acceptanceDecision.verdict}`,
    step4Status,
    (stepTimings['style_polish'] || 0) + (stepTimings['grounded_prose_gate'] || 0),
  );

  // From this line onward, authoritative/canonical mutation is guarded by
  // acceptanceDecision. Candidate output may still be returned on HOLD/FAIL.
  const draftChapter = buildDraftChapter(project, targetChapterIndex, writeResult);
  const draftProject = mergeDraftChapterIntoProject(project, draftChapter);

  // ── STEP 5: Accepted Data Agent only ──────────────
  let dataResult: PostWritePipelineResult | null = null;

  if (stepPlan.runDataAgent && acceptanceDecision.mayMutateAuthoritativeState) {
    emitProgress(5, 'Trích xuất & promote dữ liệu accepted', 'running');
    const step5Start = Date.now();

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
        extractorVersion: 'pipeline-v2-accepted-only',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const aiState = useAiStore.getState();
      const legacyApiKey = aiState.getApiKey?.(dataModel.provider) ?? aiState.apiKeys?.[dataModel.provider] ?? '';

      dataResult = await executePostWritePipeline({
        projectId: project.id,
        chapter: draftChapter,
        entityDefinitions: entityDefs,
        contentHash: buildChapterContentHash(draftChapter),
        provider: dataModel.provider,
        modelId: dataModel.modelId,
        apiKey: legacyApiKey,
        model: dataModel,
      });
    } catch (error) {
      console.error('[FullPipeline] Accepted data agent failed:', error);
    }

    stepTimings['data_agent'] = Date.now() - step5Start;
    emitProgress(5, 'Trích xuất & promote dữ liệu accepted', dataResult ? 'done' : 'failed', stepTimings['data_agent']);
  } else {
    emitProgress(
      5,
      `Data mutation blocked (${acceptanceDecision.verdict})`,
      'skipped',
    );
  }

  // ── Accepted-only bridge: ledger foreshadow → project state ──
  if (
    acceptanceDecision.mayMutateAuthoritativeState &&
    writeResult.ledger.foreshadowPlanted.length > 0
  ) {
    const { useProjectStore } = await import('../../store/use_project_store');
    const nowIso = new Date().toISOString();
    for (const desc of writeResult.ledger.foreshadowPlanted) {
      if (!desc.trim()) continue;
      const already = project.foreshadowings.some(
        (f) => f.description.toLowerCase() === desc.toLowerCase(),
      );
      if (!already) {
        useProjectStore.getState().addForeshadowing(project.id, {
          id: createId(),
          description: desc,
          isResolved: false,
          createdAt: nowIso,
        });
      }
    }
  }

  // ── STEP 6: Accepted Memory Sync only ─────────────
  if (stepPlan.runMemorySync && acceptanceDecision.maySyncAcceptedMemory) {
    emitProgress(6, 'Đồng bộ accepted narrative memory', 'running');
    const step6Start = Date.now();

    try {
      const memoryModel = resolvePipelineModel('extract_metadata') || resolvePipelineModel('summarize');
      await syncProjectMemoryBridge(draftProject, memoryModel ? { model: memoryModel } : undefined);
    } catch (error) {
      console.error('[FullPipeline] Memory sync failed:', error);
    }

    stepTimings['memory_sync'] = Date.now() - step6Start;
    emitProgress(6, 'Đồng bộ accepted narrative memory', 'done', stepTimings['memory_sync']);
  } else {
    emitProgress(
      6,
      `Accepted memory sync blocked (${acceptanceDecision.verdict})`,
      'skipped',
    );
  }

  // ── STEP 7: Report ────────────────────────────────
  emitProgress(7, 'Tổng hợp báo cáo', 'running');
  const totalDurationMs = Date.now() - pipelineStart;
  emitProgress(7, `Tổng hợp báo cáo — ${acceptanceDecision.verdict}`, 'done', 0);

  const pipelineSession: PipelineSession = {
    id: pipelineSessionId,
    projectId: project.id,
    projectTitle: project.title || 'Untitled',
    chapterIndex: targetChapterIndex,
    startedAt: new Date(pipelineStart).toISOString(),
    finishedAt: new Date().toISOString(),
    totalTokens: 0,
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
    preSaveReport,
    groundedProseGate,
    acceptanceDecision,
    dataResult,
    stepTimings,
    totalDurationMs,
  };
}
