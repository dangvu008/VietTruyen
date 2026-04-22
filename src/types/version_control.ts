/**
 * File: version_control.ts
 * Purpose: Types cho hệ thống Version History và Branching
 * Layer: Domain (Types)
 * Domain: VersionControl → [chapter versioning, diff, branching]
 */

// ── Phase 1: Version History ──

export interface ChapterVersion {
  id: string;
  chapter_id: string;
  project_id: string;
  version_number: number;
  title: string | null;
  content: string;
  summary: string | null;
  word_count: number;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  change_note: string | null;
  created_at: string;
}

export interface VersionDiff {
  added: number;
  removed: number;
  unchanged: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'same';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// ── Phase 2: Branching (types sẵn, implement sau) ──

export type BranchStatus = 'active' | 'merged' | 'archived';

export interface StoryBranch {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  source_branch_id: string | null;
  status: BranchStatus;
  author_id: string;
  author_name?: string;
  created_at: string;
  updated_at: string;
  chapter_count?: number;
}

export interface BranchChapter {
  id: string;
  branch_id: string;
  chapter_id: string | null;
  title: string;
  content: string;
  sort_order: number;
  status: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface MergeChoice {
  chapter_id: string;
  source: 'main' | 'branch';
  title: string;
}
