/**
 * File: EditorTopbar.tsx
 * Purpose: Top navigation bar — logo, chapter context with dropdown list, token count, export action
 * Layer: UI
 * Domain: StoryEditor
 * Deps: editor_types, lucide-react
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Zap, ChevronDown, FileText, CheckCircle2, Pencil, CircleDot, Circle, Globe, MessageSquareQuote, FileClock, ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import type { Chapter } from '../../types/story';
import type { ProjectInfo, ChapterUIStatus } from './editor_types';
import { getChapterCompletionAction, isProbablyInterruptedChapter } from './editor_types';
import type { QualityMode } from '../../types/workflow';

interface CreationProgressSummary {
  badge: string;
  headline: string;
  detail: string;
  tone: 'idle' | 'running' | 'success' | 'error' | 'interrupted';
  draftSavedAt: string | null;
}

interface Props {
  project: ProjectInfo;
  chapter: Chapter | null;
  chapters: Chapter[];
  statusMap: Record<string, ChapterUIStatus>;
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onApprove: () => void;
  onSelectChapter: (id: string) => void;
  sessionTokens?: number;
  onNewChapter?: () => void;
  onNavigate?: (tab: string) => void;
  onOpenCreationChat?: () => void;
  creationProgressSummary?: CreationProgressSummary | null;
  emptyChapterCount?: number;
  batchProgress?: { current: number; total: number; isRunning: boolean } | null;
  onBatchGenerateAll?: () => void;
  qualityMode?: QualityMode;
  onQualityModeChange?: (mode: QualityMode) => void;
  onSaveAsTemplate?: () => void | Promise<void>;
  hasSavedAsTemplate?: boolean;
  isSavingTemplate?: boolean;
  templateSaveLabel?: string;
  onCompleteChapter?: (chapterId: string) => void;
}

/** [Domain:StoryEditor] STEP 1 — Format token count for display */
function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

/** [Domain:StoryEditor] STEP 2 — Count words in content string */
function countWords(content: string): number {
  if (!content) return 0;
  let count = 0;
  let inWord = false;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) <= 32) {
      inWord = false;
    } else if (!inWord) {
      count++;
      inWord = true;
    }
  }
  return count;
}

/** [Domain:StoryEditor] STEP 3 — Format word count for compact display */
function formatWordCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

/** [Domain:StoryEditor] STEP 4 — Map Chapter status to display label + style */
function getStatusLabel(chapter: Chapter | null): { label: string; className: string } {
  if (!chapter) return { label: '', className: '' };
  if (chapter.generationStatus === 'generating') {
    return { label: 'Đang tạo', className: 'border-[#f0c59a]/20 bg-[#f0c59a]/10 text-[#f0c59a]' };
  }
  if (isProbablyInterruptedChapter(chapter)) {
    return { label: 'Tạo dở', className: 'border-amber-500/25 bg-amber-500/10 text-amber-300' };
  }
  if (!chapter.content?.trim()) {
    return { label: 'Trống', className: 'border-white/10 bg-white/[0.03] text-[#8f7f73]' };
  }
  switch (chapter.status) {
    case 'published':
      return { label: 'Xuất bản', className: 'border-[#38bdf8]/20 bg-[#38bdf8]/10 text-[#7dd3fc]' };
    case 'final':
      return { label: 'Hoàn tất', className: 'border-[#69d2a4]/20 bg-[#69d2a4]/10 text-[#7ce0b3]' };
    case 'draft':
      return { label: 'Nháp', className: 'border-[#f0c59a]/15 bg-[#f0c59a]/10 text-[#f0c59a]' };
    default:
      return { label: 'Đã viết', className: 'border-[#90b7ff]/15 bg-[#90b7ff]/10 text-[#a8c6ff]' };
  }
}

