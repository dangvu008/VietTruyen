/**
 * File: creation_orchestrator.ts
 * Purpose: Orchestrate the 4-phase creation chat flow — AI calls + phase transitions
 * Layer: Application (Orchestrator)
 * Domain: CreationChat → [describe→discuss→framework→compose]
 *
 * Data Contract:
 * - Input:  User actions (send idea, choose chip, confirm framework, etc.)
 * - Output: Side effects on useCreationChatStore (messages, phase transitions)
 * - AI:     All calls go through tracked_ai_client
 */

import { useCreationChatStore } from '../../store/use_creation_chat_store';
import { useAiStore } from '../../store/use_ai_store';
import {
  useProjectStore,
  getActiveProject,
  getProjectSnapshot,
} from '../../store/use_project_store';
import { useWorkflowSessionStore } from '../../store/use_workflow_session_store';
import { useTokenStore } from '../../store/use_token_store';
import { callAiModelTracked } from './tracked_ai_client';
import { getModelForTask } from './model_router';
import {
  buildDiscussResponsePrompt,
  buildAiDecidePrompt,
  buildPlotPreviewPrompt,
  buildPlotPreviewRevisionPrompt,
  buildCreationFrameworkPrompt,
} from './creation_prompts';
import { getDiscussTopicsForIdea } from './creation_discuss_config';
import { generateMasterOutline } from './outline_planner';
import { createId } from '../../core/id';
import { buildCreationProjectSeed } from '../creation/project_seed';
import type { CreationMessageTokenUsage, CreationPlotPreview } from '../../types/creation_chat';
import type { BrainstormResult } from '../../types/narrative_memory';
import type { Chapter, Project } from '../../types/story';
import type { SupportedWorkflowIntent, WorkflowSession } from '../../types/workflow';
import type { TokenUsageRecord } from '../../types/token_tracker';

// ─── Helpers ────────────────────────────────────────────────

function getStore() {
  return useCreationChatStore.getState();
}

async function resolveModel(task: 'brainstorm' | 'plan_chapter' | 'write_chapter' = 'brainstorm') {
  const aiState = useAiStore.getState();
  const model = getModelForTask(
    task,
    aiState.models,
    undefined,
    aiState.activeModelId,
    aiState.taskModelOverrides
  );
  if (!model) throw new Error('Chưa cấu hình AI model. Vào Cài đặt → AI.');
  return model;
}

