/**
 * File: narrative_weight_scorer.ts
 * Purpose: Tính Narrative Weight Score (NWS) cho entity — xác định mức độ quan trọng
 *          trong cốt truyện bằng 3 tầng phân tích KHÔNG cần AI
 * Layer: Application (Analysis)
 * Domain: Surgery → [narrative analysis, impact assessment, AI cost optimization]
 *
 * Data Contract:
 * - Input:  Project, entityName (nhân vật/chi tiết cần đánh giá)
 * - Output: NarrativeWeightResult với score 0-100 + breakdown + recommendation
 *
 * 3 tầng:
 *   T1: Frequency Scan — đếm số lần xuất hiện
 *   T2: Positional Weight — vị trí xuất hiện (climax, endgame, mở đầu)
 *   T3: Causal Chain — gắn với phục bút, dàn ý, từ khoá nhân quả
 *
 * Flow:
 *   NWS ≤ 20  → LOW    → An toàn xoá, KHÔNG cần AI
 *   NWS ≥ 70  → HIGH   → Ảnh hưởng lớn, KHÔNG cần AI (cảnh báo đỏ)
 *   NWS 21-69 → MEDIUM → Vùng mờ, gợi ý gọi AI 1 lần để confirm
 */
import type { Project, Chapter, Arc } from '../../types/story';
import { includesLoose, isClimaxLike } from '../surgery/shared';

/* ─── Types ─── */

export type NarrativeImpactLevel = 'low' | 'medium' | 'high';

export interface ChapterAppearance {
  chapterId: string;
  chapterIndex: number;
  chapterTitle: string;
  positionWeight: number;
  positionLabel: string;
}

export interface NarrativeWeightBreakdown {
  frequencyScore: number;      // 0-30: raw frequency normalized
  positionalScore: number;     // 0-40: weighted by position
  causalScore: number;         // 0-30: linked to foreshadowing/outline/plot
  details: {
    totalAppearances: number;
    chapters: ChapterAppearance[];
    inLogline: boolean;
    inMainPlot: boolean;
    inEndgame: boolean;
    inOutline: boolean;
    inForeshadowing: boolean;
    foreshadowingCount: number;
    outlineBeatCount: number;
    causalKeywordHits: number;
    climaxAppearances: number;
  };
}

export interface NarrativeWeightResult {
  entityName: string;
  score: number;               // 0-100 (weighted sum)
  level: NarrativeImpactLevel; // low/medium/high
  breakdown: NarrativeWeightBreakdown;
  recommendation: string;      // Hành động gợi ý
  needsAiCheck: boolean;       // true nếu score ở vùng mờ → gợi ý dùng AI
}

/* ─── Constants ─── */

/** Positional weight multipliers */
const POSITION_WEIGHTS = {
  openingChapters: 2,      // Chương 1-3: thiết lập
  midChapters: 1,          // Chương giữa: bình thường
  climaxChapters: 5,       // Chương cao trào (detected by keyword)
  endgameChapters: 4,      // 10% cuối: payoff
  lastChapter: 5,          // Chương cuối cùng
} as const;

/** Causal keywords — entity gắn với từ khoá này → tăng causal score */
const CAUSAL_KEYWORDS_VI = [
  'vì', 'bởi vì', 'nhờ', 'do', 'nếu không có',
  'kết quả', 'hậu quả', 'dẫn đến', 'gây ra',
  'bí mật', 'chìa khoá', 'chìa khóa', 'sự thật', 'lời tiên tri',
  'giao kèo', 'hợp đồng', 'lời hứa', 'phản bội',
  'biến cố', 'bước ngoặt', 'sụp đổ', 'phát hiện',
  'tiết lộ', 'lật mặt', 'hy sinh', 'cái chết',
];

/** Score thresholds */
const THRESHOLD_LOW = 20;
const THRESHOLD_HIGH = 70;

