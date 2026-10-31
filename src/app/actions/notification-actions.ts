'use server';

import prisma from "@/lib/prisma";
import { getSession } from "./auth-actions";
import { revalidatePath } from "next/cache";
import {
  createNotification,
  createNotificationBroadcast,
  createLibrarianBroadcast,
  cancelScheduledBroadcast,
  resumeOrRetryBroadcast,
  searchNotificationRecipients,
  searchLibrarianEligibleStudents,
  getBroadcastHistory,
  getLibrarianBroadcastHistory,
  getAllEligibleLibraryStudents,
  getCurrentlyCheckedInStudents,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  validateInternalActionUrl,
  registerPushSubscription,
  removePushSubscription,
  updateUserPushPreference,
  getUserPushSubscriptionStatus,
  type BroadcastAudienceType,
  type CreateNotificationInput,
  type GetNotificationsOptions,
  type PaginatedNotifications,
  type SearchRecipientsOptions,
} from "@/lib/notifications";
import { getVapidPublicKey } from "@/lib/web-push";

/**
 * Resolves library IDs associated with a staff or librarian session.
 */
async function getStaffAuthorizedLibraryIds(userId: string, employerLibraryId: string | null): Promise<string[]> {
  const libraries = await prisma.library.findMany({
    where: {
      OR: [
        { librarianId: userId },
        ...(employerLibraryId ? [{ id: employerLibraryId }] : []),
        { staffMemberships: { some: { userId, status: 'ACTIVE' } } },
      ],
    },
    select: { id: true },
  });
  return libraries.map((l) => l.id);
}

/**
 * Verifies if the authenticated session has authority over a specific library.
 */
async function verifyLibraryAuthority(session: any, libraryId: string): Promise<boolean> {
  if (session.role === 'ADMIN') return true;
  const authorizedLibraryIds = await getStaffAuthorizedLibraryIds(session.userId, session.employerLibraryId);
  return authorizedLibraryIds.includes(libraryId);
}

/**
 * Legacy Server Action: sendNotification
 * Preserved for 100% backward compatibility with existing modals (ManualNotifyModal, etc.).
 * Strictly verifies sender authorization and library tenant scoping.
 */
export async function sendNotification(studentId: string, title: string, message: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  // Tenant / Scope check for non-admin senders
  if (session.role !== 'ADMIN') {
    const authorizedLibraryIds = await getStaffAuthorizedLibraryIds(session.userId, session.employerLibraryId);
    if (authorizedLibraryIds.length === 0) {
      return { error: 'Forbidden: No authorized library found for staff account.' };
    }

    const studentHasBooking = await prisma.booking.findFirst({
      where: {
        studentId,
        libraryId: { in: authorizedLibraryIds },
      },
    });

    const targetUser = await prisma.user.findUnique({ where: { id: studentId }, select: { role: true } });
    const isStaffOrAdmin = targetUser?.role === 'ADMIN' || targetUser?.role === 'LIBRARIAN' || targetUser?.role === 'RECEPTIONIST';

    if (!studentHasBooking && !isStaffOrAdmin) {
      return { error: 'Forbidden: You do not have permission to notify this student.' };
    }
  }

  try {
    const { notification } = await createNotification({
      recipientId: studentId,
      title,
      message,
      type: 'MANUAL',
    });

    return { success: true, notificationId: notification.id };
  } catch (error: any) {
    console.error("Error in sendNotification:", error);
    return { error: error?.message || 'Failed to send notification' };
  }
}

/**
 * Unified Server Action: createDirectNotification
 * Allows authorized senders (Admin, Librarian) to notify any valid recipient within their permissions.
 */
