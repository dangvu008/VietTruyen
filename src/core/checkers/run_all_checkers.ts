/**
 * File: run_all_checkers.ts
 * Purpose: Orchestrator to run all 6 Checker Agents in parallel
 * Layer: Core/Domain
 * Domain: Checkers -> [Orchestration]
 */

import type { CombinedReviewReport, CheckerReport } from './checker_types';
import type { GenreProfile } from '../../types/genre_profile';
import type { CharacterProfile } from './ooc_checker';
import type { StrandTracker } from '../../types/strand_weave';

import { buildHighPointCheckerPrompt, parseHighPointReport } from './high_point_checker';
import { buildOocCheckerPrompt, parseOocReport } from './ooc_checker';
import { buildPacingCheckerPrompt, parsePacingReport } from './pacing_checker';
import { buildReaderPullCheckerPrompt, parseReaderPullReport } from './reader_pull_checker';
import { buildConsistencyCheckerPrompt, parseConsistencyReport } from './consistency_checker';
import { buildContinuityCheckerPrompt, parseContinuityReport } from './continuity_checker';
import { buildGoldenThreeCheckerPrompt, parseGoldenThreeReport } from './golden_three_checker';

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
}

/**
 * Runs all 7 checkers in parallel (6 original + Golden Three).
 * @param context The narrative contextual data needed by all checkers
 * @param callAi An async function provided by the caller (e.g., a React hook) to communicate with the LLM
 */
export async function runAllCheckers(
  context: CheckerContext,
  callAi: (prompt: { system: string; user: string }) => Promise<string>
): Promise<CombinedReviewReport> {
  const {
    chapterId,
    chapterNumber,
    chapterText,
    genreProfile,
    characters,
    strandTracker,
    systemStateContext,
    previousSummary,
    activeThreads,
  } = context;

  // Build prompts for all 7 checkers
  const highPointPrompt = buildHighPointCheckerPrompt(chapterText, chapterNumber, genreProfile);
  const oocPrompt = buildOocCheckerPrompt(chapterText, chapterNumber, characters);
  const pacingPrompt = buildPacingCheckerPrompt(chapterText, chapterNumber, strandTracker);
  const readerPullPrompt = buildReaderPullCheckerPrompt(chapterText, chapterNumber, genreProfile);
  const consistencyPrompt = buildConsistencyCheckerPrompt(chapterText, chapterNumber, systemStateContext);
  const continuityPrompt = buildContinuityCheckerPrompt(chapterText, chapterNumber, previousSummary, activeThreads);
  const goldenThreePrompt = buildGoldenThreeCheckerPrompt(chapterText, chapterNumber, genreProfile);

  // Execute AI calls in parallel
  const results = await Promise.allSettled([
    callAi(highPointPrompt).then(parseHighPointReport),
    callAi(oocPrompt).then(parseOocReport),
    callAi(pacingPrompt).then(parsePacingReport),
    callAi(readerPullPrompt).then(parseReaderPullReport),
    callAi(consistencyPrompt).then(parseConsistencyReport),
    callAi(continuityPrompt).then(parseContinuityReport),
    callAi(goldenThreePrompt).then(parseGoldenThreeReport),
  ]);

  const reports: CheckerReport[] = [];
  
  // Extract successful reports and handle failures gracefully
  const agents = ['high_point', 'ooc', 'pacing', 'reader_pull', 'consistency', 'continuity', 'golden_three'];
  results.forEach((res, index) => {
    if (res.status === 'fulfilled') {
      reports.push(res.value);
    } else {
      console.warn(`[runAllCheckers] Agent ${agents[index]} failed:`, res.reason);
      // Construct a fallback failed report
      reports.push({
        agent: agents[index],
        chapter: chapterNumber,
        overall_score: 0,
        pass: false,
        issues: [{
          id: `sys-err-${agents[index]}`,
          severity: 'critical',
          description: `Lỗi hệ thống khi gọi AI checker ${agents[index]}: ${String(res.reason)}`,
          suggestion: 'Vui lòng thử lại sau.'
        }],
        metrics: {},
        summary: `Checker bị lỗi trong quá trình phân tích.`
      });
    }
  });

  // Calculate combined metrics
  const combined_score = reports.reduce((sum, r) => sum + r.overall_score, 0) / reports.length;
  // It only passes if ALL checkers pass
  const pass = reports.every(r => r.pass);
  
  // Extract all high/critical priority fixes across all reports
  const priority_fixes = reports.flatMap(r => 
    r.issues.filter(issue => issue.severity === 'high' || issue.severity === 'critical')
  );

  return {
    chapterId,
    chapterNumber,
    reports,
    combined_score,
    pass,
    priority_fixes,
    reviewedAt: new Date().toISOString(),
  };
}
