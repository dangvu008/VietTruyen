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

interface StoryContextBudgetConfig {
  totalChars?: number;
  activeChapterChars?: number;
  inactiveChapterFloorChars?: number;
}

interface ChapterNeighborContextConfig {
  includePrevious?: boolean;
  previousChars?: number;
}

interface PromptScopeInferenceInput {
  instruction: string;
  currentScope: PromptScope;
  selection: EditorSelection | null;
  chapterContent: string;
  chapterCount: number;
}

export interface PromptScopeInferenceResult {
  scope: PromptScope;
  confidence: 'high' | 'medium' | 'low';
  needsConfirmation: boolean;
  reason: string;
}

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
  storyBudget?: StoryContextBudgetConfig;
  chapterNeighborContext?: ChapterNeighborContextConfig;
}

type StoryChapterCoverage = 'full' | 'excerpt' | 'summary';

interface StoryChapterBlockResult {
  text: string;
  coverage: StoryChapterCoverage;
}

export function getPromptScopeLabel(scope: PromptScope): string {
  return PROMPT_SCOPE_OPTIONS.find((option) => option.id === scope)?.label ?? 'Chương đang mở';
}

export function getPromptScopeHelper(scope: PromptScope): string {
  return PROMPT_SCOPE_OPTIONS.find((option) => option.id === scope)?.helper ?? '';
}

export function inferPromptScopeForInstruction(input: PromptScopeInferenceInput): PromptScopeInferenceResult {
  const normalized = input.instruction.toLowerCase();
  const hasSelection = Boolean(input.selection?.text?.trim());
  const hasChapterContent = Boolean(input.chapterContent.trim());
  const scores: Record<PromptScope, number> = {
    fragment: 0,
    chapter: 1,
    story: 0,
  };

  const fragmentSignals = countPatternMatches(normalized, [
    /đoạn (đang )?(chọn|bôi đen|hiện tại|này)/,
    /câu (này|đang chọn|hiện tại)/,
    /cảnh (này|đang chọn)/,
    /chỗ này/,
    /phần này/,
    /selection/,
    /selected text/,
  ]);
  const chapterSignals = countPatternMatches(normalized, [
    /chương (đang mở|hiện tại|này|mới|tiếp|sau)/,
    /tóm tắt chương/,
    /review chương/,
    /viết tiếp/,
    /tiếp tục viết/,
    /mở đầu chương/,
    /kết chương/,
  ]);
  const storySignals = countPatternMatches(normalized, [
    /toàn bộ truyện/,
    /cả truyện/,
    /toàn truyện/,
    /cốt truyện/,
    /mạch truyện/,
    /plot/,
    /timeline/,
    /xuyên suốt/,
    /liên chương/,
    /các chương/,
    /tất cả chương/,
    /nhân vật/,
    /quan hệ/,
    /logic truyện/,
    /continuity/,
    /phục bút/,
    /foreshadow/,
    /tóm tắt truyện/,
    /review toàn/,
  ]);
  const mutationSignals = countPatternMatches(normalized, [
    /sửa/,
    /đổi/,
    /thay/,
    /xóa/,
    /viết lại/,
    /rewrite/,
    /retcon/,
    /áp dụng/,
    /đồng bộ/,
    /chuẩn hóa/,
    /chỉnh/,
  ]);

  scores.fragment += fragmentSignals * 3;
  scores.chapter += chapterSignals * 3;
  scores.story += storySignals * 3;

  if (hasSelection && mutationSignals > 0) scores.fragment += 2;
  if (hasSelection && fragmentSignals > 0) scores.fragment += 2;
  if (!hasSelection && fragmentSignals > 0 && hasChapterContent) scores.chapter += 1;
  if (storySignals > 0 && input.chapterCount > 1) scores.story += 1;
  if (input.currentScope !== 'chapter') scores[input.currentScope] += 0.5;

  const rankedScopes = (Object.keys(scores) as PromptScope[])
    .sort((left, right) => scores[right] - scores[left]);
  const scope = rankedScopes[0] ?? 'chapter';
  const topScore = scores[scope];
  const runnerUpScore = scores[rankedScopes[1] ?? 'chapter'];
  const gap = topScore - runnerUpScore;
  const confidence: PromptScopeInferenceResult['confidence'] =
    topScore >= 4 && gap >= 2 ? 'high' : gap >= 1 ? 'medium' : 'low';
  const isRiskyStoryMutation = scope === 'story' && mutationSignals > 0;
  const needsConfirmation = confidence === 'low' || isRiskyStoryMutation;

  return {
    scope,
    confidence,
    needsConfirmation,
    reason: buildScopeInferenceReason(scope, {
      fragmentSignals,
      chapterSignals,
      storySignals,
      mutationSignals,
      hasSelection,
      confidence,
    }),
  };
}

