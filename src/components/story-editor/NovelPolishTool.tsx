/**
 * File: NovelPolishTool.tsx
 * Purpose: Raw-text polish tool embedded in the Story Editor Muse panel
 * Layer: UI
 * Domain: StoryEditor -> Novel Polish
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  FileText,
  Gauge,
  Layers,
  ListChecks,
  Microscope,
  Ruler,
  Scissors,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';

import {
  NOVEL_POLISH_MODES,
  type NovelPolishMode,
  type NovelPolishModeId,
  type NovelPolishSourceScope,
} from '../../lib/ai/novel_polish';

interface NovelPolishRunPayload {
  mode: NovelPolishModeId;
  rawText: string;
  sourceScope: NovelPolishSourceScope;
}

interface NovelPolishToolProps {
  selectedSourceText?: string;
  chapterSourceText?: string;
  storySourceText?: string;
  hasStorySourceOverride?: boolean;
  storySourceCharCount?: number;
  title?: string;
  disabled: boolean;
  isRunning?: boolean;
  runLabel?: string;
  statusText?: string;
  onRun: (payload: NovelPolishRunPayload) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  autoCollapseSignal?: number;
}

interface ResolveNovelPolishRunTextInput {
  sourceScope: NovelPolishSourceScope;
  customText: string;
  selectedSourceText?: string;
  chapterSourceText?: string;
  storySourceText?: string;
}

const MODE_ICONS: Record<NovelPolishModeId, React.ReactNode> = {
  // Quick
  comprehensive: <Sparkles className="h-3.5 w-3.5" />,
  find_errors: <ListChecks className="h-3.5 w-3.5" />,
  remove_ai_tone: <Wand2 className="h-3.5 w-3.5" />,
  enhance_details: <FileText className="h-3.5 w-3.5" />,
  optimize_dialogue: <Sparkles className="h-3.5 w-3.5" />,
  // Deep (5-pass)
  anti_ai_tic: <Layers className="h-3.5 w-3.5" />,
  metaphor_sanity: <Microscope className="h-3.5 w-3.5" />,
  consistency_audit: <Ruler className="h-3.5 w-3.5" />,
  pacing_by_scene_type: <Gauge className="h-3.5 w-3.5" />,
  lexical_surgery: <Scissors className="h-3.5 w-3.5" />,
  critique_then_fix: <Sparkles className="h-3.5 w-3.5" />,
};

// Modes that cost more than one model call. Rendered with a 'Pro' badge so
// users know to expect higher latency and token cost.
const PRO_MODE_IDS = new Set<NovelPolishModeId>(['critique_then_fix']);

function renderModeGroup(
  title: string,
  category: NovelPolishMode['category'],
  modes: NovelPolishMode[],
  selectedMode: NovelPolishModeId,
  setMode: (id: NovelPolishModeId) => void,
): React.ReactNode {
  const groupModes = modes.filter((item) => item.category === category);
  if (groupModes.length === 0) return null;

  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f7f73]">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {groupModes.map((item) => {
          const isActive = item.id === selectedMode;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              title={item.description}
              className={`flex min-h-10 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] transition ${isActive
                ? 'border-accent-amber/35 bg-accent-amber/12 text-[#f2e7dc]'
                : 'border-white/[0.05] bg-[#110e0c] text-[#a99b8f] hover:border-white/10 hover:text-[#d6cbc0]'
                }`}
            >
              <span className={isActive ? 'text-accent-amber' : 'text-[#6f6259]'}>
                {MODE_ICONS[item.id]}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
              {PRO_MODE_IDS.has(item.id) ? (
                <span className="shrink-0 rounded-full border border-accent-amber/40 bg-accent-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-accent-amber">
                  Pro
                </span>
              ) : item.outputKind === 'report' ? (
                <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8f7f73]">
                  Báo cáo
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function resolveNovelPolishRunText({
  sourceScope,
  customText,
  selectedSourceText = '',
  chapterSourceText = '',
  storySourceText = '',
}: ResolveNovelPolishRunTextInput): string {
  if (sourceScope === 'selection') return selectedSourceText.trim();
  if (sourceScope === 'chapter') return chapterSourceText.trim();
  if (sourceScope === 'story') return storySourceText.trim();
  return customText.trim();
}

function formatSourceCharCount(textOrCount: string | number): string {
  const count = typeof textOrCount === 'number' ? textOrCount : textOrCount.trim().length;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K ký tự`;
  return `${count.toLocaleString('vi-VN')} ký tự`;
}

export function NovelPolishTool({
  selectedSourceText = '',
  chapterSourceText = '',
  storySourceText = '',
  hasStorySourceOverride,
  storySourceCharCount,
  title = 'Trau chuốt bản thảo',
  disabled,
  isRunning = false,
  runLabel = 'Bắt đầu trau chuốt',
  statusText = '',
  onRun,
  collapsible = false,
  defaultCollapsed = false,
  autoCollapseSignal = 0,
}: NovelPolishToolProps) {
  const [mode, setMode] = useState<NovelPolishModeId>('comprehensive');
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [sourceScope, setSourceScope] = useState<NovelPolishSourceScope>(
    selectedSourceText.trim() ? 'selection' : chapterSourceText.trim() ? 'chapter' : 'custom',
  );

  const activeMode = useMemo(
    () => NOVEL_POLISH_MODES.find((item) => item.id === mode) ?? NOVEL_POLISH_MODES[0],
    [mode],
  );

  const resolvedSelectedText = selectedSourceText.trim();
  const resolvedChapterText = chapterSourceText.trim();
  const resolvedStoryText = storySourceText.trim();
  const hasSelectedSource = resolvedSelectedText.length > 0;
  const hasChapterSource = resolvedChapterText.length > 0;
  const hasStorySource = hasStorySourceOverride ?? resolvedStoryText.length > 0;
  const resolvedSourceText = resolveNovelPolishRunText({
    sourceScope,
    customText,
    selectedSourceText: resolvedSelectedText,
    chapterSourceText: resolvedChapterText,
    storySourceText: resolvedStoryText,
  });
  // For whole-story mode, the parent owns the per-chapter source and does not
  // need a giant concatenated string in this component on every render.
  const sourceText = sourceScope === 'story' && hasStorySource && !resolvedSourceText
    ? '__story_source__'
    : resolvedSourceText;
  const activeSourceLabel = sourceScope === 'selection'
    ? 'Đoạn đang chọn'
    : sourceScope === 'chapter'
      ? 'Toàn chương'
      : sourceScope === 'story'
        ? 'Toàn bộ truyện'
        : 'Văn bản thủ công';

  useEffect(() => {
    if (!collapsible) return;
    setIsCollapsed(true);
  }, [autoCollapseSignal, collapsible]);

  useEffect(() => {
    if (sourceScope === 'selection' && !hasSelectedSource) {
      setSourceScope(hasChapterSource ? 'chapter' : 'custom');
      return;
    }
    if (sourceScope === 'chapter' && !hasChapterSource) {
      setSourceScope(hasSelectedSource ? 'selection' : 'custom');
      return;
    }
    if (sourceScope === 'story' && !hasStorySource) {
      setSourceScope(hasSelectedSource ? 'selection' : hasChapterSource ? 'chapter' : 'custom');
    }
  }, [hasChapterSource, hasSelectedSource, hasStorySource, sourceScope]);

  const selectSourceScope = (nextScope: NovelPolishSourceScope) => {
    if (nextScope !== 'custom') {
      const nextText = nextScope === 'selection'
        ? resolvedSelectedText
        : nextScope === 'chapter'
          ? resolvedChapterText
          : resolvedStoryText;
      if (!nextText && !(nextScope === 'story' && hasStorySource)) return;
    }
    setSourceScope(nextScope);
    setError('');
  };

  const handleRun = () => {
    const text = sourceText.trim();
    if (!text) {
      setError(sourceScope === 'custom'
        ? 'Cần có văn bản thô trước khi trau chuốt.'
        : 'Nguồn đang chọn chưa có nội dung để trau chuốt.');
      return;
    }

    setError('');
    onRun({ mode, rawText: text, sourceScope });
  };

  if (collapsible && isCollapsed) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-[#15110f] px-3.5 py-2.5 text-left transition hover:border-accent-amber/20 hover:bg-[#191412]"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-amber/12 text-accent-amber">
              <Wand2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-amber">
                {title}
              </p>
              <p className="text-[10px] leading-4 text-[#8f7f73]">
                Mở công cụ
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
      <div className="mb-2.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-amber/12 text-accent-amber">
              <Wand2 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold uppercase tracking-[0.16em] text-accent-amber">
                {title}
              </p>
              <p className="line-clamp-2 text-[11px] leading-4 text-[#8f7f73]">
                {activeMode.description}
              </p>
            </div>
          </div>
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
        <div className="flex flex-wrap items-center gap-2">
          {hasSelectedSource && (
            <button
              type="button"
              onClick={() => selectSourceScope('selection')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${sourceScope === 'selection'
                ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                : 'border-white/10 text-[#c8beb0] hover:border-accent-amber/30 hover:text-accent-amber'
                }`}
            >
              Lấy đoạn đang chọn
            </button>
          )}
          {hasChapterSource && (
            <button
              type="button"
              onClick={() => selectSourceScope('chapter')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${sourceScope === 'chapter'
                ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                : 'border-white/10 text-[#c8beb0] hover:border-accent-amber/30 hover:text-accent-amber'
                }`}
            >
              Lấy toàn chương
            </button>
          )}
          {hasStorySource && (
            <button
              type="button"
              onClick={() => selectSourceScope('story')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${sourceScope === 'story'
                ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                : 'border-white/10 text-[#c8beb0] hover:border-accent-amber/30 hover:text-accent-amber'
                }`}
            >
              Lấy toàn bộ truyện
            </button>
          )}
          <button
            type="button"
            onClick={() => selectSourceScope('custom')}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${sourceScope === 'custom'
              ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
              : 'border-white/10 text-[#c8beb0] hover:border-accent-amber/30 hover:text-accent-amber'
              }`}
          >
            Nhập thủ công
          </button>
        </div>
      </div>

      <div className="mb-2.5 rounded-2xl border border-white/[0.05] bg-[#100d0d] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent-amber">
            Nguồn đã chọn: {activeSourceLabel}
          </p>
          <span className="rounded-full border border-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[#8f7f73]">
            {formatSourceCharCount(sourceScope === 'story' && storySourceCharCount != null ? storySourceCharCount : sourceText)}
          </span>
        </div>
      </div>

      {renderModeGroup('Nhanh (1-pass)', 'quick', NOVEL_POLISH_MODES, mode, setMode)}
      {renderModeGroup('Chuyên sâu (5-pass)', 'deep', NOVEL_POLISH_MODES, mode, setMode)}

      {sourceScope === 'custom' ? (
        <textarea
          value={customText}
          onChange={(event) => {
            setCustomText(event.target.value);
            if (error) setError('');
          }}
          rows={3}
          className="mt-2.5 max-h-28 w-full resize-y rounded-2xl border border-white/[0.05] bg-[#100d0d] px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none placeholder:text-[#685c52] focus:border-accent-amber/30"
          placeholder="Dán văn bản thô..."
        />
      ) : null}

      {error ? (
        <p className="mt-2 text-[11px] font-medium text-red-300">{error}</p>
      ) : statusText ? (
        <p className="mt-2 text-[11px] font-medium text-[#8f7f73]">{statusText}</p>
      ) : null}

      <button
        type="button"
        onClick={handleRun}
        disabled={disabled || isRunning}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-accent-amber px-4 py-2.5 text-[12px] font-bold text-[#1b140f] transition hover:bg-[#ffd7ab] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#2a2420] disabled:text-[#685c52]"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {runLabel}
      </button>
    </section>
  );
}
