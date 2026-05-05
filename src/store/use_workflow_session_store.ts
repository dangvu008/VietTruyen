import { create } from 'zustand';
import { executeWorkflowIntent } from '../lib/workflow/writer_orchestrator';
import { traceStoryDebugEvent } from '../lib/debug/story_debug_trace';
import type { SupportedWorkflowIntent, WorkflowSession } from '../types/workflow';

export interface StreamingIntentOptions {
  /** Realtime chunk callback — enables streaming mode for the write step */
  onChunk?: (chunk: string, accumulated: string) => void;
  /** AbortSignal to cancel generation mid-stream */
  signal?: AbortSignal;
}

interface WorkflowSessionState {
  sessions: Record<string, WorkflowSession>;
  activeSessionId: string | null;
  startIntent: (intent: SupportedWorkflowIntent, opts?: StreamingIntentOptions) => Promise<WorkflowSession>;
  setActiveSession: (sessionId: string | null) => void;
  clearActiveSession: () => void;
  removeSession: (sessionId: string) => void;
  getActiveSession: () => WorkflowSession | null;
}

export const useWorkflowSessionStore = create<WorkflowSessionState>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  startIntent: async (intent, opts) => {
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'workflow.intent.start',
      level: 'info',
      summary: `Workflow intent started: ${intent.type}.`,
      details: {
        intentId: intent.id,
        type: intent.type,
        projectId: intent.projectId,
        chapterId: intent.chapterId,
        source: intent.source,
        streaming: Boolean(opts?.onChunk),
      },
    });
    const session = await executeWorkflowIntent(intent, {
      onUpdate: (nextSession) => {
        traceStoryDebugEvent({
          domain: 'generation',
          action: 'workflow.session.update',
          level: nextSession.step === 'failed' ? 'error' : 'info',
          summary: `Workflow session ${nextSession.id} moved to ${nextSession.step}.`,
          details: {
            sessionId: nextSession.id,
            intentId: nextSession.intent.id,
            type: nextSession.intent.type,
            projectId: nextSession.intent.projectId,
            chapterId: nextSession.intent.chapterId,
            step: nextSession.step,
            statusMessage: nextSession.statusMessage,
            error: nextSession.error,
            artifacts: {
              hasPlanningResult: Boolean(nextSession.artifacts.planningResult),
              hasChapterWriteResult: Boolean(nextSession.artifacts.chapterWriteResult),
              draftChars: nextSession.artifacts.draftText?.length ?? 0,
              chapterContentChars: nextSession.artifacts.chapterWriteResult?.content.length ?? 0,
            },
            metrics: nextSession.metrics,
          },
        });
        set((state) => ({
          sessions: {
            ...state.sessions,
            [nextSession.id]: nextSession,
          },
          activeSessionId: nextSession.id,
        }));
      },
      onChunk: opts?.onChunk,
      signal: opts?.signal,
    });
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'workflow.intent.complete',
      level: session.step === 'failed' ? 'error' : 'info',
      summary: `Workflow intent completed: ${intent.type}.`,
      details: {
        sessionId: session.id,
        intentId: intent.id,
        type: intent.type,
        projectId: intent.projectId,
        chapterId: intent.chapterId,
        step: session.step,
        error: session.error,
        metrics: session.metrics,
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
