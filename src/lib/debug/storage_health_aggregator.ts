/**
 * File: storage_health_aggregator.ts
 * Purpose: Aggregate storage debug trace events into health metrics for dashboard
 * Layer: Infrastructure (Debug)
 * Domain: Storage → Debug → [health metrics]
 * Deps: story_debug_trace, narrative_db
 *
 * [Step 3.4] Collects:
 * - Hydration fail count & latency p50/p95
 * - Sync fail count
 * - Provider init latency
 * - Outbox backlog size
 * - Draft count in Dexie
 */

import {
  getStoryDebugTraceEntries,
  type StoryDebugEvent,
} from './story_debug_trace';
import { narrativeDb } from '../../db/narrative_db';

// ── Types ──────────────────────────────────────────────────

export interface StorageHealthMetrics {
  /** Số lần hydration thất bại trong 24h */
  hydrationFailCount: number;
  /** Số lần metadata sync thất bại trong 24h */
  syncFailCount: number;
  /** Số lần provider init thất bại trong 24h */
  providerInitFailCount: number;
  /** Latency hydration p50 (ms) — từ start → updated */
  hydrationLatencyP50: number | null;
  /** Latency hydration p95 (ms) */
  hydrationLatencyP95: number | null;
  /** Số operations đang pending trong outbox */
  outboxBacklog: number;
  /** Số drafts đang lưu trong Dexie */
  draftCount: number;
  /** Thời điểm provider init thành công lần cuối */
  lastProviderInitAt: string | null;
  /** Thời điểm sync thành công lần cuối */
  lastSyncSuccessAt: string | null;
  /** Snapshot warning level */
  level: 'healthy' | 'degraded' | 'critical';
  /** Timestamp tính metrics */
  computedAt: string;
}

export interface HydrationSession {
  projectId: string;
  startTs: string;
  endTs?: string;
  durationMs?: number;
  success: boolean;
}

// ── Constants ──────────────────────────────────────────────

const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

// ── Core aggregation ───────────────────────────────────────

function computePercentile(sorted: number[], pct: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.max(0, Math.ceil(sorted.length * pct) - 1);
  return sorted[idx];
}

function isWithin24h(ts: string): boolean {
  return Date.now() - new Date(ts).getTime() < WINDOW_24H_MS;
}

/**
 * Aggregate debug trace events into hydration sessions.
 * Matches start → updated/no_update events by projectId within 60s.
 */
function extractHydrationSessions(events: StoryDebugEvent[]): HydrationSession[] {
  const startEvents = events.filter(
    (e) => e.action === 'project.hydrate.start' && isWithin24h(e.timestamp)
  );
  const endEvents = events.filter(
    (e) =>
      (e.action === 'project.hydrate.updated' ||
        e.action === 'project.hydrate.no_update' ||
        e.action === 'project.hydrate.stream_complete') &&
      isWithin24h(e.timestamp)
  );

  const sessions: HydrationSession[] = [];

  for (const start of startEvents) {
    const projectId = (start.details?.projectId as string | undefined) ?? 'unknown';
    const startTs = start.timestamp;

    // Find the matching end event (same projectId, within 60s after start)
    const startTime = new Date(startTs).getTime();
    const end = endEvents.find((e) => {
      const pid = (e.details?.projectId as string | undefined) ?? 'unknown';
      const endTime = new Date(e.timestamp).getTime();
      return pid === projectId && endTime >= startTime && endTime - startTime < 60_000;
    });

    if (end) {
      const durationMs = new Date(end.timestamp).getTime() - startTime;
      sessions.push({
        projectId,
        startTs,
        endTs: end.timestamp,
        durationMs,
        success: true,
      });
    } else {
      // No matching end within 60s — consider a failed/stale hydration
      sessions.push({ projectId, startTs, success: false });
    }
  }

  return sessions;
}

/** Compute health metrics from debug trace + Dexie counts. */
export async function computeStorageHealth(): Promise<StorageHealthMetrics> {
  const events = getStoryDebugTraceEntries();
  const recent = events.filter((e) => isWithin24h(e.timestamp));

  // Hydration analysis
  const sessions = extractHydrationSessions(events);
  const failedSessions = sessions.filter((s) => !s.success);
  const successDurations = sessions
    .filter((s) => s.success && s.durationMs != null)
    .map((s) => s.durationMs!)
    .sort((a, b) => a - b);

  // Sync failures
  const syncFails = recent.filter(
    (e) => e.action === 'project.metadata_sync.failed' && e.level === 'error'
  );

  // Provider init failures
  const providerFails = recent.filter(
    (e) => e.action === 'provider.init.failed' && e.level === 'error'
  );

  // Last successes
  const lastProviderInit = [...events]
    .filter((e) => e.action === 'provider.init.success')
    .pop();
  const lastSyncSuccess = [...events]
    .filter((e) => e.action === 'project.metadata_sync.success')
    .pop();

  // Dexie counts
  let outboxBacklog = 0;
  let draftCount = 0;
  try {
    outboxBacklog = await narrativeDb.outbox.count();
    draftCount = await narrativeDb.chapterDrafts.count();
  } catch { /* Dexie may not be ready — non-fatal */ }

  // Latency percentiles
  const p50 = computePercentile(successDurations, 0.5);
  const p95 = computePercentile(successDurations, 0.95);

  // Level classification
  const hydrationFailCount = failedSessions.length;
  const syncFailCount = syncFails.length;
  const providerInitFailCount = providerFails.length;

  let level: StorageHealthMetrics['level'] = 'healthy';
  if (hydrationFailCount >= 5 || syncFailCount >= 10 || outboxBacklog >= 20) {
    level = 'critical';
  } else if (hydrationFailCount >= 2 || syncFailCount >= 3 || outboxBacklog >= 5) {
    level = 'degraded';
  }

  return {
    hydrationFailCount,
    syncFailCount,
    providerInitFailCount,
    hydrationLatencyP50: p50,
    hydrationLatencyP95: p95,
    outboxBacklog,
    draftCount,
    lastProviderInitAt: lastProviderInit?.timestamp ?? null,
    lastSyncSuccessAt: lastSyncSuccess?.timestamp ?? null,
    level,
    computedAt: new Date().toISOString(),
  };
}

/** Format a duration in ms into human-readable string. */
export function formatDurationMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Format ISO timestamp relative to now. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Chưa có';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Vừa xong';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} giờ trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}
