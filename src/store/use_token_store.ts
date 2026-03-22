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
import type { TokenUsageRecord, TokenStats } from '../types/token_tracker';

interface TokenState {
  records: TokenUsageRecord[];
  recordCall: (record: TokenUsageRecord) => void;
  clearRecords: () => void;
  getStats: () => TokenStats;
}

const MAX_RECORDS = 500; // Giới hạn lưu trữ, tránh localStorage quá lớn

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      records: [],

      recordCall: (record) =>
        set((state) => {
          const next = [record, ...state.records].slice(0, MAX_RECORDS);
          return { records: next };
        }),

      clearRecords: () => set({ records: [] }),

      getStats: () => {
        const { records } = get();
        if (records.length === 0) {
          return {
            totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0,
            totalTokens: 0, totalCost: 0, cachedCalls: 0, tokensSaved: 0,
            costSaved: 0, avgTokensPerCall: 0, avgDurationMs: 0,
            efficiency: 0, byTaskType: {}, byModel: {},
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
            costSaved += r.estimatedCost;
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
        };
      },
    }),
    {
      name: 'viettruyen-token-usage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ records: state.records }),
    }
  )
);