/** [Domain:StoryEditor] STEP 5 — Map UI status to icon + color for dropdown list */
function getChapterStatusIndicator(uiStatus: ChapterUIStatus): {
  icon: React.ReactNode;
  color: string;
  label: string;
} {
  switch (uiStatus) {
    case 'published':
      return {
        icon: <Globe className="h-3 w-3" />,
        color: 'text-[#38bdf8]',
        label: 'Xuất bản',
      };
    case 'approved':
      return {
        icon: <CheckCircle2 className="h-3 w-3" />,
        color: 'text-[#69d2a4]',
        label: 'Hoàn tất',
      };
    case 'edited':
      return {
        icon: <Pencil className="h-3 w-3" />,
        color: 'text-[#f0c59a]',
        label: 'Đã sửa',
      };
    case 'interrupted':
      return {
        icon: <AlertTriangle className="h-3 w-3" />,
        color: 'text-amber-300',
        label: 'Tạo dở',
      };
    case 'generating':
      return {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        color: 'text-[#f0c59a]',
        label: 'Đang tạo',
      };
    case 'reviewing':
      return {
        icon: <CircleDot className="h-3 w-3" />,
        color: 'text-[#d4a574]',
        label: 'Đang sửa',
      };
    case 'ai-draft':
      return {
        icon: <Zap className="h-3 w-3" />,
        color: 'text-[#b39ddb]',
        label: 'AI Nháp',
      };
    case 'empty':
    default:
      return {
        icon: <Circle className="h-3 w-3" />,
        color: 'text-[#5c5249]',
        label: 'Trống',
      };
  }
}

