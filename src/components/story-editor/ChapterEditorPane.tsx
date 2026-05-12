import React, { useState, useEffect, useRef } from 'react';
import type { Chapter } from '../../types/story';
import type { EditorAiProposal, EditorMode, EditorSelection, EditorSelectionIntent } from './editor_types';
import { Bold, Italic, Quote, Wand2, Search, RotateCcw, Clock3, FileText, PenLine, ChevronUp, ChevronDown, X, Sparkles, Square, ArrowRight, History, Play, Pause, FastForward, ZoomIn, ZoomOut, Maximize, Minimize, Brain, MessageCircle, Scissors, Palette, PencilLine } from 'lucide-react';
import { useGenerationStore } from '../../store/use_generation_store';
import { useAppearanceStore } from '../../store/use_appearance_store';
import * as versionService from '../../lib/supabase/version_service';

interface Props {
  chapter: Chapter | null;
  mode: EditorMode;
  aiProposal: EditorAiProposal | null;
  localContent: string;
  localTitle: string;
  partLabel: string | null;
  wordCount: number;
  readingTimeMinutes: number;
  lastSavedAt: string | null;
  isDirty: boolean;
  emptyStateVariant: 'ai-draft' | 'load-failure' | 'loading';
  isGeneratingFromScratch: boolean;
  isScratchGenerationRunning: boolean;
  isReloadingChapterContent: boolean;
  isRestoringImportedSource: boolean;
  batchProgress: { current: number; total: number; isRunning: boolean } | null;
  emptyChapterCount: number;
  onBatchGenerateAll: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onAcceptProposal: () => void;
  onRejectProposal: () => void;
  onSelectionChange: (selection: EditorSelection | null) => void;
  onSelectionAction: (action: EditorSelectionIntent) => void;
  onGenerateFromScratch: () => void;
  onContinueGeneration?: () => void;
  onStopScratch?: () => void;
  onRetryLoadContent: () => void;
  onRestoreImportedSource: () => void;
  onOpenReimportFlow?: () => void;
  onOpenVersionHistory: () => void;
  hasSelection: boolean;
  onModeChange?: (mode: EditorMode) => void;
  onNextChapter?: () => void;
}

const MODES: Array<{ id: EditorMode; label: string }> = [
  { id: 'write', label: 'Viết' },
  { id: 'read', label: 'Đọc' },
  { id: 'review', label: 'Review' },
];

const SELECTION_INTENT_ACTIONS: Array<{
  id: EditorSelectionIntent;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
    {
      id: 'internal_monologue',
      label: 'Nội tâm',
      title: 'Sửa nội tâm nhân vật trong đoạn đang chọn',
      icon: Brain,
    },
    {
      id: 'dialogue',
      label: 'Lời thoại',
      title: 'Sửa lời thoại và nhịp trao đổi trong đoạn đang chọn',
      icon: MessageCircle,
    },
    {
      id: 'shorten',
      label: 'Cắt ngắn',
      title: 'Cắt gọn đoạn đang chọn nhưng giữ ý chính',
      icon: Scissors,
    },
    {
      id: 'enhance_details',
      label: 'Chi tiết',
      title: 'Tăng chi tiết cảm quan và hành động nhỏ cho đoạn đang chọn',
      icon: Palette,
    },
    {
      id: 'custom',
      label: 'Tự nhập',
      title: 'Tự nhập yêu cầu sửa riêng cho đoạn đang chọn',
      icon: PencilLine,
    },
  ];

