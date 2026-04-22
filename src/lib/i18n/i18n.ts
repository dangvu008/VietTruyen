/**
 * File: i18n.ts
 * Purpose: Core i18n utility — translation lookup with nested key support
 * Layer: Core Library
 * Domain: i18n → [translation engine]
 *
 * Data Contract:
 * - Input:  dot-notation key (e.g., 'sidebar.tabs.studio')
 * - Output: translated string for current locale
 * - Fallback: selected locale → vi → raw key
 */
import type { Locale, TranslationMap } from './types';
import { vi } from './translations_vi';
import { zh } from './translations_zh';
import { en } from './translations_en';

const translations: Record<Locale, TranslationMap> = { vi, zh, en };

/**
 * Get nested value from translation object using dot-notation key.
 * e.g., getNestedValue(obj, 'sidebar.tabs.studio') → 'AI Studio'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Translate a key for the given locale.
 * Fallback chain: locale → 'vi' → key itself
 */
export function translate(locale: Locale, key: string): string {
  const localMap = translations[locale];
  const result = getNestedValue(localMap as unknown as Record<string, unknown>, key);
  if (result !== undefined) return result;

  // Fallback to Vietnamese
  if (locale !== 'vi') {
    const fallback = getNestedValue(vi as unknown as Record<string, unknown>, key);
    if (fallback !== undefined) return fallback;
  }

  // Last resort: return key
  return key;
}

/**
 * Create a bound translate function for a specific locale.
 */
export function createTranslator(locale: Locale): (key: string) => string {
  return (key: string) => translate(locale, key);
}

/**
 * Get all available locales with their display labels.
 */
export const LOCALE_OPTIONS: Array<{ value: Locale; label: string; flag: string }> = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
];

export const DEFAULT_LOCALE: Locale = 'vi';

export { translations };
