import { getProjectRules } from '../../db/narrative_db';
import { useAiStore } from '../../store/use_ai_store';
import type { Project } from '../../types/story';
import { guardChapterContent } from '../chapter/chapter_content_guard';
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
import { buildChapterCharacterGuardrails } from './character_cast_guardrails';
import { extractWriterVisibleContent } from './writer_response_content';
import { getOpenHooksForProject } from '../memory/pending_hooks_repository';
import {
  detectExpectation,
  extractAnchors,
  pickBestBranch,
  validateDivergence,
} from './surprise_engine';
import { callAiModelTracked } from './tracked_ai_client';
import { callAiStreaming } from './streaming_ai_client';

const MAX_STREAM_MODEL_ATTEMPTS = 3;
const MAX_STREAM_CONTINUATIONS = 2;
const WEAK_TITLE_VALUES = new Set([
  '',
  '(trống)',
  'trống',
  'untitled',
  'không tên',
  'chưa đặt tên',
  'chương không tên',
  'tên chương',
  'chapter title',
]);

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

function normalizeTitleCandidate(value: unknown): string {
  return String(value || '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWeakChapterTitle(value: unknown): boolean {
  const normalized = normalizeTitleCandidate(value);
  if (!normalized) return true;
  return WEAK_TITLE_VALUES.has(normalized.toLocaleLowerCase('vi-VN'));
}

export function resolveChapterWriteTitle(
  project: Project,
  targetChapterIndex: number,
  branch: SurpriseBranch,
): string {
  const chapterNumber = targetChapterIndex + 1;
  const existingChapter = project.chapters.find((chapter) => (
    (chapter.sequenceNumber ?? 0) === chapterNumber
  ));
  const candidates = [
    branch.suggestedTitle,
    project.outline[targetChapterIndex]?.title,
    existingChapter?.title,
  ];

  for (const candidate of candidates) {
    if (!isWeakChapterTitle(candidate)) {
      return normalizeTitleCandidate(candidate);
    }
  }

  return `Chương ${chapterNumber}`;
}

/**
 * Fallback: khi không có sentinel markers, cố gắng extract nội dung từ raw text.
 * Loại bỏ phần JSON ledger nếu có ở đầu/cuối, giữ lại phần văn xuôi.
 */
function extractContentFallback(responseText: string): { ledger: ChapterLedger; content: string } {
  let contentText = extractWriterVisibleContent(responseText);
  let ledger = buildDefaultLedger();

  // Case 1: Starts with JSON block {…} then prose
  if (contentText.startsWith('{')) {
    try {
      const firstBrace = contentText.indexOf('{');
      const lastBrace = contentText.indexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonPart = contentText.slice(firstBrace, lastBrace + 1);
        const rest = contentText.slice(lastBrace + 1).trim();
        if (rest.length > 100) {
          const ledgerJson = JSON.parse(jsonPart) as Partial<ChapterLedger>;
          ledger = {
            summary: String(ledgerJson.summary || '').trim(),
            beatStatus: ledgerJson.beatStatus === 'delay' || ledgerJson.beatStatus === 'replace' ? ledgerJson.beatStatus : 'hit' as const,
            usedCharacterNames: normalizeList(ledgerJson.usedCharacterNames),
            introducedEntities: normalizeList(ledgerJson.introducedEntities),
            foreshadowPlanted: normalizeList(ledgerJson.foreshadowPlanted),
            preservedAnchorIds: normalizeList(ledgerJson.preservedAnchorIds),
          };
          contentText = rest;
        }
      }
    } catch {
      // not valid JSON — fall through
    }
  }

  // Case 2: No structure at all — accept any non-empty prose after sanitation.
  const guardedContent = guardChapterContent(contentText);
  if (!guardedContent.rejected && guardedContent.content.trim()) {
    return { ledger, content: guardedContent.content };
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
  
  let content = '';
  let ledgerText = '';
  let ecotAnalysis = '';

  const extractBlock = (marker: string): string => {
    const idx = responseText.indexOf(marker);
    if (idx === -1) return '';
    const start = idx + marker.length;
    const nextIdxs = [
      responseText.indexOf(ecotMarker, start),
      responseText.indexOf(ledgerMarker, start),
      responseText.indexOf(contentMarker, start),
    ].filter(i => i !== -1);
    
    const end = nextIdxs.length > 0 ? Math.min(...nextIdxs) : responseText.length;
    return responseText.slice(start, end).trim();
  };

  ecotAnalysis = extractBlock(ecotMarker);
  ledgerText = extractBlock(ledgerMarker);
  content = extractBlock(contentMarker);

  let ledger = buildDefaultLedger();
  
  if (ledgerText) {
    try {
      const ledgerJson = JSON.parse(extractJsonObject(ledgerText)) as Partial<ChapterLedger>;
      ledger = {
        summary: String(ledgerJson.summary || '').trim(),
        beatStatus: ledgerJson.beatStatus === 'delay' || ledgerJson.beatStatus === 'replace' ? ledgerJson.beatStatus : 'hit',
        usedCharacterNames: normalizeList(ledgerJson.usedCharacterNames),
        introducedEntities: normalizeList(ledgerJson.introducedEntities),
        foreshadowPlanted: normalizeList(ledgerJson.foreshadowPlanted),
        preservedAnchorIds: normalizeList(ledgerJson.preservedAnchorIds),
      };
    } catch (parseErr) {
      console.warn('[parseWriterResponse] Ledger JSON parse failed:', parseErr);
    }
  }

  if (!content) {
    console.warn('[parseWriterResponse] @@CONTENT@@ missing or empty. Using fallback.');
    try {
      const fallbackResult = extractContentFallback(responseText);
      content = fallbackResult.content;
      if (!ledgerText || !ledger.summary) {
        ledger = fallbackResult.ledger;
      }
    } catch {
      throw new Error('Writer output vi phạm sentinel contract: metadata nội bộ hoặc phản hồi dang dở không được phép lưu.');
    }
  }

  const guardedContent = guardChapterContent(content);
  if (guardedContent.rejected || !guardedContent.content.trim()) {
    throw new Error('Writer output vi phạm sentinel contract: metadata nội bộ hoặc phản hồi dang dở không được phép lưu.');
  }

  content = guardedContent.content;

  return { ledger, content, ecotAnalysis: ecotAnalysis || undefined };
}

function mergeWriterContextText(primaryContext: string, ghostwriterContext: string): string {
  const trimmedPrimary = primaryContext.trim();
  const trimmedGhostwriter = ghostwriterContext.trim();

  if (!trimmedGhostwriter) return trimmedPrimary;
  if (!trimmedPrimary) return trimmedGhostwriter;

  return [
    trimmedPrimary,
    '## NGỮ CẢNH VIẾT BỔ SUNG',
    trimmedGhostwriter,
  ].join('\n\n');
}

async function resolveTaskModel(
  taskType: 'plan_chapter' | 'write_chapter',
  excludedModelIds: string[] = [],
) {
  const aiState = useAiStore.getState();
  const model = getModelForTask(
    taskType,
    aiState.models,
    undefined,
    aiState.activeModelId,
    aiState.taskModelOverrides,
    aiState.modelHealth,
    excludedModelIds,
    aiState.preferredProvider
  );
  if (!model) {
    throw new Error('Không tìm thấy model AI khả dụng.');
  }
  return { model };
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) return error.message.toLowerCase().includes('abort');
  return false;
}

function isRecoverableModelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return [
    'timed out',
    'timeout',
    'failed to fetch',
    'fetch failed',
    'networkerror',
    'econnrefused',
    'econnreset',
    'etimedout',
    'rate limit',
    'rate_limit',
    'too many requests',
    'quota',
    ' 429',
    ': 429',
    ' 500',
    ': 500',
    ' 502',
    ': 502',
    ' 503',
    ': 503',
    ' 504',
    ': 504',
    'model_not_found',
    'model not found',
    'invalid_api_key',
    'invalid api key',
    'authentication_error',
    'local ai proxy không phản hồi',
    'không kết nối được tới provider',
  ].some((keyword) => message.includes(keyword));
}

function markModelUnavailable(modelId: string, error: unknown): void {
  const store = useAiStore.getState();
  store.markModelUnavailable?.(modelId, {
    lastError: error instanceof Error ? error.message : String(error),
  });
}

function findOverlapLength(left: string, right: string): number {
  const max = Math.min(800, left.length, right.length);
  for (let length = max; length >= 20; length -= 1) {
    if (left.slice(-length) === right.slice(0, length)) {
      return length;
    }
  }
  return 0;
}

function joinContinuationText(left: string, right: string): string {
  const overlap = findOverlapLength(left, right);
  if (overlap > 0) return left + right.slice(overlap);
  if (/[,.!?;:…]$/u.test(left) && /^\S/u.test(right)) {
    return `${left} ${right}`;
  }
  return left + right;
}

