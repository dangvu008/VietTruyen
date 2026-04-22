/**
 * File: NotificationToast.tsx
 * Purpose: Floating toast stack — renders active notifications at bottom-right
 * Layer: UI / Shared
 * Domain: App → [notification display]
 */
import React, { useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Bell, X } from 'lucide-react';
import { useNotificationStore } from '../../store/use_notification_store';
import type { Notification, NotifType } from '../../store/use_notification_store';

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 4000;

const TYPE_STYLES: Record<NotifType, { icon: React.ReactNode; bar: string; bg: string; border: string; title: string }> = {
  success: {
    icon: <CheckCircle2 size={16} />,
    bar: 'bg-accent-teal',
    bg: 'bg-accent-teal/10',
    border: 'border-accent-teal/30',
    title: 'text-accent-teal',
  },
  error: {
    icon: <XCircle size={16} />,
    bar: 'bg-accent-rose',
    bg: 'bg-accent-rose/10',
    border: 'border-accent-rose/30',
    title: 'text-accent-rose',
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    bar: 'bg-accent-amber',
    bg: 'bg-accent-amber/10',
    border: 'border-accent-amber/30',
    title: 'text-accent-amber',
  },
  info: {
    icon: <Info size={16} />,
    bar: 'bg-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/30',
    title: 'text-blue-400',
  },
  reminder: {
    icon: <Bell size={16} />,
    bar: 'bg-accent-amber',
    bg: 'bg-accent-amber/10',
    border: 'border-accent-amber/30',
    title: 'text-accent-amber',
  },
};

// ── Single Toast ──────────────────────────────────────────────────────────────
interface ToastProps {
  notif: Notification;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ notif, onDismiss }) => {
  const style = TYPE_STYLES[notif.type];
  const duration = notif.duration ?? DEFAULT_DURATION;

  useEffect(() => {
    if (duration === 0) return;
    const timer = setTimeout(() => onDismiss(notif.id), duration);
    return () => clearTimeout(timer);
  }, [notif.id, duration, onDismiss]);

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border shadow-2xl shadow-black/40
        ${style.bg} ${style.border}
        w-80 pointer-events-auto
        animate-in slide-in-from-right-full fade-in duration-300
      `}
    >
      {/* Progress bar */}
      {duration > 0 && (
        <div
          className={`absolute top-0 left-0 h-0.5 ${style.bar} opacity-60`}
          style={{
            animation: `shrink-x ${duration}ms linear forwards`,
          }}
        />
      )}

      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <span className={`mt-0.5 shrink-0 ${style.title}`}>{style.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${style.title}`}>{notif.title}</p>
          {notif.message && (
            <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{notif.message}</p>
          )}
          {notif.action && (
            <button
              onClick={() => {
                notif.action!.onClick();
                onDismiss(notif.id);
              }}
              className={`mt-2 text-xs font-semibold underline underline-offset-2 ${style.title} hover:opacity-80 transition-opacity`}
            >
              {notif.action.label}
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={() => onDismiss(notif.id)}
          className="shrink-0 text-text-muted hover:text-text-primary transition-colors p-0.5 rounded"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

// ── Toast Stack ───────────────────────────────────────────────────────────────
const NotificationToast: React.FC = () => {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  const handleDismiss = useCallback((id: string) => dismiss(id), [dismiss]);

  // Only show most recent MAX_VISIBLE items that are short-duration (not center-only)
  const visible = notifications
    .filter((n) => (n.duration ?? DEFAULT_DURATION) !== 0 || n.duration === undefined)
    .slice(0, MAX_VISIBLE);

  return (
    <>
      {/* Inject keyframe for progress bar */}
      <style>{`
        @keyframes shrink-x {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes slide-in-from-right-full {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        {visible.map((notif) => (
          <Toast key={notif.id} notif={notif} onDismiss={handleDismiss} />
        ))}
      </div>
    </>
  );
};

export default NotificationToast;
