'use client';

import type { Notification } from "@prisma/client";

/**
 * Backward-compatible stub for NotificationListener.
 * Realtime notifications, toasts, and inbox listeners are now handled centrally
 * by NotificationProvider and NotificationBell.
 */
export function NotificationListener({ 
  notifications: _notifications 
}: { 
  notifications?: Notification[];
}) {
  return null;
}