function extractMarkedBlock(responseText: string, marker: string, followingMarkers: string[]): string {
  const index = responseText.indexOf(marker);
  if (index === -1) return '';

  const start = index + marker.length;
  const nextIndexes = followingMarkers
    .map((candidate) => responseText.indexOf(candidate, start))
    .filter((candidate) => candidate !== -1);
  const end = nextIndexes.length > 0 ? Math.min(...nextIndexes) : responseText.length;
  return responseText.slice(start, end).trim();
}

function mergeContinuationResponse(partialResponse: string, continuationResponse: string): string {
  const continuation = continuationResponse.trimStart();
  if (!continuation) return partialResponse;

  if (partialResponse.includes('@@CONTENT@@') && continuation.includes('@@CONTENT@@')) {
    const partialEcot = extractMarkedBlock(partialResponse, '@@ECOT_ANALYSIS@@', ['@@LEDGER@@', '@@CONTENT@@']);
    const continuationEcot = extractMarkedBlock(continuation, '@@ECOT_ANALYSIS@@', ['@@LEDGER@@', '@@CONTENT@@']);
    const partialLedger = extractMarkedBlock(partialResponse, '@@LEDGER@@', ['@@CONTENT@@']);
    const continuationLedger = extractMarkedBlock(continuation, '@@LEDGER@@', ['@@CONTENT@@']);
    const partialContent = extractWriterVisibleContent(partialResponse);
    const continuationContent = extractWriterVisibleContent(continuation);

    return [
      '@@ECOT_ANALYSIS@@',
      partialEcot || continuationEcot || 'Tự động nối tiếp phản hồi bị cắt.',
      '@@LEDGER@@',
      partialLedger || continuationLedger || JSON.stringify(buildDefaultLedger()),
      '@@CONTENT@@',
      joinContinuationText(partialContent, continuationContent),
    ].join('\n');
  }

  return joinContinuationText(partialResponse, continuation);
}

function buildContinuationPrompt(originalUserPrompt: string, partialResponse: string): string {
  return [
    originalUserPrompt,
    '',
    '---',
    'PHẢN HỒI TRƯỚC BỊ CẮT GIỮA CHỪNG. Hãy viết phần CÒN THIẾU để hoàn tất cùng output contract.',
    'Không lặp lại phần đã có. Nếu đang dở câu, bắt đầu bằng đúng ký tự/cụm tiếp theo để nối mạch.',
    'Nếu phần @@LEDGER@@ đã có, ưu tiên tiếp tục @@CONTENT@@. Nếu thiếu marker nào, bổ sung marker còn thiếu.',
    '',
    'PHẦN ĐÃ CÓ:',
    partialResponse.slice(-12_000),
  ].join('\n');
}

