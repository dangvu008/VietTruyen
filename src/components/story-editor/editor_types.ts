/**
 * File: editor_types.ts
 * Purpose: UI-specific type definitions for the Story Editor Workspace
 * Layer: UI/Domain
 * Domain: StoryEditor
 * Deps: types/story.ts
 */
import type { Chapter } from '../../types/story';

// Re-export the real Chapter type for convenience
export type { Chapter } from '../../types/story';

/**
 * UI-facing chapter status derived from real Chapter data + ephemeral AI state.
 * This is NOT persisted — computed on-the-fly in StoryWorkspace.
 */
export type ChapterUIStatus =
  | 'empty'
  | 'ai-draft'
  | 'generating'
  | 'interrupted'
  | 'reviewing'
  | 'edited'
  | 'approved'
  | 'published';

export const MIN_COMPLETE_CHAPTER_WORDS = 400;

export interface ChapterCompletionAction {
  label: string;
  title: string;
  mode: 'continue' | 'regenerate';
}

function countChapterWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function isProbablyInterruptedChapter(chapter: Chapter): boolean {
  if (chapter.generationStatus === 'generating') return false;
  if (chapter.generationStatus === 'partial' || chapter.generationStatus === 'failed') return true;
  if (chapter.status === 'final' || chapter.status === 'published') return false;
  const words = countChapterWords(chapter.content || '');
  return words > 0 && words < MIN_COMPLETE_CHAPTER_WORDS;
}

/** Editor interaction modes */
export type EditorMode = 'read' | 'review' | 'detail' | 'write' | 'diff';

/** Sidebar Navigation Tabs */
export type SidebarTab = 'chat' | 'outline' | 'characters' | 'lore' | 'timeline';

/** AI prompt scope */
export type PromptScope = 'fragment' | 'chapter' | 'story';

export interface EditorSelection {
  start: number;
  end: number;
  text: string;
}

export type EditorSelectionIntent =
  | 'internal_monologue'
  | 'dialogue'
  | 'shorten'
  | 'enhance_details'
  | 'custom';

export interface EditorSelectionIntentRequest {
  id: string;
  intent: Exclude<EditorSelectionIntent, 'custom'>;
  selection: EditorSelection;
}

export interface EditorAiProposal {
  content: string;
  prompt: string;
  scope: PromptScope;
  createdAt: string;
  selection?: EditorSelection;
}

/** AI Chat Message */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isDrafting?: boolean; // if true, shows the drafting UI block
  tokenCount?: number;  // tokens used for this message (from server response)
  /** True while AI is actively streaming this message */
  isStreaming?: boolean;
  /** True if message was cut short by user stop — can be resumed */
  isPartialStop?: boolean;
  /** True when this assistant message is draft prose that can be inserted into the active chapter */
  canInsertToDraft?: boolean;
  /** Original prompt scope to preserve the intended insertion target */
  insertScope?: PromptScope;
}

/**
 * Derives a UI status from real Chapter data + ephemeral workspace state.
 * [Domain:StoryEditor] STEP 1 — Map DB status to visual indicator.
 */
export function deriveChapterUIStatus(
  chapter: Chapter,
  hasAiProposal: boolean,
  hasDirtyContent: boolean,
): ChapterUIStatus {
  if (chapter.generationStatus === 'generating') return 'generating';

  if (isProbablyInterruptedChapter(chapter)) return 'interrupted';

  // If there's an AI proposal waiting for review
  if (hasAiProposal) return 'ai-draft';

  // Empty chapter — no content at all
  if (!chapter.content?.trim()) return 'empty';

  // DB status mapping
  if (chapter.status === 'published') return 'published';
  if (chapter.status === 'final') return 'approved';

  // User has unsaved edits in local buffer
  if (hasDirtyContent) return 'reviewing';

  // Has content but still draft/revised
  return 'edited';
}

export function getChapterCompletionAction(
  chapter: Chapter,
  uiStatus: ChapterUIStatus,
): ChapterCompletionAction | null {
  if (uiStatus !== 'interrupted') return null;

  const hasUsableContent = Boolean(chapter.content?.trim());
  if (hasUsableContent) {
    return {
      label: 'Hoàn thiện',
      title: 'AI sẽ viết tiếp từ phần đang dở để hoàn thiện chương.',
      mode: 'continue',
    };
  }

  return {
    label: 'Hoàn thiện',
    title: 'AI sẽ dựng lại chương này từ đầu vì nội dung hiện tại không còn usable.',
    mode: 'regenerate',
  };
}

/** Review warning surfaced by the AI Librarian */
export interface ReviewWarning {
  id: string;
  type: 'consistency' | 'lore' | 'tone' | 'continuity' | 'hook' | 'timeline' | 'revision';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/** AI review summary for a chapter */
export interface AIReviewSummary {
  summary: string;
  warnings: ReviewWarning[];
  characters: string[];
  notes: string[];
  revisionTasks?: string[];
}

/** Project metadata subset needed by the topbar */
export interface ProjectInfo {
  id: string;
  title: string;
}
