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
  type AutosaveDraft,
} from '../../lib/storage/autosave_draft_store';

interface Props {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onAddChapter: (id: string, chapter: Chapter) => void;
  onUpdateChapter: (projectId: string, chapterId: string, patch: Partial<Chapter>) => void;
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

  // ── UI State ──
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    chapters[0]?.id || null,
  );
  const [currentMode, setCurrentMode] = useState<EditorMode>(initialMode);
  const [isSaving, setIsSaving] = useState(false);

  // ── Ephemeral State ──
  const [localContents, setLocalContents] = useState<Record<string, string>>({});
  const [localTitles, setLocalTitles] = useState<Record<string, string>>({});
  const [selectionMap, setSelectionMap] = useState<Record<string, EditorSelection | null>>({});
  const [proposalMap, setProposalMap] = useState<Record<string, EditorAiProposal | null>>({});
  const [assistantPrefill, setAssistantPrefill] = useState('');
  const [isGeneratingFromScratch, setIsGeneratingFromScratch] = useState(false);
  const [isReloadingChapterContent, setIsReloadingChapterContent] = useState(false);

  // ── Session Tracking ──
  const [sessionStartTime] = useState(() => Date.now());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [initialWordCounts] = useState<Record<string, number>>({});

  // ── Autosave Recovery State ──
  const [recoveryDrafts, setRecoveryDrafts] = useState<AutosaveDraft[]>([]);

  // ── Store actions ──
  const insertChapter = useProjectStore((state) => state.insertChapter);

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
  const pushNotification = useNotificationStore((state) => state.push);
  const hydrateProjectChapters = useProjectStore((state) => state.hydrateProjectChapters);
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

    if (!activeChapterId || !chapters.some((chapter) => chapter.id === activeChapterId)) {
      setActiveChapterId(chapters[0].id);
    }
  }, [activeChapterId, chapters]);

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

  // [Domain:StoryEditor] STEP — beforeunload guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // [Domain:StoryEditor] Collect ALL dirty chapters, not just active
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
  }, [chapters, localContents, localTitles, project.id]);

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

    setIsSaving(true);
    try {
      onUpdateChapter(project.id, activeChapterId, {
        content,
        title,
        updatedAt: new Date().toISOString(),
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
      setLastSavedAt(new Date().toISOString());
      // [Domain:StoryEditor] Clear autosave draft after successful manual save
      clearChapterDraft(activeChapterId);
    } finally {
      setIsSaving(false);
    }
  }, [activeChapter, activeChapterId, clearChapterDraft, localContents, localTitles, onUpdateChapter, project.id]);

  const handleApprove = useCallback(() => {
    if (!activeChapterId || !activeChapter) return;
    const finalContent = localContents[activeChapterId] ?? activeChapter.content ?? '';
    const finalTitle = localTitles[activeChapterId] ?? activeChapter.title;

    onUpdateChapter(project.id, activeChapterId, {
      content: finalContent,
      title: finalTitle,
      status: 'final',
      updatedAt: new Date().toISOString(),
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
    setLastSavedAt(new Date().toISOString());
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
        onAddChapter(project.id, newChapter);
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
    insertChapter(project.id, newChapter, sequenceNumber);
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
    onAddChapter(project.id, newChapter);
    setActiveChapterId(id);
    setCurrentMode('write');
  }, [chapters.length, onAddChapter, project.id]);

  const handleGenerateFromScratch = useCallback(async () => {
    if (!activeChapterId || !activeChapter || isGeneratingFromScratch) return;

    const targetChapterIndex = Math.max(
      0,
      (activeChapter.sequenceNumber ?? chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1) - 1,
    );

    setIsGeneratingFromScratch(true);
    try {
      const session = await startWorkflowIntent({
        id: createId(),
        type: 'full_write_pipeline',
        projectId: project.id,
        chapterId: activeChapterId,
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
        },
      });

      const writeResult = session.artifacts.chapterWriteResult;
      if (!writeResult?.content?.trim()) {
        throw new Error(session.error?.message || 'AI không tạo được bản thảo chi tiết cho chương này.');
      }

      const nextUpdatedAt = new Date().toISOString();
      onUpdateChapter(project.id, activeChapterId, {
        title: writeResult.title || activeChapter.title,
        content: writeResult.content,
        summary: writeResult.ledger.summary || activeChapter.summary,
        status: 'draft',
        updatedAt: nextUpdatedAt,
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
      setProposalMap((prev) => ({
        ...prev,
        [activeChapterId]: null,
      }));
      setCurrentMode('write');
      setLastSavedAt(nextUpdatedAt);

      pushNotification({
        type: 'success',
        title: 'AI đã dựng lại chương từ đầu',
        message: session.artifacts.reviewReport
          ? `Đã tạo bản nháp mới và chạy kiểm duyệt tự động.`
          : 'Đã tạo bản nháp mới cho chương đang mở.',
      });
    } catch (error) {
      pushNotification({
        type: 'error',
        title: 'Không thể tạo lại chương',
        message: error instanceof Error ? error.message : 'Workflow viết chương thất bại.',
      });
    } finally {
      setIsGeneratingFromScratch(false);
    }
  }, [
    activeChapter,
    activeChapterId,
    chapters,
    isGeneratingFromScratch,
    onUpdateChapter,
    project,
    pushNotification,
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
            emptyStateVariant={isImportedStoryProject ? 'load-failure' : 'ai-draft'}
            isGeneratingFromScratch={isGeneratingFromScratch}
            isReloadingChapterContent={isReloadingChapterContent}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
            onAcceptProposal={handleAcceptProposal}
            onRejectProposal={handleRejectProposal}
            onSelectionChange={handleSelectionChange}
            onSelectionAction={handleSelectionAction}
            onGenerateFromScratch={handleGenerateFromScratch}
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
            chapters={chapters}
            selectedChapterId={activeChapterId}
            statusMap={statusMap}
            onSelectChapter={handleSelectChapter}
            onNewChapter={handleCreateNew}
            onInsertChapter={handleInsertChapter}
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
