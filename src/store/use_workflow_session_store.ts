import { create } from 'zustand';
import { executeWorkflowIntent } from '../lib/workflow/writer_orchestrator';
import type { SupportedWorkflowIntent, WorkflowSession } from '../types/workflow';

interface WorkflowSessionState {
  sessions: Record<string, WorkflowSession>;
  activeSessionId: string | null;
  startIntent: (intent: SupportedWorkflowIntent) => Promise<WorkflowSession>;
  setActiveSession: (sessionId: string | null) => void;
  clearActiveSession: () => void;
  removeSession: (sessionId: string) => void;
  getActiveSession: () => WorkflowSession | null;
}

export const useWorkflowSessionStore = create<WorkflowSessionState>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  startIntent: async (intent) => {
    const session = await executeWorkflowIntent(intent, {
      onUpdate: (nextSession) => {
        set((state) => ({
          sessions: {
            ...state.sessions,
            [nextSession.id]: nextSession,
          },
          activeSessionId: nextSession.id,
        }));
      },
    });

    return session;
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  clearActiveSession: () => {
    set({ activeSessionId: null });
  },

  removeSession: (sessionId) => {
    set((state) => {
      const nextSessions = { ...state.sessions };
      delete nextSessions[sessionId];
      return {
        sessions: nextSessions,
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
      };
    });
  },

  getActiveSession: () => {
    const state = get();
    if (!state.activeSessionId) return null;
    return state.sessions[state.activeSessionId] ?? null;
  },
}));
