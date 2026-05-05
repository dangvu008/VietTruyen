/**
 * File: AIAssistantPanel.tsx
 * Purpose: Unified right panel — Chapter list (outermost tab) + AI Muse chat with streaming
 * Layer: UI
 * Domain: StoryEditor → Right Panel
 * Deps: editor_types, use_ai_store, model_router, streaming_ai_client, use_generation_store, plot_qa
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIReviewSummary, EditorAiProposal, EditorMode, EditorSelection, EditorSelectionIntentRequest, PromptScope } from './editor_types';
import type { ChatMessage, ChapterUIStatus, ProjectInfo } from './editor_types';
import { getChapterCompletionAction } from './editor_types';
import type { Chapter, Character, Project } from '../../types/story';
import { isPlotQuestion, answerPlotQuestion } from '../../lib/ai/plot_qa';
import { useAiStore } from '../../store/use_ai_store';
import { getModelForTask, type AiTaskType } from '../../lib/ai/model_router';
import { callAiStreaming } from '../../lib/ai/streaming_ai_client';
import { callAiModelTracked } from '../../lib/ai/tracked_ai_client';
import { AiConnectionDebugPanel } from '../shared/AiConnectionDebugPanel';
import { NovelPolishTool } from './NovelPolishTool';
import {
  buildCreativeContinuationDirective,
  buildPromptScopeContext,
  getPromptScopeLabel,
  getPromptScopeHelper,
  inferPromptScopeForInstruction,
  PROMPT_SCOPE_OPTIONS,
} from './editor_prompt_context';
import { buildStoryEditorChatTranscript } from './story_editor_chat_history';
import { resolveChapterTitleCommand } from './chapter_title_command';
import { useGenerationStore, buildResumePrompt } from '../../store/use_generation_store';
import {
  buildNovelPolishStorySource,
  buildNovelPolishInstruction,
  buildParagraphPolishInstruction,
  getNovelPolishMode,
  isNovelPolishFailureResponse,
  type NovelPolishModeId,
  type NovelPolishSourceScope,
  splitNovelPolishRawText,
} from '../../lib/ai/novel_polish';
import { extractWriterVisibleContent } from '../../lib/ai/writer_response_content';
import {
  AlertCircle,
  Book,
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
  Star,
  Play,
  X,
  RotateCcw,
} from 'lucide-react';
import VoiceMicButton from '../shared/VoiceMicButton';
import { createId } from '../../core/id';
import { useNotificationStore } from '../../store/use_notification_store';

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
  generating: {
    label: 'Đang tạo',
    badge: 'border-[#f0c59a]/20 bg-[#f0c59a]/10 text-[#f0c59a]',
    dot: 'bg-[#f0c59a] animate-pulse',
  },
  interrupted: {
    label: 'Tạo dở',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-300',
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
  editorMode: EditorMode;
  chapterContent: string;
  chapterTitle: string;
  reviewSummary?: AIReviewSummary;
  selection: EditorSelection | null;
  selectionIntentRequest: EditorSelectionIntentRequest | null;
  activeProposal: EditorAiProposal | null;
  prefillPrompt: string;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onSelectionIntentConsumed: () => void;
  onAiResponse: (payload: { content: string; scope: PromptScope; prompt: string; selection?: EditorSelection }) => void;
  onOpenReview: () => void;
  onOpenDiff: () => void;
  onApplyRewrite: (payload: { content: string; scope: PromptScope; prompt: string; selection?: EditorSelection }) => void;
  onRenameChapter?: (title: string) => Promise<void> | void;
  onApplyStoryRewrite?: (payload: {
    chapters: Array<{ chapterId: string; title: string; content: string }>;
    prompt: string;
  }) => void;
  sessionTokens: number;

  /* Chapter list props */
  project: ProjectInfo;
  /** Full project data for Plot Q&A — contains characters, chapters, outline etc. */
  fullProject?: Project;
  chapters: Chapter[];
  storySourceChapters?: Chapter[];
  selectedChapterId: string | null;
  statusMap: Record<string, ChapterUIStatus>;
  onSelectChapter: (id: string) => void;
  onNewChapter: () => void;
  onInsertChapter: (sequenceNumber: number) => void;
  onDeleteChapter?: (id: string) => Promise<void> | void;
  onDuplicateChapter?: (chapter: Chapter) => Promise<void> | void;
  onToggleChapterFavorite?: (id: string) => Promise<void> | void;
  onOpenCreationChat?: () => void;
  onCompleteChapter?: (chapterId: string) => Promise<void> | void;
}

type RightPanelTab = 'chapters' | 'muse';

interface QuickActionConfig {
  label: string;
  icon: string;
  prompt: string;
  scope: PromptScope;
  requiresSelection?: boolean;
}

const WRITING_ACTIONS: QuickActionConfig[] = [
  {
    label: 'Viết tiếp',
    icon: '✍️',
    prompt: 'Viết tiếp chương này với nhịp kể tự nhiên và giữ đúng giọng văn hiện tại.',
    scope: 'chapter',
  },
  {
    label: 'Mở rộng cảnh',
    icon: '🌿',
    prompt: 'Mở rộng cảnh này bằng chi tiết cảm xúc, hành động và bối cảnh nhưng không làm lệch sự kiện chính.',
    scope: 'chapter',
  },
  {
    label: 'Viết lại đoạn chọn',
    icon: '🪄',
    prompt: 'Viết lại đoạn đang chọn, giữ ý chính nhưng làm câu chữ rõ, mượt và giàu nhịp hơn.',
    scope: 'fragment',
    requiresSelection: true,
  },
  {
    label: 'Plot Q&A',
    icon: '💡',
    prompt: 'Hãy trả lời câu hỏi về cốt truyện, nhân vật hoặc diễn biến. Tôi muốn hỏi:',
    scope: 'story',
  },
];

const READING_ACTIONS: QuickActionConfig[] = [
  {
    label: 'Tóm tắt chương',
    icon: '📝',
    prompt: 'Tóm tắt chương đang mở thành các ý chính ngắn gọn, rõ mạch sự kiện và cảm xúc.',
    scope: 'chapter',
  },
  {
    label: 'Tóm tắt truyện',
    icon: '🧭',
    prompt: 'Tóm tắt toàn bộ truyện đến thời điểm hiện tại: mạch chính, bước ngoặt, trạng thái nhân vật và xung đột đang mở.',
    scope: 'story',
  },
  {
    label: 'Plot Q&A',
    icon: '💡',
    prompt: 'Hãy trả lời câu hỏi về cốt truyện, nhân vật hoặc diễn biến. Tôi muốn hỏi:',
    scope: 'story',
  },
];

interface GenerateOptions {
  instructionOverride?: string;
  displayInstruction?: string;
  scopeOverride?: PromptScope;
  taskType?: AiTaskType;
  createProposal?: boolean;
}

interface StreamRuntimeState {
  messageId: string;
  startedAt: number;
  lastChunkAt: number | null;
  streamedChars: number;
  chunkCount: number;
}

interface PendingScopeConfirmation {
  instruction: string;
  recommendedScope: PromptScope;
  reason: string;
}

const STREAM_STALE_AFTER_MS = 15_000;

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

function formatElapsedLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function estimateStoryContextCharBudget(contextTokens: number | undefined): number {
  const safeTokens = Math.max(4000, Math.min(128000, contextTokens || 16000));
  return Math.max(12000, Math.min(90000, Math.floor(safeTokens * 3)));
}

