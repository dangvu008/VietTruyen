/**
 * File: scene_type_classifier.ts
 * Purpose: Phân loại scene type từ beat/outline để Director chọn context phù hợp.
 *          Inspired by MemPalace Layered Loading (L0→L3) —
 *          thay vì dump toàn bộ 18K chars, chỉ load context khớp loại scene.
 * Layer: AI → Director
 * Domain: Context Selection
 * Deps: story types (OutlineBeat, Chapter)
 */

import type { OutlineBeat, Chapter, Project } from '../../types/story';

// ─── Scene Type Taxonomy ─────────────────────────────────

export type SceneType =
  | 'combat'        // Chiến đấu, thi đấu, xung đột vật lý
  | 'dialogue'      // Hội thoại, đàm phán, tranh luận
  | 'exploration'   // Khám phá, mô tả bối cảnh, du hành
  | 'cultivation'   // Tu luyện, nâng cấp, đột phá (tiên hiệp)
  | 'emotion'       // Tình cảm, nội tâm, hồi tưởng
  | 'intrigue'      // Âm mưu, bí ẩn, chính trị
  | 'transition';   // Chuyển cảnh, di chuyển, time skip

export interface SceneTypeResult {
  primary: SceneType;
  secondary: SceneType | null;
  confidence: number;
  keywords: string[];
}

// ─── Context Budget per Scene Type ─────────────────────

export interface SceneContextBudget {
  /** Max chars for recent chapter summaries */
  recentSummaryChars: number;
  /** Max chars for previous chapter tail */
  prevChapterTailChars: number;
  /** Max chars for Bible/world context */
  bibleChars: number;
  /** Max chars for character brief */
  characterChars: number;
  /** Max number of characters to include */
  characterLimit: number;
  /** Max chars for entity timeline */
  timelineChars: number;
  /** Which context sections to prioritize (order matters) */
  prioritySections: string[];
}

/**
 * [Domain:ContextSelection] STEP 1 — Context budget map per scene type.
 * Combat scenes need more character/power data, less world lore.
 * Dialogue needs more character traits + recent context.
 * Exploration needs more world data, fewer character details.
 */
const SCENE_BUDGET_MAP: Record<SceneType, SceneContextBudget> = {
  combat: {
    recentSummaryChars: 800,
    prevChapterTailChars: 1200,
    bibleChars: 600,
    characterChars: 2000,
    characterLimit: 6,
    timelineChars: 1500,
    prioritySections: ['characters', 'timeline', 'prev_tail', 'bible', 'summaries'],
  },
  dialogue: {
    recentSummaryChars: 1200,
    prevChapterTailChars: 1500,
    bibleChars: 400,
    characterChars: 1800,
    characterLimit: 4,
    timelineChars: 800,
    prioritySections: ['characters', 'prev_tail', 'summaries', 'timeline', 'bible'],
  },
  exploration: {
    recentSummaryChars: 600,
    prevChapterTailChars: 800,
    bibleChars: 2000,
    characterChars: 600,
    characterLimit: 3,
    timelineChars: 500,
    prioritySections: ['bible', 'world', 'prev_tail', 'characters', 'summaries'],
  },
  cultivation: {
    recentSummaryChars: 600,
    prevChapterTailChars: 1000,
    bibleChars: 800,
    characterChars: 1500,
    characterLimit: 3,
    timelineChars: 1800,
    prioritySections: ['timeline', 'characters', 'bible', 'prev_tail', 'summaries'],
  },
  emotion: {
    recentSummaryChars: 1500,
    prevChapterTailChars: 1800,
    bibleChars: 300,
    characterChars: 1500,
    characterLimit: 4,
    timelineChars: 1000,
    prioritySections: ['prev_tail', 'summaries', 'characters', 'timeline', 'bible'],
  },
  intrigue: {
    recentSummaryChars: 1500,
    prevChapterTailChars: 1200,
    bibleChars: 600,
    characterChars: 1200,
    characterLimit: 5,
    timelineChars: 1200,
    prioritySections: ['summaries', 'prev_tail', 'characters', 'timeline', 'bible'],
  },
  transition: {
    recentSummaryChars: 400,
    prevChapterTailChars: 600,
    bibleChars: 400,
    characterChars: 400,
    characterLimit: 3,
    timelineChars: 400,
    prioritySections: ['prev_tail', 'summaries', 'bible', 'characters', 'timeline'],
  },
};

