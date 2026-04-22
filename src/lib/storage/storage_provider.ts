/**
 * File: storage_provider.ts
 * Purpose: Abstract interface for storage backends (Git local / Supabase online)
 * Layer: Domain Contract
 * Domain: Storage → [CRUD projects, chapters, versions, export/import]
 *
 * Data Contract:
 * - Implementors: GitStorageProvider (local), OnlineStorageProvider (Supabase)
 * - Consumers: use_project_store, use_storage_store, components
 * - All methods are async — both providers may involve I/O
 */

import type { Chapter, Project } from '../../types/story';
import type {
  ExportBundle,
  ProjectSummary,
  StorageCapabilities,
  StorageMode,
  VersionEntry,
  VersionSnapshot,
} from './storage_types';

export interface StorageProvider {
  /** Which mode this provider operates in */
  readonly mode: StorageMode;

  /** Advertised capabilities of this provider */
  readonly capabilities: StorageCapabilities;

  // ── Lifecycle ───────────────────────────────────────────

  /** Initialize provider (open DB connection, init git repo, etc.) */
  init(): Promise<void>;

  /** Clean up resources */
  dispose(): Promise<void>;

  // ── Project CRUD ────────────────────────────────────────

  /** List all projects (lightweight summaries) */
  listProjects(): Promise<ProjectSummary[]>;

  /** Get full project data including inline metadata (not chapter content) */
  getProject(projectId: string): Promise<Project | null>;

  /** Save or update a project (metadata + characters + world + outline) */
  saveProject(project: Project): Promise<void>;

  /** Delete a project and all associated data */
  deleteProject(projectId: string): Promise<void>;

  // ── Chapter CRUD ────────────────────────────────────────

  /** Get all chapters for a project (with full content) */
  getProjectChapters(projectId: string): Promise<Chapter[]>;

  /** Get a single chapter by ID */
  getChapter(projectId: string, chapterId: string): Promise<Chapter | null>;

  /** Save or update a single chapter */
  saveChapter(projectId: string, chapter: Chapter): Promise<void>;

  /** Delete a single chapter */
  deleteChapter(projectId: string, chapterId: string): Promise<void>;

  /** Replace all chapters for a project (bulk operation) */
  replaceProjectChapters(projectId: string, chapters: Chapter[]): Promise<void>;

  // ── Version Control ─────────────────────────────────────

  /** List version history entries */
  listVersions(projectId: string, chapterId?: string): Promise<VersionEntry[]>;

  /** Get a full version snapshot */
  getVersion(projectId: string, versionId: string): Promise<VersionSnapshot | null>;

  /** Create a new version (commit / snapshot) */
  createVersion(projectId: string, message: string): Promise<VersionEntry>;

  // ── Export / Import ─────────────────────────────────────

  /** Export a project as a portable bundle */
  exportProject(projectId: string): Promise<ExportBundle>;

  /** Import a project from a bundle, returns the new project ID */
  importProject(bundle: ExportBundle): Promise<string>;
}
