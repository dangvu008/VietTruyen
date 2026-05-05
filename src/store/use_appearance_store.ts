/**
 * File: use_appearance_store.ts
 * Purpose: Zustand store quản lý theme giao diện và cỡ chữ editor
 * Layer: State Management
 * Domain: Appearance → [theme preferences, editor typography, persistence]
 */
import { create } from 'zustand';

export type AppearanceTheme = 'dark' | 'midnight' | 'sepia' | 'ethereal-light' | 'ethereal-dark';
export type EditorFontSize = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'viettruyen-appearance';

const EDITOR_FONT_SIZE_PIXELS: Record<EditorFontSize, string> = {
  small: '12px',
  medium: '14px',
  large: '16px',
};

interface StoredAppearancePreferences {
  theme: AppearanceTheme;
  editorFontSize: EditorFontSize;
  readerFontSize: number;
}

interface AppearanceState extends StoredAppearancePreferences {
  isReadingModeFullscreen: boolean;
  setTheme: (theme: AppearanceTheme) => void;
  setEditorFontSize: (size: EditorFontSize) => void;
  setReaderFontSize: (size: number) => void;
  setReadingModeFullscreen: (isFullscreen: boolean) => void;
  toggleReadingModeFullscreen: () => void;
}

function isAppearanceTheme(value: string): value is AppearanceTheme {
  return value === 'dark' || value === 'midnight' || value === 'sepia' || value === 'ethereal-light' || value === 'ethereal-dark';
}

function isEditorFontSize(value: string): value is EditorFontSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

function loadAppearancePreferences(): StoredAppearancePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { theme: 'dark', editorFontSize: 'medium', readerFontSize: 18 };
    }

    const parsed = JSON.parse(raw) as Partial<StoredAppearancePreferences>;

    return {
      theme: parsed.theme && isAppearanceTheme(parsed.theme) ? parsed.theme : 'dark',
      editorFontSize:
        parsed.editorFontSize && isEditorFontSize(parsed.editorFontSize)
          ? parsed.editorFontSize
          : 'medium',
      readerFontSize:
        typeof parsed.readerFontSize === 'number' ? parsed.readerFontSize : 18,
    };
  } catch {
    return { theme: 'dark', editorFontSize: 'medium', readerFontSize: 18 };
  }
}

function persistAppearancePreferences(preferences: StoredAppearancePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore persistence failures when localStorage is unavailable.
  }
}

export function applyAppearanceToDocument(
  theme: AppearanceTheme,
  editorFontSize: EditorFontSize,
): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.dataset.appTheme = theme;
  root.style.setProperty('--vt-editor-font-size', EDITOR_FONT_SIZE_PIXELS[editorFontSize]);
  root.style.setProperty(
    '--vt-editor-line-height',
    editorFontSize === 'small' ? '1.72' : editorFontSize === 'large' ? '1.92' : '1.82',
  );
  root.style.colorScheme = theme === 'ethereal-light' ? 'light' : 'dark';
}

const initialPreferences = loadAppearancePreferences();

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  ...initialPreferences,
  isReadingModeFullscreen: false,

  setTheme: (theme) => {
    persistAppearancePreferences({ theme, editorFontSize: get().editorFontSize, readerFontSize: get().readerFontSize });
    set({ theme });
  },

  setEditorFontSize: (editorFontSize) => {
    persistAppearancePreferences({ theme: get().theme, editorFontSize, readerFontSize: get().readerFontSize });
    set({ editorFontSize });
  },

  setReaderFontSize: (readerFontSize) => {
    persistAppearancePreferences({ theme: get().theme, editorFontSize: get().editorFontSize, readerFontSize });
    set({ readerFontSize });
  },

  setReadingModeFullscreen: (isFullscreen) => {
    set({ isReadingModeFullscreen: isFullscreen });
  },

  toggleReadingModeFullscreen: () => {
    set((state) => ({ isReadingModeFullscreen: !state.isReadingModeFullscreen }));
  },
}));
