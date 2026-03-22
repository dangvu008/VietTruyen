/**
 * File: use_style_store.ts
 * Purpose: Zustand store quản lý Style Learning Engine state
 * Layer: Store
 * Domain: StyleLearning → [corrections management, rules synthesis, analysis state]
 *
 * Data Contract:
 * - Input:  UI actions (analyze, accept, reject, synthesize)
 * - Output: State updates → re-render StyleFeedbackPanel
 * - Side effects: Read/write IndexedDB via narrative_db helpers
 */
import { create } from 'zustand';
import { analyzeChapterStyle } from '../lib/ai/style_analyzer';
import { synthesizeRules, buildStyleGuideSection } from '../lib/ai/style_learner';
import {
  storeCorrections,
  getProjectCorrections,
  getChapterCorrections,
  updateCorrectionStatus,
  storeRules,
  getProjectRules,
} from '../db/narrative_db';
import type { Project, Chapter } from '../types/story';
import type {
  StyleCorrection,
  StyleRule,
  StyleAnalysisResult,
} from '../types/style_learning';

interface StyleState {
  // State
  corrections: StyleCorrection[];
  rules: StyleRule[];
  analysisResult: StyleAnalysisResult | null;
  isAnalyzing: boolean;
  isSynthesizing: boolean;
  error: string | null;

  // Actions
  analyzeChapter: (chapter: Chapter, project: Project) => Promise<void>;
  acceptCorrection: (id: string) => Promise<void>;
  rejectCorrection: (id: string) => Promise<void>;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  synthesizeFromAccepted: (projectId: string) => Promise<void>;
  loadProjectRules: (projectId: string) => Promise<void>;
  loadChapterCorrections: (projectId: string, chapterId: string) => Promise<void>;
  getStyleGuide: () => string;
  clearAnalysis: () => void;
}

export const useStyleStore = create<StyleState>()((set, get) => ({
  corrections: [],
  rules: [],
  analysisResult: null,
  isAnalyzing: false,
  isSynthesizing: false,
  error: null,

  analyzeChapter: async (chapter, project) => {
    set({ isAnalyzing: true, error: null, analysisResult: null });
    try {
      // Load existing rules for context-aware analysis
      const existingRules = await getProjectRules(project.id);

      const result = await analyzeChapterStyle({
        chapterContent: chapter.content,
        chapterId: chapter.id,
        project,
        existingRules,
      });

      // Persist corrections to IndexedDB
      if (result.corrections.length > 0) {
        await storeCorrections(result.corrections);
      }

      set({
        corrections: result.corrections,
        rules: existingRules,
        analysisResult: result,
        isAnalyzing: false,
      });
    } catch (err) {
      set({
        isAnalyzing: false,
        error: err instanceof Error ? err.message : 'Lỗi phân tích văn phong',
      });
    }
  },

  acceptCorrection: async (id) => {
    await updateCorrectionStatus(id, 'accepted');
    set((state) => ({
      corrections: state.corrections.map((c) =>
        c.id === id ? { ...c, status: 'accepted' as const } : c
      ),
    }));
  },

  rejectCorrection: async (id) => {
    await updateCorrectionStatus(id, 'rejected');
    set((state) => ({
      corrections: state.corrections.map((c) =>
        c.id === id ? { ...c, status: 'rejected' as const } : c
      ),
    }));
  },

  acceptAll: async () => {
    const { corrections } = get();
    const pending = corrections.filter((c) => c.status === 'pending');
    for (const c of pending) {
      await updateCorrectionStatus(c.id, 'accepted');
    }
    set((state) => ({
      corrections: state.corrections.map((c) =>
        c.status === 'pending' ? { ...c, status: 'accepted' as const } : c
      ),
    }));
  },

  rejectAll: async () => {
    const { corrections } = get();
    const pending = corrections.filter((c) => c.status === 'pending');
    for (const c of pending) {
      await updateCorrectionStatus(c.id, 'rejected');
    }
    set((state) => ({
      corrections: state.corrections.map((c) =>
        c.status === 'pending' ? { ...c, status: 'rejected' as const } : c
      ),
    }));
  },

  synthesizeFromAccepted: async (projectId) => {
    set({ isSynthesizing: true, error: null });
    try {
      const accepted = await getProjectCorrections(projectId, 'accepted');
      const existing = await getProjectRules(projectId);

      const newRules = await synthesizeRules(accepted, existing, projectId);

      // Persist rules to IndexedDB
      await storeRules(newRules);

      set({ rules: newRules, isSynthesizing: false });
    } catch (err) {
      set({
        isSynthesizing: false,
        error: err instanceof Error ? err.message : 'Lỗi tổng hợp rules',
      });
    }
  },

  loadProjectRules: async (projectId) => {
    const rules = await getProjectRules(projectId);
    set({ rules });
  },

  loadChapterCorrections: async (projectId, chapterId) => {
    const corrections = await getChapterCorrections(projectId, chapterId);
    set({ corrections });
  },

  getStyleGuide: () => {
    const { rules } = get();
    return buildStyleGuideSection(rules);
  },

  clearAnalysis: () => {
    set({ corrections: [], analysisResult: null, error: null });
  },
}));
