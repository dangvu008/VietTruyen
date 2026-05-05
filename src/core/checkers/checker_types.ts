/**
 * File: checker_types.ts
 * Purpose: Base interfaces and types for all 6 Checker Agents
 * Layer: Core/Domain
 * Domain: Checkers -> [high_point, ooc, pacing, reader_pull, consistency, continuity, golden_three]
 */

import type { GenreProfile } from '../../types/genre_profile';
import type { CharacterProfile } from './ooc_checker';
import type { StrandTracker } from '../../types/strand_weave';
import type { NarrativeStateFact, PendingHook } from '../../types/narrative_memory';

export interface CheckerContext {
  chapterId: string;
  chapterNumber: number;
  chapterText: string;
  genreProfile?: GenreProfile;
  characters: CharacterProfile[];
  strandTracker: StrandTracker;
  systemStateContext: string;
  previousSummary: string;
  activeThreads: string[];
  chapterIntent?: string;
  futureTarget?: string;
  storyStateFacts?: Array<
    Pick<NarrativeStateFact, 'subjectId' | 'predicate' | 'value' | 'validFromChapter' | 'confidence'>
  >;
  activeHooks?: Array<
    Pick<PendingHook, 'id' | 'description' | 'plantedChapterIndex' | 'expectedPayoffBy' | 'confidence'>
  >;
  continuityWarnings?: string[];
}

export type CheckerSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CheckerIssue {
  id: string;
  severity: CheckerSeverity;
  description: string;
  suggestion: string;
  context_snippet?: string; // Optional code/text snippet where issue occurred
}

export interface CheckerReport {
  agent: string;          // e.g., 'high_point', 'ooc'
  chapter: number;        // The chapter sequence number being checked
  overall_score: number;  // 0-100 score evaluating the specific criteria
  pass: boolean;          // Whether the chapter meets minimum requirements for this checker
  issues: CheckerIssue[]; // Specific problems found
  metrics: Record<string, any>; // Checker-specific metrics (e.g., cool_point_count, pacing_ratio)
  summary: string;        // Overall qualitative assessment
}

export interface CombinedReviewReport {
  chapterId: string;
  chapterNumber: number;
  reports: CheckerReport[];
  combined_score: number; // Average of all overall_scores
  pass: boolean;          // True only if all critical metrics pass
  priority_fixes: CheckerIssue[]; // Merged list of high/critical issues across all checkers
  suggestedRevisionTasks: string[];
  guidedRevisionPrompt: string;
  reviewedAt: string;     // ISO timestamp
}
