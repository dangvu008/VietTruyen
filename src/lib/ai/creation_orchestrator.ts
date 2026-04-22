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
import { callAiModelTracked } from './tracked_ai_client';
import { getModelForTask } from './model_router';
import {
  buildDiscussResponsePrompt,
  buildAiDecidePrompt,
  buildPlotPreviewPrompt,
  buildPlotPreviewRevisionPrompt,
  buildCreationFrameworkPrompt,
  CHAPTER_OPENING_CHIPS,
} from './creation_prompts';
import { DISCUSS_TOPICS } from './creation_discuss_config';
import { generateMasterOutline } from './outline_planner';
import { createId } from '../../core/id';
import { buildCreationProjectSeed } from '../creation/project_seed';
import type { CreationPlotPreview } from '../../types/creation_chat';
import type { BrainstormResult } from '../../types/narrative_memory';
import type { Chapter, Project } from '../../types/story';
import type { SupportedWorkflowIntent, WorkflowSession } from '../../types/workflow';

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
    },
  };
}

function ensureDraftChapterPersisted(params: {
  projectId: string;
  existingChapter?: Chapter;
  writeResult: NonNullable<WorkflowSession['artifacts']['chapterWriteResult']>;
  chapterIndex: number;
}): void {
  const { projectId, existingChapter, writeResult, chapterIndex } = params;
  const now = new Date().toISOString();

  if (existingChapter) {
    useProjectStore.getState().updateChapter(projectId, existingChapter.id, {
      title: writeResult.title || existingChapter.title,
      content: writeResult.content,
      summary: writeResult.ledger.summary || existingChapter.summary,
      status: 'draft',
      updatedAt: now,
    });
    return;
  }

  useProjectStore.getState().addChapter(projectId, {
    id: createId(),
    title: writeResult.title || `Chương ${chapterIndex + 1}`,
    content: writeResult.content,
    summary: writeResult.ledger.summary,
    sequenceNumber: chapterIndex + 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });
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
    const firstTopic = DISCUSS_TOPICS[0];
    const model = await resolveModel();

    const prompt = buildDiscussResponsePrompt(ideaText, 'intro', ideaText, {});
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
    });

    // AI response + suggestion chips for first topic
    addAiSuggestions(
      response,
      firstTopic.suggestionGroups,
      firstTopic.aiDecideLabel,
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

  const currentTopic = DISCUSS_TOPICS[currentTopicIndex];
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
    const originalIdea = getOriginalIdea();
    const updatedAnswers = { ...answers, [currentTopic.id]: chosenText };

    // AI phản hồi lựa chọn
    const prompt = buildDiscussResponsePrompt(
      originalIdea, currentTopic.id, chosenText, updatedAnswers,
    );
    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'brainstorm',
    });

    // Check if there are more topics
    const nextIndex = currentTopicIndex + 1;
    if (nextIndex < DISCUSS_TOPICS.length) {
      const nextTopic = DISCUSS_TOPICS[nextIndex];
      // AI response + next topic's chips
      addAiSuggestions(
        response + `\n\n${nextTopic.questionTemplate}`,
        nextTopic.suggestionGroups,
        nextTopic.aiDecideLabel,
      );
      setCurrentTopicIndex(nextIndex);
      finishWorkflowStep(
        'discuss',
        `Đã lưu phản hồi và chuyển sang câu hỏi ${nextIndex + 1}/${DISCUSS_TOPICS.length}.`,
      );
    } else {
      addAiText(
        `${response}\n\n📝 Đã có đủ nền tảng. Mình sẽ tóm tắt lại cốt truyện để bạn review trước khi dựng toàn bộ khung truyện.`,
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

  const currentTopic = DISCUSS_TOPICS[currentTopicIndex];
  if (!currentTopic) return;

  addUserText(`🤖 Để AI chọn: ${currentTopic.questionTemplate}`);

  const model = await resolveModel();
  const originalIdea = getOriginalIdea();
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
    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'brainstorm',
    });

    // Save AI's choice as the answer
    store.setAnswer(currentTopic.id, `(AI chọn) ${response}`);

    // Move to next topic
    const nextIndex = currentTopicIndex + 1;
    if (nextIndex < DISCUSS_TOPICS.length) {
      const nextTopic = DISCUSS_TOPICS[nextIndex];
      store.addAiSuggestions(
        response + `\n\n${nextTopic.questionTemplate}`,
        nextTopic.suggestionGroups,
        nextTopic.aiDecideLabel,
      );
      store.setCurrentTopicIndex(nextIndex);
      finishWorkflowStep(
        'discuss',
        `AI đã chốt chủ đề hiện tại và chuyển sang câu hỏi ${nextIndex + 1}/${DISCUSS_TOPICS.length}.`,
      );
    } else {
      store.addAiText(
        `${response}\n\n📝 Đã có đủ nền tảng. Mình sẽ tóm tắt lại cốt truyện để bạn review trước khi dựng toàn bộ khung truyện.`,
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
    const model = await resolveModel();
    const prompt = revisionFeedback && plotPreview
      ? buildPlotPreviewRevisionPrompt(originalIdea, answers, plotPreview, revisionFeedback)
      : buildPlotPreviewPrompt(originalIdea, answers, chatHistory);

    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'brainstorm',
      responseFormat: 'json_object',
      skipCache: true,
    });

    const result: CreationPlotPreview = JSON.parse(extractJsonObject(response));
    store.addPlotPreview(
      result,
      revisionFeedback
        ? 'Mình đã cập nhật lại bản cốt truyện theo góp ý mới. Nếu ổn, hãy chốt để AI dựng khung chi tiết.'
        : 'Đây là bản review cốt truyện. Bạn có thể góp ý thêm trong chat hoặc chốt để AI dựng khung chi tiết.',
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
    const model = await resolveModel();
    const prompt = buildCreationFrameworkPrompt(originalIdea, answers, chatHistory, plotPreview);

    const response = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      taskType: 'brainstorm',
      responseFormat: 'json_object',
      skipCache: true,
    });

    const result: BrainstormResult = JSON.parse(extractJsonObject(response));

    // Transition to framework phase + add preview message
    store.setPhase('framework');
    store.addFrameworkPreview(result);
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
 * User xác nhận framework → apply vào project + chuyển Phase 4
 */