export async function createDirectNotification(params: {
  recipientId: string;
  title: string;
  message: string;
  type?: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  eventId?: string | null;
}) {
  const session = await getSession();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  // Sender authorization check
  if (session.role !== 'ADMIN' && session.role !== 'LIBRARIAN' && session.role !== 'RECEPTIONIST') {
    return { error: 'Forbidden: Insufficient privileges to send notifications' };
  }

  // Verify recipient exists
  const targetUser = await prisma.user.findUnique({
    where: { id: params.recipientId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return { error: 'Recipient not found' };
  }

  // Non-admins can only message students who have booked at their library
  if (session.role !== 'ADMIN') {
    const isStaffOrAdmin = targetUser.role === 'ADMIN' || targetUser.role === 'LIBRARIAN' || targetUser.role === 'RECEPTIONIST';

    const authorizedLibraryIds = await getStaffAuthorizedLibraryIds(session.userId, session.employerLibraryId);
    if (authorizedLibraryIds.length === 0) {
      return { error: 'Forbidden: No authorized library found for staff account.' };
    }

    const studentHasBooking = await prisma.booking.findFirst({
      where: {
        studentId: params.recipientId,
        libraryId: { in: authorizedLibraryIds },
      },
    });

    if (!studentHasBooking && !isStaffOrAdmin) {
      return { error: 'Forbidden: You do not have permission to notify this recipient.' };
    }
  }

  const validatedActionUrl = validateInternalActionUrl(params.actionUrl);

  try {
    const result = await createNotification({
      recipientId: params.recipientId,
      title: params.title,
      message: params.message,
      type: params.type || 'INFO',
      actionLabel: params.actionLabel,
      actionUrl: validatedActionUrl,
      eventId: params.eventId,
    });

    return {
      success: true,
      notificationId: result.notification.id,
      isDuplicate: result.isDuplicate,
    };
  } catch (error: any) {
    console.error("Error in createDirectNotification:", error);
    return { error: error?.message || 'Failed to dispatch notification' };
  }
}

/**
 * Librarian Action: Retrieve authorized libraries for the current session.
 */
export async function getLibrarianLibrariesAction() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized: Staff credentials required.' };
  }

  try {
    let libraries;
    if (session.role === 'ADMIN') {
      libraries = await prisma.library.findMany({
        select: { id: true, name: true, city: true, address: true },
        orderBy: { name: 'asc' },
      });
    } else {
      libraries = await prisma.library.findMany({
        where: {
          OR: [
            { librarianId: session.userId },
            ...(session.employerLibraryId ? [{ id: session.employerLibraryId }] : []),
          ],
        },
        select: { id: true, name: true, city: true, address: true },
        orderBy: { name: 'asc' },
      });
    }

    return { success: true, data: libraries };
  } catch (error: any) {
    console.error("Error retrieving librarian libraries:", error);
    return { error: error?.message || 'Failed to retrieve libraries' };
  }
}

/**
 * Librarian Action: Retrieve audience counts (all students, currently inside) for a managed library.
 */
export async function getLibraryAudienceCountsAction(libraryId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const isAuthorized = await verifyLibraryAuthority(session, libraryId);
  if (!isAuthorized) {
    return { error: 'Forbidden: You do not manage this library.' };
  }

  try {
    const [allStudents, checkedInStudents] = await Promise.all([
      getAllEligibleLibraryStudents(libraryId),
      getCurrentlyCheckedInStudents(libraryId),
    ]);

    return {
      success: true,
      data: {
        allStudentsCount: allStudents.length,
        checkedInCount: checkedInStudents.length,
      },
    };
  } catch (error: any) {
    console.error("Error retrieving library audience counts:", error);
    return { error: error?.message || 'Failed to retrieve audience counts' };
  }
}

/**
 * Librarian Action: Search eligible students in a managed library.
 */
export async function searchLibrarianStudentsAction(params: {
  libraryId: string;
  query?: string;
  page?: number;
  limit?: number;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const isAuthorized = await verifyLibraryAuthority(session, params.libraryId);
  if (!isAuthorized) {
    return { error: 'Forbidden: You do not manage this library.' };
  }

  try {
    const result = await searchLibrarianEligibleStudents(params);
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error searching librarian students:", error);
    return { error: error?.message || 'Failed to search students' };
  }
}

/**
 * Librarian Action: Send a notification broadcast to library students.
 */
export async function sendLibrarianBroadcastAction(input: {
  libraryId: string;
  title: string;
  message: string;
  type?: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  audienceMode:
    | "INDIVIDUAL_STUDENT"
    | "SELECTED_STUDENTS"
    | "ALL_LIBRARY_STUDENTS"
    | "CURRENTLY_CHECKED_IN";
  recipientIds?: string[];
  idempotencyKey?: string | null;
  scheduledFor?: Date | string | null;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized: Staff credentials required.' };
  }

  const isAuthorized = await verifyLibraryAuthority(session, input.libraryId);
  if (!isAuthorized) {
    return { error: 'Forbidden: You do not manage this library.' };
  }

  try {
    const result = await createLibrarianBroadcast({
      senderId: session.userId,
      senderRole: session.role,
      libraryId: input.libraryId,
      title: input.title,
      message: input.message,
      type: input.type,
      actionLabel: input.actionLabel,
      actionUrl: input.actionUrl,
      audienceMode: input.audienceMode,
      recipientIds: input.recipientIds,
      idempotencyKey: input.idempotencyKey,
      scheduledFor: input.scheduledFor,
    });

    revalidatePath('/dashboard/notifications');
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error sending librarian broadcast:", error);
    return { error: error?.message || 'Failed to send broadcast notification' };
  }
}

/**
 * Librarian Action: Fetch broadcast history for a library.
 */
export async function getLibrarianBroadcastHistoryAction(libraryId: string, page = 1, limit = 20) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const isAuthorized = await verifyLibraryAuthority(session, libraryId);
  if (!isAuthorized) {
    return { error: 'Forbidden: You do not manage this library.' };
  }

  try {
    const result = await getLibrarianBroadcastHistory(libraryId, { page, limit });
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error retrieving librarian broadcast history:", error);
    return { error: error?.message || 'Failed to retrieve broadcast history' };
  }
}