function cleanJson(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function extractJsonObject(text: string): string {
  const cleaned = cleanJson(text);
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function toMessageTokenUsage(record: TokenUsageRecord): CreationMessageTokenUsage {
  return {
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens: record.totalTokens,
    estimatedCost: record.estimatedCost,
    cached: record.cached,
    modelName: record.modelName,
    durationMs: record.durationMs,
    callCount: 1,
  };
}

function sumMessageTokenUsage(records: TokenUsageRecord[]): CreationMessageTokenUsage | undefined {
  if (records.length === 0) return undefined;

  const latest = records[0];
  return {
    inputTokens: records.reduce((sum, record) => sum + record.inputTokens, 0),
    outputTokens: records.reduce((sum, record) => sum + record.outputTokens, 0),
    totalTokens: records.reduce((sum, record) => sum + record.totalTokens, 0),
    estimatedCost: records.reduce((sum, record) => sum + record.estimatedCost, 0),
    cached: records.every((record) => record.cached),
    modelName: latest.modelName,
    durationMs: records.reduce((sum, record) => sum + record.durationMs, 0),
    callCount: records.length,
  };
}

function createUsageCapture(): {
  setRecord: (record: TokenUsageRecord) => void;
  getUsage: () => CreationMessageTokenUsage | undefined;
} {
  let usage: CreationMessageTokenUsage | undefined;
  return {
    setRecord: (record) => {
      usage = toMessageTokenUsage(record);
    },
    getUsage: () => usage,
  };
}

function getFrameworkContextMessages(): Array<{ role: 'user'; content: string }> {
  return getStore()
    .messages
    .filter((m) => m.role === 'user' && m.type === 'text')
    .slice(1)
    .map((m) => ({
      role: 'user' as const,
      content: m.content.trim().slice(0, 280),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-6);
}

function getOriginalIdea(): string {
  const firstUserMsg = getStore().messages.find((m) => m.role === 'user');
  return firstUserMsg?.content || '';
}

function getLinkedProjectId(): string | null {
  return getStore().progress.linkedProjectId;
}

async function ensureProjectFromFramework(framework: BrainstormResult): Promise<string> {
  const store = getStore();
  const seed = buildCreationProjectSeed({
    framework,
    acceptedChapters: store.acceptedChapters,
    createId,
  });
  const projectState = useProjectStore.getState();
  const projectId = getLinkedProjectId() || projectState.createProject(seed.projectPatch.title);

  projectState.updateProject(projectId, seed.projectPatch);

  if (seed.chapters.length > 0) {
    await projectState.replaceProjectChapters(projectId, seed.chapters, {
      storageMode: 'indexeddb',
    });
  }

  store.linkProject(projectId);
  return projectId;
}

function buildFullPipelineIntent(params: {
  projectId: string;
  chapterId?: string;
  project: Project;
  targetChapterIndex: number;
  prompt?: string;
  notes?: string;
}): SupportedWorkflowIntent {
  const { projectId, chapterId, project, targetChapterIndex, prompt, notes } = params;

  return {
    id: createId(),
    type: 'full_write_pipeline',
    projectId,
    chapterId,
    source: 'system',
    createdAt: new Date().toISOString(),
    payload: {
      workflowEngine: 'api',
      project,
      targetChapterIndex,
      mode: targetChapterIndex === 0 ? 'create' : 'continue',
      tensionLevel: 'nudge',
      prompt,
      notes,
      styleInstruction: project.writingStyle || undefined,
      skipReview: true,
      skipPolish: true,
      qualityMode: 'fast',
    },
  };
}

async function persistDraftChapter(params: {
  projectId: string;
  project: Project;
  existingChapter?: Chapter;
  writeResult: NonNullable<WorkflowSession['artifacts']['chapterWriteResult']>;
  chapterIndex: number;
}): Promise<{ chapter: Chapter; project: Project }> {
  const { projectId, project, existingChapter, writeResult, chapterIndex } = params;
  const now = new Date().toISOString();

  if (existingChapter) {
    const nextChapter: Chapter = {
      ...existingChapter,
      title: writeResult.title || existingChapter.title,
      content: writeResult.content,
      summary: writeResult.ledger.summary || existingChapter.summary,
      status: 'draft',
      updatedAt: now,
    };
    const nextProject = mergePersistedChapter(project, nextChapter);
    await useProjectStore.getState().replaceProjectChapters(projectId, nextProject.chapters, {
      storageMode: 'indexeddb',
    });
    return { chapter: nextChapter, project: nextProject };
  }

  const nextChapter: Chapter = {
    id: createId(),
    title: writeResult.title || `Chương ${chapterIndex + 1}`,
    content: writeResult.content,
    summary: writeResult.ledger.summary,
    sequenceNumber: chapterIndex + 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  const nextProject = mergePersistedChapter(project, nextChapter);
  await useProjectStore.getState().replaceProjectChapters(projectId, nextProject.chapters, {
    storageMode: 'indexeddb',
  });
  return { chapter: nextChapter, project: nextProject };
}

function mergePersistedChapter(project: Project, chapter: Chapter): Project {
  const chapterSequence = chapter.sequenceNumber ?? 0;
  const existingIndex = project.chapters.findIndex((item) =>
    item.id === chapter.id || (chapterSequence > 0 && item.sequenceNumber === chapterSequence),
  );

  const chapters = [...project.chapters];
  if (existingIndex >= 0) {
    chapters[existingIndex] = chapter;
  } else {
    chapters.push(chapter);
  }

  return {
    ...project,
    chapters,
  };
}

// ═══════════════════════════════════════════════════════════
// Phase 1: DESCRIBE → Receive idea, transition to DISCUSS
// ═══════════════════════════════════════════════════════════

export async function handleDescribeSubmit(ideaText: string): Promise<void> {
  const store = getStore();
  const {
    addUserText,
    setPhase,
    setAiWorking,
    setError,
    addAiSuggestions,
    startWorkflowStep,
    finishWorkflowStep,
    failWorkflowStep,
  } = store;

  addUserText(ideaText);
  setPhase('discuss');
  setAiWorking(true);
  setError(null);
  startWorkflowStep('discuss', 'AI đang phân tích ý tưởng ban đầu và mở vòng thảo luận.');

  try {
    // Show first discussion topic with suggestion chips
    const discussTopics = getDiscussTopicsForIdea(ideaText);
    const firstTopic = discussTopics[0];
    const model = await resolveModel();

    const prompt = buildDiscussResponsePrompt(ideaText, 'intro', ideaText, {});
    const usageCapture = createUsageCapture();
    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: `Ý tưởng ban đầu: "${ideaText}"

Hãy phản hồi tích cực (3-4 câu): khen ý tưởng, phân tích tiềm năng, 
rồi giới thiệu câu hỏi đầu tiên: "${firstTopic.questionTemplate}"`,
      taskType: 'brainstorm',
      onUsage: usageCapture.setRecord,
    });

    // AI response + suggestion chips for first topic
    addAiSuggestions(
      response,
      firstTopic.suggestionGroups,
      firstTopic.aiDecideLabel,
      usageCapture.getUsage(),
    );
    useCreationChatStore.setState({ currentTopicIndex: 0 });
    finishWorkflowStep('discuss', 'Đã mở vòng thảo luận đầu tiên cho cốt truyện và nhân vật.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi xử lý ý tưởng';
    failWorkflowStep('discuss', 'Không thể khởi động vòng thảo luận.', message);
    setError(message);
  } finally {
    setAiWorking(false);
  }
}

// ═══════════════════════════════════════════════════════════
// Phase 2: DISCUSS — Handle chip selection / free text / AI decide
// ═══════════════════════════════════════════════════════════

/**
 * User chọn 1 hoặc nhiều chip, hoặc gõ tự do
 */
export async function handleDiscussAnswer(chosenText: string): Promise<void> {
  const store = getStore();
  const {
    addUserText, addAiSuggestions, addAiText, setAnswer,
    setCurrentTopicIndex, setAiWorking, setError,
    currentTopicIndex, answers, startWorkflowStep, finishWorkflowStep, failWorkflowStep,
  } = store;

  const originalIdea = getOriginalIdea();
  const discussTopics = getDiscussTopicsForIdea(originalIdea);
  const currentTopic = discussTopics[currentTopicIndex];
  if (!currentTopic) return;

  addUserText(chosenText);
  setAnswer(currentTopic.id, chosenText);
  setAiWorking(true);
  setError(null);
  startWorkflowStep(
    'discuss',
    `AI đang tổng hợp phản hồi cho chủ đề "${currentTopic.questionTemplate}".`,
  );

  try {
    const model = await resolveModel();
    const updatedAnswers = { ...answers, [currentTopic.id]: chosenText };

    // AI phản hồi lựa chọn
    const prompt = buildDiscussResponsePrompt(
      originalIdea, currentTopic.id, chosenText, updatedAnswers,
    );
    const usageCapture = createUsageCapture();
    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'brainstorm',
      onUsage: usageCapture.setRecord,
    });

    // Check if there are more topics
    const nextIndex = currentTopicIndex + 1;
    if (nextIndex < discussTopics.length) {
      const nextTopic = discussTopics[nextIndex];
      // AI response + next topic's chips
      addAiSuggestions(
        response + `\n\n${nextTopic.questionTemplate}`,
        nextTopic.suggestionGroups,
        nextTopic.aiDecideLabel,
        usageCapture.getUsage(),
      );
      setCurrentTopicIndex(nextIndex);
      finishWorkflowStep(
        'discuss',
        `Đã lưu phản hồi và chuyển sang câu hỏi ${nextIndex + 1}/${discussTopics.length}.`,
      );
    } else {
      addAiText(
        `${response}\n\n📝 Đã có đủ nền tảng. Mình sẽ tóm tắt lại cốt truyện để bạn review trước khi dựng toàn bộ khung truyện.`,
        usageCapture.getUsage(),
      );
      await generatePlotPreview();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi trong quá trình brainstorm';
    failWorkflowStep('discuss', 'Không thể tiếp tục vòng thảo luận.', message);
    setError(message);
  } finally {
    setAiWorking(false);
  }
}

/**
 * User bấm "🤖 AI tự quyết định" cho 1 topic
 */
export async function handleAiDecide(): Promise<void> {
  const store = getStore();
  const {
    addUserText,
    currentTopicIndex,
    answers,
    startWorkflowStep,
    finishWorkflowStep,
    failWorkflowStep,
  } = store;

  const originalIdea = getOriginalIdea();
  const discussTopics = getDiscussTopicsForIdea(originalIdea);
  const currentTopic = discussTopics[currentTopicIndex];
  if (!currentTopic) return;

  addUserText(`🤖 Để AI chọn: ${currentTopic.questionTemplate}`);

  const model = await resolveModel();
  const availableOptions = currentTopic.suggestionGroups
    .flatMap((g) => g.chips.map((c) => c.value || c.label));

  store.setAiWorking(true);
  store.setError(null);
  startWorkflowStep(
    'discuss',
    `AI đang tự quyết định cho chủ đề "${currentTopic.questionTemplate}".`,
  );

  try {
    const prompt = buildAiDecidePrompt(
      originalIdea, currentTopic.id, availableOptions, answers,
    );
    const usageCapture = createUsageCapture();
    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'brainstorm',
      onUsage: usageCapture.setRecord,
    });

    // Save AI's choice as the answer
    store.setAnswer(currentTopic.id, `(AI chọn) ${response}`);

    // Move to next topic
    const nextIndex = currentTopicIndex + 1;
    if (nextIndex < discussTopics.length) {
      const nextTopic = discussTopics[nextIndex];
      store.addAiSuggestions(
        response + `\n\n${nextTopic.questionTemplate}`,
        nextTopic.suggestionGroups,
        nextTopic.aiDecideLabel,
        usageCapture.getUsage(),
      );
      store.setCurrentTopicIndex(nextIndex);
      finishWorkflowStep(
        'discuss',
        `AI đã chốt chủ đề hiện tại và chuyển sang câu hỏi ${nextIndex + 1}/${discussTopics.length}.`,
      );
    } else {
      store.addAiText(
        `${response}\n\n📝 Đã có đủ nền tảng. Mình sẽ tóm tắt lại cốt truyện để bạn review trước khi dựng toàn bộ khung truyện.`,
        usageCapture.getUsage(),
      );
      await generatePlotPreview();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi AI quyết định';
    failWorkflowStep('discuss', 'AI không thể tự quyết định cho chủ đề hiện tại.', message);
    store.setError(message);
  } finally {
    store.setAiWorking(false);
  }
}

/**
 * User bấm "🚀 AI tự phát triển tất cả" — skip mọi câu hỏi
 */
export async function handleSmartSkip(): Promise<void> {
  const store = getStore();
  store.addUserText('🚀 AI tự phát triển và tạo bản review cốt truyện trước');
  store.addAiText('OK! Mình sẽ tự phát triển ý tưởng và tạo bản review cốt truyện để bạn duyệt trước...');
  store.setAiWorking(true);
  store.startWorkflowStep('review_plot', 'AI đang tự phát triển cốt truyện bản nháp để người viết review.');

  try {
    await generatePlotPreview();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tạo bản review cốt truyện';
    store.failWorkflowStep('review_plot', 'Không thể tạo bản review cốt truyện tự động.', message);
    store.setError(message);
  } finally {
    store.setAiWorking(false);
  }
}

// ═══════════════════════════════════════════════════════════
// Phase 3: FRAMEWORK — Generate + display for confirmation
// ═══════════════════════════════════════════════════════════

async function generatePlotPreview(revisionFeedback?: string): Promise<void> {
  const store = getStore();
  const { answers, plotPreview } = store;
  const originalIdea = getOriginalIdea();
  const chatHistory = getFrameworkContextMessages();
  const loadingId = store.addLoadingMessage();

  store.setPhase('review_plot');
  store.startWorkflowStep(
    'review_plot',
    revisionFeedback
      ? 'AI đang chỉnh lại bản review cốt truyện theo góp ý mới.'
      : 'AI đang tóm tắt cốt truyện để người viết review trước.',
  );

  try {
    const model = await resolveModel('plan_chapter');
    const prompt = revisionFeedback && plotPreview
      ? buildPlotPreviewRevisionPrompt(originalIdea, answers, plotPreview, revisionFeedback)
      : buildPlotPreviewPrompt(originalIdea, answers, chatHistory);

    const usageCapture = createUsageCapture();
    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'plan_chapter',
      responseFormat: 'json_object',
      skipCache: true,
      onUsage: usageCapture.setRecord,
    });

    const result: CreationPlotPreview = JSON.parse(extractJsonObject(response));
    store.addPlotPreview(
      result,
      revisionFeedback
        ? 'Mình đã cập nhật lại bản cốt truyện theo góp ý mới. Nếu ổn, hãy chốt để AI dựng khung chi tiết.'
        : 'Đây là bản review cốt truyện. Bạn có thể góp ý thêm trong chat hoặc chốt để AI dựng khung chi tiết.',
      usageCapture.getUsage(),
    );
    store.finishWorkflowStep(
      'review_plot',
      revisionFeedback
        ? 'Đã cập nhật lại bản cốt truyện để người viết review tiếp.'
        : 'Đã tạo bản review cốt truyện để người viết duyệt.',
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể tạo bản review cốt truyện';
    store.failWorkflowStep('review_plot', 'Bản review cốt truyện chưa được tạo xong.', message);
    throw err;
  } finally {
    store.removeMessage(loadingId);
  }
}

async function generateFramework(): Promise<void> {
  const store = getStore();
  const { answers, plotPreview } = store;
  const originalIdea = getOriginalIdea();
  const chatHistory = getFrameworkContextMessages();
  const loadingId = store.addLoadingMessage();
  store.startWorkflowStep('framework', 'AI đang tạo khung cốt truyện, ý tưởng và nhân vật.');

  try {
    const model = await resolveModel('plan_chapter');
    const prompt = buildCreationFrameworkPrompt(originalIdea, answers, chatHistory, plotPreview);

    const usageCapture = createUsageCapture();
    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'plan_chapter',
      responseFormat: 'json_object',
      skipCache: true,
      onUsage: usageCapture.setRecord,
    });

    const result: BrainstormResult = JSON.parse(extractJsonObject(response));

    // Transition to framework phase + add preview message
    store.setPhase('framework');
    store.addFrameworkPreview(result, usageCapture.getUsage());
    store.finishWorkflowStep('framework', 'Khung truyện đã sẵn sàng để người dùng xác nhận.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể tạo khung truyện';
    store.failWorkflowStep('framework', 'Khung truyện chưa được tạo xong.', message);
    throw err;
  } finally {
    store.removeMessage(loadingId);
  }
}

