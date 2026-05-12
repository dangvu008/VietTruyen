/**
 * File: autosave_draft_store.ts
 * Purpose: Pure functions to manage autosave drafts in localStorage
 * Layer: Infrastructure
 * Domain: Storage → [autosave draft persistence]
 * Deps: None (pure localStorage operations)
 *
 * Autosave drafts are SEPARATE from production data.
 * They serve as a safety net for unexpected exits.
 * When recovered, content loads into React state —
 * user must still manually save to persist officially.
 */

import { guardChapterContent } from '../chapter/chapter_content_guard';

// ── Types ──────────────────────────────────────────────────

export interface AutosaveDraft {
  projectId: string;
  chapterId: string;
  content: string;
  title: string;
  savedAt: string;
  /**
   * If set, this draft was saved mid-generation (not a user edit).
   * Used by recovery to show "Tạo dở dang" vs "Chưa lưu" UI.
   */
  generationStatus?: 'generating' | 'interrupted';
  /** Job ID when generation was in progress — correlates with store */
  generationJobId?: string;
}

interface AutosaveDraftMap {
  [compositeKey: string]: AutosaveDraft;
}

// ── Constants ──────────────────────────────────────────────

const STORAGE_KEY = 'viettruyen-autosave-drafts';
const MAX_DRAFTS_PER_PROJECT = 50;
const STREAMING_DRAFT_FLUSH_DELAY_MS = 700;

let cachedDraftMap: AutosaveDraftMap | null = null;
let pendingDraftFlushTimer: ReturnType<typeof setTimeout> | null = null;

// ── Internal helpers ───────────────────────────────────────

function compositeKey(projectId: string, chapterId: string): string {
  return `${projectId}::${chapterId}`;
}

function normalizeRecoverableDraft(draft: AutosaveDraft): AutosaveDraft | null {
  if (!draft.generationStatus) {
    return draft;
  }

  const guarded = guardChapterContent(draft.content, { allowEmptyAfterSanitize: true });
  if (!guarded.content.trim()) {
    return null;
  }

  return {
    ...draft,
    content: guarded.content,
  };
}

function readAllDrafts(): AutosaveDraftMap {
  if (cachedDraftMap) return { ...cachedDraftMap };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cachedDraftMap = raw ? JSON.parse(raw) as AutosaveDraftMap : {};
    return { ...cachedDraftMap };
  } catch {
    cachedDraftMap = {};
    return {};
  }
}

function writeAllDrafts(map: AutosaveDraftMap): void {
  cachedDraftMap = { ...map };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (error) {
    // localStorage full — cleanup oldest entries and retry
    console.warn('[Autosave] localStorage write failed, attempting cleanup:', error);
    const entries = Object.entries(map);
    if (entries.length > MAX_DRAFTS_PER_PROJECT) {
      const sorted = entries.sort(
        ([, a], [, b]) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
      );
      const trimmed = Object.fromEntries(sorted.slice(sorted.length - MAX_DRAFTS_PER_PROJECT));
      cachedDraftMap = { ...trimmed };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        console.error('[Autosave] localStorage write failed even after cleanup');
      }
    }
  }
}

function scheduleWriteAllDrafts(map: AutosaveDraftMap): void {
  cachedDraftMap = { ...map };
  if (pendingDraftFlushTimer) {
    clearTimeout(pendingDraftFlushTimer);
  }

  pendingDraftFlushTimer = setTimeout(() => {
    pendingDraftFlushTimer = null;
    writeAllDrafts(cachedDraftMap || {});
  }, STREAMING_DRAFT_FLUSH_DELAY_MS);
}

function flushPendingDraftWrite(): void {
  if (!pendingDraftFlushTimer) return;
  clearTimeout(pendingDraftFlushTimer);
  pendingDraftFlushTimer = null;
  writeAllDrafts(cachedDraftMap || {});
}

// ── Public API ─────────────────────────────────────────────

/**
 * Save a draft for a specific chapter.
 * Overwrites any existing draft for the same chapter.
 */
