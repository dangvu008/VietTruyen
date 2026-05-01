/**
 * File: AIAssistantPanel.tsx
 * Purpose: Unified right panel — Chapter list (outermost tab) + AI Muse chat with streaming
 * Layer: UI
 * Domain: StoryEditor → Right Panel
 * Deps: editor_types, use_ai_store, model_router, streaming_ai_client, use_generation_store, plot_qa
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIReviewSummary, EditorAiProposal, EditorSelection, PromptScope } from './editor_types';
import type { ChatMessage, ChapterUIStatus, ProjectInfo } from './editor_types';
import type { Chapter, Project } from '../../types/story';
import { isPlotQuestion, answerPlotQuestion } from '../../lib/ai/plot_qa';
import { useAiStore } from '../../store/use_ai_store';
import { getModelForTask, type AiTaskType } from '../../lib/ai/model_router';
import { callAiStreaming } from '../../lib/ai/streaming_ai_client';
import { AiConnectionDebugPanel } from '../shared/AiConnectionDebugPanel';
import { NovelPolishTool } from './NovelPolishTool';
import {
  buildPromptScopeContext,
  getPromptScopeLabel,
  getPromptScopeHelper,
  PROMPT_SCOPE_OPTIONS,
} from './editor_prompt_context';
import { buildStoryEditorChatTranscript } from './story_editor_chat_history';
import { useGenerationStore, buildResumePrompt } from '../../store/use_generation_store';
import {
  buildNovelPolishInstruction,
  getNovelPolishMode,
  type NovelPolishModeId,
} from '../../lib/ai/novel_polish';
import {
  AlertCircle,
  Book,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Filter,
  Loader2,
  MoreVertical,
  Send,
  Sparkles,
  Trash2,
  Zap,
  Plus,
  Crosshair,
  Search,
  Square,
  Play,
  X,
} from 'lucide-react';
import { createId } from '../../core/id';

/* ── Status badge styling ─────────────────────────────── */
const STATUS_META: Record<ChapterUIStatus, { label: string; badge: string; dot: string }> = {
  empty: {
    label: 'Trống',
    badge: 'border-white/10 bg-white/[0.03] text-[#8f7f73]',
    dot: 'bg-white/20',
  },
  'ai-draft': {
    label: 'AI nháp',
    badge: 'border-[#c6a6ff]/15 bg-[#c6a6ff]/10 text-[#ceb9f4]',
    dot: 'bg-[#c6a6ff]',
  },
  reviewing: {
    label: 'Đang sửa',
    badge: 'border-[#f0c59a]/15 bg-[#f0c59a]/10 text-[#f0c59a]',
    dot: 'bg-[#f0c59a]',
  },
  edited: {
    label: 'Đã viết',
    badge: 'border-[#90b7ff]/15 bg-[#90b7ff]/10 text-[#a8c6ff]',
    dot: 'bg-[#90b7ff]',
  },
  approved: {
    label: 'Hoàn tất',
    badge: 'border-[#69d2a4]/15 bg-[#69d2a4]/10 text-[#7ce0b3]',
    dot: 'bg-[#69d2a4]',
  },
  published: {
    label: 'Đã xuất bản',
    badge: 'border-[#7fd7ff]/15 bg-[#7fd7ff]/10 text-[#9addff]',
    dot: 'bg-[#7fd7ff]',
  },
};

interface Props {
  /* AI Chat props */
  chapterContent: string;
  chapterTitle: string;
  reviewSummary?: AIReviewSummary;
  selection: EditorSelection | null;
  activeProposal: EditorAiProposal | null;
  prefillPrompt: string;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onAiResponse: (payload: { content: string; scope: PromptScope; prompt: string }) => void;
  onOpenReview: () => void;
  sessionTokens: number;

  /* Chapter list props */
  project: ProjectInfo;
  /** Full project data for Plot Q&A — contains characters, chapters, outline etc. */
  fullProject?: Project;
  chapters: Chapter[];
  selectedChapterId: string | null;
  statusMap: Record<string, ChapterUIStatus>;
  onSelectChapter: (id: string) => void;
  onNewChapter: () => void;
  onInsertChapter: (sequenceNumber: number) => void;
  onDeleteChapter?: (id: string) => Promise<void> | void;
  onDuplicateChapter?: (chapter: Chapter) => Promise<void> | void;
  onMoveChapterUp?: (id: string) => Promise<void> | void;
  onMoveChapterDown?: (id: string) => Promise<void> | void;
}

