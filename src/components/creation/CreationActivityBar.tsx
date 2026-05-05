/**
 * File: CreationActivityBar.tsx
 * Purpose: Persistent AI activity indicator for the creation chat composer
 * Layer: UI (Creation Component)
 * Domain: CreationChat -> [workflow progress, batch compose visibility]
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, FileClock, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import type { CreationWorkflowProgress } from '../../types/creation_chat';

interface CreationActivityBarProps {
  progress: CreationWorkflowProgress;
  isAiWorking: boolean;
  isBatchComposing: boolean;
  canOpenLinkedDraft: boolean;
  onOpenLinkedDraft?: () => void;
  canResumeInChat?: boolean;
  onResumeInChat?: () => void;
}

const STEP_LABELS: Record<CreationWorkflowProgress['step'], string> = {
  describe: 'Ý tưởng',
  discuss: 'Thảo luận',
  review_plot: 'Review cốt truyện',
  framework: 'Khung truyện',
  outline: 'Tổng cương',
  compose: 'Viết chương',
  handoff: 'Đồng bộ bản thảo',
};

const S = {
  shell: {
    borderTop: '1px solid rgba(80,69,59,0.3)',
    background: 'rgba(18,15,13,0.96)',
    padding: '10px 20px 0',
  },
  bar: (tone: 'active' | 'success' | 'error' | 'interrupted') => ({
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 12,
    border:
      tone === 'error'
        ? '1px solid rgba(248,113,113,0.35)'
        : tone === 'active'
          ? '1px solid rgba(45,212,191,0.28)'
          : '1px solid rgba(80,69,59,0.35)',
    background:
      tone === 'error'
        ? 'rgba(127,29,29,0.16)'
        : tone === 'active'
          ? 'rgba(20,184,166,0.10)'
          : 'rgba(39,30,24,0.72)',
  }),
  main: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  iconWrap: (tone: 'active' | 'success' | 'error' | 'interrupted') => ({
    width: 30,
    height: 30,
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    color:
      tone === 'error'
        ? '#fca5a5'
        : tone === 'active'
          ? '#2dd4bf'
          : tone === 'success'
            ? '#86efac'
            : '#d4a574',
    background:
      tone === 'error'
        ? 'rgba(248,113,113,0.12)'
        : tone === 'active'
          ? 'rgba(45,212,191,0.12)'
          : 'rgba(212,165,116,0.12)',
  }),
  textCol: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
  },
  title: {
    color: '#f1e6da',
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  detail: {
    color: '#bca999',
    fontSize: 12,
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  progressArea: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
    flexShrink: 0,
  },
  progressTrack: {
    width: 150,
    height: 6,
    borderRadius: 9999,
    background: 'rgba(80,69,59,0.45)',
    overflow: 'hidden',
  },
  progressFill: (percent: number) => ({
    width: `${Math.max(2, Math.min(100, percent))}%`,
    height: '100%',
    borderRadius: 9999,
    background: 'linear-gradient(90deg, #2dd4bf, #f2c08d)',
    transition: 'width 0.35s ease-out',
  }),
  progressText: {
    minWidth: 68,
    color: '#f2c08d',
    fontSize: 12,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums' as const,
    textAlign: 'right' as const,
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: 7,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(212,165,116,0.28)',
    background: 'rgba(212,165,116,0.10)',
    color: '#f2c08d',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    flexShrink: 0,
  },
};

function getTone(progress: CreationWorkflowProgress, isWorking: boolean, isBatchComposing: boolean) {
  if (progress.status === 'error') return 'error';
  if (progress.status === 'interrupted') return 'interrupted';
  if (isWorking || isBatchComposing || progress.status === 'running') return 'active';
  return 'success';
}

function getTitle(progress: CreationWorkflowProgress, isWorking: boolean, isBatchComposing: boolean) {
  const stepLabel = STEP_LABELS[progress.step];
  if (isBatchComposing) return 'AI đang viết truyện theo từng chương';
  if (isWorking || progress.status === 'running') return `${stepLabel} đang được AI xử lý`;
  if (progress.status === 'error') return `Cần kiểm tra bước ${stepLabel}`;
  if (progress.status === 'interrupted') return `Phiên trước dừng ở bước ${stepLabel}`;
  return `Đã cập nhật bước ${stepLabel}`;
}

function getProgressPercent(progress: CreationWorkflowProgress) {
  const batch = progress.batchCompose;
  if (!batch || batch.total <= 0) return null;
  if (batch.isRunning) {
    return Math.round(((batch.successCount + batch.failCount) / batch.total) * 100);
  }
  return Math.round(((batch.successCount + batch.failCount) / batch.total) * 100);
}

function ActivityIcon({ tone }: { tone: ReturnType<typeof getTone> }) {
  if (tone === 'active') return <Loader2 size={16} className="animate-spin" />;
  if (tone === 'error') return <AlertTriangle size={16} />;
  if (tone === 'interrupted') return <PauseCircle size={16} />;
  return <CheckCircle2 size={16} />;
}

export default function CreationActivityBar({
  progress,
  isAiWorking,
  isBatchComposing,
  canOpenLinkedDraft,
  onOpenLinkedDraft,
  canResumeInChat = false,
  onResumeInChat,
}: CreationActivityBarProps) {
  const shouldShow =
    isBatchComposing ||
    (progress.status === 'running' && !isAiWorking) ||
    progress.status === 'error' ||
    progress.status === 'interrupted' ||
    Boolean(progress.batchCompose && progress.batchCompose.total > 0);

  if (!shouldShow) return null;

  const tone = getTone(progress, isAiWorking, isBatchComposing);
  const percent = getProgressPercent(progress);
  const batch = progress.batchCompose;

  return (
    <div style={S.shell} role="status" aria-live="polite">
      <div style={S.bar(tone)}>
        <div style={S.main}>
          <span style={S.iconWrap(tone)}>
            <ActivityIcon tone={tone} />
          </span>
          <div style={S.textCol}>
            <div style={S.title}>{getTitle(progress, isAiWorking, isBatchComposing)}</div>
            <div style={S.detail}>{progress.detail}</div>
          </div>
        </div>

        {batch && batch.total > 0 && percent !== null && (
          <div style={S.progressArea} aria-label={`Tiến trình viết chương ${percent}%`}>
            <div style={S.progressTrack}>
              <div style={S.progressFill(percent)} />
            </div>
            <div style={S.progressText}>
              {batch.successCount + batch.failCount}/{batch.total}
            </div>
          </div>
        )}

        {canResumeInChat && onResumeInChat && (
          <button type="button" style={S.actionButton} onClick={onResumeInChat}>
            <PlayCircle size={14} />
            Viết tiếp tại đây
          </button>
        )}

        {canOpenLinkedDraft && onOpenLinkedDraft && (
          <button type="button" style={S.actionButton} onClick={onOpenLinkedDraft}>
            <FileClock size={14} />
            Về editor
          </button>
        )}
      </div>
    </div>
  );
}
