/**
 * File: strand_weave_system.ts
 * Purpose: Strand Weave Rhythm System implementation
 * Layer: Core / Domain
 * 
 * Implements the pacing system from webnovel-writer:
 * - Quest (60%): Main plot progression
 * - Fire (20%): Emotional/relationship development  
 * - Constellation (20%): World-building/expansion
 * 
 * Redline rules:
 * - Quest consecutive ≤ 5 chapters
 * - Fire gap ≤ 10 chapters
 * - Constellation gap ≤ 15 chapters
 */

import type { Chapter } from '../types/story';
import type {
  StrandWeaveMetrics,
  StrandViolation
} from '../types/story_system';

export interface StrandWeaveConfig {
  quest_ratio: number; // Default 0.6
  fire_ratio: number; // Default 0.2
  constellation_ratio: number; // Default 0.2
  quest_max_consecutive: number; // Default 5
  fire_max_gap: number; // Default 10
  constellation_max_gap: number; // Default 15
}

export const DEFAULT_STRAND_WEAVE_CONFIG: StrandWeaveConfig = {
  quest_ratio: 0.6,
  fire_ratio: 0.2,
  constellation_ratio: 0.2,
  quest_max_consecutive: 5,
  fire_max_gap: 10,
  constellation_max_gap: 15,
};

/**
 * Classify a chapter into strand type based on content analysis
 * This is a simplified version - in production, would use AI analysis
 */
export function classifyChapterStrand(
  chapter: Chapter,
  _projectContext?: {
    hasRomance: boolean;
    hasWorldBuilding: boolean;
  }
): 'quest' | 'fire' | 'constellation' {
  const content = chapter.content.toLowerCase();
  const summary = chapter.summary?.toLowerCase() || '';

  // Simple heuristic classification
  const questKeywords = ['chiến đấu', 'hành động', 'nhiệm vụ', 'kẻ thù', 'tranh đấu', 'chiến thắng', 'thất bại'];
  const fireKeywords = ['tình cảm', 'yêu', 'hẹn hò', 'cảm xúc', 'mối quan hệ', 'trái tim', 'yêu thương'];
  const constellationKeywords = ['thế giới', 'vũ trụ', 'lịch sử', 'văn hóa', 'quy tắc', 'hệ thống', 'ma thuật', 'khoa học'];

  const questScore = countKeywords(content + summary, questKeywords);
  const fireScore = countKeywords(content + summary, fireKeywords);
  const constellationScore = countKeywords(content + summary, constellationKeywords);

  // Determine classification based on highest score
  if (questScore >= fireScore && questScore >= constellationScore) {
    return 'quest';
  } else if (fireScore >= constellationScore) {
    return 'fire';
  } else {
    return 'constellation';
  }
}

function countKeywords(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => {
    return count + (text.includes(keyword) ? 1 : 0);
  }, 0);
}

/**
 * Calculate strand weave metrics from chapter history
 */
export function calculateStrandWeaveMetrics(
  chapters: Chapter[],
  config: StrandWeaveConfig = DEFAULT_STRAND_WEAVE_CONFIG
): StrandWeaveMetrics {
  const total = chapters.length;
  if (total === 0) {
    return {
      quest_percentage: config.quest_ratio,
      fire_percentage: config.fire_ratio,
      constellation_percentage: config.constellation_ratio,
      redline_violations: []
    };
  }

  const questCount = chapters.filter(c => c.strand_classification === 'quest').length;
  const fireCount = chapters.filter(c => c.strand_classification === 'fire').length;
  const constellationCount = chapters.filter(c => c.strand_classification === 'constellation').length;

  const questPercentage = questCount / total;
  const firePercentage = fireCount / total;
  const constellationPercentage = constellationCount / total;

  // Check redline violations
  const redlineViolations = checkStrandRedlines(chapters, config);

  return {
    quest_percentage: questPercentage,
    fire_percentage: firePercentage,
    constellation_percentage: constellationPercentage,
    redline_violations: redlineViolations
  };
}

/**
 * Check for strand weave redline violations
 */
export function checkStrandRedlines(
  chapters: Chapter[],
  config: StrandWeaveConfig = DEFAULT_STRAND_WEAVE_CONFIG
): StrandViolation[] {
  const violations: StrandViolation[] = [];

  const classifications = chapters.map(c => c.strand_classification);

  // Check quest consecutive (max 5)
  let questStreak = 0;
  for (let i = 0; i < classifications.length; i++) {
    if (classifications[i] === 'quest') {
      questStreak++;
      if (questStreak > config.quest_max_consecutive) {
        violations.push({
          strand_type: 'quest',
          violation_type: 'consecutive_exceeded',
          current_streak: questStreak,
          threshold: config.quest_max_consecutive,
          affected_chapters: Array.from({ length: questStreak }, (_, idx) => i - questStreak + 1 + idx).filter(n => n >= 0)
        });
      }
    } else {
      questStreak = 0;
    }
  }

  // Check fire gap (max 10)
  let fireGap = 0;
  for (let i = 0; i < classifications.length; i++) {
    if (classifications[i] === 'fire') {
      fireGap = 0;
    } else {
      fireGap++;
      if (fireGap > config.fire_max_gap) {
        violations.push({
          strand_type: 'fire',
          violation_type: 'gap_exceeded',
          current_streak: fireGap,
          threshold: config.fire_max_gap,
          affected_chapters: Array.from({ length: fireGap }, (_, idx) => i - fireGap + 1 + idx).filter(n => n >= 0)
        });
      }
    }
  }

  // Check constellation gap (max 15)
  let constellationGap = 0;
  for (let i = 0; i < classifications.length; i++) {
    if (classifications[i] === 'constellation') {
      constellationGap = 0;
    } else {
      constellationGap++;
      if (constellationGap > config.constellation_max_gap) {
        violations.push({
          strand_type: 'constellation',
          violation_type: 'gap_exceeded',
          current_streak: constellationGap,
          threshold: config.constellation_max_gap,
          affected_chapters: Array.from({ length: constellationGap }, (_, idx) => i - constellationGap + 1 + idx).filter(n => n >= 0)
        });
      }
    }
  }

  return violations;
}

