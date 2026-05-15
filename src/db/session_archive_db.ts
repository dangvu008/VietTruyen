/**
 * File: session_archive_db.ts
 * Purpose: Dexie IndexedDB database for archiving creation chat sessions
 * Layer: Infrastructure (Database)
 * Domain: SessionArchive → [creation chat history, recovery, per-project sessions]
 *
 * Separate DB from narrative-memory-db to avoid version conflicts.
 * Stores full creation chat snapshots so sessions survive reset() calls.
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  AcceptedChapter,
  CreationChatState,
  CreationMessage,
  CreationPhase,
  CreationPlotPreview,
  CreationWorkflowProgress,
} from '../types/creation_chat';
import type { BrainstormResult } from '../types/narrative_memory';

// ── Types ──────────────────────────────────────────────────

export interface ArchivedCreationSession {
  /** Session ID (matches sessionId from CreationChatState) */
  id: string;
  /** Project this session is linked to (null if unlinked) */
  projectId: string | null;
  /** When the session was archived */
  archivedAt: string;
  /** When the session was originally started */
  startedAt: string;
  /** Phase the session was in when archived */
  phase: CreationPhase;
  /** Why the session was archived */
  archiveReason: 'switch_project' | 'new_session' | 'manual' | 'auto_backup';

  // ── Display metadata (cheap to read for list views) ──
  /** First user message or project title — for display in history list */
  summary: string;
  /** Total message count */
  messageCount: number;
  /** Number of accepted chapters */
  chapterCount: number;
  /** Last workflow step completed */
  lastCompletedStep: string | null;

  // ── Full state snapshot (loaded on restore) ──
  messages: CreationMessage[];
  answers: Record<string, string>;
  currentTopicIndex: number;
  plotPreview: CreationPlotPreview | null;
  plotPreviewConfirmed: boolean;
  framework: BrainstormResult | null;
  frameworkConfirmed: boolean;
  currentChapterIndex: number;
  acceptedChapters: AcceptedChapter[];
  draftInput: string;
  progress: CreationWorkflowProgress;
}

// ── Database ───────────────────────────────────────────────

class SessionArchiveDatabase extends Dexie {
  creationSessions!: Table<ArchivedCreationSession, string>;

  constructor() {
    super('viettruyen-session-archive');

    this.version(1).stores({
      creationSessions: 'id, projectId, archivedAt, phase, archiveReason',
    });
  }
}

// ── Singleton ──────────────────────────────────────────────

export const sessionArchiveDb = new SessionArchiveDatabase();

// ── CRUD Operations ────────────────────────────────────────

function extractSessionSummary(state: CreationChatState): string {
  // Use first user message as summary, fallback to phase description
  const firstUserMsg = state.messages.find(
    (m) => m.role === 'user' && m.type === 'text' && m.content.trim(),
  );
  if (firstUserMsg) {
    return firstUserMsg.content.slice(0, 200);
  }
  return `Phiên ${state.phase} — ${state.messages.length} tin nhắn`;
}

export function snapshotFromState(
  state: CreationChatState,
  archiveReason: ArchivedCreationSession['archiveReason'],
): ArchivedCreationSession {
  return {
    id: state.sessionId,
    projectId: state.progress.linkedProjectId,
    archivedAt: new Date().toISOString(),
    startedAt: state.sessionStartedAt,
    phase: state.phase,
    archiveReason,
    summary: extractSessionSummary(state),
    messageCount: state.messages.filter((m) => m.type !== 'loading').length,
    chapterCount: state.acceptedChapters.length,
    lastCompletedStep: state.progress.lastCompletedStep,
    messages: state.messages.filter((m) => m.type !== 'loading'),
    answers: state.answers,
    currentTopicIndex: state.currentTopicIndex,
    plotPreview: state.plotPreview,
    plotPreviewConfirmed: state.plotPreviewConfirmed,
    framework: state.framework,
    frameworkConfirmed: state.frameworkConfirmed,
    currentChapterIndex: state.currentChapterIndex,
    acceptedChapters: state.acceptedChapters,
    draftInput: state.draftInput,
    progress: {
      ...state.progress,
      // Clear transient runtime flags
      batchCompose: null,
    },
  };
}

/** Archive a creation chat session to IndexedDB */
export async function archiveSession(
  session: ArchivedCreationSession,
): Promise<void> {
  await sessionArchiveDb.creationSessions.put(session);
}

/** Get all archived sessions, newest first */
export async function getAllArchivedSessions(): Promise<ArchivedCreationSession[]> {
  return sessionArchiveDb.creationSessions
    .orderBy('archivedAt')
    .reverse()
    .toArray();
}

/** Get archived sessions for a specific project, newest first */
export async function getSessionsForProject(
  projectId: string,
): Promise<ArchivedCreationSession[]> {
  return sessionArchiveDb.creationSessions
    .where('projectId')
    .equals(projectId)
    .reverse()
    .sortBy('archivedAt');
}

/** Get a single archived session by ID */
export async function getArchivedSession(
  sessionId: string,
): Promise<ArchivedCreationSession | undefined> {
  return sessionArchiveDb.creationSessions.get(sessionId);
}

/** Delete an archived session */
export async function deleteArchivedSession(
  sessionId: string,
): Promise<void> {
  await sessionArchiveDb.creationSessions.delete(sessionId);
}

/** Delete all archived sessions for a project */
export async function deleteProjectSessions(
  projectId: string,
): Promise<void> {
  await sessionArchiveDb.creationSessions
    .where('projectId')
    .equals(projectId)
    .delete();
}

/** Count archived sessions for a project */
export async function countProjectSessions(
  projectId: string,
): Promise<number> {
  return sessionArchiveDb.creationSessions
    .where('projectId')
    .equals(projectId)
    .count();
}

// ── Cleanup (keep max N sessions per project) ──────────────

const MAX_SESSIONS_PER_PROJECT = 20;

export async function pruneOldSessions(projectId: string): Promise<void> {
  const sessions = await getSessionsForProject(projectId);
  if (sessions.length <= MAX_SESSIONS_PER_PROJECT) return;

  const toDelete = sessions.slice(MAX_SESSIONS_PER_PROJECT);
  await sessionArchiveDb.creationSessions.bulkDelete(
    toDelete.map((s) => s.id),
  );
}
