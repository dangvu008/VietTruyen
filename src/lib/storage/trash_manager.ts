import type { Chapter } from '../../types/story';

const TRASH_PREFIX = 'vt-trash:';
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TrashedChapter {
  id: string;
  projectId: string;
  chapter: Chapter;
  trashedAt: string;
  expiresAt: string;
}

export function trashChapter(projectId: string, chapter: Chapter): void {
  cleanExpired();
  const entry: TrashedChapter = {
    id: chapter.id,
    projectId,
    chapter,
    trashedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TRASH_TTL_MS).toISOString(),
  };
  try {
    localStorage.setItem(`${TRASH_PREFIX}${chapter.id}`, JSON.stringify(entry));
  } catch {
    // Storage full — try removing oldest trashed item first
    const items = listTrash();
    if (items.length > 0) {
      const oldest = items.sort((a, b) => a.trashedAt.localeCompare(b.trashedAt))[0];
      localStorage.removeItem(`${TRASH_PREFIX}${oldest.id}`);
      try {
        localStorage.setItem(`${TRASH_PREFIX}${chapter.id}`, JSON.stringify(entry));
      } catch { /* give up silently */ }
    }
  }
}

export function restoreFromTrash(chapterId: string): TrashedChapter | null {
  const raw = localStorage.getItem(`${TRASH_PREFIX}${chapterId}`);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as TrashedChapter;
    localStorage.removeItem(`${TRASH_PREFIX}${chapterId}`);
    return entry;
  } catch {
    return null;
  }
}

export function listTrash(projectId?: string): TrashedChapter[] {
  const results: TrashedChapter[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(TRASH_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key)!) as TrashedChapter;
      if (projectId && entry.projectId !== projectId) continue;
      results.push(entry);
    } catch { /* skip corrupted entries */ }
  }
  return results.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

export function permanentDelete(chapterId: string): void {
  localStorage.removeItem(`${TRASH_PREFIX}${chapterId}`);
}

export function cleanExpired(): number {
  const now = Date.now();
  let cleaned = 0;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(TRASH_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key)!) as TrashedChapter;
      if (new Date(entry.expiresAt).getTime() <= now) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key!);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
    cleaned++;
  }
  return cleaned;
}

export function emptyTrash(projectId?: string): number {
  const items = listTrash(projectId);
  for (const item of items) {
    localStorage.removeItem(`${TRASH_PREFIX}${item.id}`);
  }
  return items.length;
}