type RightPanelTab = 'chapters' | 'muse';

const QUICK_ACTIONS = [
  { label: 'Viết tiếp', icon: '✍️', prompt: 'Viết tiếp chương này với nhịp kể tự nhiên và giữ đúng giọng văn hiện tại.' },
  { label: 'Review', icon: '🔍', prompt: 'Review nội dung chương này, chỉ ra điểm mạnh và điểm cần cải thiện.' },
  { label: 'Plot Q&A', icon: '💡', prompt: 'Hãy trả lời câu hỏi về cốt truyện, nhân vật hoặc diễn biến. Tôi muốn hỏi:' },
];

interface GenerateOptions {
  instructionOverride?: string;
  scopeOverride?: PromptScope;
  taskType?: AiTaskType;
  createProposal?: boolean;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

export function AIAssistantPanel(props: Props) {
  const {
    chapterContent,
    chapterTitle,
    selection,
    prefillPrompt,
    messages,
    onMessagesChange,
    onAiResponse,
    sessionTokens,
    project,
    fullProject,
    chapters,
    selectedChapterId,
    statusMap,
    onSelectChapter,
    onNewChapter,
    onInsertChapter,
    onDeleteChapter,
    onDuplicateChapter,
    onMoveChapterUp,
    onMoveChapterDown,
  } = props;

  const [activeTab, setActiveTab] = useState<RightPanelTab>('muse');
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState<PromptScope>('chapter');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [polishAutoCollapseSignal, setPolishAutoCollapseSignal] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // [Domain:StoryEditor] Chapter management state
  const [chapterMenuId, setChapterMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [chapterFilterStatus, setChapterFilterStatus] = useState<ChapterUIStatus | 'all'>('all');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chapterMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setChapterMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chapterMenuId]);

  // [Domain:StoryEditor] STEP — Streaming generation state
  const {
    isStreaming,
    streamedText,
    canResume,
    streamingMessageId,
    startStream,
    appendChunk,
    stopStream,
    getResumePayload,
    consumeResume,
    finishStream,
    reset: resetGeneration,
  } = useGenerationStore();
  const [chapterQuery, setChapterQuery] = useState('');

  const { models, activeModelId, taskModelOverrides } = useAiStore();
  const editorModel = useMemo(
    () => getModelForTask('editor', models, undefined, activeModelId, taskModelOverrides),
    [models, activeModelId, taskModelOverrides],
  );
  const polishModel = useMemo(
    () => getModelForTask('polish_style', models, undefined, activeModelId, taskModelOverrides),
    [models, activeModelId, taskModelOverrides],
  );

  // [Domain:StoryEditor] STEP 1 — Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // [Domain:StoryEditor] STEP 2 — Prefill prompt from selection actions
  useEffect(() => {
    if (!prefillPrompt) return;
    setPrompt(prefillPrompt);
    setActiveTab('muse');
    setPolishAutoCollapseSignal((current) => current + 1);
    if (selection?.text.trim()) {
      setScope('fragment');
    }
  }, [prefillPrompt, selection]);

  // [Domain:StoryEditor] STEP 3 — Auto-adjust scope based on selection
  useEffect(() => {
    if (selection?.text.trim()) {
      setScope((current) => (current === 'chapter' || current === 'story' ? current : 'fragment'));
    }
  }, [selection]);

  /* ── Chapter list helpers ──────────────────────────── */
  const chapterEntries = useMemo(() => {
    const keyword = chapterQuery.trim().toLowerCase();
    return chapters
      .map((chapter, index) => ({
        chapter,
        sequence: chapter.sequenceNumber ?? index + 1,
        status: statusMap[chapter.id] ?? ('empty' as ChapterUIStatus),
      }))
      .filter(({ chapter, sequence }) => {
        if (!keyword) return true;
        const searchable = `${chapter.title || `Chương ${sequence}`} ${chapter.summary || ''}`.toLowerCase();
        return searchable.includes(keyword);
      });
  }, [chapters, chapterQuery, statusMap]);

  const handleInsertToDraft = useCallback((content: string) => {
    onAiResponse({
      content,
      scope: 'chapter',
      prompt: '(Chèn từ chat history)',
    });
  }, [onAiResponse]);

