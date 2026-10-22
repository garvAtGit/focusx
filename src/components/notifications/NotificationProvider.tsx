'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getRealtimeAuthTokenAction,
} from '@/app/actions/notification-actions';
import {
  validateInternalActionUrl,
  getNotificationVisuals as getBaseVisuals,
  type PopupToast,
} from '@/lib/notification-shared';
import type { Notification } from '@prisma/client';
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ShieldAlert,
  X,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export type { PopupToast };

export interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  activePopups: PopupToast[];
  isSubscribed: boolean;
  isReconnecting: boolean;
  isSheetOpen: boolean;
  setIsSheetOpen: (open: boolean) => void;
  dismissPopup: (id: string) => void;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  refreshInbox: () => Promise<void>;
  openInbox: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function getNotificationVisuals(type?: string | null) {
  const base = getBaseVisuals(type);
  const Icon =
    base.iconName === 'CheckCircle2'
      ? CheckCircle2
      : base.iconName === 'AlertTriangle'
      ? AlertTriangle
      : base.iconName === 'Clock'
      ? Clock
      : base.iconName === 'ShieldAlert'
      ? ShieldAlert
      : base.iconName === 'BellRing'
      ? BellRing
      : Info;
  return { ...base, Icon };
}

interface NotificationProviderProps {
  userId: string;
  initialNotifications?: Notification[];
  initialUnreadCount?: number;
  children: ReactNode;
}

