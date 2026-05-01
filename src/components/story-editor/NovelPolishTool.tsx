/**
 * File: NovelPolishTool.tsx
 * Purpose: Raw-text polish tool embedded in the Story Editor Muse panel
 * Layer: UI
 * Domain: StoryEditor -> Novel Polish
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileText, ListChecks, Sparkles, Wand2, X } from 'lucide-react';

import {
  NOVEL_POLISH_MODES,
  type NovelPolishModeId,
} from '../../lib/ai/novel_polish';

interface NovelPolishRunPayload {
  mode: NovelPolishModeId;
  rawText: string;
}

interface NovelPolishToolProps {
  sourceText?: string;
  sourceActionLabel?: string;
  title?: string;
  disabled: boolean;
  onRun: (payload: NovelPolishRunPayload) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  autoCollapseSignal?: number;
}

const MODE_ICONS: Record<NovelPolishModeId, React.ReactNode> = {
  comprehensive: <Sparkles className="h-3.5 w-3.5" />,
  find_errors: <ListChecks className="h-3.5 w-3.5" />,
  remove_ai_tone: <Wand2 className="h-3.5 w-3.5" />,
  enhance_details: <FileText className="h-3.5 w-3.5" />,
  optimize_dialogue: <Sparkles className="h-3.5 w-3.5" />,
};

export function NovelPolishTool({
  sourceText = '',
  sourceActionLabel = 'Lấy từ trình soạn',
  title = 'Trau chuốt bản thảo',
  disabled,
  onRun,
  collapsible = false,
  defaultCollapsed = false,
  autoCollapseSignal = 0,
}: NovelPolishToolProps) {
  const [mode, setMode] = useState<NovelPolishModeId>('comprehensive');
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const activeMode = useMemo(
    () => NOVEL_POLISH_MODES.find((item) => item.id === mode) ?? NOVEL_POLISH_MODES[0],
    [mode],
  );

  const resolvedSourceText = sourceText.trim();
  const canUseSource = resolvedSourceText.length > 0;

  useEffect(() => {
    if (!collapsible) return;
    setIsCollapsed(true);
  }, [autoCollapseSignal, collapsible]);

  const handleRun = () => {
    const text = rawText.trim();
    if (!text) {
      setError('Cần có văn bản thô trước khi trau chuốt.');
      return;
    }

    setError('');
    onRun({ mode, rawText: text });
  };

  if (collapsible && isCollapsed) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex w-full items-center justify-between rounded-[18px] border border-white/[0.06] bg-[#15110f] px-4 py-3 text-left transition hover:border-accent-amber/20 hover:bg-[#191412]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-amber/12 text-accent-amber">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-amber">
                {title}
              </p>
              <p className="text-[11px] leading-4 text-[#8f7f73]">
                Mở công cụ trau chuốt
              </p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-[#8f7f73]" />
        </button>
      </div>
    );
  }

  return (
    <section className="mb-4 rounded-[18px] border border-white/[0.06] bg-[#15110f] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-amber/12 text-accent-amber">
            <Wand2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-amber">
              {title}
            </p>
            <p className="text-[11px] leading-4 text-[#8f7f73]">
              {activeMode.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUseSource && (
            <button
              type="button"
              onClick={() => {
                setRawText(resolvedSourceText);
                setError('');
              }}
              className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#c8beb0] transition hover:border-accent-amber/30 hover:text-accent-amber"
            >
              {sourceActionLabel}
            </button>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#8f7f73] transition hover:border-accent-amber/20 hover:text-accent-amber"
              aria-label="Ẩn công cụ trau chuốt"
              title="Ẩn công cụ trau chuốt"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {NOVEL_POLISH_MODES.map((item) => {
          const isActive = item.id === mode;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] transition ${
                isActive
                  ? 'border-accent-amber/35 bg-accent-amber/12 text-[#f2e7dc]'
                  : 'border-white/[0.05] bg-[#110e0c] text-[#a99b8f] hover:border-white/10 hover:text-[#d6cbc0]'
              }`}
            >
              <span className={isActive ? 'text-accent-amber' : 'text-[#6f6259]'}>
                {MODE_ICONS[item.id]}
              </span>
              <span className="font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>

      <textarea
        value={rawText}
        onChange={(event) => {
          setRawText(event.target.value);
          if (error) setError('');
        }}
        rows={5}
        className="mt-3 w-full resize-none rounded-2xl border border-white/[0.05] bg-[#100d0d] px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none placeholder:text-[#685c52] focus:border-accent-amber/30"
        placeholder="Dán văn bản thô..."
      />

      {error ? (
        <p className="mt-2 text-[11px] font-medium text-red-300">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={handleRun}
        disabled={disabled}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent-amber px-4 py-2.5 text-[12px] font-bold text-[#1b140f] transition hover:bg-[#ffd7ab] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#2a2420] disabled:text-[#685c52]"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Bắt đầu trau chuốt
      </button>
    </section>
  );
}
