/**
 * File: use_app_session_store.ts
 * Purpose: Persist lightweight app workspace session for crash-safe resume
 * Layer: Store
 * Domain: AppSession → [shell navigation, settings sub-tab, writer chapter resume]
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppShell, GlobalTabId, ProjectTabId } from '../types/navigation';

export type SettingsTabId = 'ai' | 'appearance' | 'data' | 'notifications';

interface AppSessionState {
  activeShell: AppShell;
  globalTab: GlobalTabId;
  projectTab: ProjectTabId;
  settingsTab: SettingsTabId;
  activeWriterChapterIdByProject: Record<string, string | null>;
}

interface AppSessionActions {
  setActiveShell: (shell: AppShell) => void;
  setGlobalTab: (tab: GlobalTabId) => void;
  setProjectTab: (tab: ProjectTabId) => void;
  setSettingsTab: (tab: SettingsTabId) => void;
  rememberWriterChapter: (projectId: string, chapterId: string | null) => void;
  clearWriterChapter: (projectId: string) => void;
}

const DEFAULT_STATE: AppSessionState = {
  activeShell: 'global',
  globalTab: 'dashboard',
  projectTab: 'bible',
  settingsTab: 'ai',
  activeWriterChapterIdByProject: {},
};

export function resolveWriterResumeChapterId<T extends { id: string }>(
  chapters: T[],
  rememberedChapterId: string | null | undefined,
): string | null {
  if (rememberedChapterId && chapters.some((chapter) => chapter.id === rememberedChapterId)) {
    return rememberedChapterId;
  }

  return chapters[0]?.id ?? null;
}

export const useAppSessionStore = create<AppSessionState & AppSessionActions>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setActiveShell: (activeShell) => set({ activeShell }),
      setGlobalTab: (globalTab) => set({ globalTab }),
      setProjectTab: (projectTab) => set({ projectTab }),
      setSettingsTab: (settingsTab) => set({ settingsTab }),

      rememberWriterChapter: (projectId, chapterId) =>
        set((state) => ({
          activeWriterChapterIdByProject: {
            ...state.activeWriterChapterIdByProject,
            [projectId]: chapterId,
          },
        })),

      clearWriterChapter: (projectId) =>
        set((state) => {
          if (!(projectId in state.activeWriterChapterIdByProject)) {
            return state;
          }

          const next = { ...state.activeWriterChapterIdByProject };
          delete next[projectId];

          return {
            activeWriterChapterIdByProject: next,
          };
        }),
    }),
    {
      name: 'viettruyen-app-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeShell: state.activeShell,
        globalTab: state.globalTab,
        projectTab: state.projectTab,
        settingsTab: state.settingsTab,
        activeWriterChapterIdByProject: state.activeWriterChapterIdByProject,
      }),
    },
  ),
);
