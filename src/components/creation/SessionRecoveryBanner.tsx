/**
 * File: SessionRecoveryBanner.tsx
 * Purpose: Banner shown when a recoverable archived session exists for the current project
 * Layer: UI (Creation Component)
 * Domain: SessionArchive → [recovery prompt, resume from interrupted session]
 */
import { RotateCcw, X, Clock } from 'lucide-react';
import type { ArchivedCreationSession } from '../../db/session_archive_db';

interface SessionRecoveryBannerProps {
  session: ArchivedCreationSession;
  onRestore: (sessionId: string) => void;
  onDismiss: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  describe: 'Ý tưởng',
  discuss: 'Thảo luận',
  review_plot: 'Review cốt truyện',
  framework: 'Khung truyện',
  compose: 'Sáng tác',
};

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function SessionRecoveryBanner({
  session,
  onRestore,
  onDismiss,
}: SessionRecoveryBannerProps) {
  const phaseLabel = PHASE_LABELS[session.phase] ?? session.phase;
  const summaryText = session.summary.length > 80
    ? session.summary.slice(0, 80) + '...'
    : session.summary;

  return (
    <div
      style={{
        margin: '12px 20px 0',
        padding: '14px 16px',
        borderRadius: 14,
        border: '1px solid rgba(212,165,116,0.3)',
        background: 'linear-gradient(135deg, rgba(212,165,116,0.08) 0%, rgba(39,30,24,0.6) 100%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(212,165,116,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Clock size={18} style={{ color: '#f2c08d' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#f1e6da',
            marginBottom: 2,
          }}
        >
          Phiên trước bị gián đoạn
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#bca999',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {phaseLabel} · {session.messageCount} tin nhắn
          {session.chapterCount > 0 && ` · ${session.chapterCount} chương`}
          {' · '}
          {formatRelativeTime(session.archivedAt)}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#8f7f73',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summaryText}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onRestore(session.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 10,
            border: '1px solid rgba(212,165,116,0.35)',
            background: 'rgba(212,165,116,0.15)',
            color: '#f2c08d',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'Manrope, system-ui, sans-serif',
            transition: 'all 0.2s',
          }}
        >
          <RotateCcw size={13} />
          Tiếp tục
        </button>
        <button
          onClick={onDismiss}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: '1px solid rgba(80,69,59,0.3)',
            background: 'transparent',
            color: '#8f7f73',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Bỏ qua"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