/* ─── Main Scorer ─── */

export function scoreNarrativeWeight(
  project: Project,
  entityName: string,
  arcs?: Arc[]
): NarrativeWeightResult {
  const chapters = project.chapters || [];
  const totalChapters = chapters.length;

  if (!entityName.trim() || totalChapters === 0) {
    return buildEmptyResult(entityName);
  }

  // Also search by aliases if entity is a character
  const character = project.characters.find(
    c => includesLoose(c.name, entityName) || c.aliases?.some(a => includesLoose(a, entityName))
  );
  const searchTerms = character
    ? [character.name, ...(character.aliases || [])]
    : [entityName];

  // ─── Tầng 1: Frequency Scan ───
  const chapterAppearances = scanChapterAppearances(chapters, searchTerms, totalChapters, arcs);
  const totalAppearances = chapterAppearances.length;
  const frequencyScore = calcFrequencyScore(totalAppearances, totalChapters);

  // ─── Tầng 2: Positional Weight ───
  const positionalScore = calcPositionalScore(chapterAppearances);
  const climaxAppearances = chapterAppearances.filter(ca => ca.positionLabel === 'climax').length;

  // ─── Tầng 3: Causal Chain ───
  const causalAnalysis = analyzeCausalChain(project, searchTerms, chapters);
  const causalScore = calcCausalScore(causalAnalysis);

  // ─── Combine (max: 25 + 40 + 35 = 100) ───
  const rawScore = frequencyScore + positionalScore + causalScore;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));
  const level = score <= THRESHOLD_LOW ? 'low' : score >= THRESHOLD_HIGH ? 'high' : 'medium';
  const needsAiCheck = level === 'medium';

  const breakdown: NarrativeWeightBreakdown = {
    frequencyScore: Math.round(frequencyScore),
    positionalScore: Math.round(positionalScore),
    causalScore: Math.round(causalScore),
    details: {
      totalAppearances,
      chapters: chapterAppearances,
      inLogline: causalAnalysis.inLogline,
      inMainPlot: causalAnalysis.inMainPlot,
      inEndgame: causalAnalysis.inEndgame,
      inOutline: causalAnalysis.outlineBeatCount > 0,
      inForeshadowing: causalAnalysis.foreshadowingCount > 0,
      foreshadowingCount: causalAnalysis.foreshadowingCount,
      outlineBeatCount: causalAnalysis.outlineBeatCount,
      causalKeywordHits: causalAnalysis.causalKeywordHits,
      climaxAppearances,
    },
  };

  return {
    entityName,
    score,
    level,
    breakdown,
    recommendation: buildRecommendation(level, breakdown, entityName),
    needsAiCheck,
  };
}

/**
 * Score nhiều entities cùng lúc (batch) — cho SurgeryPlannerPage
 */
export function scoreMultipleEntities(
  project: Project,
  entityNames: string[],
  arcs?: Arc[]
): NarrativeWeightResult[] {
  return entityNames.map(name => scoreNarrativeWeight(project, name, arcs));
}

/* ─── Tầng 1: Frequency Scan ─── */

function scanChapterAppearances(
  chapters: Chapter[],
  searchTerms: string[],
  totalChapters: number,
  arcs?: Arc[]
): ChapterAppearance[] {
  const appearances: ChapterAppearance[] = [];

  for (const chapter of chapters) {
    const haystack = [
      chapter.title,
      chapter.summary || '',
      chapter.content.slice(0, 3000), // Scan đầu chương (performance)
    ].join('\n');

    const found = searchTerms.some(term => includesLoose(haystack, term));
    if (!found) continue;

    const seqNum = chapter.sequenceNumber ?? 0;
    const { weight, label } = getPositionInfo(seqNum, totalChapters, chapter, arcs);

    appearances.push({
      chapterId: chapter.id,
      chapterIndex: seqNum,
      chapterTitle: chapter.title,
      positionWeight: weight,
      positionLabel: label,
    });
  }

  return appearances;
}