function estimateActiveChapterCharBudget(totalChars: number): number {
  return Math.max(3200, Math.min(24000, Math.floor(totalChars * 0.38)));
}

function isCreativeContinuationInstruction(instruction: string): boolean {
  return /viết tiếp|viet tiep|tiếp tục viết|tiep tuc viet|sáng tác tiếp|sang tac tiep|viết chương tiếp|viet chuong tiep|viết chương mới|viet chuong moi|mở rộng cảnh|mo rong canh/i.test(instruction);
}

function shouldUseStrictGrounding(instruction: string, runScope: PromptScope, project?: Project): boolean {
  if (isCreativeContinuationInstruction(instruction)) return false;
  if (runScope === 'story') return true;
  if (project?.adaptationType || project?.sourceProjectId) return true;

  return /phóng tác|phong tac|thay đổi|sửa kết|đổi kết|viết lại|rewrite|retcon|thêm đất diễn/i.test(instruction);
}

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function isMainCharacter(character: Character): boolean {
  const role = normalizeSearchText(character.role || '');
  return role.includes('main') || role.includes('protagonist') || role.includes('mc') || role.includes('chinh');
}

function formatParagraphCharacterContext(character: Character): string {
  const parts = [
    character.role ? `role=${character.role}` : '',
    character.traits ? `traits=${character.traits}` : '',
    character.currentStage ? `stage=${character.currentStage}` : '',
    character.arc ? `arc=${character.arc}` : '',
    character.psychology?.coreWound ? `core wound=${character.psychology.coreWound}` : '',
    character.psychology?.deepFear ? `fear=${character.psychology.deepFear}` : '',
    character.psychology?.hiddenDesire ? `desire=${character.psychology.hiddenDesire}` : '',
    character.psychology?.bodyLanguage ? `body language=${character.psychology.bodyLanguage}` : '',
    character.speechProfile?.toneNotes ? `speech=${character.speechProfile.toneNotes}` : '',
  ].filter(Boolean);

  return `- ${character.name}: ${parts.join('; ') || 'use established profile if mentioned.'}`;
}

function buildParagraphCharacterContext(project: Project | undefined, selectedText: string): string {
  const characters = project?.characters ?? [];
  if (characters.length === 0) return '';

  const normalizedSelection = normalizeSearchText(selectedText);
  const mentioned = characters.filter((character) => {
    const names = [character.name, ...(character.aliases ?? [])]
      .map((name) => normalizeSearchText(name.trim()))
      .filter(Boolean);
    return names.some((name) => normalizedSelection.includes(name));
  });

  const selectedCharacters = mentioned.length > 0
    ? mentioned
    : characters.filter(isMainCharacter).slice(0, 2);

  return selectedCharacters
    .slice(0, 3)
    .map(formatParagraphCharacterContext)
    .join('\n');
}

function getSelectionIntentDisplayLabel(intent: EditorSelectionIntentRequest['intent']): string {
  if (intent === 'internal_monologue') return 'Sửa nội tâm cho đoạn đang chọn';
  if (intent === 'dialogue') return 'Sửa lời thoại cho đoạn đang chọn';
  if (intent === 'shorten') return 'Cắt ngắn đoạn đang chọn';
  return 'Tăng chi tiết cho đoạn đang chọn';
}

function buildEditorSuccessNotificationTitle(isQuestion: boolean, instruction: string): string {
  const trimmedInstruction = instruction.trim();
  if (isQuestion) {
    return 'AI đã trả lời xong trong chat';
  }

  if (trimmedInstruction.length === 0) {
    return 'AI đã hoàn tất yêu cầu trong chat';
  }

  return `AI đã xử lý xong: ${trimmedInstruction.slice(0, 48)}${trimmedInstruction.length > 48 ? '...' : ''}`;
}

