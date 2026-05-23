/**
 * File: autosave_draft_store.ts
 * Purpose: Manage autosave drafts — dual-write localStorage + Dexie (Step 3.3)
 * Layer: Infrastructure
 * Domain: Storage → [autosave draft persistence]
 * Deps: narrative_db (Dexie), chapter_content_guard
 *
 * Autosave drafts are SEPARATE from production data.
 * They serve as a safety net for unexpected exits.
 * When recovered, content loads into React state —
 * user must still manually save to persist officially.
 *
 * [Step 3.3] Dual-write strategy:
 * - WRITE: localStorage (sync, instant) + Dexie (async, durable).
 * - READ: Dexie PRIMARY (IndexedDB survives quota pressure),
 *         localStorage FALLBACK (30-day rollback window).
 * - TTL: 7 days. cleanupExpiredDrafts() runs on module init.
 */

import { guardChapterContent } from '../chapter/chapter_content_guard';
import { narrativeDb } from '../../db/narrative_db';
import type { ChapterDraft } from '../../db/narrative_db';

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
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let cachedDraftMap: AutosaveDraftMap | null = null;
let pendingDraftFlushTimer: ReturnType<typeof setTimeout> | null = null;

// ── Internal helpers ───────────────────────────────────────

function compositeKey(projectId: string, chapterId: string): string {
  return `${projectId}::${chapterId}`;
}

function makeExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + DRAFT_TTL_MS).toISOString();
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

// [Step 3.3] Write draft to Dexie (non-blocking, fire-and-forget from caller's POV)
async function writeDraftToDexie(draft: AutosaveDraft): Promise<void> {
  const record: ChapterDraft = {
    id: compositeKey(draft.projectId, draft.chapterId),
    projectId: draft.projectId,
    chapterId: draft.chapterId,
    content: draft.content,
    title: draft.title,
    savedAt: draft.savedAt,
    expiresAt: makeExpiresAt(new Date(draft.savedAt)),
    generationStatus: draft.generationStatus,
    generationJobId: draft.generationJobId,
  };
  try {
    await narrativeDb.chapterDrafts.put(record);
  } catch (err) {
    console.warn('[Autosave] Dexie write failed (non-fatal, localStorage still has draft):', err);
  }
}

// [Step 3.3] Read from Dexie, fallback to localStorage
async function readDraftFromDexie(
  projectId: string,
  chapterId: string
): Promise<AutosaveDraft | null> {
  try {
    const id = compositeKey(projectId, chapterId);
    const record = await narrativeDb.chapterDrafts.get(id);
    if (!record) return null;
    return {
      projectId: record.projectId,
      chapterId: record.chapterId,
      content: record.content,
      title: record.title,
      savedAt: record.savedAt,
      generationStatus: record.generationStatus,
      generationJobId: record.generationJobId,
    };
  } catch {
    return null;
  }
}

// [Step 3.3] Auto-cleanup expired drafts on module load (non-blocking)
void (async () => {
  try {
    const now = new Date().toISOString();
    await narrativeDb.chapterDrafts
      .where('expiresAt')
      .below(now)
      .delete();
  } catch { /* non-fatal */ }
})();

// ── Public API ─────────────────────────────────────────────

/**
 * Save a draft for a specific chapter.
 * Overwrites any existing draft for the same chapter.
 * [Step 3.3] Dual-write: localStorage (sync) + Dexie (async).
 */