export const EditorTopbar: React.FC<Props> = ({
  chapter,
  chapters,
  statusMap,
  isSaving,
  isDirty,
  onSave,
  onApprove,
  onSelectChapter,
  sessionTokens = 0,
  onNewChapter,
  onNavigate,
  onOpenCreationChat,
  creationProgressSummary,
  emptyChapterCount = 0,
  batchProgress,
  onBatchGenerateAll,
  qualityMode = 'quality',
  onQualityModeChange,
  onSaveAsTemplate,
  hasSavedAsTemplate = false,
  isSavingTemplate = false,
  templateSaveLabel,
  onCompleteChapter,
}) => {
  const status = getStatusLabel(chapter);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentIndex = chapters.findIndex(c => c.id === chapter?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < chapters.length - 1;

  const handlePrev = () => {
    if (hasPrev) onSelectChapter(chapters[currentIndex - 1].id);
  };
  const handleNext = () => {
    if (hasNext) onSelectChapter(chapters[currentIndex + 1].id);
  };

  // [Domain:StoryEditor] STEP 6 — Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // [Domain:StoryEditor] STEP 7 — Caching word counts for performance
  const wordCountsCache = useRef<Record<string, { len: number, count: number }>>({});

  const wordCounts = useMemo(() => {
    const map: Record<string, number> = {};
    const cache = wordCountsCache.current;
    for (const ch of chapters) {
      const len = ch.content?.length || 0;
      if (cache[ch.id] && cache[ch.id].len === len) {
        map[ch.id] = cache[ch.id].count;
      } else {
        const count = countWords(ch.content);
        cache[ch.id] = { len, count };
        map[ch.id] = count;
      }
    }
    return map;
  }, [chapters]);

  const handleSelectChapter = (id: string) => {
    onSelectChapter(id);
    setIsDropdownOpen(false);
  };

  const creationToneClass = useMemo(() => {
    switch (creationProgressSummary?.tone) {
      case 'running':
        return 'border-[#f0c59a]/25 bg-[#f0c59a]/10 text-[#f0c59a]';
      case 'success':
        return 'border-[#69d2a4]/25 bg-[#69d2a4]/10 text-[#8ce7ba]';
      case 'error':
        return 'border-[#f48484]/25 bg-[#f48484]/10 text-[#ffb0b0]';
      case 'interrupted':
        return 'border-[#90b7ff]/25 bg-[#90b7ff]/10 text-[#bdd2ff]';
      default:
        return 'border-white/10 bg-white/[0.04] text-[#c8beb0]';
    }
  }, [creationProgressSummary?.tone]);

  return (
    <div className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#241c17] bg-[#110f0e] px-4 py-3 font-sans xl:flex-nowrap xl:px-6">
      {/* Left: Logo */}
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Removed redundant 'The Nocturnal Editor' text to reduce clutter */}
        {creationProgressSummary && (
          <span
            className={`hidden max-w-[220px] truncate rounded-full border px-3 py-1.5 text-[11px] font-semibold lg:inline-flex ${creationToneClass}`}
            title={creationProgressSummary.detail}
          >
            {creationProgressSummary.badge}
          </span>
        )}
        {onOpenCreationChat && (
          <button
            onClick={onOpenCreationChat}
            className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#f0c59a]/20 bg-[#f0c59a]/8 px-3 text-[11px] font-semibold text-[#f0c59a] transition hover:bg-[#f0c59a]/14"
            title={creationProgressSummary?.detail || 'Quay lại trang thảo luận khung truyện'}
          >
            <MessageSquareQuote className="h-3.5 w-3.5" />
            Khung chat
          </button>
        )}
      </div>

      {/* Center: Active chapter context + Dropdown trigger */}
      <div className="relative min-w-[260px] flex-1 xl:max-w-[520px] flex items-center gap-1.5" ref={dropdownRef}>
        <button
          onClick={handlePrev}
          disabled={!hasPrev}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.025] text-[#8f7f73] transition-colors hover:bg-white/[0.05] hover:text-[#dcd1c6] disabled:opacity-30 disabled:hover:bg-white/[0.025] disabled:hover:text-[#8f7f73]"
          title="Chương trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="group flex h-10 flex-1 items-center gap-2.5 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 text-[13px] transition-colors hover:bg-white/[0.05]"
          id="chapter-dropdown-trigger"
        >
          {chapter ? (
            <>
              <span className="min-w-0 flex-1 truncate text-left font-medium text-[#dcd1c6] transition-colors group-hover:text-accent-amber">
                {chapter.title || 'Chương không tên'}
              </span>
              {status.label && (
                <span className={`hidden rounded-full border px-2.5 py-0.5 text-[10px] font-semibold sm:inline-flex ${status.className}`}>
                  {status.label}
                </span>
              )}
              {isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#f0c59a] animate-pulse" title="Chưa lưu" />
              )}
              <ChevronDown className={`h-3.5 w-3.5 text-[#8f7f73] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </>
          ) : (
            <span className="text-[#8f7f73]">Chưa chọn chương</span>
          )}
        </button>

        <button
          onClick={handleNext}
          disabled={!hasNext}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.025] text-[#8f7f73] transition-colors hover:bg-white/[0.05] hover:text-[#dcd1c6] disabled:opacity-30 disabled:hover:bg-white/[0.025] disabled:hover:text-[#8f7f73]"
          title="Chương sau"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Chapter List Dropdown */}
        {isDropdownOpen && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[440px] max-h-[60vh] overflow-y-auto rounded-2xl bg-[#1a1715] border border-white/[0.08] shadow-[0_12px_48px_rgba(0,0,0,0.6)] z-50 py-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
            id="chapter-list-dropdown"
          >
            {/* Dropdown Header */}
            <div className="px-4 py-2.5 border-b border-white/[0.04] mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.12em] text-[#8f7f73] uppercase">
                Danh sách chương ({chapters.length})
              </span>
              {onNewChapter && (
                <button
                  onClick={() => { setIsDropdownOpen(false); onNewChapter(); }}
                  className="rounded bg-accent-amber/10 px-2 py-0.5 text-[10px] font-bold text-accent-amber transition hover:bg-accent-amber/20"
                >
                  + Thêm
                </button>
              )}
              {onBatchGenerateAll && emptyChapterCount > 1 && (
                <button
                  onClick={() => { setIsDropdownOpen(false); onBatchGenerateAll(); }}
                  disabled={batchProgress?.isRunning}
                  className="rounded bg-[#c6a6ff]/10 px-2 py-0.5 text-[10px] font-bold text-[#c6a6ff] transition hover:bg-[#c6a6ff]/20 disabled:opacity-50"
                >
                  {batchProgress?.isRunning
                    ? `✨ ${batchProgress.current}/${batchProgress.total}`
                    : `✨ Viết ${emptyChapterCount} chương`}
                </button>
              )}
            </div>

            {/* Chapter Items */}
            {chapters.length === 0 ? (
              <div className="px-4 py-6 text-center flex flex-col items-center gap-3">
                <span className="text-[13px] text-[#5c5249] mb-1">Chưa có chương nào</span>
                {onNewChapter && (
                  <button 
                    onClick={() => { setIsDropdownOpen(false); onNewChapter(); }}
                    className="flex w-full items-center justify-center rounded-xl bg-accent-amber/10 border border-accent-amber/30 px-4 py-2 text-sm font-medium text-accent-amber transition hover:bg-accent-amber/20"
                  >
                    Tạo chương mới
                  </button>
                )}
                {onNavigate && (
                  <button 
                    onClick={() => { setIsDropdownOpen(false); onNavigate('brainstorm'); }}
                    className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-[#c8beb0] transition hover:bg-white/[0.06]"
                  >
                    Bàn luận ban đầu
                  </button>
                )}
              </div>
            ) : (
              chapters.map((ch, index) => {
                const isActive = ch.id === chapter?.id;
                const uiStatus = statusMap[ch.id] || 'empty';
                const indicator = getChapterStatusIndicator(uiStatus);
                const completionAction = getChapterCompletionAction(ch, uiStatus);
                const words = wordCounts[ch.id] || 0;

                return (
                  <div
                    key={ch.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group/item focus:outline-none focus:bg-white/[0.05] ${
                      isActive
                        ? 'bg-accent-amber/[0.08] border-l-2 border-accent-amber'
                        : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                    }`}
                    id={`chapter-item-${ch.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectChapter(ch.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className={`text-[11px] font-mono w-5 text-center shrink-0 ${
                        isActive ? 'text-accent-amber' : 'text-[#5c5249]'
                      }`}>
                        {index + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-medium truncate transition-colors ${
                          isActive
                            ? 'text-accent-amber'
                            : 'text-[#c5b8ad] group-hover/item:text-[#dcd1c6]'
                        }`}>
                          {ch.title || 'Chương không tên'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <FileText className="h-3 w-3 text-[#5c5249]" />
                        <span className={`text-[11px] font-medium tabular-nums ${
                          words > 0 ? 'text-[#8f7f73]' : 'text-[#3d3630]'
                        }`}>
                          {words > 0 ? `${formatWordCount(words)} chữ` : '—'}
                        </span>
                      </div>

                      <div className={`flex items-center gap-1 shrink-0 ${indicator.color}`} title={indicator.label}>
                        {indicator.icon}
                        <span className="text-[10px] font-medium hidden sm:inline">
                          {indicator.label}
                        </span>
                      </div>
                    </button>
                    {completionAction && onCompleteChapter && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onCompleteChapter(ch.id);
                        }}
                        className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[10px] font-bold text-amber-200 transition hover:bg-amber-300/20"
                        title={completionAction.title}
                      >
                        {completionAction.label}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Removed the redundant creation progress right-side block to simplify UI */}

      {/* Right: Token count + Export */}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {onQualityModeChange ? (
          <label className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11px] text-[#c8beb0]">
            <span className="hidden font-semibold text-[#8f7f73] 2xl:inline">Chất lượng</span>
            <select
              value={qualityMode}
              onChange={(event) => onQualityModeChange(event.target.value as QualityMode)}
              className="bg-transparent font-semibold text-[#f3e6d6] outline-none"
              aria-label="Chất lượng sinh nội dung"
            >
              <option value="fast" className="bg-[#110f0e] text-[#f3e6d6]">Nhanh</option>
              <option value="balanced" className="bg-[#110f0e] text-[#f3e6d6]">Cân bằng</option>
              <option value="quality" className="bg-[#110f0e] text-[#f3e6d6]">Sâu</option>
            </select>
          </label>
        ) : null}
        {sessionTokens > 0 && (
          <div className="hidden h-9 items-center gap-1.5 rounded-full border border-white/[0.06] px-3 text-[12px] font-medium text-accent-amber/80 xl:flex">
            <Zap className="h-3 w-3" />
            <span>{formatTokenCount(sessionTokens)} token</span>
          </div>
        )}

        {onSaveAsTemplate && !hasSavedAsTemplate && (
          <button
            onClick={onSaveAsTemplate}
            disabled={isSavingTemplate}
            className={`flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[#c6a6ff]/30 bg-[#c6a6ff]/10 px-4 text-[13px] font-semibold text-[#c6a6ff] transition active:scale-[0.98] ${
              isSavingTemplate ? 'cursor-wait opacity-70' : 'hover:bg-[#c6a6ff]/20'
            }`}
            title={templateSaveLabel || 'Lưu toàn bộ cốt truyện và nhân vật hiện tại thành một Template dùng chung'}
          >
            {isSavingTemplate ? 'Đang phân tích...' : 'Lưu thành Template'}
          </button>
        )}

        <button
          onClick={onSave}
          disabled={!chapter || (!isDirty && !isSaving)}
          className={`flex h-9 min-w-[88px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.98] ${
            isSaving 
              ? 'bg-accent-amber/50 text-[#1B140F] cursor-wait' 
              : isDirty 
                ? 'bg-accent-amber text-[#1B140F] hover:bg-[#FFDFBA] shadow-[0_0_15px_rgba(240,197,154,0.3)]' 
                : 'bg-[#2a2420] text-[#8f7f73] cursor-not-allowed border border-white/5'
          }`}
        >
          {isSaving ? 'Đang lưu...' : isDirty ? 'Lưu thay đổi' : 'Đã lưu'}
        </button>

        {/* Removed redundant Xuất file button */}
        
        {/* Hidden controls to trigger saves */}
        <div className="hidden">
          <button onClick={onApprove} disabled={!chapter}>Duyệt</button>
        </div>
      </div>
    </div>
  );
};
