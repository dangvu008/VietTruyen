/**
 * File: NotificationCenter.tsx
 * Purpose: Drawer panel listing full notification history with read/unread filtering
 * Layer: UI / Shared
 * Domain: App → [notification history, reminders]
 */
import React, { useState, useCallback } from 'react';
import {
  Bell, CheckCircle2, AlertTriangle, XCircle, Info,
  X, CheckCheck, Trash2, BellOff,
} from 'lucide-react';
import { useNotificationStore, getUnreadCount } from '../../store/use_notification_store';
import type { NotifType, Notification } from '../../store/use_notification_store';

// ── Type icons & colors ───────────────────────────────────────────────────────
const TYPE_META: Record<NotifType, { icon: React.ReactNode; color: string }> = {
  success:  { icon: <CheckCircle2 size={14} />, color: 'text-accent-teal' },
  error:    { icon: <XCircle size={14} />,       color: 'text-accent-rose' },
  warning:  { icon: <AlertTriangle size={14} />, color: 'text-accent-amber' },
  info:     { icon: <Info size={14} />,          color: 'text-blue-400' },
  reminder: { icon: <Bell size={14} />,          color: 'text-accent-amber' },
};

// ── Time helper ───────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Vừa xong';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
type FilterTab = 'all' | 'unread' | 'reminder';
const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'Tất cả' },
  { id: 'unread',   label: 'Chưa đọc' },
  { id: 'reminder', label: 'Nhắc nhở' },
];

// ── Single item ───────────────────────────────────────────────────────────────
interface ItemProps {
  notif: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}
const NotifItem: React.FC<ItemProps> = ({ notif, onMarkRead, onDismiss }) => {
  const meta = TYPE_META[notif.type];
  return (
    <div
      onClick={() => onMarkRead(notif.id)}
      className={`
        group relative flex gap-3 px-4 py-3 cursor-pointer
        transition-colors duration-150
        ${notif.read ? 'opacity-60' : 'bg-bg-elevated/50'}
        hover:bg-bg-elevated
      `}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span className="absolute left-1.5 top-[18px] w-1.5 h-1.5 rounded-full bg-accent-amber" />
      )}

      {/* Icon */}
      <span className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary leading-snug">{notif.title}</p>
        {notif.message && (
          <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{notif.message}</p>
        )}
        {notif.action && (
          <button
            onClick={(e) => { e.stopPropagation(); notif.action!.onClick(); }}
            className={`mt-1 text-xs font-semibold underline underline-offset-2 ${meta.color} hover:opacity-80 transition-opacity`}
          >
            {notif.action.label} →
          </button>
        )}
        <p className="mt-1 text-[10px] text-text-muted">{relativeTime(notif.createdAt)}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-all p-0.5 rounded"
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────
interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<FilterTab>('all');

  const notifications = useNotificationStore((s) => s.notifications);
  const markRead      = useNotificationStore((s) => s.markRead);
  const markAllRead   = useNotificationStore((s) => s.markAllRead);
  const dismiss       = useNotificationStore((s) => s.dismiss);
  const clearAll      = useNotificationStore((s) => s.clearAll);
  const unreadCount   = useNotificationStore(getUnreadCount);

  const filtered = notifications.filter((n) => {
    if (tab === 'unread')   return !n.read;
    if (tab === 'reminder') return n.type === 'reminder';
    return true;
  });

  const handleMarkRead = useCallback((id: string) => markRead(id), [markRead]);
  const handleDismiss  = useCallback((id: string) => dismiss(id),   [dismiss]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 h-full z-[9999] w-80
          bg-bg-surface border-l border-border-subtle
          flex flex-col shadow-2xl shadow-black/40
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-accent-amber" />
            <span className="font-semibold text-text-primary text-sm">Thông báo</span>
            {unreadCount > 0 && (
              <span className="badge-amber text-[10px] px-1.5 py-0.5">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                title="Đánh dấu tất cả đã đọc"
                className="p-1.5 rounded-lg text-text-muted hover:text-accent-teal hover:bg-accent-teal/10 transition-colors"
              >
                <CheckCheck size={14} />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                title="Xóa tất cả"
                className="p-1.5 rounded-lg text-text-muted hover:text-accent-rose hover:bg-accent-rose/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex pb-4 mb-4 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex-1 px-2 py-2.5 text-xs font-medium transition-colors
                ${tab === t.id
                  ? 'text-accent-amber border-b-2 border-accent-amber bg-accent-amber/5'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'}
              `}
            >
              {t.label}
              {t.id === 'unread' && unreadCount > 0 && (
                <span className="ml-1 badge-amber text-[9px] px-1">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-4/50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-6">
              <BellOff size={32} className="text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">
                {tab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
              </p>
            </div>
          ) : (
            filtered.map((n) => (
              <NotifItem
                key={n.id}
                notif={n}
                onMarkRead={handleMarkRead}
                onDismiss={handleDismiss}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationCenter;
