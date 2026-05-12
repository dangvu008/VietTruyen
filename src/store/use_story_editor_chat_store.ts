/**
 * File: use_story_editor_chat_store.ts
 * Purpose: Persist per-project, per-chapter Muse chat history for the story editor
 * Layer: Store
 * Domain: StoryEditor
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ChatMessage } from '../components/story-editor/editor_types';
import {
  normalizePersistedStoryEditorMessages,
  normalizeStoryEditorMessages,
} from '../components/story-editor/story_editor_chat_history';
import { createDebouncedPersistStorage } from '../lib/storage/debounced_local_storage';

interface StoryEditorChatState {
  chapterMessagesByProject: Record<string, Record<string, ChatMessage[]>>;
}

interface StoryEditorChatActions {
  setChapterMessages: (projectId: string, chapterId: string, messages: ChatMessage[]) => void;
  seedChapterMessages: (projectId: string, chapterId: string, messages: ChatMessage[]) => void;
  clearChapterMessages: (projectId: string, chapterId: string) => void;
}

function normalizePersistedChapterMessages(
  value: unknown,
): Record<string, Record<string, ChatMessage[]>> {
  if (!value || typeof value !== 'object') return {};

  const projects = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(projects)
      .map(([projectId, chapters]) => {
        if (!chapters || typeof chapters !== 'object') return null;

        const normalizedChapters = Object.fromEntries(
          Object.entries(chapters as Record<string, unknown>)
            .filter(([, messages]) => Array.isArray(messages))
            .map(([chapterId, messages]) => [
              chapterId,
              normalizePersistedStoryEditorMessages(messages as ChatMessage[]),
            ]),
        );

        return [projectId, normalizedChapters] as const;
      })
      .filter((entry): entry is readonly [string, Record<string, ChatMessage[]>] => entry !== null),
  );
}

function normalizePersistedStoryEditorChatState(
  persistedState: unknown,
): Pick<StoryEditorChatState, 'chapterMessagesByProject'> {
  const state = (persistedState ?? {}) as Partial<StoryEditorChatState>;

  return {
    chapterMessagesByProject: normalizePersistedChapterMessages(
      state.chapterMessagesByProject,
    ),
  };
}

export const useStoryEditorChatStore = create<
  StoryEditorChatState & StoryEditorChatActions
>()(
  persist(
    (set) => ({
      chapterMessagesByProject: {},

      setChapterMessages: (projectId, chapterId, messages) =>
        set((state) => ({
          chapterMessagesByProject: {
            ...state.chapterMessagesByProject,
            [projectId]: {
              ...(state.chapterMessagesByProject[projectId] || {}),
              [chapterId]: normalizeStoryEditorMessages(messages),
            },
          },
        })),

      seedChapterMessages: (projectId, chapterId, messages) =>
        set((state) => {
          const projectMessages = state.chapterMessagesByProject[projectId] || {};
          if (projectMessages[chapterId]?.length) {
            return state;
          }

          return {
            chapterMessagesByProject: {
              ...state.chapterMessagesByProject,
              [projectId]: {
                ...projectMessages,
                [chapterId]: normalizeStoryEditorMessages(messages),
              },
            },
          };
        }),

      clearChapterMessages: (projectId, chapterId) =>
        set((state) => {
          const projectMessages = state.chapterMessagesByProject[projectId];
          if (!projectMessages?.[chapterId]) {
            return state;
          }

          const nextProjectMessages = { ...projectMessages };
          delete nextProjectMessages[chapterId];

          return {
            chapterMessagesByProject: {
              ...state.chapterMessagesByProject,
              [projectId]: nextProjectMessages,
            },
          };
        }),
    }),
    {
      name: 'viettruyen-story-editor-chat',
      // Streaming Muse updates can arrive dozens of times per second. The
      // default JSON storage stringifies synchronously on every chunk, freezing
      // editor interactions. Debounced storage updates the in-memory snapshot
      // immediately and flushes JSON/localStorage during idle time.
      storage: createDebouncedPersistStorage(500),
      version: 1,
      migrate: (persistedState) =>
        normalizePersistedStoryEditorChatState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePersistedStoryEditorChatState(persistedState),
      }),
      partialize: (state) => ({
        chapterMessagesByProject: normalizePersistedChapterMessages(
          state.chapterMessagesByProject,
        ),
      }),
    },
  ),
);
