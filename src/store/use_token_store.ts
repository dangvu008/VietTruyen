/**
 * File: use_token_store.ts
 * Purpose: Zustand store theo dõi token usage — persisted, auto-compute stats
 * Layer: Store
 * Domain: AI → [token tracking, cost analytics]
 *
 * Data Contract:
 * - Input:  TokenUsageRecord from tracked AI client
 * - Output: TokenStats aggregated data for dashboard
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { resolveModelCostRates } from '../lib/ai/token_estimator';
import type {
  TokenUsageRecord,
  TokenStats,
  TokenOptimizationTaskStatus,
  PipelineSession,
  PipelineStepLabel,
} from '../types/token_tracker';

interface TokenState {
  records: TokenUsageRecord[];
  pipelineSessions: PipelineSession[];
  taskStatusById: Record<string, TokenOptimizationTaskStatus>;
  recordCall: (record: TokenUsageRecord) => void;
  recordPipelineSession: (session: PipelineSession) => void;
  clearRecords: () => void;
  getStats: () => TokenStats;
  getPipelineSessions: () => PipelineSession[];
  getPipelineSessionDetails: (sessionId: string) => {
    session: PipelineSession | undefined;
    records: TokenUsageRecord[];
  };
  setTaskStatus: (taskId: string, status: TokenOptimizationTaskStatus) => void;
  resetTaskStatuses: () => void;
}

const MAX_RECORDS = 500;
const MAX_PIPELINE_SESSIONS = 100;

/** Tạo empty step breakdown */
function emptyStepBreakdown(): PipelineSession['stepBreakdown'] {
  const steps: PipelineStepLabel[] = [
    'context_build', 'plan_branches', 'write_chapter',
    'review_checkers', 'style_analysis', 'data_extraction', 'memory_sync',
  ];
  const result: Partial<PipelineSession['stepBreakdown']> = {};
  for (const step of steps) {
    result[step] = { tokens: 0, cost: 0, calls: 0, durationMs: 0 };
  }
  return result as PipelineSession['stepBreakdown'];
}

function resolveUncachedEquivalentCost(record: TokenUsageRecord): number {
  if (typeof record.estimatedCostIfNotCached === 'number') {
    return record.estimatedCostIfNotCached;
  }

  const { inputRate, outputRate } = resolveModelCostRates(record.modelId);
  return (record.inputTokens / 1_000_000) * inputRate + (record.outputTokens / 1_000_000) * outputRate;
}


export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      records: [],
      pipelineSessions: [],
      taskStatusById: {},

      recordCall: (record) =>
        set((state) => {
          const next = [record, ...state.records].slice(0, MAX_RECORDS);
          return { records: next };
        }),

      recordPipelineSession: (session) =>
        set((state) => {
          // Rebuild stepBreakdown from records matching this session
          const sessionRecords = state.records.filter(
            (r) => r.pipelineSessionId === session.id
          );
          const stepBreakdown = emptyStepBreakdown();
          let totalTokens = 0;
          let totalCost = 0;
          let totalCalls = 0;
          for (const r of sessionRecords) {
            totalTokens += r.totalTokens;
            totalCost += r.estimatedCost;
            totalCalls++;
            if (r.pipelineStep && stepBreakdown[r.pipelineStep]) {
              stepBreakdown[r.pipelineStep].tokens += r.totalTokens;
              stepBreakdown[r.pipelineStep].cost += r.estimatedCost;
              stepBreakdown[r.pipelineStep].calls++;
              stepBreakdown[r.pipelineStep].durationMs += r.durationMs;
            }
          }
          const enriched: PipelineSession = {
            ...session,
            totalTokens,
            totalCost,
            totalCalls,
            stepBreakdown,
          };
          const next = [enriched, ...state.pipelineSessions].slice(0, MAX_PIPELINE_SESSIONS);
          return { pipelineSessions: next };
        }),

      clearRecords: () => set({ records: [], pipelineSessions: [], taskStatusById: {} }),

      setTaskStatus: (taskId, status) =>
        set((state) => ({
          taskStatusById: {
            ...state.taskStatusById,
            [taskId]: status,
          },
        })),

      resetTaskStatuses: () => set({ taskStatusById: {} }),

      getStats: () => {
        const { records, pipelineSessions } = get();
        if (records.length === 0) {
          return {
            totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0,
            totalTokens: 0, totalCost: 0, cachedCalls: 0, tokensSaved: 0,
            costSaved: 0, avgTokensPerCall: 0, avgDurationMs: 0,
            efficiency: 0, byTaskType: {}, byModel: {},
            avgTokensPerPipeline: 0, avgCostPerPipeline: 0,
          };
        }

        let totalInput = 0, totalOutput = 0, totalCost = 0;
        let cachedCalls = 0, tokensSaved = 0, costSaved = 0;
        let totalDuration = 0, totalOutputChars = 0;
        const byTaskType: TokenStats['byTaskType'] = {};
        const byModel: TokenStats['byModel'] = {};

        for (const r of records) {
          totalInput += r.inputTokens;
          totalOutput += r.outputTokens;
          totalCost += r.estimatedCost;
          totalDuration += r.durationMs;
          totalOutputChars += r.outputChars;

          if (r.cached) {
            cachedCalls++;
            tokensSaved += r.totalTokens;
            costSaved += resolveUncachedEquivalentCost(r);
          }

          // By task type
          if (!byTaskType[r.taskType]) byTaskType[r.taskType] = { calls: 0, tokens: 0, cost: 0 };
          byTaskType[r.taskType].calls++;
          byTaskType[r.taskType].tokens += r.totalTokens;
          byTaskType[r.taskType].cost += r.estimatedCost;

          // By model
          const modelKey = r.modelName || r.modelId;
          if (!byModel[modelKey]) byModel[modelKey] = { calls: 0, tokens: 0, cost: 0 };
          byModel[modelKey].calls++;
          byModel[modelKey].tokens += r.totalTokens;
          byModel[modelKey].cost += r.estimatedCost;
        }

        const totalTokens = totalInput + totalOutput;
        const pipelineCount = pipelineSessions.length;
        return {
          totalCalls: records.length,
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput,
          totalTokens,
          totalCost,
          cachedCalls,
          tokensSaved,
          costSaved,
          avgTokensPerCall: Math.round(totalTokens / records.length),
          avgDurationMs: Math.round(totalDuration / records.length),
          efficiency: totalTokens > 0 ? +(totalOutputChars / totalTokens).toFixed(2) : 0,
          byTaskType,
          byModel,
          avgTokensPerPipeline: pipelineCount > 0
            ? Math.round(pipelineSessions.reduce((s, p) => s + p.totalTokens, 0) / pipelineCount)
            : 0,
          avgCostPerPipeline: pipelineCount > 0
            ? +(pipelineSessions.reduce((s, p) => s + p.totalCost, 0) / pipelineCount).toFixed(4)
            : 0,
        };
      },

      getPipelineSessions: () => get().pipelineSessions,

      getPipelineSessionDetails: (sessionId: string) => {
        const { pipelineSessions, records } = get();
        return {
          session: pipelineSessions.find((s) => s.id === sessionId),
          records: records.filter((r) => r.pipelineSessionId === sessionId),
        };
      },
    }),
    {
      name: 'viettruyen-token-usage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        records: state.records,
        pipelineSessions: state.pipelineSessions,
        taskStatusById: state.taskStatusById,
      }),
    }
  )
);
