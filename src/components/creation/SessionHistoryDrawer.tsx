/**
 * File: SessionHistoryDrawer.tsx
 * Purpose: Slide-over panel showing archived creation chat sessions
 * Layer: UI (Creation Component)
 * Domain: SessionArchive → [session history list, restore, delete]
 */
import { useEffect, useState, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Trash2,
  MessageSquare,
  BookOpen,
  Clock,
} from 'lucide-react';
import {
  getAllArchivedSessions,
  deleteArchivedSession,
  type ArchivedCreationSession,
} from '../../db/session_archive_db';

interface SessionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (sessionId: string) => void;
  /** If set, filter sessions to this project only */
  filterProjectId?: string | null;
}

const PHASE_LABELS: Record<string, { label: string; emoji: string }> = {
  describe: { label: 'Y tuong', emoji: '💡' },
  discuss: { label: 'Thao luan', emoji: '🧠' },
  review_plot: { label: 'Review plot', emoji: '📝' },
  framework: { label: 'Khung truyen', emoji: '🏗️' },
  compose: { label: 'Sang tac', emoji: '✍️' },
};

const REASON_LABELS: Record<string, string> = {
  switch_project: 'Chuyển dự án',
  new_session: 'Phiên mới',
  manual: 'Lưu thủ công',
  auto_backup: 'Tự động',
};

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SessionCard({
  session,
  onRestore,
  onDelete,
}: {
  session: ArchivedCreationSession;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const phase = PHASE_LABELS[session.phase] ?? { label: session.phase, emoji: '📄' };
  const reason = REASON_LABELS[session.archiveReason] ?? session.archiveReason;
  const summaryText = session.summary.length > 120
    ? session.summary.slice(0, 120) + '...'
    : session.summary;

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        border: '1px solid rgba(80,69,59,0.3)',
        background: 'rgba(80,69,59,0.08)',
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(212,165,116,0.12)',
              color: '#f2c08d',
              letterSpacing: '0.05em',
            }}
          >
            {phase.emoji} {phase.label}
          </span>
          <span
            style={{
              fontSize: 10,
              color: '#8f7f73',
              fontWeight: 600,
            }}
          >
            {reason}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: '#8f7f73',
          }}
        >
          <Clock size={10} />
          {formatDate(session.archivedAt)}
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          fontSize: 13,
          color: '#cbb8aa',
          lineHeight: 1.5,
          marginBottom: 10,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}
      >
        {summaryText}
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 11,
          color: '#8f7f73',
          marginBottom: 10,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MessageSquare size={11} />
          {session.messageCount} tin nhắn
        </span>
        {session.chapterCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={11} />
            {session.chapterCount} chương
          </span>
        )}
        {session.lastCompletedStep && (
          <span>
            Bước cuối: {PHASE_LABELS[session.lastCompletedStep]?.label ?? session.lastCompletedStep}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onRestore}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(212,165,116,0.3)',
            background: 'rgba(212,165,116,0.1)',
            color: '#f2c08d',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'Manrope, system-ui, sans-serif',
            transition: 'all 0.2s',
          }}
        >
          <RotateCcw size={13} />
          Khôi phục phiên này
        </button>
        {confirmDelete ? (
          <button
            onClick={onDelete}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(248,113,113,0.4)',
              background: 'rgba(248,113,113,0.12)',
              color: '#f87171',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Manrope, system-ui, sans-serif',
            }}
          >
            Xác nhận xóa
          </button>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(80,69,59,0.3)',
              background: 'transparent',
              color: '#8f7f73',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Xóa phiên này"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SessionHistoryDrawer({
  isOpen,
  onClose,
  onRestore,
  filterProjectId,
}: SessionHistoryDrawerProps) {
  const [sessions, setSessions] = useState<ArchivedCreationSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllArchivedSessions();
      const filtered = filterProjectId
        ? all.filter((s) => s.projectId === filterProjectId)
        : all;
      setSessions(filtered);
    } catch (err) {
      console.warn('[SessionHistoryDrawer] Failed to load sessions:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [filterProjectId]);

  useEffect(() => {
    if (isOpen) void loadSessions();
  }, [isOpen, loadSessions]);

  const handleDelete = useCallback(
    async (sessionId: string) => {
      await deleteArchivedSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    },
    [],
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998,
          transition: 'opacity 0.2s',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 420,
          maxWidth: '90vw',
          height: '100vh',
          background: '#151210',
          borderLeft: '1px solid rgba(80,69,59,0.35)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          animation: 'slideInRight 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(80,69,59,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 15,
              fontWeight: 700,
              color: '#e8e1dc',
            }}
          >
            <Clock size={16} style={{ color: '#f2c08d' }} />
            Lịch sử phiên thảo luận
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(80,69,59,0.3)',
              background: 'transparent',
              color: '#8f7f73',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
                color: '#8f7f73',
                fontSize: 13,
              }}
            >
              Đang tải...
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                gap: 12,
              }}
            >
              <Clock size={32} style={{ color: '#50453b', opacity: 0.5 }} />
              <div style={{ fontSize: 14, color: '#8f7f73', fontWeight: 600 }}>
                Chưa có phiên nào được lưu
              </div>
              <div style={{ fontSize: 12, color: '#6f6259', lineHeight: 1.5 }}>
                Khi bạn chuyển dự án hoặc bắt đầu phiên mới,
                phiên cũ sẽ tự động được lưu trữ tại đây.
              </div>
            </div>
          )}

          {!loading &&
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRestore={() => onRestore(session.id)}
                onDelete={() => void handleDelete(session.id)}
              />
            ))}
        </div>

        {/* Footer hint */}
        {!loading && sessions.length > 0 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(80,69,59,0.2)',
              fontSize: 11,
              color: '#6f6259',
              textAlign: 'center',
            }}
          >
            Tối đa 20 phiên được lưu cho mỗi dự án. Phiên cũ nhất sẽ tự động bị xóa.
          </div>
        )}
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.8; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