export const ChapterEditorPane: React.FC<Props> = ({
  chapter,
  mode,
  aiProposal,
  localContent,
  localTitle,
  partLabel,
  wordCount,
  readingTimeMinutes,
  lastSavedAt,
  isDirty,
  emptyStateVariant,
  isGeneratingFromScratch,
  isScratchGenerationRunning,
  isReloadingChapterContent,
  isRestoringImportedSource,
  batchProgress,
  emptyChapterCount,
  onBatchGenerateAll,
  onTitleChange,
  onContentChange,
  onAcceptProposal,
  onRejectProposal,
  onSelectionChange,
  onSelectionAction,
  onGenerateFromScratch,
  onContinueGeneration,
  onStopScratch,
  onRetryLoadContent,
  onRestoreImportedSource,
  onOpenReimportFlow,
  onOpenVersionHistory,
  hasSelection,
  onModeChange,
  onNextChapter,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAiStreaming = useGenerationStore((s) => s.isStreaming);
  const scratchStreamedText = useGenerationStore((s) => s.scratchStreamedText);
  const [versionCount, setVersionCount] = useState(0);
  const [latestVersionNumber, setLatestVersionNumber] = useState<number | null>(null);
  const [latestVersionCreatedAt, setLatestVersionCreatedAt] = useState<string | null>(null);
  // Word count during streaming
  const streamingWordCount = scratchStreamedText
    ? scratchStreamedText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const isGenerationActionLocked = isGeneratingFromScratch || isScratchGenerationRunning;

  // --- Reading Mode State ---
  const isReadingModeFullscreen = useAppearanceStore((state) => state.isReadingModeFullscreen);
  const toggleReadingModeFullscreen = useAppearanceStore((state) => state.toggleReadingModeFullscreen);
  const readerFontSize = useAppearanceStore((state) => state.readerFontSize);
  const setReaderFontSize = useAppearanceStore((state) => state.setReaderFontSize);

  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [isAutoNextEnabled, setIsAutoNextEnabled] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);

  // Reset scroll and transition state when chapter changes
  useEffect(() => {
    isTransitioningRef.current = false;
    setIsTransitioning(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [chapter?.id]);

  // Ensure robust textarea resizing.
  // Do NOT observe the textarea itself with ResizeObserver: adjusting its height
  // inside the observer callback can retrigger layout/observer cycles and make
  // editor interactions feel frozen on long chapters.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let rafId: number | null = null;

    const adjustHeightNow = () => {
      textarea.style.height = 'auto';
      const nextHeight = `${textarea.scrollHeight}px`;
      if (textarea.style.height !== nextHeight) {
        textarea.style.height = nextHeight;
      }
      rafId = null;
    };

    const scheduleAdjustHeight = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(adjustHeightNow);
    };

    // Initial and on content/style changes
    scheduleAdjustHeight();

    // On font load
    document.fonts?.ready.then(scheduleAdjustHeight);

    // On window resize
    window.addEventListener('resize', scheduleAdjustHeight);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', scheduleAdjustHeight);
    };
  }, [localContent, mode, readerFontSize, isReadingModeFullscreen]);

  // Auto scroll effect
  useEffect(() => {
    if (mode !== 'read' || !isAutoScrolling || !scrollContainerRef.current) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let exactScrollTop = scrollContainerRef.current.scrollTop;

    let isUserInteracting = false;
    let interactionTimeout: NodeJS.Timeout | null = null;

    const container = scrollContainerRef.current;

    const handleInteraction = (e: Event) => {
      // Bỏ qua nếu user đang click vào các nút bấm (như nút bật/tắt auto-scroll)
      if (e.type === 'mousedown') {
        const target = e.target as HTMLElement;
        if (target && target.closest('button')) return;
      }

      isUserInteracting = true;
      if (interactionTimeout) clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(() => {
        isUserInteracting = false;
        if (container) exactScrollTop = container.scrollTop;
      }, 800); // Tạm dừng auto-scroll 800ms khi user tương tác
    };

    container.addEventListener('wheel', handleInteraction, { passive: true });
    container.addEventListener('touchmove', handleInteraction, { passive: true });
    container.addEventListener('mousedown', handleInteraction, { passive: true });
    container.addEventListener('keydown', handleInteraction, { passive: true });

    const scrollLoop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (container) {
        // Đồng bộ nếu user scroll bằng tay
        if (Math.abs(container.scrollTop - Math.round(exactScrollTop)) > 2) {
          exactScrollTop = container.scrollTop;
        }

        const pixelsToScroll = (scrollSpeed * delta) / 16;

        // Only scroll if we are not waiting for the next chapter and user is not interacting
        if (!isTransitioningRef.current && !isUserInteracting) {
          exactScrollTop += pixelsToScroll;
          container.scrollTop = exactScrollTop;
        }

        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
          if (isAutoNextEnabled && !isTransitioningRef.current) {
            isTransitioningRef.current = true;
            setIsTransitioning(true);
            setTimeout(() => {
              onNextChapter?.();
            }, 3000);
          }
          // Nếu không bật Auto-Next, ta cứ để nguyên trạng thái isAutoScrolling = true
          // Vòng lặp vẫn chạy nhưng trình duyệt không cuộn thêm được. 
          // Khi người dùng bấm Next Chapter bằng tay, scrollTop về 0, nó sẽ tự cuộn tiếp!
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactionTimeout) clearTimeout(interactionTimeout);
      container.removeEventListener('wheel', handleInteraction);
      container.removeEventListener('touchmove', handleInteraction);
      container.removeEventListener('mousedown', handleInteraction);
      container.removeEventListener('keydown', handleInteraction);
    };
  }, [mode, isAutoScrolling, scrollSpeed, isAutoNextEnabled, onNextChapter]);

  // --- Find & Replace State ---
  const [showSearch, setShowSearch] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matches, setMatches] = useState<{ start: number; end: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  // Search execution logic
  useEffect(() => {
    if (!showSearch || !findText) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const text = localContent;
    const searchString = findText.toLowerCase();
    const newMatches: { start: number; end: number }[] = [];

    let startIndex = 0;
    while (startIndex < text.length) {
      const index = text.toLowerCase().indexOf(searchString, startIndex);
      if (index === -1) break;
      newMatches.push({ start: index, end: index + searchString.length });
      startIndex = index + searchString.length;
    }

    setMatches(newMatches);

    // Reset index if needed
    if (newMatches.length === 0) {
      setCurrentMatchIndex(-1);
    } else if (currentMatchIndex === -1 || currentMatchIndex >= newMatches.length) {
      setCurrentMatchIndex(0);
    }
  }, [showSearch, findText, localContent]);

  // Focus and select the matched text automatically
  useEffect(() => {
    if (showSearch && matches.length > 0 && currentMatchIndex >= 0) {
      const textarea = textareaRef.current;
      if (textarea) {
        const match = matches[currentMatchIndex];
        textarea.focus();
        textarea.setSelectionRange(match.start, match.end);
      }
    }
  }, [currentMatchIndex, matches, showSearch]);

  useEffect(() => {
    if (!chapter?.id) {
      setVersionCount(0);
      setLatestVersionNumber(null);
      setLatestVersionCreatedAt(null);
      return;
    }

    let cancelled = false;

    void versionService
      .listVersions(chapter.id)
      .then((versions) => {
        if (cancelled) return;
        setVersionCount(versions.length);
        setLatestVersionNumber(versions[0]?.version_number ?? null);
        setLatestVersionCreatedAt(versions[0]?.created_at ?? null);
      })
      .catch((error) => {
        console.warn('[ChapterEditorPane] Failed to load version summary:', error);
        if (cancelled) return;
        setVersionCount(0);
        setLatestVersionNumber(null);
        setLatestVersionCreatedAt(null);
      });

    return () => {
      cancelled = true;
    };
  }, [chapter?.id, lastSavedAt]);

  const handleNextMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  };

  const handlePrevMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  };

  const handleReplace = () => {
    if (matches.length > 0 && currentMatchIndex >= 0) {
      const match = matches[currentMatchIndex];
      const newContent =
        localContent.substring(0, match.start) +
        replaceText +
        localContent.substring(match.end);

      onContentChange(newContent);
    }
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedFind, 'gi');
    const newContent = localContent.replace(regex, replaceText);

    if (newContent !== localContent) {
      onContentChange(newContent);
    }
  };

  const handleSelect = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const text = textarea.value.slice(start, end);
    onSelectionChange({ start, end, text });
  };

  const handleRestoreOriginal = () => {
    onContentChange(chapter?.content || '');
    onModeChange?.('write');
  };

  const handleEditDraft = () => {
    if (aiProposal) {
      onContentChange(aiProposal.content);
    }
    onModeChange?.('write');
  };

  const hasVisibleContent = Boolean(localContent.trim());
  const isInterruptedGeneration =
    Boolean(hasVisibleContent) &&
    (chapter?.generationStatus === 'partial' || chapter?.generationStatus === 'failed');
  const saveLabel = lastSavedAt
    ? `Đã lưu lúc ${new Date(lastSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : 'Chưa lưu';
  const isLoadFailureState = emptyStateVariant === 'load-failure';
  const latestVersionTimeLabel = latestVersionCreatedAt
    ? new Date(latestVersionCreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null;
  const versionFlowLabel = latestVersionNumber != null ? `Mốc lưu v${latestVersionNumber}` : 'Mốc lưu đầu tiên';
  const draftFlowLabel = isDirty ? 'Nháp hiện tại' : 'Bản đang mở';
  const versionHelperText = latestVersionNumber != null
    ? isDirty
      ? `Bạn đang chỉnh trên nháp chưa lưu. Có thể quay lại v${latestVersionNumber} bất cứ lúc nào.`
      : `v${latestVersionNumber}${latestVersionTimeLabel ? ` được lưu lúc ${latestVersionTimeLabel}` : ''} là mốc khôi phục gần nhất.`
    : 'Mỗi lần lưu chương sẽ tạo một mốc để so sánh và khôi phục.';

  if (!chapter) {
    return (
      <div className="flex flex-1 items-center justify-center font-sans">
        <p className="text-[#8f7f73]">Please select a chapter to begin.</p>
      </div>
    );
  }

  // --- Diff Mode Layout ---
  if (mode === 'diff') {
    return (
      <div className="flex h-full flex-col font-sans relative bg-[#110e0c]">
        {/* Header */}
        <div className="pt-14 pb-8 flex flex-col items-center justify-center">
          <h1 className="text-[32px] font-serif font-medium text-text-primary tracking-wide mb-3 text-center px-4">
            {localTitle || chapter.title}
          </h1>
          <div className="flex flex-wrap justify-center items-center gap-4 text-[#8f7f73] text-[13px] font-medium tracking-wide">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Clock3 className="h-[14px] w-[14px]" />
              Last edited 2 hours ago
            </span>
            <span className="text-white/20 hidden sm:inline">•</span>
            <span className="flex items-center gap-2 text-text-primary whitespace-nowrap">
              <FileText className="h-[14px] w-[14px]" />
              Showing 12 changes
            </span>
          </div>
        </div>

        {/* Diff Columns */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-32">
          <div className="mx-auto max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[600px]">

            {/* Version 1 (Original) */}
            <div className="bg-[#1a1715] rounded-[32px] border border-white/[0.04] p-6 sm:p-8 pb-16 flex flex-col items-center shadow-lg">
              {/* Original Header */}
              <div className="flex items-center justify-between w-full max-w-[400px] mb-10">
                <div className="flex items-center gap-3">
                  <span className="whitespace-nowrap flex-shrink-0 bg-white/5 text-[#8f7f73] px-3 sm:px-4 py-1.5 rounded-full text-[12px] sm:text-[13px] font-medium border border-white/5 tracking-wide">
                    Bản gốc
                  </span>
                </div>
                <button onClick={handleRestoreOriginal} className="text-accent-amber hover:text-[#FFDFBA] hover:scale-110 transition p-2 bg-accent-amber/10 hover:bg-accent-amber/20 rounded-full" title="Khôi phục bản gốc">
                  <RotateCcw className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Original Content */}
              <div className="w-full max-w-[400px] text-[17.5px] leading-[2.4] font-serif text-[#c5b8ad] whitespace-pre-wrap">
                {chapter.content || <span className="italic text-[#8f7f73]">Chưa có nội dung.</span>}
              </div>
            </div>

            {/* Version 2 (Current or AI) */}
            <div className="bg-[#1a1715] rounded-[32px] border border-white/[0.04] p-6 sm:p-8 pb-16 flex flex-col items-center shadow-lg">
              {/* V2 Header */}
              <div className="flex items-center justify-between w-full max-w-[400px] mb-10">
                <div className="flex items-center gap-3">
                  <span className="whitespace-nowrap flex-shrink-0 bg-gradient-to-r from-accent-amber to-[#C49A70] text-[#1a120d] px-3 sm:px-4 py-1.5 rounded-full text-[12px] sm:text-[13px] font-bold tracking-wide shadow-[0_0_15px_rgba(240,197,154,0.3)]">
                    {aiProposal ? 'AI Đề xuất' : 'Bản hiện tại'}
                  </span>
                </div>
                <button onClick={handleEditDraft} className="text-[#1a120d] hover:scale-110 transition p-2 bg-gradient-to-r from-accent-amber to-[#C49A70] rounded-full shadow-[0_0_10px_rgba(240,197,154,0.4)]" title={aiProposal ? 'Áp dụng đề xuất' : 'Chỉnh sửa'}>
                  <PenLine className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* V2 Content */}
              <div className="w-full max-w-[400px] text-[17.5px] leading-[2.4] font-serif text-[#c5b8ad] whitespace-pre-wrap">
                {aiProposal ? aiProposal.content : localContent || <span className="italic text-[#8f7f73]">Chưa có nội dung.</span>}
              </div>
            </div>

          </div>
        </div>

        {/* Diff Mode Footer */}
        <div className="absolute bottom-0 w-full left-0 right-0 py-4 bg-[#0c0a09]/80 backdrop-blur-md border-t border-white/5 flex items-center justify-between px-8 text-[11px] font-medium tracking-[0.1em] text-[#8f7f73]">
          <button
            onClick={() => onModeChange?.('write')}
            className="text-[#8f7f73] hover:text-[#c5b8ad] transition px-4 py-2 border border-white/10 rounded-full bg-white/5 uppercase"
          >
            Hủy Diff
          </button>
          <div className="flex items-center gap-6">
            <span className="uppercase text-[#8f7f73]">SO SÁNH BẢN GỐC → {(<span className="text-accent-amber">{aiProposal ? 'AI ĐỀ XUẤT' : 'BẢN HIỆN TẠI'}</span>)}</span>
            {aiProposal && (
              <button
                onClick={() => {
                  onAcceptProposal();
                  onModeChange?.('write');
                }}
                className="text-accent-amber uppercase font-bold tracking-[0.15em] hover:text-[#FFDFBA] transition px-4 py-2"
              >
                DUYỆT ĐỀ XUẤT
              </button>
            )}
          </div>
        </div>

      </div>
    );
  }

  // --- Normal Write/Read/Review Mode Layout ---
  return (
    <div className="flex h-full flex-col font-sans relative">
      {/* Scrollable Content */}
      <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto px-4 pt-2 sm:px-10 flex flex-col items-center relative ${isReadingModeFullscreen ? 'pb-6' : 'pb-16'}`}>

        {/* Find & Replace Floating Panel */}
        {showSearch && (
          <div className="absolute top-4 right-10 z-20 w-[320px] bg-[#1a1715] rounded-[24px] border border-white/10 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[12px] font-bold tracking-[0.1em] text-[#8f7f73] uppercase">Tìm & Thay thế</span>
              <button onClick={() => setShowSearch(false)} className="text-[#8f7f73] hover:text-[#c5b8ad]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="w-full bg-[#110e0c] border border-white/5 rounded-xl px-4 py-2.5 text-[13px] text-[#e3d8ce] placeholder:text-[#5c5249] outline-none focus:border-accent-amber/40"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#8f7f73]">
                  <span className="text-[11px] mr-1">{matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}</span>
                  <button onClick={handlePrevMatch} className="hover:text-accent-amber transition p-0.5"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={handleNextMatch} className="hover:text-accent-amber transition p-0.5"><ChevronDown className="w-4 h-4" /></button>
                </div>
              </div>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Thay thế bằng..."
                className="w-full bg-[#110e0c] border border-white/5 rounded-xl px-4 py-2.5 text-[13px] text-[#e3d8ce] placeholder:text-[#5c5249] outline-none focus:border-accent-amber/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReplace}
                disabled={matches.length === 0}
                className="flex-1 py-2 text-[12px] font-medium text-[#110e0c] bg-accent-amber hover:bg-[#FFDFBA] transition rounded-lg opacity-90 hover:opacity-100 disabled:opacity-30 disabled:hover:bg-accent-amber"
              >
                Thay thế
              </button>
              <button
                onClick={handleReplaceAll}
                disabled={matches.length === 0}
                className="flex-[1.5] py-2 text-[12px] font-medium text-[#c5b8ad] bg-white/5 hover:bg-white/10 border border-white/5 transition rounded-lg disabled:opacity-30 disabled:hover:bg-white/5"
              >
                Thay thế tất cả
              </button>
            </div>
          </div>
        )}

        {/* Title Area */}
        <div className={`w-full ${isReadingModeFullscreen ? 'max-w-[1000px]' : 'max-w-[760px]'} mb-2`}>
          {partLabel && (
            <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-[#8f7f73] sm:text-[12px]">
              {partLabel}
            </div>
          )}
          <textarea
            value={localTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full resize-none border-none bg-transparent font-serif text-[26px] font-medium leading-[1.12] text-text-primary outline-none placeholder:text-[#685c52] sm:text-[28px] lg:text-[30px]"
            placeholder="Tên chương..."
            rows={1}
            style={{ height: 'auto', minHeight: '38px' }}
          />
        </div>

        {/* Floating Toolbars Container */}
        <div className={`relative z-10 mb-4 flex w-full ${isReadingModeFullscreen ? 'max-w-[1000px]' : 'max-w-[760px]'} flex-wrap items-center justify-between gap-3`}>

          {/* Left: Mode Switcher & Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full bg-[#1b1715]/90 backdrop-blur-sm p-1 border border-white/5 shadow-ambient">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onModeChange?.(item.id as EditorMode)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition sm:px-4 ${(mode === item.id || ((mode === 'write' || mode === 'detail') && item.id === 'write'))
                    ? 'bg-[#2a2420] text-text-primary shadow-sm border border-white/5'
                    : 'text-[#8f7f73] hover:text-[#c8beb0]'
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`rounded-full p-2 transition border border-white/5 shadow-ambient backdrop-blur-sm ${showSearch ? 'bg-[#2a2420] text-accent-amber' : 'bg-[#1b1715]/90 text-[#8f7f73] hover:text-[#c8beb0]'}`}
              title="Tìm kiếm & Thay thế"
            >
              <Search className="h-[14px] w-[14px]" />
            </button>
          </div>

          {mode === 'read' && (
            <div className="flex items-center gap-2 rounded-full bg-[#1b1715]/90 backdrop-blur-sm p-1 border border-white/5 shadow-ambient">
              <button onClick={() => setReaderFontSize(Math.max(12, readerFontSize - 2))} className="p-1.5 text-[#8f7f73] hover:text-[#c8beb0] transition rounded-full" title="Thu nhỏ">
                <ZoomOut className="h-[14px] w-[14px]" />
              </button>
              <span className="text-[12px] text-[#8f7f73] font-medium w-4 text-center">{readerFontSize}</span>
              <button onClick={() => setReaderFontSize(Math.min(32, readerFontSize + 2))} className="p-1.5 text-[#8f7f73] hover:text-[#c8beb0] transition rounded-full" title="Phóng to">
                <ZoomIn className="h-[14px] w-[14px]" />
              </button>
              <div className="w-[1px] h-3 bg-white/10 mx-1" />
              <button onClick={() => setIsAutoScrolling(!isAutoScrolling)} className={`p-1.5 transition rounded-full ${isAutoScrolling ? 'bg-accent-amber/20 text-accent-amber' : 'text-[#8f7f73] hover:text-[#c8beb0]'}`} title={isAutoScrolling ? "Dừng cuộn" : "Tự động cuộn"}>
                {isAutoScrolling ? <Pause className="h-[14px] w-[14px]" /> : <Play className="h-[14px] w-[14px]" />}
              </button>
              <button onClick={() => setScrollSpeed(s => s >= 3 ? 1 : s + 1)} className="p-1.5 text-[#8f7f73] hover:text-[#c8beb0] transition rounded-full flex items-center gap-1" title={`Tốc độ: ${scrollSpeed}x`}>
                <FastForward className="h-[14px] w-[14px]" />
                <span className="text-[10px]">{scrollSpeed}x</span>
              </button>
              <div className="w-[1px] h-3 bg-white/10 mx-1" />
              <button onClick={() => setIsAutoNextEnabled(!isAutoNextEnabled)} className={`px-3 py-1 text-[11px] font-medium transition rounded-full ${isAutoNextEnabled ? 'bg-accent-amber/20 text-accent-amber' : 'text-[#8f7f73] hover:text-[#c8beb0]'}`} title="Tự động Next chương khi đọc xong">
                Auto-Next
              </button>
              <div className="w-[1px] h-3 bg-white/10 mx-1" />
              <button onClick={toggleReadingModeFullscreen} className={`p-1.5 transition rounded-full ${isReadingModeFullscreen ? 'bg-accent-amber/20 text-accent-amber' : 'text-[#8f7f73] hover:text-[#c8beb0]'}`} title={isReadingModeFullscreen ? "Thu nhỏ" : "Toàn màn hình"}>
                {isReadingModeFullscreen ? <Minimize className="h-[14px] w-[14px]" /> : <Maximize className="h-[14px] w-[14px]" />}
              </button>
            </div>
          )}

          {/* Right: Contextual Format + AI Toolbar (Visible only on select) */}
          <div className={`transition-all duration-300 ${hasSelection ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            <div className="flex items-center gap-0.5 rounded-full bg-[#1b1715]/95 backdrop-blur-md p-0.5 border border-accent-amber/20 shadow-[0_4px_20px_rgba(240,197,154,0.15)]">
              {/* Native formats */}
              <div className="flex items-center px-1">
                <button className="p-1.5 text-[#8f7f73] hover:text-[#c8beb0] transition rounded-full">
                  <Bold className="h-[13px] w-[13px]" />
                </button>
                <button className="p-1.5 text-[#8f7f73] hover:text-[#c8beb0] transition rounded-full">
                  <Italic className="h-[13px] w-[13px]" />
                </button>
                <button className="p-1.5 text-[#8f7f73] hover:text-[#c8beb0] transition rounded-full">
                  <Quote className="h-[13px] w-[13px]" />
                </button>
              </div>

              <div className="w-[1px] h-3 bg-white/10 mx-1" />

              {/* AI Intent Actions */}
              <div className="flex items-center gap-0.5 pr-1">
                <div className="flex items-center gap-1.5 px-1.5 text-accent-amber/60">
                  <Wand2 className="h-[11px] w-[11px]" />
                </div>
                {SELECTION_INTENT_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => onSelectionAction(action.id)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-[#c5b8ad] transition hover:bg-white/5 hover:text-accent-amber"
                      title={action.title}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="whitespace-nowrap">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Editor Card Area */}
        <div className={`flex w-full ${isReadingModeFullscreen ? 'max-w-[1100px] min-h-[80vh]' : 'max-w-[820px]'} grow shrink-0 flex-col rounded-[28px] border border-white/[0.03] bg-[#161311] px-8 pb-6 pt-8 shadow-2xl transition-all duration-300 sm:px-10`}>
          {/* Streaming indicator — shows when AI is actively generating */}
          {isAiStreaming && !isGeneratingFromScratch && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-accent-amber/15 bg-accent-amber/5 px-5 py-3">
              <Sparkles className="h-4 w-4 text-accent-amber animate-pulse" />
              <span className="text-[13px] font-medium text-accent-amber/90">
                Trợ lý AI đang viết... Bạn có thể theo dõi ở panel bên phải.
              </span>
            </div>
          )}

          {/* Scratch streaming banner — shown when AI is writing directly into the editor */}
          {isGeneratingFromScratch && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-accent-amber/30 bg-gradient-to-r from-accent-amber/10 to-[#c49a70]/5 px-5 py-3 shadow-[0_0_20px_rgba(240,197,154,0.1)]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-amber opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-amber" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-accent-amber">
                    AI đang viết chương...
                  </p>
                  {streamingWordCount > 0 && (
                    <p className="text-[11px] text-accent-amber/60 mt-0.5">
                      {streamingWordCount.toLocaleString()} từ
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onStopScratch}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-bold text-red-400 transition hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/50"
                title="Dừng tạo nội dung"
              >
                <Square className="h-3 w-3 fill-current" />
                Dừng
              </button>
            </div>
          )}
          {isInterruptedGeneration && !isGeneratingFromScratch && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-amber-200">
                  Chương này đang tạo dở.
                </p>
                <p className="mt-0.5 text-[11px] text-amber-200/70">
                  Nội dung hiện có mới {wordCount.toLocaleString('vi-VN')} từ. Có thể tiếp tục từ câu cuối thay vì viết lại từ đầu.
                </p>
              </div>
              {onContinueGeneration && (
                <button
                  type="button"
                  onClick={onContinueGeneration}
                  disabled={batchProgress?.isRunning}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-[12px] font-bold text-[#2a1c14] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Tiếp tục
                </button>
              )}
            </div>
          )}
          {!hasVisibleContent && (
            <div className="mb-8 rounded-[28px] border border-accent-amber/15 bg-accent-amber/5 px-6 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-amber/80">
                    {emptyStateVariant === 'loading'
                      ? 'Đang tải nội dung'
                      : isLoadFailureState ? 'Lỗi tải nội dung' : 'Chương trống'}
                  </p>
                  <p className="mt-2 text-[18px] font-semibold text-[#f2e7dc]">
                    {emptyStateVariant === 'loading'
                      ? 'Đang tải nội dung chương từ bộ nhớ...'
                      : isLoadFailureState
                        ? 'Chương này đáng ra đã có nội dung, nhưng hiện đang lỗi tải.'
                        : 'Chương này mới có khung, chưa có bản thảo chi tiết.'}
                  </p>
                  <p className="mt-1 max-w-[540px] text-[13px] leading-6 text-[#b9aca0]">
                    {emptyStateVariant === 'loading'
                      ? 'Hệ thống đang nạp lại nội dung từ storage. Vui lòng chờ trong giây lát.'
                      : isLoadFailureState
                        ? 'Đây là project phóng tác/upload. Hãy thử reload từ storage; nếu vẫn lỗi, có thể khôi phục lại toàn bộ chapters từ snapshot import gần nhất.'
                        : 'Bạn có thể tự viết tay hoặc yêu cầu AI dựng lại chương từ đầu dựa trên outline, canon và ngữ cảnh đã chốt.'}
                  </p>
                </div>

                {emptyStateVariant === 'loading' ? (
                  <div className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-amber/20 px-5 py-3 text-[13px] font-bold text-accent-amber">
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    Đang tải...
                  </div>
                ) : isLoadFailureState ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={onRetryLoadContent}
                      disabled={isReloadingChapterContent}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-amber px-5 py-3 text-[13px] font-bold text-[#2a1c14] transition hover:bg-[#ffd7ab] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RotateCcw className={`h-4 w-4 ${isReloadingChapterContent ? 'animate-spin' : ''}`} />
                      {isReloadingChapterContent ? 'Đang tải lại nội dung...' : 'Tải lại nội dung'}
                    </button>
                    <button
                      type="button"
                      onClick={onRestoreImportedSource}
                      disabled={isReloadingChapterContent || isRestoringImportedSource}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-5 py-3 text-[13px] font-bold text-accent-amber transition hover:bg-accent-amber/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <History className={`h-4 w-4 ${isRestoringImportedSource ? 'animate-spin' : ''}`} />
                      {isRestoringImportedSource ? 'Đang khôi phục bản import...' : 'Khôi phục bản import gần nhất'}
                    </button>
                    <button
                      type="button"
                      onClick={onGenerateFromScratch}
                      disabled={isGenerationActionLocked || isReloadingChapterContent || isRestoringImportedSource || batchProgress?.isRunning}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-5 py-3 text-[13px] font-bold text-accent-amber transition hover:bg-accent-amber/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Wand2 className={`h-4 w-4 ${isGeneratingFromScratch ? 'animate-pulse' : ''}`} />
                      {isGeneratingFromScratch ? 'AI đang dựng chương...' : 'AI tạo lại từ đầu'}
                    </button>
                    {onOpenReimportFlow ? (
                      <button
                        type="button"
                        onClick={onOpenReimportFlow}
                        disabled={isReloadingChapterContent || isRestoringImportedSource}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-[13px] font-bold text-[#f2e7dc] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Import lại & ghi đè
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={onGenerateFromScratch}
                      disabled={isGenerationActionLocked || batchProgress?.isRunning}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-amber px-5 py-3 text-[13px] font-bold text-[#2a1c14] transition hover:bg-[#ffd7ab] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Wand2 className={`h-4 w-4 ${isGeneratingFromScratch ? 'animate-pulse' : ''}`} />
                      {isGeneratingFromScratch ? 'AI đang dựng chương...' : 'AI tạo lại từ đầu'}
                    </button>
                    {emptyChapterCount > 1 && (
                      <button
                        type="button"
                        onClick={onBatchGenerateAll}
                        disabled={isGenerationActionLocked || batchProgress?.isRunning}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-5 py-3 text-[13px] font-bold text-accent-amber transition hover:bg-accent-amber/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Sparkles className={`h-4 w-4 ${batchProgress?.isRunning ? 'animate-pulse' : ''}`} />
                        {batchProgress?.isRunning
                          ? `Đang viết ${batchProgress.current}/${batchProgress.total} chương...`
                          : `Viết tất cả ${emptyChapterCount} chương trống`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => mode === 'write' && onContentChange(e.target.value)}
            onSelect={handleSelect}
            readOnly={mode !== 'write'}
            className={`grow shrink-0 ${isReadingModeFullscreen ? 'min-h-[75vh]' : 'min-h-[400px]'} w-full resize-none border-none bg-transparent pr-3 font-serif text-[18px] leading-[2] outline-none placeholder:text-[#5c5249] selection:bg-accent-amber/20 selection:text-accent-amber transition-colors text-[#dcd1c6] sm:text-[19px] overflow-hidden`}
            style={{ fontSize: mode === 'read' ? `${readerFontSize}px` : undefined }}
            placeholder="Bắt đầu viết chương của bạn tại đây..."
          />

          {/* Auto-Next Transition Indicator */}
          <div className={`mt-4 flex w-full flex-col items-center justify-center overflow-hidden transition-all duration-500 ease-in-out ${isTransitioning ? 'opacity-100 max-h-[100px] py-4' : 'opacity-0 max-h-0 py-0'}`}>
            <div className="flex items-center gap-3 rounded-full bg-[#1b1715]/90 border border-accent-amber/20 px-5 py-2.5 shadow-[0_4px_20px_rgba(240,197,154,0.1)]">
              <RotateCcw className="h-4 w-4 animate-spin text-accent-amber" />
              <span className="text-[13px] font-medium text-accent-amber">Đang chuẩn bị sang chương tiếp theo...</span>
            </div>
            <div className="mt-3 h-1 w-48 overflow-hidden rounded-full bg-white/5 relative">
              <div
                className="absolute left-0 top-0 h-full bg-accent-amber/60 rounded-full"
                style={{
                  width: isTransitioning ? '100%' : '0%',
                  transition: isTransitioning ? 'width 3s linear' : 'none'
                }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Footer / Version flow */}
      {!isReadingModeFullscreen && (
        <div className="shrink-0 border-t border-white/5 bg-[#0c0a09]/80 backdrop-blur-md">
          <div className="flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f7f73]">
                  Phiên bản
                </span>
                <span className="rounded-full border border-white/5 bg-[#1f1a18] px-3 py-1 text-[12px] text-[#c8beb0]">
                  {versionFlowLabel}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#5f544b]" />
                <span className={`rounded-full border px-3 py-1 text-[12px] ${isDirty
                  ? 'border-accent-amber/20 bg-[#362a22] text-accent-amber'
                  : 'border-white/5 bg-[#181412] text-[#c8beb0]'
                  }`}>
                  {draftFlowLabel}
                </span>
                {aiProposal && (
                  <>
                    <ArrowRight className="h-3.5 w-3.5 text-[#5f544b]" />
                    <span className="rounded-full border border-accent-amber/20 bg-[#362a22] px-3 py-1 text-[12px] text-accent-amber shadow-[0_0_10px_rgba(240,197,154,0.1)]">
                      AI đề xuất
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[12px] text-[#8f7f73]">
                {versionHelperText}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#8f7f73] sm:justify-end">
              <span>{saveLabel}</span>
              <span className="hidden text-white/15 sm:inline">•</span>
              <span>{wordCount.toLocaleString()} từ</span>
              <span className="hidden text-white/15 sm:inline">•</span>
              <span>~{readingTimeMinutes} phút đọc</span>
              <button
                type="button"
                onClick={onOpenVersionHistory}
                className="ml-0 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-[#c8beb0] transition hover:border-accent-amber/20 hover:text-accent-amber sm:ml-2"
              >
                <History className="h-3.5 w-3.5" />
                {versionCount > 0 ? `Lịch sử (${versionCount})` : 'Lịch sử phiên bản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
