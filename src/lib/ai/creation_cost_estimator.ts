/**
 * File: creation_cost_estimator.ts
 * Purpose: Estimate token/cost footprint for creation chat before user spends AI budget
 * Layer: Application (AI)
 * Domain: CreationChat → [preflight cost estimation, whole-story budget preview]
 */
import { getDiscussTopicsForIdea } from './creation_discuss_config';
import {
  buildCreationFrameworkPrompt,
  buildDiscussResponsePrompt,
  buildPlotPreviewPrompt,
} from './creation_prompts';
import { estimateCost, estimateTokens } from './token_estimator';
import type { CreationPhase, CreationPlotPreview } from '../../types/creation_chat';
import type { BrainstormResult } from '../../types/narrative_memory';

export interface CreationCostModelRef {
  modelId: string;
  modelName: string;
}

export interface CreationCostTask {
  id: 'discussion' | 'plot_review' | 'framework' | 'master_outline' | 'story_pipeline';
  name: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  modelName: string;
  note?: string;
}

export interface CreationCostEstimate {
  tasks: CreationCostTask[];
  setupInputTokens: number;
  setupOutputTokens: number;
  setupCost: number;
  fullStoryInputTokens: number;
  fullStoryOutputTokens: number;
  fullStoryCost: number;
  targetChapterCount: number;
  remainingChapterCount: number;
  remainingDiscussTurns: number;
  chapterPipelineSource: 'history' | 'heuristic';
}

interface EstimateCreationCostParams {
  phase: CreationPhase;
  originalIdea: string;
  answers: Record<string, string>;
  currentTopicIndex: number;
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>;
  plotPreview: CreationPlotPreview | null;
  framework: BrainstormResult | null;
  acceptedChapterCount: number;
  brainstormModel: CreationCostModelRef;
  planModel: CreationCostModelRef;
  writeModel: CreationCostModelRef;
  summarizeModel: CreationCostModelRef;
  avgTokensPerPipeline?: number;
}

const DEFAULT_IDEA_PLACEHOLDER =
  'Một người hiện đại bị ném vào thế giới huyền huyễn và buộc phải viết lại số mệnh của chính mình.';
const DEFAULT_TARGET_CHAPTERS = 60;
const DISCUSS_OUTPUT_TOKENS = 220;
const PLOT_REVIEW_OUTPUT_TOKENS = 650;
const FRAMEWORK_OUTPUT_TOKENS = 3200;
const MASTER_OUTLINE_OUTPUT_TOKENS = 1400;
const MIN_PIPELINE_SCALE = 0.65;
const MAX_PIPELINE_SCALE = 1.75;

const ASSUMED_ANSWER_BY_TOPIC: Record<string, string> = {
  magic_system: 'Sức mạnh kết hợp quy tắc riêng của thế giới và một biến số cá nhân của nhân vật chính.',
  story_engine: 'Câu chuyện bám vào bí mật trung tâm và những lựa chọn khó khiến nhân vật phải trả giá.',
  conflict: 'Xung đột leo thang từ sống sót cá nhân thành cuộc đối đầu với một hệ thống kiểm soát lớn hơn.',
  protagonist: 'Nhân vật chính thông minh, có điểm yếu rõ ràng, và buộc phải trưởng thành qua từng arc.',
  tone_antagonist: 'Giọng kể cân bằng giữa chiều sâu cảm xúc và nhịp thương mại; phản diện đủ thông minh để đẩy tension.',
};

const PIPELINE_STEP_TEMPLATES = [
  {
    modelKey: 'planModel',
    inputTokens: 1800,
    outputTokens: 550,
  },
  {
    modelKey: 'writeModel',
    inputTokens: 2600,
    outputTokens: 1700,
  },
  {
    modelKey: 'writeModel',
    inputTokens: 7200,
    outputTokens: 900,
  },
  {
    modelKey: 'summarizeModel',
    inputTokens: 1200,
    outputTokens: 260,
  },
] as const;

function resolveIdeaText(originalIdea: string): string {
  const trimmed = originalIdea.trim();
  return trimmed || DEFAULT_IDEA_PLACEHOLDER;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeChatHistory(
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>,
): Array<{ role: 'user' | 'ai'; content: string }> {
  return chatHistory
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim().slice(0, 280),
    }))
    .filter((entry) => entry.content.length > 0)
    .slice(-6);
}

