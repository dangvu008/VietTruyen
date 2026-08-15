/**
 * File: narrative_memory.ts
 * Purpose: Types cho Narrative Memory Engine — 3 lớp kiến trúc
 * Layer: Types
 * Domain: NarrativeMemory → [EntityTimeline, DependencyGraph, PropagationEngine]
 *
 * Data Contract:
 * - Layer 1: EntitySnapshot — trạng thái entity tại mỗi chương
 * - Layer 2: ChapterDependency — chương nào dùng attribute nào
 * - Layer 3: PropagationResult — blast radius khi sửa entity
 */

// ─── Entity Types ───────────────────────────────────────────
export type EntityType =
  | 'character'
  | 'world_element'
  | 'faction'
  | 'item'
  | 'location'
  | 'magic_system'
  | 'world';

export type MemorySourceType = 'project' | 'chapter_extract' | 'canonical_edit' | 'ai_enriched';
export type DependencyStatus = 'fresh' | 'stale';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'dismissed';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type NarrativeStateDomain =
  | 'character'
  | 'relationship'
  | 'item'
  | 'location'
  | 'plot'
  | 'world'
  | 'faction';
export type NarrativeStateValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'entity_ref'
  | 'chapter_ref'
  | 'json';
export type NarrativeStateMergePolicy = 'overwrite' | 'append' | 'timeline' | 'review_required';
export type NarrativeStateSubjectType = EntityType | 'relationship' | 'plot_thread' | 'secret' | 'foreshadowing';
export type NarrativeStateFactStatus = 'active' | 'superseded' | 'disputed' | 'retired';
export type NarrativeStateMutationType =
  | 'create'
  | 'update'
  | 'reveal'
  | 'conceal'
  | 'transfer'
  | 'resolve'
  | 'invalidate';
export type NarrativeStateReviewStatus = 'auto_accepted' | 'needs_review' | 'rejected';

// ═══════════════════════════════════════════════════════════
// Layer 1: Entity Timeline
// ═══════════════════════════════════════════════════════════