// ─── Keyword Dictionaries (Vietnamese xianxia/fantasy) ──

const COMBAT_KEYWORDS = [
  'chiến đấu', 'đánh', 'tấn công', 'phòng thủ', 'kiếm pháp', 'quyền',
  'thi đấu', 'tranh đoạt', 'trận chiến', 'sát', 'chém', 'đâm', 'bùng nổ',
  'chiêu thức', 'võ công', 'đối đầu', 'giao chiến', 'xung đột',
  'binh khí', 'pháp bảo', 'sát thủ', 'truy sát', 'mai phục',
  'combat', 'battle', 'fight', 'clash',
];

const DIALOGUE_KEYWORDS = [
  'nói', 'hỏi', 'đáp', 'trả lời', 'bàn bạc', 'thuyết phục',
  'đàm phán', 'tranh luận', 'tiết lộ', 'giải thích', 'kể',
  'hội thoại', 'đối thoại', 'tâm sự', 'thú nhận', 'cầu xin',
  'dialogue', 'conversation', 'talk', 'reveal',
];

const EXPLORATION_KEYWORDS = [
  'khám phá', 'phát hiện', 'đến', 'vùng đất', 'thành phố', 'rừng',
  'hang động', 'cổ mộ', 'di tích', 'bí cảnh', 'mê cung',
  'du hành', 'thám hiểm', 'quan sát', 'miêu tả', 'bối cảnh',
  'exploration', 'discover', 'landscape',
];

const CULTIVATION_KEYWORDS = [
  'tu luyện', 'đột phá', 'cảnh giới', 'đan dược', 'luyện đan',
  'thiền định', 'hấp thu', 'ngưng tụ', 'tinh luyện', 'khai ngộ',
  'nâng cấp', 'tăng sức', 'pháp lực', 'linh khí', 'nguyên anh',
  'kinh mạch', 'cultivation', 'breakthrough', 'level up',
];

const EMOTION_KEYWORDS = [
  'cảm xúc', 'nỗi buồn', 'vui mừng', 'yêu', 'thương', 'nhớ',
  'hồi tưởng', 'ký ức', 'nội tâm', 'suy nghĩ', 'trăn trở',
  'đau khổ', 'hạnh phúc', 'hy vọng', 'tuyệt vọng', 'phản bội',
  'chia ly', 'hội ngộ', 'cảm động', 'emotion', 'feeling', 'memory',
];

const INTRIGUE_KEYWORDS = [
  'âm mưu', 'bí mật', 'phản bội', 'gián điệp', 'kế hoạch',
  'chính trị', 'phe phái', 'thao túng', 'bẫy', 'mưu kế',
  'nghi ngờ', 'điều tra', 'manh mối', 'ám sát', 'liên minh',
  'intrigue', 'conspiracy', 'mystery', 'plot twist',
];

// ─── Classification Logic ────────────────────────────────

function normalizeForClassification(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function countKeywordMatches(normalizedText: string, keywords: string[]): { count: number; matched: string[] } {
  const matched: string[] = [];
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeForClassification(keyword);
    if (normalizedText.includes(normalizedKeyword)) {
      matched.push(keyword);
    }
  }
  return { count: matched.length, matched };
}

/**
 * [Domain:ContextSelection] STEP 2 — Classify scene type from beat text.
 * Uses keyword frequency analysis across 6 dictionaries.
 * Returns primary + optional secondary scene type.
 */