export function AIAssistantPanel(props: Props) {
  const {
    editorMode,
    chapterContent,
    chapterTitle,
    reviewSummary,
    selection,
    selectionIntentRequest,
    prefillPrompt,
    messages,
    onMessagesChange,
    onSelectionIntentConsumed,
    onAiResponse,
    onOpenReview,
    onOpenDiff,
    onApplyRewrite,
    onRenameChapter,
    onApplyStoryRewrite,
    sessionTokens,
    project,
    fullProject,
    chapters,
    storySourceChapters,
    selectedChapterId,
    statusMap,
    onSelectChapter,
    onNewChapter,
    onInsertChapter,
    onDeleteChapter,
    onDuplicateChapter,
    onToggleChapterFavorite,
    onCompleteChapter,
  } = props;

  const [activeTab, setActiveTab] = useState<RightPanelTab>('muse');
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState<PromptScope>('chapter');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [polishResult, setPolishResult] = useState('');
  const [polishModeId, setPolishModeId] = useState<NovelPolishModeId | null>(null);
  const [polishInstruction, setPolishInstruction] = useState('');
  const [polishSourceScope, setPolishSourceScope] = useState<NovelPolishSourceScope | null>(null);
  const [polishStoryRewrites, setPolishStoryRewrites] = useState<Array<{ chapterId: string; title: string; content: string }>>([]);
  const [polishAutoCollapseSignal, setPolishAutoCollapseSignal] = useState(0);
  const [polishProgressText, setPolishProgressText] = useState('');
  const [polishReplacementSelection, setPolishReplacementSelection] = useState<EditorSelection | null>(null);
  const [streamRuntime, setStreamRuntime] = useState<StreamRuntimeState | null>(null);
  const [streamClockMs, setStreamClockMs] = useState(() => Date.now());
  const [pendingScopeConfirmation, setPendingScopeConfirmation] = useState<PendingScopeConfirmation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedSelectionIntentIdRef = useRef<string | null>(null);

  // [Domain:StoryEditor] Chapter management state
  const [chapterMenuId, setChapterMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [chapterFilterStatus, setChapterFilterStatus] = useState<ChapterUIStatus | 'all'>('all');
  const menuRef = useRef<HTMLDivElement>(null);
  const pushNotification = useNotificationStore((state) => state.push);

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

  const { models, activeModelId, taskModelOverrides, modelHealth, preferredProvider, contextSize } = useAiStore();
  const editorModel = useMemo(
    () => getModelForTask('editor', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider),
    [models, activeModelId, taskModelOverrides, modelHealth, preferredProvider],
  );
  const polishModel = useMemo(
    () => getModelForTask('polish_style', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider),
    [models, activeModelId, taskModelOverrides, modelHealth, preferredProvider],
  );
  const resolvedStorySource = useMemo(
    () => buildNovelPolishStorySource(storySourceChapters ?? chapters),
    [chapters, storySourceChapters],
  );

  // [Domain:StoryEditor] STEP 1 — Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  useEffect(() => {
    if (!isProcessing && !isStreaming && !streamRuntime) return;
    const timer = globalThis.setInterval(() => {
      setStreamClockMs(Date.now());
    }, 1000);
    return () => globalThis.clearInterval(timer);
  }, [isProcessing, isStreaming, streamRuntime]);

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

  useEffect(() => {
    if (editorMode === 'review') {
      setActiveTab('muse');
    }
  }, [editorMode]);

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

  const visibleChapterEntries = useMemo(
    () => chapterEntries.filter(({ status }) => chapterFilterStatus === 'all' || status === chapterFilterStatus),
    [chapterEntries, chapterFilterStatus],
  );

  const handleInsertToDraft = useCallback((message: ChatMessage) => {
    const content = extractWriterVisibleContent(message.content);
    if (!content.trim()) return;

    onApplyRewrite({
      content,
      scope: message.insertScope ?? scope,
      prompt: '(Chèn từ chat history)',
    });
  }, [onApplyRewrite, scope]);

  const handleCopyMessage = useCallback((content: string) => {
    void navigator.clipboard.writeText(content);
  }, []);

  const handleQuickAction = useCallback((action: QuickActionConfig) => {
    if (action.requiresSelection && !selection?.text?.trim()) {
      return;
    }
    setPrompt(action.prompt);
    setScope(action.scope);
    setPendingScopeConfirmation(null);
    setActiveTab('muse');
    setPolishAutoCollapseSignal((current) => current + 1);
  }, [selection]);

  // [Domain:StoryEditor] STEP 4 — Send message with streaming AI response
  // [Domain:StoryEditor] STEP — Detect if user instruction is a plot/character question
  const detectIsQuestion = useCallback((text: string): boolean => {
    // [Domain:StoryEditor] STEP — Exclude known creative writing instructions from question detection
    const normalizedLower = text.toLowerCase();
    const writingExcludes = [
      'viết tiếp', 'mở rộng cảnh', 'mở rộng', 'viết lại', 'sáng tác',
      'tiếp tục viết', 'thêm chi tiết', 'thêm cảm xúc', 'thêm hành động',
      'viết chương', 'viết nội dung', 'giữ đúng giọng văn', 'nhịp kể tự nhiên',
      'trau chuốt', 'chỉnh sửa văn phong',
    ];
    if (writingExcludes.some((action) => normalizedLower.includes(action))) {
      return false;
    }

    if (fullProject && isPlotQuestion(text, fullProject)) return true;
    // Fallback: detect common Vietnamese question patterns
    const questionPatterns = [
      '?', 'là ai', 'ở đâu', 'khi nào', 'tại sao', 'vì sao', 'bao nhiêu',
      'xuất hiện', 'kết cục', 'ra sao', 'thế nào', 'chương nào',
      'ai là', 'có ai', 'diễn biến', 'tóm tắt', 'review',
    ];
    return questionPatterns.some((p) => normalizedLower.includes(p));
  }, [fullProject]);

  const handleGenerate = async (options: GenerateOptions = {}) => {
    const instruction = (options.instructionOverride ?? prompt).trim();
    if (!instruction || isProcessing || isStreaming) return;
    const displayInstruction = options.displayInstruction?.trim() || instruction;

    const renameChapter = onRenameChapter;
    const titleCommand = renameChapter
      ? resolveChapterTitleCommand({
          instruction,
          messages,
          currentTitle: chapterTitle,
        })
      : null;

    if (titleCommand && renameChapter) {
      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: displayInstruction,
        timestamp: new Date().toISOString(),
      };
      const confirmationMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: `Đã cập nhật tiêu đề chương đang mở thành: **"${titleCommand.title}"**.`,
        timestamp: new Date().toISOString(),
      };

      if (!options.instructionOverride) {
        setPrompt('');
      }
      setPendingScopeConfirmation(null);
      setIsProcessing(true);
      setError('');

      try {
        await renameChapter(titleCommand.title);
        onMessagesChange([...messages, userMessage, confirmationMessage]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Không thể cập nhật tiêu đề chương.';
        onMessagesChange([
          ...messages,
          userMessage,
          {
            ...confirmationMessage,
            content: `Không thể cập nhật tiêu đề chương: ${errorMessage}`,
          },
        ]);
        setError(errorMessage);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    const scopeInference = options.scopeOverride
      ? null
      : inferPromptScopeForInstruction({
          instruction,
          currentScope: scope,
          selection,
          chapterContent,
          chapterCount: (storySourceChapters ?? chapters).length,
        });
    if (scopeInference?.needsConfirmation) {
      setPendingScopeConfirmation({
        instruction,
        recommendedScope: scopeInference.scope,
        reason: scopeInference.reason,
      });
      setError('');
      return;
    }

    const runScope = options.scopeOverride ?? scopeInference?.scope ?? scope;
    const taskType = options.taskType ?? 'editor';
    const createProposal = options.createProposal ?? (editorMode === 'write');
    const selectedModel = taskType === 'polish_style' ? polishModel : editorModel;

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: displayInstruction,
      timestamp: new Date().toISOString(),
    };

    if (!options.instructionOverride) {
      setPrompt('');
    }
    setPendingScopeConfirmation(null);
    setScope(runScope);
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
        pushNotification({
          type: 'success',
          title: buildEditorSuccessNotificationTitle(true, displayInstruction),
          message: displayInstruction,
        });
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
    let latestAssistantContent = '';
    onMessagesChange(updatedMessages);
    setStreamRuntime({
      messageId: assistantMessageId,
      startedAt: Date.now(),
      lastChunkAt: null,
      streamedChars: 0,
      chunkCount: 0,
    });

    try {
      if (!selectedModel) {
        throw new Error('Chưa có model AI khả dụng cho editor.');
      }

      const isCreativeContinuation = isCreativeContinuationInstruction(instruction);
      const creativeContinuationDirective = isCreativeContinuation
        ? buildCreativeContinuationDirective(chapterContent)
        : '';
      const sourceContext = buildPromptScopeContext({
        scope: runScope,
        projectTitle: project.title,
        chapterTitle,
        chapterContent,
        chapters: storySourceChapters ?? chapters,
        activeChapterId: selectedChapterId,
        selection,
        storyBudget: runScope === 'story'
          ? (() => {
              const tokenBudget = Math.min(
                contextSize || 16000,
                selectedModel.contextWindow ?? (contextSize || 16000),
              );
              const totalChars = estimateStoryContextCharBudget(tokenBudget);
              return {
                totalChars,
                activeChapterChars: estimateActiveChapterCharBudget(totalChars),
                inactiveChapterFloorChars: 1200,
              };
            })()
          : undefined,
        chapterNeighborContext: isCreativeContinuation && runScope === 'chapter'
          ? {
              includePrevious: true,
              previousChars: 5200,
            }
          : undefined,
      });
      const conversationHistory = buildStoryEditorChatTranscript(messages);
      const strictGrounding = shouldUseStrictGrounding(instruction, runScope, fullProject);

      // [Domain:StoryEditor] STEP — Adaptive system prompt based on intent
      const systemPrompt = isQuestion
        ? `Bạn là Trợ lý AI sáng tác cho tiểu thuyết.

QUY TẮC TRẢ LỜI CÂU HỎI:
1. Trả lời TRỰC TIẾP, đi thẳng vào trọng tâm câu hỏi.
2. Dẫn chiếu số chương cụ thể nếu có.
3. Nếu hỏi về nhân vật: nêu tên, vai trò, chương xuất hiện, kết cục/trạng thái hiện tại.
4. Nếu hỏi về diễn biến: tóm tắt ngắn gọn theo thứ tự thời gian.
5. KHÔNG viết nội dung sáng tác mới. KHÔNG đề xuất hướng phát triển trừ khi được yêu cầu.
6. Nếu thiếu dữ liệu, nói rõ phần nào chưa đủ.
7. Trả lời bằng tiếng Việt, ngắn gọn, trực diện.`
        : strictGrounding
          ? `Bạn là Trợ lý AI sáng tác cho tiểu thuyết.

QUY TẮC BÁM NGỮ CẢNH:
1. CHỈ được dùng chi tiết xuất hiện trong ngữ cảnh đã nạp.
2. KHÔNG tự bịa thêm chương, nhân vật, tuổi tác, quan hệ, diễn biến hay kết cục chưa xuất hiện trong ngữ cảnh.
3. Nếu ngữ cảnh chỉ là trích đoạn/rút gọn hoặc chưa đủ để xử lý yêu cầu, phải trả lời bắt đầu bằng "KHÔNG ĐỦ NGỮ CẢNH:" rồi nêu phần còn thiếu.
4. Với yêu cầu phóng tác/chỉnh sửa cấp truyện, chỉ đề xuất thay đổi trên các phần đã thấy trong văn bản nguồn.
5. Nếu đủ dữ liệu để viết, trả về DUY NHẤT phần nội dung đề xuất bằng tiếng Việt, không meta-commentary dài dòng.`
          : 'Bạn là Trợ lý AI sáng tác cho tiểu thuyết. Trả về phần nội dung đề xuất bằng tiếng Việt, không giải thích dài dòng.';

      const userPrompt = isQuestion
        ? `Phạm vi: ${getPromptScopeLabel(runScope)}\n${sourceContext}\n\nLịch sử trao đổi:\n${conversationHistory}\n\nCÂU HỎI: ${instruction}\n\nHãy trả lời trực tiếp câu hỏi trên. Không viết nội dung sáng tác.`
        : `Phạm vi xử lý: ${getPromptScopeLabel(runScope)}\n${sourceContext}\n\nLịch sử trao đổi gần đây:\n${conversationHistory}\n\nYêu cầu mới nhất: ${instruction}\n\n${strictGrounding
          ? 'Chỉ dựa trên phần văn bản đã nạp ở trên. Nếu thiếu dữ liệu để sửa/phóng tác an toàn, hãy trả lời bắt đầu bằng "KHÔNG ĐỦ NGỮ CẢNH:" rồi nêu chính xác phần còn thiếu.'
          : `${creativeContinuationDirective ? `${creativeContinuationDirective}\n` : ''}Hãy tiếp nối đúng ngữ cảnh đã nạp và trả về duy nhất phần văn bản đề xuất để người viết review. Với yêu cầu viết tiếp, hãy dùng chương đang mở và chương liền trước nếu có; không trả lời thiếu ngữ cảnh khi các phần này đã có nội dung.`}`;

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
        onChunk: (chunk, accumulated) => {
          // [Domain:StoryEditor] STEP — Update streaming message content live
          latestAssistantContent = accumulated;
          appendChunk(chunk);
          setStreamRuntime((current) =>
            current?.messageId === assistantMessageId
              ? {
                  ...current,
                  lastChunkAt: Date.now(),
                  streamedChars: accumulated.length,
                  chunkCount: current.chunkCount + 1,
                }
              : current,
          );
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
      setStreamRuntime(null);
      const finalMessages = latestMessagesRef.map((msg) =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: finalContent,
              isStreaming: false,
              isPartialStop: !result.completed,
              canInsertToDraft: result.completed && !isQuestion && runScope !== 'story' && Boolean(finalContent.trim()),
              insertScope: runScope,
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
            selection: runScope === 'fragment' ? selection ?? undefined : undefined,
          });
        }
        pushNotification({
          type: 'success',
          title: buildEditorSuccessNotificationTitle(isQuestion, displayInstruction),
          message: displayInstruction,
        });
      } else {
        // Interrupted stream keeps resume context if user pressed Stop.
        if (!useGenerationStore.getState().canResume) {
          finishStream();
        }
      }
    } catch (err) {
      const shouldPreserveStoppedState = useGenerationStore.getState().canResume;
      if (!shouldPreserveStoppedState) {
        finishStream();
      }
      setStreamRuntime(null);
      const partialContent = latestAssistantContent.trim() || useGenerationStore.getState().streamedText.trim();
      if (partialContent || shouldPreserveStoppedState) {
        const failedMessages = updatedMessages.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: partialContent,
                isStreaming: false,
                isPartialStop: true,
                tokenCount: Math.ceil(partialContent.length / 2),
            }
            : msg,
        );
        onMessagesChange(failedMessages);
      } else {
        onMessagesChange([...messages, userMessage]);
      }
      const errorMessage = err instanceof Error ? err.message : 'Không thể tạo đề xuất AI.';
      setError(errorMessage);
      pushNotification({
        type: 'error',
        title: 'AI gặp lỗi khi xử lý yêu cầu trong chat',
        message: errorMessage,
        duration: 0,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!selectionIntentRequest) return;
    if (processedSelectionIntentIdRef.current === selectionIntentRequest.id) return;
    if (isProcessing || isStreaming) return;

    processedSelectionIntentIdRef.current = selectionIntentRequest.id;
    const characterContext = buildParagraphCharacterContext(fullProject, selectionIntentRequest.selection.text);
    const instruction = buildParagraphPolishInstruction({
      mode: selectionIntentRequest.intent,
      rawText: selectionIntentRequest.selection.text,
      characterContext,
    });
    const displayInstruction = getSelectionIntentDisplayLabel(selectionIntentRequest.intent);

    setPrompt('');
    setScope('fragment');
    setPendingScopeConfirmation(null);
    setActiveTab('muse');
    setPolishAutoCollapseSignal((current) => current + 1);
    onSelectionIntentConsumed();
    void handleGenerate({
      instructionOverride: instruction,
      displayInstruction,
      scopeOverride: 'fragment',
      taskType: 'polish_style',
      createProposal: true,
    });
  }, [
    fullProject,
    handleGenerate,
    isProcessing,
    isStreaming,
    onSelectionIntentConsumed,
    selectionIntentRequest,
  ]);

  const handleConfirmPromptScope = useCallback((confirmedScope: PromptScope) => {
    if (!pendingScopeConfirmation) return;
    const confirmedInstruction = pendingScopeConfirmation.instruction;
    setPendingScopeConfirmation(null);
    setPrompt('');
    setScope(confirmedScope);
    void handleGenerate({
      instructionOverride: confirmedInstruction,
      scopeOverride: confirmedScope,
    });
  }, [pendingScopeConfirmation]);

  const handleRunNovelPolish = ({
    mode,
    rawText,
    sourceScope,
  }: {
    mode: NovelPolishModeId;
    rawText: string;
    sourceScope: NovelPolishSourceScope;
  }) => {
    const activeMode = getNovelPolishMode(mode);
    const chunks = splitNovelPolishRawText(rawText);
    const selectionForReplacement =
      sourceScope === 'selection' && selection?.text?.trim()
        ? {
            start: selection.start,
            end: selection.end,
            text: selection.text.trim(),
          }
        : sourceScope === 'chapter' && chapterContent.trim()
          ? {
              start: 0,
              end: chapterContent.length,
              text: chapterContent,
            }
          : null;
    const instruction = sourceScope === 'story'
      ? `Chạy preset "${activeMode.label}" cho toàn bộ truyện (${resolvedStorySource.chapters.length} chương có nội dung).`
      : buildNovelPolishInstruction({
          mode,
          rawText,
          chunkIndex: chunks.length > 1 ? 1 : undefined,
          chunkCount: chunks.length > 1 ? chunks.length : undefined,
        });
    setPolishAutoCollapseSignal((current) => current + 1);
    setPolishInstruction(instruction);
    setPolishModeId(mode);
    setPolishSourceScope(sourceScope);
    setPolishError('');
    setPolishResult('');
    setPolishStoryRewrites([]);
    setPolishReplacementSelection(selectionForReplacement);

    if (sourceScope === 'story' && resolvedStorySource.chapters.length === 0) {
      setPolishModeId(null);
      setPolishSourceScope(null);
      setPolishError('Chưa có chương nào có nội dung để chạy preset cho toàn bộ truyện.');
      return;
    }

    if (!polishModel) {
      setPolishModeId(null);
      setPolishSourceScope(null);
      setPolishReplacementSelection(null);
      setPolishError('Chưa có model AI khả dụng cho công cụ trau chuốt.');
      return;
    }

    setIsPolishing(true);
    void (async () => {
      const runPolishForText = async (text: string, progressLabel: string): Promise<string> => {
        const textChunks = splitNovelPolishRawText(text);
        if (textChunks.length === 0) {
          throw new Error('Không có nội dung hợp lệ để trau chuốt.');
        }

        const chunkResults: string[] = [];
        for (let index = 0; index < textChunks.length; index += 1) {
          setPolishProgressText(
            textChunks.length > 1
              ? `${progressLabel} • phần ${index + 1}/${textChunks.length}`
              : progressLabel,
          );
          const response = await callAiModelTracked({
            provider: polishModel.provider,
            modelId: polishModel.modelId,
            modelName: polishModel.name || polishModel.modelId,
            baseUrl: polishModel.baseUrl,
            systemPrompt: `Bạn là biên tập viên văn học chuyên nghiệp. Nhiệm vụ của bạn là trau chuốt, cải thiện văn bản theo yêu cầu cụ thể trong instruction.

QUY TẮC TRAU CHUỐT:
1. TUÂN THỦ NGHIÊM NGẶT yêu cầu trong instruction (mode trau chuốt cụ thể).
2. KHÔNG thay đổi sự kiện, nhân vật, hay cốt truyện gốc.
3. GIỮ NGUYÊN độ dài tương đương văn bản gốc (trừ khi instruction yêu cầu thay đổi).
4. Dùng từ ngữ tự nhiên, tránh sáo rỗng và văn phong AI.
5. KHÔNG thêm lời giải thích, meta-commentary hay chú thích.
6. Trả về DUY NHẤT phần văn bản đã trau chuốt, không có gì khác.`,
            userPrompt: buildNovelPolishInstruction({
              mode,
              rawText: textChunks[index] || text,
              chunkIndex: textChunks.length > 1 ? index + 1 : undefined,
              chunkCount: textChunks.length > 1 ? textChunks.length : undefined,
            }),
            taskType: 'polish_style',
          });

          const finalContent = response.trim();
          if (!finalContent) {
            throw new Error('AI không trả về nội dung trau chuốt.');
          }
          if (isNovelPolishFailureResponse(finalContent)) {
            throw new Error(finalContent);
          }
          chunkResults.push(finalContent);
        }

        return activeMode.outputKind === 'report' && chunkResults.length > 1
          ? chunkResults.map((item, index) => `Phần ${index + 1}/${chunkResults.length}:\n${item}`).join('\n\n').trim()
          : chunkResults.join('\n\n').trim();
      };

      if (sourceScope === 'story') {
        const chapterResults: Array<{ chapterId: string; title: string; content: string }> = [];
        for (let chapterIndex = 0; chapterIndex < resolvedStorySource.chapters.length; chapterIndex += 1) {
          const storyChapter = resolvedStorySource.chapters[chapterIndex];
          const content = await runPolishForText(
            storyChapter.rawText,
            `Đang trau chuốt chương ${chapterIndex + 1}/${resolvedStorySource.chapters.length}`,
          );
          chapterResults.push({
            chapterId: storyChapter.chapterId,
            title: storyChapter.heading,
            content,
          });
        }

        setPolishStoryRewrites(activeMode.outputKind === 'rewrite' ? chapterResults : []);
        setPolishResult(
          chapterResults
            .map((chapterResult) => `${chapterResult.title}\n${chapterResult.content}`)
            .join('\n\n')
            .trim(),
        );
        return;
      }

      const mergedResult = await runPolishForText(
        rawText,
        chunks.length > 1 ? `Đang trau chuốt 1/${chunks.length} phần` : 'Đang trau chuốt toàn văn bản',
      );
      setPolishResult(mergedResult);
    })()
      .catch((err) => {
        setPolishModeId(null);
        setPolishSourceScope(null);
        setPolishResult('');
        setPolishStoryRewrites([]);
        setPolishReplacementSelection(null);
        setPolishError(err instanceof Error ? err.message : 'Trau chuốt bản thảo thất bại.');
      })
      .finally(() => {
        setIsPolishing(false);
        setPolishProgressText('');
      });
  };

  const buildPolishRewritePayload = useCallback((): {
    content: string;
    scope: PromptScope;
    prompt: string;
    selection?: EditorSelection;
  } | null => {
    if (!polishResult.trim()) return null;
    return {
      content: polishResult,
      scope: polishReplacementSelection ? 'fragment' : 'chapter',
      prompt: polishInstruction,
      selection: polishReplacementSelection ?? undefined,
    };
  }, [polishInstruction, polishReplacementSelection, polishResult]);

  const handlePreviewPolishResult = useCallback(() => {
    if (polishSourceScope === 'story') return;
    const payload = buildPolishRewritePayload();
    if (!payload) return;
    onAiResponse(payload);
    onOpenDiff();
  }, [buildPolishRewritePayload, onAiResponse, onOpenDiff, polishSourceScope]);

  const handleApplyPolishResult = useCallback(() => {
    if (polishSourceScope === 'story') {
      if (polishStoryRewrites.length === 0 || !onApplyStoryRewrite) return;
      onApplyStoryRewrite({
        chapters: polishStoryRewrites,
        prompt: polishInstruction,
      });
      return;
    }
    const payload = buildPolishRewritePayload();
    if (!payload) return;
    onApplyRewrite(payload);
  }, [
    buildPolishRewritePayload,
    onApplyRewrite,
    onApplyStoryRewrite,
    polishInstruction,
    polishSourceScope,
    polishStoryRewrites,
  ]);

  const promptPlaceholder = editorMode === 'review'
    ? 'Yêu cầu review hoặc nhận xét cho chương này...'
    : editorMode === 'read'
      ? 'Yêu cầu tóm tắt hoặc hỏi về cốt truyện, nhân vật, bối cảnh...'
      : 'Chỉ thị cho Trợ lý AI...';

  // [Domain:StoryEditor] STEP — Stop streaming mid-generation
  const handleStop = useCallback(() => {
    const { streamingMessageId: activeMessageId, streamedText: partialText } = useGenerationStore.getState();
    stopStream();
    setStreamRuntime(null);

    if (!activeMessageId) return;

    const nextMessages = messages.map((msg) => (
      msg.id === activeMessageId
        ? {
            ...msg,
            content: partialText || msg.content,
            isStreaming: false,
            isPartialStop: true,
            tokenCount: msg.tokenCount ?? Math.ceil((partialText || msg.content).length / 2),
          }
        : msg
    ));
    onMessagesChange(nextMessages);
  }, [messages, onMessagesChange, stopStream]);

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
    let latestContinuationContent = '';
    onMessagesChange(messagesWithResume);
    setStreamRuntime({
      messageId: resumeMessageId,
      startedAt: Date.now(),
      lastChunkAt: null,
      streamedChars: 0,
      chunkCount: 0,
    });

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
        onChunk: (chunk, accumulated) => {
          latestContinuationContent = accumulated;
          appendChunk(chunk);
          setStreamRuntime((current) =>
            current?.messageId === resumeMessageId
              ? {
                  ...current,
                  lastChunkAt: Date.now(),
                  streamedChars: accumulated.length,
                  chunkCount: current.chunkCount + 1,
                }
              : current,
          );
          const nextMessages = messagesWithResume.map((msg) =>
            msg.id === resumeMessageId
              ? { ...msg, content: accumulated, isStreaming: true }
              : msg,
          );
          onMessagesChange(nextMessages);
        },
      });

      const continuedContent = result.text.trim();
      setStreamRuntime(null);
      const finalMessages = messagesWithResume.map((msg) =>
        msg.id === resumeMessageId
          ? {
              ...msg,
              content: continuedContent,
              isStreaming: false,
              isPartialStop: !result.completed,
              canInsertToDraft: false,
              insertScope: context.scope,
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
        pushNotification({
          type: 'success',
          title: 'AI đã viết tiếp xong phần bị gián đoạn',
          message: context.lastInstruction,
        });
      } else {
        if (!useGenerationStore.getState().canResume) {
          finishStream();
        }
      }
    } catch (err) {
      const shouldPreserveStoppedState = useGenerationStore.getState().canResume;
      if (!shouldPreserveStoppedState) {
        finishStream();
      }
      setStreamRuntime(null);
      const partialContinuation = latestContinuationContent.trim();
      if (partialContinuation || shouldPreserveStoppedState) {
        const failedResumeMessages = messagesWithResume.map((msg) =>
          msg.id === resumeMessageId
            ? {
                ...msg,
                content: partialContinuation,
                isStreaming: false,
                isPartialStop: true,
                tokenCount: Math.ceil(partialContinuation.length / 2),
            }
            : msg,
        );
        onMessagesChange(failedResumeMessages);
      } else {
        onMessagesChange(updatedMessages);
      }
      const errorMessage = err instanceof Error ? err.message : 'Không thể tiếp tục sinh nội dung.';
      setError(errorMessage);
      pushNotification({
        type: 'error',
        title: 'AI gặp lỗi khi viết tiếp trong chat',
        message: errorMessage,
        duration: 0,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [getResumePayload, isStreaming, isProcessing, messages, onMessagesChange, consumeResume, appendChunk, finishStream, onAiResponse, pushNotification, stopStream]);

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <aside
      id="story-editor-assistant-panel"
      className="flex h-full min-h-0 flex-col bg-[#100d0d] text-[#f2ebe2]"
    >
      {/* ── Panel Header ── */}
      <div className="shrink-0 border-b border-white/5 px-3 py-2">
        <div className="grid grid-cols-2 rounded-full border border-white/[0.06] bg-white/[0.025] p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('chapters')}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold tracking-wide transition ${
              activeTab === 'chapters'
                ? 'bg-[#251d18] text-accent-amber shadow-sm'
                : 'text-[#8f7f73] hover:text-[#c8beb0]'
            }`}
          >
            <Book className="h-4 w-4" />
            Mục lục
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('muse')}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold tracking-wide transition ${
              activeTab === 'muse'
                ? 'bg-[#251d18] text-accent-amber shadow-sm'
                : 'text-[#8f7f73] hover:text-[#c8beb0]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Trợ lý AI
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'chapters' ? (
        /* ────── CHAPTER LIST TAB ────── */
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header: search + filter */}
          <div className="shrink-0 border-b border-white/[0.04] px-3 py-2">
            <div className="grid gap-1.5">
              <label className="relative flex-1 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6f6259]" />
                <input
                  type="text"
                  value={chapterQuery}
                  onChange={(e) => setChapterQuery(e.target.value)}
                  placeholder="Tìm chương..."
                  className="h-9 w-full rounded-full border border-white/[0.06] bg-[#110e0c] pl-8 pr-3 text-[12px] text-[#f2e7dc] placeholder:text-[#6f6259] focus:border-[#f0c59a]/25 focus:outline-none"
                />
              </label>
              {/* Filter chips */}
              <div className="grid grid-cols-4 gap-1">
                {(['all', 'empty', 'edited', 'approved'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setChapterFilterStatus(f)}
                    className={`h-7 rounded-full px-2 text-[10px] font-medium transition-colors ${
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
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {visibleChapterEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.06] px-4 py-5 text-[12px] text-[#8f7f73]">
                Không tìm thấy chương phù hợp.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleChapterEntries.map(({ chapter, sequence, status }) => {
                  const isSelected = chapter.id === selectedChapterId;
                  const meta = STATUS_META[status];
                  const completionAction = getChapterCompletionAction(chapter, status);
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

                      <div
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-[#f0c59a]/18 bg-[#f0c59a]/10 shadow-[0_8px_24px_rgba(240,197,154,0.08)]'
                            : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectChapter(chapter.id)}
                            className="min-w-0 flex-1 text-left"
                          >
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
                          </button>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.badge}`}>
                              {meta.label}
                            </span>
                            {completionAction && onCompleteChapter && (
                              <button
                                type="button"
                                onClick={async () => { await onCompleteChapter(chapter.id); }}
                                className="rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[10px] font-bold text-amber-200 transition hover:bg-amber-300/20"
                                title={completionAction.title}
                              >
                                {completionAction.label}
                              </button>
                            )}
                            {chapter.isFavorite && (
                              <Star className="mr-1 mt-1 h-3 w-3 fill-accent-amber text-accent-amber" />
                            )}
                            <button
                              type="button"
                              id={`chapter-menu-btn-${chapter.id}`}
                              onClick={() => { setChapterMenuId(chapterMenuId === chapter.id ? null : chapter.id); }}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[#6f6259] opacity-0 transition-all hover:bg-white/10 hover:text-[#d0c6bd] group-hover:opacity-100"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

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
                            <button type="button"
                              onClick={async (e) => { e.stopPropagation(); await onToggleChapterFavorite?.(chapter.id); setChapterMenuId(null); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#d0c6bd] hover:bg-white/[0.06]">
                              <Star className={`h-3.5 w-3.5 ${chapter.isFavorite ? 'fill-accent-amber text-accent-amber' : 'text-[#8f7f73]'}`} /> 
                              {chapter.isFavorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
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
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col space-y-5">
              {messages.length === 0 && !isProcessing ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#1e1917]">
                    <Sparkles className="h-5 w-5 text-accent-amber" />
                  </div>
                  <p className="text-sm font-medium text-text-primary tracking-wide">Trợ lý AI đang chờ lệnh</p>
                  <p className="mt-1 max-w-[240px] text-[12px] leading-5 text-[#8f7f73]">
                    Nhập yêu cầu bên dưới hoặc chọn thao tác nhanh để bắt đầu viết cùng AI.
                  </p>
                </div>
              ) : null}

              {messages.map((msg) => {
                const hasMessageContent = msg.content.trim().length > 0;
                const isCompactStreamingState = msg.isStreaming && !hasMessageContent;
                const activeStreamRuntime = msg.isStreaming && streamRuntime?.messageId === msg.id ? streamRuntime : null;
                const elapsedMs = activeStreamRuntime ? Math.max(0, streamClockMs - activeStreamRuntime.startedAt) : 0;
                const idleMs = activeStreamRuntime
                  ? Math.max(0, streamClockMs - (activeStreamRuntime.lastChunkAt ?? activeStreamRuntime.startedAt))
                  : 0;
                const isStalled = Boolean(activeStreamRuntime) && idleMs >= STREAM_STALE_AFTER_MS;
                const streamStatusLabel = !activeStreamRuntime
                  ? null
                  : !activeStreamRuntime.lastChunkAt
                    ? `Đang kết nối model • ${formatElapsedLabel(elapsedMs)}`
                    : isStalled
                      ? `${formatElapsedLabel(idleMs)} chưa có nội dung mới`
                      : `Đã nhận ${activeStreamRuntime.streamedChars.toLocaleString()} ký tự • ${formatElapsedLabel(elapsedMs)}`;

                return (
                  <div key={msg.id}>
                    {msg.role === 'user' ? (
                      /* User Bubble */
                      <div className="mb-6 flex justify-end group">
                        <div className="flex flex-col items-end gap-1.5 max-w-[85%]">
                          <div className="rounded-2xl rounded-tr-sm bg-[#241c17] px-4 py-3 text-[14px] leading-relaxed text-[#dcd1c6] shadow-sm">
                            {msg.content}
                          </div>
                          <div className="opacity-0 transition-opacity group-hover:opacity-100 pr-1">
                            <button
                              onClick={() => setPrompt(msg.content)}
                              className="flex items-center gap-1.5 text-[11px] text-[#8f7f73] transition hover:text-[#dcd1c6]"
                              title="Điền lại yêu cầu này vào khung chat"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Thử lại
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* AI Bubble — supports streaming + stop/resume */
                      <div className="mb-6 flex flex-col items-start gap-2">
                        <div className="mb-1 flex w-full items-center justify-between gap-3 pl-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <Sparkles className={`h-4 w-4 shrink-0 text-accent-amber ${msg.isStreaming ? 'animate-pulse' : ''}`} />
                            <span className="truncate text-[12px] font-bold tracking-wide text-accent-amber">
                              {msg.isStreaming ? 'Đang viết...' : msg.isPartialStop ? 'Đã tạm dừng' : 'Trợ lý AI'}
                            </span>
                            {msg.isStreaming && (
                              <span className="animate-pulse text-[11px] text-[#8f7f73]">●</span>
                            )}
                          </div>

                          {msg.isStreaming && (
                            <button
                              onClick={handleStop}
                              className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-[11px] font-bold text-red-300 transition hover:bg-red-400/20 active:scale-95"
                            >
                              <Square className="h-3 w-3 fill-current" />
                              Dừng
                            </button>
                          )}
                        </div>

                        <div
                          className={`w-full rounded-2xl border bg-[#1a1512] text-[14px] text-[#dcd1c6] shadow-md ${
                            msg.isStreaming ? 'border-accent-amber/20' : msg.isPartialStop ? 'border-yellow-500/20' : 'border-white/[0.04]'
                          } ${isCompactStreamingState ? 'px-4 py-3.5' : 'px-4 py-3.5 leading-relaxed'}`}
                        >
                          {isCompactStreamingState ? (
                            <div className="flex flex-col gap-2 text-[13px] text-[#a59689]">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-amber/70" />
                                <span>AI đang soạn phản hồi...</span>
                              </div>
                              {streamStatusLabel ? (
                                <p className={`text-[11px] ${isStalled ? 'text-yellow-300' : 'text-[#8f7f73]'}`}>
                                  {streamStatusLabel}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                              {msg.isStreaming && (
                                <span className="ml-0.5 inline-block h-[18px] w-[2px] animate-pulse bg-accent-amber align-text-bottom" />
                              )}
                              {streamStatusLabel ? (
                                <p className={`mt-3 text-[11px] ${isStalled ? 'text-yellow-300' : 'text-[#8f7f73]'}`}>
                                  {streamStatusLabel}
                                  {isStalled ? ' • Có thể stream đang chậm hoặc bị treo. Bạn có thể dừng để giữ phần đã nhận.' : ''}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>

                        {/* AI Actions — completed vs partial stop */}
                        {!msg.isStreaming && (
                          <div className="mt-1 flex w-full items-center justify-between pl-2">
                            <div className="flex items-center gap-3">
                              {msg.tokenCount && (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-accent-amber/90">
                                  <Zap className="h-3 w-3" />
                                  {formatTokenCount(msg.tokenCount)} token
                                </span>
                              )}
                              <button
                                onClick={() => handleCopyMessage(msg.content)}
                                className="ml-2 text-[#8f7f73] transition hover:text-text-primary"
                                title="Sao chép"
                              >
                                <Copy className="h-[14px] w-[14px]" />
                              </button>
                            </div>

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
                              {msg.canInsertToDraft && (
                                <button
                                  onClick={() => handleInsertToDraft(msg)}
                                  className="flex items-center gap-1.5 rounded-full bg-accent-amber px-4 py-1.5 text-[12px] font-bold text-[#1B140F] transition hover:bg-accent-amber/90 active:scale-95"
                                >
                                  <Plus className="h-3 w-3 -ml-1" />
                                  Chèn vào bản thảo
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Processing indicator — only when NOT streaming (initial connection) */}
              {isProcessing && !isStreaming && messages.every((m) => !m.isStreaming) ? (
                <div className="flex flex-col gap-1.5 mb-6">
                  <div className="flex items-center gap-2 mb-1 pl-1">
                    <Sparkles className="h-4 w-4 text-accent-amber" />
                    <span className="text-[12px] font-bold tracking-wide text-accent-amber">Trợ lý AI đang kết nối...</span>
                  </div>
                  <div className="rounded-2xl border border-white/[0.04] bg-[#1a1512] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-accent-amber/60" />
                      <span className="text-[13px] text-[#8f7f73]">Đang chuẩn bị stream...</span>
                    </div>
                    {streamRuntime ? (
                      <p className="mt-2 text-[11px] text-[#8f7f73]">
                        Đã chờ {formatElapsedLabel(Math.max(0, streamClockMs - streamRuntime.startedAt))} để nhận phản hồi đầu tiên.
                      </p>
                    ) : null}
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
          <div className="px-4 pb-4">
            {editorMode === 'review' ? (
              <>
                {reviewSummary ? (
                  <div className="mb-3 rounded-2xl border border-white/[0.06] bg-[#15110f] p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-amber">
                      Review
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-[#d6cbc0]">
                      {reviewSummary.summary}
                    </p>
                    {reviewSummary.warnings.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {reviewSummary.warnings.slice(0, 3).map((warning) => (
                          <span
                            key={warning.id}
                            className="rounded-full border border-white/[0.06] bg-[#110e0c] px-3 py-1 text-[11px] text-[#a99b8f]"
                          >
                            {warning.message}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {reviewSummary.revisionTasks && reviewSummary.revisionTasks.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#110e0c] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a99b8f]">
                          Suggested Revision Tasks
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {reviewSummary.revisionTasks.slice(0, 4).map((task, index) => (
                            <p key={`${index}-${task}`} className="text-[11px] leading-5 text-[#c8beb0]">
                              {task}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <NovelPolishTool
                  selectedSourceText={selection?.text ?? ''}
                  chapterSourceText={chapterContent}
                  storySourceText={resolvedStorySource.rawText}
                  title="Preset review"
                  disabled={isProcessing || isStreaming || isPolishing}
                  isRunning={isPolishing}
                  runLabel={isPolishing ? 'Đang chạy review...' : 'Chạy review'}
                  statusText={polishProgressText}
                  onRun={handleRunNovelPolish}
                  collapsible
                  defaultCollapsed={false}
                  autoCollapseSignal={polishAutoCollapseSignal}
                />
              </>
            ) : null}

            {editorMode === 'read' ? (
              <div className="mb-3 rounded-2xl border border-white/[0.06] bg-[#15110f] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-amber">
                  Chế độ đọc
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[#a99b8f]">
                  Chế độ này ưu tiên hiểu nội dung: tóm tắt, tra cứu, hỏi đáp cốt truyện. Các preset chỉnh văn nằm trong Review để tránh trộn lẫn vai trò.
                </p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {READING_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => handleQuickAction(action)}
                      className="shrink-0 rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-medium text-[#c8beb0] transition hover:border-accent-amber/30 hover:text-accent-amber"
                    >
                      <span className="mr-1">{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onOpenReview}
                  className="mt-3 inline-flex items-center rounded-full border border-accent-amber/30 bg-accent-amber/10 px-3 py-1.5 text-[11px] font-semibold text-accent-amber transition hover:bg-accent-amber/15"
                >
                  Mở Review
                </button>
              </div>
            ) : null}

            {editorMode === 'review' && polishError ? (
              <div className="mb-4">
                <AiConnectionDebugPanel
                  error={polishError}
                  onDismiss={() => setPolishError('')}
                />
              </div>
            ) : null}

            {editorMode === 'review' && polishResult && polishModeId ? (
              <div className="mb-3 rounded-2xl border border-accent-amber/20 bg-[#15110f] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent-amber">
                      {getNovelPolishMode(polishModeId).label}
                    </p>
                    <p className="mt-1 text-[11px] text-[#8f7f73]">
                      {getNovelPolishMode(polishModeId).outputKind === 'report'
                        ? polishSourceScope === 'story'
                          ? 'Kết quả rà lỗi cho toàn bộ truyện, không tự chèn vào bản thảo.'
                          : 'Kết quả rà lỗi, không tự chèn vào bản thảo.'
                        : polishSourceScope === 'story'
                          ? 'Kết quả review toàn truyện đã sẵn sàng. Bạn có thể áp dụng hàng loạt lên các chương vừa xử lý.'
                          : 'Kết quả review đã sẵn sàng. Bạn có thể áp dụng trực tiếp hoặc mở diff để so sánh.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(polishResult)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#c8beb0] transition-colors hover:border-white/20 hover:text-white"
                    >
                      Sao chép
                    </button>
                    {getNovelPolishMode(polishModeId).outputKind === 'rewrite' ? (
                      <>
                        <button
                          type="button"
                          onClick={handleApplyPolishResult}
                          className="rounded-lg bg-accent-amber px-3 py-1.5 text-[11px] font-semibold text-[#1b140f] transition-colors hover:bg-[#ffd7ab]"
                        >
                          {polishSourceScope === 'story' ? 'Áp dụng toàn truyện' : 'Áp dụng'}
                        </button>
                        {polishSourceScope !== 'story' ? (
                          <button
                            type="button"
                            onClick={handlePreviewPolishResult}
                            className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-1.5 text-[11px] font-semibold text-accent-amber transition-colors hover:bg-accent-amber/15"
                          >
                            Xem thay đổi
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-white/[0.05] bg-[#100d0d] px-3 py-3 text-[12px] leading-6 whitespace-pre-wrap text-text-primary">
                  {polishResult}
                </div>
              </div>
            ) : null}

            {editorMode === 'write' ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-amber/80">
                    Tác vụ sáng tác
                  </p>
                  <p className="text-[10px] text-[#6f6259]">
                    Action tức thời trong lúc viết
                  </p>
                </div>
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {WRITING_ACTIONS.map((action) => {
                    const isDisabled = action.requiresSelection && !selection?.text?.trim();
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleQuickAction(action)}
                        disabled={isDisabled}
                        className="shrink-0 rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-medium text-[#c8beb0] transition hover:border-accent-amber/30 hover:text-accent-amber disabled:cursor-not-allowed disabled:opacity-40"
                        title={isDisabled ? 'Chọn một đoạn trước khi dùng tác vụ này.' : undefined}
                      >
                        <span className="mr-1">{action.icon}</span>
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {pendingScopeConfirmation ? (
              <div className="mb-3 rounded-2xl border border-accent-amber/25 bg-accent-amber/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-text-primary">
                      Xác nhận phạm vi trước khi chạy
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-[#c8beb0]">
                      AI đề xuất {getPromptScopeLabel(pendingScopeConfirmation.recommendedScope).toLowerCase()}. {pendingScopeConfirmation.reason}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {PROMPT_SCOPE_OPTIONS.map((option) => {
                    const isRecommended = option.id === pendingScopeConfirmation.recommendedScope;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleConfirmPromptScope(option.id)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                          isRecommended
                            ? 'border-accent-amber/40 bg-accent-amber text-[#1b140f]'
                            : 'border-white/10 bg-[#15110f] text-[#c8beb0] hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {isRecommended ? 'Dùng ' : ''}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Input box */}
            <div className="relative rounded-[20px] border border-white/5 bg-[#13100e] px-3.5 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              {/* Scope selector */}
              <div className="mb-2">
                <div
                  className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  title={getPromptScopeHelper(scope)}
                >
                  {PROMPT_SCOPE_OPTIONS.map((option) => {
                    const isActive = option.id === scope;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setScope(option.id);
                          setPendingScopeConfirmation(null);
                        }}
                        className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                          isActive
                            ? 'border-accent-amber/30 bg-accent-amber/15 text-text-primary'
                            : 'border-white/5 bg-[#1b1715] text-[#8f7f73] hover:border-white/10 hover:text-[#d6cbc0]'
                        }`}
                      >
                        <Crosshair className={`h-3 w-3 ${isActive ? 'text-accent-amber' : 'text-[#6f6259]'}`} />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setPendingScopeConfirmation(null);
                  if (e.target.value.trim()) {
                    setPolishAutoCollapseSignal((current) => current + 1);
                  }
                }}
                rows={3}
                className="w-full resize-none bg-transparent pb-10 pt-1 text-[14px] leading-relaxed text-text-primary outline-none transition placeholder:text-[#685c52]"
                placeholder={promptPlaceholder}
                onFocus={() => setPolishAutoCollapseSignal((current) => current + 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                style={{ minHeight: '84px' }}
              />

              {/* Send Button */}
              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                <VoiceMicButton
                  onText={(text) => {
                    setPrompt(text);
                    setPendingScopeConfirmation(null);
                  }}
                  disabled={isProcessing || isStreaming}
                  variant="dark"
                  size={14}
                />
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
