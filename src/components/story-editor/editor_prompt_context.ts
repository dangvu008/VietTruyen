/**
 * File: editor_prompt_context.ts
 * Purpose: Build stable AI prompt context for story editor scope selection
 * Layer: UI/Domain helper
 * Domain: StoryEditor
 */
import type { Chapter } from '../../types/story';
import { sortChaptersBySequence } from '../../lib/memory/chapter_order';
import type { EditorSelection, PromptScope } from './editor_types';

const STORY_CONTEXT_CHAR_BUDGET = 12000;
const ACTIVE_CHAPTER_CHAR_BUDGET = 3200;
const OTHER_CHAPTER_CHAR_BUDGET = 900;

export const PROMPT_SCOPE_OPTIONS: Array<{
  id: PromptScope;
  label: string;
  helper: string;
}> = [
  {
    id: 'fragment',
    label: 'Đoạn hiện tại',
    helper: 'Tập trung vào đoạn đang chọn hoặc đoạn gần con trỏ.',
  },
  {
    id: 'chapter',
    label: 'Chương đang mở',
    helper: 'Dùng toàn bộ nội dung chương đang mở làm ngữ cảnh.',
  },
  {
    id: 'story',
    label: 'Toàn bộ truyện',
    helper: 'Nạp bối cảnh liên chương để góp ý hoặc chỉnh sửa ở mức toàn truyện.',
  },
];

interface PromptScopeContextInput {
  scope: PromptScope;
  projectTitle: string;
  chapterTitle: string;
  chapterContent: string;
  chapters: Chapter[];
  activeChapterId: string | null;
  selection: EditorSelection | null;
}

export function getPromptScopeLabel(scope: PromptScope): string {
  return PROMPT_SCOPE_OPTIONS.find((option) => option.id === scope)?.label ?? 'Chương đang mở';
}

export function getPromptScopeHelper(scope: PromptScope): string {
  return PROMPT_SCOPE_OPTIONS.find((option) => option.id === scope)?.helper ?? '';
}

export function extractFocusedFragment(
  chapterContent: string,
  selection: EditorSelection | null,
): string {
  return resolveFocusedFragmentSelection(chapterContent, selection)?.text ?? '';
}

export function resolveFocusedFragmentSelection(
  chapterContent: string,
  selection: EditorSelection | null,
): EditorSelection | null {
  const content = normalizeWhitespace(chapterContent, false);
  if (!content.trim()) return null;

  const selectedText = selection?.text?.trim();
  if (selectedText) {
    return {
      start: selection?.start ?? 0,
      end: selection?.end ?? selectedText.length,
      text: selectedText,
    };
  }

  const caret = clampCaretPosition(selection?.start ?? 0, content.length);
  const start = findParagraphStart(content, caret);
  const end = findParagraphEnd(content, caret);
  const fragment = content.slice(start, end).trim();

  if (fragment) {
    return {
      start,
      end,
      text: fragment,
    };
  }

  return {
    start: 0,
    end: content.length,
    text: clampText(content, ACTIVE_CHAPTER_CHAR_BUDGET),
  };
}

export function buildPromptScopeContext(input: PromptScopeContextInput): string {
  if (input.scope === 'fragment') {
    return buildFragmentContext(input.chapterContent, input.selection);
  }

  if (input.scope === 'story') {
    return buildStoryContext(input);
  }

  return buildChapterContext(input.chapterTitle, input.chapterContent);
}

function buildFragmentContext(
  chapterContent: string,
  selection: EditorSelection | null,
): string {
  const fragment = extractFocusedFragment(chapterContent, selection);
  return `Đoạn hiện tại trong chương:\n---\n${fragment || 'Chưa có nội dung để phân tích.'}\n---`;
}

function buildChapterContext(chapterTitle: string, chapterContent: string): string {
  const title = chapterTitle.trim() || 'Chương chưa đặt tên';
  const content = chapterContent.trim() || 'Chưa có nội dung cho chương này.';
  return `Chương đang mở: ${title}\n---\n${content}\n---`;
}

