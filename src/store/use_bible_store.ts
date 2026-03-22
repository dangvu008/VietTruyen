/**
 * File: use_bible_store.ts
 * Purpose: Zustand store quản lý state toàn bộ dự án sáng tác
 * Layer: State Management
 * Domain: Store → [bible, characters, world, chapters, UI state]
 */
import { create } from 'zustand';

interface WorldRules {
  geography: string;
  magicSystem: string;
  currency: string;
  factions: string[];
}

interface Character {
  id: string;
  name: string;
  role: string;
  fullArc: string;
  currentStage: string;
}

interface Chapter {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'revised' | 'final';
  createdAt: string;
  updatedAt: string;
}

interface SeriesBibleState {
  // Bible
  title: string;
  genre: string;
  logline: string;
  endgame: string;
  tone: string;
  notes: string;

  // World
  worldRules: WorldRules;

  // Characters
  characters: Character[];

  // Chapters
  chapters: Chapter[];

  // Actions — Bible
  updateTitle: (title: string) => void;
  updateGenre: (genre: string) => void;
  updateLogline: (logline: string) => void;
  updateEndgame: (endgame: string) => void;
  updateTone: (tone: string) => void;
  updateNotes: (notes: string) => void;

  // Actions — World
  updateRules: (rules: Partial<WorldRules>) => void;

  // Actions — Characters
  addCharacter: (char: Character) => void;
  updateCharacterStage: (id: string, stage: string) => void;

  // Actions — Chapters
  addChapter: (chapter: Chapter) => void;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
}

export const useBibleStore = create<SeriesBibleState>((set) => ({
  // Initial state — Bible
  title: 'Truyện mới',
  genre: '',
  logline: '',
  endgame: '',
  tone: 'Trang trọng, kỳ ảo',
  notes: '',

  // Initial state — World
  worldRules: {
    geography: '',
    magicSystem: '',
    currency: '',
    factions: [],
  },

  // Initial state — Characters & Chapters
  characters: [],
  chapters: [],

  // Actions — Bible
  updateTitle: (title) => set({ title }),
  updateGenre: (genre) => set({ genre }),
  updateLogline: (logline) => set({ logline }),
  updateEndgame: (endgame) => set({ endgame }),
  updateTone: (tone) => set({ tone }),
  updateNotes: (notes) => set({ notes }),

  // Actions — World
  updateRules: (rules) => set((state) => ({
    worldRules: { ...state.worldRules, ...rules },
  })),

  // Actions — Characters
  addCharacter: (char) => set((state) => ({
    characters: [...state.characters, char],
  })),
  updateCharacterStage: (id, stage) => set((state) => ({
    characters: state.characters.map(c =>
      c.id === id ? { ...c, currentStage: stage } : c
    ),
  })),

  // Actions — Chapters
  addChapter: (chapter) => set((state) => ({
    chapters: [...state.chapters, chapter],
  })),
  updateChapter: (id, updates) => set((state) => ({
    chapters: state.chapters.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ),
  })),
}));