export async function handlePlotPreviewFeedback(feedback: string): Promise<void> {
  const store = getStore();
  if (!store.plotPreview) return;

  store.addUserText(feedback);
  store.setAiWorking(true);
  store.setError(null);

  try {
    await generatePlotPreview(feedback);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi cập nhật bản review cốt truyện';
    store.setError(message);
  } finally {
    store.setAiWorking(false);
  }
}

export async function handlePlotPreviewConfirm(): Promise<void> {
  const store = getStore();
  if (!store.plotPreview) return;

  store.confirmPlotPreview();
  store.addSystemMessage('✅ Đã chốt cốt truyện. AI bắt đầu dựng khung truyện chi tiết...');
  store.setAiWorking(true);
  store.setError(null);

  try {
    await generateFramework();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tạo khung truyện';
    store.setError(message);
  } finally {
    store.setAiWorking(false);
  }
}

export async function retryFrameworkGeneration(): Promise<void> {
  const store = getStore();
  store.setAiWorking(true);
  store.setError(null);
  store.startWorkflowStep('framework', 'Đang thử tạo lại khung truyện từ phần thảo luận hiện có.');

  try {
    await generateFramework();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể tạo lại khung truyện';
    store.failWorkflowStep('framework', 'Khung truyện chưa được tạo lại thành công.', message);
    store.setError(message);
  } finally {
    store.setAiWorking(false);
  }
}

