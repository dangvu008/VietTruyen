/**
 * File: index.ts
 * Purpose: Barrel re-export for i18n module
 * Layer: Core Library
 * Domain: i18n → [public API]
 */
export type { Locale, TranslationMap } from './types';
export { translate, createTranslator, LOCALE_OPTIONS, DEFAULT_LOCALE, translations } from './i18n';
export { vi } from './translations_vi';
export { zh } from './translations_zh';
export { en } from './translations_en';
