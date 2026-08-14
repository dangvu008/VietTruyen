import type { Chapter } from '../../types/story';
import type { ChapterSummary, Scene } from '../../types/chapter_summary';
import {
  auditNarrativeEntropy,
  shouldRunNarrativeEntropyAudit,
  type EntropyChapterSample,
  type NarrativeEntropyIssue,
} from './narrative_entropy_audit';

export interface NarrativeEntropyReport {
  projectId: string;
  chapterIndex: number;
  issues: NarrativeEntropyIssue[];
  sampleCount: number;
  createdAt: string;
}

export interface NarrativeEntropyRuntimeState {
  samples: EntropyChapterSample[];
  reports: NarrativeEntropyReport[];
}

const MEMORY_FALLBACK = new Map<string, NarrativeEntropyRuntimeState>();
const MAX_SAMPLES = 200;
const MAX_REPORTS = 20;

function bucket(value: number, step: number, cap = 999): number {
  return Math.min(cap, Math.max(0, Math.round(value / step) * step));
}

function buildProseSignature(content: string): string {
  const text = String(content || '').trim();
  if (!text) return '';
  const sentences = text.split(/(?<=[.!?…])\s+/).map((item) => item.trim()).filter(Boolean);
  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const avgSentence = sentences.length > 0
    ? sentences.reduce((sum, item) => sum + item.length, 0) / sentences.length
    : text.length;
  const dialogueLike = sentences.filter((item) => /^(?:[“"'—-]|[^:]{1,30}:)/.test(item)).length;
  const dialogueRatio = sentences.length > 0 ? dialogueLike / sentences.length : 0;
  return [
    `sent:${bucket(avgSentence, 10, 120)}`,
    `para:${bucket(paragraphs.length, 2, 40)}`,
    `dlg:${bucket(dialogueRatio * 10, 2, 10)}`,
  ].join('|');
}

export function buildEntropySample(input: {
  chapter: Chapter;
  summary: ChapterSummary;
  scenes: Scene[];
  unresolvedHookCount: number;
}): EntropyChapterSample {
  const chapterIndex = input.chapter.sequenceNumber ?? 0;
  const stateBucket = Math.min(6, input.summary.state_changes?.length ?? 0);
  const sceneBucket = Math.min(8, input.scenes.length);
  return {
    chapterIndex,
    plotSignature: [
      input.summary.strand_dominant || 'unknown',
      input.summary.hook?.type || 'none',
      `state:${stateBucket}`,
      `scenes:${sceneBucket}`,
    ].join('|'),
    proseSignature: buildProseSignature(input.chapter.content || ''),
    unresolvedHookCount: input.unresolvedHookCount,
  };
}

export function updateEntropyRuntimeState(input: {
  projectId: string;
  state: NarrativeEntropyRuntimeState;
  sample: EntropyChapterSample;
}): { state: NarrativeEntropyRuntimeState; report: NarrativeEntropyReport | null } {
  const samples = [
    ...input.state.samples.filter((item) => item.chapterIndex !== input.sample.chapterIndex),
    input.sample,
  ]
    .sort((a, b) => a.chapterIndex - b.chapterIndex)
    .slice(-MAX_SAMPLES);
  const lastReport = input.state.reports[input.state.reports.length - 1];
  const shouldAudit = shouldRunNarrativeEntropyAudit({
    acceptedChapterIndex: input.sample.chapterIndex,
    lastAuditChapterIndex: lastReport?.chapterIndex,
    unresolvedHookCount: input.sample.unresolvedHookCount,
  });

  if (!shouldAudit) {
    return { state: { samples, reports: input.state.reports.slice(-MAX_REPORTS) }, report: null };
  }

  const issues = auditNarrativeEntropy(samples.slice(-80));
  const report: NarrativeEntropyReport = {
    projectId: input.projectId,
    chapterIndex: input.sample.chapterIndex,
    issues,
    sampleCount: Math.min(80, samples.length),
    createdAt: new Date().toISOString(),
  };
  return {
    state: {
      samples,
      reports: [...input.state.reports, report].slice(-MAX_REPORTS),
    },
    report,
  };
}

function storageKey(projectId: string): string {
  return `viettruyen:narrative-entropy:${projectId}`;
}

function readState(projectId: string): NarrativeEntropyRuntimeState {
  if (typeof localStorage === 'undefined') {
    return MEMORY_FALLBACK.get(projectId) ?? { samples: [], reports: [] };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(projectId)) || '{}') as Partial<NarrativeEntropyRuntimeState>;
    return {
      samples: Array.isArray(parsed.samples) ? parsed.samples : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    };
  } catch {
    return { samples: [], reports: [] };
  }
}

function writeState(projectId: string, state: NarrativeEntropyRuntimeState): void {
  if (typeof localStorage === 'undefined') {
    MEMORY_FALLBACK.set(projectId, state);
    return;
  }
  localStorage.setItem(storageKey(projectId), JSON.stringify(state));
}

/**
 * Cheap accepted-chapter hook. It records a compact sample every accepted
 * chapter but only runs the long-range audit at cadence/hook-pressure points.
 * Reports are operational cache, not Canon.
 */
export function recordAcceptedChapterEntropy(input: {
  projectId: string;
  chapter: Chapter;
  summary: ChapterSummary;
  scenes: Scene[];
  unresolvedHookCount: number;
}): NarrativeEntropyReport | null {
  const sample = buildEntropySample(input);
  const updated = updateEntropyRuntimeState({
    projectId: input.projectId,
    state: readState(input.projectId),
    sample,
  });
  writeState(input.projectId, updated.state);
  return updated.report;
}

export function getNarrativeEntropyReports(projectId: string): NarrativeEntropyReport[] {
  return readState(projectId).reports;
}
