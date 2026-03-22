/**
 * File: use_narrative_store.ts
 * Purpose: Zustand lightweight store cho Narrative Memory Engine UI state
 * Layer: Store
 * Domain: NarrativeMemory → [UI state only, heavy data in IndexedDB]
 *
 * Data Contract:
 * - Input:  Actions từ UI components
 * - Output: UI state (loading flags, active selections)
 * - Heavy data: Luôn query từ narrative_db.ts, KHÔNG lưu ở đây
 */
import { create } from 'zustand';
import type {
  EntitySnapshot,
  PropagationResult,
  BrainstormMessage,
  BrainstormResult,
} from '../types/narrative_memory';

interface NarrativeState {
  // ─── Brainstorm State ─────────────────────────────
  brainstormMessages: BrainstormMessage[];
  brainstormResult: BrainstormResult | null;
  isBrainstorming: boolean;
  brainstormError: string | null;

  // ─── Entity Timeline State ────────────────────────
  activeEntityTimeline: EntitySnapshot[];
  isTimelineLoading: boolean;

  // ─── Propagation State ────────────────────────────
  activePropagation: PropagationResult | null;
  isPropagating: boolean;

  // ─── Metadata Extraction ──────────────────────────
  isExtracting: boolean;
  lastExtractionChapterId: string | null;

  // ─── Brainstorm Actions ───────────────────────────
  addBrainstormMessage: (msg: BrainstormMessage) => void;
  setBrainstormResult: (result: BrainstormResult | null) => void;
  setBrainstorming: (loading: boolean) => void;
  setBrainstormError: (error: string | null) => void;
  clearBrainstorm: () => void;

  // ─── Timeline Actions ─────────────────────────────
  setActiveEntityTimeline: (snapshots: EntitySnapshot[]) => void;
  setTimelineLoading: (loading: boolean) => void;

  // ─── Propagation Actions ──────────────────────────
  setActivePropagation: (result: PropagationResult | null) => void;
  setPropagating: (loading: boolean) => void;

  // ─── Extraction Actions ───────────────────────────
  setExtracting: (loading: boolean) => void;
  setLastExtractionChapterId: (id: string | null) => void;
}

export const useNarrativeStore = create<NarrativeState>((set) => ({
  // Initial state
  brainstormMessages: [],
  brainstormResult: null,
  isBrainstorming: false,
  brainstormError: null,

  activeEntityTimeline: [],
  isTimelineLoading: false,

  activePropagation: null,
  isPropagating: false,

  isExtracting: false,
  lastExtractionChapterId: null,

  // Brainstorm actions
  addBrainstormMessage: (msg) =>
    set((state) => ({
      brainstormMessages: [...state.brainstormMessages, msg],
    })),

  setBrainstormResult: (result) => set({ brainstormResult: result }),
  setBrainstorming: (loading) => set({ isBrainstorming: loading }),
  setBrainstormError: (error) => set({ brainstormError: error }),

  clearBrainstorm: () =>
    set({
      brainstormMessages: [],
      brainstormResult: null,
      isBrainstorming: false,
      brainstormError: null,
    }),

  // Timeline actions
  setActiveEntityTimeline: (snapshots) => set({ activeEntityTimeline: snapshots }),
  setTimelineLoading: (loading) => set({ isTimelineLoading: loading }),

  // Propagation actions
  setActivePropagation: (result) => set({ activePropagation: result }),
  setPropagating: (loading) => set({ isPropagating: loading }),

  // Extraction actions
  setExtracting: (loading) => set({ isExtracting: loading }),
  setLastExtractionChapterId: (id) => set({ lastExtractionChapterId: id }),
}));