/**
 * Recovery Action: Resumes an interrupted broadcast job.
 * Authorized for ADMIN or authorized LIBRARIAN.
 */
export async function retryBroadcastAction(broadcastId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { success: false, error: 'Unauthorized: Privileges required to retry broadcasts.' };
  }

  try {
    const result = await resumeOrRetryBroadcast(broadcastId, session.userId, session.role);
    revalidatePath('/dashboard/notifications');
    revalidatePath('/admin/notifications');
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error retrying broadcast:", error);
    return { success: false, error: error?.message || 'Failed to retry broadcast.' };
  }
}

/**
 * Admin Action: Search recipients for notification compose modal with server-side pagination.
 */
export async function searchNotificationRecipientsAction(options: SearchRecipientsOptions) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'Forbidden: Administrator privileges required.' };
  }

  try {
    const result = await searchNotificationRecipients(options);
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error searching notification recipients:", error);
    return { error: error?.message || 'Failed to search recipients' };
  }
}

/**
 * Admin Action: Retrieve libraries list for audience targeting filter.
 */
export async function getAdminLibrariesAction() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'Forbidden: Administrator privileges required.' };
  }

  try {
    const libraries = await prisma.library.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: libraries };
  } catch (error: any) {
    console.error("Error fetching admin libraries:", error);
    return { error: error?.message || 'Failed to fetch libraries' };
  }
}

/**
 * Admin Action: Dispatch a broadcast notification to a targeted audience.
 */
export async function sendAdminBroadcastAction(input: {
  title: string;
  message: string;
  type?: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  audienceType: BroadcastAudienceType;
  targetLibraryIds?: string[];
  recipientIds?: string[];
  idempotencyKey?: string | null;
  scheduledFor?: Date | string | null;
}) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'Forbidden: Only administrators can create broadcast notifications.' };
  }

  try {
    const result = await createNotificationBroadcast({
      senderId: session.userId,
      senderRole: session.role,
      title: input.title,
      message: input.message,
      type: input.type,
      actionLabel: input.actionLabel,
      actionUrl: input.actionUrl,
      audienceType: input.audienceType,
      targetLibraryIds: input.targetLibraryIds,
      recipientIds: input.recipientIds,
      idempotencyKey: input.idempotencyKey,
      scheduledFor: input.scheduledFor,
    });

    revalidatePath('/admin/notifications');
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error creating admin broadcast:", error);
    return { error: error?.message || 'Failed to send broadcast notification' };
  }
}

/**
 * Action: Cancel a scheduled broadcast prior to dispatch.
 */
export async function cancelScheduledBroadcastAction(broadcastId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'LIBRARIAN')) {
    return { error: 'Unauthorized: Privileges required to cancel broadcasts.' };
  }

  try {
    const cancelled = await cancelScheduledBroadcast(
      broadcastId,
      session.userId,
      session.role
    );

    revalidatePath('/admin/notifications');
    revalidatePath('/dashboard/notifications');
    return { success: true, data: cancelled };
  } catch (error: any) {
    console.error("Error cancelling broadcast:", error);
    return { error: error?.message || 'Failed to cancel scheduled broadcast.' };
  }
}

/**
 * Admin Action: Fetch paginated broadcast history.
 */
export async function getAdminBroadcastHistoryAction(page = 1, limit = 20) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'Forbidden: Administrator privileges required.' };
  }

  try {
    const history = await getBroadcastHistory({ page, limit });
    return { success: true, data: history };
  } catch (error: any) {
    console.error("Error fetching broadcast history:", error);
    return { error: error?.message || 'Failed to retrieve broadcast history' };
  }
}

