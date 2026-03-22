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
  | 'magic_system';

// ═══════════════════════════════════════════════════════════
// Layer 1: Entity Timeline
// ═══════════════════════════════════════════════════════════

export interface AttributeDiff {
  key: string;
  oldValue: string;
  newValue: string;
  reason: string; // "nhân vật bị thương mất cánh tay trái trong trận chiến"
}

export interface EntitySnapshot {
  id: string;
  entityId: string;
  entityType: EntityType;
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  attributes: Record<string, string>; // key-value pairs of all attributes at this point
  diffs: AttributeDiff[]; // what changed from previous snapshot
  timestamp: string;
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
  attributeKeys: string[]; // which specific attributes are referenced
  importance: DependencyImportance;
  context: string; // "Mô tả ngoại hình nhân vật khi gặp lần đầu"
}

// AI-extracted metadata from a chapter
export interface ChapterEntityRef {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  attributeKeys: string[];
  importance: DependencyImportance;
  context: string;
  changes?: AttributeDiff[]; // if entity changed in this chapter
}

export interface ChapterMetadata {
  chapterId: string;
  projectId: string;
  entityRefs: ChapterEntityRef[];
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
  affectedPassages: string[]; // relevant text snippets
  dependencyContext: string; // why this chapter is affected
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
  status: PropagationStatus;
  createdAt: string;
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
    entityRefs: string[]; // entity names referenced
  }>;
  foreshadowings: Array<{
    description: string;
  }>;
}
