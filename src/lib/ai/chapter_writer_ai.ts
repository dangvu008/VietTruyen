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
import { buildSurpriseContext } from './context_builder';
import { getModelForTask } from './model_router';
import { buildBranchPlannerPrompts, buildChapterWriterPrompts } from './surprise_prompts';
import {
  detectExpectation,
  extractAnchors,
  pickBestBranch,
  validateDivergence,
} from './surprise_engine';
import { callAiModelTracked } from './tracked_ai_client';

function cleanJsonLike(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
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

export function parseWriterResponse(responseText: string): {
  ledger: ChapterLedger;
  content: string;
} {
  const ledgerMarker = '@@LEDGER@@';
  const contentMarker = '@@CONTENT@@';
  const ledgerIndex = responseText.indexOf(ledgerMarker);
  const contentIndex = responseText.indexOf(contentMarker);

  if (ledgerIndex === -1 || contentIndex === -1 || contentIndex <= ledgerIndex) {
    throw new Error('Writer output không đúng sentinel contract.');
  }

  const ledgerText = responseText
    .slice(ledgerIndex + ledgerMarker.length, contentIndex)
    .trim()
    .split('\n')
    .find((line) => line.trim().startsWith('{'));
  const content = responseText.slice(contentIndex + contentMarker.length).trim();

  if (!ledgerText || !content) {
    throw new Error('Writer output thiếu ledger hoặc content.');
  }

  const ledgerJson = JSON.parse(cleanJsonLike(ledgerText)) as Partial<ChapterLedger>;
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
  };
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
    skipCache: true,
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
}): Promise<ChapterWriteResult> {
  const { project, targetChapterIndex, tensionLevel, branch, prompt, notes, sourceOverride, styleInstruction, pipelineSessionId } = opts;
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

  const { model } = await resolveTaskModel('write_chapter');
  const prompts = buildChapterWriterPrompts({
    contextText: surpriseContext.contextText,
    branch,
    tensionLevel,
    prompt,
    notes,
    styleInstruction,
  });

  const responseText = await callAiModelTracked({
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

  const { ledger, content } = parseWriterResponse(responseText);
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
    contextUsage: {
      rawTokens: surpriseContext.rawTokenEstimate,
      cleanTokens: surpriseContext.tokenEstimate,
      reducedTokens: surpriseContext.reducedTokenCount,
      reductionPercent: surpriseContext.reductionPercent,
    },
  };
}
