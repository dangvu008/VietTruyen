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
export type ChapterUIStatus = 'empty' | 'ai-draft' | 'reviewing' | 'edited' | 'approved' | 'published';

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

/** Review warning surfaced by the AI Librarian */
export interface ReviewWarning {
  id: string;
  type: 'consistency' | 'lore' | 'tone';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/** AI review summary for a chapter */
export interface AIReviewSummary {
  summary: string;
  warnings: ReviewWarning[];
  characters: string[];
  notes: string[];
}

/** Project metadata subset needed by the topbar */
export interface ProjectInfo {
  id: string;
  title: string;
}
