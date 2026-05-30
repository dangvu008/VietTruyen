/**
 * File: use_adaptation_studio_store.ts
 * Purpose: Zustand store cho Adaptation Studio — state management cho 3 tracks
 * Layer: Store
 * Domain: AdaptationStudio → [glossary, scan, terminology, tracks]
 */

import { create } from 'zustand';
import { narrativeDb } from '../db/narrative_db';
import type {
  AdaptationGlossary,
  AdaptationScanIssue,
  AdaptationTrackId,
  SourceDnaResult,
  TerminologyGroup,
} from '../types/adaptation_studio';
import { scanChapters } from '../lib/adaptation/batch_scanner';
import {
  buildTerminologyGroups,
  type ChapterText,
} from '../lib/adaptation/terminology_synchronizer';

interface AdaptationStudioState {
  activeTrack: AdaptationTrackId;

  // Track 1: Translation
  glossaries: AdaptationGlossary[];
  terminologyGroups: TerminologyGroup[];
  scanIssues: AdaptationScanIssue[];
  isScanning: boolean;

  // Track 2: Deep Edit
  healthScores: Record<string, number>;
  issuesByChapter: Record<string, AdaptationScanIssue[]>;

  // Track 3: Phóng Tác
  sourceDna: SourceDnaResult | null;
  divergenceLevel: number;

  // Shared
  tokenBudget: number;
  tokensUsedThisSession: number;

  // Actions
  setActiveTrack: (track: AdaptationTrackId) => void;
  loadGlossaries: (projectId: string) => Promise<void>;
  addGlossary: (entry: AdaptationGlossary) => Promise<void>;
  updateGlossary: (id: string, patch: Partial<AdaptationGlossary>) => Promise<void>;
  removeGlossary: (id: string) => Promise<void>;
  runBatchScan: (projectId: string, chapters: ChapterText[]) => Promise<void>;
  dismissIssue: (issueId: string) => void;
  fixIssue: (issueId: string) => void;
  refreshTerminologyGroups: () => void;
  setTokenBudget: (budget: number) => void;
  setDivergenceLevel: (level: number) => void;
}

export const useAdaptationStudioStore = create<AdaptationStudioState>((set, get) => ({
  activeTrack: 'translation',

  glossaries: [],
  terminologyGroups: [],
  scanIssues: [],
  isScanning: false,

  healthScores: {},
  issuesByChapter: {},

  sourceDna: null,
  divergenceLevel: 50,

  tokenBudget: 100000,
  tokensUsedThisSession: 0,

  setActiveTrack: (track) => set({ activeTrack: track }),

  loadGlossaries: async (projectId) => {
    const glossaries = await narrativeDb.adaptationGlossaries
      .where('projectId')
      .equals(projectId)
      .toArray();
    const groups = buildTerminologyGroups(glossaries);
    set({ glossaries, terminologyGroups: groups });
  },

  addGlossary: async (entry) => {
    await narrativeDb.adaptationGlossaries.put(entry);
    const glossaries = [...get().glossaries, entry];
    set({ glossaries, terminologyGroups: buildTerminologyGroups(glossaries) });
  },

  updateGlossary: async (id, patch) => {
    await narrativeDb.adaptationGlossaries.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    const glossaries = get().glossaries.map((g) =>
      g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g
    );
    set({ glossaries, terminologyGroups: buildTerminologyGroups(glossaries) });
  },

  removeGlossary: async (id) => {
    await narrativeDb.adaptationGlossaries.delete(id);
    const glossaries = get().glossaries.filter((g) => g.id !== id);
    set({ glossaries, terminologyGroups: buildTerminologyGroups(glossaries) });
  },

  runBatchScan: async (projectId, chapters) => {
    set({ isScanning: true });
    try {
      const { glossaries } = get();
      const issues = scanChapters(projectId, chapters, glossaries);

      const issuesByChapter: Record<string, AdaptationScanIssue[]> = {};
      for (const issue of issues) {
        if (!issuesByChapter[issue.chapterId]) {
          issuesByChapter[issue.chapterId] = [];
        }
        issuesByChapter[issue.chapterId].push(issue);
      }

      await narrativeDb.adaptationScanResults
        .where('projectId')
        .equals(projectId)
        .delete();
      if (issues.length > 0) {
        await narrativeDb.adaptationScanResults.bulkPut(issues);
      }

      set({ scanIssues: issues, issuesByChapter, isScanning: false });
    } catch {
      set({ isScanning: false });
    }
  },

  dismissIssue: (issueId) => {
    const scanIssues = get().scanIssues.map((i) =>
      i.id === issueId ? { ...i, status: 'dismissed' as const } : i
    );
    set({ scanIssues });
    void narrativeDb.adaptationScanResults.update(issueId, { status: 'dismissed' });
  },

  fixIssue: (issueId) => {
    const scanIssues = get().scanIssues.map((i) =>
      i.id === issueId ? { ...i, status: 'fixed' as const } : i
    );
    set({ scanIssues });
    void narrativeDb.adaptationScanResults.update(issueId, { status: 'fixed' });
  },

  refreshTerminologyGroups: () => {
    const groups = buildTerminologyGroups(get().glossaries);
    set({ terminologyGroups: groups });
  },

  setTokenBudget: (budget) => set({ tokenBudget: budget }),
  setDivergenceLevel: (level) => set({ divergenceLevel: level }),
}));
