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

// ── Types ──────────────────────────────────────────────────

export interface AutosaveDraft {
  projectId: string;
  chapterId: string;
  content: string;
  title: string;
  savedAt: string;
}

interface AutosaveDraftMap {
  [compositeKey: string]: AutosaveDraft;
}

// ── Constants ──────────────────────────────────────────────

const STORAGE_KEY = 'viettruyen-autosave-drafts';
const MAX_DRAFTS_PER_PROJECT = 50;

// ── Internal helpers ───────────────────────────────────────

function compositeKey(projectId: string, chapterId: string): string {
  return `${projectId}::${chapterId}`;
}

function readAllDrafts(): AutosaveDraftMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AutosaveDraftMap;
  } catch {
    return {};
  }
}

function writeAllDrafts(map: AutosaveDraftMap): void {
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
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        console.error('[Autosave] localStorage write failed even after cleanup');
      }
    }
  }
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
  const map = readAllDrafts();
  return Object.values(map).filter((draft) => draft.projectId === projectId);
}

/**
 * Get a single draft for a specific chapter.
 */
export function getDraft(projectId: string, chapterId: string): AutosaveDraft | null {
  const map = readAllDrafts();
  return map[compositeKey(projectId, chapterId)] ?? null;
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