/**
 * User xác nhận framework → apply vào project + tự động viết tất cả chương
 * Flow: create project → generate outline → batch compose ALL chapters
 */
export interface BatchComposeResult {
  total: number;
  successCount: number;
  failCount: number;
  failedChapterTitles: string[];
}

export interface FrameworkConfirmResult {
  projectId: string;
  batchCompose: BatchComposeResult;
  readyForEditor: boolean;
}

export async function handleFrameworkConfirm(): Promise<FrameworkConfirmResult | null> {
  const store = getStore();
  const { framework } = store;
  if (!framework) return null;

  const projectId = await ensureProjectFromFramework(framework);

  // ── [Yêu cầu #1] Tự động tạo Tổng cương sau khi confirm framework ──
  const updatedProject = await getProjectSnapshot(projectId);
  if (!updatedProject) return null;

  store.addSystemMessage('🔮 AI đang tạo tổng cương...');
  store.startWorkflowStep('outline', 'AI đang phân tích cốt truyện để tạo tổng cương.');

  try {
    const masterOutline = await generateMasterOutline(updatedProject);
    useProjectStore.getState().updateMasterOutline(updatedProject.id, masterOutline);
    store.addSystemMessage(
      `✅ Tổng cương đã tạo xong: ${masterOutline.totalVolumes} quyển · ${masterOutline.totalChapters} chương.`
    );
    store.finishWorkflowStep('outline', `Đã tạo tổng cương ${masterOutline.totalVolumes} quyển.`);
  } catch (err) {
    console.warn('[CreationOrchestrator] Tạo tổng cương thất bại, bỏ qua:', err);
    store.addSystemMessage('⚠️ Tổng cương chưa tạo được. Bạn có thể tạo lại ở trang Dàn ý.');
    store.failWorkflowStep('outline', 'Tạo tổng cương thất bại.', String(err));
  }

  // Transition to compose phase
  store.confirmFramework();
  store.setPhase('compose');
  store.addSystemMessage('✅ Đã lưu khung truyện vào dự án.');
  store.finishWorkflowStep('compose', 'Khung truyện đã được xác nhận, sẵn sàng viết chương.', {
    linkedProjectId: projectId,
  });

  // ── [Core Fix] Tự động viết nội dung cho tất cả chương ──
  // Thay vì chỉ tạo tiêu đề rồi bắt user bấm từng chương
  const batchCompose = await batchComposeAllChapters(projectId);
  const readyForEditor = batchCompose.total === 0 || batchCompose.failCount === 0;

  if (!readyForEditor) {
    const failedList = batchCompose.failedChapterTitles.slice(0, 3).join(', ');
    const suffix = batchCompose.failedChapterTitles.length > 3 ? '...' : '';
    store.setError(
      `AI chưa tạo đủ nội dung chương (${batchCompose.successCount}/${batchCompose.total}). ` +
      `Các chương lỗi: ${failedList}${suffix}. Bấm Thử lại để viết tiếp các chương còn rỗng.`,
    );
  }

  return { projectId, batchCompose, readyForEditor };
}