export function NotificationProvider({
  userId,
  initialNotifications = [],
  initialUnreadCount,
  children,
}: NotificationProviderProps) {
  const router = useRouter();

  // State
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(
    initialUnreadCount ?? initialNotifications.filter((n) => !n.isRead).length
  );
  const [activePopups, setActivePopups] = useState<PopupToast[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Set of notification IDs seen or already acknowledged on this client
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Multi-tab coordination broadcast channel
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // 1. Initialize seen IDs on mount to prevent replaying old unread popups
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialNotifications.forEach((n) => seenIdsRef.current.add(n.id));
      initialLoadDoneRef.current = true;
    }
  }, [initialNotifications]);

  // 2. Setup BroadcastChannel for cross-tab deduplication
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('focusdesk_notifications');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, id } = event.data || {};
        if (type === 'POPUP_DISMISSED' && id) {
          // Another tab dismissed this popup
          setActivePopups((prev) => prev.filter((p) => p.id !== id));
        } else if (type === 'POPUP_DISPLAYED' && id) {
          // Another tab displayed this popup, mark as seen
          seenIdsRef.current.add(id);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // 3. Authoritative Inbox Sync / Refetch
  const refreshInbox = useCallback(async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        getMyNotifications({ page: 1, limit: 20 }),
        getMyUnreadCount(),
      ]);

      if (notifsRes.success && notifsRes.data) {
        setNotifications(notifsRes.data.notifications);
        // Track fetched IDs so they don't produce popups
        notifsRes.data.notifications.forEach((n) => seenIdsRef.current.add(n.id));
      }

      if (countRes.success) {
        setUnreadCount(countRes.count);
      }
    } catch (err) {
      console.warn('[NotificationProvider] Inbox synchronization error:', err);
    }
  }, []);

  // 4. Manual / Programmatic Dismissal of Popup Toast
  // CRITICAL: Dismissing a toast removes the popup ONLY. Does NOT mark as read or delete from inbox!
  const dismissPopup = useCallback((id: string) => {
    setActivePopups((prev) => prev.filter((p) => p.id !== id));

    // Notify other tabs
    try {
      broadcastChannelRef.current?.postMessage({ type: 'POPUP_DISMISSED', id });
    } catch {
      // Ignore broadcast errors
    }
  }, []);

  // 5. Mark individual notification read
  const markAsRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await markNotificationRead(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NotificationProvider] Failed to mark notification read:', err);
      return false;
    }
  }, []);

  // 6. Mark all notifications read
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    try {
      const res = await markAllNotificationsRead();
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NotificationProvider] Failed to mark all notifications read:', err);
      return false;
    }
  }, []);

  const openInbox = useCallback(() => {
    setIsSheetOpen(true);
  }, []);

  // 7. Supabase Realtime Subscription Setup
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const topic = `user_notifications:${userId}`;

    async function initSubscription() {
      try {
        // Fetch private channel authorization token
        const tokenRes = await getRealtimeAuthTokenAction();
        if (tokenRes.success && tokenRes.token) {
          supabase.realtime.setAuth(tokenRes.token);
        }

        const channel = supabase.channel(topic, {
          config: {
            private: true,
            broadcast: { self: false },
          },
        });

        channel
          .on('broadcast', { event: 'new_notification' }, (eventPayload) => {
            if (!isMounted) return;

            const data = eventPayload.payload as PopupToast;
            if (!data || !data.id) return;

            // Deduplication Guard: Avoid duplicate popups from duplicate events or multi-mounts
            if (seenIdsRef.current.has(data.id)) {
              return;
            }
            seenIdsRef.current.add(data.id);

            // Notify sibling tabs that this notification popup was handled
            try {
              broadcastChannelRef.current?.postMessage({
                type: 'POPUP_DISPLAYED',
                id: data.id,
              });
            } catch {
              // Ignore cross-tab broadcast errors
            }

            // 1. Immediately update unread count
            setUnreadCount((prev) => prev + 1);

            // 2. Prepend to authoritative local inbox list
            const newNotifRecord: Notification = {
              id: data.id,
              studentId: userId,
              userId: userId,
              broadcastId: null,
              eventId: data.eventId || null,
              title: data.title,
              message: data.message,
              type: data.type || 'INFO',
              actionLabel: data.actionLabel || null,
              actionUrl: data.actionUrl || null,
              isRead: false,
              readAt: null,
              createdAt: new Date(data.createdAt || Date.now()),
            };

            setNotifications((prev) => {
              // Deduplicate in array
              if (prev.some((n) => n.id === data.id)) return prev;
              return [newNotifRecord, ...prev];
            });

            // 3. Queue top-right popup toast (Maximum 3 visible)
            setActivePopups((prev) => {
              const nextQueue = [...prev, data];
              // Keep maximum 3 popups visible
              return nextQueue.slice(-3);
            });

            // 4. Subtle device vibration if supported
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate([100, 50, 100]);
              } catch {
                // Vibration not permitted
              }
            }
          })
          .subscribe((status) => {
            if (!isMounted) return;

            if (status === 'SUBSCRIBED') {
              setIsSubscribed(true);
              setIsReconnecting(false);
            } else if (
              status === 'CHANNEL_ERROR' ||
              status === 'TIMED_OUT' ||
              status === 'CLOSED'
            ) {
              setIsSubscribed(false);
              setIsReconnecting(true);
            }
          });

        return () => {
          isMounted = false;
          channel.unsubscribe();
          supabase.removeChannel(channel);
        };
      } catch (err) {
        console.warn('[NotificationProvider] Realtime subscription init error:', err);
      }
    }

    const cleanupPromise = initSubscription();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, [userId]);

  // 8. Auto-reconnect & Visibility Resynchronization
  // When user returns to tab after backgrounding or restores internet, sync authoritative inbox
  useEffect(() => {
    function handleVisibilityOrOnline() {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        refreshInbox();
      }
    }

    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
    };
  }, [refreshInbox]);

  // 9. Coordinate with Service Worker Web Push Events
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'FOCUSDESK_PUSH_RECEIVED') {
          const payload = event.data.payload;
          // Sync authoritative inbox when a push event is processed by service worker
          refreshInbox();

          // If foreground push and payload has notification details not yet shown as a toast
          if (payload && payload.isForeground && payload.title) {
            const popupId = payload.tag || payload.id || `push_${Date.now()}`;
            if (!seenIdsRef.current.has(popupId)) {
              seenIdsRef.current.add(popupId);
              setActivePopups((prev) => {
                const nextQueue = [
                  ...prev,
                  {
                    id: popupId,
                    title: payload.title,
                    message: payload.body || '',
                    type: payload.type || 'INFO',
                    actionLabel: payload.actionLabel || 'View',
                    actionUrl: payload.url || '/dashboard',
                    createdAt: new Date().toISOString(),
                    autoDismissMs: 6000,
                  },
                ];
                return nextQueue.slice(-3);
              });
            }
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [refreshInbox]);

  const contextValue: NotificationContextValue = {
    notifications,
    unreadCount,
    activePopups,
    isSubscribed,
    isReconnecting,
    isSheetOpen,
    setIsSheetOpen,
    dismissPopup,
    markAsRead,
    markAllAsRead,
    refreshInbox,
    openInbox,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {/* Top-Right Fixed Toast Container */}
      <NotificationToastContainer
        popups={activePopups}
        onDismiss={dismissPopup}
        onOpenInbox={openInbox}
      />
    </NotificationContext.Provider>
  );
}

