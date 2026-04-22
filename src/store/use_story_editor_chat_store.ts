/**
 * File: use_story_editor_chat_store.ts
 * Purpose: Persist per-project, per-chapter Muse chat history for the story editor
 * Layer: Store
 * Domain: StoryEditor
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ChatMessage } from '../components/story-editor/editor_types';
import { normalizeStoryEditorMessages } from '../components/story-editor/story_editor_chat_history';

interface StoryEditorChatState {
  chapterMessagesByProject: Record<string, Record<string, ChatMessage[]>>;
}

interface StoryEditorChatActions {
  setChapterMessages: (projectId: string, chapterId: string, messages: ChatMessage[]) => void;
  seedChapterMessages: (projectId: string, chapterId: string, messages: ChatMessage[]) => void;
  clearChapterMessages: (projectId: string, chapterId: string) => void;
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        chapterMessagesByProject: state.chapterMessagesByProject,
      }),
    },
  ),
);
