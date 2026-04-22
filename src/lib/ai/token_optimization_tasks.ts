import type {
  TokenOptimizationPhaseMeta,
  TokenOptimizationTask,
} from '../../types/token_tracker';

export const TOKEN_OPTIMIZATION_PHASES: TokenOptimizationPhaseMeta[] = [
  {
    id: 'P0',
    title: 'Cắt Token Ngay',
    subtitle: 'ROI cao nhất, nên xử lý trước',
  },
  {
    id: 'P1',
    title: 'Giảm Token Theo Kiến Trúc',
    subtitle: 'Giảm waste bằng thay đổi cấu trúc',
  },
  {
    id: 'P2',
    title: 'Tối Ưu Sâu',
    subtitle: 'Defer cho vòng sau',
  },
];

export const TOKEN_OPTIMIZATION_TASKS: TokenOptimizationTask[] = [
  {
    id: 'P0-1',
    phase: 'P0',
    title: 'Quality Mode trong Pipeline',
    checklist: [
      'Add QualityMode to workflow.ts',
      'Add qualityMode to PipelineOptions in full_write_pipeline.ts',
      'Route steps based on qualityMode',
    ],
    fileTargets: [
      'src/types/workflow.ts',
      'src/lib/workflow/full_write_pipeline.ts',
    ],
  },
  {
    id: 'P0-2',
    phase: 'P0',
    title: 'Bỏ skipCache: true ở 5 calls',
    checklist: [
      'chapter_writer_ai.ts — plan_chapter',
      'style_analyzer.ts — polish_style',
      'outline_planner.ts — 3 calls',
    ],
    fileTargets: [
      'src/lib/ai/chapter_writer_ai.ts',
      'src/lib/ai/style_analyzer.ts',
      'src/lib/ai/outline_planner.ts',
    ],
  },
  {
    id: 'P0-3',
    phase: 'P0',
    title: 'Sửa prompt cache hash',
    checklist: [
      'Update hashPrompt() in prompt_cache.ts',
      'Update callers in tracked_ai_client.ts',
      'Increase MAX_ENTRIES + TTL',
    ],
    fileTargets: [
      'src/lib/ai/prompt_cache.ts',
      'src/lib/ai/tracked_ai_client.ts',
    ],
  },
  {
    id: 'P0-4',
    phase: 'P0',
    title: 'Hard budget per task',
    checklist: [
      'Create task_budget.ts',
      'Enforce in tracked_ai_client.ts',
    ],
    fileTargets: [
      'src/lib/ai/task_budget.ts',
      'src/lib/ai/tracked_ai_client.ts',
    ],
  },
  {
    id: 'P0-5',
    phase: 'P0',
    title: 'Fix telemetry costSaved',
    checklist: [
      'Add estimatedCostIfNotCached to token_tracker.ts',
      'Fix buildRecord in tracked_ai_client.ts',
      'Fix costSaved calc in use_token_store.ts',
    ],
    fileTargets: [
      'src/types/token_tracker.ts',
      'src/lib/ai/tracked_ai_client.ts',
      'src/store/use_token_store.ts',
    ],
  },
  {
    id: 'P1-1',
    phase: 'P1',
    title: 'Hierarchical summary trong context_builder',
    checklist: [
      'Create types/summary_cache.ts with CachedSummary, HscBuildOptions, HscContextBlock',
      'Add summaryCache table to narrative_db.ts (version 6)',
      'Create hierarchical_summary_cache.ts with rebuildHsc() + retrieveHscContext()',
      'Integrate Board 0.5 (Long-Range Memory) into context_builder.ts',
      'Wire AI Enricher into executePostWritePipeline()',
    ],
    fileTargets: [
      'src/types/summary_cache.ts',
      'src/db/narrative_db.ts',
      'src/lib/memory/hierarchical_summary_cache.ts',
      'src/lib/ai/context_builder.ts',
      'src/lib/memory/memory_extractor.ts',
    ],
  },
  {
    id: 'P1-2',
    phase: 'P1',
    title: 'Local-first plot query',
    checklist: [],
    note: 'Chi tiết implementation chưa được phân rã trong tracker này.',
  },
  {
    id: 'P1-3',
    phase: 'P1',
    title: 'Summary cache',
    checklist: [
      'Deterministic Tier 2 (arc) from chapter summaries — done via hierarchical_summary_cache.ts',
      'Deterministic Tier 3 (global) from arc summaries — done via hierarchical_summary_cache.ts',
      'Hash-based invalidation via sourceHash field',
      'CRUD functions in narrative_db.ts: getSummaryCacheEntries, putSummaryCacheEntries, clearProjectSummaryCache',
      'summaryCache included in all deleteProjectData/clearDerived cleanup functions',
    ],
    fileTargets: [
      'src/lib/memory/hierarchical_summary_cache.ts',
      'src/db/narrative_db.ts',
    ],
  },
  {
    id: 'P1-4',
    phase: 'P1',
    title: 'Batch expansion (TODO markers)',
    checklist: [],
    note: 'Chi tiết implementation chưa được phân rã trong tracker này.',
  },
  {
    id: 'P2-1',
    phase: 'P2',
    title: 'Backend context caching',
    checklist: [],
    note: 'Đang defer cho vòng tối ưu sâu.',
  },
  {
    id: 'P2-2',
    phase: 'P2',
    title: 'Scene-type selective context',
    checklist: [],
    note: 'Đang defer cho vòng tối ưu sâu.',
  },
  {
    id: 'P2-3',
    phase: 'P2',
    title: 'Ledger-first downstream',
    checklist: [],
    note: 'Đang defer cho vòng tối ưu sâu.',
  },
];
