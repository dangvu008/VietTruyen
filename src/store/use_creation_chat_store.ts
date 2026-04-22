/**
 * File: use_creation_chat_store.ts
 * Purpose: Persisted Zustand store cho Unified Creation Chat Flow — 4 phases + autosave/resume
 * Layer: Store
 * Domain: CreationChat → [phase management, workflow progress, autosave draft]
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createId } from '../core/id';
import type {
  AcceptedChapter,
  CreationChatState,
  CreationMessage,
  CreationPhase,
  CreationPlotPreview,
  CreationWorkflowStep,
  SuggestionGroup,
} from '../types/creation_chat';
import type { BrainstormResult } from '../types/narrative_memory';

interface WorkflowProgressPatch {
  linkedProjectId?: string | null;
  lastGeneratedChapterTitle?: string | null;
}

interface CreationChatActions {
  addMessage: (msg: Omit<CreationMessage, 'id' | 'timestamp'>) => void;
  addUserText: (text: string) => void;
  addAiText: (text: string) => void;
  addAiSuggestions: (
    text: string,
    suggestions: SuggestionGroup[],
    aiDecideLabel?: string,
  ) => void;
  addSystemMessage: (text: string) => void;
  addLoadingMessage: () => string;
  removeMessage: (id: string) => void;
  setPhase: (phase: CreationPhase) => void;
  addPhaseTransition: (text: string, nextPhase: CreationPhase) => void;
  setCurrentTopicIndex: (index: number) => void;
  setAnswer: (topicId: string, value: string) => void;
  setPlotPreview: (preview: CreationPlotPreview | null) => void;
  addPlotPreview: (data: CreationPlotPreview, introText?: string) => void;
  confirmPlotPreview: () => void;
  setFramework: (result: BrainstormResult) => void;
  confirmFramework: () => void;
  addFrameworkPreview: (data: BrainstormResult) => void;
  setCurrentChapterIndex: (index: number) => void;
  addChapterDraft: (draft: {
    chapterIndex: number;
    title: string;
    content: string;
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
  setAiWorking: (working: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
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
  },
  isAiWorking: false,
  error: null,
});

const touch = () => nowIso();

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

export const useCreationChatStore = create<
  CreationChatState & CreationChatActions
>()(
  persist(
    (set, get) => ({
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

      addAiText: (text) =>
        set((state) =>
          buildPersistedMessage(state, {
            role: 'ai',
            content: text,
            type: 'text',
          }),
        ),

      addAiSuggestions: (text, suggestions, aiDecideLabel) =>
        set((state) =>
          buildPersistedMessage(state, {
            role: 'ai',
            content: text,
            type: 'suggestions',
            suggestions,
            aiDecideLabel: aiDecideLabel || '🤖 AI tự quyết định',
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
          plotPreview: preview,
          plotPreviewConfirmed: false,
          draftSavedAt: touch(),
        }),

      addPlotPreview: (data, introText = 'Đây là bản review cốt truyện trước khi AI dựng khung đầy đủ:') =>
        set((state) => ({
          phase: 'review_plot',
          plotPreview: data,
          plotPreviewConfirmed: false,
          messages: [
            ...state.messages,
            {
              id: createId(),
              role: 'ai',
              content: introText,
              type: 'plot_preview',
              plotPreviewData: data,
              timestamp: touch(),
            },
          ],
          draftSavedAt: touch(),
        })),

      confirmPlotPreview: () =>
        set((state) => ({
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
          framework: result,
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

      addFrameworkPreview: (data) =>
        set((state) => ({
          framework: data,
          messages: [
            ...state.messages,
            {
              id: createId(),
              role: 'ai',
              content: 'Đã tạo xong khung lớn cho truyện:',
              type: 'framework_preview',
              frameworkData: data,
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

      finishWorkflowStep: (step, detail, patch) =>
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
        })),

      failWorkflowStep: (step, detail, error) =>
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
        })),

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

      setAiWorking: (working) =>
        set({
          isAiWorking: working,
          draftSavedAt: touch(),
        }),

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
    }),
    {
      name: 'viettruyen-creation-chat',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;

        state.setAiWorking(false);
        if (state.progress.status === 'running') {
          state.interruptWorkflowStep(
            `Phiên trước bị gián đoạn khi đang ${state.progress.detail.toLowerCase()}. Bạn có thể tiếp tục từ bước này.`,
          );
        }
      },
      partialize: (state) => ({
        sessionId: state.sessionId,
        sessionStartedAt: state.sessionStartedAt,
        phase: state.phase,
        messages: state.messages,
        currentTopicIndex: state.currentTopicIndex,
        answers: state.answers,
        plotPreview: state.plotPreview,
        plotPreviewConfirmed: state.plotPreviewConfirmed,
        framework: state.framework,
        frameworkConfirmed: state.frameworkConfirmed,
        currentChapterIndex: state.currentChapterIndex,
        acceptedChapters: state.acceptedChapters,
        draftInput: state.draftInput,
        draftSavedAt: state.draftSavedAt,
        progress: state.progress,
        isAiWorking: false,
        error: state.error,
      }),
    },
  ),
);

export type CreationChatStore = ReturnType<typeof useCreationChatStore.getState>;
