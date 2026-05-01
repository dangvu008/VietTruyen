/**
 * File: StoryWorkspace.tsx
 * Purpose: Main story editor workspace — orchestrates sidebar, editor, AI panel, status bar
 * Layer: Application (Container)
 * Domain: StoryEditor
 * Deps: ChapterSidebar, ChapterEditorPane, AIAssistantPanel, EditorStatusBar, EditorTopbar
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { EditorTopbar } from './EditorTopbar';

import { ChapterEditorPane } from './ChapterEditorPane';
import { AIAssistantPanel } from './AIAssistantPanel';
import { EditorStatusBar } from './EditorStatusBar';
import { AutosaveRecoveryBanner } from './AutosaveRecoveryBanner';
import type {
  AIReviewSummary,
  ChatMessage,
  ChapterUIStatus,
  EditorAiProposal,
  EditorMode,
  EditorSelection,
  ProjectInfo,
  PromptScope,
} from './editor_types';
import { deriveChapterUIStatus } from './editor_types';
import type { Chapter, Project } from '../../types/story';
import { createId } from '../../core/id';
import { useTokenStore } from '../../store/use_token_store';
import { resolveWriterResumeChapterId, useAppSessionStore } from '../../store/use_app_session_store';
import { useCreationChatStore } from '../../store/use_creation_chat_store';
import { useStoryEditorChatStore } from '../../store/use_story_editor_chat_store';
import { useWorkflowSessionStore } from '../../store/use_workflow_session_store';
import { useNotificationStore } from '../../store/use_notification_store';
import { useProjectStore, getProjectSnapshot } from '../../store/use_project_store';
import { sortChaptersBySequence } from '../../lib/memory/chapter_order';
import { resolveFocusedFragmentSelection } from './editor_prompt_context';
import { buildStoryEditorSeedMessages } from './story_editor_chat_history';
import { describeCreationProgress } from '../../lib/creation/creation_progress';
import { isImportedProject } from '../../lib/project/project_display_stats';
import { useAutosave } from '../../hooks/use_autosave';
import {
  getDrafts,
  clearAllDrafts,
  saveDraftsBatch,
  saveGeneratingDraft,
  markDraftInterrupted,
  type AutosaveDraft,
} from '../../lib/storage/autosave_draft_store';
import { useGenerationStore } from '../../store/use_generation_store';

interface Props {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onAddChapter: (id: string, chapter: Chapter) => Promise<void> | void;
  onUpdateChapter: (projectId: string, chapterId: string, patch: Partial<Chapter>) => Promise<void> | void;
  initialMode?: EditorMode;
  onNavigate?: (tab: string) => void;
  onOpenCreationChat?: () => void;
}

export default function StoryWorkspace({
  project,
  onUpdateProject,
  onAddChapter,
  onUpdateChapter,
  initialMode = 'write',
  onNavigate,
  onOpenCreationChat,
}: Props) {
  const chapters = useMemo(
    () => sortChaptersBySequence(project.chapters || []),
    [project.chapters],
  );
  const rememberedChapterId = useAppSessionStore(
    (state) => state.activeWriterChapterIdByProject[project.id] ?? null,
  );
  const rememberWriterChapter = useAppSessionStore((state) => state.rememberWriterChapter);

  // ── UI State ──
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    () => resolveWriterResumeChapterId(chapters, rememberedChapterId),
  );
  const [currentMode, setCurrentMode] = useState<EditorMode>(initialMode);
  const [isSaving, setIsSaving] = useState(false);

  // ── Ephemeral State ──
  const [localContents, setLocalContents] = useState<Record<string, string>>({});
  const [localTitles, setLocalTitles] = useState<Record<string, string>>({});
  const [selectionMap, setSelectionMap] = useState<Record<string, EditorSelection | null>>({});
  const [proposalMap, setProposalMap] = useState<Record<string, EditorAiProposal | null>>({});
  const [assistantPrefill, setAssistantPrefill] = useState('');
  const [isReloadingChapterContent, setIsReloadingChapterContent] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; isRunning: boolean } | null>(null);

  // ── Session Tracking ──
  const [sessionStartTime] = useState(() => Date.now());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [initialWordCounts] = useState<Record<string, number>>({});

  // ── Autosave Recovery State ──
  const [recoveryDrafts, setRecoveryDrafts] = useState<AutosaveDraft[]>([]);

  // ── Store actions ──
  const insertChapter = useProjectStore((state) => state.insertChapter);
  const removeChapter = useProjectStore((state) => state.removeChapter);
  const replaceChapters = useProjectStore((state) => state.replaceProjectChapters);

  // ── Token Tracking (real data from store) ──
  const sessionTokens = useTokenStore((state) => {
    const stats = state.getStats();
    return stats.totalTokens;
  });
  const creationSession = useCreationChatStore((state) => ({
    linkedProjectId: state.progress.linkedProjectId,
    messages: state.messages,
    progress: state.progress,
    draftSavedAt: state.draftSavedAt,
  }));
  const setChapterMessages = useStoryEditorChatStore((state) => state.setChapterMessages);
  const seedChapterMessages = useStoryEditorChatStore((state) => state.seedChapterMessages);
  const startWorkflowIntent = useWorkflowSessionStore((state) => state.startIntent);
  // [Domain:StoryEditor] Scratch streaming state from generation store
  const isScratchStreaming = useGenerationStore((s) => s.isScratchStreaming);
  const startScratchStream = useGenerationStore((s) => s.startScratchStream);
  const appendScratchChunk = useGenerationStore((s) => s.appendScratchChunk);
  const stopScratchStream = useGenerationStore((s) => s.stopScratchStream);
  const finishScratchStream = useGenerationStore((s) => s.finishScratchStream);
  const setChunkPersistListener = useGenerationStore((s) => s.setChunkPersistListener);
  const pushNotification = useNotificationStore((state) => state.push);
  const hydrateProjectChapters = useProjectStore((state) => state.hydrateProjectChapters);
  const replaceProjectChapters = useProjectStore((state) => state.replaceProjectChapters);
  const activeMessages = useStoryEditorChatStore((state) =>
    activeChapterId
      ? state.chapterMessagesByProject[project.id]?.[activeChapterId] || []
      : [],
  );
  const creationSeedMessages = useMemo(
    () =>
      creationSession.linkedProjectId === project.id
        ? buildStoryEditorSeedMessages(creationSession.messages)
        : [],
    [creationSession.linkedProjectId, creationSession.messages, project.id],
  );

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === activeChapterId) || null,
    [chapters, activeChapterId],
  );

  useEffect(() => {
    setCurrentMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (chapters.length === 0) {
      setActiveChapterId(null);
      return;
    }

    setActiveChapterId((current) => {
      if (current && chapters.some((chapter) => chapter.id === current)) {
        return current;
      }

      return resolveWriterResumeChapterId(chapters, rememberedChapterId);
    });
  }, [chapters, rememberedChapterId]);

  useEffect(() => {
    rememberWriterChapter(project.id, activeChapterId);
  }, [activeChapterId, project.id, rememberWriterChapter]);

  // ── Autosave Hook ──
  const {
    status: autosaveStatus,
    lastAutosaveAt,
    flushNow: flushAutosave,
    clearChapterDraft,
  } = useAutosave({
    projectId: project.id,
    activeChapter,
    activeChapterId,
    localContents,
    localTitles,
  });

  // [Domain:StoryEditor] STEP — Check for recovery drafts on mount
  useEffect(() => {
    const drafts = getDrafts(project.id);
    if (drafts.length > 0) {
      setRecoveryDrafts(drafts);
    }
  }, [project.id]);

  // [Domain:StoryEditor] STEP — Register autosave listener for streaming chunks
  // Fires every chunk: debounces to write localStorage every ~500ms max.
  // Uses ref to avoid stale closure on chapter title.
  const chunkSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CHUNK_SAVE_DEBOUNCE_MS = 500;

  useEffect(() => {
    const listener = (chapterId: string, accumulated: string) => {
      // [Domain:StoryEditor] STEP — Debounce: don't write localStorage on every keystroke
      if (chunkSaveTimerRef.current) {
        clearTimeout(chunkSaveTimerRef.current);
      }
      chunkSaveTimerRef.current = setTimeout(() => {
        const store = useGenerationStore.getState();
        const jobId = store.generationJobId;
        if (!jobId) return;
        const chapter = chapters.find((c) => c.id === chapterId);
        const title = chapter?.title ?? 'Chương';
        saveGeneratingDraft(project.id, chapterId, accumulated, title, jobId);
      }, CHUNK_SAVE_DEBOUNCE_MS);
    };

    setChunkPersistListener(listener);

    return () => {
      // [Domain:StoryEditor] Cleanup: unregister listener and clear pending timer
      setChunkPersistListener(null);
      if (chunkSaveTimerRef.current) {
        clearTimeout(chunkSaveTimerRef.current);
      }
    };
  }, [chapters, project.id, setChunkPersistListener]);

  // [Domain:StoryEditor] STEP — Initial hydration: load chapter content from IndexedDB/Provider
  // Sets isHydrating=false when complete so UI can distinguish 'loading' from 'load-failure'
  useEffect(() => {
    let cancelled = false;
    setIsHydrating(true);

    hydrateProjectChapters(project.id)
      .catch((err) => {
        console.warn('[StoryWorkspace] Initial hydration failed:', err);
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrateProjectChapters, project.id]);

  // [Domain:StoryEditor] STEP — Enhanced beforeunload guard
  // Layer 1 protection: warn + flush when user tries to close/navigate away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // [Domain:StoryEditor] STEP 1 — Always warn if AI is actively generating
      if (isScratchStreaming) {
        e.preventDefault();
        // [Domain:StoryEditor] STEP 2 — Flush partial streaming content immediately
        const store = useGenerationStore.getState();
        const chapterId = store.generatingChapterId;
        const jobId = store.generationJobId;
        const accumulated = store.scratchStreamedText;
        if (chapterId && jobId && accumulated.trim()) {
          const chapter = chapters.find((c) => c.id === chapterId);
          saveGeneratingDraft(
            project.id,
            chapterId,
            accumulated,
            chapter?.title ?? 'Chương',
            jobId
          );
          // Mark as interrupted since user is leaving mid-generation
          markDraftInterrupted(project.id, chapterId);
        }
        return;
      }

      // [Domain:StoryEditor] STEP 3 — Collect ALL dirty chapters (manual edits)
      const dirtyDrafts: Array<{ chapterId: string; content: string; title: string }> = [];
      for (const chapter of chapters) {
        const contentChanged = chapter.id in localContents && localContents[chapter.id] !== chapter.content;
        const titleChanged = chapter.id in localTitles && localTitles[chapter.id] !== chapter.title;
        if (contentChanged || titleChanged) {
          dirtyDrafts.push({
            chapterId: chapter.id,
            content: localContents[chapter.id] ?? chapter.content ?? '',
            title: localTitles[chapter.id] ?? chapter.title ?? '',
          });
        }
      }

      if (dirtyDrafts.length > 0) {
        saveDraftsBatch(project.id, dirtyDrafts);
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [chapters, isScratchStreaming, localContents, localTitles, project.id]);

  const resolvedContent = useMemo(() => {
    if (!activeChapterId) return '';
    return localContents[activeChapterId] ?? activeChapter?.content ?? '';
  }, [activeChapterId, localContents, activeChapter]);

  const resolvedTitle = useMemo(() => {
    if (!activeChapterId) return '';
    return localTitles[activeChapterId] ?? activeChapter?.title ?? '';
  }, [activeChapterId, localTitles, activeChapter]);

  const activeSelection = useMemo(
    () => (activeChapterId ? selectionMap[activeChapterId] ?? null : null),
    [activeChapterId, selectionMap],
  );

  const activeProposal = useMemo(
    () => (activeChapterId ? proposalMap[activeChapterId] ?? null : null),
    [activeChapterId, proposalMap],
  );

  const wordCount = useMemo(() => {
    if (!resolvedContent.trim()) return 0;
    return resolvedContent.trim().split(/\s+/).length;
  }, [resolvedContent]);

  const readingTimeMinutes = useMemo(() => {
    return Math.max(1, Math.ceil(wordCount / 220));
  }, [wordCount]);

  // [Domain:StoryEditor] STEP 1 — Calculate words added during session
  const wordsAdded = useMemo(() => {
    if (!activeChapterId) return 0;
    const initial = initialWordCounts[activeChapterId] || 0;
    return Math.max(0, wordCount - initial);
  }, [activeChapterId, initialWordCounts, wordCount]);

  const isDirty = useMemo(() => {
    if (!activeChapterId || !activeChapter) return false;
    const contentDirty =
      activeChapterId in localContents && localContents[activeChapterId] !== activeChapter.content;
    const titleDirty =
      activeChapterId in localTitles && localTitles[activeChapterId] !== activeChapter.title;
    return contentDirty || titleDirty;
  }, [activeChapter, activeChapterId, localContents, localTitles]);

  const statusMap = useMemo(() => {
    const map: Record<string, ChapterUIStatus> = {};
    for (const ch of chapters) {
      const hasDirty = ch.id in localContents && localContents[ch.id] !== ch.content;
      map[ch.id] = deriveChapterUIStatus(ch, Boolean(proposalMap[ch.id]), hasDirty);
    }
    return map;
  }, [chapters, localContents, proposalMap]);

  const projectInfo: ProjectInfo = useMemo(
    () => ({ id: project.id, title: project.title }),
    [project.id, project.title],
  );

  const creationProgressSummary = useMemo(() => {
    if (creationSession.linkedProjectId !== project.id) return null;
    return {
      ...describeCreationProgress(creationSession.progress),
      draftSavedAt: creationSession.draftSavedAt,
    };
  }, [creationSession.draftSavedAt, creationSession.linkedProjectId, creationSession.progress, project.id]);

  useEffect(() => {
    if (!activeChapterId || creationSeedMessages.length === 0) return;
    seedChapterMessages(project.id, activeChapterId, creationSeedMessages);
  }, [activeChapterId, creationSeedMessages, project.id, seedChapterMessages]);

  // [Domain:StoryEditor] STEP 2 — Derive volume/part label from MasterOutline
  const partLabel = useMemo(() => {
    if (!activeChapter || !project.masterOutline) return null;
    const seqNum = activeChapter.sequenceNumber;
    if (seqNum == null) return null;

    for (const volume of project.masterOutline.volumes) {
      const [start, end] = volume.chapterRange;
      if (seqNum >= start && seqNum <= end) {
        return `Phần ${volume.volumeIndex + 1}: ${volume.title}`.toUpperCase();
      }
    }
    return null;
  }, [activeChapter, project.masterOutline]);

  const isImportedStoryProject = useMemo(
    () => isImportedProject(project, chapters.length) || Boolean(project.sourceProjectId),
    [chapters.length, project],
  );

  // [Domain:StoryEditor] STEP — Derive emptyStateVariant:
  // 'loading' while hydration is in progress,
  // 'load-failure' for imported projects after hydration completed with empty content,
  // 'ai-draft' for original projects
  const emptyStateVariant = useMemo<'ai-draft' | 'load-failure' | 'loading'>(() => {
    if (isHydrating) return 'loading';
    return isImportedStoryProject ? 'load-failure' : 'ai-draft';
  }, [isHydrating, isImportedStoryProject]);

  const handleMessagesChange = useCallback(
    (messages: ChatMessage[]) => {
      if (!activeChapterId) return;
      setChapterMessages(project.id, activeChapterId, messages);
    },
    [activeChapterId, project.id, setChapterMessages],
  );

  const reviewSummary = useMemo<AIReviewSummary | undefined>(() => {
    const source = activeProposal?.content || resolvedContent || activeChapter?.summary || '';
    if (!source.trim()) return undefined;

    const trimmed = source.replace(/\s+/g, ' ').trim();
    const summary = activeChapter?.summary || `${trimmed.slice(0, 170)}${trimmed.length > 170 ? '…' : ''}`;
    const warnings: AIReviewSummary['warnings'] = [];

    if (wordCount > 0 && wordCount < 400) {
      warnings.push({
        id: 'length',
        type: 'tone' as const,
        message: 'Chương còn khá ngắn. Có thể mở rộng thêm nhịp cảm xúc hoặc kết cảnh.',
        severity: 'low' as const,
      });
    }

    if (activeProposal?.scope === 'fragment') {
      warnings.push({
        id: 'fragment',
        type: 'consistency' as const,
        message: 'Đề xuất hiện tại chỉ áp dụng cho đoạn đang chọn. Hãy review trước khi nhập.',
        severity: 'medium' as const,
      });
    }

    if (activeProposal?.scope === 'story') {
      warnings.push({
        id: 'story',
        type: 'consistency' as const,
        message: 'Đề xuất này dùng ngữ cảnh toàn truyện. Hãy kiểm tra ảnh hưởng liên chương trước khi nhập.',
        severity: 'medium' as const,
      });
    }

    if (!warnings.length) {
      warnings.push({
        id: 'voice',
        type: 'lore' as const,
        message: 'Giữ thống nhất giọng kể giữa phần mở đầu và cao trào khi nhập đề xuất AI.',
        severity: 'low' as const,
      });
    }

    return {
      summary,
      warnings,
      characters: [],
      notes: [
        'Tăng căng thẳng ở cuối chương để giữ hook.',
        'Nếu có phóng tác, giữ sự kiện chính nhưng đổi nhịp và giọng kể.',
      ],
    };
  }, [activeChapter?.summary, activeProposal, resolvedContent, wordCount]);

  // ── Handlers ──

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeChapterId) return;
      setLocalContents((prev) => ({ ...prev, [activeChapterId]: content }));
    },
    [activeChapterId],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!activeChapterId) return;
      setLocalTitles((prev) => ({ ...prev, [activeChapterId]: title }));
    },
    [activeChapterId],
  );

  const handleSelectionChange = useCallback(
    (selection: EditorSelection | null) => {
      if (!activeChapterId) return;
      setSelectionMap((prev) => ({ ...prev, [activeChapterId]: selection }));
    },
    [activeChapterId],
  );

  const handleSave = useCallback(async () => {
    if (!activeChapterId || !activeChapter) return;
    const content = localContents[activeChapterId] ?? activeChapter.content;
    const title = localTitles[activeChapterId] ?? activeChapter.title;
    const savedAt = new Date().toISOString();

    setIsSaving(true);
    try {
      await onUpdateChapter(project.id, activeChapterId, {
        content,
        title,
        updatedAt: savedAt,
      });
      setLocalContents((prev) => {
        const next = { ...prev };
        delete next[activeChapterId];
        return next;
      });
      setLocalTitles((prev) => {
        const next = { ...prev };
        delete next[activeChapterId];
        return next;
      });
      setLastSavedAt(savedAt);
      // [Domain:StoryEditor] Clear autosave draft after successful manual save
      clearChapterDraft(activeChapterId);
    } finally {
      setIsSaving(false);
    }
  }, [activeChapter, activeChapterId, clearChapterDraft, localContents, localTitles, onUpdateChapter, project.id]);

  const handleApprove = useCallback(async () => {
    if (!activeChapterId || !activeChapter) return;
    const finalContent = localContents[activeChapterId] ?? activeChapter.content ?? '';
    const finalTitle = localTitles[activeChapterId] ?? activeChapter.title;
    const savedAt = new Date().toISOString();

    await onUpdateChapter(project.id, activeChapterId, {
      content: finalContent,
      title: finalTitle,
      status: 'final',
      updatedAt: savedAt,
    });

    setLocalContents((prev) => {
      const next = { ...prev };
      delete next[activeChapterId];
      return next;
    });
    setLocalTitles((prev) => {
      const next = { ...prev };
      delete next[activeChapterId];
      return next;
    });
    setLastSavedAt(savedAt);
  }, [activeChapter, activeChapterId, localContents, localTitles, onUpdateChapter, project.id]);

  const handleAiProposal = useCallback(
    ({
      content,
      scope,
      prompt,
    }: {
      content: string;
      scope: PromptScope;
      prompt: string;
    }) => {
      let targetId = activeChapterId;

      if (!targetId) {
        targetId = createId();
        const newChapter: Chapter = {
          id: targetId,
          title: `Chương ${chapters.length + 1}`,
          content: '',
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        void onAddChapter(project.id, newChapter);
        setActiveChapterId(targetId);
      }

      setProposalMap((prev) => ({
        ...prev,
        [targetId!]: {
          content,
          scope,
          prompt,
          createdAt: new Date().toISOString(),
          selection:
            scope === 'fragment'
              ? resolveFocusedFragmentSelection(
                  localContents[targetId!] ?? activeChapter?.content ?? '',
                  activeSelection,
                ) ?? undefined
              : undefined,
        },
      }));
      setCurrentMode('review');
    },
    [activeChapterId, activeSelection, chapters.length, onAddChapter, project.id],
  );

  const handleAcceptProposal = useCallback(() => {
    if (!activeChapterId || !activeProposal) return;

    setLocalContents((prev) => {
      const current = prev[activeChapterId] ?? activeChapter?.content ?? '';
      let nextContent = current;

      if (activeProposal.scope === 'fragment' && activeProposal.selection) {
        const { start, end } = activeProposal.selection;
        nextContent = `${current.slice(0, start)}${activeProposal.content}${current.slice(end)}`;
      } else {
        nextContent = current.trim()
          ? `${current.trim()}\n\n${activeProposal.content}`
          : activeProposal.content;
      }

      return {
        ...prev,
        [activeChapterId]: nextContent,
      };
    });

    setProposalMap((prev) => ({
      ...prev,
      [activeChapterId]: null,
    }));
    setCurrentMode(activeProposal.scope === 'fragment' ? 'detail' : 'write');
  }, [activeChapter?.content, activeChapterId, activeProposal]);

  const handleRejectProposal = useCallback(() => {
    if (!activeChapterId) return;
    setProposalMap((prev) => ({
      ...prev,
      [activeChapterId]: null,
    }));
    setCurrentMode('write');
  }, [activeChapterId]);

  const handleInsertChapter = useCallback((sequenceNumber: number) => {
    const id = createId();
    const newChapter: Chapter = {
      id,
      title: `Chương ${sequenceNumber}`,
      content: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    void insertChapter(project.id, newChapter, sequenceNumber);
    setActiveChapterId(id);
    setCurrentMode('write');
    setAssistantPrefill(`Tôi vừa chèn một chương mới ở vị trí này. Dựa trên dữ kiện chương trước và nội dung chương sau, hãy thảo luận và đề xuất các hướng phát triển sự kiện cốt lõi để bảo đảm mạch truyện được mượt mà, không bị xa rời truyện.`);
  }, [insertChapter, project.id]);

  const handleCreateNew = useCallback(() => {
    const id = createId();
    const newChapter: Chapter = {
      id,
      title: `Chương ${chapters.length + 1}`,
      content: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    void onAddChapter(project.id, newChapter);
    setActiveChapterId(id);
    setCurrentMode('write');
  }, [chapters.length, onAddChapter, project.id]);

  const handleGenerateFromScratch = useCallback(async () => {
    if (!activeChapterId || !activeChapter || isScratchStreaming) return;

    const targetChapterIndex = Math.max(
      0,
      (activeChapter.sequenceNumber ?? chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1) - 1,
    );

    // [Domain:StoryEditor] STEP 1 — Start scratch stream WITH chapterId for job tracking
    const controller = startScratchStream(activeChapterId);
    const capturedChapterId = activeChapterId;

    // [Domain:StoryEditor] STEP 2 — Clear existing content and show streaming in editor immediately
    setLocalContents((prev) => ({ ...prev, [capturedChapterId]: '' }));

    try {
      const session = await startWorkflowIntent(
        {
          id: createId(),
          type: 'full_write_pipeline',
          projectId: project.id,
          chapterId: capturedChapterId,
          source: 'button',
          createdAt: new Date().toISOString(),
          payload: {
            workflowEngine: 'api',
            project,
            targetChapterIndex,
            mode: targetChapterIndex === 0 ? 'create' : 'continue',
            tensionLevel: 'nudge',
            prompt: activeChapter.summary?.trim() || undefined,
            notes: 'Chương hiện tại đang rỗng. Hãy dựng lại từ đầu, bám sát canon, nhân vật, thế giới và outline đã chốt.',
            styleInstruction: project.writingStyle || undefined,
            skipReview: true,
            skipPolish: true,
            qualityMode: 'fast',
          },
        },
        {
          // [Domain:StoryEditor] STEP 3 — Each chunk streams directly into editor content
          onChunk: (_chunk: string, accumulated: string) => {
            appendScratchChunk(_chunk);
            setLocalContents((prev) => ({ ...prev, [capturedChapterId]: accumulated }));
          },
          signal: controller.signal,
        },
      );

      // [Domain:StoryEditor] STEP 4 — Pipeline done; persist final content to store
      const writeResult = session.artifacts.chapterWriteResult;
      const finalContent = writeResult?.content?.trim()
        ? writeResult.content
        : useGenerationStore.getState().scratchStreamedText;

      if (!finalContent?.trim()) {
        if (controller.signal.aborted) {
          // User stopped — keep what we have in localContents (partial content)
          finishScratchStream();
          return;
        }
        throw new Error(session.error?.message || 'AI không tạo được bản thảo chi tiết cho chương này.');
      }

      const nextUpdatedAt = new Date().toISOString();
      const nextChapters = chapters.map((chapter) =>
        chapter.id === capturedChapterId
          ? {
              ...chapter,
              title: writeResult?.title || activeChapter.title,
              content: finalContent,
              summary: writeResult?.ledger?.summary || activeChapter.summary,
              status: 'draft' as const,
              updatedAt: nextUpdatedAt,
            }
          : chapter,
      );
      await replaceProjectChapters(project.id, nextChapters, { storageMode: 'indexeddb' });

      // [Domain:StoryEditor] STEP 5 — Clear local override so editor picks up from store
      setLocalContents((prev) => {
        const next = { ...prev };
        delete next[capturedChapterId];
        return next;
      });
      setLocalTitles((prev) => {
        const next = { ...prev };
        delete next[capturedChapterId];
        return next;
      });
      setProposalMap((prev) => ({
        ...prev,
        [capturedChapterId]: null,
      }));
      setCurrentMode('write');
      setLastSavedAt(nextUpdatedAt);
      finishScratchStream();

      pushNotification({
        type: 'success',
        title: 'AI đã dựng lại chương từ đầu',
        message: session.artifacts.reviewReport
          ? `Đã tạo bản nháp mới và chạy kiểm duyệt tự động.`
          : 'Đã tạo bản nháp mới cho chương đang mở.',
      });
    } catch (error) {
      // [Domain:StoryEditor] STEP — Classify error for user-friendly message
      console.error('[handleGenerateFromScratch] Pipeline error:', error);
      finishScratchStream();

      // If user aborted — keep partial content, no error notification
      if (controller.signal.aborted) return;

      let userMessage = 'Workflow viết chương thất bại.';
      if (error instanceof Error) {
        if (error.message.includes('exceeded hard input budget')) {
          userMessage = 'Ngữ cảnh dự án quá lớn (vượt giới hạn token). Hãy thử bắt đầu từ chương 1 hoặc kiểm tra cấu hình model.';
        } else if (error.message.includes('Không tìm thấy model AI')) {
          userMessage = 'Chưa có model AI nào được cấu hình. Hãy vào Cài đặt → AI để thêm model.';
        } else if (error.message.includes('sentinel contract') || error.message.includes('rỗng hoặc quá ngắn')) {
          userMessage = 'AI không tạo được bản thảo. Có thể model chưa hỗ trợ format yêu cầu. Hãy thử đổi model khác.';
        } else if (!error.message.includes('dừng quá trình')) {
          userMessage = error.message;
        } else {
          return; // User-initiated stop — silent
        }
      }
      pushNotification({
        type: 'error',
        title: 'Không thể tạo lại chương',
        message: userMessage,
      });
    }
  }, [
    activeChapter,
    activeChapterId,
    appendScratchChunk,
    chapters,
    finishScratchStream,
    isScratchStreaming,
    project,
    pushNotification,
    replaceProjectChapters,
    startScratchStream,
    startWorkflowIntent,
  ]);

  // [Domain:StoryEditor] STEP — Stop scratch generation mid-stream
  const handleStopScratch = useCallback(() => {
    // [Domain:StoryEditor] Layer 4: Mark draft as interrupted before stopping
    // so recovery system can detect "tạo dở dang" on next session
    const store = useGenerationStore.getState();
    if (store.generatingChapterId && store.generationJobId) {
      markDraftInterrupted(project.id, store.generatingChapterId);
    }
    stopScratchStream();
  }, [project.id, stopScratchStream]);

  // [Domain:StoryEditor] STEP — Batch generate content for ALL empty chapters
  const emptyChapterIds = useMemo(
    () => chapters.filter((ch) => !ch.content?.trim()).map((ch) => ch.id),
    [chapters],
  );

  const handleBatchGenerateAll = useCallback(async () => {
    const emptyChapters = chapters.filter((ch) => !ch.content?.trim());
    if (emptyChapters.length === 0 || batchProgress?.isRunning) return;

    const total = emptyChapters.length;
    setBatchProgress({ current: 0, total, isRunning: true });

    let successCount = 0;
    let failCount = 0;
    let workingChapters = chapters;

    for (let i = 0; i < emptyChapters.length; i++) {
      const ch = emptyChapters[i];
      setBatchProgress({ current: i + 1, total, isRunning: true });
      setActiveChapterId(ch.id);

      const chapterIndex = Math.max(
        0,
        (ch.sequenceNumber ?? chapters.findIndex((c) => c.id === ch.id) + 1) - 1,
      );

      try {
        const workingProject: Project = {
          ...project,
          chapters: workingChapters,
        };
        const session = await startWorkflowIntent({
          id: createId(),
          type: 'full_write_pipeline',
          projectId: project.id,
          chapterId: ch.id,
          source: 'batch',
          createdAt: new Date().toISOString(),
          payload: {
            workflowEngine: 'api',
            project: workingProject,
            targetChapterIndex: chapterIndex,
            mode: chapterIndex === 0 ? 'create' : 'continue',
            tensionLevel: 'nudge',
            prompt: ch.summary?.trim() || undefined,
            notes: 'Viết nội dung chi tiết cho chương này, bám sát canon, nhân vật, thế giới và outline đã chốt.',
            styleInstruction: project.writingStyle || undefined,
            skipReview: true,
            skipPolish: true,
            qualityMode: 'fast',
          },
        });

        const writeResult = session.artifacts.chapterWriteResult;
        if (!writeResult?.content?.trim()) {
          failCount++;
          continue;
        }

        const nextUpdatedAt = new Date().toISOString();
        workingChapters = workingChapters.map((chapter) =>
          chapter.id === ch.id
            ? {
                ...chapter,
                title: writeResult.title || ch.title,
                content: writeResult.content,
                summary: writeResult.ledger.summary || ch.summary,
                status: 'draft' as const,
                updatedAt: nextUpdatedAt,
              }
            : chapter,
        );
        await replaceProjectChapters(project.id, workingChapters, { storageMode: 'indexeddb' });

        // Clear local overrides so editor picks up fresh store content
        setLocalContents((prev) => {
          const next = { ...prev };
          delete next[ch.id];
          return next;
        });
        setLocalTitles((prev) => {
          const next = { ...prev };
          delete next[ch.id];
          return next;
        });

        successCount++;
      } catch (error) {
        console.error(`[BatchGenerate] Failed chapter ${ch.title}:`, error);
        failCount++;
      }
    }

    setBatchProgress(null);

    pushNotification({
      type: failCount === 0 ? 'success' : 'warning',
      title: `Đã viết xong ${successCount}/${total} chương`,
      message: failCount > 0
        ? `${failCount} chương gặp lỗi. Bạn có thể thử lại từng chương bằng nút "AI tạo lại từ đầu".`
        : 'Tất cả chương đã được AI viết nội dung chi tiết!',
    });
  }, [
    batchProgress,
    chapters,
    onUpdateChapter,
    project,
    pushNotification,
    replaceProjectChapters,
    startWorkflowIntent,
  ]);

  const handleRetryLoadChapterContent = useCallback(async () => {
    if (!activeChapterId || !activeChapter || isReloadingChapterContent) return;

    setIsReloadingChapterContent(true);
    try {
      await hydrateProjectChapters(project.id);
      const refreshedProject = await getProjectSnapshot(project.id);
      const refreshedChapter = refreshedProject?.chapters.find((chapter) =>
        chapter.id === activeChapterId ||
        (chapter.sequenceNumber != null && chapter.sequenceNumber === activeChapter.sequenceNumber)
      );

      if (refreshedChapter?.content?.trim()) {
        // [Domain:StoryEditor] Clear stale localContents so resolvedContent
        // picks up the freshly hydrated chapter.content from the store
        setLocalContents((prev) => {
          const next = { ...prev };
          delete next[activeChapterId];
          return next;
        });
        pushNotification({
          type: 'success',
          title: 'Đã nạp lại nội dung chương',
          message: 'Nội dung đã được tải lại từ bộ nhớ dự án.',
        });
        return;
      }

      pushNotification({
        type: 'warning',
        title: 'Chưa tải lại được nội dung',
        message: 'Chapter vẫn đang rỗng sau khi reload. Hãy kiểm tra nguồn dữ liệu hoặc storage provider.',
      });
    } catch (error) {
      pushNotification({
        type: 'error',
        title: 'Lỗi tải lại nội dung',
        message: error instanceof Error ? error.message : 'Không thể hydrate lại chapter từ storage.',
      });
    } finally {
      setIsReloadingChapterContent(false);
    }
  }, [
    activeChapter,
    activeChapterId,
    hydrateProjectChapters,
    isReloadingChapterContent,
    project.id,
    pushNotification,
  ]);

  const handleSelectChapter = useCallback((id: string) => {
    setActiveChapterId(id);
  }, []);

  const handleSelectionAction = useCallback((action: string) => {
    if (!activeSelection?.text) return;
    setCurrentMode('detail');
    setAssistantPrefill(`${action} cho đoạn đang chọn, giữ ý chính và văn phong phù hợp với chương.`);
  }, [activeSelection?.text]);

  // [Domain:StoryEditor] STEP — Recovery handlers
  const handleRecoverDrafts = useCallback(() => {
    for (const draft of recoveryDrafts) {
      setLocalContents((prev) => ({ ...prev, [draft.chapterId]: draft.content }));
      setLocalTitles((prev) => ({ ...prev, [draft.chapterId]: draft.title }));
    }
    clearAllDrafts(project.id);
    setRecoveryDrafts([]);
  }, [recoveryDrafts, project.id]);

  const handleDiscardDrafts = useCallback(() => {
    clearAllDrafts(project.id);
    setRecoveryDrafts([]);
  }, [project.id]);

  // [Domain:StoryEditor] STEP — Delete chapter
  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    await removeChapter(project.id, chapterId);
    if (activeChapterId === chapterId) {
      const next = chapters.find((c) => c.id !== chapterId);
      setActiveChapterId(next?.id ?? null);
    }
    pushNotification({ type: 'success', title: 'Đã xóa chương', message: 'Chương đã được xóa khỏi dự án.' });
  }, [activeChapterId, chapters, project.id, pushNotification, removeChapter]);

  // [Domain:StoryEditor] STEP — Duplicate chapter
  const handleDuplicateChapter = useCallback(async (chapter: Chapter) => {
    const { createId: mkId } = await import('../../core/id');
    const newId = mkId();
    const seq = (chapter.sequenceNumber ?? chapters.length) + 1;
    const copy: Chapter = {
      ...chapter,
      id: newId,
      title: chapter.title ? `${chapter.title} (Bản sao)` : `Chương ${seq}`,
      sequenceNumber: seq,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertChapter(project.id, copy, seq);
    setActiveChapterId(newId);
    pushNotification({ type: 'success', title: 'Đã nhân bản chương', message: `Đã tạo bản sao: "${copy.title}"` });
  }, [chapters, insertChapter, project.id, pushNotification]);

  // [Domain:StoryEditor] STEP — Move chapter up (swap sequence numbers)
  const handleMoveChapterUp = useCallback(async (chapterId: string) => {
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx <= 0) return;
    const reordered = [...chapters];
    const tmp = reordered[idx - 1];
    reordered[idx - 1] = { ...reordered[idx], sequenceNumber: tmp.sequenceNumber };
    reordered[idx] = { ...tmp, sequenceNumber: reordered[idx].sequenceNumber };
    await replaceChapters(project.id, reordered, { storageMode: 'indexeddb' });
  }, [chapters, project.id, replaceChapters]);

  // [Domain:StoryEditor] STEP — Move chapter down (swap sequence numbers)
  const handleMoveChapterDown = useCallback(async (chapterId: string) => {
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx < 0 || idx >= chapters.length - 1) return;
    const reordered = [...chapters];
    const seqA = reordered[idx].sequenceNumber;
    const seqB = reordered[idx + 1].sequenceNumber;
    reordered[idx] = { ...reordered[idx + 1], sequenceNumber: seqA };
    reordered[idx + 1] = { ...chapters[idx], sequenceNumber: seqB };
    await replaceChapters(project.id, reordered, { storageMode: 'indexeddb' });
  }, [chapters, project.id, replaceChapters]);

  void onUpdateProject;

  // ── Render ──

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg-deep text-text-primary font-sans selection:bg-accent-amber/20 selection:text-accent-amber">
      {/* Top Navigation Bar - Full Width */}
      <EditorTopbar
        project={projectInfo}
        chapter={activeChapter}
        chapters={chapters}
        statusMap={statusMap}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={handleSave}
        onApprove={handleApprove}
        onSelectChapter={handleSelectChapter}
        sessionTokens={sessionTokens}
        onNewChapter={handleCreateNew}
        onNavigate={onNavigate}
        onOpenCreationChat={creationProgressSummary ? onOpenCreationChat : undefined}
        creationProgressSummary={creationProgressSummary}
        emptyChapterCount={emptyChapterIds.length}
        batchProgress={batchProgress}
        onBatchGenerateAll={handleBatchGenerateAll}
      />

      {/* Main Content Area - 3 Columns */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Center Editor */}
        {/* Autosave Recovery Banner */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#110e0c]">
          {recoveryDrafts.length > 0 && (
            <div className="px-10 pt-4">
              <AutosaveRecoveryBanner
                drafts={recoveryDrafts}
                onRecover={handleRecoverDrafts}
                onDiscard={handleDiscardDrafts}
              />
            </div>
          )}
          <ChapterEditorPane
            chapter={activeChapter}
            mode={currentMode}
            aiProposal={activeProposal}
            localContent={resolvedContent}
            localTitle={resolvedTitle}
            partLabel={partLabel}
            wordCount={wordCount}
            readingTimeMinutes={readingTimeMinutes}
            lastSavedAt={lastSavedAt}
            emptyStateVariant={emptyStateVariant}
            isGeneratingFromScratch={isScratchStreaming}
            isReloadingChapterContent={isReloadingChapterContent}
            batchProgress={batchProgress}
            emptyChapterCount={emptyChapterIds.length}
            onBatchGenerateAll={handleBatchGenerateAll}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
            onAcceptProposal={handleAcceptProposal}
            onRejectProposal={handleRejectProposal}
            onSelectionChange={handleSelectionChange}
            onSelectionAction={handleSelectionAction}
            onGenerateFromScratch={handleGenerateFromScratch}
            onStopScratch={handleStopScratch}
            onRetryLoadContent={handleRetryLoadChapterContent}
            hasSelection={Boolean(activeSelection?.text)}
            onModeChange={setCurrentMode}
          />
        </div>

        {/* Right Panel — Chapters + AI Muse */}
        <div className="hidden w-[380px] shrink-0 border-l border-[#241c17] bg-[#161210] lg:flex lg:flex-col shadow-[-8px_0_24px_rgba(0,0,0,0.2)] z-10">
          <AIAssistantPanel
            chapterContent={resolvedContent}
            chapterTitle={activeChapter?.title ?? ''}
            reviewSummary={reviewSummary}
            selection={activeSelection}
            activeProposal={activeProposal}
            prefillPrompt={assistantPrefill}
            messages={activeMessages}
            onMessagesChange={handleMessagesChange}
            onAiResponse={handleAiProposal}
            onOpenReview={() => setCurrentMode('review')}
            sessionTokens={sessionTokens}
            project={projectInfo}
            fullProject={project}
            chapters={chapters}
            selectedChapterId={activeChapterId}
            statusMap={statusMap}
            onSelectChapter={handleSelectChapter}
            onNewChapter={handleCreateNew}
            onInsertChapter={handleInsertChapter}
            onDeleteChapter={handleDeleteChapter}
            onDuplicateChapter={handleDuplicateChapter}
            onMoveChapterUp={handleMoveChapterUp}
            onMoveChapterDown={handleMoveChapterDown}
          />
        </div>
      </div>

      {/* Bottom Status Bar - Full Width */}
      <EditorStatusBar
        wordCount={wordCount}
        wordsAdded={wordsAdded}
        readingTimeMinutes={readingTimeMinutes}
        lastSavedAt={lastSavedAt}
        isSyncing={isSaving}
        sessionStartTime={sessionStartTime}
        autosaveStatus={autosaveStatus}
        lastAutosaveAt={lastAutosaveAt}
      />
    </div>
  );
}