  const handleCopyMessage = useCallback((content: string) => {
    void navigator.clipboard.writeText(content);
  }, []);

  // [Domain:StoryEditor] STEP 4 — Send message with streaming AI response
  // [Domain:StoryEditor] STEP — Detect if user instruction is a plot/character question
  const detectIsQuestion = useCallback((text: string): boolean => {
    if (fullProject && isPlotQuestion(text, fullProject)) return true;
    // Fallback: detect common Vietnamese question patterns
    const normalized = text.toLowerCase();
    const questionPatterns = [
      '?', 'là ai', 'ở đâu', 'khi nào', 'tại sao', 'vì sao', 'bao nhiêu',
      'xuất hiện', 'kết cục', 'ra sao', 'thế nào', 'chương nào',
      'ai là', 'có ai', 'diễn biến', 'tóm tắt', 'review',
    ];
    return questionPatterns.some((p) => normalized.includes(p));
  }, [fullProject]);

  const handleGenerate = async (options: GenerateOptions = {}) => {
    const instruction = (options.instructionOverride ?? prompt).trim();
    if (!instruction || isProcessing || isStreaming) return;
    const runScope = options.scopeOverride ?? scope;
    const taskType = options.taskType ?? 'editor';
    const createProposal = options.createProposal ?? true;
    const selectedModel = taskType === 'polish_style' ? polishModel : editorModel;

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: instruction,
      timestamp: new Date().toISOString(),
    };

    if (!options.instructionOverride) {
      setPrompt('');
    }
    setIsProcessing(true);
    setError('');

    // [Domain:StoryEditor] STEP — Route to Plot Q&A if question detected
    const isQuestion = detectIsQuestion(instruction);
    if (isQuestion && fullProject && runScope === 'story') {
      try {
        const plotModel = selectedModel;
        const plotResult = await answerPlotQuestion({
          project: fullProject,
          question: instruction,
          model: plotModel,
          apiKey: '__proxy__',
        });

        const answerMessage: ChatMessage = {
          id: createId(),
          role: 'assistant',
          content: plotResult.answer,
          timestamp: new Date().toISOString(),
        };
        onMessagesChange([...messages, userMessage, answerMessage]);
        return;
      } catch (err) {
        // [Domain:StoryEditor] STEP — Fallback to streaming if plot_qa fails
        console.warn('[Muse] Plot Q&A fallback to streaming:', err);
      } finally {
        setIsProcessing(false);
      }
    }

    const assistantMessageId = createId();
    const streamingAssistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    const updatedMessages = [...messages, userMessage, streamingAssistantMsg];
    onMessagesChange(updatedMessages);

