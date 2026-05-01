import { getProjectRules } from '../../db/narrative_db';
import { useAiStore } from '../../store/use_ai_store';
import type { Project } from '../../types/story';
import type {
  BranchPlanningResult,
  ChapterLedger,
  ChapterWriteResult,
  SurpriseBranch,
  TensionLevel,
} from '../../types/surprise';
import { buildSurpriseContext, buildWritingContext } from './context_builder';
import { getModelForTask } from './model_router';
import { buildBranchPlannerPrompts, buildChapterWriterPrompts } from './surprise_prompts';
import {
  detectExpectation,
  extractAnchors,
  pickBestBranch,
  validateDivergence,
} from './surprise_engine';
import { callAiModelTracked } from './tracked_ai_client';
import { callAiStreaming } from './streaming_ai_client';

function cleanJsonLike(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function extractJsonObject(text: string): string {
  const cleaned = cleanJsonLike(text);
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Writer output thiếu JSON ledger hợp lệ.');
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function clampRiskScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

export function parsePlannerResponse(
  responseText: string,
  tensionLevel: TensionLevel,
  validAnchorIds: string[],
): SurpriseBranch[] {
  const parsed = JSON.parse(cleanJsonLike(responseText)) as { branches?: any[] };
  const branches = Array.isArray(parsed.branches) ? parsed.branches : [];
  if (branches.length < 3) {
    throw new Error('Planner không trả đủ 3 branches.');
  }

  const fallbackAnchorIds = validAnchorIds.slice(0, 3);
  return branches.slice(0, 3).map((branch, index) => {
    const preservedAnchorIds = normalizeList(branch.preservedAnchorIds).filter((id) => validAnchorIds.includes(id));
    const normalized: SurpriseBranch = {
      id: String(branch.id || `branch_${index + 1}`),
      suggestedTitle: String(branch.suggestedTitle || `Hướng ${index + 1}`),
      tensionLevel,
      summary: String(branch.summary || '').trim(),
      surpriseVector: String(branch.surpriseVector || '').trim(),
      beatStrategy: branch.beatStrategy === 'delay' || branch.beatStrategy === 'replace' ? branch.beatStrategy : 'follow',
      preservedAnchorIds: preservedAnchorIds.length > 0 ? preservedAnchorIds : fallbackAnchorIds,
      challengedExpectation: String(branch.challengedExpectation || '').trim(),
      foreshadowNow: normalizeList(branch.foreshadowNow),
      impactTrace: normalizeList(branch.impactTrace),
      riskScore: clampRiskScore(branch.riskScore),
    };

    if (!normalized.summary) {
      throw new Error(`Branch ${index + 1} thiếu summary.`);
    }
    if (tensionLevel === 'subvert' && normalized.foreshadowNow.length === 0) {
      throw new Error(`Branch ${index + 1} thiếu foreshadowNow cho mode subvert.`);
    }

    return normalized;
  });
}

function buildDefaultLedger(): ChapterLedger {
  return {
    summary: '',
    beatStatus: 'hit',
    usedCharacterNames: [],
    introducedEntities: [],
    foreshadowPlanted: [],
    preservedAnchorIds: [],
  };
}

/**
 * Fallback: khi không có sentinel markers, cố gắng extract nội dung từ raw text.
 * Loại bỏ phần JSON ledger nếu có ở đầu/cuối, giữ lại phần văn xuôi.
 */
function extractContentFallback(responseText: string): { ledger: ChapterLedger; content: string } {
  // [Domain:AI] STEP — Try to extract JSON block from start, treat rest as content
  const trimmed = responseText.trim();

  // Case 1: Starts with JSON block {…} then prose
  if (trimmed.startsWith('{')) {
    try {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.indexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonPart = trimmed.slice(firstBrace, lastBrace + 1);
        const rest = trimmed.slice(lastBrace + 1).trim();
        if (rest.length > 100) {
          const ledgerJson = JSON.parse(jsonPart) as Partial<ChapterLedger>;
          const ledger = {
            summary: String(ledgerJson.summary || '').trim(),
            beatStatus: ledgerJson.beatStatus === 'delay' || ledgerJson.beatStatus === 'replace' ? ledgerJson.beatStatus : 'hit' as const,
            usedCharacterNames: normalizeList(ledgerJson.usedCharacterNames),
            introducedEntities: normalizeList(ledgerJson.introducedEntities),
            foreshadowPlanted: normalizeList(ledgerJson.foreshadowPlanted),
            preservedAnchorIds: normalizeList(ledgerJson.preservedAnchorIds),
          };
          return { ledger, content: rest };
        }
      }
    } catch {
      // not valid JSON — fall through
    }
  }

  // Case 2: No structure at all — use full text as content
  if (trimmed.length > 100) {
    return { ledger: buildDefaultLedger(), content: trimmed };
  }

  throw new Error('Writer output rỗng hoặc quá ngắn để sử dụng.');
}

export function parseWriterResponse(responseText: string): {
  ledger: ChapterLedger;
  content: string;
  ecotAnalysis?: string;
} {
  const ecotMarker = '@@ECOT_ANALYSIS@@';
  const ledgerMarker = '@@LEDGER@@';
  const contentMarker = '@@CONTENT@@';
  
  const ecotIndex = responseText.indexOf(ecotMarker);
  const ledgerIndex = responseText.indexOf(ledgerMarker);
  const contentIndex = responseText.indexOf(contentMarker);

  let ecotAnalysis: string | undefined = undefined;
  if (ecotIndex !== -1 && ledgerIndex !== -1 && ledgerIndex > ecotIndex) {
    ecotAnalysis = responseText.slice(ecotIndex + ecotMarker.length, ledgerIndex).trim();
  }

  // [Domain:AI] STEP 1 — Happy path: both sentinel markers present and in correct order
  if (ledgerIndex !== -1 && contentIndex !== -1 && contentIndex > ledgerIndex) {
    const ledgerText = responseText
      .slice(ledgerIndex + ledgerMarker.length, contentIndex)
      .trim();
    const content = responseText.slice(contentIndex + contentMarker.length).trim();

    if (ledgerText && content) {
      try {
        const ledgerJson = JSON.parse(extractJsonObject(ledgerText)) as Partial<ChapterLedger>;
        return {
          ledger: {
            summary: String(ledgerJson.summary || '').trim(),
            beatStatus: ledgerJson.beatStatus === 'delay' || ledgerJson.beatStatus === 'replace' ? ledgerJson.beatStatus : 'hit',
            usedCharacterNames: normalizeList(ledgerJson.usedCharacterNames),
            introducedEntities: normalizeList(ledgerJson.introducedEntities),
            foreshadowPlanted: normalizeList(ledgerJson.foreshadowPlanted),
            preservedAnchorIds: normalizeList(ledgerJson.preservedAnchorIds),
          },
          content,
          ecotAnalysis,
        };
      } catch (parseErr) {
        console.warn('[parseWriterResponse] Ledger JSON parse failed, falling back:', parseErr);
        // Ledger parse failed but content is valid — use content with default ledger
        return { ledger: buildDefaultLedger(), content, ecotAnalysis };
      }
    }
  }

  // [Domain:AI] STEP 2 — Fallback: sentinels missing or wrong order
  // Log for diagnostics without throwing
  console.warn(
    '[parseWriterResponse] Sentinel markers not found or wrong order. Attempting fallback extraction.',
    `\nledgerIndex=${ledgerIndex}, contentIndex=${contentIndex}`,
    `\nFirst 200 chars: ${responseText.slice(0, 200)}`,
  );

  return extractContentFallback(responseText);
}

function mergeWriterContextText(primaryContext: string, ghostwriterContext: string): string {
  const trimmedPrimary = primaryContext.trim();
  const trimmedGhostwriter = ghostwriterContext.trim();

  if (!trimmedGhostwriter) return trimmedPrimary;
  if (!trimmedPrimary) return trimmedGhostwriter;

  return [
    trimmedPrimary,
    '## GHOSTWRITER RUNTIME CONTEXT',
    trimmedGhostwriter,
  ].join('\n\n');
}

async function resolveTaskModel(taskType: 'plan_chapter' | 'write_chapter') {
  const aiState = useAiStore.getState();
  const model = getModelForTask(
    taskType,
    aiState.models,
    undefined,
    aiState.activeModelId,
    aiState.taskModelOverrides
  );
  if (!model) {
    throw new Error('Không tìm thấy model AI khả dụng.');
  }
  return { model };
}

export async function planChapterBranches(opts: {
  project: Project;
  targetChapterIndex: number;
  mode: 'create' | 'continue';
  tensionLevel: TensionLevel;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
  pipelineSessionId?: string;
}): Promise<BranchPlanningResult> {
  const { project, targetChapterIndex, tensionLevel, prompt, notes, sourceOverride, pipelineSessionId } = opts;
  const anchors = extractAnchors(project, targetChapterIndex);
  const expectation = detectExpectation(project, targetChapterIndex, anchors);
  const { model } = await resolveTaskModel('plan_chapter');
  const prompts = buildBranchPlannerPrompts({
    project,
    targetChapterIndex,
    tensionLevel,
    anchors,
    expectation,
    prompt,
    notes,
    sourceOverride,
  });

  const responseText = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: prompts.system,
    userPrompt: prompts.user,
    taskType: 'plan_chapter',
    responseFormat: 'json_object',
    pipelineSessionId,
    pipelineStep: 'plan_branches',
  });

  const parsedBranches = parsePlannerResponse(
    responseText,
    tensionLevel,
    anchors.all.map((anchor) => anchor.id),
  );
  const { recommendedBranchId, scoredBranches } = pickBestBranch(
    parsedBranches,
    tensionLevel,
    expectation,
    project.outline[targetChapterIndex],
  );

  return {
    anchors,
    expectation,
    branches: scoredBranches,
    recommendedBranchId,
  };
}

