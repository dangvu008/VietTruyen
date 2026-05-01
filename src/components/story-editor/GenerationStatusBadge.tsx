/**
 * File: GenerationStatusBadge.tsx
 * Purpose: Visual indicator for AI generation lifecycle per chapter
 * Layer: UI (Presentational)
 * Domain: StoryEditor → [generation status display]
 * Deps: ChapterGenerationStatus type, lucide-react
 *
 * States:
 * - idle        → hidden (no badge)
 * - generating  → pulsing amber dot + "Đang viết..."
 * - failed      → amber warning + "Tạo dở dang"
 * - done        → brief green checkmark (auto-hides after 3s)
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ChapterGenerationStatus } from '../../types/story';

// ── Types ──────────────────────────────────────────────────

interface Props {
  status: ChapterGenerationStatus | undefined;
  /** If true, renders compact single-icon version (for sidebar use) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ── Constants ──────────────────────────────────────────────

/** Auto-hide 'done' badge after this many milliseconds */
const DONE_DISPLAY_MS = 3_000;

// ── Component ──────────────────────────────────────────────

export const GenerationStatusBadge: React.FC<Props> = ({
  status,
  compact = false,
  className = '',
}) => {
  // [Domain:StoryEditor] STEP 1 — Auto-hide 'done' badge after delay
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (status === 'done') {
      setShowDone(true);
      const timer = setTimeout(() => setShowDone(false), DONE_DISPLAY_MS);
      return () => clearTimeout(timer);
    } else {
      setShowDone(false);
    }
  }, [status]);

  // [Domain:StoryEditor] STEP 2 — Determine what to render
  if (!status || status === 'idle') return null;
  if (status === 'done' && !showDone) return null;

  if (compact) {
    return <CompactBadge status={status} showDone={showDone} className={className} />;
  }

  return <FullBadge status={status} showDone={showDone} className={className} />;
};

// ── Sub-renderers ──────────────────────────────────────────

interface BadgeProps {
  status: ChapterGenerationStatus;
  showDone: boolean;
  className: string;
}

const FullBadge: React.FC<BadgeProps> = ({ status, showDone, className }) => {
  if (status === 'generating') {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-3 py-1 ${className}`}
        role="status"
        aria-label="AI đang viết"
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-amber opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-amber" />
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-accent-amber whitespace-nowrap">
          Đang viết...
        </span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 ${className}`}
        role="alert"
        aria-label="Tạo dở dang"
      >
        <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold tracking-wide text-amber-400 whitespace-nowrap">
          Tạo dở dang
        </span>
      </div>
    );
  }

  if (status === 'done' && showDone) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 animate-in fade-in duration-300 ${className}`}
        role="status"
        aria-label="Đã tạo xong"
      >
        <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold tracking-wide text-emerald-400 whitespace-nowrap">
          Đã tạo xong
        </span>
      </div>
    );
  }

  return null;
};

const CompactBadge: React.FC<BadgeProps> = ({ status, showDone, className }) => {
  if (status === 'generating') {
    return (
      <span
        className={`relative flex h-2 w-2 flex-shrink-0 ${className}`}
        aria-label="AI đang viết..."
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-amber opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-amber" />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className={`flex-shrink-0 ${className}`} aria-label="Tạo dở dang">
        <AlertTriangle className="h-3 w-3 text-amber-400" />
      </span>
    );
  }

  if (status === 'done' && showDone) {
    return (
      <span className={`flex-shrink-0 animate-in fade-in duration-300 ${className}`} aria-label="Đã tạo xong">
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      </span>
    );
  }

  return null;
};