/**
 * Tự động viết tuần tự nội dung cho tất cả chương rỗng trong project.
 * Chạy ngay sau khi framework được confirm, hiển thị tiến trình real-time trong chat.
 */
export async function batchComposeAllChapters(projectId: string): Promise<BatchComposeResult> {
  const store = getStore();
  const { framework } = store;

  // [Domain:CreationChat] STEP 1 — Load project snapshot to find empty chapters
  let workingProject = await getProjectSnapshot(projectId);
  if (!workingProject) {
    return {
      total: 0,
      successCount: 0,
      failCount: 0,
      failedChapterTitles: [],
    };
  }

  const emptyChapters = workingProject.chapters.filter((ch) => !ch.content?.trim());
  if (emptyChapters.length === 0) {
    store.addSystemMessage('📖 Tất cả chương đã có nội dung.');
    return {
      total: 0,
      successCount: 0,
      failCount: 0,
      failedChapterTitles: [],
    };
  }

  const total = emptyChapters.length;
  store.setIsBatchComposing(true);
  store.setAiWorking(true);
  store.setBatchComposeProgress({
    current: 0,
    total,
    isRunning: true,
    successCount: 0,
    failCount: 0,
  });
  store.addSystemMessage(
    `✍️ Bắt đầu viết nội dung cho ${total} chương. AI sẽ viết từng chương tuần tự...`
  );

  let successCount = 0;
  let failCount = 0;
  const failedChapterTitles: string[] = [];

  // [Domain:CreationChat] STEP 2 — Write each chapter sequentially
  for (let i = 0; i < emptyChapters.length; i++) {
    const ch = emptyChapters[i];
    const chapterIndex = Math.max(
      0,
      (ch.sequenceNumber ?? workingProject.chapters.findIndex((c) => c.id === ch.id) + 1) - 1,
    );

    // Update progress
    store.setBatchComposeProgress({
      current: i + 1,
      total,
      isRunning: true,
      successCount,
      failCount,
    });
    store.setCurrentChapterIndex(chapterIndex);
    store.startWorkflowStep(
      'compose',
      `AI đang viết nháp ${ch.title || `Chương ${chapterIndex + 1}`} (${i + 1}/${total})`,
    );

    try {
      // [Domain:CreationChat] STEP 2a — Build intent and run full_write_pipeline
      const skeletonChapter = framework?.chapterSkeleton?.[chapterIndex];
      const outlineBeat = workingProject.outline?.[chapterIndex];
      const chapterPrompt =
        skeletonChapter?.summary
        || outlineBeat?.summary
        || ch.summary
        || '';

      const previousTokenRecordIds = new Set(
        useTokenStore.getState().records.map((r) => r.id),
      );

      const session = await useWorkflowSessionStore.getState().startIntent(
        buildFullPipelineIntent({
          projectId,
          chapterId: ch.id,
          project: workingProject,
          targetChapterIndex: chapterIndex,
          prompt: chapterPrompt,
          notes: 'Viết nội dung chi tiết cho chương này, bám sát canon, nhân vật, thế giới và outline đã chốt.',
        }),
      );

      const writeResult = session?.artifacts?.chapterWriteResult;
      if (!writeResult?.content?.trim()) {
        throw new Error(session?.error?.message || 'AI không trả về nội dung chương.');
      }

      // [Domain:CreationChat] STEP 2b — Persist chapter content to project store
      const { chapter: persistedChapter, project: persistedProject } = await persistDraftChapter({
        projectId,
        project: workingProject,
        existingChapter: ch,
        writeResult,
        chapterIndex,
      });
      workingProject = persistedProject;

      // [Domain:CreationChat] STEP 2c — Track in creation chat as accepted chapter + draft message
      const chapterTokenUsage = sumMessageTokenUsage(
        useTokenStore
          .getState()
          .records
          .filter((r) => !previousTokenRecordIds.has(r.id)),
      );

      store.addChapterDraft({
        chapterIndex,
        title: writeResult.title || ch.title || `Chương ${chapterIndex + 1}`,
        content: writeResult.content,
        tokenUsage: chapterTokenUsage,
      });

      // Auto-accept the chapter
      const existingAccepted = store.acceptedChapters.find((c) => c.chapterIndex === chapterIndex);
      if (existingAccepted) {
        store.updateAcceptedChapter(existingAccepted.id, {
          title: writeResult.title,
          content: writeResult.content,
        });
      } else {
        store.addAcceptedChapter({
          chapterIndex,
          title: writeResult.title || ch.title || `Chương ${chapterIndex + 1}`,
          content: writeResult.content,
          charCount: writeResult.content.length,
        });
      }

      successCount++;
      store.finishWorkflowStep(
        'compose',
        `Đã viết xong ${writeResult.title || ch.title} (${successCount}/${total})`,
        { lastGeneratedChapterTitle: writeResult.title || ch.title },
      );
    } catch (err) {
      console.error(`[BatchCompose] Failed chapter ${ch.title}:`, err);
      failCount++;
      failedChapterTitles.push(ch.title || `Chương ${chapterIndex + 1}`);
      store.addSystemMessage(
        `⚠️ Lỗi khi viết ${ch.title || `Chương ${chapterIndex + 1}`}: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`
      );
    }
  }

  // [Domain:CreationChat] STEP 3 — Finalize batch compose
  store.setBatchComposeProgress({
    current: total,
    total,
    isRunning: false,
    successCount,
    failCount,
  });
  store.setIsBatchComposing(false);
  store.setAiWorking(false);

  if (failCount === 0) {
    store.addSystemMessage(
      `🎉 Hoàn thành! Đã viết nội dung cho tất cả ${successCount} chương. Bạn có thể mở editor để chỉnh sửa.`
    );
    store.finishWorkflowStep('compose', `Đã viết xong tất cả ${successCount} chương!`, {
      linkedProjectId: projectId,
    });
  } else {
    store.addSystemMessage(
      `📊 Kết quả: ${successCount}/${total} chương thành công, ${failCount} chương cần viết lại.`
    );
    store.finishWorkflowStep(
      'compose',
      `Đã viết ${successCount}/${total} chương. ${failCount} chương cần viết lại.`,
      { linkedProjectId: projectId },
    );
  }

  return {
    total,
    successCount,
    failCount,
    failedChapterTitles,
  };
}

