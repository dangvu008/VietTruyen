/**
 * File: status_reporter.ts
 * Purpose: Generate comprehensive project status report
 * Layer: Application (Report)
 * Domain: Report → [project progress, quality summary, debt tracking]
 *
 * Data Contract:
 * - Input:  Project + checker results + memory state
 * - Output: ProjectStatusReport
 * - Consumer: StatusDashboardPage.tsx
 *
 * Flow: Aggregate project data → Calculate metrics → Build report
 */

import type { Project } from '../../types/story';
import { getProjectChapters, getProjectIndexState, getPendingPropagations } from '../../db/narrative_db';
import type { CombinedReviewReport } from '../../core/checkers/checker_types';

export interface ProjectStatusReport {
  projectId: string;
  projectTitle: string;
  generatedAt: string;

  // Progress
  progress: {
    writtenChapters: number;
    targetChapters: number;
    completionPercent: number;
    draftCount: number;
    revisedCount: number;
    finalCount: number;
  };

  // Quality
  quality: {
    averageScore: number;
    lastReviewScore: number | null;
    passRate: number;
    totalReviews: number;
  };

  // Memory health
  memory: {
    indexedChapters: number;
    totalChapters: number;
    needsBackfill: boolean;
    pendingPropagationTasks: number;
  };

  // Outline coverage
  outline: {
    totalBeats: number;
    coveredByChapters: number;
    hasMasterOutline: boolean;
  };

  // Entities
  entities: {
    characterCount: number;
    foreshadowingsTotal: number;
    foreshadowingsResolved: number;
    foreshadowingsOpen: number;
  };
}

export async function generateProjectStatusReport(
  project: Project,
  recentReviews?: CombinedReviewReport[],
): Promise<ProjectStatusReport> {
  const now = new Date().toISOString();
  const chapters = project.chapters || [];

  // Progress metrics
  const draftCount = chapters.filter(c => c.status === 'draft').length;
  const revisedCount = chapters.filter(c => c.status === 'revised').length;
  const finalCount = chapters.filter(c => c.status === 'final').length;
  const writtenChapters = chapters.length;
  const targetChapters = project.targetChapters || 100;
  const completionPercent = Math.round((writtenChapters / targetChapters) * 100);

  // Quality from reviews
  const reviews = recentReviews || [];
  const averageScore = reviews.length > 0
    ? Math.round(reviews.reduce((sum, r) => sum + r.combined_score, 0) / reviews.length)
    : 0;
  const lastReviewScore = reviews.length > 0 ? reviews[reviews.length - 1].combined_score : null;
  const passRate = reviews.length > 0
    ? Math.round((reviews.filter(r => r.pass).length / reviews.length) * 100)
    : 0;

  // Memory health
  let indexedChapters = 0;
  let needsBackfill = false;
  let pendingTasks = 0;

  try {
    const indexState = await getProjectIndexState(project.id);
    needsBackfill = indexState?.needsBackfill || false;
  } catch { /* DB not ready */ }

  try {
    const storedChapters = await getProjectChapters(project.id);
    indexedChapters = storedChapters.length;
  } catch { /* DB not ready */ }

  try {
    const tasks = await getPendingPropagations(project.id);
    pendingTasks = tasks.length;
  } catch { /* DB not ready */ }

  // Outline coverage
  const totalBeats = project.outline?.length || 0;
  const coveredByChapters = Math.min(writtenChapters, totalBeats);

  // Entities
  const characters = project.characters || [];
  const foreshadowings = project.foreshadowings || [];
  const resolvedCount = foreshadowings.filter(f => f.isResolved).length;

  return {
    projectId: project.id,
    projectTitle: project.title,
    generatedAt: now,
    progress: {
      writtenChapters,
      targetChapters,
      completionPercent,
      draftCount,
      revisedCount,
      finalCount,
    },
    quality: {
      averageScore,
      lastReviewScore,
      passRate,
      totalReviews: reviews.length,
    },
    memory: {
      indexedChapters,
      totalChapters: writtenChapters,
      needsBackfill,
      pendingPropagationTasks: pendingTasks,
    },
    outline: {
      totalBeats,
      coveredByChapters,
      hasMasterOutline: !!project.masterOutline,
    },
    entities: {
      characterCount: characters.length,
      foreshadowingsTotal: foreshadowings.length,
      foreshadowingsResolved: resolvedCount,
      foreshadowingsOpen: foreshadowings.length - resolvedCount,
    },
  };
}
