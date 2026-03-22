/**
 * File: token_tracker.ts
 * Purpose: Types cho hệ thống theo dõi token usage — mỗi AI call = 1 record
 * Layer: Types
 * Domain: AI → [token tracking, cost estimation, performance metrics]
 */
import type { AiTaskType } from '../lib/ai/model_router';

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
  cached: boolean;         // Response từ cache → cost = 0
  durationMs: number;      // Thời gian phản hồi
  outputChars: number;     // Số ký tự output (đo chất lượng)
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
}

/** Chi phí ước lượng per 1M tokens (input) theo provider, USD */
export const COST_PER_1M_INPUT: Record<string, number> = {
  'gemini-2.0-flash': 0.10,
  'gemini-2.5-flash-preview-05-20': 0.15,
  'gemini-2.5-pro-preview-05-06': 1.25,
  'openai/gpt-4o-mini': 0.15,
  'anthropic/claude-3.5-sonnet': 3.00,
  'deepseek/deepseek-chat': 0.14,
};

export const COST_PER_1M_OUTPUT: Record<string, number> = {
  'gemini-2.0-flash': 0.40,
  'gemini-2.5-flash-preview-05-20': 0.60,
  'gemini-2.5-pro-preview-05-06': 5.00,
  'openai/gpt-4o-mini': 0.60,
  'anthropic/claude-3.5-sonnet': 15.00,
  'deepseek/deepseek-chat': 0.28,
};
