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
  successCount: number;
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
  value?: string;
}

export interface SuggestionGroup {
  groupLabel?: string;
  chips: SuggestionChip[];
  /** Default remains multi for backward compatibility. */
  selectionMode?: 'single' | 'multi';
  /** Visible groups marked required must have a selected chip before confirmation. */
  required?: boolean;
  /** Show this group only when at least one selected chip has one of these values. */
  visibleWhenSelectedValues?: string[];
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
  | 'cost_preview'
  | 'loading';

export interface CreationMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  type: CreationMessageType;
  tokenUsage?: CreationMessageTokenUsage;
  suggestions?: SuggestionGroup[];
  aiDecideLabel?: string;
  plotPreviewData?: CreationPlotPreview;
  frameworkData?: BrainstormResult;
  chapterDraft?: {
    chapterIndex: number;
    title: string;
    content: string;
    charCount: number;
  };
  costPreviewData?: CreationCostPreviewData;
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

// ─── Cost Preview (after chapter_scope answer) ──────────────

export interface CreationCostPreviewData {
  targetChapters: number;
  totalTokensEstimate: number;
  setupTokensEstimate: number;
  fullStoryCostLabel: string;
  setupCostLabel: string;
  chapterPipelineNote: string;
}

// ─── Discussion Topic (Phase 2 config) ──────────────────────

export type DiscussTopicId =
  | 'magic_system'
  | 'story_engine'
  | 'genre_stack'
  | 'conflict'
  | 'protagonist'
  | 'tone_antagonist'
  | 'era_register'
  | 'chapter_scope'
  | 'ready_check';

export interface DiscussTopic {
  id: DiscussTopicId;
  questionTemplate: string;
  suggestionGroups: SuggestionGroup[];
  aiDecideLabel: string;
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
  currentTopicIndex: number;
  answers: Record<string, string>;
  plotPreview: CreationPlotPreview | null;
  plotPreviewConfirmed: boolean;
  framework: BrainstormResult | null;
  frameworkConfirmed: boolean;
  currentChapterIndex: number;
  acceptedChapters: AcceptedChapter[];
  draftInput: string;
  draftSavedAt: string | null;
  progress: CreationWorkflowProgress;
  isBatchComposing: boolean;
  isAiWorking: boolean;
  error: string | null;
}