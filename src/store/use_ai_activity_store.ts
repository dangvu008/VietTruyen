/**
 * File: use_ai_activity_store.ts
 * Purpose: Zustand store theo dõi AI activity real-time — model nào đang chạy, token usage live
 * Layer: Store
 * Domain: AI → [activity tracking, real-time status, user feedback]
 *
 * Data Contract:
 * - Input:  startCall / endCall / updateTokens from tracked_ai_client + streaming_ai_client
 * - Output: Current activity state for AiActivityOverlay UI
 */
import { create } from 'zustand';
import type { AiTaskType } from '../lib/ai/model_router';

/** Một AI call đang chạy */
export interface ActiveAiCall {
  id: string;
  modelId: string;
  modelName: string;
  provider: string;
  taskType: AiTaskType;
  startedAt: number;
  /** Token usage — updated live for streaming, final for non-streaming */
  inputTokens: number;
  outputTokens: number;
  /** Streaming: accumulated text length */
  streamedChars: number;
  /** Whether this is a streaming call */
  isStreaming: boolean;
}

/** Lịch sử call gần nhất (đã hoàn thành) */
export interface CompletedAiCall {
  id: string;
  modelId: string;
  modelName: string;
  provider: string;
  taskType: AiTaskType;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  estimatedCost: number;
  completedAt: number;
  cached: boolean;
}

interface AiActivityState {
  /** Calls đang chạy (có thể nhiều song song) */
  activeCalls: ActiveAiCall[];
  /** N calls gần nhất đã hoàn thành — cho "fade out" display */
  recentCompleted: CompletedAiCall[];
  /** Session tổng: tokens đã dùng từ khi mở app */
  sessionTotalTokens: number;
  sessionTotalCost: number;
  sessionCallCount: number;

  // ── Actions ──
  startCall: (call: Omit<ActiveAiCall, 'startedAt' | 'inputTokens' | 'outputTokens' | 'streamedChars'>) => void;
  updateStreamProgress: (callId: string, streamedChars: number, outputTokens?: number) => void;
  endCall: (callId: string, result: {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    estimatedCost: number;
    cached: boolean;
  }) => void;
  /** Clear all (e.g., on page reload) */
  reset: () => void;
}

const MAX_RECENT = 5;
const RECENT_TTL_MS = 8_000; // Auto-remove completed after 8s

export const useAiActivityStore = create<AiActivityState>((set, get) => ({
  activeCalls: [],
  recentCompleted: [],
  sessionTotalTokens: 0,
  sessionTotalCost: 0,
  sessionCallCount: 0,

  startCall: (call) => {
    const activeCall: ActiveAiCall = {
      ...call,
      startedAt: Date.now(),
      inputTokens: 0,
      outputTokens: 0,
      streamedChars: 0,
    };
    set((state) => ({
      activeCalls: [...state.activeCalls, activeCall],
    }));
  },

  updateStreamProgress: (callId, streamedChars, outputTokens) => {
    set((state) => ({
      activeCalls: state.activeCalls.map((c) =>
        c.id === callId
          ? {
              ...c,
              streamedChars,
              outputTokens: outputTokens ?? c.outputTokens,
            }
          : c
      ),
    }));
  },

  endCall: (callId, result) => {
    const { activeCalls } = get();
    const activeCall = activeCalls.find((c) => c.id === callId);
    if (!activeCall) return;

    const completed: CompletedAiCall = {
      id: activeCall.id,
      modelId: activeCall.modelId,
      modelName: activeCall.modelName,
      provider: activeCall.provider,
      taskType: activeCall.taskType,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.inputTokens + result.outputTokens,
      durationMs: result.durationMs,
      estimatedCost: result.estimatedCost,
      completedAt: Date.now(),
      cached: result.cached,
    };

    set((state) => ({
      activeCalls: state.activeCalls.filter((c) => c.id !== callId),
      recentCompleted: [completed, ...state.recentCompleted].slice(0, MAX_RECENT),
      sessionTotalTokens: state.sessionTotalTokens + completed.totalTokens,
      sessionTotalCost: state.sessionTotalCost + result.estimatedCost,
      sessionCallCount: state.sessionCallCount + 1,
    }));

    // Auto-remove from recentCompleted after TTL
    setTimeout(() => {
      set((state) => ({
        recentCompleted: state.recentCompleted.filter((c) => c.id !== callId),
      }));
    }, RECENT_TTL_MS);
  },

  reset: () =>
    set({
      activeCalls: [],
      recentCompleted: [],
      sessionTotalTokens: 0,
      sessionTotalCost: 0,
      sessionCallCount: 0,
    }),
}));
