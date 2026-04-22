/**
 * File: git_storage_provider.ts
 * Purpose: StorageProvider implementation backed by Git on local filesystem via Tauri
 * Layer: Infrastructure (Provider)
 * Domain: Storage → [local Git persistence via Tauri invoke commands]
 *
 * Data Contract:
 * - Input:  StorageProvider method calls from app code
 * - Output: Project/Chapter data read from/written to local git repos
 * - Deps:   @tauri-apps/api (invoke), storage_provider interface
 *
 * File structure on disk:
 *   ~/Documents/VietTruyen/projects/<project-id>/
 *     ├── .git/
 *     ├── project.json
 *     ├── bible/world.json
 *     ├── bible/characters/<char-id>.json
 *     ├── outline/beats.json
 *     ├── chapters/<seq>_<title>.md
 *     └── foreshadowings.json
 */

import { invoke } from '@tauri-apps/api/core';
import type { Chapter, Project } from '../../types/story';
import type { StorageProvider } from './storage_provider';
import type {
  ExportBundle,
  ProjectSummary,
  StorageCapabilities,
  VersionEntry,
  VersionSnapshot,
} from './storage_types';

// ── Tauri command payloads ───────────────────────────────────

interface TauriProjectMeta {
  id: string;
  title: string;
  genre: string;
  chapterCount: number;
  updatedAt: string;
  createdAt: string;
}

interface TauriChapterPayload {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  sequenceNumber: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TauriVersionEntry {
  id: string;
  message: string;
  timestamp: string;
  author: string;
}

// ── Provider Implementation ─────────────────────────────────

export class GitStorageProvider implements StorageProvider {
  readonly mode = 'local' as const;

  readonly capabilities: StorageCapabilities = {
    branching: true,
    nativeDiff: true,
    realtime: false,
    offline: true,
    filesystem: true,
  };

  // ── Lifecycle ───────────────────────────────────────────

  async init(): Promise<void> {
    await invoke('storage_init');
  }

  async dispose(): Promise<void> {
    // No persistent connections to clean up for filesystem
  }

  // ── Project CRUD ────────────────────────────────────────

  async listProjects(): Promise<ProjectSummary[]> {
    const projects = await invoke<TauriProjectMeta[]>('storage_list_projects');
    return projects.map((project) => ({
      id: project.id,
      title: project.title,
      genre: project.genre,
      chapterCount: project.chapterCount,
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
    }));
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      return await invoke<Project>('storage_get_project', { projectId });
    } catch {
      return null;
    }
  }

  async saveProject(project: Project): Promise<void> {
    await invoke('storage_save_project', { project });
  }

  async deleteProject(projectId: string): Promise<void> {
    await invoke('storage_delete_project', { projectId });
  }

  // ── Chapter CRUD ────────────────────────────────────────

  async getProjectChapters(projectId: string): Promise<Chapter[]> {
    const raw = await invoke<TauriChapterPayload[]>('storage_list_chapters', { projectId });
    return raw.map(mapTauriChapter);
  }

  async getChapter(projectId: string, chapterId: string): Promise<Chapter | null> {
    try {
      const raw = await invoke<TauriChapterPayload>('storage_get_chapter', { projectId, chapterId });
      return mapTauriChapter(raw);
    } catch {
      return null;
    }
  }

  async saveChapter(projectId: string, chapter: Chapter): Promise<void> {
    await invoke('storage_save_chapter', {
      projectId,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary || null,
        sequenceNumber: chapter.sequenceNumber ?? 1,
        status: chapter.status,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      },
    });
  }

  async deleteChapter(projectId: string, chapterId: string): Promise<void> {
    await invoke('storage_delete_chapter', { projectId, chapterId });
  }

  async replaceProjectChapters(projectId: string, chapters: Chapter[]): Promise<void> {
    await invoke('storage_replace_chapters', {
      projectId,
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary || null,
        sequenceNumber: chapter.sequenceNumber ?? 1,
        status: chapter.status,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      })),
    });
  }

  // ── Version Control ─────────────────────────────────────

  async listVersions(projectId: string, chapterId?: string): Promise<VersionEntry[]> {
    const entries = await invoke<TauriVersionEntry[]>('storage_git_log', {
      projectId,
      path: chapterId ? `chapters/${chapterId}.md` : null,
    });
    return entries.map((entry) => ({
      id: entry.id,
      message: entry.message,
      timestamp: entry.timestamp,
      author: entry.author,
      chapterId,
    }));
  }

  async getVersion(projectId: string, versionId: string): Promise<VersionSnapshot | null> {
    try {
      return await invoke<VersionSnapshot>('storage_git_show', { projectId, versionId });
    } catch {
      return null;
    }
  }

  async createVersion(projectId: string, message: string): Promise<VersionEntry> {
    return invoke<VersionEntry>('storage_git_commit', { projectId, message });
  }

  // ── Export / Import ─────────────────────────────────────

  async exportProject(projectId: string): Promise<ExportBundle> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    const chapters = await this.getProjectChapters(projectId);
    return {
      format: 'viettruyen-v1',
      project: { ...project, chapters },
      chapters,
      exportedAt: new Date().toISOString(),
    };
  }

  async importProject(bundle: ExportBundle): Promise<string> {
    const project = { ...bundle.project };
    await this.saveProject(project);
    await this.replaceProjectChapters(project.id, bundle.chapters);
    await this.createVersion(project.id, `Import: ${project.title}`);
    return project.id;
  }
}

// ── Helpers ─────────────────────────────────────────────────

function mapTauriChapter(raw: TauriChapterPayload): Chapter {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    summary: raw.summary || undefined,
    sequenceNumber: raw.sequenceNumber,
    status: raw.status as Chapter['status'],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