export interface AttributeDiff {
  key: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface EntityDefinition {
  id: string;
  entityId: string;
  projectId: string;
  entityType: EntityType;
  canonicalName: string;
  aliases: string[];
  attributes: Record<string, string>;
  sourceType: MemorySourceType;
  confidence: number;
  extractorVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntitySnapshot {
  id: string;
  entityId: string;
  entityType: EntityType;
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  attributes: Record<string, string>;
  diffs: AttributeDiff[];
  timestamp: string;
}

export interface TimelineFact {
  id: string;
  entityId: string;
  projectId: string;
  entityType: EntityType;
  attributeKey: string;
  value: string;
  chapterFrom: number;
  chapterTo?: number;
  sourceChapterId?: string;
  sourceType: MemorySourceType;
  confidence: number;
  reviewSuggested: boolean;
  extractorVersion: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// Layer 2: Chapter Dependency Graph
// ═══════════════════════════════════════════════════════════

export type DependencyImportance = 'critical' | 'moderate' | 'minor';

export interface ChapterDependency {
  id: string;
  chapterId: string;
  projectId: string;
  entityId: string;
  entityType: EntityType;
  attributeKeys: string[];
  importance: DependencyImportance;
  context: string;
}

export interface AttributeDependency {
  id: string;
  chapterId: string;
  projectId: string;
  chapterIndex: number;
  entityId: string;
  entityType: EntityType;
  attributeKey: string;
  importance: DependencyImportance;
  context: string;
  snippets: string[];
  dependencyStatus: DependencyStatus;
  confidence: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterEntityRef {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  attributeKeys: string[];
  importance: DependencyImportance;
  context: string;
  changes?: AttributeDiff[];
}

export interface ChapterMetadata {
  chapterId: string;
  projectId: string;
  chapterIndex: number;
  contentHash: string;
  warnings: string[];
  entityRefs: ChapterEntityRef[];
  extractorVersion: string;
  extractedAt: string;
}

// ═══════════════════════════════════════════════════════════
// Layer 3: Propagation Engine
// ═══════════════════════════════════════════════════════════

export type Severity = 'breaking' | 'warning' | 'info';
export type PatchStatus = 'pending' | 'approved' | 'rejected';
export type PropagationStatus = 'pending' | 'analyzing' | 'ready' | 'applied' | 'cancelled';

export interface AffectedChapter {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  severity: Severity;
  affectedPassages: string[];
  dependencyContext: string;
}

export interface PatchSuggestion {
  id: string;
  chapterId: string;
  chapterTitle: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  status: PatchStatus;
}

export interface CanonicalEdit {
  id: string;
  projectId: string;
  entityId: string;
  entityType: EntityType;
  attributeKey: string;
  oldValue: string;
  newValue: string;
  effectiveFromChapter: number;
  reason: string;
  sourceType: MemorySourceType;
  confidence: number;
  propagationStatus: PropagationStatus;
  createdAt: string;
  appliedAt?: string;
}

export interface PropagationTask {
  id: string;
  projectId: string;
  canonicalEditId: string;
  chapterId: string;
  chapterIndex: number;
  entityId: string;
  attributeKey: string;
  severity: Severity;
  reason: string;
  recommendedAction: string;
  dependencyContext: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PropagationResult {
  id: string;
  projectId: string;
  entityId: string;
  entityType: EntityType;
  attributeKey: string;
  oldValue: string;
  newValue: string;
  blastRadius: AffectedChapter[];
  patchSuggestions: PatchSuggestion[];
  taskQueue: PropagationTask[];
  status: PropagationStatus;
  createdAt: string;
}

export interface PropagationPreview {
  id: string;
  projectId: string;
  edits: CanonicalEdit[];
  blastRadius: AffectedChapter[];
  taskQueue: PropagationTask[];
  createdAt: string;
}

export interface IndexJob {
  id: string;
  projectId: string;
  jobType: 'backfill_project' | 'reindex_chapter' | 'reindex_project';
  chapterId?: string;
  status: JobStatus;
  totalItems: number;
  processedItems: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIndexState {
  projectId: string;
  lastProjectHash: string;
  lastIndexedAt?: string;
  needsBackfill: boolean;
  pendingChapterIds: string[];
  extractorVersion: string;
  activeJobId?: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// Layer 4: Continuity State
// ═══════════════════════════════════════════════════════════

export interface NarrativePredicateDefinition {
  id: string;
  projectId?: string;
  predicate: string;
  label: string;
  domain: NarrativeStateDomain;
  valueType: NarrativeStateValueType;
  allowedValues?: string[];
  aliases: string[];
  mergePolicy: NarrativeStateMergePolicy;
  isCore: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeStateEvidence {
  id: string;
  projectId: string;
  chapterId: string;
  sceneId?: string;
  sourceText: string;
  sourceHash: string;
  extractorVersion: string;
  confidence: number;
  createdAt: string;
}

export interface NarrativeStateMutation {
  id: string;
  projectId: string;
  chapterId: string;
  sceneId?: string;
  mutationType: NarrativeStateMutationType;
  subjectId: string;
  subjectType: NarrativeStateSubjectType;
  predicate: string;
  objectId?: string;
  beforeValue?: string;
  afterValue: string;
  confidence: number;
  evidenceId?: string;
  evidenceText: string;
  reviewStatus: NarrativeStateReviewStatus;
  conflictReason?: string;
  createdAt: string;
}

export interface NarrativeStateFact {
  id: string;
  projectId: string;
  subjectId: string;
  subjectType: NarrativeStateSubjectType;
  predicate: string;
  objectId?: string;
  value: string;
  valueType: NarrativeStateValueType;
  status: NarrativeStateFactStatus;
  validFromChapter: number;
  validToChapter?: number;
  confidence: number;
  evidenceIds: string[];
  mutationIds: string[];
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// Brainstorm Flow
// ═══════════════════════════════════════════════════════════

export interface BrainstormMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface BrainstormResult {
  bible: {
    genre: string;
    subGenre: string[];
    writingStyle: string;
    /**
     * Era-register proposal shown in framework review. The proposal is not authoritative
     * until the writer confirms the framework; project_seed then promotes it to a confirmed per-story setting.
     */
    narrativeEraRegister?: {
      frame:
        | 'contemporary'
        | 'near_premodern'
        | 'period'
        | 'future'
        | 'timeless_fantasy'
        | 'mixed'
        | 'custom';
      notes?: string;
    };
    title: string;
    logline: string;
    endgame: string;
    mainCharacterCount: number;
    supportCharacterCount: number;
    characterSetup: string;
    worldSetting: string;
    mainPlot: string;
  };
  characters: Array<{
    name: string;
    role: string;
    traits: string;
    arc: string;
    currentStage: string;
    psychology?: {
      coreWound: string;
      deepFear: string;
      hiddenDesire: string;
      selfDeception: string;
      bodyLanguage: string;
    };
  }>;
  world: {
    geography: string;
    magicSystem: string;
    techLevel: string;
    currency: string;
    factions: string[];
    rules: string;
  };
  outline: Array<{
    title: string;
    summary: string;
    focus: string;
  }>;
  chapterSkeleton: Array<{
    title: string;
    summary: string;
    keyEvents: string[];
    entityRefs: string[];
  }>;
  foreshadowings: Array<{
    description: string;
  }>;
}

// ═══════════════════════════════════════════════════════════
// Layer 5: Pending Hooks — Plot Continuity Registry (P1)
// ═══════════════════════════════════════════════════════════

export type PendingHookStatus = 'open' | 'resolved' | 'dropped';
export type PendingHookSource = 'ai_detected' | 'user_defined';

export interface PendingHook {
  id: string;
  projectId: string;
  plantedChapterId: string;
  plantedChapterIndex: number;
  description: string;
  evidence?: string;
  relatedEntityIds: string[];
  expectedPayoffBy?: number;
  status: PendingHookStatus;
  resolvedChapterId?: string;
  resolvedAt?: string;
  confidence: number;
  source: PendingHookSource;
  createdAt: string;
  updatedAt: string;
}