function buildExpectedAnswers(
  phase: CreationPhase,
  originalIdea: string,
  answers: Record<string, string>,
  currentTopicIndex: number,
): Record<string, string> {
  const nextAnswers = { ...answers };

  if (phase !== 'describe' && phase !== 'discuss') {
    return nextAnswers;
  }

  const startIndex = phase === 'describe' ? 0 : currentTopicIndex;
  const discussTopics = getDiscussTopicsForIdea(resolveIdeaText(originalIdea));
  for (let index = startIndex; index < discussTopics.length; index += 1) {
    const topic = discussTopics[index];
    if (!nextAnswers[topic.id]) {
      nextAnswers[topic.id] = ASSUMED_ANSWER_BY_TOPIC[topic.id] || 'Người viết chọn phương án gợi ý và thêm vài chi tiết riêng.';
    }
  }

  return nextAnswers;
}

function estimateDiscussionTask(params: {
  phase: CreationPhase;
  originalIdea: string;
  answers: Record<string, string>;
  currentTopicIndex: number;
  model: CreationCostModelRef;
}): { task: CreationCostTask | null; remainingTurns: number; expectedAnswers: Record<string, string> } {
  const { phase, originalIdea, answers, currentTopicIndex, model } = params;
  const resolvedIdea = resolveIdeaText(originalIdea);
  const discussTopics = getDiscussTopicsForIdea(resolvedIdea);
  const expectedAnswers = buildExpectedAnswers(phase, resolvedIdea, answers, currentTopicIndex);

  if (phase !== 'describe' && phase !== 'discuss') {
    return { task: null, remainingTurns: 0, expectedAnswers };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let remainingTurns = 0;

  if (phase === 'describe') {
    const prompt = buildDiscussResponsePrompt(resolvedIdea, 'intro', resolvedIdea, {});
    inputTokens += estimateTokens(`${prompt.system}\n${prompt.user}`);
    outputTokens += DISCUSS_OUTPUT_TOKENS;
    remainingTurns += 1;
  }

  const simulatedAnswers = { ...answers };
  const startIndex = phase === 'describe' ? 0 : currentTopicIndex;
  for (let index = startIndex; index < discussTopics.length; index += 1) {
    const topic = discussTopics[index];
    const assumedAnswer = expectedAnswers[topic.id] || ASSUMED_ANSWER_BY_TOPIC[topic.id];
    const prompt = buildDiscussResponsePrompt(
      resolvedIdea,
      topic.id,
      assumedAnswer,
      simulatedAnswers,
    );
    inputTokens += estimateTokens(`${prompt.system}\n${prompt.user}`);
    outputTokens += DISCUSS_OUTPUT_TOKENS;
    remainingTurns += 1;
    simulatedAnswers[topic.id] = assumedAnswer;
  }

  return {
    task: {
      id: 'discussion',
      name: 'Hoàn tất phần thảo luận ý tưởng',
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCost: estimateCost(inputTokens, outputTokens, model.modelId),
      modelName: model.modelName,
      note: `${remainingTurns} lượt AI còn lại để chốt premise, nhân vật, xung đột và giọng kể.`,
    },
    remainingTurns,
    expectedAnswers,
  };
}

function estimatePlotReviewTask(params: {
  phase: CreationPhase;
  originalIdea: string;
  expectedAnswers: Record<string, string>;
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>;
  plotPreview: CreationPlotPreview | null;
  model: CreationCostModelRef;
}): CreationCostTask | null {
  const { phase, originalIdea, expectedAnswers, chatHistory, plotPreview, model } = params;

  if ((phase === 'review_plot' && plotPreview) || phase === 'framework' || phase === 'compose') {
    return null;
  }

  const prompt = buildPlotPreviewPrompt(
    resolveIdeaText(originalIdea),
    expectedAnswers,
    normalizeChatHistory(chatHistory),
  );
  const inputTokens = estimateTokens(`${prompt.system}\n${prompt.user}`);
  const outputTokens = PLOT_REVIEW_OUTPUT_TOKENS;

  return {
    id: 'plot_review',
    name: 'Review cốt truyện trước khi dựng khung',
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCost: estimateCost(inputTokens, outputTokens, model.modelId),
    modelName: model.modelName,
    note: 'Bước này tạo bản tóm tắt premise để người viết duyệt trước.',
  };
}

function estimateFrameworkTask(params: {
  phase: CreationPhase;
  originalIdea: string;
  expectedAnswers: Record<string, string>;
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>;
  plotPreview: CreationPlotPreview | null;
  framework: BrainstormResult | null;
  model: CreationCostModelRef;
}): CreationCostTask | null {
  const { phase, originalIdea, expectedAnswers, chatHistory, plotPreview, framework, model } = params;

  if ((phase === 'framework' && framework) || phase === 'compose') {
    return null;
  }

  const prompt = buildCreationFrameworkPrompt(
    resolveIdeaText(originalIdea),
    expectedAnswers,
    normalizeChatHistory(chatHistory),
    plotPreview,
  );
  const inputTokens = estimateTokens(`${prompt.system}\n${prompt.user}`);
  const outputTokens = FRAMEWORK_OUTPUT_TOKENS;

  return {
    id: 'framework',
    name: 'Dựng framework truyện',
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCost: estimateCost(inputTokens, outputTokens, model.modelId),
    modelName: model.modelName,
    note: 'Bao gồm bible, nhân vật, thế giới, arc lớn và chapter skeleton mở đầu.',
  };
}

export function deriveCreationTargetChapterCount(
  framework: BrainstormResult | null,
  acceptedChapterCount: number,
): number {
  if (framework) {
    const byOutline = framework.outline.length > 0 ? framework.outline.length * 12 : 0;
    const bySkeleton = framework.chapterSkeleton.length > 0 ? framework.chapterSkeleton.length * 6 : 0;
    return clamp(
      Math.max(byOutline, bySkeleton, acceptedChapterCount, DEFAULT_TARGET_CHAPTERS),
      20,
      120,
    );
  }

  return Math.max(DEFAULT_TARGET_CHAPTERS, acceptedChapterCount || 0);
}

function estimateMasterOutlineTask(params: {
  phase: CreationPhase;
  originalIdea: string;
  expectedAnswers: Record<string, string>;
  framework: BrainstormResult | null;
  targetChapterCount: number;
  model: CreationCostModelRef;
}): CreationCostTask | null {
  const { phase, originalIdea, expectedAnswers, framework, targetChapterCount, model } = params;

  if (phase === 'compose') {
    return null;
  }

  const payloadText = framework
    ? JSON.stringify(framework)
    : [resolveIdeaText(originalIdea), ...Object.values(expectedAnswers)].join('\n');
  const inputTokens = estimateTokens(payloadText) + 950;
  const outputTokens = MASTER_OUTLINE_OUTPUT_TOKENS + Math.ceil(targetChapterCount / 10) * 40;

  return {
    id: 'master_outline',
    name: 'Tạo tổng cương toàn truyện',
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCost: estimateCost(inputTokens, outputTokens, model.modelId),
    modelName: model.modelName,
    note: `Giả định tổng thể khoảng ${targetChapterCount} chương để phân chia volume và nhịp lớn.`,
  };
}

function estimateStoryPipelineTask(params: {
  targetChapterCount: number;
  acceptedChapterCount: number;
  avgTokensPerPipeline?: number;
  planModel: CreationCostModelRef;
  writeModel: CreationCostModelRef;
  summarizeModel: CreationCostModelRef;
}): { task: CreationCostTask | null; remainingChapterCount: number; source: 'history' | 'heuristic' } {
  const {
    targetChapterCount,
    acceptedChapterCount,
    avgTokensPerPipeline,
    planModel,
    writeModel,
    summarizeModel,
  } = params;

  const remainingChapterCount = Math.max(targetChapterCount - acceptedChapterCount, 0);
  if (remainingChapterCount === 0) {
    return { task: null, remainingChapterCount, source: avgTokensPerPipeline ? 'history' : 'heuristic' };
  }

  const modelByKey = {
    planModel,
    writeModel,
    summarizeModel,
  } as const;

  const baseTotal = PIPELINE_STEP_TEMPLATES.reduce(
    (sum, step) => sum + step.inputTokens + step.outputTokens,
    0,
  );
  const scale = avgTokensPerPipeline && avgTokensPerPipeline > 0
    ? clamp(avgTokensPerPipeline / baseTotal, MIN_PIPELINE_SCALE, MAX_PIPELINE_SCALE)
    : 1;

  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;

  for (const step of PIPELINE_STEP_TEMPLATES) {
    const scaledInput = Math.round(step.inputTokens * scale * remainingChapterCount);
    const scaledOutput = Math.round(step.outputTokens * scale * remainingChapterCount);
    const model = modelByKey[step.modelKey];
    inputTokens += scaledInput;
    outputTokens += scaledOutput;
    cost += estimateCost(scaledInput, scaledOutput, model.modelId);
  }

  return {
    task: {
      id: 'story_pipeline',
      name: `Viết ${remainingChapterCount} chương còn lại bằng AI`,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCost: cost,
      modelName: writeModel.modelName,
      note: avgTokensPerPipeline && avgTokensPerPipeline > 0
        ? 'Đã hiệu chỉnh theo lịch sử pipeline viết chương gần đây trên máy này.'
        : `Heuristic gồm lập nhánh, viết nháp, checker review và trích xuất dữ liệu cho ${remainingChapterCount} chương.`,
    },
    remainingChapterCount,
    source: avgTokensPerPipeline && avgTokensPerPipeline > 0 ? 'history' : 'heuristic',
  };
}

export function estimateCreationCost(params: EstimateCreationCostParams): CreationCostEstimate {
  const {
    phase,
    originalIdea,
    answers,
    currentTopicIndex,
    chatHistory,
    plotPreview,
    framework,
    acceptedChapterCount,
    brainstormModel,
    planModel,
    writeModel,
    summarizeModel,
    avgTokensPerPipeline,
  } = params;

  const tasks: CreationCostTask[] = [];
  const discussionEstimate = estimateDiscussionTask({
    phase,
    originalIdea,
    answers,
    currentTopicIndex,
    model: brainstormModel,
  });

  if (discussionEstimate.task) {
    tasks.push(discussionEstimate.task);
  }

  const plotReviewTask = estimatePlotReviewTask({
    phase,
    originalIdea,
    expectedAnswers: discussionEstimate.expectedAnswers,
    chatHistory,
    plotPreview,
    model: brainstormModel,
  });
  if (plotReviewTask) {
    tasks.push(plotReviewTask);
  }

  const frameworkTask = estimateFrameworkTask({
    phase,
    originalIdea,
    expectedAnswers: discussionEstimate.expectedAnswers,
    chatHistory,
    plotPreview,
    framework,
    model: brainstormModel,
  });
  if (frameworkTask) {
    tasks.push(frameworkTask);
  }

  const targetChapterCount = deriveCreationTargetChapterCount(framework, acceptedChapterCount);
  const masterOutlineTask = estimateMasterOutlineTask({
    phase,
    originalIdea,
    expectedAnswers: discussionEstimate.expectedAnswers,
    framework,
    targetChapterCount,
    model: planModel,
  });
  if (masterOutlineTask) {
    tasks.push(masterOutlineTask);
  }

  const storyPipelineEstimate = estimateStoryPipelineTask({
    targetChapterCount,
    acceptedChapterCount,
    avgTokensPerPipeline,
    planModel,
    writeModel,
    summarizeModel,
  });
  if (storyPipelineEstimate.task) {
    tasks.push(storyPipelineEstimate.task);
  }

  const setupTasks = tasks.filter((task) => task.id !== 'story_pipeline');
  const setupInputTokens = setupTasks.reduce((sum, task) => sum + task.estimatedInputTokens, 0);
  const setupOutputTokens = setupTasks.reduce((sum, task) => sum + task.estimatedOutputTokens, 0);
  const setupCost = setupTasks.reduce((sum, task) => sum + task.estimatedCost, 0);

  const fullStoryInputTokens = tasks.reduce((sum, task) => sum + task.estimatedInputTokens, 0);
  const fullStoryOutputTokens = tasks.reduce((sum, task) => sum + task.estimatedOutputTokens, 0);
  const fullStoryCost = tasks.reduce((sum, task) => sum + task.estimatedCost, 0);

  return {
    tasks,
    setupInputTokens,
    setupOutputTokens,
    setupCost,
    fullStoryInputTokens,
    fullStoryOutputTokens,
    fullStoryCost,
    targetChapterCount,
    remainingChapterCount: storyPipelineEstimate.remainingChapterCount,
    remainingDiscussTurns: discussionEstimate.remainingTurns,
    chapterPipelineSource: storyPipelineEstimate.source,
  };
}