/**
 * Server Action: getMyNotifications
 * Retrieves paginated notifications strictly scoped to the authenticated user.
 */
export async function getMyNotifications(options?: GetNotificationsOptions): Promise<{
  success: boolean;
  data?: PaginatedNotifications;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const paginated = await getUserNotifications(session.userId, options);
    return { success: true, data: paginated };
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return { success: false, error: error?.message || 'Failed to retrieve notifications' };
  }
}

/**
 * Server Action: getMyUnreadCount
 * Returns the unread notification count for the authenticated caller.
 */
export async function getMyUnreadCount(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, count: 0, error: 'Unauthorized' };
  }

  try {
    const count = await getUnreadNotificationCount(session.userId);
    return { success: true, count };
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    return { success: false, count: 0, error: error?.message || 'Failed to fetch unread count' };
  }
}

/**
 * Server Action: markNotificationRead
 * Marks a notification as read, enforcing that the caller owns the notification.
 */
export async function markNotificationRead(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const result = await markNotificationAsRead(session.userId, notificationId);
    if (!result.success) {
      return { success: false, error: 'Notification not found or unauthorized' };
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error marking notification read:", error);
    return { success: false, error: error?.message || 'Failed to update notification' };
  }
}

/**
 * Server Action: markAllNotificationsRead
 * Clears all unread notifications for the calling user.
 */
export async function markAllNotificationsRead(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, count: 0, error: 'Unauthorized' };
  }

  try {
    const result = await markAllNotificationsAsRead(session.userId);
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("Error marking all read:", error);
    return { success: false, count: 0, error: error?.message || 'Failed to mark notifications read' };
  }
}

/**
 * Server Action: getRealtimeAuthTokenAction
 * Mints an authenticated Supabase JWT for the active session caller.
 */
export async function getRealtimeAuthTokenAction(): Promise<{
  success: boolean;
  token?: string | null;
  userId?: string;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseSecret) {
    return { success: true, token: null, userId: session.userId };
  }

  try {
    const jwt = (await import("jsonwebtoken")).default;
    const payload = {
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60),
      sub: 'f1683e1b-9c29-4c12-be87-4c713d2daf52',
      firebase_uid: session.userId,
      userId: session.userId,
      email: session.email,
      role: 'authenticated',
      iss: 'supabase'
    };

    const token = jwt.sign(payload, supabaseSecret);
    return { success: true, token, userId: session.userId };
  } catch (err: any) {
    console.error("Error signing Supabase token:", err);
    return { success: false, error: err?.message || 'Token generation failed' };
  }
}

// ---------------------------------------------------------------------------
// WEB PUSH SERVER ACTIONS (STEP 6)
// ---------------------------------------------------------------------------

/**
 * Server Action: getVapidPublicKeyAction
 * Retrieves the public VAPID key for browser subscription negotiation.
 */
export async function getVapidPublicKeyAction(): Promise<{
  success: boolean;
  publicKey?: string | null;
  error?: string;
}> {
  try {
    const key = getVapidPublicKey();
    return { success: true, publicKey: key };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to retrieve VAPID key' };
  }
}

/**
 * Server Action: registerPushSubscriptionAction
 * Authenticates the caller, validates subscription keys, and registers active browser subscription.
 */
export async function registerPushSubscriptionAction(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!subscription || !subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return { success: false, error: 'Malformed push subscription payload' };
  }

  try {
    await registerPushSubscription(session.userId, subscription);
    return { success: true };
  } catch (err: any) {
    console.error("Error registering push subscription:", err);
    return { success: false, error: err?.message || 'Failed to register push subscription' };
  }
}

/**
 * Server Action: removePushSubscriptionAction
 * Authenticates the caller and revokes/deactivates the device push subscription.
 */
export async function removePushSubscriptionAction(endpoint: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!endpoint || typeof endpoint !== 'string') {
    return { success: false, error: 'Invalid endpoint parameter' };
  }

  try {
    await removePushSubscription(session.userId, endpoint);
    return { success: true };
  } catch (err: any) {
    console.error("Error removing push subscription:", err);
    return { success: false, error: err?.message || 'Failed to remove push subscription' };
  }
}

/**
 * Server Action: updatePushPreferenceAction
 * Updates user-level push notification opt-in/opt-out status.
 */
