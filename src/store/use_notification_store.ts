/**
 * File: use_notification_store.ts
 * Purpose: Global notification & reminder state management
 * Layer: Store
 * Domain: App → [notifications, toasts, reminders]
 */
import { create } from 'zustand';
import { createId } from '../core/id';

export type NotifType = 'success' | 'error' | 'warning' | 'info' | 'reminder';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  /** ms until auto-dismiss. 0 = manual only. Default 4000 */
  duration?: number;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  // Track reminder IDs already shown this session (prevent duplicates)
  shownReminderIds: Set<string>;

  push: (notif: Omit<Notification, 'id' | 'read' | 'createdAt'>) => string;
  dismiss: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  hasShownReminder: (reminderId: string) => boolean;
  trackReminder: (reminderId: string) => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  shownReminderIds: new Set(),

  push: (notif) => {
    const id = createId();
    set((state) => ({
      notifications: [
        {
          ...notif,
          id,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...state.notifications,
      ].slice(0, 50), // Cap at 50 in history
    }));
    return id;
  },

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearAll: () => set({ notifications: [] }),

  hasShownReminder: (reminderId) => get().shownReminderIds.has(reminderId),

  trackReminder: (reminderId) =>
    set((state) => ({
      shownReminderIds: new Set([...state.shownReminderIds, reminderId]),
    })),
}));

export const getUnreadCount = (state: NotificationState) =>
  state.notifications.filter((n) => !n.read).length;
