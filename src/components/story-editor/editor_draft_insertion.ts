/**
 * File: editor_draft_insertion.ts
 * Purpose: Apply AI draft insertions to chapter text deterministically
 * Layer: UI/Domain helper
 * Domain: StoryEditor
 */
import type { EditorSelection, PromptScope } from './editor_types';

interface DraftInsertionInput {
  content: string;
  scope: PromptScope;
  selection?: EditorSelection;
}

export function applyEditorDraftInsertion(
  currentContent: string,
  insertion: DraftInsertionInput,
): string {
  const nextText = insertion.content.trim();
  if (!nextText) return currentContent;

  if (insertion.scope === 'fragment' && insertion.selection) {
    const start = Math.max(0, Math.min(insertion.selection.start, currentContent.length));
    const end = Math.max(start, Math.min(insertion.selection.end, currentContent.length));
    return `${currentContent.slice(0, start)}${nextText}${currentContent.slice(end)}`;
  }

  const current = currentContent.trimEnd();
  if (!current) return nextText;

  const separator = resolveChapterAppendSeparator(current, nextText);
  return `${current}${separator}${nextText}`;
}

function resolveChapterAppendSeparator(currentContent: string, nextText: string): string {
  if (!nextText) return '';

  const currentTail = currentContent.trimEnd();
  const lastChar = currentTail.slice(-1);
  const firstChar = nextText.trimStart().charAt(0);

  if (!lastChar || !firstChar) return '';
  if (isIncompleteWordTail(currentTail, firstChar)) return '';
  if (/[,\-–—;:]$/u.test(lastChar)) return ' ';
  if (/[.!?…。]"?$|[.!?…。][”’)]$/u.test(currentTail)) return '\n\n';
  if (/["“‘(]$/u.test(lastChar)) return '';

  return ' ';
}

function isIncompleteWordTail(currentTail: string, firstChar: string): boolean {
  return /\p{L}$/u.test(currentTail) && /\p{L}/u.test(firstChar);
}