export async function updatePushPreferenceAction(enabled: boolean): Promise<{
  success: boolean;
  enabled?: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await updateUserPushPreference(session.userId, Boolean(enabled));
    return { success: true, enabled: Boolean(enabled) };
  } catch (err: any) {
    console.error("Error updating push preference:", err);
    return { success: false, error: err?.message || 'Failed to update push preference' };
  }
}

/**
 * Server Action: getPushSubscriptionStatusAction
 * Retrieves push preference and device subscription count for the current session user.
 */
export async function getPushSubscriptionStatusAction(): Promise<{
  success: boolean;
  browserPushEnabled?: boolean;
  activeSubscriptionsCount?: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const status = await getUserPushSubscriptionStatus(session.userId);
    return { success: true, ...status };
  } catch (err: any) {
    console.error("Error fetching push status:", err);
    return { success: false, error: err?.message || 'Failed to fetch push status' };
  }
}

/**
 * Admin Action: Fetch comprehensive notification system health indicators.
 * Provides administrators real-time visibility into outbox, push queue backlogs,
 * failed deliveries, active push subscriptions, and provider configurations.
 */
export async function getNotificationSystemHealthAction(): Promise<{
  success: boolean;
  data?: {
    broadcasts: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      cancelled: number;
    };
    realtimeOutbox: {
      pendingBacklog: number;
      failedCount: number;
    };
    pushQueue: {
      pendingBacklog: number;
      processingCount: number;
      sentCount: number;
      failedCount: number;
      permanentFailureCount: number;
    };
    subscriptions: {
      activeDevices: number;
      totalDevices: number;
    };
    providers: {
      vapidConfigured: boolean;
      supabaseRealtimeConfigured: boolean;
    };
  };
  error?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'Forbidden: Administrator privileges required.' };
  }

  try {
    const [
      totalBroadcasts,
      pendingBroadcasts,
      processingBroadcasts,
      completedBroadcasts,
      failedBroadcasts,
      cancelledBroadcasts,
      outboxPending,
      outboxFailed,
      pushPending,
      pushProcessing,
      pushSent,
      pushFailed,
      pushPermanentFailed,
      activeSubs,
      totalSubs,
    ] = await Promise.all([
      prisma.notificationBroadcast.count(),
      prisma.notificationBroadcast.count({ where: { status: 'PENDING' } }),
      prisma.notificationBroadcast.count({ where: { status: 'PROCESSING' } }),
      prisma.notificationBroadcast.count({ where: { status: 'COMPLETED' } }),
      prisma.notificationBroadcast.count({ where: { status: 'FAILED' } }),
      prisma.notificationBroadcast.count({ where: { status: 'CANCELLED' } }),
      prisma.realtimeOutbox.count({ where: { isPublished: false, status: { not: 'COMPLETED' } } }),
      prisma.realtimeOutbox.count({ where: { status: 'FAILED' } }),
      prisma.pushDeliveryQueue.count({ where: { status: 'PENDING' } }),
      prisma.pushDeliveryQueue.count({ where: { status: 'PROCESSING' } }),
      prisma.pushDeliveryQueue.count({ where: { status: 'SENT' } }),
      prisma.pushDeliveryQueue.count({ where: { status: 'FAILED' } }),
      prisma.pushDeliveryQueue.count({ where: { status: 'PERMANENT_FAILURE' } }),
      prisma.pushSubscription.count({ where: { isActive: true } }),
      prisma.pushSubscription.count(),
    ]);

    const vapidConfigured = Boolean(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    );
    const supabaseRealtimeConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    );

    return {
      success: true,
      data: {
        broadcasts: {
          total: totalBroadcasts,
          pending: pendingBroadcasts,
          processing: processingBroadcasts,
          completed: completedBroadcasts,
          failed: failedBroadcasts,
          cancelled: cancelledBroadcasts,
        },
        realtimeOutbox: {
          pendingBacklog: outboxPending,
          failedCount: outboxFailed,
        },
        pushQueue: {
          pendingBacklog: pushPending,
          processingCount: pushProcessing,
          sentCount: pushSent,
          failedCount: pushFailed,
          permanentFailureCount: pushPermanentFailed,
        },
        subscriptions: {
          activeDevices: activeSubs,
          totalDevices: totalSubs,
        },
        providers: {
          vapidConfigured,
          supabaseRealtimeConfigured,
        },
      },
    };
  } catch (error: any) {
    console.error("Error fetching notification health:", error);
    return { success: false, error: error?.message || 'Failed to retrieve notification system health.' };
  }
}



