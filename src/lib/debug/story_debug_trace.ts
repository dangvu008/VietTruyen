/**
 * File: story_debug_trace.ts
 * Purpose: Persistent debug timeline for AI story generation, storage, retrieval, and auth/session lifecycle.
 * Layer: Infrastructure (Debug)
 * Domain: Debug -> [AI trace, storage trace, session trace]
 */

export type StoryDebugDomain = 'ai' | 'storage' | 'auth' | 'session' | 'generation';
export type StoryDebugLevel = 'info' | 'warn' | 'error';

export interface StoryDebugEvent {
  id: string;
  timestamp: string;
  domain: StoryDebugDomain;
  action: string;
  level: StoryDebugLevel;
  summary: string;
  details?: Record<string, unknown>;
}

interface TraceOptions {
  persist?: boolean;
  console?: boolean;
}

const TRACE_STORAGE_KEY = 'viettruyen-debug-trace';
const TRACE_ENABLED_KEY = 'viettruyen-debug-enabled';
const MAX_TRACE_EVENTS = 300;
const MAX_STRING_LENGTH = 1200;
const MAX_ARRAY_LENGTH = 20;
const MAX_OBJECT_KEYS = 40;

let lifecycleTraceInstalled = false;

export function traceStoryDebugEvent(
  event: Omit<StoryDebugEvent, 'id' | 'timestamp'>,
  options: TraceOptions = {},
): StoryDebugEvent {
  // [Perf] Early exit before any allocation when debug is off
  if (!isStoryDebugEnabled()) {
    return {
      ...event,
      id: '',
      timestamp: '',
    } as StoryDebugEvent;
  }

  const entry: StoryDebugEvent = {
    ...event,
    id: createTraceId(),
    timestamp: new Date().toISOString(),
    details: sanitizeDebugValue(event.details) as Record<string, unknown> | undefined,
  };

  if (options.console !== false) {
    printDebugEvent(entry);
  }

  if (options.persist !== false) {
    persistDebugEvent(entry);
  }

  return entry;
}

export function getStoryDebugTraceEntries(): StoryDebugEvent[] {
  return readTraceEntries();
}

export function clearStoryDebugTrace(): void {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(TRACE_STORAGE_KEY);
}

export function setStoryDebugEnabled(enabled: boolean): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(TRACE_ENABLED_KEY, enabled ? 'true' : 'false');
  cachedDebugEnabled = enabled;
}

