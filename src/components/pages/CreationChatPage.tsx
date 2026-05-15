/**
 * File: CreationChatPage.tsx
 * Purpose: Main unified creation chat page — 4 phases in 1 scrollable chat
 * Layer: UI (Page)
 * Domain: CreationChat → [describe, discuss, framework, compose]
 *
 * Design: "The Nocturnal Editor" — single chat interface
 * All 4 phases render in 1 scrollable message list.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Send,
  BookOpen,
  FileClock,
  MessageSquareQuote,
  PlayCircle,
  CheckCheck,
  RotateCcw,
  History,
} from 'lucide-react';
import VoiceMicButton from '../shared/VoiceMicButton';
import { getProjectSnapshot, useProjectStore } from '../../store/use_project_store';
import { createId } from '../../core/id';
import { useAiStore } from '../../store/use_ai_store';
import { useCreationChatStore } from '../../store/use_creation_chat_store';
import { useTokenStore } from '../../store/use_token_store';
import SuggestionChips from '../creation/SuggestionChips';
import PlotPreviewCard from '../creation/PlotPreviewCard';
import FrameworkPreview from '../creation/FrameworkPreview';
import ChapterDraftCard from '../creation/ChapterDraftCard';
import ChapterSidebarPanel from '../creation/ChapterSidebarPanel';
import CreationCostPanel from '../creation/CreationCostPanel';
import CreationActivityBar from '../creation/CreationActivityBar';
import { AiThinkingIndicator } from '../shared/AiThinkingIndicator';
import { AiConnectionDebugPanel } from '../shared/AiConnectionDebugPanel';
import ModelSelectorDropdown from '../shared/ModelSelectorDropdown';
import { STARTER_IDEAS } from '../../lib/ai/creation_discuss_config';
import { estimateCreationCost, resolveTargetChaptersFromAnswers } from '../../lib/ai/creation_cost_estimator';
import { getModelForTask } from '../../lib/ai/model_router';
import {
  buildPlotPreviewRepairFeedback,
  isWeakPlotPreview,
  normalizeCreationPlotPreview,
} from '../../lib/creation/plot_preview_normalizer';
import { normalizeCreationFramework } from '../../lib/creation/framework_normalizer';
import { buildCreationProjectSeed } from '../../lib/creation/project_seed';
import {
  handleDescribeSubmit,
  handleDiscussAnswer,
  handleAiDecide,
  handleSmartSkip,
  handlePlotPreviewFeedback,
  handlePlotPreviewConfirm,
  handleFrameworkConfirm,
  handleWriteChapter,
  handleAcceptChapter,
  retryFrameworkGeneration,
  batchComposeAllChapters,
  handleConfirmCostAndProceed,
} from '../../lib/ai/creation_orchestrator';
import type { ProjectTabId } from '../../types/navigation';
import type { CreationMessageTokenUsage } from '../../types/creation_chat';
import { describeCreationProgress } from '../../lib/creation/creation_progress';
import {
  selectLatestChapterDrafts,
  selectUnacceptedChapterDrafts,
} from '../../lib/creation/chapter_draft_selection';
import SessionRecoveryBanner from '../creation/SessionRecoveryBanner';
import SessionHistoryDrawer from '../creation/SessionHistoryDrawer';
import { getLatestSessionForProject } from '../../lib/session/session_archiver';
import type { ArchivedCreationSession } from '../../db/session_archive_db';

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: '#120f0d',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid rgba(80,69,59,0.3)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e8e1dc',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
  },
  phaseBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 9999,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  headerBtn: (active = false) => ({
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
    padding: '8px 12px',
    borderRadius: 12,
    border: active
      ? '1px solid rgba(212,165,116,0.35)'
      : '1px solid rgba(80,69,59,0.3)',
    background: active ? 'rgba(212,165,116,0.12)' : 'transparent',
    color: active ? '#f2c08d' : '#cbb8aa',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    transition: 'all 0.2s',
  }),
  statusPanel: {
    margin: '18px 20px 0',
    padding: '14px 16px',
    borderRadius: 18,
    border: '1px solid rgba(80,69,59,0.35)',
    background:
      'linear-gradient(180deg, rgba(39,30,24,0.78) 0%, rgba(23,19,16,0.92) 100%)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: 16,
  },
  statusMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    minWidth: 0,
  },
  statusHeadline: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f1e6da',
  },
  statusDetail: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#bca999',
  },
  statusCaption: {
    fontSize: 11,
    color: '#8f7f73',
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 20,
    padding: '40px 20px',
    textAlign: 'center' as const,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#e8e1dc',
    lineHeight: 1.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9c8e82',
    lineHeight: 1.6,
    maxWidth: 420,
  },
  starterChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    justifyContent: 'center' as const,
    maxWidth: 500,
    marginTop: 8,
  },
  starterChip: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(80,69,59,0.4)',
    background: 'rgba(80,69,59,0.15)',
    color: '#d4c4b7',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    textAlign: 'left' as const,
  },
  // Message bubbles
  msgRow: (role: string) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: role === 'user' ? 'flex-end' as const : 'flex-start' as const,
    gap: 4,
    maxWidth: role === 'system' ? '100%' : '85%',
    alignSelf: role === 'user' ? 'flex-end' as const : role === 'system' ? 'center' as const : 'flex-start' as const,
  }),
  msgLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9c8e82',
    letterSpacing: '0.1em',
    marginBottom: 2,
  },
  msgBubble: (role: string) => ({
    padding: role === 'system' ? '8px 16px' : '12px 18px',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : role === 'system' ? '10px' : '16px 16px 16px 4px',
    background: role === 'user'
      ? 'rgba(212,165,116,0.15)'
      : role === 'system'
        ? 'rgba(80,69,59,0.1)'
        : 'rgba(80,69,59,0.2)',
    border: role === 'user'
      ? '1px solid rgba(212,165,116,0.25)'
      : role === 'system'
        ? '1px solid rgba(80,69,59,0.2)'
        : '1px solid rgba(80,69,59,0.3)',
    color: role === 'system' ? '#9c8e82' : '#e8e1dc',
    fontSize: role === 'system' ? 13 : 14,
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap' as const,
    fontStyle: role === 'system' ? 'italic' as const : 'normal' as const,
  }),
  tokenBadge: {
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: 6,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
    padding: '3px 8px',
    borderRadius: 9999,
    border: '1px solid rgba(212,165,116,0.18)',
    background: 'rgba(22,19,16,0.72)',
    color: '#bda999',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  loadingDots: {
    display: 'flex',
    gap: 4,
    padding: '12px 18px',
    borderRadius: '16px 16px 16px 4px',
    background: 'rgba(80,69,59,0.2)',
    border: '1px solid rgba(80,69,59,0.3)',
  },
  // Input bar
  inputBar: {
    borderTop: '1px solid rgba(80,69,59,0.3)',
    padding: '14px 20px',
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end' as const,
    background: 'rgba(22,19,16,0.5)',
  },
  input: {
    flex: 1,
    background: 'rgba(80,69,59,0.1)',
    border: '1px solid rgba(80,69,59,0.3)',
    borderRadius: 14,
    color: '#e8e1dc',
    fontSize: 14,
    padding: '12px 16px',
    outline: 'none',
    resize: 'none' as const,
    fontFamily: 'Manrope, system-ui, sans-serif',
    lineHeight: 1.5,
    maxHeight: 120,
    transition: 'border-color 0.2s',
  },
  sendBtn: (active: boolean) => ({
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: 'none',
    background: active ? 'linear-gradient(135deg, #f2c08d, #d4a574)' : 'rgba(80,69,59,0.3)',
    color: active ? '#472a03' : '#9c8e82',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    cursor: active ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
    flexShrink: 0,
  }),
};

const PHASE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  describe: { label: '💡 Ý tưởng', color: '#f2c08d', bg: 'rgba(242,192,141,0.1)' },
  discuss: { label: '🧠 Thảo luận', color: '#63b3ed', bg: 'rgba(99,179,237,0.1)' },
  review_plot: { label: '📝 Review plot', color: '#7dd3fc', bg: 'rgba(125,211,252,0.1)' },
  framework: { label: '🏗️ Khung lớn', color: '#f6ad55', bg: 'rgba(246,173,85,0.1)' },
  compose: { label: '✍️ Sáng tác', color: '#68d391', bg: 'rgba(104,211,145,0.1)' },
};

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString('vi-VN');
}

function TokenUsageBadge({ usage }: { usage?: CreationMessageTokenUsage }) {
  if (!usage || usage.totalTokens <= 0) return null;

  const details = [
    `Input ${formatTokenCount(usage.inputTokens)}`,
    `Output ${formatTokenCount(usage.outputTokens)}`,
    usage.callCount && usage.callCount > 1 ? `${usage.callCount} calls` : null,
    usage.cached ? 'cache' : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={S.tokenBadge} title={details}>
      <span>⚡</span>
      <span>{formatTokenCount(usage.totalTokens)} token</span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────

interface CreationChatPageProps {
  onComplete?: (projectId: string, preferredTab?: ProjectTabId) => void;
  onOpenProjectDraft?: (projectId: string, preferredTab?: ProjectTabId) => void;
}

export default function CreationChatPage({
  onComplete,
  onOpenProjectDraft,
}: CreationChatPageProps = {}) {
  const {
    phase, messages, isAiWorking, isBatchComposing, error,
    plotPreview, plotPreviewConfirmed,
    framework, frameworkConfirmed,
    acceptedChapters, currentTopicIndex, answers, draftInput, draftSavedAt, progress,
    setPlotPreview,
    setFramework,
    setDraftInput,
    linkProject,
    finishWorkflowStep,
  } = useCreationChatStore();

  const projectActions = useProjectStore((state) => ({
    createProject: state.createProject,
    updateProject: state.updateProject,
    replaceProjectChapters: state.replaceProjectChapters,
  }));
  const {
    models,
    activeModelId,
    taskModelOverrides,
    modelHealth,
    preferredProvider,
    subscription,
    fetchSubscription,
  } = useAiStore((state) => ({
    models: state.models,
    activeModelId: state.activeModelId,
    taskModelOverrides: state.taskModelOverrides,
    modelHealth: state.modelHealth,
    preferredProvider: state.preferredProvider,
    subscription: state.subscription,
    fetchSubscription: state.fetchSubscription,
  }));
  const avgTokensPerPipeline = useTokenStore((state) => state.getStats().avgTokensPerPipeline);

  const [showChapterPanel, setShowChapterPanel] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [recoverySession, setRecoverySession] = useState<ArchivedCreationSession | null>(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const linkedProjectId = progress.linkedProjectId;
  const statusSummary = useMemo(() => describeCreationProgress(progress), [progress]);
  const hasIncompleteBatchCompose = Boolean(
    progress.batchCompose &&
    progress.batchCompose.total > 0 &&
    progress.batchCompose.successCount < progress.batchCompose.total,
  );
  const latestAiChapterDrafts = useMemo(
    () => selectLatestChapterDrafts(messages),
    [messages],
  );
  const pendingAiChapterDrafts = useMemo(
    () => selectUnacceptedChapterDrafts(messages, acceptedChapters),
    [acceptedChapters, messages],
  );
  const hasGeneratedChapter = acceptedChapters.some((chapter) => chapter.content.trim()) ||
    latestAiChapterDrafts.some((draft) => draft.content.trim());
  const canResumeInChat = !isAiWorking && !isBatchComposing && (
    progress.status === 'interrupted' ||
    progress.status === 'error' ||
    Boolean(error)
  );
  const canTransitionToEditor = Boolean(
    linkedProjectId &&
      frameworkConfirmed &&
      hasGeneratedChapter &&
      !isAiWorking &&
      !isBatchComposing,
  );
  const brainstormModel = useMemo(
    () => getModelForTask('brainstorm', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider),
    [activeModelId, modelHealth, models, preferredProvider, taskModelOverrides],
  );
  const planModel = useMemo(
    () => getModelForTask('plan_chapter', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider),
    [activeModelId, modelHealth, models, preferredProvider, taskModelOverrides],
  );
  const writeModel = useMemo(
    () => getModelForTask('write_chapter', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider),
    [activeModelId, modelHealth, models, preferredProvider, taskModelOverrides],
  );
  const summarizeModel = useMemo(
    () => getModelForTask('summarize', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider)
      || getModelForTask('extract_metadata', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider),
    [activeModelId, modelHealth, models, preferredProvider, taskModelOverrides],
  );
  const originalIdeaForEstimate = useMemo(() => {
    const firstIdea = messages.find((message) => message.role === 'user' && message.type === 'text')?.content || '';
    if (firstIdea.trim()) return firstIdea;
    return phase === 'describe' ? draftInput : '';
  }, [draftInput, messages, phase]);
  const estimateChatHistory = useMemo(
    () =>
      messages
        .filter((message) => message.role === 'user' && message.type === 'text')
        .slice(1)
        .map((message) => ({
          role: 'user' as const,
          content: message.content,
        })),
    [messages],
  );
  const creationCostEstimate = useMemo(() => {
    if (!brainstormModel || !planModel || !writeModel || !summarizeModel) return null;

    return estimateCreationCost({
      phase,
      originalIdea: originalIdeaForEstimate,
      answers,
      currentTopicIndex,
      chatHistory: estimateChatHistory,
      plotPreview,
      framework,
      acceptedChapterCount: acceptedChapters.length,
      brainstormModel: {
        modelId: brainstormModel.modelId,
        modelName: brainstormModel.name,
      },
      planModel: {
        modelId: planModel.modelId,
        modelName: planModel.name,
      },
      writeModel: {
        modelId: writeModel.modelId,
        modelName: writeModel.name,
      },
      summarizeModel: {
        modelId: summarizeModel.modelId,
        modelName: summarizeModel.name,
      },
      avgTokensPerPipeline,
    });
  }, [
    acceptedChapters.length,
    answers,
    avgTokensPerPipeline,
    brainstormModel,
    currentTopicIndex,
    estimateChatHistory,
    framework,
    originalIdeaForEstimate,
    phase,
    planModel,
    plotPreview,
    summarizeModel,
    writeModel,
  ]);
  const remainingMonthlyTokens = useMemo(() => {
    const used = subscription.tokensUsed || 0;
    const limit = subscription.tokensLimit || 0;
    if (limit <= 0) return null;
    return Math.max(0, limit - used);
  }, [subscription.tokensLimit, subscription.tokensUsed]);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  // [Domain:SessionArchive] Check for recoverable sessions on mount / project change
  useEffect(() => {
    if (recoveryDismissed || messages.length > 0) return;

    // Only show recovery if current session is empty (just reset)
    if (linkedProjectId) {
      void getLatestSessionForProject(linkedProjectId).then((session) => {
        if (session && session.messageCount > 0) {
          setRecoverySession(session);
        }
      });
    }
  }, [linkedProjectId, messages.length, recoveryDismissed]);

  const handleRestoreSession = useCallback(async (sessionId: string) => {
    const restored = await useCreationChatStore.getState().restoreFromArchive(sessionId);
    if (restored) {
      setRecoverySession(null);
      setRecoveryDismissed(true);
    }
  }, []);

  const handleDismissRecovery = useCallback(() => {
    setRecoverySession(null);
    setRecoveryDismissed(true);
  }, []);

  const handleRestoreFromHistory = useCallback(async (sessionId: string) => {
    // [Domain:SessionArchive] Archive current session before restoring from history
    await useCreationChatStore.getState().archiveAndReset('switch_project');
    const restored = await useCreationChatStore.getState().restoreFromArchive(sessionId);
    if (restored) {
      setShowHistoryDrawer(false);
    }
  }, []);

  // ── Transition handler: migrate creation data → Project → Editor ──
  const handleTransitionToEditor = useCallback(async () => {
    if (!canTransitionToEditor) return;

    const seed = buildCreationProjectSeed({
      framework,
      acceptedChapters,
      targetChapterCount: answers.chapter_scope ? resolveTargetChaptersFromAnswers(answers) : undefined,
      createId,
    });

    const projectId = linkedProjectId || projectActions.createProject(seed.projectPatch.title);

    // [Domain:CreationChat] STEP 1 — Sync framework + metadata into the linked project
    projectActions.updateProject(projectId, seed.projectPatch);

    // [Domain:CreationChat] STEP 2 — Sync chapter shells/accepted chapters without clobbering persisted drafts
    if (!linkedProjectId && seed.chapters.length > 0) {
      await projectActions.replaceProjectChapters(projectId, seed.chapters, { storageMode: 'indexeddb' });
    } else if (linkedProjectId && seed.chapters.length > 0) {
      const snapshot = await getProjectSnapshot(projectId);
      const existingBySequence = new Map(
        (snapshot?.chapters || []).map((chapter) => [chapter.sequenceNumber ?? 0, chapter] as const),
      );

      const mergedChapters = seed.chapters.map((seedChapter) => {
        const existing = existingBySequence.get(seedChapter.sequenceNumber ?? 0);
        if (!existing) return seedChapter;

        return {
          ...existing,
          title: seedChapter.content.trim() ? seedChapter.title : existing.title || seedChapter.title,
          summary: existing.summary || seedChapter.summary,
          content: seedChapter.content.trim() ? seedChapter.content : existing.content,
          updatedAt: existing.updatedAt,
        };
      });

      const additionalExisting = (snapshot?.chapters || []).filter(
        (chapter) => !mergedChapters.some((item) => item.sequenceNumber === chapter.sequenceNumber),
      );

      await projectActions.replaceProjectChapters(
        projectId,
        [...mergedChapters, ...additionalExisting],
        { storageMode: 'indexeddb' },
      );
    }

    // [Domain:CreationChat] STEP 3 — Keep session for resume and mark handoff success
    linkProject(projectId);
    finishWorkflowStep('handoff', 'Đã đồng bộ bản thảo sang editor, có thể quay lại chat để rà lại khung truyện.', {
      linkedProjectId: projectId,
    });
    onComplete?.(projectId, 'writer');
  }, [
    acceptedChapters,
    canTransitionToEditor,
    finishWorkflowStep,
    framework,
    linkProject,
    linkedProjectId,
    onComplete,
    projectActions,
  ]);

  const handleConfirmAndOpenWriter = useCallback(async () => {
    const result = await handleFrameworkConfirm();
    if (!result?.projectId || !result.readyForEditor) return;
    // [Domain:CreationChat] Batch compose completes inside handleFrameworkConfirm.
    // Navigation happens AFTER all chapters have been written.
    onComplete?.(result.projectId, 'writer');
  }, [onComplete]);

  const handleRetryCurrentStep = useCallback(() => {
    useCreationChatStore.getState().setError(null);

    if (phase === 'describe') {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMsg) void handleDescribeSubmit(lastUserMsg.content);
      return;
    }

    if (phase === 'discuss') {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMsg) void handleDiscussAnswer(lastUserMsg.content);
      return;
    }

    if (phase === 'review_plot' || progress.step === 'review_plot') {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMsg && plotPreview) {
        void handlePlotPreviewFeedback(lastUserMsg.content);
      }
      return;
    }

    if (phase === 'framework' || progress.step === 'framework') {
      void retryFrameworkGeneration();
      return;
    }

    if (phase === 'compose' || progress.step === 'compose') {
      if (linkedProjectId && hasIncompleteBatchCompose) {
        void batchComposeAllChapters(linkedProjectId);
        return;
      }

      const latestComposeNote = [...messages]
        .reverse()
        .find((message) => message.role === 'user' && message.type === 'text');
      void handleWriteChapter(latestComposeNote?.content);
    }
  }, [hasIncompleteBatchCompose, linkedProjectId, messages, phase, plotPreview, progress.step]);
  const handleOpenLinkedDraft = useCallback(() => {
    if (!linkedProjectId || !onOpenProjectDraft || !canTransitionToEditor) return;
    onOpenProjectDraft(linkedProjectId, 'writer');
  }, [canTransitionToEditor, linkedProjectId, onOpenProjectDraft]);
  const handleGoToEditorFromDraft = useCallback(async (
    chapterIndex: number,
    chapterTitle: string,
    chapterContent: string,
  ) => {
    // [Domain:CreationChat] STEP 1 — Accept the chapter first
    await handleAcceptChapter(chapterIndex, chapterTitle, chapterContent);
    // [Domain:CreationChat] STEP 2 — Transition to editor
    if (canTransitionToEditor) {
      await handleTransitionToEditor();
    } else if (linkedProjectId && onComplete) {
      onComplete(linkedProjectId, 'writer');
    }
  }, [canTransitionToEditor, handleTransitionToEditor, linkedProjectId, onComplete]);
  const handleAcceptAllAiChapters = useCallback(async () => {
    if (pendingAiChapterDrafts.length === 0 || isAiWorking || isBatchComposing) return;

    for (const draft of pendingAiChapterDrafts) {
      await handleAcceptChapter(draft.chapterIndex, draft.title, draft.content, { silent: true });
    }

    useCreationChatStore
      .getState()
      .addSystemMessage(`✅ Đã lưu tất cả ${pendingAiChapterDrafts.length} chương AI mới nhất.`);
  }, [isAiWorking, isBatchComposing, pendingAiChapterDrafts]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoRepairPreviewRef = useRef(false);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (phase !== 'review_plot' || !plotPreview) {
      autoRepairPreviewRef.current = false;
      return;
    }

    if (isAiWorking || autoRepairPreviewRef.current || !isWeakPlotPreview(plotPreview)) {
      return;
    }

    autoRepairPreviewRef.current = true;
    void handlePlotPreviewFeedback(buildPlotPreviewRepairFeedback(plotPreview));
  }, [isAiWorking, phase, plotPreview]);

  // ── Send handler ────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = draftInput.trim();
    if (!text || isAiWorking) return;
    setDraftInput('');

    if (phase === 'describe') {
      await handleDescribeSubmit(text);
    } else if (phase === 'discuss') {
      await handleDiscussAnswer(text);
    } else if (phase === 'review_plot') {
      await handlePlotPreviewFeedback(text);
    } else if (phase === 'compose') {
      await handleWriteChapter(text);
    }
  }, [draftInput, isAiWorking, phase, setDraftInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent instanceof KeyboardEvent && e.nativeEvent.isComposing) return;
      e.preventDefault();
      handleSend();
    }
  };

  // ── Starter chip click ──────────────────────────────────

  const handleStarterClick = (text: string) => {
    setDraftInput(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Phase badge ─────────────────────────────────────────

  const phaseInfo = PHASE_LABELS[phase];

  // ── Empty state (Phase 1) ───────────────────────────────

  const isEmpty = messages.length === 0;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <Sparkles size={16} color="#f2c08d" />
          Sáng tác mới
        </div>
        <div style={S.headerActions}>
          <span style={{
            ...S.phaseBadge,
            color: phaseInfo.color,
            background: phaseInfo.bg,
            border: `1px solid ${phaseInfo.color}30`,
          }}>
            {phaseInfo.label}
          </span>
          <ModelSelectorDropdown />
          <button
            style={S.headerBtn(showHistoryDrawer)}
            onClick={() => setShowHistoryDrawer(true)}
            title="Lịch sử phiên thảo luận"
          >
            <History size={14} />
            Lịch sử
          </button>
          {canTransitionToEditor && onOpenProjectDraft && (
            <button
              style={S.headerBtn(true)}
              onClick={handleOpenLinkedDraft}
              title="Mở lại bản thảo hiện tại"
            >
              <FileClock size={14} />
              Bản thảo hiện tại
            </button>
          )}
          <button
            style={{
              ...S.headerBtn(showChapterPanel),
              color: showChapterPanel ? '#f2c08d' : '#9c8e82',
            }}
            onClick={() => setShowChapterPanel((v) => !v)}
            title="Mở danh sách chương"
          >
            <BookOpen size={14} />
            {acceptedChapters.length > 0 && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 9999,
                background: 'rgba(212,165,116,0.2)',
                color: '#f2c08d',
              }}>
                {acceptedChapters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={S.statusPanel}>
        <div style={S.statusMeta}>
          <div style={S.statusHeadline}>{statusSummary.headline}</div>
          <div style={S.statusDetail}>{statusSummary.detail}</div>
          <div style={S.statusCaption}>
            <span>{statusSummary.badge}</span>
            <span>Nháp lưu: {draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'chưa có'}</span>
            <span>{acceptedChapters.length} chương để duyệt</span>
            {progress.lastGeneratedChapterTitle && <span>Nháp mới nhất: {progress.lastGeneratedChapterTitle}</span>}
          </div>
          {/* Batch compose progress bar */}
          {progress.batchCompose && progress.batchCompose.isRunning && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#f2c08d',
                fontWeight: 700,
                marginBottom: 4,
              }}>
                <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>✍️</span>
                <span>Đang viết chương {progress.batchCompose.current}/{progress.batchCompose.total}</span>
                <span style={{ color: '#9c8e82', fontWeight: 400 }}>
                  ({Math.round((progress.batchCompose.current / progress.batchCompose.total) * 100)}%)
                </span>
              </div>
              <div style={{
                width: '100%',
                height: 4,
                borderRadius: 2,
                background: 'rgba(80,69,59,0.3)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(progress.batchCompose.current / progress.batchCompose.total) * 100}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: 'linear-gradient(90deg, #f2c08d, #d4a574)',
                  transition: 'width 0.5s ease-out',
                }} />
              </div>
              {progress.batchCompose.failCount > 0 && (
                <div style={{ fontSize: 11, color: '#e57373', marginTop: 2 }}>
                  {progress.batchCompose.failCount} chương gặp lỗi
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {latestAiChapterDrafts.length > 0 && (
            <button
              style={{
                ...S.headerBtn(pendingAiChapterDrafts.length > 0),
                opacity: pendingAiChapterDrafts.length > 0 && !isAiWorking && !isBatchComposing ? 1 : 0.55,
                cursor: pendingAiChapterDrafts.length > 0 && !isAiWorking && !isBatchComposing ? 'pointer' : 'not-allowed',
              }}
              onClick={handleAcceptAllAiChapters}
              disabled={pendingAiChapterDrafts.length === 0 || isAiWorking || isBatchComposing}
              title={
                pendingAiChapterDrafts.length > 0
                  ? `Lưu ${pendingAiChapterDrafts.length} chương AI mới nhất vào dự án`
                  : 'Tất cả chương AI đã được lưu'
              }
            >
              <CheckCheck size={14} />
              Chấp nhận tất cả
            </button>
          )}
          {canResumeInChat && (
            <button
              style={S.headerBtn(true)}
              onClick={handleRetryCurrentStep}
              title="Tiếp tục viết ngay trong khung chat này"
            >
              <PlayCircle size={14} />
              Viết tiếp tại đây
            </button>
          )}
          {linkedProjectId && onOpenProjectDraft && (
            <button
              style={{
                ...S.headerBtn(canTransitionToEditor),
                opacity: canTransitionToEditor ? 1 : 0.55,
                cursor: canTransitionToEditor ? 'pointer' : 'not-allowed',
              }}
              onClick={handleOpenLinkedDraft}
              disabled={!canTransitionToEditor}
              title={
                canTransitionToEditor
                  ? 'Mở bản thảo trong editor'
                  : 'Chỉ mở editor sau khi đã chốt khung truyện và có ít nhất một chương'
              }
            >
              <FileClock size={14} />
              Về editor
            </button>
          )}
          <button
            style={S.headerBtn()}
            onClick={() => setShowChapterPanel(true)}
          >
            <MessageSquareQuote size={14} />
            Duyệt nháp
          </button>
        </div>
      </div>

      {/* [Domain:SessionArchive] Recovery banner for interrupted sessions */}
      {recoverySession && !recoveryDismissed && messages.length === 0 && (
        <SessionRecoveryBanner
          session={recoverySession}
          onRestore={handleRestoreSession}
          onDismiss={handleDismissRecovery}
        />
      )}

      {creationCostEstimate && (
        <CreationCostPanel
          estimate={creationCostEstimate}
          remainingMonthlyTokens={remainingMonthlyTokens}
          hasIdeaSignal={originalIdeaForEstimate.trim().length > 0}
        />
      )}

      {/* Chat Area */}
      <div style={S.chatArea}>
        {isEmpty ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
            <h2 style={S.emptyTitle}>Bắt đầu câu chuyện của bạn</h2>
            <p style={S.emptySubtitle}>
              Mô tả ý tưởng truyện — dài ngắn đều được.<br />
              AI sẽ giúp bạn phát triển thành tác phẩm hoàn chỉnh.
            </p>
            <div style={{ ...S.emptySubtitle, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginTop: 8 }}>
              💡 Thử nhanh:
            </div>
            <div style={S.starterChips}>
              {STARTER_IDEAS.map((idea) => (
                <button
                  key={idea.id}
                  style={S.starterChip}
                  onClick={() => handleStarterClick(idea.value || idea.label)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.3)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,165,116,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.15)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(80,69,59,0.4)';
                  }}
                >
                  {idea.emoji} {idea.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            // ── Loading dots ──
            if (msg.type === 'loading') {
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <AiThinkingIndicator
                    context={phase === 'compose' ? 'creation' : phase === 'describe' ? 'generic' : 'creation'}
                  />
                </div>
              );
            }

            // ── Cost preview (chapter scope confirmation) ──
            if (msg.type === 'cost_preview' && msg.costPreviewData) {
              const cpd = msg.costPreviewData;
              const isLatestMsg = msg.id === messages[messages.length - 1]?.id;
              const alreadyConfirmed = phase !== 'discuss';
              function fmtTok(n: number) {
                if (n < 1000) return `${n}`;
                if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
                return `${(n / 1_000_000).toFixed(1)}M`;
              }
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <div style={{
                    ...S.msgBubble('ai'),
                    padding: '16px 20px',
                    maxWidth: 480,
                  }}>
                    <div style={{ fontSize: 14, color: '#e8ddd5', marginBottom: 14, lineHeight: 1.6 }}>
                      {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </div>
                    {/* Token breakdown */}
                    <div style={{
                      borderRadius: 14,
                      border: '1px solid rgba(212,165,116,0.2)',
                      background: 'rgba(22,19,16,0.6)',
                      overflow: 'hidden',
                      marginBottom: 12,
                    }}>
                      <div style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(80,69,59,0.3)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#cbb8aa' }}>
                          📚 Mục tiêu: {cpd.targetChapters} chương
                        </span>
                        <span style={{ fontSize: 11, color: '#9c8e82' }}>Heuristic ước tính</span>
                      </div>
                      <div style={{ padding: '10px 14px', display: 'flex', gap: 20 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#9c8e82', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Thiết lập ban đầu</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#f2c08d', marginTop: 2 }}>
                            {fmtTok(cpd.setupTokensEstimate)} tokens
                          </div>
                          <div style={{ fontSize: 11, color: '#8f7f73', marginTop: 2 }}>{cpd.setupCostLabel}</div>
                        </div>
                        <div style={{ width: 1, background: 'rgba(80,69,59,0.4)' }} />
                        <div>
                          <div style={{ fontSize: 10, color: '#9c8e82', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Toàn bộ truyện</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#f2c08d', marginTop: 2 }}>
                            {fmtTok(cpd.totalTokensEstimate)} tokens
                          </div>
                          <div style={{ fontSize: 11, color: '#8f7f73', marginTop: 2 }}>{cpd.fullStoryCostLabel}</div>
                        </div>
                      </div>
                      <div style={{
                        padding: '8px 14px',
                        borderTop: '1px solid rgba(80,69,59,0.2)',
                        fontSize: 11,
                        color: '#9c8e82',
                        lineHeight: 1.5,
                      }}>
                        ⚡ {cpd.chapterPipelineNote}
                      </div>
                    </div>
                    {/* Disclaimer */}
                    <div style={{ fontSize: 11, color: '#8f7f73', lineHeight: 1.5, marginBottom: 14 }}>
                      Dự toán sơ bộ, có thể lệch 20–30% tùy mô hình và độ dài thảo luận. Bạn có thể điều chỉnh số chương lúc nào.
                    </div>
                    {/* Confirm / adjust buttons */}
                    {isLatestMsg && !alreadyConfirmed && !isAiWorking && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          id="btn-confirm-cost-proceed"
                          type="button"
                          onClick={() => void handleConfirmCostAndProceed()}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, #f2c08d, #d4a574)',
                            color: '#472a03',
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontFamily: 'Manrope, system-ui, sans-serif',
                          }}
                        >
                          ✅ Xác nhận — Bắt đầu
                        </button>
                        <button
                          id="btn-adjust-chapter-scope"
                          type="button"
                          onClick={() => {
                            setDraftInput('');
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: '1px solid rgba(80,69,59,0.4)',
                            background: 'transparent',
                            color: '#cbb8aa',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'Manrope, system-ui, sans-serif',
                          }}
                        >
                          ✏️ Điều chỉnh
                        </button>
                      </div>
                    )}
                    {alreadyConfirmed && (
                      <div style={{ fontSize: 11, color: '#68d391', fontWeight: 700 }}>
                        ✅ Đã xác nhận — đang tiến hành sáng tác
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ── Plot review preview ──
            if (msg.type === 'plot_preview' && msg.plotPreviewData) {
              const previewData = normalizeCreationPlotPreview(plotPreview || msg.plotPreviewData);

              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <div style={{ fontSize: 14, color: '#d4c4b7', marginBottom: 8 }}>{msg.content}</div>
                  <PlotPreviewCard
                    data={previewData}
                    confirmed={plotPreviewConfirmed}
                    disabled={isAiWorking}
                    onChange={(next) => setPlotPreview(next)}
                    onConfirm={() => void handlePlotPreviewConfirm()}
                  />
                  <TokenUsageBadge usage={msg.tokenUsage} />
                </div>
              );
            }

            // ── Framework preview ──
            if (msg.type === 'framework_preview' && msg.frameworkData) {
              const frameworkData = normalizeCreationFramework(framework || msg.frameworkData);
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <div style={{ fontSize: 14, color: '#d4c4b7', marginBottom: 8 }}>{msg.content}</div>
                  <FrameworkPreview
                    data={frameworkData}
                    confirmed={frameworkConfirmed}
                    onConfirm={handleConfirmAndOpenWriter}
                    onChange={setFramework}
                  />
                  <TokenUsageBadge usage={msg.tokenUsage} />
                </div>
              );
            }

            // ── Chapter draft ──
            if (msg.type === 'chapter_draft' && msg.chapterDraft) {
              const draft = msg.chapterDraft;
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <ChapterDraftCard
                    chapterIndex={draft.chapterIndex}
                    title={draft.title}
                    content={draft.content}
                    charCount={draft.charCount}
                    disabled={isAiWorking}
                    onAccept={() => handleAcceptChapter(draft.chapterIndex, draft.title, draft.content)}
                    onRewrite={() => handleWriteChapter('Viết lại chương này với hướng khác')}
                    onEdit={(newContent) => handleAcceptChapter(draft.chapterIndex, draft.title, newContent)}
                    onGoToEditor={
                      (linkedProjectId && onComplete)
                        ? () => handleGoToEditorFromDraft(draft.chapterIndex, draft.title, draft.content)
                        : undefined
                    }
                  />
                  <TokenUsageBadge usage={msg.tokenUsage} />
                </div>
              );
            }

            // ── Suggestions (AI question + chips) ──
            if (msg.type === 'suggestions' && msg.suggestions) {
              const isLatest = msg.id === messages[messages.length - 1]?.id;
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <div style={S.msgBubble('ai')}>
                    {msg.content}
                    <SuggestionChips
                      groups={msg.suggestions}
                      aiDecideLabel={msg.aiDecideLabel}
                      disabled={!isLatest || isAiWorking}
                      onConfirmSelect={(val: string) => {
                        if (phase === 'discuss') handleDiscussAnswer(val);
                        else if (phase === 'compose') handleWriteChapter(val);
                      }}
                      onAiDecide={phase === 'discuss' ? handleAiDecide : undefined}
                      onSmartSkip={phase === 'discuss' ? handleSmartSkip : undefined}
                    />
                  </div>
                  <TokenUsageBadge usage={msg.tokenUsage} />
                </div>
              );
            }

            // ── System / Phase Transition ──
            if (msg.role === 'system') {
              return (
                <div key={msg.id} style={S.msgRow('system')}>
                  <div style={S.msgBubble('system')}>{msg.content}</div>
                </div>
              );
            }

            // ── Normal text (user or ai) ──
            return (
              <div key={msg.id} style={S.msgRow(msg.role)} className="group">
                <div style={S.msgLabel}>
                  {msg.role === 'user' ? '✍️ BẠN' : '🤖 AI'}
                </div>
                <div style={S.msgBubble(msg.role)}>{msg.content}</div>
                {msg.role === 'ai' && <TokenUsageBadge usage={msg.tokenUsage} />}
                {msg.role === 'user' && (
                  <button 
                    onClick={() => {
                      setDraftInput(msg.content);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[11px] text-[#8f7f73] hover:text-[#dcd1c6] mt-1 pr-1"
                    title="Điền lại yêu cầu này vào khung chat"
                  >
                    <RotateCcw size={12} /> Thử lại
                  </button>
                )}
              </div>
            );
          })
        )}

        {/* Error — Debug Panel */}
        {error && (
          <AiConnectionDebugPanel
            error={error}
            onDismiss={() => useCreationChatStore.getState().setError(null)}
            onRetry={handleRetryCurrentStep}
          />
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Bar */}
      <CreationActivityBar
        progress={progress}
        isAiWorking={isAiWorking}
        isBatchComposing={isBatchComposing}
        canOpenLinkedDraft={canTransitionToEditor}
        onOpenLinkedDraft={canTransitionToEditor ? handleOpenLinkedDraft : undefined}
        canResumeInChat={canResumeInChat}
        onResumeInChat={handleRetryCurrentStep}
      />
      <div style={S.inputBar}>
        <textarea
          ref={inputRef}
          style={S.input}
          value={draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(212,165,116,0.5)'; }}
          onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(80,69,59,0.3)'; }}
          placeholder={
            phase === 'describe'
              ? 'Mô tả ý tưởng truyện của bạn...'
              : phase === 'discuss'
                ? 'Trả lời hoặc gõ ý riêng...'
                : phase === 'review_plot'
                  ? 'Góp ý để chỉnh cốt truyện trước khi AI dựng khung đầy đủ...'
                : phase === 'compose'
                  ? 'Ghi chú cho chương tiếp theo...'
                  : 'Nhập tin nhắn...'
          }
          rows={1}
          disabled={isAiWorking}
        />
        <VoiceMicButton
          onText={(text) => setDraftInput(text)}
          disabled={isAiWorking}
          variant="dark"
          size={18}
        />
        <button
          style={S.sendBtn(draftInput.trim().length > 0 && !isAiWorking)}
          onClick={handleSend}
          disabled={!draftInput.trim() || isAiWorking}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Keyframe animations moved to index.css */}

      {/* Chapter Sidebar Panel */}
      <ChapterSidebarPanel
        isOpen={showChapterPanel}
        onClose={() => setShowChapterPanel(false)}
        onTransitionToEditor={handleTransitionToEditor}
        canTransitionToEditor={canTransitionToEditor}
      />

      {/* [Domain:SessionArchive] Session History Drawer */}
      <SessionHistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        onRestore={handleRestoreFromHistory}
        filterProjectId={linkedProjectId}
      />
    </div>
  );
}
