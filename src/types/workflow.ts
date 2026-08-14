import type { BranchPlanningResult, ChapterWriteResult, DivergenceReport, SurpriseBranch, TensionLevel } from './surprise';
import type { CombinedReviewReport } from '../core/checkers/checker_types';
import type { StyleAnalysisResult } from './style_learning';
import type { Project, WorkflowEngineType } from './story';
import type { GroundedProseRuntimeGateArtifact } from './grounded_prose';
import type { PipelineAcceptanceDecision } from '../lib/memory/authoritative_promotion';

export type WorkflowIntentType =
  | 'create_chapter'
  | 'continue_chapter'
  | 'review_chapter'
  | 'rewrite_chapter'
  | 'fix_ooc'
  | 'analyze_pacing'
  | 'apply_retcon'
  | 'plan_chapter_branches'
  | 'write_chapter_from_branch'
  | 'full_write_pipeline';

export type WorkflowSource = 'button' | 'hotkey' | 'context_menu' | 'system' | 'batch';

export type QualityMode = 'fast' | 'balanced' | 'quality';

export type WorkflowStep =
  | 'idle'
  | 'planning'
  | 'drafting'
  | 'reviewing'
  | 'refining'
  | 'persisting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'context_building'
  | 'polishing'
  | 'data_processing'
  | 'syncing';

export interface WorkflowIntent<TType extends WorkflowIntentType = WorkflowIntentType, TPayload = unknown> {
  id: string;
  type: TType;
  projectId: string;
  chapterId?: string;
  source: WorkflowSource;
  payload: TPayload;
  createdAt: string;
}

export interface PlanChapterBranchesPayload {
  workflowEngine: WorkflowEngineType;
  project: Project;
  targetChapterIndex: number;
  mode: 'create' | 'continue';
  tensionLevel: TensionLevel;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
}

export interface WriteChapterFromBranchPayload extends PlanChapterBranchesPayload {
  branch: SurpriseBranch;
  styleInstruction?: string;
}

export type PlanChapterBranchesIntent = WorkflowIntent<'plan_chapter_branches', PlanChapterBranchesPayload>;

export type WriteChapterFromBranchIntent = WorkflowIntent<'write_chapter_from_branch', WriteChapterFromBranchPayload>;

export interface FullWritePipelinePayload {
  workflowEngine: WorkflowEngineType;
  project: Project;
  targetChapterIndex: number;
  mode: 'create' | 'continue';
  tensionLevel: TensionLevel;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
  styleInstruction?: string;
  /** Skip review step if user wants faster output. In quality mode this yields HOLD. */
  skipReview?: boolean;
  /** Skip style analysis step */
  skipPolish?: boolean;
  /** Controls expensive post-draft pipeline steps and promotion eligibility. */
  qualityMode?: QualityMode;
}

export type FullWritePipelineIntent = WorkflowIntent<'full_write_pipeline', FullWritePipelinePayload>;

export type SupportedWorkflowIntent =
  | PlanChapterBranchesIntent
  | WriteChapterFromBranchIntent
  | FullWritePipelineIntent;

export interface WorkflowArtifacts {
  planningResult?: BranchPlanningResult;
  chapterWriteResult?: ChapterWriteResult;
  draftText?: string;
  selectedBranchId?: string;
  divergenceReport?: DivergenceReport;
  reviewReport?: CombinedReviewReport;
  styleAnalysis?: StyleAnalysisResult;
  pipelineStepTimings?: Record<string, number>;
  /** Fail-closed prose artifact bundle required before automated promotion. */
  groundedProseGate?: GroundedProseRuntimeGateArtifact;
  /** PASS/HOLD/FAIL contract controlling authoritative state and accepted memory. */
  acceptanceDecision?: PipelineAcceptanceDecision;
}

export interface WorkflowSessionError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface WorkflowSession {
  id: string;
  intent: SupportedWorkflowIntent;
  step: WorkflowStep;
  statusMessage?: string;
  artifacts: WorkflowArtifacts;
  metrics: {
    startedAt: string;
    finishedAt?: string;
    latencyMs?: number;
  };
  error?: WorkflowSessionError;
}
