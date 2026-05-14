import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { PersistedSurgerySession } from './surgery_session_persist';

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

function makeSession(projectId = 'proj-1'): PersistedSurgerySession {
  return {
    projectId,
    specId: 'spec-1',
    step: 'scan',
    completedTasks: ['task-1'],
    savedAt: new Date().toISOString(),
  };
}

describe('surgery_session_persist', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    vi.resetModules();
  });

  it('persists and loads a session', async () => {
    const { persistSurgerySession, loadSurgerySession } = await import('./surgery_session_persist');
    const session = makeSession();
    persistSurgerySession(session);

    const loaded = loadSurgerySession('proj-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.specId).toBe('spec-1');
    expect(loaded!.step).toBe('scan');
  });

  it('returns null for missing session', async () => {
    const { loadSurgerySession } = await import('./surgery_session_persist');
    expect(loadSurgerySession('nonexistent')).toBeNull();
  });

  it('detects orphaned sessions', async () => {
    const { persistSurgerySession, hasOrphanedSession } = await import('./surgery_session_persist');
    expect(hasOrphanedSession('proj-1')).toBe(false);
    persistSurgerySession(makeSession());
    expect(hasOrphanedSession('proj-1')).toBe(true);
  });

  it('clears a session', async () => {
    const { persistSurgerySession, clearSurgerySession, hasOrphanedSession } = await import('./surgery_session_persist');
    persistSurgerySession(makeSession());
    clearSurgerySession('proj-1');
    expect(hasOrphanedSession('proj-1')).toBe(false);
  });

  it('lists all sessions', async () => {
    const { persistSurgerySession, listAllSessions } = await import('./surgery_session_persist');
    persistSurgerySession(makeSession('proj-1'));
    persistSurgerySession(makeSession('proj-2'));
    expect(listAllSessions()).toHaveLength(2);
  });
});
