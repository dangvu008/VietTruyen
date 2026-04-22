/**
 * File: use_i18n_store.ts
 * Purpose: Zustand store for i18n state management with localStorage persistence
 * Layer: State Management
 * Domain: i18n → [locale state, persistence]
 *
 * Data Contract:
 * - Input:  locale selection from user
 * - Output: current locale + translate function
 * - Persistence: localStorage key 'viettruyen-locale'
 */
import { create } from 'zustand';
import type { Locale } from '../lib/i18n/types';
import { translate, DEFAULT_LOCALE } from '../lib/i18n/i18n';

const STORAGE_KEY = 'viettruyen-locale';

function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'vi' || stored === 'zh' || stored === 'en') {
      return stored;
    }
  } catch {
    // localStorage not available (SSR, etc.)
  }
  return DEFAULT_LOCALE;
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: loadLocale(),

  setLocale: (locale: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
    set({ locale });
  },

  t: (key: string) => translate(get().locale, key),
}));