export function buildCreativeContinuationDirective(chapterContent: string): string {
  const normalizedContent = normalizeWhitespace(chapterContent, false).trim();
  const hasCurrentContent = Boolean(normalizedContent);

  if (hasCurrentContent) {
    const tail = clampTailText(normalizedContent, 700);
    return [
      'Ý ĐỊNH CHÈN: viết tiếp vào CUỐI chương đang mở.',
      'Chỉ trả về đoạn văn nối tiếp ngay sau ký tự cuối cùng của chương đang mở.',
      'Nếu đoạn cuối đang dở giữa từ hoặc giữa câu, ký tự đầu tiên của output phải là phần còn thiếu để nối thành câu hoàn chỉnh.',
      'Không lặp lại nội dung đã có, không mở chương mới, không thêm tiêu đề chương.',
      `Đoạn cuối hiện có để nối sát:\n---\n${tail}\n---`,
    ].join(' ');
  }

  return [
    'Ý ĐỊNH CHÈN: viết phần mở đầu cho CHƯƠNG ĐANG MỞ vì chương này còn trống.',
    'Dùng chương liền trước nếu có để nối mạch.',
    'Không tự tạo mục lục, không thêm tiêu đề chương, chỉ trả về văn bản chương.',
  ].join(' ');
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

  return buildChapterContext(input);
}

function buildFragmentContext(
  chapterContent: string,
  selection: EditorSelection | null,
): string {
  const fragment = extractFocusedFragment(chapterContent, selection);
  return `Đoạn hiện tại trong chương:\n---\n${fragment || 'Chưa có nội dung để phân tích.'}\n---`;
}

function buildChapterContext(input: PromptScopeContextInput): string {
  const title = input.chapterTitle.trim() || 'Chương chưa đặt tên';
  const content = input.chapterContent.trim() || 'Chưa có nội dung cho chương này.';
  const currentChapterContext = `Chương đang mở: ${title}\n---\n${content}\n---`;
  const neighborContext = buildChapterNeighborContext(input);
  return neighborContext ? `${currentChapterContext}\n\n${neighborContext}` : currentChapterContext;
}

function buildChapterNeighborContext(input: PromptScopeContextInput): string {
  if (!input.chapterNeighborContext?.includePrevious || !input.activeChapterId) return '';

  const sortedChapters = sortChaptersBySequence(input.chapters || []);
  const activeIndex = sortedChapters.findIndex((chapter) => chapter.id === input.activeChapterId);
  if (activeIndex <= 0) return '';

  const previousChapter = sortedChapters[activeIndex - 1];
  const previousSource = previousChapter.content?.trim() || previousChapter.summary?.trim() || '';
  if (!previousSource) return '';

  const previousLabel = getChapterLabel(previousChapter, activeIndex - 1);
  const titleSuffix = previousChapter.title.trim() ? `: ${previousChapter.title.trim()}` : '';
  const budget = Math.max(800, input.chapterNeighborContext.previousChars ?? 5200);
  const previousExcerpt = clampTailText(previousSource, budget);
  return `Chương liền trước để nối mạch: ${previousLabel}${titleSuffix}\n---\n${previousExcerpt}\n---`;
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

  const totalBudget = Math.max(
    STORY_CONTEXT_CHAR_BUDGET,
    input.storyBudget?.totalChars ?? STORY_CONTEXT_CHAR_BUDGET,
  );
  const activeChapterBudget = Math.max(
    ACTIVE_CHAPTER_CHAR_BUDGET,
    input.storyBudget?.activeChapterChars ?? ACTIVE_CHAPTER_CHAR_BUDGET,
  );
  const inactiveChapterFloor = Math.max(
    OTHER_CHAPTER_CHAR_BUDGET,
    input.storyBudget?.inactiveChapterFloorChars ?? OTHER_CHAPTER_CHAR_BUDGET,
  );
  const activeChapter = sortedChapters.find((chapter) => chapter.id === input.activeChapterId) ?? null;
  const orderedChapters = activeChapter
    ? [activeChapter, ...sortedChapters.filter((chapter) => chapter.id !== input.activeChapterId)]
    : sortedChapters;
  let remainingBudget = totalBudget - header.length;
  const chapterBlocks: string[] = [];
  let fullCoverageCount = 0;
  let excerptCoverageCount = 0;
  let summaryCoverageCount = 0;
  let inactiveLeft = orderedChapters.filter((chapter) => chapter.id !== input.activeChapterId).length;

  for (const chapter of orderedChapters) {
    if (remainingBudget < 240) break;

    const isActive = chapter.id === input.activeChapterId;
    const sequenceIndex = sortedChapters.findIndex((candidate) => candidate.id === chapter.id);
    const dynamicInactiveBudget = inactiveLeft > 0
      ? Math.max(inactiveChapterFloor, Math.floor(remainingBudget / inactiveLeft))
      : inactiveChapterFloor;
    const budget = Math.min(
      remainingBudget,
      isActive ? activeChapterBudget : dynamicInactiveBudget,
    );
    const block = buildStoryChapterBlock(chapter, sequenceIndex, isActive, budget);

    if (!block) continue;
    chapterBlocks.push(block.text);
    remainingBudget -= block.text.length + 2;
    if (block.coverage === 'full') fullCoverageCount += 1;
    if (block.coverage === 'excerpt') excerptCoverageCount += 1;
    if (block.coverage === 'summary') summaryCoverageCount += 1;
    if (!isActive && inactiveLeft > 0) inactiveLeft -= 1;
  }

  const omittedCount = sortedChapters.length - chapterBlocks.length;
  const coverageNotes = [
    fullCoverageCount > 0 ? `${fullCoverageCount} chương được nạp gần như toàn văn` : '',
    excerptCoverageCount > 0 ? `${excerptCoverageCount} chương chỉ có trích đoạn rút gọn` : '',
    summaryCoverageCount > 0 ? `${summaryCoverageCount} chương chỉ có tóm tắt vì thiếu nguyên văn` : '',
    omittedCount > 0 ? `${omittedCount} chương chưa được nạp vì giới hạn context` : '',
  ].filter(Boolean);
  const footer = coverageNotes.length > 0
    ? `\n\nGhi chú phạm vi: ${coverageNotes.join('; ')}. Chỉ được kết luận từ phần đã nạp ở trên.`
    : '';

  return `${header}\n\n${chapterBlocks.join('\n\n')}${footer}`;
}

