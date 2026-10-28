'use client';

import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useRouter } from 'next/navigation';
import type { Notification } from '@prisma/client';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import {
  useNotifications,
  getNotificationVisuals,
} from '@/components/notifications/NotificationProvider';
import { validateInternalActionUrl } from '@/lib/notification-shared';

interface NotificationBellProps {
  notifications?: Notification[];
  initialUnreadCount?: number;
}

export function NotificationBell({
  notifications: propNotifications,
  initialUnreadCount: propUnreadCount,
}: NotificationBellProps) {
  const router = useRouter();

  // Try consuming context from NotificationProvider
  let contextValue: ReturnType<typeof useNotifications> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    contextValue = useNotifications();
  } catch {
    contextValue = null;
  }

  // Fallback local state if rendered without Provider
  const [localOpen, setLocalOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(
    propNotifications || []
  );
  const [localUnreadCount, setLocalUnreadCount] = useState<number>(
    propUnreadCount ?? (propNotifications ? propNotifications.filter((n) => !n.isRead).length : 0)
  );
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bind to context or fallback
  const notifications = contextValue?.notifications ?? localNotifications;
  const unreadCount = contextValue?.unreadCount ?? localUnreadCount;
  const open = contextValue ? contextValue.isSheetOpen : localOpen;
  const setOpen = contextValue ? contextValue.setIsSheetOpen : setLocalOpen;
  const isReconnecting = contextValue?.isReconnecting ?? false;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (contextValue?.refreshInbox) {
      await contextValue.refreshInbox();
    }
    setIsRefreshing(false);
  };

  const handleMarkOneRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (contextValue?.markAsRead) {
      await contextValue.markAsRead(id);
    } else {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
      );
      setLocalUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    if (contextValue?.markAllAsRead) {
      await contextValue.markAllAsRead();
    } else {
      setLocalNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
      );
      setLocalUnreadCount(0);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      if (contextValue?.markAsRead) {
        await contextValue.markAsRead(notif.id);
      }
    }

    const validatedUrl = validateInternalActionUrl(notif.actionUrl);
    if (validatedUrl) {
      setOpen(false);
      router.push(validatedUrl);
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    activeTab === 'unread' ? !n.isRead : true
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={`Notifications (${unreadCount} unread)`}
        className="relative w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-muted/80 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-2 border-background animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-[460px] p-0 flex flex-col border-l border-border bg-background"
      >
        {/* Sheet Header */}
        <SheetHeader className="p-4 sm:px-6 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-10 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <SheetTitle className="text-xl font-heading font-bold text-foreground">
              Notifications
            </SheetTitle>
            {isReconnecting && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold border border-amber-500/20">
                Reconnecting...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh notifications"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                aria-label="Mark all as read"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Tab Filters */}
        <div className="flex px-4 sm:px-6 pt-3 pb-2 gap-2 border-b border-border/50 bg-muted/20">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'unread'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span
                className={`flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] px-1 font-bold ${
                  activeTab === 'unread'
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-destructive text-destructive-foreground'
                }`}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Notification List Container */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-muted-foreground px-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-1">
                <Bell className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeTab === 'unread'
                  ? 'You have read all your notifications.'
                  : 'New alerts, booking reminders, and announcements will appear here.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const visuals = getNotificationVisuals(notif.type);
              const Icon = visuals.Icon;
              const relativeTime = formatDistanceToNow(new Date(notif.createdAt), {
                addSuffix: true,
              });

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative p-4 sm:px-6 transition-all duration-200 cursor-pointer ${
                    !notif.isRead
                      ? 'bg-primary/[0.04] dark:bg-primary/[0.08] hover:bg-primary/[0.08]'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  {!notif.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                  )}

                  <div className="flex items-start gap-3.5">
                    {/* Visual icon badge */}
                    <div
                      className={`h-9 w-9 shrink-0 rounded-xl ${visuals.bgBadge} flex items-center justify-center border mt-0.5`}
                    >
                      <Icon className={`h-4 w-4 ${visuals.iconColor}`} />
                    </div>

                    {/* Notification body */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-snug ${
                            !notif.isRead
                              ? 'font-bold text-foreground'
                              : 'font-medium text-foreground/80'
                          }`}
                        >
                          {notif.title}
                        </p>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                            {relativeTime}
                          </span>
                          {!notif.isRead && (
                            <button
                              onClick={(e) => handleMarkOneRead(e, notif.id)}
                              aria-label="Mark as read"
                              title="Mark as read"
                              className="p-1 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors opacity-70 group-hover:opacity-100"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground leading-relaxed line-clamp-3 prose prose-xs dark:prose-invert">
                        <ReactMarkdown>{notif.message}</ReactMarkdown>
                      </div>

                      {/* Action Button */}
                      {notif.actionLabel && notif.actionUrl && (
                        <div className="pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notif);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
                          >
                            <span>{notif.actionLabel}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
