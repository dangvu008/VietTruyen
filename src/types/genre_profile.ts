/**
 * File: genre_profile.ts
 * Purpose: Genre-based configuration profiles for story writing quality control
 * Layer: Domain (Types)
 * Domain: Genre → [checkers, context_builder, reading_power]
 *
 * Data Contract:
 * - Input:  genre selection from Project
 * - Output: GenreProfile config consumed by checkers, context builder, pacing tracker
 *
 * Ported from: webnovel-writer/references/genre-profiles.md
 * Adapted for: Vietnamese storytelling context
 */

// ── Hook Configuration ──────────────────────────────────────────────
export interface HookConfig {
  /** Preferred hook types, ordered by priority */
  preferredTypes: import('./reading_power').HookType[];
  /** Default hook strength for this genre */
  strengthBaseline: import('./reading_power').HookStrength;
  /** Whether chapter-end hooks are strongly preferred */
  chapterEndRequired: boolean;
  /** Max consecutive transition chapters allowed with reduced hooks */
  transitionAllowance: number;
}

// ── Cool-point Configuration ────────────────────────────────────────
export interface CoolPointConfig {
  /** Preferred cool-point patterns for this genre */
  preferredPatterns: import('./reading_power').CoolPointPattern[];
  /** Expected density: high (2+/ch), medium (1/ch), low (0-1/ch) */
  densityPerChapter: 'high' | 'medium' | 'low';
  /** Suggested interval for combo cool-points (every N chapters) */
  comboInterval: number;
  /** Suggested interval for milestone cool-points (every N chapters) */
  milestoneInterval: number;
}

// ── Micro-payoff Configuration ──────────────────────────────────────
export interface MicroPayoffConfig {
  /** Preferred micro-payoff types */
  preferredTypes: import('./reading_power').MicroPayoffType[];
  /** Minimum micro-payoffs per regular chapter */
  minPerChapter: number;
  /** Minimum micro-payoffs per transition chapter */
  transitionMin: number;
}

// ── Pacing Configuration ────────────────────────────────────────────
export interface PacingConfig {
  /** N consecutive chapters with no progress = HARD-003 violation */
  stagnationThreshold: number;
  /** Max consecutive Quest-dominant chapters before warning */
  strandQuestMax: number;
  /** Max chapters gap before Fire strand drought warning */
  strandFireGapMax: number;
  /** Max consecutive transition chapters allowed */
  transitionMaxConsecutive: number;
}

// ── Override Configuration ──────────────────────────────────────────
export interface OverrideConfig {
  /** Allowed rationale types for soft constraint overrides */
  allowedRationaleTypes: import('./reading_power').OverrideRationaleType[];
  /** Debt multiplier (>1 = stricter, <1 = more lenient) */
  debtMultiplier: number;
  /** Default payback window in chapters */
  paybackWindowDefault: number;
}

// ── Main GenreProfile ───────────────────────────────────────────────
export interface GenreProfile {
  /** Unique identifier (English lowercase) */
  id: string;
  /** Vietnamese display name */
  name: string;
  /** One-line description of core appeal */
  description: string;
  /** Stackable tags for multi-genre support */
  tags: string[];
  /** Genre-specific notes/characteristics */
  notes: string[];

  hookConfig: HookConfig;
  coolPointConfig: CoolPointConfig;
  microPayoffConfig: MicroPayoffConfig;
  pacingConfig: PacingConfig;
  overrideConfig: OverrideConfig;
}

/** User-level overrides for a genre profile */
export type GenreProfileOverrides = {
  [K in keyof GenreProfile]?: K extends 'hookConfig'
    ? Partial<HookConfig>
    : K extends 'coolPointConfig'
    ? Partial<CoolPointConfig>
    : K extends 'microPayoffConfig'
    ? Partial<MicroPayoffConfig>
    : K extends 'pacingConfig'
    ? Partial<PacingConfig>
    : K extends 'overrideConfig'
    ? Partial<OverrideConfig>
    : GenreProfile[K];
};

/** Merge a base profile with user overrides */
export function mergeGenreProfile(
  base: GenreProfile,
  overrides?: GenreProfileOverrides
): GenreProfile {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    hookConfig: { ...base.hookConfig, ...overrides.hookConfig },
    coolPointConfig: { ...base.coolPointConfig, ...overrides.coolPointConfig },
    microPayoffConfig: { ...base.microPayoffConfig, ...overrides.microPayoffConfig },
    pacingConfig: { ...base.pacingConfig, ...overrides.pacingConfig },
    overrideConfig: { ...base.overrideConfig, ...overrides.overrideConfig },
  };
}
