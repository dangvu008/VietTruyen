/**
 * File: session_archiver.ts
 * Purpose: Archive/restore creation chat sessions — prevents data loss on reset()
 * Layer: Application Logic
 * Domain: SessionArchive → [archive before reset, restore from history, recovery detection]
 *
 * Key invariant: archiveAndReset() MUST be called instead of raw reset()
 * everywhere the creation chat store needs to start fresh.
 */

import type { CreationChatState } from '../../types/creation_chat';
import {
  archiveSession,
  getArchivedSession,
  getSessionsForProject,
  getAllArchivedSessions,
  pruneOldSessions,
  snapshotFromState,
  type ArchivedCreationSession,
} from '../../db/session_archive_db';

// ── Archive ────────────────────────────────────────────────

/** Minimum message count to warrant archiving (skip empty sessions) */
const MIN_ARCHIVABLE_MESSAGES = 1;

function isWorthArchiving(state: CreationChatState): boolean {
  const meaningfulMessages = state.messages.filter(
    (m) => m.type !== 'loading' && m.content.trim(),
  );
  return meaningfulMessages.length >= MIN_ARCHIVABLE_MESSAGES;
}

/**
 * Archive the current creation chat state before resetting.
 * Returns true if archived, false if skipped (empty session).
 */
export async function archiveCurrentSession(
  state: CreationChatState,
  reason: ArchivedCreationSession['archiveReason'],
): Promise<boolean> {
  if (!isWorthArchiving(state)) return false;

  const snapshot = snapshotFromState(state, reason);
  await archiveSession(snapshot);

  // Prune old sessions if linked to a project
  if (snapshot.projectId) {
    await pruneOldSessions(snapshot.projectId).catch((err) => {
      console.warn('[SessionArchiver] Prune failed:', err);
    });
  }

  return true;
}

// ── Restore ────────────────────────────────────────────────

/**
 * Build a partial CreationChatState from an archived session.
 * Caller should use this to feed into the store's restore action.
 */
export function buildRestorePayload(
  archived: ArchivedCreationSession,
): Omit<CreationChatState, 'isAiWorking' | 'isBatchComposing' | 'error'> {
  return {
    sessionId: archived.id,
    sessionStartedAt: archived.startedAt,
    phase: archived.phase,
    messages: archived.messages,
    currentTopicIndex: archived.currentTopicIndex,
    answers: archived.answers,
    plotPreview: archived.plotPreview,
    plotPreviewConfirmed: archived.plotPreviewConfirmed,
    framework: archived.framework,
    frameworkConfirmed: archived.frameworkConfirmed,
    currentChapterIndex: archived.currentChapterIndex,
    acceptedChapters: archived.acceptedChapters,
    draftInput: archived.draftInput,
    draftSavedAt: archived.archivedAt,
    progress: {
      ...archived.progress,
      // Mark as interrupted since we're restoring from archive
      status: archived.progress.status === 'running' ? 'interrupted' : archived.progress.status,
      detail: archived.progress.status === 'running'
        ? `Phiên trước bị gián đoạn. Đã khôi phục từ lịch sử.`
        : archived.progress.detail,
    },
  };
}

// ── Query ──────────────────────────────────────────────────

export { getSessionsForProject, getAllArchivedSessions, getArchivedSession };

/**
 * Find the most recent archived session for a project.
 * Useful for "resume" prompts.
 */
export async function getLatestSessionForProject(
  projectId: string,
): Promise<ArchivedCreationSession | null> {
  const sessions = await getSessionsForProject(projectId);
  return sessions[0] ?? null;
}

/**
 * Check if there's a recoverable session for any project.
 * A session is "recoverable" if it was interrupted or has meaningful progress.
 */
export async function findRecoverableSessions(): Promise<ArchivedCreationSession[]> {
  const all = await getAllArchivedSessions();
  return all.filter(
    (s) =>
      s.progress.status === 'interrupted' ||
      s.progress.status === 'running' ||
      s.chapterCount > 0 ||
      s.frameworkConfirmed,
  );
}
