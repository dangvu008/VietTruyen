import { injectTemplateToWriterPrompt } from './template_injector';

const REVIEWER_ONLY_PREFIXES = [
  'USP:',
  'Sảng điểm khả dụng:',
  'Nhịp triển khai gợi ý:',
  'NÊN:',
  'Constraint packs:',
];

/**
 * Full template guidance is useful for planning/review, but overloading the
 * drafting model with best-practice/checklist language makes prose converge
 * toward template-shaped output. This function keeps only writer-relevant
 * register, arc intent, dialogue/register constraints and critical red-lines.
 */
export function filterWriterSafeTemplateGuidance(fullGuidance: string): string {
  return String(fullGuidance || '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !REVIEWER_ONLY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function injectWriterSafeTemplateGuidance(
  genre: string,
  tags?: string[],
  chapterIndex?: number,
): string {
  return filterWriterSafeTemplateGuidance(
    injectTemplateToWriterPrompt(genre, tags, chapterIndex),
  );
}

/**
 * Planner/Reviewer may inspect the complete template because these agents are
 * evaluating structure rather than generating prose directly.
 */
export function injectReviewerTemplateGuidance(
  genre: string,
  tags?: string[],
  chapterIndex?: number,
): string {
  return injectTemplateToWriterPrompt(genre, tags, chapterIndex);
}