function calcFrequencyScore(appearances: number, totalChapters: number): number {
  // Max 25 points. Diminishing returns: xuất hiện nhiều nhưng không quan trọng.
  if (totalChapters === 0 || appearances === 0) return 0;
  const coverage = appearances / totalChapters;
  // 1 chapter = 2pt, 3 chapters = 5pt, 10 chapters/50% = 15pt, 100% = 25pt
  return Math.min(25, coverage * 25 * 0.7 + Math.min(appearances, 3) * 1.5);
}

/* ─── Tầng 2: Positional Weight ─── */

function getPositionInfo(
  seqNum: number,
  totalChapters: number,
  chapter: Chapter,
  arcs?: Arc[]
): { weight: number; label: string } {
  if (seqNum === totalChapters) {
    return { weight: POSITION_WEIGHTS.lastChapter, label: 'last' };
  }

  if (totalChapters > 0 && seqNum >= Math.ceil(totalChapters * 0.9)) {
    return { weight: POSITION_WEIGHTS.endgameChapters, label: 'endgame' };
  }

  // Check climax by keyword in chapter title/summary or arc climax
  const textToCheck = [chapter.title, chapter.summary || ''].join(' ');
  if (isClimaxLike(textToCheck)) {
    return { weight: POSITION_WEIGHTS.climaxChapters, label: 'climax' };
  }

  // Check if chapter is in a climax position within its arc
  if (arcs) {
    for (const arc of arcs) {
      if (seqNum >= arc.chapterStart && seqNum <= arc.chapterEnd) {
        if (isClimaxLike(arc.climax || '')) {
          // Last 20% of arc = climax zone
          const arcLength = arc.chapterEnd - arc.chapterStart + 1;
          if (seqNum >= arc.chapterEnd - Math.ceil(arcLength * 0.2)) {
            return { weight: POSITION_WEIGHTS.climaxChapters, label: 'climax' };
          }
        }
        break;
      }
    }
  }

  if (seqNum <= 3) {
    return { weight: POSITION_WEIGHTS.openingChapters, label: 'opening' };
  }

  return { weight: POSITION_WEIGHTS.midChapters, label: 'mid' };
}

function calcPositionalScore(appearances: ChapterAppearance[]): number {
  // Max 40 points. Sum of position weights, capped.
  if (appearances.length === 0) return 0;
  const totalWeight = appearances.reduce((sum, a) => sum + a.positionWeight, 0);
  // Normalize: 1 climax appearance (5) = 12.5pt, 2 climax = 20pt, climax + endgame = 22pt
  return Math.min(40, totalWeight * 2.5);
}

/* ─── Tầng 3: Causal Chain ─── */

interface CausalAnalysis {
  inLogline: boolean;
  inMainPlot: boolean;
  inEndgame: boolean;
  foreshadowingCount: number;
  outlineBeatCount: number;
  causalKeywordHits: number;
}

function analyzeCausalChain(
  project: Project,
  searchTerms: string[],
  chapters: Chapter[]
): CausalAnalysis {
  const matchesAny = (text: string) => searchTerms.some(t => includesLoose(text, t));

  // Check project-level fields
  const inLogline = matchesAny(project.logline || '');
  const inMainPlot = matchesAny(project.mainPlot || '');
  const inEndgame = matchesAny(project.endgame || '');

  // Count foreshadowings
  const foreshadowingCount = (project.foreshadowings || []).filter(f => {
    // Match by relatedEntityId if entity is a character
    const character = project.characters.find(c =>
      searchTerms.some(t => includesLoose(c.name, t))
    );
    if (character && f.relatedEntityId === character.id) return true;
    return matchesAny(f.description);
  }).length;

  // Count outline beats
  const outlineBeatCount = (project.outline || []).filter(beat =>
    matchesAny(`${beat.title} ${beat.summary} ${beat.focus}`)
  ).length;

  // Count causal keyword co-occurrences
  let causalKeywordHits = 0;
  for (const chapter of chapters) {
    const text = [chapter.title, chapter.summary || '', chapter.content.slice(0, 2000)].join('\n');
    if (!searchTerms.some(t => includesLoose(text, t))) continue;

    // Count causal keywords in same chapter where entity appears
    for (const keyword of CAUSAL_KEYWORDS_VI) {
      if (includesLoose(text, keyword)) {
        causalKeywordHits++;
        break; // 1 hit per chapter max (avoid over-counting)
      }
    }
  }

  return {
    inLogline,
    inMainPlot,
    inEndgame,
    foreshadowingCount,
    outlineBeatCount,
    causalKeywordHits,
  };
}

