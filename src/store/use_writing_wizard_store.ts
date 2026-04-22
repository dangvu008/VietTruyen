/**
 * File: use_writing_wizard_store.ts
 * Purpose: Shared Zustand store for both legacy 6-step wizard and newer 3-screen flow
 * Layer: Store
 * Domain: WritingWizard → [setup, brainstorming, outlining, chapter draft, finish screen]
 */
import { create } from 'zustand';
import type { BrainstormMessage, BrainstormResult } from '../types/narrative_memory';

export type WizardScreen = 'setup' | 'writing' | 'finish';
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface StorySetup {
  name: string;
  want: string;
  genre: string;
  tone: string;
}

export interface ReviewResult {
  level: 'good' | 'warning' | 'issue';
  items: string[];
}

export interface WritingWizardState {
  // ─── 3-screen flow ─────────────────────────────
  screen: WizardScreen;
  story: StorySetup | null;
  paragraphs: string[];
  decisions: string[];
  isGenerating: boolean;
  showOptions: boolean;
  selfWriteMode: boolean;

  // ─── Legacy 6-step flow ────────────────────────
  currentStep: WizardStep;
  maxStepReached: WizardStep;
  ideaText: string;
  selectedGenre: string;
  brainstormMessages: BrainstormMessage[];
  brainstormResult: BrainstormResult | null;
  isBrainstorming: boolean;
  brainstormError: string | null;
  foundationConfirmed: boolean;
  isGeneratingOutline: boolean;
  outlineConfirmed: boolean;
  currentChapterIndex: number;
  draftContent: string;
  draftTitle: string;
  isWriting: boolean;
  writeError: string | null;
  reviewResult: ReviewResult | null;
  isReviewing: boolean;

  // ─── 3-screen actions ──────────────────────────
  setScreen: (screen: WizardScreen) => void;
  setStory: (story: StorySetup) => void;
  addParagraph: (text: string) => void;
  addDecision: (label: string) => void;
  setGenerating: (v: boolean) => void;
  setShowOptions: (v: boolean) => void;
  setSelfWriteMode: (v: boolean) => void;

  // ─── Legacy actions ────────────────────────────
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setIdeaText: (value: string) => void;
  setSelectedGenre: (value: string) => void;
  addBrainstormMessage: (message: BrainstormMessage) => void;
  setBrainstorming: (value: boolean) => void;
  setBrainstormError: (value: string | null) => void;
  setBrainstormResult: (value: BrainstormResult | null) => void;
  setFoundationConfirmed: (value: boolean) => void;
  setGeneratingOutline: (value: boolean) => void;
  setOutlineConfirmed: (value: boolean) => void;
  setCurrentChapterIndex: (value: number) => void;
  setDraftContent: (value: string) => void;
  setDraftTitle: (value: string) => void;
  setWriting: (value: boolean) => void;
  setWriteError: (value: string | null) => void;
  setReviewResult: (value: ReviewResult | null) => void;
  setReviewing: (value: boolean) => void;

  reset: () => void;
}

const INITIAL_STATE = {
  screen: 'setup' as WizardScreen,
  story: null as StorySetup | null,
  paragraphs: [] as string[],
  decisions: [] as string[],
  isGenerating: false,
  showOptions: false,
  selfWriteMode: false,
  currentStep: 1 as WizardStep,
  maxStepReached: 1 as WizardStep,
  ideaText: '',
  selectedGenre: '',
  brainstormMessages: [] as BrainstormMessage[],
  brainstormResult: null as BrainstormResult | null,
  isBrainstorming: false,
  brainstormError: null as string | null,
  foundationConfirmed: false,
  isGeneratingOutline: false,
  outlineConfirmed: false,
  currentChapterIndex: 0,
  draftContent: '',
  draftTitle: '',
  isWriting: false,
  writeError: null as string | null,
  reviewResult: null as ReviewResult | null,
  isReviewing: false,
};

function nextWizardStep(step: WizardStep): WizardStep {
  return (Math.min(6, step + 1) as WizardStep);
}

function prevWizardStep(step: WizardStep): WizardStep {
  return (Math.max(1, step - 1) as WizardStep);
}

export const useWritingWizardStore = create<WritingWizardState>((set) => ({
  ...INITIAL_STATE,

  // 3-screen actions
  setScreen: (screen) => set({ screen }),
  setStory: (story) => set({ story }),
  addParagraph: (text) => set((state) => ({ paragraphs: [...state.paragraphs, text] })),
  addDecision: (label) => set((state) => ({ decisions: [...state.decisions, label] })),
  setGenerating: (v) => set({ isGenerating: v }),
  setShowOptions: (v) => set({ showOptions: v }),
  setSelfWriteMode: (v) => set({ selfWriteMode: v }),

  // Legacy actions
  setStep: (step) =>
    set((state) => ({
      currentStep: step,
      maxStepReached: step > state.maxStepReached ? step : state.maxStepReached,
    })),
  nextStep: () =>
    set((state) => {
      const next = nextWizardStep(state.currentStep);
      return {
        currentStep: next,
        maxStepReached: next > state.maxStepReached ? next : state.maxStepReached,
      };
    }),
  prevStep: () =>
    set((state) => ({
      currentStep: prevWizardStep(state.currentStep),
    })),
  setIdeaText: (value) => set({ ideaText: value }),
  setSelectedGenre: (value) => set({ selectedGenre: value }),
  addBrainstormMessage: (message) =>
    set((state) => ({ brainstormMessages: [...state.brainstormMessages, message] })),
  setBrainstorming: (value) => set({ isBrainstorming: value }),
  setBrainstormError: (value) => set({ brainstormError: value }),
  setBrainstormResult: (value) => set({ brainstormResult: value }),
  setFoundationConfirmed: (value) => set({ foundationConfirmed: value }),
  setGeneratingOutline: (value) => set({ isGeneratingOutline: value }),
  setOutlineConfirmed: (value) => set({ outlineConfirmed: value }),
  setCurrentChapterIndex: (value) => set({ currentChapterIndex: value }),
  setDraftContent: (value) => set({ draftContent: value }),
  setDraftTitle: (value) => set({ draftTitle: value }),
  setWriting: (value) => set({ isWriting: value }),
  setWriteError: (value) => set({ writeError: value }),
  setReviewResult: (value) => set({ reviewResult: value }),
  setReviewing: (value) => set({ isReviewing: value }),

  reset: () => set({ ...INITIAL_STATE }),
}));
