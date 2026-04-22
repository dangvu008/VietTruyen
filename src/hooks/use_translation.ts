/**
 * File: use_translation.ts
 * Purpose: Convenience hook for i18n in React components
 * Layer: Hooks
 * Domain: i18n → [React integration]
 *
 * Data Contract:
 * - Output: { t, locale, setLocale } — ready to use in any component
 */
import { useI18nStore } from '../store/use_i18n_store';
import type { Locale } from '../lib/i18n/types';
import { translate } from '../lib/i18n/i18n';
import { useCallback } from 'react';

export function useTranslation() {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);

  const t = useCallback(
    (key: string) => translate(locale, key),
    [locale]
  );

  return { t, locale, setLocale } as const;
}

export type { Locale };
