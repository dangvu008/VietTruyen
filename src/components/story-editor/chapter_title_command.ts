/**
 * File: chapter_title_command.ts
 * Purpose: Detect deterministic chapter-title edit commands from Muse chat
 * Layer: UI/Domain helper
 * Domain: StoryEditor
 */
import type { ChatMessage } from './editor_types';

export interface ChapterTitleCommand {
  title: string;
  source: 'instruction' | 'history';
}

interface ResolveChapterTitleCommandInput {
  instruction: string;
  messages: ChatMessage[];
  currentTitle?: string;
}

const TITLE_KEYWORD_PATTERN = /(tên|tiêu đề|title)/i;
const CHAPTER_KEYWORD_PATTERN = /(chương|chapter)/i;
const MUTATION_PATTERN = /(đặt|dat|đổi|doi|sửa|sua|thêm|them|cập nhật|cap nhat|lưu|luu|áp dụng|ap dung|đưa|dua|đồng bộ|dong bo|sync|update|rename)/i;
const QUESTION_ONLY_PATTERN = /\?\s*$/;

export function resolveChapterTitleCommand(
  input: ResolveChapterTitleCommandInput,
): ChapterTitleCommand | null {
  const instruction = input.instruction.trim();
  if (!hasTitleMutationIntent(instruction)) return null;

  const explicitTitle = extractTitleFromText(instruction);
  if (explicitTitle && !isSameTitle(explicitTitle, input.currentTitle)) {
    return { title: explicitTitle, source: 'instruction' };
  }

  const historicalTitle = findLatestTitleInMessages(input.messages);
  if (historicalTitle && !isSameTitle(historicalTitle, input.currentTitle)) {
    return { title: historicalTitle, source: 'history' };
  }

  return null;
}

function hasTitleMutationIntent(text: string): boolean {
  const hasTitleKeyword = TITLE_KEYWORD_PATTERN.test(text);
  const hasChapterKeyword = CHAPTER_KEYWORD_PATTERN.test(text);
  const hasMutation = MUTATION_PATTERN.test(text);

  if (!hasTitleKeyword || !hasChapterKeyword || !hasMutation) return false;

  const lower = text.toLowerCase();
  const asksOnlyForTitle =
    QUESTION_ONLY_PATTERN.test(text)
    && !/(đặt|dat|đổi|doi|sửa|sua|thêm|them|cập nhật|cap nhat|lưu|luu|áp dụng|ap dung|đưa|dua|đồng bộ|dong bo|sync|update|rename)/i.test(lower);

  return !asksOnlyForTitle;
}

function findLatestTitleInMessages(messages: ChatMessage[]): string | null {
  for (const message of [...messages].reverse()) {
    const title = extractTitleFromText(message.content);
    if (title) return title;
  }

  return null;
}

function extractTitleFromText(text: string): string | null {
  const titleLabelMatch = text.match(
    /(?:tên|tiêu đề|title)(?:\s+chương|\s+chapter)?[^:\n]{0,80}[:：]\s*(.+)$/im,
  );
  const titleFromLabel = titleLabelMatch ? cleanupTitleCandidate(titleLabelMatch[1]) : null;
  if (titleFromLabel) return titleFromLabel;

  const explicitCommandMatch = text.match(
    /(?:đặt|dat|đổi|doi|sửa|sua|thêm|them|cập nhật|cap nhat|rename|update)[^.\n]{0,80}(?:tên|tiêu đề|title)[^.\n]{0,40}(?:là|la|thành|thanh|to|:|：|-)\s*(.+)$/im,
  );
  const titleFromCommand = explicitCommandMatch ? cleanupTitleCandidate(explicitCommandMatch[1]) : null;
  if (titleFromCommand) return titleFromCommand;

  const quotedTitleMatch = text.match(/(?:\*\*)?\s*["“]([^"”\n]{2,120})["”]\s*(?:\*\*)?/);
  const titleFromQuote = quotedTitleMatch ? cleanupTitleCandidate(quotedTitleMatch[1]) : null;
  if (titleFromQuote && TITLE_KEYWORD_PATTERN.test(text) && CHAPTER_KEYWORD_PATTERN.test(text)) {
    return titleFromQuote;
  }

  return null;
}

function cleanupTitleCandidate(raw: string): string | null {
  let title = raw
    .split('\n')[0]
    .replace(/\*\*/g, '')
    .replace(/^["'`“”\s]+|["'`“”\s]+$/g, '')
    .trim();

  const quoted = title.match(/^["“]([^"”]+)["”]/);
  if (quoted) {
    title = quoted[1].trim();
  } else {
    title = title
      .replace(/\s+\(.*$/g, '')
      .replace(/^["'`“”\s]+|["'`“”\s]+$/g, '')
      .replace(/[.!?。]+$/g, '')
      .trim();
  }

  if (title.length < 2 || title.length > 120) return null;
  if (/^(chương|chapter)\s*\d*$/i.test(title)) return null;

  return title;
}

function isSameTitle(nextTitle: string, currentTitle?: string): boolean {
  return Boolean(currentTitle?.trim())
    && normalizeTitle(nextTitle) === normalizeTitle(currentTitle ?? '');
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase();
}
