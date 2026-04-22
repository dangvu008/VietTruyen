/**
 * File: LanguageSwitcher.tsx
 * Purpose: Dropdown component for switching between languages
 * Layer: UI (Shared Component)
 * Domain: i18n → [user language selection]
 */
import React, { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from '../../hooks/use_translation';
import { LOCALE_OPTIONS } from '../../lib/i18n';
import type { Locale } from '../../lib/i18n/types';

export interface LanguageSwitcherProps {
  direction?: 'up' | 'down';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ direction = 'down' }) => {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALE_OPTIONS.find((o) => o.value === locale) ?? LOCALE_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-surface-container-low bg-[#1A1614] px-2.5 py-1.5 text-xs text-[#A29081] transition-colors hover:border-[#F0C59A]/30 hover:text-[#F0C59A] border border-transparent"
        title={current.label}
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <div className={`absolute right-0 z-50 w-44 overflow-hidden rounded-xl bg-[#1A1614] border border-white/5 shadow-xl animate-fade-in ${
          direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        }`}>
          {LOCALE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setLocale(option.value as Locale);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                locale === option.value
                  ? 'bg-[#f0c59a]/10 font-medium text-[#F0C59A]'
                  : 'text-[#A29081] hover:bg-white/[0.04] hover:text-[#E8E1DC]'
              }`}
            >
              <span className="text-base">{option.flag}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
