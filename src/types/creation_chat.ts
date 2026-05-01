/**
 * File: creation_chat.ts
 * Purpose: Type contracts cho Unified Creation Chat Flow — 4 phases
 * Layer: Types
 * Domain: CreationChat → [describe, discuss, framework, compose]
 */

import type { BrainstormResult } from './narrative_memory';

// ─── Phase ──────────────────────────────────────────────────

export type CreationPhase = 'describe' | 'discuss' | 'review_plot' | 'framework' | 'compose';

export type CreationWorkflowStep =
  | 'describe'
  | 'discuss'
  | 'review_plot'
  | 'framework'
  | 'outline'
  | 'compose'
  | 'handoff';

export type CreationWorkflowStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'interrupted';

export interface BatchComposeProgress {
  current: number;
  total: number;
  isRunning: boolean;
  /** Number of chapters written successfully */
  successCount: number;
  /** Number of chapters that failed */
  failCount: number;
}

export interface CreationWorkflowProgress {
  step: CreationWorkflowStep;
  status: CreationWorkflowStatus;
  detail: string;
  lastCompletedStep: CreationWorkflowStep | null;
  lastCompletedAt: string | null;
  updatedAt: string;
  error: string | null;
  linkedProjectId: string | null;
  lastGeneratedChapterTitle: string | null;
  batchCompose: BatchComposeProgress | null;
}

// ─── Suggestion Chips ───────────────────────────────────────

export interface SuggestionChip {
  id: string;
  emoji: string;
  label: string;
  /** Optional detailed text sent as user message when chip is clicked */
  value?: string;
}

export interface SuggestionGroup {
  /** Optional label above the chip group */
  groupLabel?: string;
  chips: SuggestionChip[];
}

// ─── Plot Review Preview ────────────────────────────────────

export interface CreationPlotPreview {
  title: string;
  logline: string;
  protagonist: string;
  openingSetup: string;
  centralConflict: string;
  escalation: string;
  endingPromise: string;
  hooks: string[];
}

// ─── Message Types ──────────────────────────────────────────

export type CreationMessageType =
  | 'text'
  | 'suggestions'
  | 'plot_preview'
  | 'framework_preview'
  | 'chapter_draft'
  | 'phase_transition'
  | 'loading';

export interface CreationMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  type: CreationMessageType;
  tokenUsage?: CreationMessageTokenUsage;

  /** Suggestion chips attached to AI messages (Phase 2) */
  suggestions?: SuggestionGroup[];
  /** "Let AI decide" button config */
  aiDecideLabel?: string;

  /** Plot review data attached to plot_preview messages */
  plotPreviewData?: CreationPlotPreview;

  /** Framework data attached to framework_preview messages (Phase 3) */
  frameworkData?: BrainstormResult;

  /** Chapter draft data attached to chapter_draft messages (Phase 4) */
  chapterDraft?: {
    chapterIndex: number;
    title: string;
    content: string;
    charCount: number;
  };
}

export interface CreationMessageTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost?: number;
  cached?: boolean;
  modelName?: string;
  durationMs?: number;
  callCount?: number;
}

// ─── Discussion Topic (Phase 2 config) ──────────────────────

export type DiscussTopicId =
  | 'magic_system'
  | 'story_engine'
  | 'conflict'
  | 'protagonist'
  | 'tone_antagonist'
  | 'ready_check';

export interface DiscussTopic {
  id: DiscussTopicId;
  questionTemplate: string;
  suggestionGroups: SuggestionGroup[];
  aiDecideLabel: string;
  /** Minimum topics answered before allowing "AI tự phát triển tất cả" */
  required: boolean;
}

// ─── Accepted Chapter (saved from compose or manual) ────────

export interface AcceptedChapter {
  id: string;
  chapterIndex: number;
  title: string;
  content: string;
  charCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Store State ────────────────────────────────────────────

export interface CreationChatState {
  sessionId: string;
  sessionStartedAt: string;
  phase: CreationPhase;
  messages: CreationMessage[];
  /** Which discussion topic we're currently asking (Phase 2) */
  currentTopicIndex: number;
  /** User answers collected during Phase 2 — topicId → chosen value */
  answers: Record<string, string>;
  /** Phase 2.5 extracted plot review before framework generation */
  plotPreview: CreationPlotPreview | null;
  plotPreviewConfirmed: boolean;
  /** Phase 3 extracted framework */
  framework: BrainstormResult | null;
  frameworkConfirmed: boolean;
  /** Phase 4 compose state */
  currentChapterIndex: number;
  /** Chapters accepted by user (from AI or manual) */
  acceptedChapters: AcceptedChapter[];
  /** Draft text in composer, autosaved for resume after abrupt exit */
  draftInput: string;
  /** Last autosave marker for the whole creation session */
  draftSavedAt: string | null;
  /** Progress marker for AI generation + handoff state */
  progress: CreationWorkflowProgress;
  /** Whether batch compose (auto-write all chapters) is active */
  isBatchComposing: boolean;
  /** General loading/error state */
  isAiWorking: boolean;
  error: string | null;
}