/**
 * Suggest strand classification for next chapter to maintain balance
 */
export function suggestNextStrand(
  chapters: Chapter[],
  config: StrandWeaveConfig = DEFAULT_STRAND_WEAVE_CONFIG
): {
  recommended: 'quest' | 'fire' | 'constellation';
  reason: string;
  confidence: number;
} {
  const metrics = calculateStrandWeaveMetrics(chapters, config);

  // Calculate deviations from target ratios
  const questDeviation = metrics.quest_percentage - config.quest_ratio;
  const fireDeviation = metrics.fire_percentage - config.fire_ratio;
  const constellationDeviation = metrics.constellation_percentage - config.constellation_ratio;

  // Check for urgent redline violations
  const urgentFireGap = metrics.redline_violations.find(
    v => v.strand_type === 'fire' && v.violation_type === 'gap_exceeded'
  );
  const urgentConstellationGap = metrics.redline_violations.find(
    v => v.strand_type === 'constellation' && v.violation_type === 'gap_exceeded'
  );

  // Priority 1: Address urgent redline violations
  if (urgentFireGap) {
    return {
      recommended: 'fire',
      reason: 'Urgent: Fire strand gap exceeded redline',
      confidence: 0.9
    };
  }

  if (urgentConstellationGap) {
    return {
      recommended: 'constellation',
      reason: 'Urgent: Constellation strand gap exceeded redline',
      confidence: 0.9
    };
  }

  // Priority 2: Balance ratios
  if (questDeviation > 0.1) {
    // Too much quest, recommend fire or constellation
    if (fireDeviation < constellationDeviation) {
      return {
        recommended: 'fire',
        reason: 'Balance: Quest ratio too high, need more Fire content',
        confidence: 0.7
      };
    } else {
      return {
        recommended: 'constellation',
        reason: 'Balance: Quest ratio too high, need more Constellation content',
        confidence: 0.7
      };
    }
  }

  if (fireDeviation > 0.1) {
    return {
      recommended: 'quest',
      reason: 'Balance: Fire ratio too high, need more Quest content',
      confidence: 0.7
    };
  }

  if (constellationDeviation > 0.1) {
    return {
      recommended: 'quest',
      reason: 'Balance: Constellation ratio too high, need more Quest content',
      confidence: 0.7
    };
  }

  // Default: recommend quest (main plot)
  return {
    recommended: 'quest',
    reason: 'Default: Focus on main plot progression',
    confidence: 0.5
  };
}

/**
 * Generate strand weave report for visualization
 */
export function generateStrandWeaveReport(
  chapters: Chapter[],
  config: StrandWeaveConfig = DEFAULT_STRAND_WEAVE_CONFIG
): {
  metrics: StrandWeaveMetrics;
  targetRatios: {
    quest: number;
    fire: number;
    constellation: number;
  };
  compliance: {
    overall: boolean;
    details: string[];
  };
  recommendation: {
    next_strand: 'quest' | 'fire' | 'constellation';
    reason: string;
  };
} {
  const metrics = calculateStrandWeaveMetrics(chapters, config);
  const recommendation = suggestNextStrand(chapters, config);

  const complianceDetails: string[] = [];
  let overallCompliance = true;

  // Check ratio compliance
  if (Math.abs(metrics.quest_percentage - config.quest_ratio) > 0.15) {
    complianceDetails.push(`Quest ratio (${(metrics.quest_percentage * 100).toFixed(1)}%) deviates from target (${(config.quest_ratio * 100).toFixed(1)}%)`);
    overallCompliance = false;
  }

  if (Math.abs(metrics.fire_percentage - config.fire_ratio) > 0.15) {
    complianceDetails.push(`Fire ratio (${(metrics.fire_percentage * 100).toFixed(1)}%) deviates from target (${(config.fire_ratio * 100).toFixed(1)}%)`);
    overallCompliance = false;
  }

  if (Math.abs(metrics.constellation_percentage - config.constellation_ratio) > 0.15) {
    complianceDetails.push(`Constellation ratio (${(metrics.constellation_percentage * 100).toFixed(1)}%) deviates from target (${(config.constellation_ratio * 100).toFixed(1)}%)`);
    overallCompliance = false;
  }

  // Check redline compliance
  if (metrics.redline_violations.length > 0) {
    complianceDetails.push(`${metrics.redline_violations.length} redline violation(s) detected`);
    overallCompliance = false;
  }

  if (complianceDetails.length === 0) {
    complianceDetails.push('All strand weave metrics within acceptable range');
  }

  return {
    metrics,
    targetRatios: {
      quest: config.quest_ratio,
      fire: config.fire_ratio,
      constellation: config.constellation_ratio
    },
    compliance: {
      overall: overallCompliance,
      details: complianceDetails
    },
    recommendation: {
      next_strand: recommendation.recommended,
      reason: recommendation.reason
    }
  };
}