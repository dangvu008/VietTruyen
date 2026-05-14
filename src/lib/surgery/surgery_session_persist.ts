const SESSION_PREFIX = 'vt-surgery-session:';

export interface PersistedSurgerySession {
  projectId: string;
  specId: string;
  step: 'index' | 'scan' | 'freeze' | 'rewrite';
  completedTasks: string[];
  savedAt: string;
}

export function persistSurgerySession(session: PersistedSurgerySession): void {
  try {
    localStorage.setItem(
      `${SESSION_PREFIX}${session.projectId}`,
      JSON.stringify(session),
    );
  } catch { /* non-blocking */ }
}

export function loadSurgerySession(projectId: string): PersistedSurgerySession | null {
  const raw = localStorage.getItem(`${SESSION_PREFIX}${projectId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSurgerySession;
  } catch {
    return null;
  }
}

export function clearSurgerySession(projectId: string): void {
  localStorage.removeItem(`${SESSION_PREFIX}${projectId}`);
}

export function hasOrphanedSession(projectId: string): boolean {
  return localStorage.getItem(`${SESSION_PREFIX}${projectId}`) !== null;
}

export function listAllSessions(): PersistedSurgerySession[] {
  const results: PersistedSurgerySession[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(SESSION_PREFIX)) continue;
    try {
      results.push(JSON.parse(localStorage.getItem(key)!) as PersistedSurgerySession);
    } catch { /* skip */ }
  }
  return results;
}
