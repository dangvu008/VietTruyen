/**
 * File: use_creation_chat_store.ts
 * Purpose: Persisted Zustand store cho Unified Creation Chat Flow — 4 phases + autosave/resume
 * Layer: Store
 * Domain: CreationChat → [phase management, workflow progress, autosave draft, session archive]
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createId } from '../core/id';
import type {
  AcceptedChapter,
  BatchComposeProgress,
  CreationChatState,
  CreationCostPreviewData,
  CreationMessage,
  CreationMessageTokenUsage,
  CreationPhase,
  CreationPlotPreview,
  CreationWorkflowStep,
  SuggestionGroup,
} from '../types/creation_chat';
import type { BrainstormResult } from '../types/narrative_memory';
import { normalizeCreationPlotPreview } from '../lib/creation/plot_preview_normalizer';
import { normalizeCreationFramework } from '../lib/creation/framework_normalizer';
import { useNotificationStore } from './use_notification_store';
import { createDebouncedPersistStorage } from '../lib/storage/debounced_local_storage';
import {
  archiveCurrentSession,
  buildRestorePayload,
} from '../lib/session/session_archiver';
import { getArchivedSession } from '../db/session_archive_db';
import type { ArchivedCreationSession } from '../db/session_archive_db';

interface WorkflowProgressPatch {
  linkedProjectId?: string | null;
  lastGeneratedChapterTitle?: string | null;
}

interface CreationChatActions {
  addMessage: (msg: Omit<CreationMessage, 'id' | 'timestamp'>) => void;
  addUserText: (text: string) => void;
  addAiText: (text: string, tokenUsage?: CreationMessageTokenUsage) => void;
  addAiSuggestions: (
    text: string,
    suggestions: SuggestionGroup[],
    aiDecideLabel?: string,
    tokenUsage?: CreationMessageTokenUsage,
  ) => void;
  addSystemMessage: (text: string) => void;
  addCostPreview: (data: CreationCostPreviewData, introText: string) => void;
  addLoadingMessage: () => string;
  removeMessage: (id: string) => void;
  setPhase: (phase: CreationPhase) => void;
  addPhaseTransition: (text: string, nextPhase: CreationPhase) => void;
  setCurrentTopicIndex: (index: number) => void;
  setAnswer: (topicId: string, value: string) => void;
  setPlotPreview: (preview: CreationPlotPreview | null) => void;
  addPlotPreview: (
    data: CreationPlotPreview,
    introText?: string,
    tokenUsage?: CreationMessageTokenUsage,
  ) => void;
  confirmPlotPreview: () => void;
  setFramework: (result: BrainstormResult) => void;
  confirmFramework: () => void;
  addFrameworkPreview: (data: BrainstormResult, tokenUsage?: CreationMessageTokenUsage) => void;
  setCurrentChapterIndex: (index: number) => void;
  addChapterDraft: (draft: {
    chapterIndex: number;
    title: string;
    content: string;
    tokenUsage?: CreationMessageTokenUsage;
  }) => void;
  addAcceptedChapter: (chapter: Omit<AcceptedChapter, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAcceptedChapter: (id: string, patch: Partial<AcceptedChapter>) => void;
  removeAcceptedChapter: (id: string) => void;
  addManualChapter: (title: string, content: string) => void;
  setDraftInput: (value: string) => void;
  startWorkflowStep: (step: CreationWorkflowStep, detail: string) => void;
  finishWorkflowStep: (
    step: CreationWorkflowStep,
    detail: string,
    patch?: WorkflowProgressPatch,
  ) => void;
  failWorkflowStep: (
    step: CreationWorkflowStep,
    detail: string,
    error?: string,
  ) => void;
  interruptWorkflowStep: (detail?: string) => void;
  linkProject: (projectId: string) => void;
  unlinkProject: () => void;
  syncEditorTextMessages: (
    projectId: string,
    chapterId: string,
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      isStreaming?: boolean;
    }>,
  ) => void;
  setAiWorking: (working: boolean) => void;
  setIsBatchComposing: (composing: boolean) => void;
  setBatchComposeProgress: (progress: BatchComposeProgress | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  /**
   * Archive current session to IndexedDB before resetting.
   * Use this instead of raw reset() to prevent data loss.
   */
  archiveAndReset: (reason: ArchivedCreationSession['archiveReason']) => Promise<void>;
  /**
   * Restore a previously archived session from IndexedDB.
   */
  restoreFromArchive: (sessionId: string) => Promise<boolean>;
}

