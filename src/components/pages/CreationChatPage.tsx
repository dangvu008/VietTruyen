/**
 * File: CreationChatPage.tsx
 * Purpose: Main unified creation chat page — 4 phases in 1 scrollable chat
 * Layer: UI (Page)
 * Domain: CreationChat → [describe, discuss, framework, compose]
 *
 * Design: "The Nocturnal Editor" — single chat interface
 * All 4 phases render in 1 scrollable message list.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Sparkles, Send, BookOpen, FileClock, MessageSquareQuote } from 'lucide-react';
import { getProjectSnapshot, useProjectStore } from '../../store/use_project_store';
import { createId } from '../../core/id';
import { useCreationChatStore } from '../../store/use_creation_chat_store';
import SuggestionChips from '../creation/SuggestionChips';
import PlotPreviewCard from '../creation/PlotPreviewCard';
import FrameworkPreview from '../creation/FrameworkPreview';
import ChapterDraftCard from '../creation/ChapterDraftCard';
import ChapterSidebarPanel from '../creation/ChapterSidebarPanel';
import { AiThinkingIndicator } from '../shared/AiThinkingIndicator';
import { AiConnectionDebugPanel } from '../shared/AiConnectionDebugPanel';
import { STARTER_IDEAS } from '../../lib/ai/creation_discuss_config';
import { buildCreationProjectSeed } from '../../lib/creation/project_seed';
import {
  handleDescribeSubmit,
  handleDiscussAnswer,
  handleAiDecide,
  handleSmartSkip,
  handlePlotPreviewFeedback,
  handlePlotPreviewConfirm,
  handleFrameworkConfirm,
  handleWriteChapter,
  handleAcceptChapter,
  retryFrameworkGeneration,
} from '../../lib/ai/creation_orchestrator';
import type { ProjectTabId } from '../../types/navigation';
import { describeCreationProgress } from '../../lib/creation/creation_progress';

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: '#120f0d',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid rgba(80,69,59,0.3)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e8e1dc',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
  },
  phaseBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 9999,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  headerBtn: (active = false) => ({
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
    padding: '8px 12px',
    borderRadius: 12,
    border: active
      ? '1px solid rgba(212,165,116,0.35)'
      : '1px solid rgba(80,69,59,0.3)',
    background: active ? 'rgba(212,165,116,0.12)' : 'transparent',
    color: active ? '#f2c08d' : '#cbb8aa',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    transition: 'all 0.2s',
  }),
  statusPanel: {
    margin: '18px 20px 0',
    padding: '14px 16px',
    borderRadius: 18,
    border: '1px solid rgba(80,69,59,0.35)',
    background:
      'linear-gradient(180deg, rgba(39,30,24,0.78) 0%, rgba(23,19,16,0.92) 100%)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: 16,
  },
  statusMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    minWidth: 0,
  },
  statusHeadline: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f1e6da',
  },
  statusDetail: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#bca999',
  },
  statusCaption: {
    fontSize: 11,
    color: '#8f7f73',
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 20,
    padding: '40px 20px',
    textAlign: 'center' as const,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#e8e1dc',
    lineHeight: 1.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9c8e82',
    lineHeight: 1.6,
    maxWidth: 420,
  },
  starterChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    justifyContent: 'center' as const,
    maxWidth: 500,
    marginTop: 8,
  },
  starterChip: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(80,69,59,0.4)',
    background: 'rgba(80,69,59,0.15)',
    color: '#d4c4b7',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    textAlign: 'left' as const,
  },
  // Message bubbles
  msgRow: (role: string) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: role === 'user' ? 'flex-end' as const : 'flex-start' as const,
    gap: 4,
    maxWidth: role === 'system' ? '100%' : '85%',
    alignSelf: role === 'user' ? 'flex-end' as const : role === 'system' ? 'center' as const : 'flex-start' as const,
  }),
  msgLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9c8e82',
    letterSpacing: '0.1em',
    marginBottom: 2,
  },
  msgBubble: (role: string) => ({
    padding: role === 'system' ? '8px 16px' : '12px 18px',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : role === 'system' ? '10px' : '16px 16px 16px 4px',
    background: role === 'user'
      ? 'rgba(212,165,116,0.15)'
      : role === 'system'
        ? 'rgba(80,69,59,0.1)'
        : 'rgba(80,69,59,0.2)',
    border: role === 'user'
      ? '1px solid rgba(212,165,116,0.25)'
      : role === 'system'
        ? '1px solid rgba(80,69,59,0.2)'
        : '1px solid rgba(80,69,59,0.3)',
    color: role === 'system' ? '#9c8e82' : '#e8e1dc',
    fontSize: role === 'system' ? 13 : 14,
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap' as const,
    fontStyle: role === 'system' ? 'italic' as const : 'normal' as const,
  }),
  loadingDots: {
    display: 'flex',
    gap: 4,
    padding: '12px 18px',
    borderRadius: '16px 16px 16px 4px',
    background: 'rgba(80,69,59,0.2)',
    border: '1px solid rgba(80,69,59,0.3)',
  },
  // Input bar
  inputBar: {
    borderTop: '1px solid rgba(80,69,59,0.3)',
    padding: '14px 20px',
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end' as const,
    background: 'rgba(22,19,16,0.5)',
  },
  input: {
    flex: 1,
    background: 'rgba(80,69,59,0.1)',
    border: '1px solid rgba(80,69,59,0.3)',
    borderRadius: 14,
    color: '#e8e1dc',
    fontSize: 14,
    padding: '12px 16px',
    outline: 'none',
    resize: 'none' as const,
    fontFamily: 'Manrope, system-ui, sans-serif',
    lineHeight: 1.5,
    maxHeight: 120,
    transition: 'border-color 0.2s',
  },
  sendBtn: (active: boolean) => ({
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: 'none',
    background: active ? 'linear-gradient(135deg, #f2c08d, #d4a574)' : 'rgba(80,69,59,0.3)',
    color: active ? '#472a03' : '#9c8e82',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    cursor: active ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
    flexShrink: 0,
  }),
};

const PHASE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  describe: { label: '💡 Ý tưởng', color: '#f2c08d', bg: 'rgba(242,192,141,0.1)' },
  discuss: { label: '🧠 Thảo luận', color: '#63b3ed', bg: 'rgba(99,179,237,0.1)' },
  review_plot: { label: '📝 Review plot', color: '#7dd3fc', bg: 'rgba(125,211,252,0.1)' },
  framework: { label: '🏗️ Khung lớn', color: '#f6ad55', bg: 'rgba(246,173,85,0.1)' },
  compose: { label: '✍️ Sáng tác', color: '#68d391', bg: 'rgba(104,211,145,0.1)' },
};

// ─── Component ──────────────────────────────────────────────

interface CreationChatPageProps {
  onComplete?: (projectId: string, preferredTab?: ProjectTabId) => void;
  onOpenProjectDraft?: (projectId: string, preferredTab?: ProjectTabId) => void;
}

export default function CreationChatPage({
  onComplete,
  onOpenProjectDraft,
}: CreationChatPageProps = {}) {
  const {
    phase, messages, isAiWorking, error,
    plotPreview, plotPreviewConfirmed,
    framework, frameworkConfirmed,
    acceptedChapters, draftInput, draftSavedAt, progress,
    setPlotPreview,
    setFramework,
    setDraftInput,
    linkProject,
    finishWorkflowStep,
  } = useCreationChatStore();

  const projectActions = useProjectStore((state) => ({
    createProject: state.createProject,
    updateProject: state.updateProject,
    replaceProjectChapters: state.replaceProjectChapters,
  }));

  const [showChapterPanel, setShowChapterPanel] = useState(false);
  const linkedProjectId = progress.linkedProjectId;
  const statusSummary = useMemo(() => describeCreationProgress(progress), [progress]);

  // ── Transition handler: migrate creation data → Project → Editor ──
  const handleTransitionToEditor = useCallback(async () => {
    const seed = buildCreationProjectSeed({
      framework,
      acceptedChapters,
      createId,
    });

    const projectId = linkedProjectId || projectActions.createProject(seed.projectPatch.title);

    // [Domain:CreationChat] STEP 1 — Sync framework + metadata into the linked project
    projectActions.updateProject(projectId, seed.projectPatch);

    // [Domain:CreationChat] STEP 2 — Sync chapter shells/accepted chapters without clobbering persisted drafts
    if (!linkedProjectId && seed.chapters.length > 0) {
      await projectActions.replaceProjectChapters(projectId, seed.chapters, { storageMode: 'indexeddb' });
    } else if (linkedProjectId && seed.chapters.length > 0) {
      const snapshot = await getProjectSnapshot(projectId);
      const existingBySequence = new Map(
        (snapshot?.chapters || []).map((chapter) => [chapter.sequenceNumber ?? 0, chapter] as const),
      );

      const mergedChapters = seed.chapters.map((seedChapter) => {
        const existing = existingBySequence.get(seedChapter.sequenceNumber ?? 0);
        if (!existing) return seedChapter;

        return {
          ...existing,
          title: seedChapter.content.trim() ? seedChapter.title : existing.title || seedChapter.title,
          summary: existing.summary || seedChapter.summary,
          content: seedChapter.content.trim() ? seedChapter.content : existing.content,
          updatedAt: existing.updatedAt,
        };
      });

      const additionalExisting = (snapshot?.chapters || []).filter(
        (chapter) => !mergedChapters.some((item) => item.sequenceNumber === chapter.sequenceNumber),
      );

      await projectActions.replaceProjectChapters(
        projectId,
        [...mergedChapters, ...additionalExisting],
        { storageMode: 'indexeddb' },
      );
    }

    // [Domain:CreationChat] STEP 3 — Keep session for resume and mark handoff success
    linkProject(projectId);
    finishWorkflowStep('handoff', 'Đã đồng bộ bản thảo sang editor, có thể quay lại chat để rà lại khung truyện.', {
      linkedProjectId: projectId,
    });
    onComplete?.(projectId, 'writer');
  }, [
    acceptedChapters,
    finishWorkflowStep,
    framework,
    linkProject,
    linkedProjectId,
    onComplete,
    projectActions,
  ]);

  const handleConfirmAndOpenWriter = useCallback(async () => {
    const result = await handleFrameworkConfirm();
    if (!result?.projectId) return;
    onComplete?.(result.projectId, 'writer');
  }, [onComplete]);

  const handleRetryCurrentStep = useCallback(() => {
    useCreationChatStore.getState().setError(null);

    if (phase === 'describe') {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMsg) void handleDescribeSubmit(lastUserMsg.content);
      return;
    }

    if (phase === 'discuss') {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMsg) void handleDiscussAnswer(lastUserMsg.content);
      return;
    }

    if (phase === 'review_plot' || progress.step === 'review_plot') {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMsg && plotPreview) {
        void handlePlotPreviewFeedback(lastUserMsg.content);
      }
      return;
    }

    if (phase === 'framework' || progress.step === 'framework') {
      void retryFrameworkGeneration();
      return;
    }

    if (phase === 'compose' || progress.step === 'compose') {
      const latestComposeNote = [...messages]
        .reverse()
        .find((message) => message.role === 'user' && message.type === 'text');
      void handleWriteChapter(latestComposeNote?.content);
    }
  }, [messages, phase, plotPreview, progress.step]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send handler ────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = draftInput.trim();
    if (!text || isAiWorking) return;
    setDraftInput('');

    if (phase === 'describe') {
      await handleDescribeSubmit(text);
    } else if (phase === 'discuss') {
      await handleDiscussAnswer(text);
    } else if (phase === 'review_plot') {
      await handlePlotPreviewFeedback(text);
    } else if (phase === 'compose') {
      await handleWriteChapter(text);
    }
  }, [draftInput, isAiWorking, phase, setDraftInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent instanceof KeyboardEvent && e.nativeEvent.isComposing) return;
      e.preventDefault();
      handleSend();
    }
  };

  // ── Starter chip click ──────────────────────────────────

  const handleStarterClick = (text: string) => {
    setDraftInput(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Phase badge ─────────────────────────────────────────

  const phaseInfo = PHASE_LABELS[phase];

  // ── Empty state (Phase 1) ───────────────────────────────

  const isEmpty = messages.length === 0;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <Sparkles size={16} color="#f2c08d" />
          Sáng tác mới
        </div>
        <div style={S.headerActions}>
          <span style={{
            ...S.phaseBadge,
            color: phaseInfo.color,
            background: phaseInfo.bg,
            border: `1px solid ${phaseInfo.color}30`,
          }}>
            {phaseInfo.label}
          </span>
          {linkedProjectId && onOpenProjectDraft && (
            <button
              style={S.headerBtn(true)}
              onClick={() => onOpenProjectDraft(linkedProjectId, 'writer')}
              title="Mở lại bản thảo hiện tại"
            >
              <FileClock size={14} />
              Bản thảo hiện tại
            </button>
          )}
          <button
            style={{
              ...S.headerBtn(showChapterPanel),
              color: showChapterPanel ? '#f2c08d' : '#9c8e82',
            }}
            onClick={() => setShowChapterPanel((v) => !v)}
            title="Mở danh sách chương"
          >
            <BookOpen size={14} />
            {acceptedChapters.length > 0 && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 9999,
                background: 'rgba(212,165,116,0.2)',
                color: '#f2c08d',
              }}>
                {acceptedChapters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={S.statusPanel}>
        <div style={S.statusMeta}>
          <div style={S.statusHeadline}>{statusSummary.headline}</div>
          <div style={S.statusDetail}>{statusSummary.detail}</div>
          <div style={S.statusCaption}>
            <span>{statusSummary.badge}</span>
            <span>Nháp lưu: {draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'chưa có'}</span>
            <span>{acceptedChapters.length} chương để duyệt</span>
            {progress.lastGeneratedChapterTitle && <span>Nháp mới nhất: {progress.lastGeneratedChapterTitle}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {linkedProjectId && onOpenProjectDraft && (
            <button
              style={S.headerBtn(true)}
              onClick={() => onOpenProjectDraft(linkedProjectId, 'writer')}
            >
              <FileClock size={14} />
              Về editor
            </button>
          )}
          <button
            style={S.headerBtn()}
            onClick={() => setShowChapterPanel(true)}
          >
            <MessageSquareQuote size={14} />
            Duyệt nháp
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div style={S.chatArea}>
        {isEmpty ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
            <h2 style={S.emptyTitle}>Bắt đầu câu chuyện của bạn</h2>
            <p style={S.emptySubtitle}>
              Mô tả ý tưởng truyện — dài ngắn đều được.<br />
              AI sẽ giúp bạn phát triển thành tác phẩm hoàn chỉnh.
            </p>
            <div style={{ ...S.emptySubtitle, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginTop: 8 }}>
              💡 Thử nhanh:
            </div>
            <div style={S.starterChips}>
              {STARTER_IDEAS.map((idea) => (
                <button
                  key={idea.id}
                  style={S.starterChip}
                  onClick={() => handleStarterClick(idea.value || idea.label)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.3)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,165,116,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.15)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(80,69,59,0.4)';
                  }}
                >
                  {idea.emoji} {idea.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            // ── Loading dots ──
            if (msg.type === 'loading') {
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <AiThinkingIndicator
                    context={phase === 'compose' ? 'creation' : phase === 'describe' ? 'generic' : 'creation'}
                  />
                </div>
              );
            }

            // ── Plot review preview ──
            if (msg.type === 'plot_preview' && msg.plotPreviewData) {
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <div style={{ fontSize: 14, color: '#d4c4b7', marginBottom: 8 }}>{msg.content}</div>
                  <PlotPreviewCard
                    data={plotPreview || msg.plotPreviewData}
                    confirmed={plotPreviewConfirmed}
                    disabled={isAiWorking}
                    onChange={(next) => setPlotPreview(next)}
                    onConfirm={() => void handlePlotPreviewConfirm()}
                  />
                </div>
              );
            }

            // ── Framework preview ──
            if (msg.type === 'framework_preview' && msg.frameworkData) {
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <div style={{ fontSize: 14, color: '#d4c4b7', marginBottom: 8 }}>{msg.content}</div>
                  <FrameworkPreview
                    data={framework || msg.frameworkData}
                    confirmed={frameworkConfirmed}
                    onConfirm={handleConfirmAndOpenWriter}
                    onChange={setFramework}
                  />
                </div>
              );
            }

            // ── Chapter draft ──
            if (msg.type === 'chapter_draft' && msg.chapterDraft) {
              const draft = msg.chapterDraft;
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <ChapterDraftCard
                    chapterIndex={draft.chapterIndex}
                    title={draft.title}
                    content={draft.content}
                    charCount={draft.charCount}
                    disabled={isAiWorking}
                    onAccept={() => handleAcceptChapter(draft.chapterIndex, draft.title, draft.content)}
                    onRewrite={() => handleWriteChapter('Viết lại chương này với hướng khác')}
                    onEdit={(newContent) => handleAcceptChapter(draft.chapterIndex, draft.title, newContent)}
                  />
                </div>
              );
            }

            // ── Suggestions (AI question + chips) ──
            if (msg.type === 'suggestions' && msg.suggestions) {
              const isLatest = msg.id === messages[messages.length - 1]?.id;
              return (
                <div key={msg.id} style={S.msgRow('ai')}>
                  <div style={S.msgLabel}>🤖 AI</div>
                  <div style={S.msgBubble('ai')}>
                    {msg.content}
                    <SuggestionChips
                      groups={msg.suggestions}
                      aiDecideLabel={msg.aiDecideLabel}
                      disabled={!isLatest || isAiWorking}
                      onChipSelect={(val) => {
                        if (phase === 'discuss') handleDiscussAnswer(val);
                        else if (phase === 'compose') handleWriteChapter(val);
                      }}
                      onAiDecide={phase === 'discuss' ? handleAiDecide : undefined}
                      onSmartSkip={phase === 'discuss' ? handleSmartSkip : undefined}
                    />
                  </div>
                </div>
              );
            }

            // ── System / Phase Transition ──
            if (msg.role === 'system') {
              return (
                <div key={msg.id} style={S.msgRow('system')}>
                  <div style={S.msgBubble('system')}>{msg.content}</div>
                </div>
              );
            }

            // ── Normal text (user or ai) ──
            return (
              <div key={msg.id} style={S.msgRow(msg.role)}>
                <div style={S.msgLabel}>
                  {msg.role === 'user' ? '✍️ BẠN' : '🤖 AI'}
                </div>
                <div style={S.msgBubble(msg.role)}>{msg.content}</div>
              </div>
            );
          })
        )}

        {/* Error — Debug Panel */}
        {error && (
          <AiConnectionDebugPanel
            error={error}
            onDismiss={() => useCreationChatStore.getState().setError(null)}
            onRetry={handleRetryCurrentStep}
          />
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Bar */}
      <div style={S.inputBar}>
        <textarea
          ref={inputRef}
          style={S.input}
          value={draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(212,165,116,0.5)'; }}
          onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(80,69,59,0.3)'; }}
          placeholder={
            phase === 'describe'
              ? 'Mô tả ý tưởng truyện của bạn...'
              : phase === 'discuss'
                ? 'Trả lời hoặc gõ ý riêng...'
                : phase === 'review_plot'
                  ? 'Góp ý để chỉnh cốt truyện trước khi AI dựng khung đầy đủ...'
                : phase === 'compose'
                  ? 'Ghi chú cho chương tiếp theo...'
                  : 'Nhập tin nhắn...'
          }
          rows={1}
          disabled={isAiWorking}
        />
        <button
          style={S.sendBtn(draftInput.trim().length > 0 && !isAiWorking)}
          onClick={handleSend}
          disabled={!draftInput.trim() || isAiWorking}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Keyframe animations moved to index.css */}

      {/* Chapter Sidebar Panel */}
      <ChapterSidebarPanel
        isOpen={showChapterPanel}
        onClose={() => setShowChapterPanel(false)}
        onTransitionToEditor={handleTransitionToEditor}
        canTransitionToEditor={Boolean(linkedProjectId)}
      />
    </div>
  );
}
