/**
 * File: quality_trend.ts
 * Purpose: Build quality trend data over time for chapter-by-chapter analysis
 * Layer: Application (Report)
 * Domain: Report → [quality trend visualization, time-series data]
 *
 * Data Contract:
 * - Input:  Project chapters + stored review results
 * - Output: QualityTrendData (array of per-chapter quality points)
 * - Consumer: StatusDashboardPage.tsx (chart component)
 *
 * Flow: Iterate chapters → Look up stored reviews → Aggregate scores → Return trend
 */

import type { CombinedReviewReport } from '../../core/checkers/checker_types';

export interface QualityTrendPoint {
  chapterNumber: number;
  chapterTitle: string;
  combinedScore: number;
  passed: boolean;
  reviewedAt: string;
  checkerScores: Record<string, number>;
}

export interface QualityTrendData {
  points: QualityTrendPoint[];
  averageScore: number;
  trend: 'improving' | 'stable' | 'declining';
  bestChapter: QualityTrendPoint | null;
  worstChapter: QualityTrendPoint | null;
}

/**
 * Build quality trend data from stored review reports.
 * Reports should be ordered chronologically (by chapter number).
 */
export function buildQualityTrendData(
  reviews: CombinedReviewReport[],
): QualityTrendData {
  if (reviews.length === 0) {
    return {
      points: [],
      averageScore: 0,
      trend: 'stable',
      bestChapter: null,
      worstChapter: null,
    };
  }

  const points: QualityTrendPoint[] = reviews.map(review => {
    const checkerScores: Record<string, number> = {};
    for (const report of review.reports) {
      checkerScores[report.agent] = report.overall_score;
    }

    return {
      chapterNumber: review.chapterNumber,
      chapterTitle: `Chương ${review.chapterNumber}`,
      combinedScore: Math.round(review.combined_score),
      passed: review.pass,
      reviewedAt: review.reviewedAt,
      checkerScores,
    };
  });

  // Average
  const averageScore = Math.round(
    points.reduce((sum, p) => sum + p.combinedScore, 0) / points.length,
  );

  // Trend (compare last 3 vs first 3)
  const trend = calculateTrend(points);

  // Best / worst
  const sorted = [...points].sort((a, b) => b.combinedScore - a.combinedScore);
  const bestChapter = sorted[0] || null;
  const worstChapter = sorted[sorted.length - 1] || null;

  return { points, averageScore, trend, bestChapter, worstChapter };
}

function calculateTrend(
  points: QualityTrendPoint[],
): 'improving' | 'stable' | 'declining' {
  if (points.length < 4) return 'stable';

  const windowSize = Math.max(3, Math.floor(points.length / 3));
  const earlyAvg = average(points.slice(0, windowSize).map(p => p.combinedScore));
  const lateAvg = average(points.slice(-windowSize).map(p => p.combinedScore));

  const diff = lateAvg - earlyAvg;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
