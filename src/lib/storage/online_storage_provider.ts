/**
 * File: online_storage_provider.ts
 * Purpose: StorageProvider implementation backed by Supabase (PostgreSQL)
 * Layer: Infrastructure (Provider)
 * Domain: Storage → [cloud persistence via Supabase for multi-user online mode]
 *
 * Data Contract:
 * - Input:  StorageProvider method calls from app code
 * - Output: Project/Chapter data from Supabase tables
 * - Deps:   supabase_client, sync_service, version_service
 *
 * Wraps existing Supabase services to conform to StorageProvider interface.
 * When running in web browser (no Tauri), this is auto-selected.
 */

import { supabase } from '../supabase/supabase_client';
import { uploadProject } from '../supabase/sync_service';
import {
  saveVersion,
  listVersions as listChapterVersions,
  getVersion as getChapterVersion,
} from '../supabase/version_service';
import type {
  Chapter,
  Character,
  Foreshadowing,
  OutlineBeat,
  Project,
  WorldRules,
} from '../../types/story';
import type { StorageProvider } from './storage_provider';
import type {
  ExportBundle,
  ProjectSummary,
  StorageCapabilities,
  VersionEntry,
  VersionSnapshot,
} from './storage_types';

const CHAPTER_READ_FAILURE_COOLDOWN_MS = 30_000;
const chapterReadRetryAfter = new Map<string, number>();

export class OnlineStorageProvider implements StorageProvider {
  readonly mode = 'online' as const;

  readonly capabilities: StorageCapabilities = {
    branching: true,
    nativeDiff: false,
    realtime: true,
    offline: false,
    filesystem: false,
  };

  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // ── Lifecycle ───────────────────────────────────────────

  async init(): Promise<void> {
    // Supabase client is initialized globally, nothing extra needed
  }

  async dispose(): Promise<void> {
    // Supabase client lifecycle is managed globally
  }

  // ── Project CRUD ────────────────────────────────────────

  async listProjects(): Promise<ProjectSummary[]> {
    // [Domain:Storage] STEP 1 — Fetch all projects
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, genre, updated_at, created_at')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`listProjects: ${error.message}`);
    if (!data || data.length === 0) return [];

    // [Domain:Storage] STEP 2 — Batch chapter count (avoids N+1)
    const projectIds = data.map((row) => row.id);
    const countMap = new Map<string, number>();
    const { data: chapterRows, error: chapterError } = await supabase
      .from('chapters')
      .select('project_id')
      .in('project_id', projectIds);

    if (chapterError) {
      // [Domain:Storage] RLS recursion — skip chapter count, default 0
      console.warn('[OnlineStorage] listProjects: chapter count query failed:', chapterError.message);
    } else {
      for (const row of chapterRows || []) {
        const pid = row.project_id as string;
        countMap.set(pid, (countMap.get(pid) || 0) + 1);
      }
    }

    return data.map((row) => ({
      id: row.id,
      title: row.title,
      genre: row.genre || '',
      chapterCount: countMap.get(row.id) || 0,
      updatedAt: row.updated_at || '',
      createdAt: row.created_at || '',
    }));
  }

