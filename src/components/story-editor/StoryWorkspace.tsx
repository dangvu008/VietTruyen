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
import VersionHistoryPanel from '../shared/VersionHistoryPanel';
import type {
  AIReviewSummary,
  ChatMessage,
  ChapterUIStatus,
  EditorAiProposal,
  EditorMode,
  EditorSelection,
  EditorSelectionIntent,
  EditorSelectionIntentRequest,
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
import { useAppearanceStore } from '../../store/use_appearance_store';
import { useProjectStore, getProjectSnapshot } from '../../store/use_project_store';
import { sortChaptersBySequence } from '../../lib/memory/chapter_order';
import { resolveFocusedFragmentSelection } from './editor_prompt_context';
import {
  buildStoryEditorSeedMessages,
  mergeStoryEditorChatMessages,
} from './story_editor_chat_history';
import { applyEditorDraftInsertion } from './editor_draft_insertion';
import { describeCreationProgress } from '../../lib/creation/creation_progress';
import { restoreImportedProjectFromSnapshot } from '../../lib/adaptation/imported_project_recovery';
import { isImportedProject } from '../../lib/project/project_display_stats';
import { useTemplateStore } from '../../store/use_template_store';
import { extractWriterVisibleContent } from '../../lib/ai/writer_response_content';
import { resolveExtractedTemplateFromSource } from '../../lib/story_templates/shared_template_registry';
import {
  buildProjectTemplateSourceText,
  countProjectTemplateChapterContentChars,
} from '../../lib/story_templates/project_template_source';
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
import type { QualityMode } from '../../types/workflow';
import type { PendingHook, PropagationTask } from '../../types/narrative_memory';
import { getChapterContinuityTasks } from '../../lib/memory/memory_query';
import { getOpenHooksForProject } from '../../lib/memory/pending_hooks_repository';

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
  const [selectionIntentRequest, setSelectionIntentRequest] = useState<EditorSelectionIntentRequest | null>(null);
  const [isReloadingChapterContent, setIsReloadingChapterContent] = useState(false);
  const [isRestoringImportedSource, setIsRestoringImportedSource] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; isRunning: boolean } | null>(null);
  const [qualityMode, setQualityMode] = useState<QualityMode>('quality');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaveLabel, setTemplateSaveLabel] = useState('');

  // ── Session Tracking ──
  const [sessionStartTime] = useState(() => Date.now());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [initialWordCounts] = useState<Record<string, number>>({});

  // ── Autosave Recovery State ──
  const [recoveryDrafts, setRecoveryDrafts] = useState<AutosaveDraft[]>([]);
  const [chapterContinuityTasks, setChapterContinuityTasks] = useState<PropagationTask[]>([]);
  const [openHooks, setOpenHooks] = useState<PendingHook[]>([]);

  // ── Store actions ──
  const insertChapter = useProjectStore((state) => state.insertChapter);
  const removeChapter = useProjectStore((state) => state.removeChapter);
  const updateChapter = useProjectStore((state) => state.updateChapter);
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
  const syncEditorTextMessages = useCreationChatStore((state) => state.syncEditorTextMessages);
  const setChapterMessages = useStoryEditorChatStore((state) => state.setChapterMessages);
  const startWorkflowIntent = useWorkflowSessionStore((state) => state.startIntent);
  // [Domain:StoryEditor] Scratch streaming state from generation store
  const isScratchStreaming = useGenerationStore((s) => s.isScratchStreaming);
  const generatingChapterId = useGenerationStore((s) => s.generatingChapterId);
  const startScratchStream = useGenerationStore((s) => s.startScratchStream);
  const appendScratchChunk = useGenerationStore((s) => s.appendScratchChunk);
  const stopScratchStream = useGenerationStore((s) => s.stopScratchStream);
  const finishScratchStream = useGenerationStore((s) => s.finishScratchStream);
  const setChunkPersistListener = useGenerationStore((s) => s.setChunkPersistListener);
  const pushNotification = useNotificationStore((state) => state.push);
  const hydrateProjectChapters = useProjectStore((state) => state.hydrateProjectChapters);
  const replaceProjectChapters = useProjectStore((state) => state.replaceProjectChapters);
  const activeStoredMessages = useStoryEditorChatStore((state) =>
    activeChapterId
      ? state.chapterMessagesByProject[project.id]?.[activeChapterId] || []
      : [],
  );
  const creationSeedMessages = useMemo(
    () =>
      creationSession.linkedProjectId === project.id && activeChapterId
        ? buildStoryEditorSeedMessages(creationSession.messages, {
          projectId: project.id,
          chapterId: activeChapterId,
        })
        : [],
    [activeChapterId, creationSession.linkedProjectId, creationSession.messages, project.id],
  );
  const activeMessages = useMemo(
    () => mergeStoryEditorChatMessages(creationSeedMessages, activeStoredMessages),
    [activeStoredMessages, creationSeedMessages],
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

  useEffect(() => {
    if (!activeChapterId) {
      setChapterContinuityTasks([]);
      setOpenHooks([]);
      return;
    }

    let cancelled = false;
    const loadContinuityContext = async () => {
      const [tasks, hooks] = await Promise.all([
        getChapterContinuityTasks(project.id, activeChapterId).catch(() => []),
        getOpenHooksForProject(project.id).catch(() => []),
      ]);

      if (cancelled) return;
      setChapterContinuityTasks(tasks);
      setOpenHooks(hooks);
    };

    void loadContinuityContext();
    return () => {
      cancelled = true;
    };
  }, [activeChapterId, project.id, project.updatedAt]);

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
      let status = deriveChapterUIStatus(ch, Boolean(proposalMap[ch.id]), hasDirty);

      // [Domain:StoryEditor] FIX RC-3 visual — During hydration, chapters appear 'empty'
      // because localStorage strips content. Override to 'ai-draft' so UI shows
      // "AI nháp" (loading indicator) instead of misleading "Trống"
      if (isHydrating && status === 'empty') {
        status = 'ai-draft';
      }

      // [Domain:StoryEditor] FIX — Race condition: chapter.generationStatus may still be
      // 'generating' in DB while the generation store has already cleared generatingChapterId
      // (i.e. finishScratchStream() was called). If the chapter is NOT the current active
      // generation target, treat it as if generation is done and re-derive real status.
      if (status === 'generating' && ch.id !== generatingChapterId) {
        // Derive status ignoring generationStatus field by checking content/flags
        const chapterWithDoneStatus = { ...ch, generationStatus: 'done' as const };
        status = deriveChapterUIStatus(chapterWithDoneStatus, Boolean(proposalMap[ch.id]), hasDirty);
      }

      map[ch.id] = status;
    }
    return map;
  }, [chapters, generatingChapterId, isHydrating, localContents, proposalMap]);

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
      syncEditorTextMessages(project.id, activeChapterId, messages);
    },
    [activeChapterId, project.id, setChapterMessages, syncEditorTextMessages],
  );

  const reviewSummary = useMemo<AIReviewSummary | undefined>(() => {
    const source = activeProposal?.content || resolvedContent || activeChapter?.summary || '';
    if (!source.trim()) return undefined;

    const trimmed = source.replace(/\s+/g, ' ').trim();
    const summaryBase = activeChapter?.summary || `${trimmed.slice(0, 170)}${trimmed.length > 170 ? '…' : ''}`;
    const warnings: AIReviewSummary['warnings'] = [];
    const revisionTasks: string[] = [];

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

    chapterContinuityTasks.slice(0, 3).forEach((task) => {
      warnings.push({
        id: `continuity-${task.id}`,
        type: task.attributeKey.toLowerCase().includes('time') ? 'timeline' : 'continuity',
        message: task.recommendedAction,
        severity: task.severity === 'breaking' ? 'high' : task.severity === 'warning' ? 'medium' : 'low',
      });
      revisionTasks.push(`Vá continuity Ch.${task.chapterIndex}: ${task.recommendedAction}`);
    });

    openHooks
      .filter((hook) => !activeChapter || hook.plantedChapterIndex <= (activeChapter.sequenceNumber ?? 0))
      .slice(0, 2)
      .forEach((hook) => {
        warnings.push({
          id: `hook-${hook.id}`,
          type: 'hook',
          message: hook.expectedPayoffBy
            ? `Hook chưa thanh toán trước Ch.${hook.expectedPayoffBy}: ${hook.description}`
            : `Hook đang mở: ${hook.description}`,
          severity: hook.expectedPayoffBy && activeChapter && hook.expectedPayoffBy <= (activeChapter.sequenceNumber ?? 0) + 1 ? 'high' : 'medium',
        });
        revisionTasks.push(`Giữ hoặc thanh toán hook: ${hook.description}`);
      });

    if (!warnings.length) {
      warnings.push({
        id: 'voice',
        type: 'lore' as const,
        message: 'Giữ thống nhất giọng kể giữa phần mở đầu và cao trào khi nhập đề xuất AI.',
        severity: 'low' as const,
      });
    }

    const summary = [
      summaryBase,
      chapterContinuityTasks.length > 0 ? `Có ${chapterContinuityTasks.length} cảnh báo continuity cần rà.` : '',
      openHooks.length > 0 ? `${openHooks.length} hook vẫn đang mở.` : '',
    ].filter(Boolean).join(' ');

    return {
      summary,
      warnings,
      characters: [],
      notes: [
        'Tăng căng thẳng ở cuối chương để giữ hook.',
        'Nếu có phóng tác, giữ sự kiện chính nhưng đổi nhịp và giọng kể.',
        ...revisionTasks,
      ],
      revisionTasks,
    };
  }, [activeChapter, activeProposal, chapterContinuityTasks, openHooks, resolvedContent, wordCount]);

  // ── Handlers ──

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeChapterId) return;
      setLocalContents((prev) => {
        if (prev[activeChapterId] === content) return prev;
        return { ...prev, [activeChapterId]: content };
      });
    },
    [activeChapterId],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!activeChapterId) return;
      setLocalTitles((prev) => {
        if (prev[activeChapterId] === title) return prev;
        return { ...prev, [activeChapterId]: title };
      });
    },
    [activeChapterId],
  );

  const handleRenameActiveChapter = useCallback(async (title: string) => {
    const nextTitle = title.trim();
    if (!activeChapterId || !activeChapter || !nextTitle) return;

    const previousLocalTitle = localTitles[activeChapterId];
    const savedAt = new Date().toISOString();

    setLocalTitles((prev) => ({
      ...prev,
      [activeChapterId]: nextTitle,
    }));

    try {
      await onUpdateChapter(project.id, activeChapterId, {
        title: nextTitle,
        updatedAt: savedAt,
      });
      setLocalTitles((prev) => {
        const next = { ...prev };
        delete next[activeChapterId];
        return next;
      });
      setLastSavedAt(savedAt);
    } catch (error) {
      setLocalTitles((prev) => {
        const next = { ...prev };
        if (previousLocalTitle == null) {
          delete next[activeChapterId];
        } else {
          next[activeChapterId] = previousLocalTitle;
        }
        return next;
      });
      throw error;
    }
  }, [activeChapter, activeChapterId, localTitles, onUpdateChapter, project.id]);

  const handleSelectionChange = useCallback(
    (selection: EditorSelection | null) => {
      if (!activeChapterId) return;

      // Textarea onSelect fires for cursor moves, focus changes, and selection
      // drags. Avoid replacing state with an equivalent object on every event;
      // those updates force the whole workspace/right panel to rerender and can
      // freeze long chapters.
      const normalizedSelection = selection?.text?.trim() ? selection : null;
      setSelectionMap((prev) => {
        const current = prev[activeChapterId] ?? null;
        if (
          current === normalizedSelection ||
          (
            current?.start === normalizedSelection?.start &&
            current?.end === normalizedSelection?.end &&
            current?.text === normalizedSelection?.text
          )
        ) {
          return prev;
        }
        return { ...prev, [activeChapterId]: normalizedSelection };
      });
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

  const createDraftChapterAtEnd = useCallback(() => {
    const id = createId();
    const sequenceNumber = chapters.length + 1;
    const newChapter: Chapter = {
      id,
      title: `Chương ${sequenceNumber}`,
      content: '',
      sequenceNumber,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    void onAddChapter(project.id, newChapter);
    setActiveChapterId(id);
    return id;
  }, [chapters.length, onAddChapter, project.id]);

  const handleAiProposal = useCallback(
    ({
      content,
      scope,
      prompt,
      selection,
    }: {
      content: string;
      scope: PromptScope;
      prompt: string;
      selection?: EditorSelection;
    }) => {
      let targetId = activeChapterId;

      if (!targetId) {
        targetId = createDraftChapterAtEnd();
      }

      const resolvedSelection =
        scope === 'fragment'
          ? selection
          ?? resolveFocusedFragmentSelection(
            localContents[targetId!] ?? activeChapter?.content ?? '',
            activeSelection,
          )
          ?? undefined
          : undefined;

      setProposalMap((prev) => ({
        ...prev,
        [targetId!]: {
          content,
          scope,
          prompt,
          createdAt: new Date().toISOString(),
          selection: resolvedSelection,
        },
      }));
      setCurrentMode('review');
    },
    [activeChapter?.content, activeChapterId, activeSelection, createDraftChapterAtEnd, localContents],
  );

  const applyProposalToDraft = useCallback((
    proposal: Pick<EditorAiProposal, 'content' | 'scope' | 'selection'>,
    targetChapterId = activeChapterId,
  ) => {
    if (!targetChapterId) return;

    const targetChapter = chapters.find((chapter) => chapter.id === targetChapterId) ?? null;
    const currentContent = localContents[targetChapterId] ?? targetChapter?.content ?? '';
    const nextContent = applyEditorDraftInsertion(currentContent, proposal);
    const savedAt = new Date().toISOString();

    setLocalContents((prev) => ({
      ...prev,
      [targetChapterId]: nextContent,
    }));

    const replacesWholeChapter =
      proposal.scope === 'fragment'
      && Boolean(proposal.selection)
      && (proposal.selection?.start ?? -1) <= 0
      && (proposal.selection?.end ?? 0) >= currentContent.length;

    setCurrentMode(proposal.scope === 'fragment' && !replacesWholeChapter ? 'detail' : 'write');
    setActiveChapterId(targetChapterId);

    void Promise.resolve(
      onUpdateChapter(project.id, targetChapterId, {
        content: nextContent,
        status: 'draft',
        updatedAt: savedAt,
      }),
    ).then(() => {
      setLocalContents((prev) => {
        const next = { ...prev };
        delete next[targetChapterId];
        return next;
      });
      setLastSavedAt(savedAt);
      clearChapterDraft(targetChapterId);
    }).catch((error: unknown) => {
      console.error('[applyProposalToDraft] Failed to persist accepted AI proposal:', error);
      pushNotification({
        type: 'error',
        title: 'Chưa lưu được bản thảo',
        message: 'Nội dung đã được chèn vào editor tạm thời, nhưng chưa ghi được vào kho lưu trữ.',
      });
    });
  }, [
    activeChapterId,
    chapters,
    clearChapterDraft,
    localContents,
    onUpdateChapter,
    project.id,
    pushNotification,
  ]);

  const handleAcceptProposal = useCallback(() => {
    if (!activeChapterId || !activeProposal) return;

    applyProposalToDraft(activeProposal);

    setProposalMap((prev) => ({
      ...prev,
      [activeChapterId]: null,
    }));
  }, [activeChapterId, activeProposal, applyProposalToDraft]);

  const handleApplyRewrite = useCallback(
    ({
      content,
      scope,
      selection,
    }: {
      content: string;
      scope: PromptScope;
      prompt: string;
      selection?: EditorSelection;
    }) => {
      const targetId = activeChapterId ?? createDraftChapterAtEnd();
      const targetChapter = chapters.find((chapter) => chapter.id === targetId) ?? null;
      const resolvedSelection =
        scope === 'fragment'
          ? selection
          ?? resolveFocusedFragmentSelection(
            localContents[targetId] ?? targetChapter?.content ?? '',
            activeSelection,
          )
          ?? undefined
          : undefined;

      applyProposalToDraft({
        content,
        scope,
        selection: resolvedSelection,
      }, targetId);

      setProposalMap((prev) => ({
        ...prev,
        [targetId]: null,
      }));
    },
    [activeChapterId, activeSelection, applyProposalToDraft, chapters, createDraftChapterAtEnd, localContents],
  );

  const handleApplyStoryRewrite = useCallback(
    ({
      chapters: rewrittenChapters,
    }: {
      chapters: Array<{ chapterId: string; title: string; content: string }>;
      prompt: string;
    }) => {
      if (rewrittenChapters.length === 0) return;

      setLocalContents((prev) => {
        const next = { ...prev };
        for (const rewrittenChapter of rewrittenChapters) {
          next[rewrittenChapter.chapterId] = rewrittenChapter.content;
        }
        return next;
      });

      if (activeChapterId && rewrittenChapters.some((chapter) => chapter.chapterId === activeChapterId)) {
        setProposalMap((prev) => ({
          ...prev,
          [activeChapterId]: null,
        }));
        setCurrentMode('write');
      }
    },
    [activeChapterId],
  );

  const handleRejectProposal = useCallback(() => {
    if (!activeChapterId) return;
    setProposalMap((prev) => ({
      ...prev,
      [activeChapterId]: null,
    }));
    setCurrentMode('write');
  }, [activeChapterId]);

  const handleRestoreVersion = useCallback((content: string, title: string) => {
    if (!activeChapterId) return;

    setLocalContents((prev) => ({
      ...prev,
      [activeChapterId]: content,
    }));
    setLocalTitles((prev) => ({
      ...prev,
      [activeChapterId]: title,
    }));
    setProposalMap((prev) => ({
      ...prev,
      [activeChapterId]: null,
    }));
    setCurrentMode('write');
    setShowVersionHistory(false);
  }, [activeChapterId]);

  const handleInsertChapter = useCallback((sequenceNumber: number) => {
    const id = createId();
    const newChapter: Chapter = {
      id,
      title: `Chương ${sequenceNumber}`,
      content: '',
      sequenceNumber,
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
    const id = createDraftChapterAtEnd();
    setActiveChapterId(id);
    setCurrentMode('write');
  }, [createDraftChapterAtEnd]);

  interface ChapterGenerationRunOptions {
    workflowQualityMode?: QualityMode;
  }

  const handleGenerateFromScratch = useCallback(async (
    targetChapterId?: string,
    options?: ChapterGenerationRunOptions,
  ) => {
    const resolvedChapterId = targetChapterId ?? activeChapterId;
    const targetChapter = chapters.find((chapter) => chapter.id === resolvedChapterId);
    if (!resolvedChapterId || !targetChapter || isScratchStreaming) return;
    const runQualityMode = options?.workflowQualityMode ?? qualityMode;

    const targetChapterIndex = Math.max(
      0,
      (targetChapter.sequenceNumber ?? chapters.findIndex((chapter) => chapter.id === resolvedChapterId) + 1) - 1,
    );

    // [Domain:StoryEditor] STEP 1 — Start scratch stream WITH chapterId for job tracking
    const controller = startScratchStream(resolvedChapterId);
    const capturedChapterId = resolvedChapterId;
    const generationStartedAt = new Date().toISOString();
    await onUpdateChapter(project.id, capturedChapterId, {
      generationStatus: 'generating',
      generationStartedAt,
      updatedAt: generationStartedAt,
    });

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
            prompt: targetChapter.summary?.trim() || undefined,
            notes: 'Chương hiện tại đang rỗng. Hãy dựng lại từ đầu, bám sát canon, nhân vật, thế giới và outline đã chốt.',
            styleInstruction: project.writingStyle || undefined,
            qualityMode: runQualityMode,
          },
        },
        {
          // [Domain:StoryEditor] STEP 3 — Each chunk streams directly into editor content
          onChunk: (_chunk: string, accumulated: string) => {
            appendScratchChunk(_chunk);
            const displayContent = extractWriterVisibleContent(accumulated);
            setLocalContents((prev) => ({ ...prev, [capturedChapterId]: displayContent }));
          },
          signal: controller.signal,
        },
      );

      // [Domain:StoryEditor] STEP 4 — Pipeline done; persist final content to store
      const writeResult = session.artifacts.chapterWriteResult;
      let finalContent = writeResult?.content?.trim()
        ? writeResult.content
        : useGenerationStore.getState().scratchStreamedText;

      if (!writeResult?.content?.trim()) {
        finalContent = extractWriterVisibleContent(finalContent);
      }

      if (!finalContent?.trim()) {
        if (controller.signal.aborted) {
          await onUpdateChapter(project.id, capturedChapterId, {
            generationStatus: 'partial',
            generationStartedAt: undefined,
            updatedAt: new Date().toISOString(),
          });
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
            title: writeResult?.title || targetChapter.title,
            content: finalContent,
            summary: writeResult?.ledger?.summary || targetChapter.summary,
            status: 'draft' as const,
            generationStatus: controller.signal.aborted ? 'partial' as const : 'done' as const,
            generationStartedAt: undefined,
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
      // [Domain:StoryEditor] FIX — Cancel pending debounce timer BEFORE clearing draft.
      // If timer fires after clearChapterDraft(), saveGeneratingDraft() would re-create
      // the draft with generationStatus='generating', causing false recovery banner on next load.
      if (chunkSaveTimerRef.current) {
        clearTimeout(chunkSaveTimerRef.current);
        chunkSaveTimerRef.current = null;
      }
      // [Domain:StoryEditor] FIX — Clear autosave draft after successful generation.
      // Previously missing from happy path (was only called in applyProposalToDraft/handleSave).
      clearChapterDraft(capturedChapterId);
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
      const partialContent = extractWriterVisibleContent(
        localContents[capturedChapterId] ?? useGenerationStore.getState().scratchStreamedText ?? '',
      ).trim();
      if (partialContent) {
        await onUpdateChapter(project.id, capturedChapterId, {
          content: partialContent,
          status: 'draft',
          generationStatus: controller.signal.aborted ? 'partial' : 'failed',
          generationStartedAt: undefined,
          updatedAt: new Date().toISOString(),
        });
        setLocalContents((prev) => {
          const next = { ...prev };
          delete next[capturedChapterId];
          return next;
        });
      } else {
        await onUpdateChapter(project.id, capturedChapterId, {
          generationStatus: controller.signal.aborted ? 'partial' : 'failed',
          generationStartedAt: undefined,
          updatedAt: new Date().toISOString(),
        });
      }
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
    activeChapterId,
    appendScratchChunk,
    chapters,
    finishScratchStream,
    isScratchStreaming,
    project,
    pushNotification,
    qualityMode,
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

    // [Domain:StoryEditor] STEP — Guard: prevent batch when hydration is still in progress
    // to avoid using stripped chapters from localStorage that overwrite IndexedDB content
    if (isHydrating) {
      pushNotification({
        type: 'warning',
        title: 'Đang nạp dữ liệu...',
        message: 'Vui lòng đợi nạp xong dữ liệu trước khi viết batch.',
      });
      return;
    }

    const total = emptyChapters.length;
    setBatchProgress({ current: 0, total, isRunning: true });

    let successCount = 0;
    let failCount = 0;

    // [Domain:StoryEditor] STEP — Use fresh chapters from store (post-hydration)
    // to preserve any existing content from IndexedDB instead of using stale `chapters`
    // which may have been stripped by partialize
    const freshProject = useProjectStore.getState().projects.find((p) => p.id === project.id);
    let workingChapters = freshProject
      ? sortChaptersBySequence(freshProject.chapters || [])
      : chapters;

    console.log('[handleBatchGenerateAll] Starting batch', {
      emptyCount: emptyChapters.length,
      totalChapters: workingChapters.length,
      chaptersWithContent: workingChapters.filter((c) => c.content?.trim()).length,
    });

    for (let i = 0; i < emptyChapters.length; i++) {
      const ch = emptyChapters[i];
      setBatchProgress({ current: i + 1, total, isRunning: true });
      setActiveChapterId(ch.id);
      const generationStartedAt = new Date().toISOString();
      workingChapters = workingChapters.map((chapter) =>
        chapter.id === ch.id
          ? {
            ...chapter,
            generationStatus: 'generating' as const,
            generationStartedAt,
            updatedAt: generationStartedAt,
          }
          : chapter,
      );
      await replaceProjectChapters(project.id, workingChapters, { storageMode: 'indexeddb' });

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
            qualityMode,
          },
        });

        const writeResult = session.artifacts.chapterWriteResult;
        if (!writeResult?.content?.trim()) {
          const failedAt = new Date().toISOString();
          workingChapters = workingChapters.map((chapter) =>
            chapter.id === ch.id
              ? {
                ...chapter,
                generationStatus: 'failed' as const,
                generationStartedAt: undefined,
                updatedAt: failedAt,
              }
              : chapter,
          );
          await replaceProjectChapters(project.id, workingChapters, { storageMode: 'indexeddb' });
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
              generationStatus: 'done' as const,
              generationStartedAt: undefined,
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
        const failedAt = new Date().toISOString();
        workingChapters = workingChapters.map((chapter) =>
          chapter.id === ch.id
            ? {
              ...chapter,
              generationStatus: 'failed' as const,
              generationStartedAt: undefined,
              updatedAt: failedAt,
            }
            : chapter,
        );
        await replaceProjectChapters(project.id, workingChapters, { storageMode: 'indexeddb' });
        failCount++;
      }
    }

    setBatchProgress(null);

    console.log('[handleBatchGenerateAll] Batch complete', {
      successCount,
      failCount,
      totalChapters: workingChapters.length,
      chaptersWithContent: workingChapters.filter((c) => c.content?.trim()).length,
    });

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
    isHydrating,
    onUpdateChapter,
    project,
    pushNotification,
    qualityMode,
    replaceProjectChapters,
    startWorkflowIntent,
  ]);

  const handleContinueGeneration = useCallback(async (
    targetChapterId?: string,
    options?: ChapterGenerationRunOptions,
  ) => {
    const resolvedChapterId = targetChapterId ?? activeChapterId;
    const targetChapter = chapters.find((chapter) => chapter.id === resolvedChapterId);
    if (!resolvedChapterId || !targetChapter || isScratchStreaming) return;
    const runQualityMode = options?.workflowQualityMode ?? qualityMode;

    const baseContent = (localContents[resolvedChapterId] ?? targetChapter.content ?? '').trim();
    if (!baseContent) {
      await handleGenerateFromScratch(resolvedChapterId, options);
      return;
    }

    const targetChapterIndex = Math.max(
      0,
      (targetChapter.sequenceNumber ?? chapters.findIndex((chapter) => chapter.id === resolvedChapterId) + 1) - 1,
    );

    const controller = startScratchStream(resolvedChapterId);
    const capturedChapterId = resolvedChapterId;
    const generationStartedAt = new Date().toISOString();

    await onUpdateChapter(project.id, capturedChapterId, {
      generationStatus: 'generating',
      generationStartedAt,
      updatedAt: generationStartedAt,
    });

    setLocalContents((prev) => ({ ...prev, [capturedChapterId]: baseContent }));

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
            mode: 'continue',
            tensionLevel: 'nudge',
            prompt: targetChapter.summary?.trim() || undefined,
            sourceOverride: baseContent,
            notes: [
              'Chương này bị dừng giữa chừng. Chỉ viết phần tiếp nối ngay sau nội dung đã có, không lặp lại đoạn cũ.',
              'Giữ đúng văn phong, nhân vật, mạch truyện và hoàn tất chương ở độ dài đầy đủ.',
            ].join('\n'),
            styleInstruction: project.writingStyle || undefined,
            qualityMode: runQualityMode,
          },
        },
        {
          onChunk: (_chunk: string, accumulated: string) => {
            appendScratchChunk(_chunk);
            const continuation = extractWriterVisibleContent(accumulated).trim();
            setLocalContents((prev) => ({
              ...prev,
              [capturedChapterId]: continuation ? `${baseContent}\n\n${continuation}` : baseContent,
            }));
          },
          signal: controller.signal,
        },
      );

      const continuation = session.artifacts.chapterWriteResult?.content?.trim()
        ? session.artifacts.chapterWriteResult.content.trim()
        : extractWriterVisibleContent(useGenerationStore.getState().scratchStreamedText).trim();
      const finalContent = continuation ? `${baseContent}\n\n${continuation}` : baseContent;
      const nextUpdatedAt = new Date().toISOString();

      if (!continuation && !controller.signal.aborted) {
        throw new Error(session.error?.message || 'AI không tạo được phần tiếp tục cho chương này.');
      }

      await onUpdateChapter(project.id, capturedChapterId, {
        content: finalContent,
        summary: session.artifacts.chapterWriteResult?.ledger?.summary || targetChapter.summary,
        status: 'draft',
        generationStatus: continuation ? 'done' : 'partial',
        generationStartedAt: undefined,
        updatedAt: nextUpdatedAt,
      });

      setLocalContents((prev) => {
        const next = { ...prev };
        delete next[capturedChapterId];
        return next;
      });
      setLastSavedAt(nextUpdatedAt);
      finishScratchStream();

      if (continuation) {
        pushNotification({
          type: 'success',
          title: 'Đã tiếp tục chương dở',
          message: 'AI đã nối tiếp từ nội dung đang có và lưu lại vào chương.',
        });
      }
    } catch (error) {
      console.error('[handleContinueGeneration] Pipeline error:', error);
      finishScratchStream();

      const streamedContinuation = extractWriterVisibleContent(
        useGenerationStore.getState().scratchStreamedText || '',
      ).trim();
      const partialContent = streamedContinuation
        ? `${baseContent}\n\n${streamedContinuation}`
        : (localContents[capturedChapterId] ?? baseContent).trim();
      await onUpdateChapter(project.id, capturedChapterId, {
        content: partialContent,
        status: 'draft',
        generationStatus: controller.signal.aborted ? 'partial' : 'failed',
        generationStartedAt: undefined,
        updatedAt: new Date().toISOString(),
      });

      if (controller.signal.aborted) return;

      pushNotification({
        type: 'error',
        title: 'Không thể tiếp tục chương',
        message: error instanceof Error ? error.message : 'Workflow viết tiếp chương thất bại.',
      });
    }
  }, [
    activeChapterId,
    appendScratchChunk,
    chapters,
    finishScratchStream,
    handleGenerateFromScratch,
    isScratchStreaming,
    localContents,
    onUpdateChapter,
    project,
    pushNotification,
    qualityMode,
    startScratchStream,
    startWorkflowIntent,
  ]);

  const handleCompleteChapter = useCallback(async (chapterId: string) => {
    const targetChapter = chapters.find((chapter) => chapter.id === chapterId);
    if (!targetChapter || isScratchStreaming) return;
    // Completion flow should unblock interrupted chapters quickly instead of
    // waiting on the full review/polish/memory pipeline.
    const completionRunOptions: ChapterGenerationRunOptions = { workflowQualityMode: 'fast' };

    setActiveChapterId(chapterId);
    setCurrentMode('write');

    const resolvedContent = (localContents[chapterId] ?? targetChapter.content ?? '').trim();
    if (resolvedContent) {
      await handleContinueGeneration(chapterId, completionRunOptions);
      return;
    }

    await handleGenerateFromScratch(chapterId, completionRunOptions);
  }, [
    chapters,
    handleContinueGeneration,
    handleGenerateFromScratch,
    isScratchStreaming,
    localContents,
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

  const handleRestoreImportedSource = useCallback(async () => {
    if (isRestoringImportedSource) return;

    setIsRestoringImportedSource(true);
    try {
      const result = await restoreImportedProjectFromSnapshot(
        project.id,
        {
          replaceProjectChapters,
        },
        {
          storageMode: project.storageMode === 'provider' ? 'provider' : 'indexeddb',
        },
      );

      if (result.status === 'restored') {
        setLocalContents({});
        setLocalTitles({});
        setSelectionMap({});
        setProposalMap({});
        setActiveChapterId(null);
        pushNotification({
          type: 'success',
          title: 'Đã khôi phục bản import',
          message: `Đã dựng lại ${result.chaptersRestored} chương từ snapshot import gần nhất và ghi đè dữ liệu lỗi.`,
        });
        return;
      }

      pushNotification({
        type: 'warning',
        title: 'Không còn snapshot để khôi phục',
        message: 'Thiết bị này không còn lưu bản import gốc. Hãy dùng "Import lại & ghi đè" để nạp lại file và thay thế project hiện tại.',
      });
    } catch (error) {
      pushNotification({
        type: 'error',
        title: 'Khôi phục bản import thất bại',
        message: error instanceof Error ? error.message : 'Không thể dựng lại chapters từ snapshot import.',
      });
    } finally {
      setIsRestoringImportedSource(false);
    }
  }, [isRestoringImportedSource, project.id, project.storageMode, pushNotification, replaceProjectChapters]);

  const handleOpenReimportFlow = useCallback(() => {
    onNavigate?.('adaptation');
  }, [onNavigate]);

  const handleSelectChapter = useCallback((id: string) => {
    setActiveChapterId(id);
  }, []);

  const handleSelectionAction = useCallback((action: EditorSelectionIntent) => {
    if (!activeSelection?.text.trim()) return;
    setCurrentMode('detail');
    if (action === 'custom') {
      setAssistantPrefill('Tôi muốn sửa đoạn đang chọn theo hướng: ');
      return;
    }
    setSelectionIntentRequest({
      id: createId(),
      intent: action,
      selection: {
        start: activeSelection.start,
        end: activeSelection.end,
        text: activeSelection.text.trim(),
      },
    });
  }, [activeSelection]);

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

  // [Domain:StoryEditor] STEP — Toggle chapter favorite
  const handleToggleChapterFavorite = useCallback(async (chapterId: string) => {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    await updateChapter(project.id, chapterId, { isFavorite: !chapter.isFavorite });
  }, [chapters, project.id, updateChapter]);

  // [Domain:StoryEditor] STEP — Next Chapter
  const handleNextChapter = useCallback(() => {
    if (!activeChapterId) return;
    const sortedChapters = [...chapters].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
    const currentIndex = sortedChapters.findIndex(c => c.id === activeChapterId);
    if (currentIndex >= 0 && currentIndex < sortedChapters.length - 1) {
      setActiveChapterId(sortedChapters[currentIndex + 1].id);
    }
  }, [activeChapterId, chapters]);

  void onUpdateProject;

  const isReadingModeFullscreen = useAppearanceStore((state) => state.isReadingModeFullscreen);
  const setReadingModeFullscreen = useAppearanceStore((state) => state.setReadingModeFullscreen);

  const handleModeChange = useCallback((newMode: EditorMode) => {
    setCurrentMode(newMode);
    if (newMode === 'read') {
      setReadingModeFullscreen(true);
    } else {
      setReadingModeFullscreen(false);
    }
  }, [setReadingModeFullscreen]);

  // ── Save as Template ──
  const hasSavedAsTemplate = useTemplateStore((state) => !!state.getTemplateById(project.id));
  const addCustomTemplate = useTemplateStore((state) => state.addCustomTemplate);

  const handleSaveAsTemplate = useCallback(async () => {
    if (hasSavedAsTemplate || isSavingTemplate) return;

    setIsSavingTemplate(true);
    setTemplateSaveLabel('Đang chuẩn bị nội dung truyện...');
    flushAutosave();

    try {
      const sourceProject = await getProjectSnapshot(project.id) ?? project;
      const draftOverrides = { contents: localContents, titles: localTitles };
      const chapterContentChars = countProjectTemplateChapterContentChars(sourceProject, draftOverrides);

      if (chapterContentChars === 0) {
        pushNotification({
          type: 'error',
          title: 'Chưa thể lưu Template',
          message: 'Không tìm thấy nội dung chương để trích xuất. Hãy lưu hoặc nhập nội dung chương trước.',
        });
        return;
      }

      const sourceText = buildProjectTemplateSourceText(sourceProject, draftOverrides);
      const resolution = await resolveExtractedTemplateFromSource({
        sourceTitle: sourceProject.title,
        sourceText,
        shareByDefault: false,
        onProgress: (progress) => setTemplateSaveLabel(progress.label),
      });

      addCustomTemplate({
        ...resolution.template,
        id: project.id,
        name: `[Lưu từ truyện] ${sourceProject.title}`,
        originalName: sourceProject.title,
        tags: Array.from(
          new Set([
            ...(resolution.template.tags ?? []),
            ...(sourceProject.subGenre ?? []),
            'custom',
            'saved-from-story',
          ]),
        ),
        targetChapterCount: sourceProject.targetChapters,
      });

      pushNotification({
        type: 'success',
        title: 'Đã lưu thành Template',
        message: 'Template đã được trích xuất từ nội dung chương và có thể dùng lại cho truyện mới.',
      });
    } catch (error) {
      console.warn('[StoryWorkspace] Save as template failed:', error);
      pushNotification({
        type: 'error',
        title: 'Lưu Template thất bại',
        message: error instanceof Error ? error.message : 'Không thể trích xuất template từ truyện hiện tại.',
      });
    } finally {
      setIsSavingTemplate(false);
      setTemplateSaveLabel('');
    }
  }, [
    addCustomTemplate,
    flushAutosave,
    hasSavedAsTemplate,
    isSavingTemplate,
    localContents,
    localTitles,
    project,
    pushNotification,
  ]);

  // ── Render ──

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg-deep text-text-primary font-sans selection:bg-accent-amber/20 selection:text-accent-amber">
      {/* Top Navigation Bar - Full Width */}
      {!isReadingModeFullscreen && (
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
          qualityMode={qualityMode}
          onQualityModeChange={setQualityMode}
          onSaveAsTemplate={handleSaveAsTemplate}
          hasSavedAsTemplate={hasSavedAsTemplate}
          isSavingTemplate={isSavingTemplate}
          templateSaveLabel={templateSaveLabel}
          onCompleteChapter={handleCompleteChapter}
        />
      )}

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
            isDirty={isDirty}
            emptyStateVariant={emptyStateVariant}
            isGeneratingFromScratch={isScratchStreaming && generatingChapterId === activeChapter?.id}
            isScratchGenerationRunning={isScratchStreaming}
            isReloadingChapterContent={isReloadingChapterContent}
            isRestoringImportedSource={isRestoringImportedSource}
            batchProgress={batchProgress}
            emptyChapterCount={emptyChapterIds.length}
            onBatchGenerateAll={handleBatchGenerateAll}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
            onAcceptProposal={handleAcceptProposal}
            onRejectProposal={handleRejectProposal}
            onSelectionChange={handleSelectionChange}
            onSelectionAction={handleSelectionAction}
            onGenerateFromScratch={() => void handleGenerateFromScratch()}
            onContinueGeneration={() => void handleContinueGeneration()}
            onStopScratch={handleStopScratch}
            onRetryLoadContent={handleRetryLoadChapterContent}
            onRestoreImportedSource={handleRestoreImportedSource}
            onOpenReimportFlow={onNavigate ? handleOpenReimportFlow : undefined}
            onOpenVersionHistory={() => setShowVersionHistory(true)}
            hasSelection={Boolean(activeSelection?.text)}
            onModeChange={handleModeChange}
            onNextChapter={handleNextChapter}
          />
        </div>

        {/* Right Panel — Chapters + AI Muse */}
        {!isReadingModeFullscreen && (
          <div className="z-10 w-[400px] shrink-0 border-l border-[#241c17] bg-[#161210] shadow-[-8px_0_24px_rgba(0,0,0,0.2)] lg:flex lg:flex-col xl:w-[440px] 2xl:w-[480px]">
            <AIAssistantPanel
              editorMode={currentMode}
              chapterContent={resolvedContent}
              chapterTitle={resolvedTitle}
              reviewSummary={reviewSummary}
              selection={activeSelection}
              selectionIntentRequest={selectionIntentRequest}
              activeProposal={activeProposal}
              prefillPrompt={assistantPrefill}
              messages={activeMessages}
              onMessagesChange={handleMessagesChange}
              onSelectionIntentConsumed={() => setSelectionIntentRequest(null)}
              onAiResponse={handleAiProposal}
              onOpenReview={() => setCurrentMode('review')}
              onOpenDiff={() => setCurrentMode('diff')}
              onApplyRewrite={handleApplyRewrite}
              onRenameChapter={handleRenameActiveChapter}
              onApplyStoryRewrite={handleApplyStoryRewrite}
              sessionTokens={sessionTokens}
              project={projectInfo}
              fullProject={project}
              chapters={chapters}
              storySourceChapters={chapters}
              selectedChapterId={activeChapterId}
              statusMap={statusMap}
              onSelectChapter={handleSelectChapter}
              onNewChapter={handleCreateNew}
              onInsertChapter={handleInsertChapter}
              onDeleteChapter={handleDeleteChapter}
              onDuplicateChapter={handleDuplicateChapter}
              onToggleChapterFavorite={handleToggleChapterFavorite}
              onOpenCreationChat={creationProgressSummary ? onOpenCreationChat : undefined}
              onCompleteChapter={handleCompleteChapter}
            />
          </div>
        )}
      </div>

      {/* Bottom Status Bar - Full Width */}
      {!isReadingModeFullscreen && (
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
      )}

      {showVersionHistory && activeChapter && (
        <VersionHistoryPanel
          chapterId={activeChapter.id}
          projectId={project.id}
          currentTitle={resolvedTitle || activeChapter.title}
          currentContent={resolvedContent}
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleRestoreVersion}
        />
      )}
    </div>
  );
}
