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
  | 'pre_save_quality_gate'
  | 'narrative_value_gate'
  | 'review_checkers'
  | 'style_analysis'
  | 'data_extraction'
  | 'memory_sync'
  | 'translation_polish'
  | 'prose_elevation'
  | 'source_dna_scan'
  | 'batch_correction'
  | 'ooc_scan'
  | 'naturalness_score';

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
