import type { PipelineStepLabel } from './token_tracker';

/**
 * Runtime catalog shared by token aggregation and UI. Keep this list aligned
 * with PipelineStepLabel so new gates cannot compile without becoming visible
 * in analytics.
 */
export const PIPELINE_STEP_CATALOG: readonly PipelineStepLabel[] = [
  'context_build',
  'plan_branches',
  'write_chapter',
  'pre_save_quality_gate',
  'narrative_value_gate',
  'review_checkers',
  'style_analysis',
  'data_extraction',
  'memory_sync',
  'translation_polish',
  'prose_elevation',
  'source_dna_scan',
  'batch_correction',
  'ooc_scan',
  'naturalness_score',
] as const;