const nowIso = () => new Date().toISOString();

function mapPhaseToStep(phase: CreationPhase): CreationWorkflowStep {
  switch (phase) {
    case 'review_plot':
      return 'review_plot';
    case 'framework':
      return 'framework';
    case 'compose':
      return 'compose';
    default:
      return phase;
  }
}

const createInitialState = (): CreationChatState => ({
  sessionId: createId(),
  sessionStartedAt: nowIso(),
  phase: 'describe',
  messages: [],
  currentTopicIndex: 0,
  answers: {},
  plotPreview: null,
  plotPreviewConfirmed: false,
  framework: null,
  frameworkConfirmed: false,
  currentChapterIndex: 0,
  acceptedChapters: [],
  draftInput: '',
  draftSavedAt: null,
  progress: {
    step: 'describe',
    status: 'idle',
    detail: 'Chưa bắt đầu phiên thảo luận sáng tác.',
    lastCompletedStep: null,
    lastCompletedAt: null,
    updatedAt: nowIso(),
    error: null,
    linkedProjectId: null,
    lastGeneratedChapterTitle: null,
    batchCompose: null,
  },
  isBatchComposing: false,
  isAiWorking: false,
  error: null,
});

const touch = () => nowIso();

function stripTransientMessages(messages: CreationMessage[]): CreationMessage[] {
  return messages.filter((message) => message.type !== 'loading');
}

const NOTIFIABLE_SUCCESS_STEPS = new Set<CreationWorkflowStep>([
  'review_plot',
  'framework',
  'outline',
  'compose',
  'handoff',
]);

const WORKFLOW_STEP_LABELS: Record<CreationWorkflowStep, string> = {
  describe: 'mô tả ý tưởng',
  discuss: 'thảo luận',
  review_plot: 'review cốt truyện',
  framework: 'tạo khung truyện',
  outline: 'tạo tổng cương',
  compose: 'viết chương',
  handoff: 'đồng bộ editor',
};

function buildWorkflowSuccessTitle(
  step: CreationWorkflowStep,
  detail: string,
  patch?: WorkflowProgressPatch,
): string {
  if (step === 'compose' && patch?.lastGeneratedChapterTitle) {
    return `Đã tạo xong ${patch.lastGeneratedChapterTitle}`;
  }

  switch (step) {
    case 'review_plot':
      return 'Đã tổng hợp bản review cốt truyện';
    case 'framework':
      return 'Đã tạo xong khung truyện';
    case 'outline':
      return 'Đã tạo xong tổng cương';
    case 'handoff':
      return 'Đã đồng bộ sang editor';
    case 'compose':
      return detail;
    default:
      return detail;
  }
}

function notifyWorkflowSuccess(
  step: CreationWorkflowStep,
  detail: string,
  patch?: WorkflowProgressPatch,
): void {
  if (!NOTIFIABLE_SUCCESS_STEPS.has(step)) return;

  useNotificationStore.getState().push({
    type: 'success',
    title: buildWorkflowSuccessTitle(step, detail, patch),
    message: detail,
  });
}

function notifyWorkflowError(
  step: CreationWorkflowStep,
  detail: string,
  error?: string,
): void {
  useNotificationStore.getState().push({
    type: 'error',
    title: `AI gặp lỗi khi ${WORKFLOW_STEP_LABELS[step]}`,
    message: error ?? detail,
    duration: 0,
  });
}

function buildPersistedMessage(
  state: CreationChatState,
  message: Omit<CreationMessage, 'id' | 'timestamp'>,
): CreationChatState {
  return {
    ...state,
    messages: [
      ...state.messages,
      { ...message, id: createId(), timestamp: touch() },
    ],
    draftSavedAt: touch(),
  };
}

function normalizeFrameworkMessage(message: CreationMessage): CreationMessage {
  return message.type === 'framework_preview' && message.frameworkData
    ? {
      ...message,
      frameworkData: normalizeCreationFramework(message.frameworkData),
    }
    : message;
}

export const useCreationChatStore = create<
  CreationChatState & CreationChatActions
