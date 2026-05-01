import React, { useState, useEffect, useRef } from 'react';
import type { Chapter } from '../../types/story';
import type { EditorAiProposal, EditorMode, EditorSelection } from './editor_types';
import { Bold, Italic, Quote, Wand2, Search, RotateCcw, Clock3, FileText, PenLine, ChevronUp, ChevronDown, X, Sparkles, Square } from 'lucide-react';
import { useGenerationStore } from '../../store/use_generation_store';

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
  emptyStateVariant: 'ai-draft' | 'load-failure' | 'loading';
  isGeneratingFromScratch: boolean;
  isReloadingChapterContent: boolean;
  batchProgress: { current: number; total: number; isRunning: boolean } | null;
  emptyChapterCount: number;
  onBatchGenerateAll: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onAcceptProposal: () => void;
  onRejectProposal: () => void;
  onSelectionChange: (selection: EditorSelection | null) => void;
  onSelectionAction: (action: string) => void;
  onGenerateFromScratch: () => void;
  onStopScratch?: () => void;
  onRetryLoadContent: () => void;
  hasSelection: boolean;
  onModeChange?: (mode: EditorMode) => void;
}

const MODES: Array<{ id: EditorMode; label: string }> = [
  { id: 'write', label: 'Viết' },
  { id: 'read', label: 'Đọc' },
  { id: 'review', label: 'Review' },
  { id: 'diff', label: 'Diff' },
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
  emptyStateVariant,
  isGeneratingFromScratch,
  isReloadingChapterContent,
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
  onStopScratch,
  onRetryLoadContent,
  hasSelection,
  onModeChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isAiStreaming = useGenerationStore((s) => s.isStreaming);
  const scratchStreamedText = useGenerationStore((s) => s.scratchStreamedText);
  // Word count during streaming
  const streamingWordCount = scratchStreamedText
    ? scratchStreamedText.trim().split(/\s+/).filter(Boolean).length
    : 0;

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
  const saveLabel = lastSavedAt
    ? `Đã lưu lúc ${new Date(lastSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : 'Chưa lưu';
  const isLoadFailureState = emptyStateVariant === 'load-failure';

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
      <div className="flex-1 overflow-y-auto px-10 pt-16 pb-32 flex flex-col items-center relative">
        
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
        <div className="w-full max-w-[680px] mb-8">
          {partLabel && (
            <div className="text-[13px] uppercase tracking-[0.2em] text-[#8f7f73] mb-3">
              {partLabel}
            </div>
          )}
          <textarea
            value={localTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full resize-none border-none bg-transparent font-serif text-[40px] font-medium leading-[1.2] text-text-primary outline-none placeholder:text-[#685c52]"
            placeholder="Tên chương..."
            rows={1}
            style={{ height: 'auto', minHeight: '60px' }}
          />
        </div>

        {/* Floating Toolbars Container */}
        <div className="w-full max-w-[680px] flex justify-between items-center mb-[-20px] relative z-10 gap-3">
          
          {/* Left: Mode Switcher & Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full bg-[#1b1715]/90 backdrop-blur-sm p-1 border border-white/5 shadow-ambient">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onModeChange?.(item.id as EditorMode)}
                  className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition ${
                    (mode === item.id || (mode === 'write' && item.id === 'write'))
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
              
              {/* AI Actions */}
              <div className="flex items-center gap-0.5 pr-1">
                <div className="px-1.5 flex items-center gap-1.5 text-accent-amber/60">
                   <Wand2 className="h-[11px] w-[11px]" />
                </div>
                {['Viết lại', 'Rút gọn', 'Phân tích'].map((action) => (
                  <button 
                    key={action}
                    onClick={() => onSelectionAction(action)}
                    className="px-2.5 py-1 text-[11px] font-medium text-[#c5b8ad] hover:text-accent-amber hover:bg-white/5 rounded-full transition whitespace-nowrap"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Editor Card Area */}
        <div className="w-full max-w-[760px] bg-[#161311] rounded-[40px] px-12 pt-20 pb-16 shadow-2xl border border-white/[0.03] transition-colors duration-300">
          {/* Streaming indicator — shows when AI is actively generating */}
          {isAiStreaming && !isGeneratingFromScratch && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-accent-amber/15 bg-accent-amber/5 px-5 py-3">
              <Sparkles className="h-4 w-4 text-accent-amber animate-pulse" />
              <span className="text-[13px] font-medium text-accent-amber/90">
                Nàng Thơ đang viết... Bạn có thể theo dõi ở panel bên phải.
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
                      ? 'Đây là project phóng tác/upload nên không tự động dựng lại bằng AI. Hãy thử tải lại nội dung từ storage trước.'
                      : 'Bạn có thể tự viết tay hoặc yêu cầu AI dựng lại chương từ đầu dựa trên outline, canon và ngữ cảnh đã chốt.'}
                  </p>
                </div>

                {emptyStateVariant === 'loading' ? (
                  <div className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-amber/20 px-5 py-3 text-[13px] font-bold text-accent-amber">
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    Đang tải...
                  </div>
                ) : isLoadFailureState ? (
                  <button
                    type="button"
                    onClick={onRetryLoadContent}
                    disabled={isReloadingChapterContent}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-amber px-5 py-3 text-[13px] font-bold text-[#2a1c14] transition hover:bg-[#ffd7ab] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw className={`h-4 w-4 ${isReloadingChapterContent ? 'animate-spin' : ''}`} />
                    {isReloadingChapterContent ? 'Đang tải lại nội dung...' : 'Tải lại nội dung'}
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={onGenerateFromScratch}
                      disabled={isGeneratingFromScratch || batchProgress?.isRunning}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-amber px-5 py-3 text-[13px] font-bold text-[#2a1c14] transition hover:bg-[#ffd7ab] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Wand2 className={`h-4 w-4 ${isGeneratingFromScratch ? 'animate-pulse' : ''}`} />
                      {isGeneratingFromScratch ? 'AI đang dựng chương...' : 'AI tạo lại từ đầu'}
                    </button>
                    {emptyChapterCount > 1 && (
                      <button
                        type="button"
                        onClick={onBatchGenerateAll}
                        disabled={isGeneratingFromScratch || batchProgress?.isRunning}
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
            className={`w-full min-h-[500px] resize-none border-none bg-transparent font-serif text-[19px] leading-[2.2] outline-none placeholder:text-[#5c5249] selection:bg-accent-amber/20 selection:text-accent-amber transition-colors text-[#dcd1c6]`}
            placeholder="Bắt đầu viết chương của bạn tại đây..."
          />
        </div>

      </div>

      {/* Footer / Versions timeline */}
      <div className="absolute bottom-0 w-full left-0 right-0 bg-[#0c0a09]/80 backdrop-blur-md border-t border-white/5">
        
        {/* Timeline Row */}
        <div className="flex items-center justify-center py-4 border-b border-white/[0.02] gap-4 w-full">
           <span className="text-[11px] font-semibold tracking-[0.1em] text-[#8f7f73] mr-4">PHIÊN BẢN</span>
           {aiProposal ? (
             <>
               <button className="px-4 py-1.5 rounded-full text-[12px] transition bg-[#1f1a18] text-[#8f7f73] border border-white/5">
                 Bản hiện tại
               </button>
               <div className="w-8 h-[1px] bg-white/10" />
               <button className="px-4 py-1.5 rounded-full text-[12px] transition bg-[#362a22] text-accent-amber border border-accent-amber/20 shadow-[0_0_10px_rgba(240,197,154,0.1)]">
                 AI Đề xuất
               </button>
             </>
           ) : (
             <button className="px-4 py-1.5 rounded-full text-[12px] transition bg-[#362a22] text-accent-amber border border-accent-amber/20 shadow-[0_0_10px_rgba(240,197,154,0.1)]">
               Bản hiện tại
             </button>
           )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between px-8 py-3 text-[12px] text-[#8f7f73]">
           <span>{saveLabel}</span>
           <div className="flex items-center gap-6">
             <span>{wordCount.toLocaleString()} từ</span>
             <span>~{readingTimeMinutes} phút đọc</span>
           </div>
        </div>

      </div>
    </div>
  );
};
