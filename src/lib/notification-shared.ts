/**
 * Shared Notification Types and Client-Safe Utilities
 * 
 * This file contains purely isomorphic, client-safe types and utility functions
 * that can be safely imported by both React client components and Node.js server code
 * without leaking database or server-only dependencies (Prisma, Web Push, pg) into webpack client bundles.
 */

export type NotificationType =
  | "INFO"
  | "WARNING"
  | "SUCCESS"
  | "EXPIRING"
  | "MANUAL"
  | "SYSTEM"
  | string;

export interface PopupToast {
  id: string;
  eventId?: string | null;
  title: string;
  message: string;
  type: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  createdAt: string;
  autoDismissMs?: number;
}

export type BroadcastAudienceType =
  | "ALL"
  | "ALL_STUDENTS"
  | "ALL_LIBRARIANS"
  | "LIBRARY_STUDENTS"
  | "CUSTOM_STUDENTS"
  | "CUSTOM_LIBRARIANS"
  | "CUSTOM_MIXED"
  | "INDIVIDUAL_STUDENT"
  | "SELECTED_STUDENTS"
  | "ALL_LIBRARY_STUDENTS"
  | "ACTIVE_STUDENTS"
  | "EXPIRED_STUDENTS"
  | "CURRENTLY_CHECKED_IN"
  | "CUSTOM";

/**
 * Returns icon name, accent colors, and border styling based on notification type.
 */
export function getNotificationVisuals(type?: string | null) {
  const normalized = (type || 'INFO').toUpperCase();

  switch (normalized) {
    case 'SUCCESS':
    case 'APPROVED':
      return {
        iconName: 'CheckCircle2',
        iconColor: 'text-emerald-500 dark:text-emerald-400',
        bgBadge: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
        borderAccent: 'border-l-emerald-500',
        badgeText: 'Success',
      };
    case 'WARNING':
      return {
        iconName: 'AlertTriangle',
        iconColor: 'text-amber-500 dark:text-amber-400',
        bgBadge: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        borderAccent: 'border-l-amber-500',
        badgeText: 'Alert',
      };
    case 'EXPIRING':
      return {
        iconName: 'Clock',
        iconColor: 'text-orange-500 dark:text-orange-400',
        bgBadge: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
        borderAccent: 'border-l-orange-500',
        badgeText: 'Expiring',
      };
    case 'SYSTEM':
      return {
        iconName: 'ShieldAlert',
        iconColor: 'text-purple-500 dark:text-purple-400',
        bgBadge: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
        borderAccent: 'border-l-purple-500',
        badgeText: 'System',
      };
    case 'MANUAL':
      return {
        iconName: 'BellRing',
        iconColor: 'text-primary',
        bgBadge: 'bg-primary/10 border-primary/20',
        borderAccent: 'border-l-primary',
        badgeText: 'Notice',
      };
    case 'INFO':
    default:
      return {
        iconName: 'Info',
        iconColor: 'text-blue-500 dark:text-blue-400',
        bgBadge: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
        borderAccent: 'border-l-blue-500',
        badgeText: 'Update',
      };
  }
}

/**
 * Validates that an action URL is an internal relative application path
 * and prevents external open redirects or javascript: injection.
 */
export function validateInternalActionUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Must begin with a single slash (relative path), not a protocol or double-slash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  // Reject dangerous schemes or control characters
  if (/[\r\n\t]/.test(trimmed)) {
    return null;
  }

  return trimmed.slice(0, 500);
}
