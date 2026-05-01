/**
 * File: token_tracker.ts
 * Purpose: Types cho hệ thống theo dõi token usage — mỗi AI call = 1 record
 * Layer: Types
 * Domain: AI → [token tracking, cost estimation, performance metrics]
 */
import type { AiTaskType } from '../lib/ai/model_router';

/** Pipeline step labels — dùng để nhóm API calls theo bước trong pipeline */
export type PipelineStepLabel =
  | 'context_build'
  | 'plan_branches'
  | 'write_chapter'
  | 'review_checkers'
  | 'style_analysis'
  | 'data_extraction'
  | 'memory_sync';

/** Record cho mỗi lần gọi AI */
export interface TokenUsageRecord {
  id: string;
  timestamp: string;
  taskType: AiTaskType;
  modelId: string;
  modelName: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;   // USD
  estimatedCostIfNotCached: number; // Chi phí lẽ ra phải trả nếu cache không hit
  cached: boolean;         // Response từ cache → cost = 0
  durationMs: number;      // Thời gian phản hồi
  outputChars: number;     // Số ký tự output (đo chất lượng)
  /** Pipeline session ID — nhóm theo lần chạy pipeline */
  pipelineSessionId?: string;
  /** Pipeline step label — bước nào trong pipeline */
  pipelineStep?: PipelineStepLabel;
}

/** Session tracking cho 1 lần chạy full pipeline */
export interface PipelineSession {
  id: string;
  projectId: string;
  projectTitle: string;
  chapterIndex: number;
  startedAt: string;
  finishedAt?: string;
  /** Tổng token toàn pipeline */
  totalTokens: number;
  /** Tổng chi phí USD */
  totalCost: number;
  /** Số API calls */
  totalCalls: number;
  /** Breakdown per step */
  stepBreakdown: Record<PipelineStepLabel, {
    tokens: number;
    cost: number;
    calls: number;
    durationMs: number;
  }>;
}

/** Thống kê tổng hợp */
export interface TokenStats {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  cachedCalls: number;
  tokensSaved: number;       // Tokens tiết kiệm nhờ cache
  costSaved: number;         // Chi phí tiết kiệm nhờ cache
  avgTokensPerCall: number;
  avgDurationMs: number;
  efficiency: number;        // output chars / total tokens — hiệu suất
  byTaskType: Record<string, { calls: number; tokens: number; cost: number }>;
  byModel: Record<string, { calls: number; tokens: number; cost: number }>;
  /** Avg tokens per pipeline run */
  avgTokensPerPipeline: number;
  /** Avg cost per pipeline run */
  avgCostPerPipeline: number;
}

export type TokenOptimizationTaskStatus = 'open' | 'done' | 'dismissed';

export type TokenOptimizationPhase = 'P0' | 'P1' | 'P2';

export interface TokenOptimizationPhaseMeta {
  id: TokenOptimizationPhase;
  title: string;
  subtitle: string;
}

export interface TokenOptimizationTask {
  id: string;
  phase: TokenOptimizationPhase;
  title: string;
  checklist: string[];
  fileTargets?: string[];
  note?: string;
}

/** Chi phí ước lượng per 1M tokens (input) theo provider, USD */
export const COST_PER_1M_INPUT: Record<string, number> = {
  'gemini-2.0-flash': 0.10,
  'gemini-2.5-flash-lite': 0.10,
  'google/gemini-2.5-flash-lite': 0.10,
  'gemini-2.5-flash-preview-05-20': 0.15,
  'gemini-2.5-pro-preview-05-06': 1.25,
  'gpt-4.1-nano': 0.10,
  'openai/gpt-4.1-nano': 0.10,
  'gpt-4.1-mini': 0.40,
  'openai/gpt-4.1-mini': 0.40,
  'openai/gpt-4o-mini': 0.15,
  'mistralai/mistral-small-creative': 0.10,
  'gryphe/mythomax-l2-13b': 0.06,
  'qwen/qwen3.5-flash-02-23': 0.065,
  'anthropic/claude-3.5-sonnet': 3.00,
  'anthropic/claude-3.5-haiku': 0.80,
  'anthropic/claude-sonnet-4': 3.00,
  'deepseek/deepseek-v4-flash': 0.14,
  'deepseek/deepseek-chat': 0.14,
};

export const COST_PER_1M_OUTPUT: Record<string, number> = {
  'gemini-2.0-flash': 0.40,
  'gemini-2.5-flash-lite': 0.40,
  'google/gemini-2.5-flash-lite': 0.40,
  'gemini-2.5-flash-preview-05-20': 0.60,
  'gemini-2.5-pro-preview-05-06': 5.00,
  'gpt-4.1-nano': 0.40,
  'openai/gpt-4.1-nano': 0.40,
  'gpt-4.1-mini': 1.60,
  'openai/gpt-4.1-mini': 1.60,
  'openai/gpt-4o-mini': 0.60,
  'mistralai/mistral-small-creative': 0.30,
  'gryphe/mythomax-l2-13b': 0.06,
  'qwen/qwen3.5-flash-02-23': 0.26,
  'anthropic/claude-3.5-sonnet': 15.00,
  'anthropic/claude-3.5-haiku': 4.00,
  'anthropic/claude-sonnet-4': 15.00,
  'deepseek/deepseek-v4-flash': 0.28,
  'deepseek/deepseek-chat': 0.28,
};
