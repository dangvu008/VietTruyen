import type { Chapter } from '../../types/story';

const CHAPTER_NUMBER_RE = /(?:ch(?:apter|\.|ương)?\s*)?(\d{1,6})/i;

export function extractSequenceNumberFromTitle(title: string): number | null {
  const match = title.match(CHAPTER_NUMBER_RE);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function ensureChapterSequenceNumbers(chapters: Chapter[]): Chapter[] {
  if (chapters.length === 0) return chapters;

  const existing = chapters
    .map((chapter) => chapter.sequenceNumber)
    .filter((value): value is number => Number.isFinite(value) && (value ?? 0) > 0);

  if (existing.length === chapters.length) {
    return chapters.map((chapter) => ({ ...chapter }));
  }

  const parsed = chapters.map((chapter) => extractSequenceNumberFromTitle(chapter.title));
  const uniqueParsed = new Set(parsed.filter((value): value is number => value !== null));
  const canUseParsed = uniqueParsed.size === chapters.length;

  return chapters.map((chapter, index) => ({
    ...chapter,
    sequenceNumber:
      chapter.sequenceNumber && chapter.sequenceNumber > 0
        ? chapter.sequenceNumber
        : canUseParsed
        ? (parsed[index] as number)
        : chapters.length - index,
  }));
}

export function getNextChapterSequenceNumber(chapters: Chapter[]): number {
  const normalized = ensureChapterSequenceNumbers(chapters);
  const max = normalized.reduce((highest, chapter) => Math.max(highest, chapter.sequenceNumber ?? 0), 0);
  return max + 1;
}

export function sortChaptersBySequence(chapters: Chapter[]): Chapter[] {
  return ensureChapterSequenceNumbers(chapters).sort(
    (left, right) => (left.sequenceNumber ?? 0) - (right.sequenceNumber ?? 0)
  );
}