async function completeInterruptedWriterResponse(opts: {
  partialResponse: string;
  model: { provider: string; modelId: string; name: string; baseUrl?: string };
  prompts: { system: string; user: string };
  pipelineSessionId?: string;
  signal?: AbortSignal;
}): Promise<string> {
  let responseText = opts.partialResponse;

  for (let pass = 0; pass < MAX_STREAM_CONTINUATIONS; pass += 1) {
    const continuation = await callAiModelTracked({
      provider: opts.model.provider,
      modelId: opts.model.modelId,
      modelName: opts.model.name,
      baseUrl: opts.model.baseUrl,
      systemPrompt: [
        opts.prompts.system,
        'RECOVERY MODE: hoàn tất phản hồi writer bị cắt. Trả phần nối tiếp, không viết lại từ đầu.',
      ].join('\n\n'),
      userPrompt: buildContinuationPrompt(opts.prompts.user, responseText),
      taskType: 'write_chapter',
      skipCache: true,
      pipelineSessionId: opts.pipelineSessionId,
      pipelineStep: 'write_chapter',
      signal: opts.signal,
    });

    if (!continuation.trim()) break;
    responseText = mergeContinuationResponse(responseText, continuation);

    try {
      parseWriterResponse(responseText);
      break;
    } catch {
      // One more continuation pass may supply a missing marker or unfinished sentence.
    }
  }

  return responseText;
}

async function callStreamingWithModelFallback(opts: {
  initialModel: { id: string; provider: string; modelId: string; name: string; baseUrl?: string };
  prompts: { system: string; user: string };
  taskType: 'write_chapter';
  onChunk: (chunk: string, accumulated: string) => void;
  signal?: AbortSignal;
}): Promise<{
  text: string;
  completed: boolean;
  model: { id: string; provider: string; modelId: string; name: string; baseUrl?: string };
}> {
  const excludedModelIds: string[] = [];
  let model = opts.initialModel;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_STREAM_MODEL_ATTEMPTS; attempt += 1) {
    try {
      const result = await callAiStreaming({
        provider: model.provider,
        modelId: model.modelId,
        modelName: model.name,
        baseUrl: model.baseUrl,
        systemPrompt: opts.prompts.system,
        userPrompt: opts.prompts.user,
        taskType: opts.taskType,
        signal: opts.signal,
        onChunk: opts.onChunk,
      });

      return { ...result, model };
    } catch (error) {
      lastError = error;
      if (isAbortLikeError(error) || !isRecoverableModelError(error)) {
        throw error;
      }

      excludedModelIds.push(model.id);
      markModelUnavailable(model.id, error);
      const next = await resolveTaskModel(opts.taskType, excludedModelIds).catch(() => null);
      if (!next?.model) break;
      model = next.model;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Không thể stream nội dung từ model AI hiện tại.');
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
  const activeHooks = await getOpenHooksForProject(project.id).catch(() => []);
  const anchors = extractAnchors(project, targetChapterIndex, activeHooks);
  const expectation = detectExpectation(project, targetChapterIndex, anchors, activeHooks);
  const { model } = await resolveTaskModel('plan_chapter');
  const prompts = buildBranchPlannerPrompts({
    project,
    targetChapterIndex,
    tensionLevel,
    anchors,
    expectation,
    currentBeat: project.outline[targetChapterIndex],
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
  const activeHooks = await getOpenHooksForProject(project.id).catch(() => []);
  const anchors = extractAnchors(project, targetChapterIndex, activeHooks);
  const expectation = detectExpectation(project, targetChapterIndex, anchors, activeHooks);
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
    characterGuardrails: buildChapterCharacterGuardrails(project, targetChapterIndex),
    branch,
    tensionLevel,
    prompt,
    notes,
    styleInstruction,
  });

  // [Domain:AI] STEP — Use streaming client when onChunk callback is provided
  let responseText: string;
  if (onChunk) {
    const streamResult = await callStreamingWithModelFallback({
      initialModel: model,
      prompts,
      taskType: 'write_chapter',
      signal,
      onChunk,
    });
    responseText = streamResult.text;
    if (!responseText.trim() && !streamResult.completed) {
      throw new Error('Người dùng đã dừng quá trình tạo nội dung.');
    }
    if (responseText.trim() && !streamResult.completed && !signal?.aborted) {
      responseText = await completeInterruptedWriterResponse({
        partialResponse: responseText,
        model: streamResult.model,
        prompts,
        pipelineSessionId,
        signal,
      });
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
    title: resolveChapterWriteTitle(project, targetChapterIndex, branch),
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