export function saveDraft(
  projectId: string,
  chapterId: string,
  content: string,
  title: string
): void {
  const map = readAllDrafts();
  const key = compositeKey(projectId, chapterId);
  map[key] = {
    projectId,
    chapterId,
    content,
    title,
    savedAt: new Date().toISOString(),
  };
  writeAllDrafts(map);
}

/**
 * Save a draft captured DURING AI streaming (high-frequency call).
 * Marks the draft with generationStatus='generating' so recovery
 * UI can show "Tạo dở dang" instead of the generic "Chưa lưu" banner.
 */
export function saveGeneratingDraft(
  projectId: string,
  chapterId: string,
  content: string,
  title: string,
  jobId: string
): void {
  const guarded = guardChapterContent(content, { allowEmptyAfterSanitize: true });
  const map = readAllDrafts();
  const key = compositeKey(projectId, chapterId);

  if (!guarded.content.trim()) {
    delete map[key];
    scheduleWriteAllDrafts(map);
    return;
  }

  map[key] = {
    projectId,
    chapterId,
    content: guarded.content,
    title,
    savedAt: new Date().toISOString(),
    generationStatus: 'generating',
    generationJobId: jobId,
  };
  scheduleWriteAllDrafts(map);
}

/**
 * Mark an existing generating draft as interrupted.
 * Called when scratch stream is stopped without completing.
 */
export function markDraftInterrupted(
  projectId: string,
  chapterId: string
): void {
  flushPendingDraftWrite();
  const map = readAllDrafts();
  const key = compositeKey(projectId, chapterId);
  const existing = map[key];
  if (existing && existing.generationStatus === 'generating') {
    map[key] = {
      ...existing,
      generationStatus: 'interrupted',
      savedAt: new Date().toISOString(),
    };
    writeAllDrafts(map);
  }
}

/**
 * Save multiple drafts at once (batch operation for beforeunload).
 */
export function saveDraftsBatch(
  projectId: string,
  drafts: Array<{ chapterId: string; content: string; title: string }>
): void {
  if (drafts.length === 0) return;
  const map = readAllDrafts();
  const timestamp = new Date().toISOString();
  for (const draft of drafts) {
    const key = compositeKey(projectId, draft.chapterId);
    map[key] = {
      projectId,
      chapterId: draft.chapterId,
      content: draft.content,
      title: draft.title,
      savedAt: timestamp,
    };
  }
  writeAllDrafts(map);
}

/**
 * Get all drafts for a project.
 */
export function getDrafts(projectId: string): AutosaveDraft[] {
  flushPendingDraftWrite();
  const map = readAllDrafts();
  return Object.values(map)
    .filter((draft) => draft.projectId === projectId)
    .map(normalizeRecoverableDraft)
    .filter((draft): draft is AutosaveDraft => draft !== null);
}

/**
 * Get a single draft for a specific chapter.
 */
export function getDraft(projectId: string, chapterId: string): AutosaveDraft | null {
  flushPendingDraftWrite();
  const map = readAllDrafts();
  const draft = map[compositeKey(projectId, chapterId)] ?? null;
  if (!draft) return null;
  return normalizeRecoverableDraft(draft);
}

/**
 * Remove a single draft after recovery or discard.
 */
export function clearDraft(projectId: string, chapterId: string): void {
  const map = readAllDrafts();
  delete map[compositeKey(projectId, chapterId)];
  writeAllDrafts(map);
}

/**
 * Remove all drafts for a project (discard all).
 */
export function clearAllDrafts(projectId: string): void {
  const map = readAllDrafts();
  const keysToRemove = Object.keys(map).filter((key) => key.startsWith(`${projectId}::`));
  for (const key of keysToRemove) {
    delete map[key];
  }
  writeAllDrafts(map);
}

/**
 * Check if there are any autosaved drafts for a project.
 */
export function hasUnsavedDrafts(projectId: string): boolean {
  return getDrafts(projectId).length > 0;
}