export async function writeChapterFromBranch(opts: {
  project: Project;
  targetChapterIndex: number;
  mode: 'create' | 'continue';
  tensionLevel: TensionLevel;
  branch: SurpriseBranch;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
  styleInstruction?: string;
  pipelineSessionId?: string;
  /** Called with each streamed chunk when streaming mode is active */
  onChunk?: (chunk: string, accumulated: string) => void;
  /** AbortSignal to cancel the streaming generation */
  signal?: AbortSignal;
}): Promise<ChapterWriteResult> {
  const { project, targetChapterIndex, tensionLevel, branch, prompt, notes, sourceOverride, styleInstruction, pipelineSessionId, onChunk, signal } = opts;
  const anchors = extractAnchors(project, targetChapterIndex);
  const expectation = detectExpectation(project, targetChapterIndex, anchors);
  const styleRules = await getProjectRules(project.id).catch(() => []);
  const surpriseContext = await buildSurpriseContext(
    project,
    targetChapterIndex,
    tensionLevel,
    branch,
    anchors,
    expectation,
    styleRules,
    sourceOverride,
  );
  const writingContext = await buildWritingContext(
    project,
    targetChapterIndex,
    styleRules,
  ).catch(() => null);
  const mergedContextText = mergeWriterContextText(
    surpriseContext.contextText,
    writingContext?.contextText || '',
  );

  const { model } = await resolveTaskModel('write_chapter');
  const prompts = buildChapterWriterPrompts({
    contextText: mergedContextText,
    branch,
    tensionLevel,
    prompt,
    notes,
    styleInstruction,
  });

  // [Domain:AI] STEP — Use streaming client when onChunk callback is provided
  let responseText: string;
  if (onChunk) {
    const streamResult = await callAiStreaming({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      taskType: 'write_chapter',
      signal,
      onChunk,
    });
    responseText = streamResult.text;
    if (!responseText.trim() && !streamResult.completed) {
      throw new Error('Người dùng đã dừng quá trình tạo nội dung.');
    }
  } else {
    responseText = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompts.system,
      userPrompt: prompts.user,
      taskType: 'write_chapter',
      skipCache: true,
      pipelineSessionId,
      pipelineStep: 'write_chapter',
    });
  }

  const { ledger, content, ecotAnalysis } = parseWriterResponse(responseText);
  const divergence = validateDivergence(
    content,
    ledger,
    project,
    targetChapterIndex,
    branch,
    anchors,
  );

  return {
    title: branch.suggestedTitle || project.outline[targetChapterIndex]?.title || `Chương ${targetChapterIndex + 1}`,
    content,
    ledger,
    divergence,
    selectedBranch: branch,
    ecotAnalysis,
    contextUsage: {
      rawTokens: surpriseContext.rawTokenEstimate,
      cleanTokens: surpriseContext.tokenEstimate,
      reducedTokens: surpriseContext.reducedTokenCount,
      reductionPercent: surpriseContext.reductionPercent,
    },
  };
}