    try {
      if (!selectedModel) {
        throw new Error('Chưa có model AI khả dụng cho editor.');
      }

      const sourceContext = buildPromptScopeContext({
        scope: runScope,
        projectTitle: project.title,
        chapterTitle,
        chapterContent,
        chapters,
        activeChapterId: selectedChapterId,
        selection,
      });
      const conversationHistory = buildStoryEditorChatTranscript(messages);

      // [Domain:StoryEditor] STEP — Adaptive system prompt based on intent
      const systemPrompt = isQuestion
        ? `Bạn là Nàng Thơ, trợ lý sáng tác cho tiểu thuyết.

QUY TẮC TRẢ LỜI CÂU HỎI:
1. Trả lời TRỰC TIẾP, đi thẳng vào trọng tâm câu hỏi.
2. Dẫn chiếu số chương cụ thể nếu có.
3. Nếu hỏi về nhân vật: nêu tên, vai trò, chương xuất hiện, kết cục/trạng thái hiện tại.
4. Nếu hỏi về diễn biến: tóm tắt ngắn gọn theo thứ tự thời gian.
5. KHÔNG viết nội dung sáng tác mới. KHÔNG đề xuất hướng phát triển trừ khi được yêu cầu.
6. Nếu thiếu dữ liệu, nói rõ phần nào chưa đủ.
7. Trả lời bằng tiếng Việt, ngắn gọn, trực diện.`
        : 'Bạn là Nàng Thơ, trợ lý sáng tác cho tiểu thuyết. Trả về phần nội dung đề xuất bằng tiếng Việt, không giải thích dài dòng.';

      const userPrompt = isQuestion
        ? `Phạm vi: ${getPromptScopeLabel(runScope)}\n${sourceContext}\n\nLịch sử trao đổi:\n${conversationHistory}\n\nCÂU HỎI: ${instruction}\n\nHãy trả lời trực tiếp câu hỏi trên. Không viết nội dung sáng tác.`
        : `Phạm vi xử lý: ${getPromptScopeLabel(runScope)}\n${sourceContext}\n\nLịch sử trao đổi gần đây:\n${conversationHistory}\n\nYêu cầu mới nhất: ${instruction}\n\nHãy tiếp nối đúng ngữ cảnh cuộc trao đổi và trả về duy nhất phần văn bản đề xuất để người viết review.`;

      // [Domain:StoryEditor] STEP — Start streaming with AbortController
      const controller = startStream(assistantMessageId, {
        systemPrompt,
        conversationHistory,
        lastInstruction: instruction,
        scope: runScope,
        provider: selectedModel.provider,
        modelId: selectedModel.modelId,
        modelName: selectedModel.name || selectedModel.modelId,
        baseUrl: selectedModel.baseUrl,
        temperature: undefined,
        topP: undefined,
      });

      const latestMessagesRef = updatedMessages;

      const result = await callAiStreaming({
        provider: selectedModel.provider,
        modelId: selectedModel.modelId,
        modelName: selectedModel.name || selectedModel.modelId,
        baseUrl: selectedModel.baseUrl,
        taskType,
        systemPrompt,
        userPrompt,
        signal: controller.signal,
        onChunk: (_chunk, accumulated) => {
          // [Domain:StoryEditor] STEP — Update streaming message content live
          appendChunk('');
          const nextMessages = latestMessagesRef.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulated, isStreaming: true }
              : msg,
          );
          onMessagesChange(nextMessages);
        },
      });

      // [Domain:StoryEditor] STEP — Finalize the message
      const finalContent = result.text.trim();
      const finalMessages = latestMessagesRef.map((msg) =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: finalContent,
              isStreaming: false,
              isPartialStop: !result.completed,
              tokenCount: result.usage
                ? result.usage.inputTokens + result.usage.outputTokens
                : Math.ceil(finalContent.length / 2),
            }
          : msg,
      );
      onMessagesChange(finalMessages);

      if (result.completed) {
        finishStream();
        // [Domain:StoryEditor] STEP — Only create proposal for content generation, not Q&A
        if (!isQuestion && createProposal) {
          onAiResponse({
            content: finalContent,
            scope: runScope,
            prompt: instruction,
          });
        }
      } else {
        // User stopped — don't send proposal yet, keep partial
        finishStream();
        // Re-enable resume by setting canResume via stopStream state
        // (stopStream was already called by user pressing Stop button)
      }
    } catch (err) {
      finishStream();
      setError(err instanceof Error ? err.message : 'Không thể tạo đề xuất AI.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunNovelPolish = ({ mode, rawText }: { mode: NovelPolishModeId; rawText: string }) => {
    const polishMode = getNovelPolishMode(mode);
    const instruction = buildNovelPolishInstruction({ mode, rawText });
    setActiveTab('muse');
    setPolishAutoCollapseSignal((current) => current + 1);
    void handleGenerate({
      instructionOverride: instruction,
      scopeOverride: 'chapter',
      taskType: 'polish_style',
      createProposal: polishMode.outputKind === 'rewrite',
    });
  };

  // [Domain:StoryEditor] STEP — Stop streaming mid-generation
  const handleStop = useCallback(() => {
    stopStream();
  }, [stopStream]);

  // [Domain:StoryEditor] STEP — Resume streaming from where it stopped
  const handleResume = useCallback(async () => {
    const payload = getResumePayload();
    if (!payload || isStreaming || isProcessing) return;

    setIsProcessing(true);
    setError('');

    const resumeMessageId = createId();
    const resumeMsg: ChatMessage = {
      id: resumeMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    // [Domain:StoryEditor] STEP — Mark previous partial message as non-resumable
    const updatedMessages = messages.map((msg) =>
      msg.isPartialStop ? { ...msg, isPartialStop: false } : msg,
    );
    const messagesWithResume = [...updatedMessages, resumeMsg];
    onMessagesChange(messagesWithResume);

    try {
      const { context, partialOutput } = payload;
      const continuationPrompt = buildResumePrompt(partialOutput, context.lastInstruction);

      const controller = consumeResume(resumeMessageId);

      const result = await callAiStreaming({
        provider: context.provider,
        modelId: context.modelId,
        modelName: context.modelName,
        baseUrl: context.baseUrl,
        taskType: 'editor',
        systemPrompt: context.systemPrompt,
        userPrompt: continuationPrompt,
        temperature: context.temperature,
        topP: context.topP,
        signal: controller.signal,
        onChunk: (_chunk, accumulated) => {
          appendChunk('');
          const nextMessages = messagesWithResume.map((msg) =>
            msg.id === resumeMessageId
              ? { ...msg, content: accumulated, isStreaming: true }
              : msg,
          );
          onMessagesChange(nextMessages);
        },
      });

      const continuedContent = result.text.trim();
      const finalMessages = messagesWithResume.map((msg) =>
        msg.id === resumeMessageId
          ? {
              ...msg,
              content: continuedContent,
              isStreaming: false,
              isPartialStop: !result.completed,
              tokenCount: result.usage
                ? result.usage.inputTokens + result.usage.outputTokens
                : Math.ceil(continuedContent.length / 2),
            }
          : msg,
      );
      onMessagesChange(finalMessages);

      if (result.completed) {
        finishStream();
        // Combine partial + continuation for full proposal
        const fullContent = partialOutput + continuedContent;
        onAiResponse({
          content: fullContent.trim(),
          scope: context.scope,
          prompt: context.lastInstruction,
        });
      } else {
        finishStream();
      }
    } catch (err) {
      finishStream();
      setError(err instanceof Error ? err.message : 'Không thể tiếp tục sinh nội dung.');
    } finally {
      setIsProcessing(false);
    }
  }, [getResumePayload, isStreaming, isProcessing, messages, onMessagesChange, consumeResume, appendChunk, finishStream, onAiResponse, stopStream]);

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <aside
      id="story-editor-assistant-panel"
      className="flex h-full min-h-0 flex-col bg-[#100d0d] text-[#f2ebe2]"
    >
      {/* ── Tab Bar ── */}
      <div className="flex items-center border-b border-white/5 px-2 pt-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold tracking-wide transition border-b-2 ${
            activeTab === 'chapters'
              ? 'border-accent-amber text-accent-amber'
              : 'border-transparent text-[#8f7f73] hover:text-[#c8beb0]'
          }`}
        >
          <Book className="h-4 w-4" />
          Mục lục
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('muse')}
          className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold tracking-wide transition border-b-2 ${
            activeTab === 'muse'
              ? 'border-accent-amber text-accent-amber'
              : 'border-transparent text-[#8f7f73] hover:text-[#c8beb0]'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Nàng Thơ
        </button>

        <div className="ml-auto flex items-center gap-1.5 pr-3 text-[12px] font-medium text-accent-amber/80">
          <Zap className="h-3 w-3" />
          <span>{formatTokenCount(sessionTokens)} token</span>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'chapters' ? (
        /* ────── CHAPTER LIST TAB ────── */
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header: stats + search + filter */}
          <div className="px-4 pt-4 pb-2 shrink-0 space-y-2.5">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Tổng', value: chapters.length, color: 'text-[#f2e7dc]' },
                { label: 'Viết', value: chapters.filter(c => { const s = statusMap[c.id]; return s === 'edited' || s === 'ai-draft' || s === 'reviewing'; }).length, color: 'text-[#a8c6ff]' },
                { label: 'Xong', value: chapters.filter(c => statusMap[c.id] === 'approved').length, color: 'text-[#7ce0b3]' },
                { label: 'Trống', value: chapters.filter(c => !statusMap[c.id] || statusMap[c.id] === 'empty').length, color: 'text-[#8f7f73]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] py-1.5 text-center">
                  <p className={`text-[14px] font-bold ${color}`}>{value}</p>
                  <p className="text-[9px] uppercase tracking-wide text-[#6f6259]">{label}</p>
                </div>
              ))}
            </div>

            {/* Search + filter toggle */}
            <div className="flex items-center gap-2">
              <label className="relative flex-1 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f6259]" />
                <input
                  type="text"
                  value={chapterQuery}
                  onChange={(e) => setChapterQuery(e.target.value)}
                  placeholder="Tìm chương..."
                  className="w-full rounded-2xl border border-white/[0.04] bg-[#110e0c] py-2.5 pl-9 pr-3 text-[12px] text-[#f2e7dc] placeholder:text-[#6f6259] focus:border-[#f0c59a]/25 focus:outline-none"
                />
              </label>
              {/* Filter chips */}
              <div className="flex items-center gap-1">
                {(['all', 'empty', 'edited', 'approved'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setChapterFilterStatus(f)}
                    className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                      chapterFilterStatus === f
                        ? 'bg-[#f0c59a] text-[#2a1c14]'
                        : 'border border-white/[0.06] bg-white/[0.02] text-[#8f7f73] hover:text-[#d0c6bd]'
                    }`}
                  >
                    {f === 'all' ? 'Tất cả' : f === 'empty' ? 'Trống' : f === 'edited' ? 'Viết' : 'Xong'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chapter list */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {chapterEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.06] px-4 py-5 text-[12px] text-[#8f7f73]">
                Không tìm thấy chương phù hợp.
              </div>
            ) : (
              <div className="space-y-2">
                {chapterEntries
                  .filter(({ status }) => chapterFilterStatus === 'all' || status === chapterFilterStatus)
                  .map(({ chapter, sequence, status }) => {
                  const isSelected = chapter.id === selectedChapterId;
                  const meta = STATUS_META[status];
                  const globalIndex = chapters.findIndex(c => c.id === chapter.id);

                  return (
                    <div key={chapter.id} className="group relative">
                      {/* Confirm delete overlay */}
                      {confirmDeleteId === chapter.id && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-red-500/20 bg-[#1a0f0f]/95 p-3">
                          <div className="text-center">
                            <p className="text-[12px] font-semibold text-red-300">Xóa chương này?</p>
                            <p className="mt-0.5 text-[10px] text-[#8f7f73]">Thao tác không thể hoàn tác.</p>
                            <div className="mt-2.5 flex gap-2">
                              <button type="button" onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 rounded-xl border border-white/10 py-1.5 text-[11px] font-medium text-[#8f7f73] hover:bg-white/5">
                                Hủy
                              </button>
                              <button type="button" onClick={async () => { await onDeleteChapter?.(chapter.id); setConfirmDeleteId(null); }}
                                className="flex-1 rounded-xl bg-red-500/80 py-1.5 text-[11px] font-bold text-white hover:bg-red-500">
                                Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectChapter(chapter.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-[#f0c59a]/18 bg-[#f0c59a]/10 shadow-[0_8px_24px_rgba(240,197,154,0.08)]'
                            : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex h-6 min-w-[34px] items-center justify-center rounded-full px-2 text-[10px] font-bold ${
                                isSelected ? 'bg-[#f0c59a] text-[#2a1c14]' : 'bg-white/[0.05] text-[#8f7f73]'
                              }`}>
                                {String(sequence).padStart(2, '0')}
                              </span>
                              <div className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            </div>
                            <p className={`mt-2 truncate text-[13px] ${isSelected ? 'font-semibold text-[#f2e7dc]' : 'font-medium text-[#d6cbc0]'}`}>
                              {chapter.title || `Chương ${sequence}`}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#8f7f73]">
                              {chapter.summary || 'Chưa có tóm tắt cho chương này.'}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.badge}`}>
                              {meta.label}
                            </span>
                            {/* ⋮ Menu button */}
                            <button
                              type="button"
                              id={`chapter-menu-btn-${chapter.id}`}
                              onClick={(e) => { e.stopPropagation(); setChapterMenuId(chapterMenuId === chapter.id ? null : chapter.id); }}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[#6f6259] opacity-0 transition-all hover:bg-white/10 hover:text-[#d0c6bd] group-hover:opacity-100"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </button>

                      {/* Inline dropdown menu */}
                      {chapterMenuId === chapter.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1814] shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
                        >
                          <div className="border-b border-white/[0.06] px-3 py-2">
                            <p className="truncate text-[11px] font-semibold text-[#f2e7dc]">
                              {chapter.title || `Chương ${sequence}`}
                            </p>
                          </div>
                          <div className="py-1">
                            <button type="button" disabled={globalIndex === 0}
                              onClick={async (e) => { e.stopPropagation(); await onMoveChapterUp?.(chapter.id); setChapterMenuId(null); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#d0c6bd] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed">
                              <ChevronUp className="h-3.5 w-3.5 text-[#8f7f73]" /> Di chuyển lên
                            </button>
                            <button type="button" disabled={globalIndex === chapters.length - 1}
                              onClick={async (e) => { e.stopPropagation(); await onMoveChapterDown?.(chapter.id); setChapterMenuId(null); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#d0c6bd] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed">
                              <ChevronDown className="h-3.5 w-3.5 text-[#8f7f73]" /> Di chuyển xuống
                            </button>
                            <div className="mx-3 my-1 border-t border-white/[0.05]" />
                            <button type="button"
                              onClick={async (e) => { e.stopPropagation(); await onDuplicateChapter?.(chapter); setChapterMenuId(null); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#d0c6bd] hover:bg-white/[0.06]">
                              <Copy className="h-3.5 w-3.5 text-[#8f7f73]" /> Nhân bản
                            </button>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(chapter.id); setChapterMenuId(null); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10">
                              <Trash2 className="h-3.5 w-3.5" /> Xóa chương
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* New chapter button */}
          <div className="px-5 py-4 shrink-0 border-t border-white/[0.04]">
            <button
              type="button"
              onClick={onNewChapter}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-accent-amber/90 py-2.5 text-[13px] font-bold tracking-wide text-[#2a1c14] shadow-sm transition hover:bg-accent-amber active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Tạo chương mới
            </button>
          </div>
        </div>
      ) : (
        /* ────── THE MUSE (AI CHAT) TAB ────── */
        <>
          {/* Chat Messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
            <div className="flex flex-col space-y-6">
              {messages.length === 0 && !isProcessing ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1e1917]">
                    <Sparkles className="h-5 w-5 text-accent-amber" />
                  </div>
                  <p className="text-sm font-medium text-text-primary tracking-wide">Nàng Thơ đang chờ lệnh</p>
                  <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-[#8f7f73]">
                    Nhập yêu cầu bên dưới hoặc chọn thao tác nhanh để bắt đầu viết cùng AI.
                  </p>
                </div>
              ) : null}

              {messages.map((msg) => (
                 <div key={msg.id}>
                  {msg.role === 'user' ? (
                    /* User Bubble */
                    <div className="flex justify-end mb-6">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#241c17] px-4 py-3 text-[14px] leading-relaxed text-[#dcd1c6] shadow-sm">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    /* AI Bubble — supports streaming + stop/resume */
                    <div className="flex flex-col items-start gap-1.5 mb-6">
                      <div className="flex items-center gap-2 mb-1 pl-1">
                        <Sparkles className={`h-4 w-4 text-accent-amber ${msg.isStreaming ? 'animate-pulse' : ''}`} />
                        <span className="text-[12px] font-bold tracking-wide text-accent-amber">
                          {msg.isStreaming ? 'Đang viết...' : msg.isPartialStop ? 'Đã tạm dừng' : 'Nàng Thơ'}
                        </span>
                        {msg.isStreaming && (
                          <span className="text-[11px] text-[#8f7f73] animate-pulse">●</span>
                        )}
                      </div>

                      <div className={`w-full rounded-2xl border bg-[#1a1512] px-5 py-4 text-[14px] leading-relaxed text-[#dcd1c6] shadow-md ${
                        msg.isStreaming ? 'border-accent-amber/20' : msg.isPartialStop ? 'border-yellow-500/20' : 'border-white/[0.04]'
                      }`}>
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                        {msg.isStreaming && (
                          <span className="inline-block w-[2px] h-[18px] bg-accent-amber ml-0.5 animate-pulse align-text-bottom" />
                        )}
                      </div>

                      {/* AI Actions — streaming vs completed vs partial stop */}
                      <div className="flex items-center justify-between w-full mt-2 pl-2">
                        <div className="flex items-center gap-3">
                          {msg.isStreaming ? (
                            /* Stop button during streaming */
                            <button
                              onClick={handleStop}
                              className="flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-[12px] font-bold text-red-300 transition hover:bg-red-400/20 active:scale-95"
                            >
                              <Square className="h-3 w-3 fill-current" />
                              Dừng
                            </button>
                          ) : (
                            <>
                              {msg.tokenCount && (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-accent-amber/90">
                                  <Zap className="h-3 w-3" />
                                  {formatTokenCount(msg.tokenCount)} token
                                </span>
                              )}
                              <button
                                onClick={() => handleCopyMessage(msg.content)}
                                className="text-[#8f7f73] transition hover:text-text-primary ml-2"
                                title="Sao chép"
                              >
                                <Copy className="h-[14px] w-[14px]" />
                              </button>
                            </>
                          )}
                        </div>

                        {!msg.isStreaming && (
                          <div className="flex items-center gap-2">
                            {/* Resume button for partial stop */}
                            {msg.isPartialStop && canResume && (
                              <button
                                onClick={() => void handleResume()}
                                disabled={isProcessing}
                                className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[12px] font-bold text-emerald-300 transition hover:bg-emerald-400/20 active:scale-95 disabled:opacity-50"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                Tiếp tục viết
                              </button>
                            )}
                            <button
                              onClick={() => handleInsertToDraft(msg.content)}
                              className="flex items-center gap-1.5 rounded-full bg-accent-amber px-4 py-1.5 text-[12px] font-bold text-[#1B140F] transition hover:bg-accent-amber/90 active:scale-95"
                            >
                              <Plus className="h-3 w-3 -ml-1" />
                              Chèn vào bản thảo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Processing indicator — only when NOT streaming (initial connection) */}
              {isProcessing && !isStreaming && messages.every((m) => !m.isStreaming) ? (
                <div className="flex flex-col gap-1.5 mb-6">
                  <div className="flex items-center gap-2 mb-1 pl-1">
                    <Sparkles className="h-4 w-4 text-accent-amber" />
                    <span className="text-[12px] font-bold tracking-wide text-accent-amber">Nàng Thơ đang kết nối...</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/[0.04] bg-[#1a1512] px-5 py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-accent-amber/60" />
                    <span className="text-[13px] text-[#8f7f73]">Đang chuẩn bị stream...</span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mb-4">
                  <AiConnectionDebugPanel
                    error={error}
                    onDismiss={() => setError('')}
                    onRetry={() => {
                      setError('');
                      void handleGenerate();
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Input Area Group */}
          <div className="px-5 pb-6">
            <NovelPolishTool
              sourceText={selection?.text?.trim() ? selection.text : chapterContent}
              sourceActionLabel={selection?.text?.trim() ? 'Lấy đoạn đang chọn' : 'Lấy từ trình soạn'}
              disabled={isProcessing || isStreaming}
              onRun={handleRunNovelPolish}
              collapsible
              defaultCollapsed
              autoCollapseSignal={polishAutoCollapseSignal}
            />

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    setPrompt(action.prompt);
                    setPolishAutoCollapseSignal((current) => current + 1);
                  }}
                  className="rounded-full border border-white/10 bg-transparent px-4 py-1 text-[13px] font-medium text-[#c8beb0] transition hover:border-accent-amber/30 hover:text-accent-amber"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Input box */}
            <div className="relative rounded-[20px] bg-[#13100e] border border-white/5 p-3 px-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              {/* Scope selector */}
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {PROMPT_SCOPE_OPTIONS.map((option) => {
                    const isActive = option.id === scope;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setScope(option.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                          isActive
                            ? 'border-accent-amber/30 bg-accent-amber/15 text-text-primary'
                            : 'border-white/5 bg-[#1b1715] text-[#8f7f73] hover:border-white/10 hover:text-[#d6cbc0]'
                        }`}
                      >
                        <Crosshair className={`h-3 w-3 ${isActive ? 'text-accent-amber' : 'text-[#6f6259]'}`} />
                        <span className="whitespace-nowrap">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-4 text-[#8f7f73]">
                  {getPromptScopeHelper(scope)}
                </p>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (e.target.value.trim()) {
                    setPolishAutoCollapseSignal((current) => current + 1);
                  }
                }}
                rows={1}
                className="w-full resize-none bg-transparent py-1 text-[14px] leading-relaxed text-text-primary outline-none transition placeholder:text-[#685c52]"
                placeholder="Chỉ thị cho Nàng Thơ..."
                onFocus={() => setPolishAutoCollapseSignal((current) => current + 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                style={{ minHeight: '28px' }}
              />

              {/* Send Button */}
              <div className="absolute right-3 bottom-3">
                 <button
                   type="button"
                   onClick={() => void handleGenerate()}
                   disabled={!prompt.trim() || isProcessing || isStreaming}
                   className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-amber text-[#1B140F] transition hover:bg-[#F0C59A] active:scale-95 disabled:bg-[#2a2420] disabled:text-[#685c52] disabled:opacity-50"
                 >
                   <Send className="h-4 w-4 ml-0.5" />
                 </button>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