export function classifySceneType(
  beat: OutlineBeat | undefined,
  prevChapter?: Chapter,
): SceneTypeResult {
  if (!beat) {
    return { primary: 'transition', secondary: null, confidence: 0.3, keywords: [] };
  }

  const sourceText = normalizeForClassification(
    `${beat.title || ''} ${beat.summary || ''} ${beat.focus || ''}`
  );

  const scores: Array<{ type: SceneType; count: number; matched: string[] }> = [
    { type: 'combat', ...countKeywordMatches(sourceText, COMBAT_KEYWORDS) },
    { type: 'dialogue', ...countKeywordMatches(sourceText, DIALOGUE_KEYWORDS) },
    { type: 'exploration', ...countKeywordMatches(sourceText, EXPLORATION_KEYWORDS) },
    { type: 'cultivation', ...countKeywordMatches(sourceText, CULTIVATION_KEYWORDS) },
    { type: 'emotion', ...countKeywordMatches(sourceText, EMOTION_KEYWORDS) },
    { type: 'intrigue', ...countKeywordMatches(sourceText, INTRIGUE_KEYWORDS) },
  ];

  scores.sort((a, b) => b.count - a.count);

  const top = scores[0];
  const runner = scores[1];

  if (top.count === 0) {
    // Fallback: use previous chapter tail to infer
    if (prevChapter?.content) {
      const tailText = normalizeForClassification(
        prevChapter.content.slice(-500)
      );
      const tailScores: Array<{ type: SceneType; count: number; matched: string[] }> = [
        { type: 'combat', ...countKeywordMatches(tailText, COMBAT_KEYWORDS) },
        { type: 'dialogue', ...countKeywordMatches(tailText, DIALOGUE_KEYWORDS) },
        { type: 'exploration', ...countKeywordMatches(tailText, EXPLORATION_KEYWORDS) },
        { type: 'cultivation', ...countKeywordMatches(tailText, CULTIVATION_KEYWORDS) },
        { type: 'emotion', ...countKeywordMatches(tailText, EMOTION_KEYWORDS) },
        { type: 'intrigue', ...countKeywordMatches(tailText, INTRIGUE_KEYWORDS) },
      ];
      tailScores.sort((a, b) => b.count - a.count);
      const tailTop = tailScores[0];
      if (tailTop.count > 0) {
        return {
          primary: tailTop.type,
          secondary: null,
          confidence: 0.5,
          keywords: tailTop.matched,
        };
      }
    }
    return { primary: 'transition', secondary: null, confidence: 0.3, keywords: [] };
  }

  const totalMatches = scores.reduce((sum, s) => sum + s.count, 0);
  const confidence = Math.min(0.95, 0.5 + (top.count / Math.max(totalMatches, 1)) * 0.45);

  return {
    primary: top.type,
    secondary: runner.count > 0 && runner.count >= top.count * 0.5 ? runner.type : null,
    confidence,
    keywords: top.matched,
  };
}

/**
 * [Domain:ContextSelection] STEP 3 — Get context budget for a scene type.
 * If secondary scene type exists, blend budgets (70%/30% weight).
 */
export function getSceneContextBudget(result: SceneTypeResult): SceneContextBudget {
  const primary = SCENE_BUDGET_MAP[result.primary];
  if (!result.secondary) return { ...primary };

  const secondary = SCENE_BUDGET_MAP[result.secondary];
  const blend = (p: number, s: number) => Math.round(p * 0.7 + s * 0.3);

  return {
    recentSummaryChars: blend(primary.recentSummaryChars, secondary.recentSummaryChars),
    prevChapterTailChars: blend(primary.prevChapterTailChars, secondary.prevChapterTailChars),
    bibleChars: blend(primary.bibleChars, secondary.bibleChars),
    characterChars: blend(primary.characterChars, secondary.characterChars),
    characterLimit: Math.max(primary.characterLimit, secondary.characterLimit),
    timelineChars: blend(primary.timelineChars, secondary.timelineChars),
    prioritySections: primary.prioritySections,
  };
}

/**
 * [Domain:ContextSelection] STEP 4 — Convenience: classify + budget in one call.
 */
export function classifyAndBudget(
  project: Project,
  targetChapterIndex: number,
): { sceneType: SceneTypeResult; budget: SceneContextBudget } {
  const beat = project.outline?.[targetChapterIndex];
  const prevChapter = targetChapterIndex > 0
    ? project.chapters?.[targetChapterIndex - 1]
    : undefined;

  const sceneType = classifySceneType(beat, prevChapter);
  const budget = getSceneContextBudget(sceneType);
  return { sceneType, budget };
}