function buildStoryContext(input: PromptScopeContextInput): string {
  const sortedChapters = sortChaptersBySequence(input.chapters || []);
  const header = [
    `Dự án truyện: ${input.projectTitle || 'Không tên'}`,
    `Chương đang mở: ${input.chapterTitle.trim() || 'Chưa đặt tên'}`,
    `Tổng số chương: ${sortedChapters.length}`,
  ].join('\n');

  if (sortedChapters.length === 0) {
    return `${header}\n\nChưa có chương nào để nạp ngữ cảnh toàn truyện.`;
  }

  let remainingBudget = STORY_CONTEXT_CHAR_BUDGET - header.length;
  const chapterBlocks: string[] = [];

  for (const [index, chapter] of sortedChapters.entries()) {
    if (remainingBudget < 240) break;

    const isActive = chapter.id === input.activeChapterId;
    const budget = Math.min(
      remainingBudget,
      isActive ? ACTIVE_CHAPTER_CHAR_BUDGET : OTHER_CHAPTER_CHAR_BUDGET,
    );
    const block = buildStoryChapterBlock(chapter, index, isActive, budget);

    if (!block) continue;
    chapterBlocks.push(block);
    remainingBudget -= block.length + 2;
  }

  const omittedCount = sortedChapters.length - chapterBlocks.length;
  const footer =
    omittedCount > 0
      ? `\n\nGhi chú: Đã rút gọn ngữ cảnh, còn ${omittedCount} chương không được bung full để tiết kiệm token.`
      : '';

  return `${header}\n\n${chapterBlocks.join('\n\n')}${footer}`;
}

function buildStoryChapterBlock(
  chapter: Chapter,
  index: number,
  isActive: boolean,
  budget: number,
): string {
  if (budget < 120) return '';

  const chapterLabel = getChapterLabel(chapter, index);
  const titleSuffix = chapter.title.trim() ? `: ${chapter.title.trim()}` : '';
  const activeSuffix = isActive ? ' [đang mở]' : '';
  const summary = chapter.summary?.trim();
  const contentSource = normalizeWhitespace(chapter.content, false).trim();

  const lines = [`${chapterLabel}${titleSuffix}${activeSuffix}`];
  if (summary) {
    lines.push(`Tóm tắt: ${clampText(summary, 220)}`);
  }

  const excerptBudget = Math.max(120, budget - lines.join('\n').length - 12);
  const excerptSource = summary && !isActive ? `${summary}\n${contentSource}` : contentSource || summary || '';
  if (excerptSource) {
    const excerptLabel = isActive ? 'Nội dung trọng tâm' : 'Ngữ cảnh';
    lines.push(`${excerptLabel}: ${clampText(excerptSource, excerptBudget)}`);
  }

  return lines.join('\n');
}

function getChapterLabel(chapter: Chapter, index: number): string {
  const sequence = chapter.sequenceNumber ?? index + 1;
  return `Chương ${sequence}`;
}

function normalizeWhitespace(value: string, collapseNewlines: boolean): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  return collapseNewlines ? normalized.replace(/\s+/g, ' ').trim() : normalized;
}

function clampText(value: string, limit: number): string {
  const cleaned = normalizeWhitespace(value, true);
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function clampCaretPosition(value: number, length: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > length) return length;
  return value;
}

function findParagraphStart(content: string, caret: number): number {
  const doubleBreak = content.lastIndexOf('\n\n', Math.max(0, caret - 1));
  if (doubleBreak >= 0) return doubleBreak + 2;

  const singleBreak = content.lastIndexOf('\n', Math.max(0, caret - 1));
  if (singleBreak >= 0) return singleBreak + 1;

  return 0;
}

function findParagraphEnd(content: string, caret: number): number {
  const doubleBreak = content.indexOf('\n\n', caret);
  if (doubleBreak >= 0) return doubleBreak;

  const singleBreak = content.indexOf('\n', caret);
  if (singleBreak >= 0) return singleBreak;

  return content.length;
}
