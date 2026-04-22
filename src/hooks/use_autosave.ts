/**
 * File: use_autosave.ts
 * Purpose: Periodic autosave hook — flushes dirty editor content to localStorage drafts
 * Layer: Application (React Hook)
 * Domain: StoryEditor → [autosave lifecycle]
 * Deps: autosave_draft_store
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  saveDraft,
  clearDraft,
} from '../lib/storage/autosave_draft_store';
import type { Chapter } from '../types/story';

// ── Types ──────────────────────────────────────────────────

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  /** Project ID for scoping drafts */
  projectId: string;
  /** Currently active chapter */
  activeChapter: Chapter | null;
  /** Active chapter ID */
  activeChapterId: string | null;
  /** Local (dirty) content map */
  localContents: Record<string, string>;
  /** Local (dirty) title map */
  localTitles: Record<string, string>;
  /** Interval in milliseconds (default: 30000 = 30s) */
  intervalMs?: number;
}

interface UseAutosaveReturn {
  /** Current autosave status */
  status: AutosaveStatus;
  /** ISO timestamp of last autosave */
  lastAutosaveAt: string | null;
  /** Manually trigger an autosave (e.g., on beforeunload) */
  flushNow: () => void;
  /** Clear draft for a chapter (after manual save) */
  clearChapterDraft: (chapterId: string) => void;
}

// ── Constants ──────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 30_000;
const STATUS_RESET_DELAY_MS = 5_000;

// ── Hook ───────────────────────────────────────────────────

export function useAutosave({
  projectId,
  activeChapter,
  activeChapterId,
  localContents,
  localTitles,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);

  // [Domain:StoryEditor] STEP 1 — Refs to hold latest values without re-triggering effect
  const latestContentsRef = useRef(localContents);
  const latestTitlesRef = useRef(localTitles);
  const latestChapterRef = useRef(activeChapter);
  const latestChapterIdRef = useRef(activeChapterId);

  latestContentsRef.current = localContents;
  latestTitlesRef.current = localTitles;
  latestChapterRef.current = activeChapter;
  latestChapterIdRef.current = activeChapterId;

  // [Domain:StoryEditor] STEP 2 — Core flush function
  const flushNow = useCallback(() => {
    const contents = latestContentsRef.current;
    const titles = latestTitlesRef.current;
    const chapterId = latestChapterIdRef.current;
    const chapter = latestChapterRef.current;

    if (!chapterId || !chapter) return;

    // Check if active chapter has unsaved changes
    const contentChanged = chapterId in contents && contents[chapterId] !== chapter.content;
    const titleChanged = chapterId in titles && titles[chapterId] !== chapter.title;

    if (!contentChanged && !titleChanged) return;

    try {
      setStatus('saving');
      saveDraft(
        projectId,
        chapterId,
        contents[chapterId] ?? chapter.content ?? '',
        titles[chapterId] ?? chapter.title ?? ''
      );
      const timestamp = new Date().toISOString();
      setLastAutosaveAt(timestamp);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [projectId]);

  // [Domain:StoryEditor] STEP 3 — Periodic autosave interval
  useEffect(() => {
    if (!projectId) return;

    const timer = setInterval(() => {
      flushNow();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [projectId, intervalMs, flushNow]);

  // [Domain:StoryEditor] STEP 4 — Reset status to idle after showing 'saved'/'error'
  useEffect(() => {
    if (status === 'saved' || status === 'error') {
      const timer = setTimeout(() => setStatus('idle'), STATUS_RESET_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // [Domain:StoryEditor] STEP 5 — Clear draft helper (called after manual save)
  const clearChapterDraft = useCallback(
    (chapterId: string) => {
      clearDraft(projectId, chapterId);
    },
    [projectId]
  );

  return {
    status,
    lastAutosaveAt,
    flushNow,
    clearChapterDraft,
  };
}
