import type { Project } from '../../types/story';

const TRASH_PREFIX = 'vt-trash-project:';
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TrashedProject {
  id: string;
  project: Project;
  trashedAt: string;
  expiresAt: string;
}

export function trashProject(project: Project): void {
  cleanExpiredProjects();
  const entry: TrashedProject = {
    id: project.id,
    project,
    trashedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TRASH_TTL_MS).toISOString(),
  };
  try {
    localStorage.setItem(`${TRASH_PREFIX}${project.id}`, JSON.stringify(entry));
  } catch {
    const items = listProjectTrash();
    if (items.length > 0) {
      const oldest = items.sort((a, b) => a.trashedAt.localeCompare(b.trashedAt))[0];
      localStorage.removeItem(`${TRASH_PREFIX}${oldest.id}`);
      try {
        localStorage.setItem(`${TRASH_PREFIX}${project.id}`, JSON.stringify(entry));
      } catch { /* give up silently */ }
    }
  }
}

export function restoreProjectFromTrash(projectId: string): TrashedProject | null {
  const raw = localStorage.getItem(`${TRASH_PREFIX}${projectId}`);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as TrashedProject;
    localStorage.removeItem(`${TRASH_PREFIX}${projectId}`);
    return entry;
  } catch {
    return null;
  }
}

export function listProjectTrash(): TrashedProject[] {
  const results: TrashedProject[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(TRASH_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key)!) as TrashedProject;
      results.push(entry);
    } catch { /* skip corrupted entries */ }
  }
  return results.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

export function permanentDeleteProject(projectId: string): void {
  localStorage.removeItem(`${TRASH_PREFIX}${projectId}`);
}

export function cleanExpiredProjects(): number {
  const now = Date.now();
  let cleaned = 0;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(TRASH_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key)!) as TrashedProject;
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

export function emptyProjectTrash(): number {
  const items = listProjectTrash();
  for (const item of items) {
    localStorage.removeItem(`${TRASH_PREFIX}${item.id}`);
  }
  return items.length;
}