export async function handleFrameworkConfirm(): Promise<{ projectId: string } | null> {
  const store = getStore();
  const { framework } = store;
  if (!framework) return null;

  const projectId = await ensureProjectFromFramework(framework);

  // ── [Yêu cầu #1] Tự động tạo Tổng cương sau khi confirm framework ──
  // Lấy project đã được cập nhật (bao gồm bible + characters + world)
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
  store.addSystemMessage('✅ Đã lưu khung truyện vào dự án. Đang mở workspace writer...');
  store.finishWorkflowStep('compose', 'Khung truyện đã được xác nhận, sẵn sàng viết chương.', {
    linkedProjectId: projectId,
  });

  // Show chapter opening style suggestions
  const firstOutline = framework.outline?.[0];
  const chapterTitle = framework.chapterSkeleton?.[0]?.title || firstOutline?.title || 'Chương 1';

  store.addAiSuggestions(
    `Bắt đầu viết ${chapterTitle}.\n\nBạn muốn mở đầu chương kiểu gì?`,
    [{
      groupLabel: 'Phong cách mở đầu:',
      chips: CHAPTER_OPENING_CHIPS,
    }],
    '🤖 AI tự chọn cách mở đầu phù hợp nhất',
  );

  return { projectId };
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
    const writeResult = session.artifacts.chapterWriteResult;
    if (!writeResult?.content?.trim()) {
      throw new Error(session.error?.message || 'AI không tạo được bản nháp chương.');
    }

    ensureDraftChapterPersisted({
      projectId,
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
export function handleAcceptChapter(
  chapterIndex: number,
  title: string,
  content: string,
): void {
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
    useProjectStore.getState().updateChapter(project.id, existingProjectChapter.id, {
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

    useProjectStore.getState().addChapter(project.id, newChapter);
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