export function previewDebugText(value: string | null | undefined, maxLength = MAX_STRING_LENGTH): string {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}... [truncated ${normalized.length - maxLength} chars]`;
}

export function summarizeDebugChapters<T extends { id?: string; title?: string; content?: string; summary?: string }>(
  chapters: T[],
): Record<string, unknown> {
  const withContent = chapters.filter((chapter) => chapter.content?.trim()).length;
  const withSummary = chapters.filter((chapter) => chapter.summary?.trim()).length;
  return {
    count: chapters.length,
    withContent,
    withSummary,
    totalContentChars: chapters.reduce((total, chapter) => total + (chapter.content?.length ?? 0), 0),
    samples: chapters.slice(0, 5).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      contentChars: chapter.content?.length ?? 0,
      summaryChars: chapter.summary?.length ?? 0,
    })),
  };
}

export function installStoryDebugLifecycleTrace(): void {
  if (lifecycleTraceInstalled || typeof window === 'undefined') return;
  lifecycleTraceInstalled = true;

  traceStoryDebugEvent({
    domain: 'session',
    action: 'app.boot',
    level: 'info',
    summary: 'App booted and story debug trace is active.',
    details: {
      url: window.location.href,
      visibilityState: document.visibilityState,
      existingTraceEntries: readTraceEntries().length,
    },
  });

  window.addEventListener('pagehide', () => {
    traceStoryDebugEvent({
      domain: 'session',
      action: 'app.pagehide',
      level: 'info',
      summary: 'Page hide fired; persisted debug trace should survive close/reload.',
      details: {
        visibilityState: document.visibilityState,
        traceEntries: readTraceEntries().length,
      },
    });
  });

  window.addEventListener('beforeunload', () => {
    traceStoryDebugEvent({
      domain: 'session',
      action: 'app.beforeunload',
      level: 'info',
      summary: 'Before unload fired before app close/reload.',
      details: {
        visibilityState: document.visibilityState,
        traceEntries: readTraceEntries().length,
      },
    });
  });

  document.addEventListener('visibilitychange', () => {
    traceStoryDebugEvent({
      domain: 'session',
      action: 'app.visibilitychange',
      level: 'info',
      summary: `Document visibility changed to ${document.visibilityState}.`,
      details: {
        visibilityState: document.visibilityState,
      },
    });
  });
}

// [Perf] Cache debug-enabled flag to avoid localStorage read on every trace call
let cachedDebugEnabled: boolean | null = null;

function isStoryDebugEnabled(): boolean {
  if (cachedDebugEnabled !== null) return cachedDebugEnabled;
  if (!hasLocalStorage()) {
    cachedDebugEnabled = true;
    return true;
  }
  cachedDebugEnabled = localStorage.getItem(TRACE_ENABLED_KEY) !== 'false';
  return cachedDebugEnabled;
}

// [Perf] Batch localStorage writes to avoid N serial JSON.parse + JSON.stringify per startup
let pendingEntries: StoryDebugEvent[] = [];
let flushTimerId: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 500;

function flushPendingEntries(): void {
  if (!hasLocalStorage() || pendingEntries.length === 0) return;

  try {
    // Use the persisted-only reader to avoid double-counting pendingEntries —
    // readTraceEntries() now merges in-flight entries for external callers.
    const entries = readPersistedTraceEntries();
    entries.push(...pendingEntries);
    pendingEntries = [];
    const trimmed = entries.slice(-MAX_TRACE_EVENTS);
    localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn('[StoryDebug][storage/batch_write_failed]', error);
    pendingEntries = [];
  }
}

function persistDebugEvent(entry: StoryDebugEvent): void {
  if (!hasLocalStorage()) return;

  pendingEntries.push(entry);
  if (flushTimerId !== null) {
    clearTimeout(flushTimerId);
  }
  flushTimerId = setTimeout(flushPendingEntries, FLUSH_DELAY_MS);
}

function readTraceEntries(): StoryDebugEvent[] {
  // [Fix] Merge persisted entries with the in-flight batch so callers don't
  // observe a stale snapshot between trace() and the debounced flush. This
  // also keeps unit tests deterministic without forcing them to advance the
  // fake clock for the FLUSH_DELAY_MS timer.
  const persisted = readPersistedTraceEntries();
  if (pendingEntries.length === 0) return persisted;
  const combined = persisted.concat(pendingEntries);
  return combined.slice(-MAX_TRACE_EVENTS);
}

function readPersistedTraceEntries(): StoryDebugEvent[] {
  if (!hasLocalStorage()) return [];

  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoryDebugEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function printDebugEvent(entry: StoryDebugEvent): void {
  const label = `[StoryDebug][${entry.domain}:${entry.action}] ${entry.summary}`;
  const payload = {
    id: entry.id,
    timestamp: entry.timestamp,
    level: entry.level,
    details: entry.details,
  };

  if (entry.level === 'error') {
    console.error(label, payload);
    return;
  }

  if (entry.level === 'warn') {
    console.warn(label, payload);
    return;
  }

  console.log(label, payload);
}

function sanitizeDebugValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return previewDebugText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: previewDebugText(value.stack, 2000),
    };
  }
  if (Array.isArray(value)) {
    if (depth > 3) return `[array:${value.length}]`;
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeDebugValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth > 3) return '[object]';
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      output[key] = sanitizeDebugValue(nestedValue, depth + 1);
    }
    return output;
  }
  return String(value);
}

function createTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `debug-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasLocalStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
  );
}