>()(
  persist(
    (set) => ({
      ...createInitialState(),

      addMessage: (msg) =>
        set((state) => buildPersistedMessage(state, msg)),

      addUserText: (text) =>
        set((state) =>
          buildPersistedMessage(state, {
            role: 'user',
            content: text,
            type: 'text',
          }),
        ),

      addAiText: (text, tokenUsage) =>
        set((state) =>
          buildPersistedMessage(state, {
            role: 'ai',
            content: text,
            type: 'text',
            tokenUsage,
          }),
        ),

      addAiSuggestions: (text, suggestions, aiDecideLabel, tokenUsage) =>
        set((state) =>
          buildPersistedMessage(state, {
            role: 'ai',
            content: text,
            type: 'suggestions',
            suggestions,
            aiDecideLabel: aiDecideLabel || '🤖 AI tự quyết định',
            tokenUsage,
          }),
        ),

      addSystemMessage: (text) =>
        set((state) =>
          buildPersistedMessage(state, {
            role: 'system',
            content: text,
            type: 'phase_transition',
          }),
        ),

      addCostPreview: (data, introText) =>
        set((state) =>
          buildPersistedMessage(state, {
            role: 'ai',
            content: introText,
            type: 'cost_preview',
            costPreviewData: data,
          }),
        ),

      addLoadingMessage: () => {
        const id = createId();
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id,
              role: 'ai',
              content: '',
              type: 'loading',
              timestamp: touch(),
            },
          ],
          draftSavedAt: touch(),
        }));
        return id;
      },

      removeMessage: (id) =>
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== id),
          draftSavedAt: touch(),
        })),

      setPhase: (phase) =>
        set((state) => ({
          phase,
          progress: {
            ...state.progress,
            step: mapPhaseToStep(phase),
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        })),

      addPhaseTransition: (text, nextPhase) =>
        set((state) => ({
          phase: nextPhase,
          progress: {
            ...state.progress,
            step: mapPhaseToStep(nextPhase),
            updatedAt: touch(),
          },
          messages: [
            ...state.messages,
            {
              id: createId(),
              role: 'system',
              content: text,
              type: 'phase_transition',
              timestamp: touch(),
            },
          ],
          draftSavedAt: touch(),
        })),

      setCurrentTopicIndex: (index) =>
        set({
          currentTopicIndex: index,
          draftSavedAt: touch(),
        }),

      setAnswer: (topicId, value) =>
        set((state) => ({
          answers: { ...state.answers, [topicId]: value },
          draftSavedAt: touch(),
        })),

      setPlotPreview: (preview) =>
        set({
          plotPreview: preview ? normalizeCreationPlotPreview(preview) : preview,
          plotPreviewConfirmed: false,
          draftSavedAt: touch(),
        }),

      addPlotPreview: (
        data,
        introText = 'Đây là bản review cốt truyện trước khi AI dựng khung đầy đủ:',
        tokenUsage,
      ) =>
        set((state) => {
          const normalizedData = normalizeCreationPlotPreview(data);

          return {
            phase: 'review_plot',
            plotPreview: normalizedData,
            plotPreviewConfirmed: false,
            messages: [
              ...state.messages,
              {
                id: createId(),
                role: 'ai',
                content: introText,
                type: 'plot_preview',
                plotPreviewData: normalizedData,
                tokenUsage,
                timestamp: touch(),
              },
            ],
            draftSavedAt: touch(),
          };
        }),

      confirmPlotPreview: () =>
        set((state) => ({
          plotPreview: state.plotPreview ? normalizeCreationPlotPreview(state.plotPreview) : state.plotPreview,
          plotPreviewConfirmed: true,
          progress: {
            ...state.progress,
            step: 'framework',
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        })),

      setFramework: (result) =>
        set({
          framework: normalizeCreationFramework(result),
          draftSavedAt: touch(),
        }),

      confirmFramework: () =>
        set((state) => ({
          frameworkConfirmed: true,
          progress: {
            ...state.progress,
            step: 'compose',
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        })),

      addFrameworkPreview: (data, tokenUsage) =>
        set((state) => ({
          framework: normalizeCreationFramework(data),
          messages: [
            ...state.messages,
            {
              id: createId(),
              role: 'ai',
              content: 'Đã tạo xong khung lớn cho truyện:',
              type: 'framework_preview',
              frameworkData: normalizeCreationFramework(data),
              tokenUsage,
              timestamp: touch(),
            },
          ],
          draftSavedAt: touch(),
        })),

      setCurrentChapterIndex: (index) =>
        set({
          currentChapterIndex: index,
          draftSavedAt: touch(),
        }),

      addChapterDraft: (draft) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: createId(),
              role: 'ai',
              content: draft.content,
              type: 'chapter_draft',
              chapterDraft: {
                ...draft,
                charCount: draft.content.length,
              },
              tokenUsage: draft.tokenUsage,
              timestamp: touch(),
            },
          ],
          draftSavedAt: touch(),
        })),

      addAcceptedChapter: (chapter) =>
        set((state) => {
          const now = touch();
          return {
            acceptedChapters: [
              ...state.acceptedChapters,
              {
                ...chapter,
                id: createId(),
                createdAt: now,
                updatedAt: now,
              },
            ],
            draftSavedAt: now,
          };
        }),

      updateAcceptedChapter: (id, patch) =>
        set((state) => ({
          acceptedChapters: state.acceptedChapters.map((chapter) =>
            chapter.id === id
              ? {
                ...chapter,
                ...patch,
                charCount: patch.content !== undefined ? patch.content.length : chapter.charCount,
                updatedAt: touch(),
              }
              : chapter,
          ),
          draftSavedAt: touch(),
        })),

      removeAcceptedChapter: (id) =>
        set((state) => ({
          acceptedChapters: state.acceptedChapters.filter((chapter) => chapter.id !== id),
          draftSavedAt: touch(),
        })),

      addManualChapter: (title, content) =>
        set((state) => {
          const now = touch();
          return {
            acceptedChapters: [
              ...state.acceptedChapters,
              {
                id: createId(),
                chapterIndex: state.acceptedChapters.length,
                title: title || `Chương ${state.acceptedChapters.length + 1}`,
                content,
                charCount: content.length,
                createdAt: now,
                updatedAt: now,
              },
            ],
            draftSavedAt: now,
          };
        }),

      setDraftInput: (value) =>
        set({
          draftInput: value,
          draftSavedAt: touch(),
        }),

      startWorkflowStep: (step, detail) =>
        set((state) => ({
          progress: {
            ...state.progress,
            step,
            status: 'running',
            detail,
            error: null,
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        })),

      finishWorkflowStep: (step, detail, patch) => {
        notifyWorkflowSuccess(step, detail, patch);
        set((state) => ({
          progress: {
            ...state.progress,
            step,
            status: 'success',
            detail,
            lastCompletedStep: step,
            lastCompletedAt: touch(),
            updatedAt: touch(),
            error: null,
            linkedProjectId: patch?.linkedProjectId ?? state.progress.linkedProjectId,
            lastGeneratedChapterTitle:
              patch?.lastGeneratedChapterTitle ?? state.progress.lastGeneratedChapterTitle,
          },
          draftSavedAt: touch(),
        }));
      },

      failWorkflowStep: (step, detail, error) => {
        notifyWorkflowError(step, detail, error);
        set((state) => ({
          progress: {
            ...state.progress,
            step,
            status: 'error',
            detail,
            error: error ?? detail,
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        }));
      },

      interruptWorkflowStep: (detail) =>
        set((state) => ({
          isAiWorking: false,
          progress: {
            ...state.progress,
            status: 'interrupted',
            detail: detail || `Phiên trước bị gián đoạn khi đang ở bước ${state.progress.step}.`,
            error: null,
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        })),

      linkProject: (projectId) =>
        set((state) => ({
          progress: {
            ...state.progress,
            linkedProjectId: projectId,
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        })),

      unlinkProject: () =>
        set((state) => ({
          progress: {
            ...state.progress,
            linkedProjectId: null,
            updatedAt: touch(),
          },
          isBatchComposing: false,
        })),

      syncEditorTextMessages: (projectId, chapterId, messages) =>
        set((state) => {
          if (state.progress.linkedProjectId !== projectId) {
            return state;
          }

          const idPrefix = `editor:${projectId}:${chapterId}:`;
          const syncedMessages = messages
            .filter(
              (message) =>
                !message.id.startsWith('creation-') &&
                message.content.trim().length > 0,
            )
            .map((message) => ({
              id: `${idPrefix}${message.id}`,
              role: message.role === 'assistant' ? 'ai' as const : 'user' as const,
              content: message.content,
              type: 'text' as const,
              timestamp: message.timestamp,
            }));
          const syncedIds = new Set(syncedMessages.map((message) => message.id));
          const syncedById = new Map(syncedMessages.map((message) => [message.id, message]));
          let changed = false;

          const nextMessages = state.messages
            .filter((message) => {
              if (!message.id.startsWith(idPrefix)) return true;
              const keep = syncedIds.has(message.id);
              if (!keep) changed = true;
              return keep;
            })
            .map((message) => {
              const synced = syncedById.get(message.id);
              if (!synced) return message;
              syncedById.delete(message.id);

              if (
                message.role === synced.role &&
                message.content === synced.content &&
                message.timestamp === synced.timestamp &&
                message.type === synced.type
              ) {
                return message;
              }

              changed = true;
              return { ...message, ...synced };
            });

          if (syncedById.size > 0) {
            changed = true;
            nextMessages.push(...syncedById.values());
          }

          if (!changed) return state;

          return {
            messages: nextMessages,
            draftSavedAt: touch(),
          };
        }),

      setAiWorking: (working) =>
        set({
          isAiWorking: working,
          draftSavedAt: touch(),
        }),

      setIsBatchComposing: (composing) =>
        set({
          isBatchComposing: composing,
          draftSavedAt: touch(),
        }),

      setBatchComposeProgress: (batchCompose) =>
        set((state) => ({
          progress: {
            ...state.progress,
            batchCompose,
            updatedAt: touch(),
          },
          draftSavedAt: touch(),
        })),

      setError: (error) =>
        set((state) => ({
          error,
          progress:
            error == null
              ? state.progress
              : {
                ...state.progress,
                status: 'error',
                error,
                updatedAt: touch(),
              },
          draftSavedAt: touch(),
        })),

      reset: () => set(createInitialState()),

      archiveAndReset: async (reason) => {
        const currentState = useCreationChatStore.getState();
        try {
          await archiveCurrentSession(currentState, reason);
        } catch (err) {
          console.warn('[CreationChatStore] Archive failed, resetting anyway:', err);
        }
        set(createInitialState());
      },

      restoreFromArchive: async (sessionId) => {
        try {
          const archived = await getArchivedSession(sessionId);
          if (!archived) return false;

          const payload = buildRestorePayload(archived);
          set({
            ...payload,
            isAiWorking: false,
            isBatchComposing: false,
            error: null,
          });
          return true;
        } catch (err) {
          console.warn('[CreationChatStore] Restore from archive failed:', err);
          return false;
        }
      },
    }),
    {
      name: 'viettruyen-creation-chat',
      // Creation chat can mirror streaming editor messages. Avoid synchronous
      // JSON.stringify/localStorage writes on every streamed chunk.
      storage: createDebouncedPersistStorage(500),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;

        const staleLoadingIds = state.messages
          .filter((message) => message.type === 'loading')
          .map((message) => message.id);

        staleLoadingIds.forEach((id) => state.removeMessage(id));
        state.setAiWorking(false);
        state.setIsBatchComposing(false);
        // [Domain:CreationChat] Clear stale batch compose progress on reload
        if (state.progress.batchCompose?.isRunning) {
          state.setBatchComposeProgress(null);
        }
        if (state.progress.status === 'running') {
          state.interruptWorkflowStep(
            `Phiên trước bị gián đoạn khi đang ${state.progress.detail.toLowerCase()}. Bạn có thể tiếp tục từ bước này.`,
          );
        }
      },
      migrate: (persistedState) => {
        const typedState = (persistedState ?? {}) as Partial<CreationChatState>;
        return {
          ...typedState,
          framework: typedState.framework
            ? normalizeCreationFramework(typedState.framework)
            : typedState.framework ?? null,
          messages: Array.isArray(typedState.messages)
            ? typedState.messages.map((message) => normalizeFrameworkMessage(message as CreationMessage))
            : [],
        };
      },
      partialize: (state) => ({
        sessionId: state.sessionId,
        sessionStartedAt: state.sessionStartedAt,
        phase: state.phase,
        messages: stripTransientMessages(state.messages).map(normalizeFrameworkMessage),
        currentTopicIndex: state.currentTopicIndex,
        answers: state.answers,
        plotPreview: state.plotPreview,
        plotPreviewConfirmed: state.plotPreviewConfirmed,
        framework: state.framework ? normalizeCreationFramework(state.framework) : state.framework,
        frameworkConfirmed: state.frameworkConfirmed,
        currentChapterIndex: state.currentChapterIndex,
        acceptedChapters: state.acceptedChapters,
        draftInput: state.draftInput,
        draftSavedAt: state.draftSavedAt,
        progress: state.progress,
        isAiWorking: false,
        isBatchComposing: false,
        error: state.error,
      }),
    },
  ),
);

export type CreationChatStore = ReturnType<typeof useCreationChatStore.getState>;
