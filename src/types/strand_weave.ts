/**
 * File: strand_weave.ts
 * Purpose: Strand Weave pacing system — Quest/Fire/Constellation rhythm tracking
 * Layer: Domain (Types)
 * Domain: Pacing → [pacing_checker, context_builder, strand_chart]
 *
 * Ported from: webnovel-writer/docs/architecture.md (Strand Weave 节奏系统)
 *
 * The Strand Weave system tracks three narrative threads:
 * - Quest (主线): Main plot, conflict, progression — ideal 60%
 * - Fire (感情線): Relationships, bonds, emotional development — ideal 20%
 * - Constellation (世界觀): World-building, factions, lore — ideal 20%
 */

// ── Strand Types ────────────────────────────────────────────────────
export type StrandType = 'quest' | 'fire' | 'constellation';

export const STRAND_LABELS: Record<StrandType, string> = {
  quest: 'Tuyến chính',
  fire: 'Tuyến tình cảm',
  constellation: 'Tuyến thế giới quan',
};

export const STRAND_DESCRIPTIONS: Record<StrandType, string> = {
  quest: 'Chiến đấu, nhiệm vụ, khám phá, nâng cấp',
  fire: 'Quan hệ tình cảm, tình bạn, nghĩa khí',
  constellation: 'Thế lực, bối cảnh, hệ thống tu luyện',
};

export const STRAND_COLORS: Record<StrandType, string> = {
  quest: '#f97316',        // Orange — action
  fire: '#ef4444',         // Red — emotion
  constellation: '#3b82f6', // Blue — world
};

/** Ideal distribution percentages */
export const STRAND_IDEAL_DISTRIBUTION: Record<StrandType, { min: number; max: number }> = {
  quest: { min: 55, max: 65 },
  fire: { min: 20, max: 30 },
  constellation: { min: 10, max: 20 },
};

// ── Chapter Strand Record ───────────────────────────────────────────
export interface ChapterStrand {
  chapterNumber: number;
  chapterId: string;
  /** The dominant strand (≥60% of chapter content) */
  dominant: StrandType;
  /** Secondary strand if present */
  secondary?: StrandType;
  /** Estimated percentage distribution */
  distribution: Record<StrandType, number>;
}

// ── Strand Tracker (persisted in project store) ─────────────────────
export interface StrandTracker {
  /** Chapter number of last Quest-dominant chapter */
  lastQuestChapter: number;
  /** Chapter number of last Fire-dominant chapter */
  lastFireChapter: number;
  /** Chapter number of last Constellation-dominant chapter */
  lastConstellationChapter: number;
  /** Historical strand assignments */
  history: ChapterStrand[];
}

export function createEmptyStrandTracker(): StrandTracker {
  return {
    lastQuestChapter: 0,
    lastFireChapter: 0,
    lastConstellationChapter: 0,
    history: [],
  };
}

// ── Strand Violations ───────────────────────────────────────────────
export type StrandViolationType =
  | 'quest_overload'        // Quest liên tiếp quá ngưỡng
  | 'fire_drought'          // Tuyến tình cảm gián đoạn quá lâu
  | 'constellation_absent'; // Tuyến thế giới quan vắng mặt lâu

export const STRAND_VIOLATION_LABELS: Record<StrandViolationType, string> = {
  quest_overload: 'Quá tải tuyến chính',
  fire_drought: 'Hạn hán tuyến tình cảm',
  constellation_absent: 'Vắng bóng tuyến thế giới quan',
};

export interface StrandViolation {
  type: StrandViolationType;
  severity: 'low' | 'medium' | 'high';
  currentGap: number;
  threshold: number;
  message: string;
  suggestion: string;
}

/** Check strand violations against genre-defined thresholds */
export function checkStrandViolations(
  tracker: StrandTracker,
  currentChapter: number,
  thresholds: {
    questMax: number;
    fireGapMax: number;
    constellationGapMax?: number;
  }
): StrandViolation[] {
  const violations: StrandViolation[] = [];

  // Quest overload: count consecutive quest chapters up to current
  const recentHistory = tracker.history.slice(-thresholds.questMax - 1);
  let consecutiveQuest = 0;
  for (let i = recentHistory.length - 1; i >= 0; i--) {
    if (recentHistory[i].dominant === 'quest') consecutiveQuest++;
    else break;
  }
  if (consecutiveQuest >= thresholds.questMax) {
    violations.push({
      type: 'quest_overload',
      severity: consecutiveQuest >= thresholds.questMax + 2 ? 'high' : 'medium',
      currentGap: consecutiveQuest,
      threshold: thresholds.questMax,
      message: `Tuyến chính liên tiếp ${consecutiveQuest} chương (ngưỡng: ${thresholds.questMax})`,
      suggestion: 'Nên xen kẽ chương tình cảm hoặc thế giới quan',
    });
  }

  // Fire drought
  const fireGap = currentChapter - tracker.lastFireChapter;
  if (tracker.lastFireChapter > 0 && fireGap > thresholds.fireGapMax) {
    violations.push({
      type: 'fire_drought',
      severity: fireGap >= thresholds.fireGapMax + 5 ? 'high' : 'medium',
      currentGap: fireGap,
      threshold: thresholds.fireGapMax,
      message: `Tuyến tình cảm gián đoạn ${fireGap} chương (ngưỡng: ${thresholds.fireGapMax})`,
      suggestion: 'Nên bổ sung cảnh tương tác nhân vật, phát triển quan hệ',
    });
  }

  // Constellation absent
  const constellationGapMax = thresholds.constellationGapMax ?? 15;
  const constellationGap = currentChapter - tracker.lastConstellationChapter;
  if (tracker.lastConstellationChapter > 0 && constellationGap > constellationGapMax) {
    violations.push({
      type: 'constellation_absent',
      severity: 'low',
      currentGap: constellationGap,
      threshold: constellationGapMax,
      message: `Tuyến thế giới quan vắng ${constellationGap} chương (ngưỡng: ${constellationGapMax})`,
      suggestion: 'Nên mở rộng thế giới quan: thế lực mới, hệ thống, bối cảnh',
    });
  }

  return violations;
}

/** Update tracker after classifying a chapter's strand */
export function updateStrandTracker(
  tracker: StrandTracker,
  chapterStrand: ChapterStrand
): StrandTracker {
  const updated = { ...tracker, history: [...tracker.history, chapterStrand] };
  const ch = chapterStrand.chapterNumber;

  if (chapterStrand.dominant === 'quest') updated.lastQuestChapter = ch;
  if (chapterStrand.dominant === 'fire') updated.lastFireChapter = ch;
  if (chapterStrand.dominant === 'constellation') updated.lastConstellationChapter = ch;

  return updated;
}

/** Calculate strand distribution over a range of chapters */
export function calculateStrandDistribution(
  history: ChapterStrand[]
): Record<StrandType, { count: number; percentage: number }> {
  const total = history.length || 1;
  const counts: Record<StrandType, number> = { quest: 0, fire: 0, constellation: 0 };

  for (const ch of history) {
    counts[ch.dominant]++;
  }

  return {
    quest: { count: counts.quest, percentage: Math.round((counts.quest / total) * 100) },
    fire: { count: counts.fire, percentage: Math.round((counts.fire / total) * 100) },
    constellation: { count: counts.constellation, percentage: Math.round((counts.constellation / total) * 100) },
  };
}