// ═══════════════════════════════════════════════════════════
// Phase 4: COMPOSE — Write chapters one by one
// ═══════════════════════════════════════════════════════════

/**
 * AI viết 1 chương dựa trên outline + user notes
 */
export async function handleWriteChapter(userNotes?: string): Promise<void> {
  const store = getStore();
  const { currentChapterIndex, framework } = store;
  const projectId = getLinkedProjectId() || getActiveProject(useProjectStore.getState())?.id;
  if (!projectId) return;

  if (userNotes) {
    store.addUserText(userNotes);
  }

  store.setAiWorking(true);
  store.setError(null);
  store.startWorkflowStep(
    'compose',
    `AI đang viết nháp Chương ${currentChapterIndex + 1}.`,
  );

  const loadingId = store.addLoadingMessage();

  try {
    const project = await getProjectSnapshot(projectId);
    if (!project) throw new Error('Không tìm thấy dự án đang liên kết để viết chương.');

    const outlineBeat = project.outline?.[currentChapterIndex];
    const skeletonChapter = framework?.chapterSkeleton?.[currentChapterIndex];
    const chapterPrompt = skeletonChapter?.summary
      || outlineBeat?.summary
      || project.chapters.find((chapter) => (chapter.sequenceNumber ?? 0) === currentChapterIndex + 1)?.summary
      || '';
    const existingChapter = project.chapters.find(
      (chapter) => (chapter.sequenceNumber ?? 0) === currentChapterIndex + 1,
    );
    const previousTokenRecordIds = new Set(
      useTokenStore.getState().records.map((record) => record.id),
    );
    const session = await useWorkflowSessionStore.getState().startIntent(
      buildFullPipelineIntent({
        projectId,
        chapterId: existingChapter?.id,
        project,
        targetChapterIndex: currentChapterIndex,
        prompt: chapterPrompt,
        notes: userNotes || undefined,
      }),
    );
    const chapterTokenUsage = sumMessageTokenUsage(
      useTokenStore
        .getState()
        .records
        .filter((record) => !previousTokenRecordIds.has(record.id)),
    );
    const writeResult = session.artifacts.chapterWriteResult;
    if (!writeResult?.content?.trim()) {
      throw new Error(session.error?.message || 'AI không tạo được bản nháp chương.');
    }

    await persistDraftChapter({
      projectId,
      project,
      existingChapter,
      writeResult,
      chapterIndex: currentChapterIndex,
    });

    // Remove loading, add chapter draft
    store.removeMessage(loadingId);
    store.addChapterDraft({
      chapterIndex: currentChapterIndex,
      title: writeResult.title,
      content: writeResult.content,
      tokenUsage: chapterTokenUsage,
    });
    store.linkProject(projectId);
    store.finishWorkflowStep(
      'compose',
      `AI đã tạo xong nháp ${writeResult.title}.`,
      {
        linkedProjectId: projectId,
        lastGeneratedChapterTitle: writeResult.title,
      },
    );
  } catch (err: unknown) {
    store.removeMessage(loadingId);
    const message = err instanceof Error ? err.message : 'Lỗi khi viết chương';
    store.failWorkflowStep('compose', `Không thể tạo nháp Chương ${currentChapterIndex + 1}.`, message);
    store.setError(message);
  } finally {
    store.setAiWorking(false);
  }
}