function buildStoryChapterBlock(
  chapter: Chapter,
  index: number,
  isActive: boolean,
  budget: number,
): StoryChapterBlockResult | null {
  if (budget < 120) return null;

  const chapterLabel = getChapterLabel(chapter, index);
  const titleSuffix = chapter.title.trim() ? `: ${chapter.title.trim()}` : '';
  const activeSuffix = isActive ? ' [đang mở]' : '';
  const summary = chapter.summary?.trim();
  const contentSource = normalizeWhitespace(chapter.content, false).trim();
  const cleanedContent = normalizeWhitespace(contentSource, true);
  const cleanedSummary = summary ? normalizeWhitespace(summary, true) : '';

  const lines = [`${chapterLabel}${titleSuffix}${activeSuffix}`];
  if (summary && cleanedSummary !== cleanedContent) {
    lines.push(`Tóm tắt: ${clampText(summary, 220)}`);
  }

  const excerptBudget = Math.max(120, budget - lines.join('\n').length - 12);
  const excerptSource = contentSource || summary || '';
  if (!excerptSource) return null;

  const cleanedExcerptSource = normalizeWhitespace(excerptSource, true);
  const excerptText = clampText(excerptSource, excerptBudget);
  const coverage: StoryChapterCoverage = contentSource
    ? cleanedExcerptSource.length <= excerptBudget
      ? 'full'
      : 'excerpt'
    : 'summary';
  const excerptLabel = coverage === 'full'
    ? (isActive ? 'Nguyên văn trọng tâm' : 'Nguyên văn')
    : coverage === 'summary'
      ? 'Tóm tắt nguồn'
      : 'Trích đoạn';

  lines.push(`${excerptLabel}: ${excerptText}`);
  return {
    text: lines.join('\n'),
    coverage,
  };
}

function getChapterLabel(chapter: Chapter, index: number): string {
  const sequence = chapter.sequenceNumber ?? index + 1;
  return `Chương ${sequence}`;
}

function normalizeWhitespace(value: string, collapseNewlines: boolean): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  return collapseNewlines ? normalized.replace(/\s+/g, ' ').trim() : normalized;
}

function countPatternMatches(value: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(value) ? 1 : 0), 0);
}

function buildScopeInferenceReason(
  scope: PromptScope,
  signals: {
    fragmentSignals: number;
    chapterSignals: number;
    storySignals: number;
    mutationSignals: number;
    hasSelection: boolean;
    confidence: PromptScopeInferenceResult['confidence'];
  },
): string {
  if (scope === 'fragment') {
    return signals.hasSelection
      ? 'Yêu cầu nhắc tới đoạn/cảnh hiện tại và đang có vùng chọn trong chương.'
      : 'Yêu cầu nhắm vào một đoạn nhỏ trong chương đang mở.';
  }

  if (scope === 'story') {
    return signals.mutationSignals > 0 && signals.confidence !== 'high'
      ? 'Yêu cầu có dấu hiệu chỉnh sửa liên chương/toàn truyện, cần xác nhận trước khi tác động rộng.'
      : 'Yêu cầu nhắc tới cốt truyện, nhân vật, mạch truyện hoặc toàn bộ các chương.';
  }

  if (signals.chapterSignals > 0) {
    return 'Yêu cầu nhắm vào chương đang mở hoặc thao tác viết tiếp/tóm tắt chương.';
  }

  return 'Không thấy dấu hiệu cần mở rộng phạm vi, nên dùng chương đang mở làm mặc định an toàn.';
}

function clampText(value: string, limit: number): string {
  const cleaned = normalizeWhitespace(value, true);
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function clampTailText(value: string, limit: number): string {
  const cleaned = normalizeWhitespace(value, true);
  if (cleaned.length <= limit) return cleaned;
  return `…${cleaned.slice(Math.max(0, cleaned.length - limit + 1)).trimStart()}`;
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
