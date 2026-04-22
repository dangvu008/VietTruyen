/**
 * File: AutosaveRecoveryBanner.tsx
 * Purpose: Banner shown when autosaved drafts are detected on session start
 * Layer: UI (Presentational)
 * Domain: StoryEditor → [draft recovery UX]
 * Deps: autosave_draft_store types
 */
import React from 'react';
import { RotateCcw, X, FileWarning } from 'lucide-react';
import type { AutosaveDraft } from '../../lib/storage/autosave_draft_store';

interface Props {
  drafts: AutosaveDraft[];
  onRecover: () => void;
  onDiscard: () => void;
}

function formatDraftTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${hours}:${minutes} ${day}/${month}`;
  } catch {
    return 'không rõ';
  }
}

export const AutosaveRecoveryBanner: React.FC<Props> = ({
  drafts,
  onRecover,
  onDiscard,
}) => {
  if (drafts.length === 0) return null;

  // [Domain:StoryEditor] STEP 1 — Find the most recent draft timestamp
  const latestDraft = drafts.reduce((latest, draft) =>
    new Date(draft.savedAt) > new Date(latest.savedAt) ? draft : latest
  );
  const chapterCount = drafts.length;

  return (
    <div className="mx-auto max-w-[760px] mb-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-4 rounded-2xl border border-accent-amber/20 bg-gradient-to-r from-[#2a2018] to-[#1f1a15] px-5 py-3.5 shadow-[0_4px_20px_rgba(240,197,154,0.08)]">
        {/* Icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-amber/10">
          <FileWarning className="h-[18px] w-[18px] text-accent-amber" />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#e3d8ce] leading-snug">
            Phát hiện {chapterCount} chương chưa lưu từ phiên trước
          </p>
          <p className="text-[11px] text-[#8f7f73] mt-0.5">
            Lần lưu tự động cuối: {formatDraftTime(latestDraft.savedAt)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRecover}
            className="flex items-center gap-1.5 rounded-xl bg-accent-amber/15 px-4 py-2 text-[12px] font-semibold text-accent-amber hover:bg-accent-amber/25 transition-colors border border-accent-amber/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục
          </button>
          <button
            onClick={onDiscard}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[12px] font-medium text-[#8f7f73] hover:text-[#c5b8ad] hover:bg-white/10 transition-colors"
            title="Bỏ qua bản nháp tự động"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