/**
 * User chấp nhận chương → lưu vào project + hỏi viết tiếp
 */
export async function handleAcceptChapter(
  chapterIndex: number,
  title: string,
  content: string,
): Promise<void> {
  const store = getStore();
  const project =
    (getLinkedProjectId()
      ? useProjectStore.getState().projects.find((item) => item.id === getLinkedProjectId())
      : undefined) || getActiveProject(useProjectStore.getState());
  if (!project) return;

  const now = new Date().toISOString();
  const existingProjectChapter = project.chapters.find(
    (chapter) => (chapter.sequenceNumber ?? 0) === chapterIndex + 1,
  );

  if (existingProjectChapter) {
    await useProjectStore.getState().updateChapter(project.id, existingProjectChapter.id, {
      title,
      content,
      status: 'draft',
      updatedAt: now,
    });
  } else {
    const newChapter: Chapter = {
      id: createId(),
      title,
      content,
      status: 'draft',
      sequenceNumber: chapterIndex + 1,
      createdAt: now,
      updatedAt: now,
    };

    await useProjectStore.getState().addChapter(project.id, newChapter);
  }

  // [Domain:CreationChat] STEP: Save to acceptedChapters for sidebar panel
  const existingAccepted = store.acceptedChapters.find((chapter) => chapter.chapterIndex === chapterIndex);
  if (existingAccepted) {
    store.updateAcceptedChapter(existingAccepted.id, {
      title,
      content,
    });
  } else {
    store.addAcceptedChapter({
      chapterIndex,
      title,
      content,
      charCount: content.length,
    });
  }

  const nextIndex = chapterIndex + 1;
  store.setCurrentChapterIndex(nextIndex);

  const { framework } = store;
  const nextSkeleton = framework?.chapterSkeleton?.[nextIndex];
  const nextOutline = project.outline?.[nextIndex];

  if (nextSkeleton || nextOutline) {
    const nextTitle = nextSkeleton?.title || nextOutline?.title || `Chương ${nextIndex + 1}`;
    const nextSummary = nextSkeleton?.summary || nextOutline?.summary || '';

    store.addAiSuggestions(
      `✅ Đã lưu Chương ${chapterIndex + 1}.\n\nChuẩn bị: ${nextTitle}\n${nextSummary ? `(${nextSummary})` : ''}`,
      [{
        chips: [
          { id: 'continue', emoji: '✍️', label: 'Viết tiếp luôn', value: 'Viết tiếp' },
          { id: 'note', emoji: '💬', label: 'Thêm chỉ dẫn', value: '' },
          { id: 'stop', emoji: '⏸️', label: 'Dừng lại xem đã', value: '' },
        ],
      }],
    );
  } else {
    store.addSystemMessage(
      `✅ Đã lưu Chương ${chapterIndex + 1}. Hoàn thành toàn bộ outline! 🎉`,
    );
  }

  store.finishWorkflowStep(
    'handoff',
    `Đã lưu nháp Chương ${chapterIndex + 1} vào danh sách duyệt.`,
    {
      linkedProjectId: project.id,
      lastGeneratedChapterTitle: title,
    },
  );
}