/**
 * Top-Right Notification Toast Container
 * Fixed position top-right, maximum 3 visible popups, ~6s auto-dismiss with hover pause,
 * responsive mobile layout, accessible ARIA live region.
 */
interface ToastContainerProps {
  popups: PopupToast[];
  onDismiss: (id: string) => void;
  onOpenInbox: () => void;
}

export function NotificationToastContainer({
  popups,
  onDismiss,
  onOpenInbox,
}: ToastContainerProps) {
  if (popups.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Realtime notifications"
      aria-live="polite"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] pointer-events-none select-none"
    >
      {popups.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onOpenInbox={onOpenInbox}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: PopupToast;
  onDismiss: (id: string) => void;
  onOpenInbox: () => void;
}

function ToastItem({ toast, onDismiss, onOpenInbox }: ToastItemProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const visuals = getNotificationVisuals(toast.type);
  const Icon = visuals.Icon;

  // Auto-dismiss timer: defaults to 6000ms (~6 seconds)
  // Pauses while hovered so user has plenty of time to read
  useEffect(() => {
    if (isHovered) return;

    const duration = toast.autoDismissMs || 6000;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.autoDismissMs, isHovered, onDismiss]);

  const handleCardClick = (e: React.MouseEvent) => {
    // If the click is on the dismiss button, do not navigate
    if ((e.target as HTMLElement).closest('button[data-dismiss]')) {
      return;
    }

    const validatedUrl = validateInternalActionUrl(toast.actionUrl);
    if (validatedUrl) {
      onDismiss(toast.id);
      router.push(validatedUrl);
    } else {
      onDismiss(toast.id);
      onOpenInbox();
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const validatedUrl = validateInternalActionUrl(toast.actionUrl);
    if (validatedUrl) {
      onDismiss(toast.id);
      router.push(validatedUrl);
    }
  };

  const relativeTime = formatDistanceToNow(new Date(toast.createdAt || Date.now()), {
    addSuffix: true,
  });

  return (
    <div
      role="alert"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      className={`pointer-events-auto group relative w-full bg-card/95 dark:bg-card/90 backdrop-blur-md text-card-foreground border border-border shadow-xl rounded-2xl p-4 flex gap-3.5 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] cursor-pointer overflow-hidden border-l-4 ${visuals.borderAccent}`}
    >
      {/* Icon badge */}
      <div
        className={`h-10 w-10 shrink-0 rounded-xl ${visuals.bgBadge} flex items-center justify-center border mt-0.5`}
      >
        <Icon className={`h-5 w-5 ${visuals.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-foreground truncate leading-tight">
            {toast.title}
          </p>
          <span className="text-[11px] font-medium text-muted-foreground shrink-0 whitespace-nowrap">
            {relativeTime}
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {toast.message}
        </p>

        {/* Action button if internal URL is provided */}
        {toast.actionLabel && toast.actionUrl && (
          <div className="pt-1.5">
            <button
              onClick={handleActionClick}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
            >
              <span>{toast.actionLabel}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Manual Dismiss Button */}
      <button
        data-dismiss="true"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        aria-label="Dismiss notification"
        className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Visual countdown progress bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20 ${
          isHovered ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div
          className="h-full bg-primary transition-all linear"
          style={{
            animation: `toastCountdown ${toast.autoDismissMs || 6000}ms linear forwards`,
            animationPlayState: isHovered ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}