function calcCausalScore(analysis: CausalAnalysis): number {
  // Max 35 points — most important signal for "few appearances but critical"
  let score = 0;

  // Project-level mentions (very significant)
  if (analysis.inLogline) score += 12;    // logline = DNA of story
  if (analysis.inMainPlot) score += 8;    // main plot = central
  if (analysis.inEndgame) score += 12;    // endgame = critical

  // Foreshadowing links — strong signal
  score += Math.min(8, analysis.foreshadowingCount * 4); // Max 8pt

  // Outline beats
  score += Math.min(4, analysis.outlineBeatCount * 2); // Max 4pt

  // Causal keyword co-occurrences
  score += Math.min(4, analysis.causalKeywordHits * 1); // Max 4pt

  return Math.min(35, score);
}

/* ─── Helpers ─── */

function buildEmptyResult(entityName: string): NarrativeWeightResult {
  return {
    entityName,
    score: 0,
    level: 'low',
    breakdown: {
      frequencyScore: 0,
      positionalScore: 0,
      causalScore: 0,
      details: {
        totalAppearances: 0,
        chapters: [],
        inLogline: false,
        inMainPlot: false,
        inEndgame: false,
        inOutline: false,
        inForeshadowing: false,
        foreshadowingCount: 0,
        outlineBeatCount: 0,
        causalKeywordHits: 0,
        climaxAppearances: 0,
      },
    },
    recommendation: 'Không tìm thấy entity này trong truyện.',
    needsAiCheck: false,
  };
}

function buildRecommendation(
  level: NarrativeImpactLevel,
  breakdown: NarrativeWeightBreakdown,
  entityName: string
): string {
  const d = breakdown.details;

  if (level === 'low') {
    return `"${entityName}" ít ảnh hưởng tới cốt truyện. Có thể xoá/sửa an toàn bằng Tìm & Thay — không cần AI.`;
  }

  if (level === 'high') {
    const reasons: string[] = [];
    if (d.inLogline || d.inMainPlot) reasons.push('cốt truyện chính');
    if (d.inEndgame) reasons.push('kết thúc truyện');
    if (d.climaxAppearances > 0) reasons.push(`${d.climaxAppearances} cảnh cao trào`);
    if (d.foreshadowingCount > 0) reasons.push(`${d.foreshadowingCount} phục bút`);

    return `⚠️ "${entityName}" là yếu tố then chốt (${reasons.join(', ')}). Xoá/sửa sẽ ảnh hưởng lớn tới mạch truyện — cần AI rewrite.`;
  }

  // medium
  const hints: string[] = [];
  if (d.totalAppearances <= 3) hints.push(`chỉ xuất hiện ${d.totalAppearances} lần`);
  if (d.foreshadowingCount > 0) hints.push('có phục bút liên quan');
  if (d.causalKeywordHits > 0) hints.push('có dấu hiệu nhân-quả');

  return `"${entityName}" ở vùng chưa rõ (${hints.join(', ')}). Gợi ý: dùng AI kiểm tra 1 lần để chắc chắn trước khi quyết định.`;
}
