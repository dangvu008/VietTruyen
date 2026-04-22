/**
 * File: storage_types.ts
 * Purpose: Shared types for the Storage Abstraction Layer
 * Layer: Domain Contract
 * Domain: Storage → [types shared between all providers]
 *
 * Data Contract:
 * - Used by: StorageProvider interface, GitStorageProvider, OnlineStorageProvider
 * - No runtime deps — pure type definitions
 */

import type { Chapter, Project } from '../../types/story';

// ── Storage Mode ────────────────────────────────────────────

/** Determines which storage backend is active */
export type StorageMode = 'local' | 'online';

// ── Project Summary (lightweight, for listing) ──────────────

export interface ProjectSummary {
  id: string;
  title: string;
  genre: string;
  chapterCount: number;
  updatedAt: string;
  createdAt: string;
}

// ── Version Control ─────────────────────────────────────────

export interface VersionEntry {
  id: string;
  message: string;
  timestamp: string;
  /** 'user' | 'ai' | email address */
  author: string;
  /** Optional chapter ID if version is chapter-scoped */
  chapterId?: string;
}

export interface VersionSnapshot {
  entry: VersionEntry;
  chapters: Chapter[];
  metadata: Partial<Project>;
}

// ── Export / Import ─────────────────────────────────────────

export interface ExportBundle {
  format: 'viettruyen-v1';
  project: Project;
  chapters: Chapter[];
  exportedAt: string;
}

// ── Provider Capabilities ───────────────────────────────────

export interface StorageCapabilities {
  /** Supports git-style branching */
  branching: boolean;
  /** Supports native diff */
  nativeDiff: boolean;
  /** Supports real-time collaboration */
  realtime: boolean;
  /** Supports offline usage */
  offline: boolean;
  /** Stores files on local filesystem */
  filesystem: boolean;
}
