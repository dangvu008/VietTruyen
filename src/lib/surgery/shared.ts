import type { Arc, Chapter } from '../../types/story';
import type { ImpactReasonType, ImpactSeverity, RemovalDirective } from '../../types/surgery';

const NORMALIZE_RE = /[\u0300-\u036f]/g;
const CLIMAX_RE = /(cao tr[aà]o|quy[eế]t chi[eế]n|boss|tr[uù]m cu[oố]i|endgame|hồi cuối|chung kết|bí mật|lật mặt|đại chiến)/i;

export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(NORMALIZE_RE, '')
    .toLowerCase();
}

export function includesLoose(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…\n])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildFallbackChapterSummary(chapter: Chapter): string {
  if (chapter.summary?.trim()) return chapter.summary.trim();

  const sentences = splitSentences(chapter.content || '');
  const leading = sentences.slice(0, 3).join(' ');
  const trailing = sentences.slice(-2).join(' ');
  const summary = [leading, trailing].filter(Boolean).join(' ');

  if (summary.trim()) {
    return `${chapter.title}: ${summary}`.trim();
  }

  const excerpt = (chapter.content || '').trim().slice(0, 240);
  return `${chapter.title}: ${excerpt}`.trim();
}

export function deriveSeverity(params: {
  importance?: 'critical' | 'moderate' | 'minor';
  chapterIndex: number;
  chapterCount: number;
  isEndgame?: boolean;
  isClimaxHint?: boolean;
}): ImpactSeverity {
  const { importance, chapterIndex, chapterCount, isEndgame, isClimaxHint } = params;
  const inLastTenPercent = chapterCount > 0 && chapterIndex >= Math.ceil(chapterCount * 0.9);

  if (isEndgame || inLastTenPercent) return 'critical';
  if (importance === 'critical' || isClimaxHint) return 'high';
  if (importance === 'moderate') return 'medium';
  return 'low';
}

export function deriveReasonType(params: {
  directive: RemovalDirective;
  isEndgame?: boolean;
  isForeshadowing?: boolean;
  severity: ImpactSeverity;
}): ImpactReasonType {
  if (params.isEndgame || params.severity === 'critical') return 'ending-critical';
  if (params.isForeshadowing || params.directive.targetType === 'foreshadowing') return 'foreshadowing';
  if (params.severity === 'high') return 'causal';
  return 'direct';
}

export function buildRecommendedAction(
  directive: RemovalDirective,
  severity: ImpactSeverity,
  reasonType: ImpactReasonType
): string {
  if (reasonType === 'ending-critical') {
    return `Không sửa cục bộ. Rewrite lại arc chứa payoff cuối và cân nhắc chuyển sang "${directive.policy === 'hard_delete' ? 'replace_function' : directive.policy}".`;
  }

  if (severity === 'high') {
    return `Ưu tiên rewrite summary của arc trước, sau đó sửa các chương có dependency trực tiếp tới "${directive.targetLabel}".`;
  }

  if (reasonType === 'foreshadowing') {
    return `Rà soát phục bút liên quan tới "${directive.targetLabel}" và thay bằng seed mới hoặc đóng thread.`;
  }

  return `Đánh dấu chương để rà continuity và áp policy "${directive.policy}" ở pass rewrite chương.`;
}

export function isClimaxLike(text: string): boolean {
  return CLIMAX_RE.test(text);
}

export function getArcForChapter(arcs: Arc[], chapterIndex: number): Arc | undefined {
  return arcs.find((arc) => chapterIndex >= arc.chapterStart && chapterIndex <= arc.chapterEnd);
}

export function summarizeArcFromChapters(chapters: Chapter[]): {
  summary: string;
  premise: string;
  escalation: string;
  climax: string;
  exitState: string;
} {
  const summaries = chapters.map((chapter) => buildFallbackChapterSummary(chapter)).filter(Boolean);
  const premise = summaries[0] || '';
  const escalation = summaries[Math.max(0, Math.floor((summaries.length - 1) / 2))] || premise;
  const climax = summaries[summaries.length - 1] || escalation;
  const exitState = summaries.slice(-2).join(' ').trim() || climax;
  const summary = summaries.slice(0, 2).concat(summaries.slice(-1)).filter(Boolean).join(' ');

  return { summary, premise, escalation, climax, exitState };
}
