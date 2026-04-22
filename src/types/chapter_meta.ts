/**
 * File: chapter_meta.ts
 * Purpose: Extended chapter metadata for reading power, pacing, and quality tracking
 * Layer: Domain (Types)
 * Domain: ChapterMeta → [data_agent, checkers, context_builder, dashboard]
 *
 * Ported from: webnovel-writer data-agent chapter_meta + context-agent contract
 *
 * This extends the base Chapter type with rich metadata generated
 * after writing, used by checkers and context builder.
 */

import type { HookType, HookStrength, CoolPointAnalysis, MicroPayoffAnalysis } from './reading_power';
import type { StrandType } from './strand_weave';

// ── Chapter Hook Metadata ───────────────────────────────────────────
export interface ChapterHook {
  type: HookType;
  content: string;
  strength: HookStrength;
}

// ── Chapter Writing Pattern ─────────────────────────────────────────
export interface ChapterPattern {
  /** Opening style: dialogue, action, description, flashback, etc. */
  opening: string;
  /** Hook type used at chapter end */
  hook: HookType;
  /** Emotional rhythm through the chapter: e.g. "low→high", "high→low→high" */
  emotionRhythm: string;
  /** Information density: low, medium, high */
  infoDensity: 'low' | 'medium' | 'high';
}

// ── Chapter Ending State ────────────────────────────────────────────
export interface ChapterEnding {
  /** Story time at chapter end */
  time: string;
  /** Location at chapter end */
  location: string;
  /** Emotional state at chapter end */
  emotion: string;
}

// ── Time Constraint (for continuity tracking) ───────────────────────
export interface TimeConstraint {
  /** Time anchor for this chapter */
  timeAnchor: string;
  /** Time anchor from previous chapter */
  prevTimeAnchor?: string;
  /** Time gap between this and previous chapter */
  timeGap?: string;
  /** Whether this chapter requires time transition prose */
  requiresTransition: boolean;
  /** Countdown events, e.g. "D-5 → D-4" */
  countdowns?: { event: string; remaining: number }[];
}

// ── Foreshadowing Status ────────────────────────────────────────────
export interface ForeshadowingEntry {
  /** What was planted/progressed/resolved */
  content: string;
  /** Action in this chapter */
  action: 'planted' | 'progressed' | 'resolved';
  /** Chapter where originally planted */
  plantedChapter?: number;
  /** Target chapter for expected resolution */
  targetChapter?: number;
}

// ── Chapter Summary (auto-generated after write) ────────────────────
export interface ChapterSummaryMeta {
  /** Plot summary, 100-150 chars */
  plotSummary: string;
  /** Characters appearing in this chapter */
  characters: string[];
  /** Entity state changes */
  stateChanges: string[];
  /** Foreshadowing activity */
  foreshadowing: ForeshadowingEntry[];
  /** Bridge point to next chapter */
  bridgePoint: string;
}

// ── Full Chapter Metadata ───────────────────────────────────────────
export interface ChapterMeta {
  /** Chapter ID reference */
  chapterId: string;
  /** Chapter sequence number */
  chapterNumber: number;

  /** Hook set at chapter end */
  hook?: ChapterHook;
  /** Writing pattern analysis */
  pattern?: ChapterPattern;
  /** Chapter ending state for continuity */
  ending?: ChapterEnding;
  /** Time constraint for context builder */
  timeConstraint?: TimeConstraint;

  /** Dominant narrative strand */
  strandDominant?: StrandType;
  /** Secondary strand if present */
  strandSecondary?: StrandType;

  /** Cool-points found in this chapter */
  coolPoints: CoolPointAnalysis[];
  /** Micro-payoffs found in this chapter */
  microPayoffs: MicroPayoffAnalysis[];
  /** Overall reading power score (0-100) */
  readingPowerScore?: number;

  /** Auto-generated summary */
  summary?: ChapterSummaryMeta;

  /** Whether this is a transition chapter */
  isTransition: boolean;

  /** Timestamp of metadata generation */
  generatedAt: string;
}

export function createEmptyChapterMeta(
  chapterId: string,
  chapterNumber: number
): ChapterMeta {
  return {
    chapterId,
    chapterNumber,
    coolPoints: [],
    microPayoffs: [],
    isTransition: false,
    generatedAt: new Date().toISOString(),
  };
}