  async getProject(projectId: string): Promise<Project | null> {
    // [Domain:Storage] STEP 1 — Fetch project row
    const { data: row, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error || !row) return null;

    // [Domain:Storage] STEP 2 — Fetch related entities in parallel
    const [worldRes, charsRes, beatsRes, foreshadowingsRes] = await Promise.all([
      supabase.from('world_rules').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('characters').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('outline_beats').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('foreshadowings').select('*').eq('project_id', projectId).order('created_at'),
    ]);

    const worldRow = worldRes.data as (typeof worldRes.data & { facts?: WorldRules['facts'] }) | null;

    const world: WorldRules = worldRow
      ? {
        geography: worldRow.geography || '',
        magicSystem: worldRow.magic_system || '',
        techLevel: worldRow.tech_level || '',
        currency: worldRow.currency || '',
        factions: worldRow.factions || [],
        rules: worldRow.rules || '',
        facts: worldRow.facts || [],
      }
      : { geography: '', magicSystem: '', techLevel: '', currency: '', factions: [], rules: '', facts: [] };

    const characters: Character[] = (charsRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role || '',
      arc: c.arc || '',
      currentStage: c.current_stage || '',
      traits: c.traits || '',
      psychology: {
        coreWound: c.core_wound || '',
        deepFear: c.deep_fear || '',
        hiddenDesire: c.hidden_desire || '',
        selfDeception: c.self_deception || '',
        bodyLanguage: c.body_language || '',
      },
    }));

    const outline: OutlineBeat[] = (beatsRes.data || []).map((b) => ({
      id: b.id,
      title: b.title,
      summary: b.summary || '',
      focus: b.focus || '',
    }));

    const foreshadowings: Foreshadowing[] = (foreshadowingsRes.data || []).map((f) => ({
      id: f.id,
      description: f.description,
      relatedEntityId: f.related_entity_id || undefined,
      isResolved: f.is_resolved || false,
      createdAt: f.created_at || new Date().toISOString(),
    }));

    return {
      id: row.id,
      title: row.title,
      logline: row.logline || '',
      genre: row.genre || '',
      subGenre: row.sub_genre || [],
      writingStyle: row.writing_style || '',
      tone: row.tone || '',
      styleId: row.style_id || '',
      targetChapters: row.target_chapters || 60,
      endgame: row.endgame || '',
      mainCharacterCount: row.main_character_count || 2,
      supportCharacterCount: row.support_character_count || 3,
      characterSetup: row.character_setup || '',
      worldSetting: row.world_setting || '',
      mainPlot: row.main_plot || '',
      world,
      characters,
      outline,
      chapters: [], // Chapters loaded separately via getProjectChapters
      foreshadowings,
      notes: row.notes || '',
      canonVersion: 1,
      storageMode: 'cloud',
      arcCount: 0,
      hasGlobalIndex: false,
      sourceProjectId: row.source_project_id || undefined,
      adaptationType: row.adaptation_type as Project['adaptationType'],
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  async saveProject(project: Project): Promise<void> {
    const { error } = await uploadProject(project, this.userId);
    if (error) throw error;
  }

  async deleteProject(projectId: string): Promise<void> {
    // [Domain:Storage] STEP 1 — Delete related data first (FK constraints)
    await Promise.all([
      supabase.from('chapters').delete().eq('project_id', projectId),
      supabase.from('characters').delete().eq('project_id', projectId),
      supabase.from('outline_beats').delete().eq('project_id', projectId),
      supabase.from('foreshadowings').delete().eq('project_id', projectId),
      supabase.from('world_rules').delete().eq('project_id', projectId),
      supabase.from('chapter_versions').delete().eq('project_id', projectId),
    ]);

    // [Domain:Storage] STEP 2 — Delete project row
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw new Error(`deleteProject: ${error.message}`);
  }

  // ── Chapter CRUD ────────────────────────────────────────

  async getProjectChapters(projectId: string): Promise<Chapter[]> {
    const retryAfter = chapterReadRetryAfter.get(projectId);
    if (retryAfter && retryAfter > Date.now()) {
      console.warn(
        `[OnlineStorage] getProjectChapters: skipping Supabase retry for project ${projectId}; recent read failed.`,
      );
      return [];
    }

    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');

    if (error) {
      // [Domain:Storage] Supabase/RLS read failure → return empty to allow IndexedDB fallback
      if (shouldFallbackToEmptyChapters(error)) {
        chapterReadRetryAfter.set(projectId, Date.now() + CHAPTER_READ_FAILURE_COOLDOWN_MS);
        console.warn(
          `[OnlineStorage] getProjectChapters: Supabase read failed for project ${projectId}, falling back.`,
        );
        return [];
      }
      throw new Error(`getProjectChapters: ${error.message}`);
    }

    chapterReadRetryAfter.delete(projectId);
    return (data || []).map(mapChapterRow);
  }

  async getChapter(projectId: string, chapterId: string): Promise<Chapter | null> {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', chapterId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (error || !data) return null;
    return mapChapterRow(data);
  }

  async saveChapter(projectId: string, chapter: Chapter): Promise<void> {
    const wordCount = chapter.content.trim().split(/\s+/).filter(Boolean).length;

    const { error } = await (supabase
      .from('chapters') as ReturnType<typeof supabase.from>)
      .upsert(
        {
          id: chapter.id,
          project_id: projectId,
          title: chapter.title,
          summary: chapter.summary || '',
          content: chapter.content,
          status: chapter.status,
          sort_order: (chapter.sequenceNumber ?? 1) - 1,
          word_count: wordCount,
          created_at: chapter.createdAt,
          updated_at: chapter.updatedAt,
        },
        { onConflict: 'id' }
      );

    if (error) throw new Error(`saveChapter: ${error.message}`);

    // [Domain:Storage] STEP 2 — Auto-save version
    await saveVersion(
      chapter.id,
      projectId,
      this.userId,
      chapter.content,
      chapter.title,
      chapter.summary,
    ).catch((versionError) => {
      console.warn('[OnlineStorage] Version save failed (non-fatal):', versionError);
    });
  }

  async deleteChapter(projectId: string, chapterId: string): Promise<void> {
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', chapterId)
      .eq('project_id', projectId);

    if (error) throw new Error(`deleteChapter: ${error.message}`);
  }

  async replaceProjectChapters(projectId: string, chapters: Chapter[]): Promise<void> {
    if (chapters.length === 0) {
      // [Domain:Storage] STEP 1a — Remove all chapters if empty array
      await supabase.from('chapters').delete().eq('project_id', projectId);
      return;
    }

    // [Domain:Storage] FIX P0-5 — Global write guard: NEVER overwrite cloud content with empty.
    // If ALL incoming chapters have empty content, this is almost certainly a stripped
    // snapshot from partialize or a failed hydration. Pushing it would destroy real data.
    const hasAnyContent = chapters.some((ch) => ch.content?.trim());
    if (!hasAnyContent) {
      // Check if cloud already has content for this project
      const { data: existingChapters } = await supabase
        .from('chapters')
        .select('id, content')
        .eq('project_id', projectId)
        .limit(5);

      const cloudHasContent = (existingChapters || []).some(
        (row) => (row.content as string)?.trim()
      );

      if (cloudHasContent) {
        console.warn(
          `[OnlineStorage] GUARD: Blocked replaceProjectChapters for ${projectId} — ` +
          `all ${chapters.length} incoming chapters have empty content but cloud has real data.`
        );
        return;
      }
    }

    // [Domain:Storage] STEP 1 — Upsert all chapters (consistent with saveChapter)
    const rows = chapters.map((chapter, index) => ({
      id: chapter.id,
      project_id: projectId,
      title: chapter.title,
      summary: chapter.summary || '',
      content: chapter.content,
      status: chapter.status,
      sort_order: index,
      word_count: chapter.content.trim().split(/\s+/).filter(Boolean).length,
      created_at: chapter.createdAt,
      updated_at: chapter.updatedAt,
    }));

    const { error } = await (supabase
      .from('chapters') as ReturnType<typeof supabase.from>)
      .upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`replaceProjectChapters upsert: ${error.message}`);

    // [Domain:Storage] STEP 2 — Remove orphaned chapters not in new set
    // Guard: skip orphan cleanup if keepIds is empty to avoid accidentally
    // deleting ALL chapters (some Postgres drivers interpret `.not('id','in','()')` as a full match).
    const keepIds = chapters.map((chapter) => chapter.id);
    if (keepIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from('chapters')
        .delete()
        .eq('project_id', projectId)
        .not('id', 'in', `(${keepIds.join(',')})`);

      if (cleanupError) {
        console.warn('[OnlineStorage] Orphan cleanup failed (non-fatal):', cleanupError.message);
      }
    }
  }

  // ── Version Control ─────────────────────────────────────

  async listVersions(projectId: string, chapterId?: string): Promise<VersionEntry[]> {
    if (!chapterId) {
      // Project-level versions: return latest version per chapter
      const { data } = await supabase
        .from('chapter_versions')
        .select('id, chapter_id, version_number, change_note, created_at, author_id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      return (data || []).map((row) => ({
        id: row.id,
        message: row.change_note || `Version ${row.version_number}`,
        timestamp: row.created_at || '',
        author: row.author_id || 'unknown',
        chapterId: row.chapter_id,
      }));
    }

    const versions = await listChapterVersions(chapterId);
    return versions.map((version) => ({
      id: version.id,
      message: version.change_note || `Version ${version.version_number}`,
      timestamp: version.created_at,
      author: version.author_name || version.author_id,
      chapterId,
    }));
  }

  async getVersion(_projectId: string, versionId: string): Promise<VersionSnapshot | null> {
    const version = await getChapterVersion(versionId);
    if (!version) return null;

    const chapter: Chapter = {
      id: version.chapter_id,
      title: version.title || '',
      content: version.content,
      summary: version.summary || undefined,
      status: 'draft',
      createdAt: version.created_at,
      updatedAt: version.created_at,
    };

    return {
      entry: {
        id: version.id,
        message: version.change_note || `Version ${version.version_number}`,
        timestamp: version.created_at,
        author: version.author_name || version.author_id,
      },
      chapters: [chapter],
      metadata: {},
    };
  }

  async createVersion(projectId: string, message: string): Promise<VersionEntry> {
    // [Domain:Storage] STEP 1 — Get all chapters, create version for each
    const chapters = await this.getProjectChapters(projectId);

    let lastEntry: VersionEntry | null = null;
    for (const chapter of chapters) {
      const version = await saveVersion(
        chapter.id,
        projectId,
        this.userId,
        chapter.content,
        chapter.title,
        chapter.summary,
        message,
      );
      lastEntry = {
        id: version.id,
        message: version.change_note || message,
        timestamp: version.created_at,
        author: version.author_name || version.author_id,
      };
    }

    return lastEntry || {
      id: crypto.randomUUID(),
      message,
      timestamp: new Date().toISOString(),
      author: this.userId,
    };
  }

  // ── Export / Import ─────────────────────────────────────

  async exportProject(projectId: string): Promise<ExportBundle> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

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
    return project.id;
  }
}

// ── Helpers ─────────────────────────────────────────────────

function shouldFallbackToEmptyChapters(error: { message?: string; code?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('infinite recursion')
    || message.includes('rls')
    || message.includes('policy')
    || (typeof error.status === 'number' && error.status >= 500)
  );
}

function mapChapterRow(row: Record<string, unknown>): Chapter {
  return {
    id: row.id as string,
    title: row.title as string,
    summary: (row.summary as string) || undefined,
    content: (row.content as string) || '',
    sequenceNumber: ((row.sort_order as number) || 0) + 1,
    status: (row.status as Chapter['status']) || 'draft',
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
  };
}
