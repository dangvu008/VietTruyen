/**
 * File: EditorStatusBar.tsx
 * Purpose: Bottom status bar showing session timer, word progress, sync state, and reading stats
 * Layer: UI
 * Domain: StoryEditor → Session Tracking
 * Deps: None (pure presentational)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, CloudOff, FileText, Save } from 'lucide-react';
import type { AutosaveStatus } from '../../hooks/use_autosave';
import type { ProjectStorageMode, ProjectSyncStatus } from '../../types/story';

interface Props {
  wordCount: number;
  wordsAdded: number;
  readingTimeMinutes: number;
  lastSavedAt: string | null;
  isSyncing: boolean;
  sessionStartTime: number;
  autosaveStatus?: AutosaveStatus;
  lastAutosaveAt?: string | null;
  storageMode?: ProjectStorageMode;
  syncStatus?: ProjectSyncStatus;
}

function formatElapsed(startMs: number, nowMs: number): string {
  const totalSec = Math.floor((nowMs - startMs) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}H ${String(minutes).padStart(2, '0')}M`;
  return `${minutes}M`;
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

export const EditorStatusBar: React.FC<Props> = ({
  wordCount: _wordCount,
  wordsAdded,
  readingTimeMinutes: _readingTimeMinutes,
  lastSavedAt: _lastSavedAt,
  isSyncing,
  sessionStartTime,
  autosaveStatus = 'idle',
  lastAutosaveAt,
  storageMode = 'inline',
  syncStatus = 'idle',
}) => {
  // [Domain:StoryEditor] STEP 1 — Live session timer updates every 30s
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = useMemo(
    () => formatElapsed(sessionStartTime, now),
    [sessionStartTime, now],
  );

  // [Domain:StoryEditor] STEP 2 — Autosave status indicator
  const autosaveIndicator = useMemo(() => {
    switch (autosaveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1.5 text-accent-amber">
            <Save className="h-3 w-3 animate-pulse" />
            <span>AUTOSAVING...</span>
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1.5 text-emerald-400/80">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            <span>AUTOSAVED {lastAutosaveAt ? formatTime(lastAutosaveAt) : ''}</span>
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-red-400/80">
            <div className="h-1.5 w-1.5 rounded-full bg-red-400/80" />
            <span>AUTOSAVE FAILED</span>
          </span>
        );
      default:
        return null;
    }
  }, [autosaveStatus, lastAutosaveAt]);

  const storageIndicator = useMemo(() => {
    if (storageMode === 'cloud' || storageMode === 'provider') {
      return {
        label: syncStatus === 'error' ? 'CLOUD ERROR' : 'CLOUD',
        icon: Cloud,
        className: syncStatus === 'error' ? 'text-red-400/80' : 'text-sky-300/80',
      };
    }
    if (storageMode === 'local' || storageMode === 'indexeddb') {
      return {
        label: storageMode === 'indexeddb' ? 'LOCAL CACHE' : 'LOCAL',
        icon: CloudOff,
        className: 'text-emerald-300/80',
      };
    }
    return {
      label: 'LOCAL CACHE',
      icon: FileText,
      className: 'text-[#8f7f73]',
    };
  }, [storageMode, syncStatus]);

  const StorageIcon = storageIndicator.icon;

  return (
    <div className="flex items-center justify-between border-t border-white/5 bg-[#0c0b0a] px-6 py-2 text-[11px] uppercase tracking-[0.15em]">
      <div className="flex items-center gap-6 text-[#8f7f73]">
        <span className="flex items-center gap-1.5">
          SESSION: {elapsed}
        </span>
        <span className="flex items-center gap-1.5">
          WORDS ADDED: {wordsAdded.toLocaleString()}
        </span>
      </div>

      {/* Right side: Autosave + Sync state */}
      <div className="flex items-center gap-4 text-[#8f7f73] font-medium">
        {autosaveIndicator}
        <span className={`flex items-center gap-1.5 ${storageIndicator.className}`}>
          <StorageIcon className="h-3 w-3" />
          <span>{storageIndicator.label}</span>
        </span>
        {isSyncing ? (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-accent-amber animate-pulse" />
            <span className="text-accent-amber">SYNCING...</span>
          </>
        ) : (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-[#8f7f73]" />
            <span className="text-[#8f7f73]">SYNCED</span>
          </>
        )}
      </div>
    </div>
  );
};