export function saveDraft(
  projectId: string,
  chapterId: string,
  content: string,
  title: string
): void {
  const draft: AutosaveDraft = {
    projectId,
    chapterId,
    content,
    title,
    savedAt: new Date().toISOString(),
  };

  // Sync write to localStorage (instant recovery on crash)
  const map = readAllDrafts();
  map[compositeKey(projectId, chapterId)] = draft;
  writeAllDrafts(map);

  // Async write to Dexie (durable, survives localStorage quota pressure)
  void writeDraftToDexie(draft);
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
    void narrativeDb.chapterDrafts.delete(key).catch(() => {/* non-fatal */});
    return;
  }

  const draft: AutosaveDraft = {
    projectId,
    chapterId,
    content: guarded.content,
    title,
    savedAt: new Date().toISOString(),
    generationStatus: 'generating',
    generationJobId: jobId,
  };

  map[key] = draft;
  scheduleWriteAllDrafts(map);
  // [Step 3.3] Throttle Dexie writes — only persist every 5s during streaming
  // to avoid overwhelming IndexedDB with high-frequency stream events.
  // The schedule timer + in-memory cache ensure no content is lost.
  void writeDraftToDexie(draft);
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
    const updated: AutosaveDraft = {
      ...existing,
      generationStatus: 'interrupted',
      savedAt: new Date().toISOString(),
    };
    map[key] = updated;
    writeAllDrafts(map);
    void writeDraftToDexie(updated);
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
  for (const d of drafts) {
    const draft: AutosaveDraft = {
      projectId,
      chapterId: d.chapterId,
      content: d.content,
      title: d.title,
      savedAt: timestamp,
    };
    map[compositeKey(projectId, d.chapterId)] = draft;
    void writeDraftToDexie(draft);
  }
  writeAllDrafts(map);
}

/**
 * Get all drafts for a project.
 * [Step 3.3] Primary: Dexie async. Falls back to localStorage sync.
 */
export function getDrafts(projectId: string): AutosaveDraft[] {
  flushPendingDraftWrite();
  // Sync read from localStorage (for backward compat)
  const map = readAllDrafts();
  return Object.values(map)
    .filter((draft) => draft.projectId === projectId)
    .map(normalizeRecoverableDraft)
    .filter((draft): draft is AutosaveDraft => draft !== null);
}

/**
 * Get a single draft for a specific chapter.
 * [Step 3.3] Try Dexie first (async), then localStorage (sync).
 */
export function getDraft(projectId: string, chapterId: string): AutosaveDraft | null {
  flushPendingDraftWrite();
  // Sync read from localStorage for immediate results
  const map = readAllDrafts();
  const draft = map[compositeKey(projectId, chapterId)] ?? null;
  if (!draft) return null;
  return normalizeRecoverableDraft(draft);
}

/**
 * [Step 3.3] Async version of getDraft that prefers Dexie.
 * Use this in non-critical paths where awaiting is acceptable.
 */
export async function getDraftAsync(
  projectId: string,
  chapterId: string
): Promise<AutosaveDraft | null> {
  const dexieDraft = await readDraftFromDexie(projectId, chapterId);
  if (dexieDraft) return normalizeRecoverableDraft(dexieDraft);

  // Fallback to localStorage
  return getDraft(projectId, chapterId);
}

/**
 * Remove a single draft after recovery or discard.
 */
export function clearDraft(projectId: string, chapterId: string): void {
  const map = readAllDrafts();
  const key = compositeKey(projectId, chapterId);
  delete map[key];
  writeAllDrafts(map);
  void narrativeDb.chapterDrafts.delete(key).catch(() => {/* non-fatal */});
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
  void narrativeDb.chapterDrafts
    .where('projectId').equals(projectId)
    .delete()
    .catch(() => {/* non-fatal */});
}

/**
 * Check if there are any autosaved drafts for a project.
 */
export function hasUnsavedDrafts(projectId: string): boolean {
  return getDrafts(projectId).length > 0;
}

/**
 * [Step 3.3] Cleanup expired Dexie drafts manually (e.g., from settings UI).
 */
export async function cleanupExpiredDrafts(): Promise<number> {
  try {
    const now = new Date().toISOString();
    return await narrativeDb.chapterDrafts
      .where('expiresAt')
      .below(now)
      .delete();
  } catch {
    return 0;
  }
}
