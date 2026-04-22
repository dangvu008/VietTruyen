/**
 * File: summary_cache.ts
 * Purpose: TypeScript declarations for Hierarchical Summary Cache (HSC).
 *          3-tier cache: Chapter → Arc → Global summaries.
 * Layer: Types
 * Domain: Narrative Memory
 * Deps: None
 */

// ─── Tier Enum ───────────────────────────────────────────

export type SummaryCacheTier = 'chapter' | 'arc' | 'global';

// ─── Cached Summary Entry ────────────────────────────────

export interface CachedSummary {
  /** Composite key: `{projectId}:{tier}:{rangeKey}` */
  id: string;
  projectId: string;
  tier: SummaryCacheTier;
  /** For chapter: chapterIndex. For arc: `{start}-{end}`. For global: "all" */
  rangeKey: string;
  /** The condensed summary text */
  summary: string;
  /** Chapter range this summary covers (inclusive) */
  chapterStart: number;
  chapterEnd: number;
  /** Content hash of source data — used for invalidation */
  sourceHash: string;
  /** Number of source chapters aggregated */
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── HSC Build Options ───────────────────────────────────

export interface HscBuildOptions {
  /** Chapters per arc-level block (default: 10) */
  arcBlockSize?: number;
  /** Max chars for chapter-tier summary (default: 150) */
  chapterMaxChars?: number;
  /** Max chars for arc-tier summary (default: 300) */
  arcMaxChars?: number;
  /** Max chars for global-tier summary (default: 500) */
  globalMaxChars?: number;
}

// ─── HSC Retrieval Result ────────────────────────────────

export interface HscContextBlock {
  /** Combined text ready for context injection */
  text: string;
  /** Token estimate of the combined block */
  tokenEstimate: number;
  /** How many tiers contributed */
  tiersUsed: SummaryCacheTier[];
  /** Chapter range covered by long-range memory */
  coverageRange: { start: number; end: number };
}
