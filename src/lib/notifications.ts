import prisma from "@/lib/prisma";
import type { Notification, NotificationBroadcast, Prisma, PrismaClient } from "@prisma/client";
import crypto from "crypto";
import {
  sendWebPushNotification,
  getVapidPublicKey,
  sanitizeActionUrl,
  type WebPushSubscription,
  type PushNotificationPayload,
} from "./web-push";

function getDb(client?: PrismaClient | Prisma.TransactionClient): PrismaClient | Prisma.TransactionClient {
  return client || prisma;
}

import {
  type NotificationType,
  type PopupToast,
  type BroadcastAudienceType,
  getNotificationVisuals,
  validateInternalActionUrl,
} from "./notification-shared";

export {
  type NotificationType,
  type PopupToast,
  type BroadcastAudienceType,
  getNotificationVisuals,
  validateInternalActionUrl,
};

export interface CreateNotificationInput {
  recipientId: string; // User.id across STUDENT, LIBRARIAN, ADMIN, RECEPTIONIST
  title: string;
  message: string;
  type?: NotificationType;
  actionLabel?: string | null;
  actionUrl?: string | null;
  eventId?: string | null; // Stable idempotency / deduplication key
  broadcastId?: string | null;
}

export interface CreateBroadcastInput {
  senderId: string;
  senderRole: string; // Enforced "ADMIN"
  title: string;
  message: string;
  type?: NotificationType;
  actionLabel?: string | null;
  actionUrl?: string | null;
  audienceType: BroadcastAudienceType;
  targetLibraryIds?: string[];
  recipientIds?: string[];
  idempotencyKey?: string | null;
  scheduledFor?: Date | string | null;
}

export interface CreateLibrarianBroadcastInput {
  senderId: string;
  senderRole: string; // "LIBRARIAN", "ADMIN", or "RECEPTIONIST"
  libraryId: string;
  title: string;
  message: string;
  type?: NotificationType;
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
}

export interface BroadcastResult {
  broadcast: NotificationBroadcast;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  isDuplicate: boolean;
  isScheduled?: boolean;
}

export interface RecipientSearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  uniqueId: string | null;
}

export interface SearchRecipientsOptions {
  query?: string;
  role?: "ALL" | "STUDENT" | "LIBRARIAN";
  libraryId?: string;
  page?: number;
  limit?: number;
}

export interface GetNotificationsOptions {
  page?: number; // 1-indexed, default: 1
  limit?: number; // default: 20, max: 100
  unreadOnly?: boolean;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  totalCount: number;
  unreadCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}


/**
 * Validates and sanitizes single notification payload attributes.
 */
export function validateNotificationInput(input: CreateNotificationInput): {
  recipientId: string;
  title: string;
  message: string;
  type: string;
  actionLabel: string | null;
  actionUrl: string | null;
  eventId: string | null;
  broadcastId: string | null;
} {
  if (!input.recipientId || typeof input.recipientId !== "string" || !input.recipientId.trim()) {
    throw new Error("Validation Error: recipientId is required.");
  }

  const title = input.title ? input.title.trim() : "";
  if (!title) {
    throw new Error("Validation Error: title is required.");
  }
  if (title.length > 200) {
    throw new Error("Validation Error: title exceeds 200 characters.");
  }

  const message = input.message ? input.message.trim() : "";
  if (!message) {
    throw new Error("Validation Error: message is required.");
  }
  if (message.length > 2000) {
    throw new Error("Validation Error: message exceeds 2000 characters.");
  }

  const rawType = input.type ? input.type.trim().toUpperCase() : "INFO";
  const type = rawType.slice(0, 50) || "INFO";

  const actionLabel = input.actionLabel ? input.actionLabel.trim().slice(0, 60) : null;
  const actionUrl = validateInternalActionUrl(input.actionUrl);
  const eventId = input.eventId ? input.eventId.trim().slice(0, 255) : null;
  const broadcastId = input.broadcastId ? input.broadcastId.trim() : null;

  return {
    recipientId: input.recipientId.trim(),
    title,
    message,
    type,
    actionLabel,
    actionUrl,
    eventId: eventId || null,
    broadcastId: broadcastId || null,
  };
}

/**
 * Computes a deterministic payload hash for broadcast deduplication verification.
 */
export function computeBroadcastPayloadHash(input: {
  title: string;
  message: string;
  type?: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  audienceType: string;
  targetLibraryIds?: string[];
  recipientIds?: string[];
}): string {
  const normalized = {
    title: input.title.trim(),
    message: input.message.trim(),
    type: (input.type || "INFO").trim().toUpperCase(),
    actionLabel: input.actionLabel?.trim() || null,
    actionUrl: validateInternalActionUrl(input.actionUrl),
    audienceType: input.audienceType,
    targetLibraryIds: (input.targetLibraryIds || []).slice().sort(),
    recipientIds: (input.recipientIds || []).slice().sort(),
  };
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Resolves recipient IDs server-side for any given broadcast audience type.
 */
export async function resolveBroadcastAudience(
  params: {
    audienceType: BroadcastAudienceType;
    targetLibraryIds?: string[];
    recipientIds?: string[];
  },
  client?: PrismaClient | Prisma.TransactionClient
): Promise<string[]> {
  const db = getDb(client);
  const { audienceType, targetLibraryIds = [], recipientIds = [] } = params;

  switch (audienceType) {
    case "ALL": {
      const users = await db.user.findMany({
        where: { role: { in: ["STUDENT", "LIBRARIAN"] } },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }

    case "ALL_STUDENTS": {
      const users = await db.user.findMany({
        where: { role: "STUDENT" },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }

    case "ALL_LIBRARIANS": {
      const users = await db.user.findMany({
        where: { role: "LIBRARIAN" },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }

    case "LIBRARY_STUDENTS": {
      if (!targetLibraryIds || targetLibraryIds.length === 0) {
        throw new Error("Validation Error: targetLibraryIds must contain at least one library for LIBRARY_STUDENTS.");
      }
      const bookings = await db.booking.findMany({
        where: { libraryId: { in: targetLibraryIds } },
        select: { studentId: true },
        distinct: ["studentId"],
      });
      const rawStudentIds = Array.from(new Set(bookings.map((b: any) => b.studentId)));
      if (rawStudentIds.length === 0) return [];

      const students = await db.user.findMany({
        where: { id: { in: rawStudentIds }, role: "STUDENT" },
        select: { id: true },
      });
      return students.map((u: any) => u.id);
    }

    case "ALL_LIBRARY_STUDENTS": {
      if (!targetLibraryIds || targetLibraryIds.length === 0) {
        throw new Error("Validation Error: targetLibraryIds must contain at least one library.");
      }
      return getAllEligibleLibraryStudents(targetLibraryIds[0], db);
    }

    case "CURRENTLY_CHECKED_IN": {
      if (!targetLibraryIds || targetLibraryIds.length === 0) {
        throw new Error("Validation Error: targetLibraryIds must contain at least one library for CURRENTLY_CHECKED_IN.");
      }
      return getCurrentlyCheckedInStudents(targetLibraryIds[0], db);
    }

    case "CUSTOM_STUDENTS":
    case "INDIVIDUAL_STUDENT": {
      const uniqueIds = Array.from(new Set(recipientIds.map((id) => id?.trim()).filter(Boolean)));
      if (uniqueIds.length === 0) {
        throw new Error("Validation Error: recipientIds cannot be empty for custom recipient selection.");
      }
      const users = await db.user.findMany({
        where: { id: { in: uniqueIds }, role: "STUDENT" },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }

    case "CUSTOM_LIBRARIANS": {
      const uniqueIds = Array.from(new Set(recipientIds.map((id) => id?.trim()).filter(Boolean)));
      if (uniqueIds.length === 0) {
        throw new Error("Validation Error: recipientIds cannot be empty for custom recipient selection.");
      }
      const users = await db.user.findMany({
        where: { id: { in: uniqueIds }, role: "LIBRARIAN" },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }

    case "CUSTOM_MIXED":
    case "SELECTED_STUDENTS": {
      const uniqueIds = Array.from(new Set(recipientIds.map((id) => id?.trim()).filter(Boolean)));
      if (uniqueIds.length === 0) {
        throw new Error("Validation Error: recipientIds cannot be empty for custom recipient selection.");
      }
      const users = await db.user.findMany({
        where: { id: { in: uniqueIds }, role: { in: ["STUDENT", "LIBRARIAN"] } },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }

    default:
      throw new Error(`Validation Error: Unsupported audienceType '${audienceType}'`);
  }
}

/**
 * Resolves students currently checked into a specific library using authoritative attendance state.
 * Evaluates the latest checkinLog per student and verifies an active, non-expired confirmed booking.
 */
export async function getCurrentlyCheckedInStudents(
  libraryId: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<string[]> {
  const db = getDb(client);
  const now = new Date();

  // 1. Fetch checkin logs for this library ordered by timestamp desc
  const checkinLogs = await db.checkinLog.findMany({
    where: { libraryId },
    orderBy: { timestamp: "desc" },
  });

  // 2. Track authoritative most recent checkin action per student
  const latestLogPerStudent = new Map<string, { status: string; timestamp: Date }>();
  for (const log of checkinLogs) {
    const existing = latestLogPerStudent.get(log.studentId);
    const logTime = new Date(log.timestamp).getTime();
    if (!existing || logTime > new Date(existing.timestamp).getTime()) {
      latestLogPerStudent.set(log.studentId, { status: log.status, timestamp: log.timestamp });
    }
  }

  // 3. Students whose latest log is explicitly 'CHECK_IN' (not 'CHECK_OUT')
  const checkedInStudentIds: string[] = [];
  for (const [studentId, entry] of latestLogPerStudent.entries()) {
    if (entry.status === "CHECK_IN") {
      checkedInStudentIds.push(studentId);
    }
  }

  if (checkedInStudentIds.length === 0) return [];

  // 4. Verify student holds a confirmed non-expired, non-cancelled booking
  const validBookings = await db.booking.findMany({
    where: {
      libraryId,
      studentId: { in: checkedInStudentIds },
      status: "CONFIRMED",
      startTime: { lte: now },
      endTime: { gte: now },
    },
    select: { studentId: true },
  });

  const validStudentIds = new Set(validBookings.map((b: any) => b.studentId));
  return checkedInStudentIds.filter((id) => validStudentIds.has(id));
}

/**
 * Resolves all eligible students currently associated with a library.
 * Excludes cancelled, expired, or pending bookings.
 */
export async function getAllEligibleLibraryStudents(
  libraryId: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<string[]> {
  const db = getDb(client);
  const now = new Date();

  const confirmedBookings = await db.booking.findMany({
    where: {
      libraryId,
      status: "CONFIRMED",
      endTime: { gte: now },
    },
    select: { studentId: true },
  });

  const studentIds = Array.from(new Set(confirmedBookings.map((b: any) => b.studentId)));
  if (studentIds.length === 0) return [];

  const users = await db.user.findMany({
    where: {
      id: { in: studentIds },
      role: "STUDENT",
    },
    select: { id: true },
  });

  return users.map((u: any) => u.id);
}

/**
 * Searches eligible students belonging to a managed library for the Librarian composer.
 */
export async function searchLibrarianEligibleStudents(
  options: {
    libraryId: string;
    query?: string;
    page?: number;
    limit?: number;
  },
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{
  users: RecipientSearchResult[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const db = getDb(client);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;
  const now = new Date();

  const bookings = await db.booking.findMany({
    where: {
      libraryId: options.libraryId,
      status: "CONFIRMED",
      endTime: { gte: now },
    },
    select: { studentId: true },
  });

  const eligibleStudentIds = Array.from(new Set(bookings.map((b: any) => b.studentId)));
  if (eligibleStudentIds.length === 0) {
    return { users: [], totalCount: 0, page, limit, hasMore: false };
  }

  const whereConditions: any = {
    id: { in: eligibleStudentIds },
    role: "STUDENT",
  };

  if (options.query && options.query.trim()) {
    const q = options.query.trim();
    whereConditions.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { uniqueId: { contains: q, mode: "insensitive" } },
    ];
  }

  const [users, totalCount] = await Promise.all([
    db.user.findMany({
      where: whereConditions,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        uniqueId: true,
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    db.user.count({ where: whereConditions }),
  ]);

  return {
    users,
    totalCount,
    page,
    limit,
    hasMore: skip + users.length < totalCount,
  };
}

/**
 * Executes a callback within a Prisma interactive transaction if supported,
 * or directly on the given client if already within a transaction or mock.
 */
export async function withTransaction<T>(
  client: any,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  if (client && typeof client.$transaction === "function") {
    return client.$transaction(fn);
  }
  return fn(client);
}

/**
 * Publishes a durable notification event to Supabase Realtime with outbox fallback.
 */
export async function publishNotificationRealtime(
  notification: Notification,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<boolean> {
  const recipientId = notification.userId || notification.studentId;
  if (!recipientId) return false;

  const topic = `user_notifications:${recipientId}`;
  const event = "new_notification";
  const payload = {
    id: notification.id,
    eventId: notification.eventId,
    broadcastId: notification.broadcastId,
    recipientId,
    title: notification.title,
    message: notification.message.length > 150 ? notification.message.slice(0, 147) + "..." : notification.message,
    type: notification.type,
    actionLabel: notification.actionLabel,
    actionUrl: notification.actionUrl,
    createdAt: notification.createdAt instanceof Date ? notification.createdAt.toISOString() : new Date().toISOString(),
  };

  const db = getDb(client);
  const outboxEventId = `notif_${notification.id}`;

  // 1. Ensure durable Outbox entry exists if not already persisted in transaction
  if (db && typeof (db as any).realtimeOutbox?.upsert === "function") {
    try {
      await (db as any).realtimeOutbox.upsert({
        where: { eventId: outboxEventId },
        create: {
          eventId: outboxEventId,
          topic,
          type: "NOTIFICATION",
          payload,
          status: "PENDING",
          studentId: recipientId,
          isPublished: false,
        },
        update: {
          payload,
          topic,
        },
      });
    } catch (e) {
      console.warn("[Notifications] Outbox persistence warning:", e);
    }
  }

  // 2. Immediate best-effort publish to Supabase Realtime REST broadcast
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  try {
    const { publishNotificationToRealtime } = await import("@/lib/realtime-publisher");
    const published = await publishNotificationToRealtime(topic, event, payload);

    if (published && db && typeof (db as any).realtimeOutbox?.updateMany === "function") {
      await (db as any).realtimeOutbox.updateMany({
        where: { eventId: outboxEventId },
        data: {
          status: "PUBLISHED",
          isPublished: true,
          attempts: { increment: 1 },
        },
      });
    }
    return published;
  } catch (err) {
    console.warn("[Notifications] Immediate Realtime publish error:", err);
    return false;
  }
}

/**
 * Creates a notification for any recipient (STUDENT, LIBRARIAN, ADMIN).
 * Provides atomic database writes for both Notification and RealtimeOutbox in a single transaction.
 * Provides atomic deduplication if an eventId is supplied.
 */
export async function createNotification(
  input: CreateNotificationInput,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{ notification: Notification; isDuplicate: boolean }> {
  const db = getDb(client);
  const validated = validateNotificationInput(input);

  // 1. Stable event identity / deduplication check
  if (validated.eventId) {
    const existing = await db.notification.findUnique({
      where: { eventId: validated.eventId },
    });
    if (existing) {
      return { notification: existing, isDuplicate: true };
    }
  }

  // 2. Perform atomic database write of Notification AND RealtimeOutbox in a single transaction
  try {
    const notification = await withTransaction(db, async (tx: any) => {
      const created = await tx.notification.create({
        data: {
          studentId: validated.recipientId, // Maintained for backward compatibility with schema & navbar
          userId: validated.recipientId,    // Unified recipient reference
          broadcastId: validated.broadcastId,
          eventId: validated.eventId,
          title: validated.title,
          message: validated.message,
          type: validated.type,
          actionLabel: validated.actionLabel,
          actionUrl: validated.actionUrl,
          isRead: false,
        },
      });

      // Atomically persist durable Outbox record in the same transaction
      const recipientId = created.userId || created.studentId;
      const topic = `user_notifications:${recipientId}`;
      const outboxEventId = `notif_${created.id}`;
      const payload = {
        id: created.id,
        eventId: created.eventId,
        broadcastId: created.broadcastId,
        recipientId,
        title: created.title,
        message: created.message.length > 150 ? created.message.slice(0, 147) + "..." : created.message,
        type: created.type,
        actionLabel: created.actionLabel,
        actionUrl: created.actionUrl,
        createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : new Date().toISOString(),
      };

      if (tx && typeof tx.realtimeOutbox?.upsert === "function") {
        await tx.realtimeOutbox.upsert({
          where: { eventId: outboxEventId },
          create: {
            eventId: outboxEventId,
            topic,
            type: "NOTIFICATION",
            payload,
            status: "PENDING",
            studentId: recipientId,
            isPublished: false,
          },
          update: {
            payload,
            topic,
          },
        });
      }

      // Atomically enqueue Web Push delivery jobs for active subscriptions in the same transaction
      if (tx && typeof (tx as any).pushSubscription?.findMany === "function" && typeof (tx as any).pushDeliveryQueue?.createMany === "function") {
        try {
          const user = await tx.user?.findUnique?.({
            where: { id: recipientId },
            select: { browserPushEnabled: true },
          });

          if (user?.browserPushEnabled !== false) {
            const activeSubs = await (tx as any).pushSubscription.findMany({
              where: {
                userId: recipientId,
                isActive: true,
              },
            });

            if (activeSubs.length > 0) {
              const pushPayload = {
                title: created.title,
                body: created.message.length > 200 ? created.message.slice(0, 197) + "..." : created.message,
                url: sanitizeActionUrl(created.actionUrl || undefined),
                tag: created.eventId || created.id,
                badge: "/icons/icon-192x192.png",
                icon: "/icons/icon-192x192.png",
                timestamp: created.createdAt instanceof Date ? created.createdAt.getTime() : Date.now(),
              };

              await (tx as any).pushDeliveryQueue.createMany({
                data: activeSubs.map((sub: any) => ({
                  notificationId: created.id,
                  userId: recipientId,
                  subscriptionId: sub.id,
                  endpoint: sub.endpoint,
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                  payload: pushPayload,
                  status: "PENDING",
                  attempts: 0,
                  maxAttempts: 5,
                  nextAttemptAt: new Date(),
                })),
              });
            }
          }
        } catch (pushQueueErr) {
          console.warn("[Notifications] Web push queue creation warning:", pushQueueErr);
        }
      }

      return created;
    });

    // 3. Post-commit: Immediate best-effort publish to Supabase Realtime
    // (If network fails or process terminates, the outbox record is ALREADY safely committed in PostgreSQL)
    try {
      await publishNotificationRealtime(notification, db);
    } catch (realtimeErr) {
      console.warn("[Notifications] Realtime publication non-critical warning:", realtimeErr);
    }

    // 4. Post-commit: Immediate best-effort dispatch to active Web Push endpoints
    try {
      await dispatchPendingPushForNotification(notification.id, db);
    } catch (pushErr) {
      console.warn("[Notifications] Immediate web push dispatch warning:", pushErr);
    }

    return { notification, isDuplicate: false };
  } catch (err: unknown) {
    // Handle concurrent insertion race on unique eventId gracefully
    const prismaError = err as { code?: string };
    if (prismaError?.code === "P2002" && validated.eventId) {
      const existing = await db.notification.findUnique({
        where: { eventId: validated.eventId },
      });
      if (existing) {
        return { notification: existing, isDuplicate: true };
      }
    }
    throw err;
  }
}

/**
 * Internal executor: processes fanout for a broadcast in bounded batches (chunk size 50).
 */
async function executeBroadcastFanout(
  broadcast: any,
  targetRecipientIds: string[],
  db: any
): Promise<BroadcastResult> {
  const BATCH_SIZE = 50;
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetRecipientIds.length; i += BATCH_SIZE) {
    const batch = targetRecipientIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (recipientId) => {
        const perRecipientEventId = `bcast_${broadcast.id}_${recipientId}`;
        try {
          await createNotification(
            {
              recipientId,
              title: broadcast.title,
              message: broadcast.message,
              type: broadcast.type,
              actionLabel: broadcast.actionLabel,
              actionUrl: broadcast.actionUrl,
              eventId: perRecipientEventId,
              broadcastId: broadcast.id,
            },
            db
          );
          sentCount++;
        } catch (err: any) {
          if (err?.code === "P2002") {
            sentCount++; // Already delivered in prior batch
          } else {
            failedCount++;
          }
        }
      })
    );
  }

  const finalStatus =
    failedCount === 0 ? "COMPLETED" : sentCount === 0 ? "FAILED" : "PARTIALLY_FAILED";

  const updatedBroadcast = await db.notificationBroadcast.update({
    where: { id: broadcast.id },
    data: {
      sentCount,
      failedCount,
      status: finalStatus,
    },
  });

  return {
    broadcast: updatedBroadcast,
    totalTargets: targetRecipientIds.length,
    sentCount,
    failedCount,
    isDuplicate: false,
  };
}

/**
 * Creates and executes a durable, bounded-batch notification broadcast for administrators.
 */
export async function createNotificationBroadcast(
  input: CreateBroadcastInput,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<BroadcastResult> {
  const db = getDb(client);

  // 1. Strict RBAC: Only platform administrators can initiate broadcasts
  if (input.senderRole !== "ADMIN") {
    throw new Error("Forbidden: Only platform administrators can initiate broadcasts.");
  }

  // 2. Validate content
  const title = input.title ? input.title.trim() : "";
  if (!title) throw new Error("Validation Error: title is required.");
  if (title.length > 200) throw new Error("Validation Error: title exceeds 200 characters.");

  const message = input.message ? input.message.trim() : "";
  if (!message) throw new Error("Validation Error: message is required.");
  if (message.length > 2000) throw new Error("Validation Error: message exceeds 2000 characters.");

  const type = (input.type || "INFO").trim().toUpperCase();
  const actionLabel = input.actionLabel ? input.actionLabel.trim().slice(0, 60) : null;
  const actionUrl = validateInternalActionUrl(input.actionUrl);

  // 3. Resolve audience server-side
  const targetRecipientIds = await resolveBroadcastAudience(
    {
      audienceType: input.audienceType,
      targetLibraryIds: input.targetLibraryIds,
      recipientIds: input.recipientIds,
    },
    db
  );

  if (targetRecipientIds.length === 0) {
    throw new Error("Validation Error: No valid, eligible recipients found for this broadcast.");
  }

  // 4. Compute deterministic payload hash for idempotency protection
  const payloadHash = computeBroadcastPayloadHash({
    title,
    message,
    type,
    actionLabel,
    actionUrl,
    audienceType: input.audienceType,
    targetLibraryIds: input.targetLibraryIds,
    recipientIds: targetRecipientIds,
  });

  // 5. Check Idempotency Key
  const idempotencyKey = input.idempotencyKey ? input.idempotencyKey.trim() : null;
  if (idempotencyKey) {
    const existing = await db.notificationBroadcast.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.payloadHash && existing.payloadHash !== payloadHash) {
        throw new Error("Conflict: Same idempotency key cannot be reused with a different payload.");
      }
      return {
        broadcast: existing,
        totalTargets: existing.totalTargets,
        sentCount: existing.sentCount,
        failedCount: existing.failedCount,
        isDuplicate: true,
      };
    }
  }

  // 6. Create durable PostgreSQL-backed broadcast job record
  const scheduledDate = input.scheduledFor ? new Date(input.scheduledFor) : null;
  const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > Date.now());

  const manifestRecipientIds = (
    input.audienceType === "CUSTOM_STUDENTS" ||
    input.audienceType === "CUSTOM_LIBRARIANS" ||
    input.audienceType === "CUSTOM_MIXED"
  ) ? targetRecipientIds : [];

  const broadcast = await db.notificationBroadcast.create({
    data: {
      senderId: input.senderId,
      title,
      message,
      type,
      actionLabel,
      actionUrl,
      audienceType: input.audienceType,
      targetLibraryIds: input.targetLibraryIds || [],
      idempotencyKey,
      payloadHash,
      totalTargets: targetRecipientIds.length,
      sentCount: 0,
      failedCount: 0,
      status: isScheduled ? "SCHEDULED" : "PROCESSING",
      scheduledFor: isScheduled ? scheduledDate : null,
      manifestRecipientIds: isScheduled ? manifestRecipientIds : targetRecipientIds,
    },
  });

  if (isScheduled) {
    return {
      broadcast,
      totalTargets: targetRecipientIds.length,
      sentCount: 0,
      failedCount: 0,
      isDuplicate: false,
      isScheduled: true,
    };
  }

  // 7. Execute bounded batch fanout
  return executeBroadcastFanout(broadcast, targetRecipientIds, db);
}

/**
 * Creates and executes a librarian-scoped notification broadcast.
 * Strictly verifies multi-library ownership, cross-library tenant isolation, and booking eligibility.
 */
export async function createLibrarianBroadcast(
  input: CreateLibrarianBroadcastInput,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<BroadcastResult> {
  const db = getDb(client);

  // 1. Strict RBAC: block student senders
  if (
    input.senderRole !== "LIBRARIAN" &&
    input.senderRole !== "ADMIN" &&
    input.senderRole !== "RECEPTIONIST"
  ) {
    throw new Error("Forbidden: You do not have permission to send library notifications.");
  }

  // 2. Authorization: Verify library access if not ADMIN
  if (input.senderRole !== "ADMIN") {
    const sender = await db.user.findUnique({
      where: { id: input.senderId },
      select: { employerLibraryId: true },
    });

    const authorizedLibrary = await db.library.findFirst({
      where: {
        id: input.libraryId,
        OR: [
          { librarianId: input.senderId },
          ...(sender?.employerLibraryId ? [{ id: sender.employerLibraryId }] : []),
        ],
      },
    });

    if (!authorizedLibrary) {
      throw new Error("Forbidden: You do not have authority over this library.");
    }
  }

  // 3. Validate content
  const title = input.title ? input.title.trim() : "";
  if (!title) throw new Error("Validation Error: title is required.");
  if (title.length > 200) throw new Error("Validation Error: title exceeds 200 characters.");

  const message = input.message ? input.message.trim() : "";
  if (!message) throw new Error("Validation Error: message is required.");
  if (message.length > 2000) throw new Error("Validation Error: message exceeds 2000 characters.");

  const type = (input.type || "INFO").trim().toUpperCase();
  const actionLabel = input.actionLabel ? input.actionLabel.trim().slice(0, 60) : null;
  const actionUrl = validateInternalActionUrl(input.actionUrl);

  // 4. Resolve audience based on audienceMode
  let targetRecipientIds: string[] = [];

  if (input.audienceMode === "INDIVIDUAL_STUDENT") {
    const ids = Array.from(new Set((input.recipientIds || []).map((id) => id?.trim()).filter(Boolean)));
    if (ids.length !== 1) {
      throw new Error("Validation Error: Exactly one student must be selected for individual notification.");
    }
    // Verify cross-library isolation: student MUST hold confirmed active booking at this library
    const booking = await db.booking.findFirst({
      where: {
        libraryId: input.libraryId,
        studentId: ids[0],
        status: "CONFIRMED",
        endTime: { gte: new Date() },
      },
    });
    if (!booking) {
      throw new Error("Forbidden: Recipient is not an authorized, eligible student of this library.");
    }
    targetRecipientIds = ids;
  } else if (input.audienceMode === "SELECTED_STUDENTS") {
    const rawIds = Array.from(new Set((input.recipientIds || []).map((id) => id?.trim()).filter(Boolean)));
    if (rawIds.length === 0) {
      throw new Error("Validation Error: recipientIds cannot be empty for selected students.");
    }

    // Verify all selected students belong to this library
    const bookings = await db.booking.findMany({
      where: {
        libraryId: input.libraryId,
        studentId: { in: rawIds },
        status: "CONFIRMED",
        endTime: { gte: new Date() },
      },
      select: { studentId: true },
    });
    const authorizedStudentIds = new Set(bookings.map((b: any) => b.studentId));

    const unauthorized = rawIds.filter((id) => !authorizedStudentIds.has(id));
    if (unauthorized.length > 0) {
      throw new Error("Forbidden: One or more selected students do not belong to this library.");
    }
    targetRecipientIds = rawIds;
  } else if (input.audienceMode === "ALL_LIBRARY_STUDENTS") {
    targetRecipientIds = await getAllEligibleLibraryStudents(input.libraryId, db);
  } else if (input.audienceMode === "CURRENTLY_CHECKED_IN") {
    targetRecipientIds = await getCurrentlyCheckedInStudents(input.libraryId, db);
  } else {
    throw new Error(`Validation Error: Unsupported audience mode '${input.audienceMode}'`);
  }

  if (targetRecipientIds.length === 0) {
    throw new Error("Validation Error: No eligible recipients found for this notification.");
  }

  // 5. Payload Hash & Idempotency
  const payloadHash = computeBroadcastPayloadHash({
    title,
    message,
    type,
    actionLabel,
    actionUrl,
    audienceType: input.audienceMode,
    targetLibraryIds: [input.libraryId],
    recipientIds: targetRecipientIds,
  });

  const idempotencyKey = input.idempotencyKey ? input.idempotencyKey.trim() : null;
  if (idempotencyKey) {
    const existing = await db.notificationBroadcast.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.payloadHash && existing.payloadHash !== payloadHash) {
        throw new Error("Conflict: Same idempotency key cannot be reused with a different payload.");
      }
      return {
        broadcast: existing,
        totalTargets: existing.totalTargets,
        sentCount: existing.sentCount,
        failedCount: existing.failedCount,
        isDuplicate: true,
      };
    }
  }

  // 6. Create durable broadcast job
  const scheduledDate = input.scheduledFor ? new Date(input.scheduledFor) : null;
  const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > Date.now());

  // Explicit recipients (INDIVIDUAL_STUDENT, SELECTED_STUDENTS) are saved in manifest
  // Dynamic recipients (CURRENTLY_CHECKED_IN) are left empty to be resolved at dispatch time
  const manifestRecipientIds = (
    input.audienceMode === "INDIVIDUAL_STUDENT" ||
    input.audienceMode === "SELECTED_STUDENTS"
  ) ? targetRecipientIds : [];

  const broadcast = await db.notificationBroadcast.create({
    data: {
      senderId: input.senderId,
      title,
      message,
      type,
      actionLabel,
      actionUrl,
      audienceType: input.audienceMode,
      targetLibraryIds: [input.libraryId],
      idempotencyKey,
      payloadHash,
      totalTargets: targetRecipientIds.length,
      sentCount: 0,
      failedCount: 0,
      status: isScheduled ? "SCHEDULED" : "PROCESSING",
      scheduledFor: isScheduled ? scheduledDate : null,
      manifestRecipientIds: isScheduled ? manifestRecipientIds : targetRecipientIds,
    },
  });

  if (isScheduled) {
    return {
      broadcast,
      totalTargets: targetRecipientIds.length,
      sentCount: 0,
      failedCount: 0,
      isDuplicate: false,
      isScheduled: true,
    };
  }

  // 7. Execute bounded batch fanout
  return executeBroadcastFanout(broadcast, targetRecipientIds, db);
}

/**
 * Resumes an interrupted broadcast job, identifying recipients who have not yet
/**
 * Resumes an interrupted broadcast job, identifying recipients who have not yet
 * received their notification and completing delivery idempotently.
 */
export async function resumeOrRetryBroadcast(
  broadcastId: string,
  callerUserIdOrClient?: string | PrismaClient | Prisma.TransactionClient,
  callerRole?: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<BroadcastResult> {
  let callerUserId: string | undefined;
  let dbClient: PrismaClient | Prisma.TransactionClient | undefined = client;

  if (callerUserIdOrClient && typeof callerUserIdOrClient === "object") {
    dbClient = callerUserIdOrClient as any;
  } else if (typeof callerUserIdOrClient === "string") {
    callerUserId = callerUserIdOrClient;
  }

  const db = getDb(dbClient);

  const broadcast = await db.notificationBroadcast.findUnique({
    where: { id: broadcastId },
  });

  if (!broadcast) {
    throw new Error("Broadcast job not found.");
  }

  // Authorization check if caller details provided
  if (callerRole && callerRole !== "ADMIN") {
    if (callerRole === "LIBRARIAN") {
      if (callerUserId && broadcast.senderId !== callerUserId) {
        // If sender is not caller, verify caller manages one of target libraries
        const targetLibId = broadcast.targetLibraryIds?.[0];
        if (targetLibId) {
          const caller = await db.user.findUnique({
            where: { id: callerUserId },
            select: { employerLibraryId: true },
          });
          const authorized = await db.library.findFirst({
            where: {
              id: targetLibId,
              OR: [
                { librarianId: callerUserId },
                ...(caller?.employerLibraryId ? [{ id: caller.employerLibraryId }] : []),
              ],
            },
          });
          if (!authorized) {
            throw new Error("Forbidden: You do not have authority to retry this broadcast.");
          }
        } else {
          throw new Error("Forbidden: You do not have authority to retry this broadcast.");
        }
      }
    } else {
      throw new Error("Forbidden: Insufficient privileges to retry broadcast.");
    }
  }

  if (broadcast.status === "COMPLETED") {
    return {
      broadcast,
      totalTargets: broadcast.totalTargets,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      isDuplicate: true,
    };
  }

  // Mark as PROCESSING during retry
  await db.notificationBroadcast.update({
    where: { id: broadcast.id },
    data: { status: "PROCESSING" },
  });

  // Find notifications already delivered for this broadcast
  const deliveredNotifs = await db.notification.findMany({
    where: { broadcastId },
    select: { userId: true },
  });
  const deliveredUserIds = new Set(deliveredNotifs.map((n: any) => n.userId));

  // Re-resolve target audience:
  // Critical: If manifestRecipientIds exists (custom selection), PRESERVE it!
  let targetRecipientIds: string[] = [];
  if (broadcast.manifestRecipientIds && broadcast.manifestRecipientIds.length > 0) {
    targetRecipientIds = broadcast.manifestRecipientIds;
  } else if (broadcast.targetLibraryIds && broadcast.targetLibraryIds.length > 0) {
    const libId = broadcast.targetLibraryIds[0];
    if (broadcast.audienceType === "CURRENTLY_CHECKED_IN") {
      targetRecipientIds = await getCurrentlyCheckedInStudents(libId, db);
    } else {
      targetRecipientIds = await getAllEligibleLibraryStudents(libId, db);
    }
  } else {
    targetRecipientIds = await resolveBroadcastAudience(
      {
        audienceType: broadcast.audienceType as any,
        targetLibraryIds: broadcast.targetLibraryIds,
      },
      db
    );
  }

  // Remaining recipients = targets that do not yet have a delivered notification
  const remainingRecipients = targetRecipientIds.filter((id) => !deliveredUserIds.has(id));

  let newlySent = 0;
  let newlyFailed = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < remainingRecipients.length; i += BATCH_SIZE) {
    const batch = remainingRecipients.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (recipientId) => {
        const perRecipientEventId = `bcast_${broadcast.id}_${recipientId}`;
        try {
          await createNotification(
            {
              recipientId,
              title: broadcast.title,
              message: broadcast.message,
              type: broadcast.type,
              actionLabel: broadcast.actionLabel,
              actionUrl: broadcast.actionUrl,
              eventId: perRecipientEventId,
              broadcastId: broadcast.id,
            },
            db
          );
          newlySent++;
        } catch (err: any) {
          if (err?.code === "P2002") {
            newlySent++;
          } else {
            newlyFailed++;
          }
        }
      })
    );
  }

  const totalSent = deliveredUserIds.size + newlySent;
  const totalFailed = newlyFailed;
  const finalStatus =
    totalFailed === 0 ? "COMPLETED" : totalSent === 0 ? "FAILED" : "PARTIALLY_FAILED";

  const updatedBroadcast = await db.notificationBroadcast.update({
    where: { id: broadcast.id },
    data: {
      sentCount: totalSent,
      failedCount: totalFailed,
      status: finalStatus,
    },
  });

  return {
    broadcast: updatedBroadcast,
    totalTargets: broadcast.totalTargets,
    sentCount: totalSent,
    failedCount: totalFailed,
    isDuplicate: false,
  };
}

/**
 * Searches users for the Admin notification composer with server-side pagination and filters.
 */
export async function searchNotificationRecipients(
  options: SearchRecipientsOptions,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{
  users: RecipientSearchResult[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const db = getDb(client);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const whereConditions: any = {};

  if (options.role === "STUDENT") {
    whereConditions.role = "STUDENT";
  } else if (options.role === "LIBRARIAN") {
    whereConditions.role = "LIBRARIAN";
  } else {
    whereConditions.role = { in: ["STUDENT", "LIBRARIAN"] };
  }

  if (options.libraryId) {
    if (options.role === "STUDENT") {
      whereConditions.bookings = {
        some: { libraryId: options.libraryId },
      };
    } else if (options.role === "LIBRARIAN") {
      whereConditions.OR = [
        { libraries: { some: { id: options.libraryId } } },
        { employerLibraryId: options.libraryId },
      ];
    } else {
      whereConditions.AND = [
        {
          OR: [
            { bookings: { some: { libraryId: options.libraryId } } },
            { libraries: { some: { id: options.libraryId } } },
            { employerLibraryId: options.libraryId },
          ],
        },
      ];
    }
  }

  if (options.query && options.query.trim()) {
    const q = options.query.trim();
    const queryFilter = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { uniqueId: { contains: q, mode: "insensitive" } },
      ],
    };
    if (whereConditions.AND) {
      whereConditions.AND.push(queryFilter);
    } else {
      whereConditions.AND = [queryFilter];
    }
  }

  const [users, totalCount] = await Promise.all([
    db.user.findMany({
      where: whereConditions,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        uniqueId: true,
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    db.user.count({ where: whereConditions }),
  ]);

  return {
    users,
    totalCount,
    page,
    limit,
    hasMore: skip + users.length < totalCount,
  };
}

/**
 * Retrieves paginated broadcast history for administrators.
 */
export async function getBroadcastHistory(
  options?: { page?: number; limit?: number },
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{
  broadcasts: any[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const db = getDb(client);
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const [broadcasts, totalCount] = await Promise.all([
    db.notificationBroadcast.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      skip,
      take: limit,
    }),
    db.notificationBroadcast.count(),
  ]);

  return {
    broadcasts,
    totalCount,
    page,
    limit,
    hasMore: skip + broadcasts.length < totalCount,
  };
}

/**
 * Retrieves paginated broadcast history scoped to a specific library.
 */
export async function getLibrarianBroadcastHistory(
  libraryId: string,
  options?: { page?: number; limit?: number },
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{
  broadcasts: any[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const db = getDb(client);
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const whereConditions: any = {
    targetLibraryIds: { has: libraryId },
  };

  const [broadcasts, totalCount] = await Promise.all([
    db.notificationBroadcast.findMany({
      where: whereConditions,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      skip,
      take: limit,
    }),
    db.notificationBroadcast.count({ where: whereConditions }),
  ]);

  return {
    broadcasts,
    totalCount,
    page,
    limit,
    hasMore: skip + broadcasts.length < totalCount,
  };
}

/**
 * Retrieves paginated notifications strictly scoped to the authenticated user.
 */
export async function getUserNotifications(
  userId: string,
  options?: GetNotificationsOptions,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<PaginatedNotifications> {
  if (!userId) {
    throw new Error("Authorization Error: userId is required.");
  }

  const db = getDb(client);
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  // Filter scoped to recipient across legacy studentId or userId
  const recipientFilter: Prisma.NotificationWhereInput = {
    OR: [{ studentId: userId }, { userId: userId }],
  };

  const where: Prisma.NotificationWhereInput = options?.unreadOnly
    ? { ...recipientFilter, isRead: false }
    : recipientFilter;

  const [notifications, totalCount, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.notification.count({ where }),
    db.notification.count({
      where: {
        ...recipientFilter,
        isRead: false,
      },
    }),
  ]);

  return {
    notifications,
    totalCount,
    unreadCount,
    page,
    limit,
    hasMore: skip + notifications.length < totalCount,
  };
}

/**
 * Returns the unread notification count for a specific user.
 */
export async function getUnreadNotificationCount(
  userId: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<number> {
  if (!userId) return 0;

  const db = getDb(client);
  return db.notification.count({
    where: {
      OR: [{ studentId: userId }, { userId: userId }],
      isRead: false,
    },
  });
}

/**
 * Marks a single notification as read, enforcing user ownership.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{ success: boolean; notification?: Notification }> {
  if (!userId || !notificationId) {
    return { success: false };
  }

  const db = getDb(client);

  // Find notification ensuring it belongs to the user
  const notif = await db.notification.findFirst({
    where: {
      id: notificationId,
      OR: [{ studentId: userId }, { userId: userId }],
    },
  });

  if (!notif) {
    return { success: false };
  }

  if (notif.isRead) {
    return { success: true, notification: notif };
  }

  const updated = await db.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { success: true, notification: updated };
}

/**
 * Marks all unread notifications for a user as read.
 */
export async function markAllNotificationsAsRead(
  userId: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{ success: boolean; count: number }> {
  if (!userId) {
    return { success: false, count: 0 };
  }

  const db = getDb(client);
  const now = new Date();
  const result = await db.notification.updateMany({
    where: {
      OR: [{ studentId: userId }, { userId: userId }],
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: now,
    },
  });

  return { success: true, count: result.count };
}

/**
 * Atomically claims due scheduled broadcasts for a worker using leasing semantics.
 * Safe against concurrent workers and recovers expired leases from crashed workers.
 */
export async function claimDueScheduledBroadcasts(
  workerId: string,
  limit: number = 10,
  leaseDurationSeconds: number = 300,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<Array<{ broadcast: any; leaseToken: string }>> {
  const db = getDb(client);
  const now = new Date();
  const leaseExpiryThreshold = new Date(now.getTime() - leaseDurationSeconds * 1000);

  // 1. Find candidate broadcasts that are due and either unleased or lease expired
  // (Both scheduled broadcasts and interrupted immediate broadcasts whose lease or heartbeat expired)
  const candidates = await db.notificationBroadcast.findMany({
    where: {
      isCancelled: false,
      OR: [
        {
          status: "SCHEDULED",
          scheduledFor: { lte: now },
        },
        {
          status: "PROCESSING",
          scheduledFor: { lte: now },
          OR: [
            { claimedAt: null },
            { claimedAt: { lt: leaseExpiryThreshold } },
          ],
        },
        {
          status: "PROCESSING",
          scheduledFor: null,
          updatedAt: { lt: leaseExpiryThreshold },
          OR: [
            { claimedAt: null },
            { claimedAt: { lt: leaseExpiryThreshold } },
          ],
        },
      ],
    },
    take: Math.min(50, Math.max(1, limit)),
    orderBy: { createdAt: "asc" },
  });

  const claimed: Array<{ broadcast: any; leaseToken: string }> = [];

  // 2. Atomically attempt to lease each candidate
  for (const candidate of candidates) {
    const leaseToken = `lease_${workerId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const result = await db.notificationBroadcast.updateMany({
      where: {
        id: candidate.id,
        isCancelled: false,
        OR: [
          { status: "SCHEDULED" },
          {
            status: "PROCESSING",
            OR: [
              { claimedAt: null },
              { claimedAt: { lt: leaseExpiryThreshold } },
            ],
          },
        ],
      },
      data: {
        status: "PROCESSING",
        claimedAt: now,
        claimedBy: workerId,
        leaseToken,
      },
    });

    if (result.count === 1) {
      claimed.push({
        broadcast: { ...candidate, status: "PROCESSING", claimedAt: now, claimedBy: workerId, leaseToken },
        leaseToken,
      });
    }
  }

  return claimed;
}

/**
 * Dispatches a single claimed scheduled broadcast.
 * Enforces sender authority, audience consistency, and bounded-batch fanout.
 */
export async function dispatchScheduledBroadcast(
  broadcastId: string,
  workerId: string,
  leaseToken?: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<BroadcastResult> {
  const db = getDb(client);

  const broadcast = await db.notificationBroadcast.findUnique({
    where: { id: broadcastId },
  });

  if (!broadcast) {
    throw new Error(`Broadcast not found: ${broadcastId}`);
  }

  // Guard: lease token check if provided
  if (leaseToken && broadcast.leaseToken !== leaseToken) {
    throw new Error(`Lease fence violation: Broadcast ${broadcastId} is leased to another worker or lease expired.`);
  }

  // Guard: cancelled broadcasts must never send
  if (broadcast.isCancelled || broadcast.status === "CANCELLED") {
    return {
      broadcast,
      totalTargets: 0,
      sentCount: 0,
      failedCount: 0,
      isDuplicate: true,
    };
  }

  // Guard: verify sender authority at execution time
  const sender = await db.user.findUnique({
    where: { id: broadcast.senderId },
  });

  if (!sender) {
    await db.notificationBroadcast.update({
      where: { id: broadcast.id },
      data: {
        status: "FAILED",
        errorMessage: "Sender account no longer exists.",
        claimedAt: null,
        claimedBy: null,
        leaseToken: null,
      },
    });
    throw new Error("Unauthorized: Sender account no longer exists at execution time.");
  }

  // If librarian-scoped broadcast, recheck authority over target library
  if (sender.role === "LIBRARIAN") {
    const targetLibraryId = broadcast.targetLibraryIds?.[0];
    if (targetLibraryId) {
      const authorized = await db.library.findFirst({
        where: {
          id: targetLibraryId,
          OR: [
            { librarianId: sender.id },
            ...(sender.employerLibraryId ? [{ id: sender.employerLibraryId }] : []),
          ],
        },
      });
      if (!authorized) {
        await db.notificationBroadcast.update({
          where: { id: broadcast.id },
          data: {
            status: "FAILED",
            errorMessage: "Sender no longer has authority over target library.",
            claimedAt: null,
            claimedBy: null,
            leaseToken: null,
          },
        });
        throw new Error("Forbidden: Sender no longer has authority over target library at execution time.");
      }
    }
  }

  // Audience Consistency Policy:
  // If manifestRecipientIds already materialized (e.g., partial recovery / retry), DO NOT alter audience!
  let recipientIds: string[] = broadcast.manifestRecipientIds || [];

  if (recipientIds.length === 0) {
    // Dynamic or first-time resolution
    if (broadcast.audienceType === "CURRENTLY_CHECKED_IN") {
      const targetLibId = broadcast.targetLibraryIds?.[0];
      if (targetLibId) {
        recipientIds = await getCurrentlyCheckedInStudents(targetLibId, db);
      }
    } else if (broadcast.audienceType === "LIBRARY_STUDENTS" || broadcast.audienceType === "ALL_LIBRARY_STUDENTS") {
      const targetLibId = broadcast.targetLibraryIds?.[0];
      if (targetLibId) {
        recipientIds = await getAllEligibleLibraryStudents(targetLibId, db);
      }
    } else if (broadcast.audienceType === "INDIVIDUAL_STUDENT" || broadcast.audienceType === "SELECTED_STUDENTS") {
      recipientIds = broadcast.manifestRecipientIds || [];
    } else {
      recipientIds = await resolveBroadcastAudience(
        {
          audienceType: broadcast.audienceType as BroadcastAudienceType,
          targetLibraryIds: broadcast.targetLibraryIds,
        },
        db
      );
    }

    // Materialize durable manifest before fanout begins
    await db.notificationBroadcast.update({
      where: { id: broadcast.id },
      data: {
        manifestRecipientIds: recipientIds,
        totalTargets: recipientIds.length,
      },
    });
  }

  if (recipientIds.length === 0) {
    const updated = await db.notificationBroadcast.update({
      where: { id: broadcast.id },
      data: {
        status: "COMPLETED",
        totalTargets: 0,
        sentCount: 0,
        failedCount: 0,
        claimedAt: null,
        claimedBy: null,
        leaseToken: null,
      },
    });
    return {
      broadcast: updated,
      totalTargets: 0,
      sentCount: 0,
      failedCount: 0,
      isDuplicate: false,
    };
  }

  // Execute fanout across durable manifest in bounded batches
  const fanoutResult = await executeBroadcastFanout(broadcast, recipientIds, db);

  // Clear lease upon completion
  await db.notificationBroadcast.update({
    where: { id: broadcast.id },
    data: {
      claimedAt: null,
      claimedBy: null,
      leaseToken: null,
    },
  });

  return fanoutResult;
}

/**
 * Cancels a scheduled broadcast before dispatch.
 */
export async function cancelScheduledBroadcast(
  broadcastId: string,
  userId: string,
  userRole: string,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<NotificationBroadcast> {
  const db = getDb(client);

  const broadcast = await db.notificationBroadcast.findUnique({
    where: { id: broadcastId },
  });

  if (!broadcast) {
    throw new Error("Broadcast not found.");
  }

  if (broadcast.senderId !== userId && userRole !== "ADMIN") {
    throw new Error("Forbidden: You cannot cancel another user's broadcast.");
  }

  if (broadcast.status === "COMPLETED") {
    throw new Error("Conflict: Cannot cancel a broadcast that has already completed.");
  }

  const updated = await db.notificationBroadcast.update({
    where: { id: broadcastId },
    data: {
      isCancelled: true,
      status: "CANCELLED",
      claimedAt: null,
      claimedBy: null,
      leaseToken: null,
    },
  });

  return updated;
}

/**
 * Worker runner: claims due scheduled broadcasts and dispatches each within lease guards.
 */
export async function processDueScheduledBroadcasts(
  workerId: string,
  limit: number = 10,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const claimed = await claimDueScheduledBroadcasts(workerId, limit, 300, client);
  let succeeded = 0;
  let failed = 0;

  for (const item of claimed) {
    try {
      await dispatchScheduledBroadcast(item.broadcast.id, workerId, item.leaseToken, client);
      succeeded++;
    } catch (err) {
      console.error(`[ScheduledBroadcastWorker] Failed to dispatch ${item.broadcast.id}:`, err);
      failed++;
    }
  }

  return {
    processed: claimed.length,
    succeeded,
    failed,
  };
}

// ---------------------------------------------------------------------------
// WEB PUSH SUBSCRIPTION & DELIVERY INFRASTRUCTURE (STEP 6)
// ---------------------------------------------------------------------------

/**
 * Registers or updates a browser Web Push subscription for an authenticated user.
 */
export async function registerPushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  },
  client?: PrismaClient | Prisma.TransactionClient
) {
  if (!userId) {
    throw new Error("Unauthorized: userId is required to register push subscription");
  }
  if (!subscription.endpoint || !subscription.endpoint.startsWith("http")) {
    throw new Error("Invalid push subscription endpoint URL");
  }
  if (!subscription.p256dh || !subscription.auth) {
    throw new Error("Invalid cryptographic keys: p256dh and auth are required");
  }

  const db = getDb(client);

  const existing = await (db as any).pushSubscription.findUnique({
    where: { endpoint: subscription.endpoint },
  });

  if (existing) {
    return (db as any).pushSubscription.update({
      where: { endpoint: subscription.endpoint },
      data: {
        userId,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: subscription.userAgent || existing.userAgent,
        isActive: true,
        failureCount: 0,
        lastFailureAt: null,
      },
    });
  }

  return (db as any).pushSubscription.create({
    data: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: subscription.userAgent,
      isActive: true,
      failureCount: 0,
    },
  });
}

/**
 * Removes or deactivates a browser Web Push subscription.
 * Strictly verifies ownership by matching userId and endpoint.
 */
export async function removePushSubscription(
  userId: string,
  endpoint: string,
  client?: PrismaClient | Prisma.TransactionClient
) {
  if (!userId || !endpoint) {
    throw new Error("userId and endpoint are required");
  }

  const db = getDb(client);

  const sub = await (db as any).pushSubscription.findUnique({
    where: { endpoint },
  });

  if (!sub) {
    return { success: true, count: 0 };
  }

  if (sub.userId !== userId) {
    throw new Error("Forbidden: Cannot remove subscription belonging to another user");
  }

  const updated = await (db as any).pushSubscription.update({
    where: { endpoint },
    data: {
      isActive: false,
    },
  });

  return { success: true, subscription: updated };
}

/**
 * Updates user-level push notification preference (opt-in or opt-out).
 */
export async function updateUserPushPreference(
  userId: string,
  enabled: boolean,
  client?: PrismaClient | Prisma.TransactionClient
) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const db = getDb(client);
  return db.user.update({
    where: { id: userId },
    data: {
      browserPushEnabled: enabled,
    },
  });
}

/**
 * Retrieves push notification status and active device subscription count for a user.
 */
export async function getUserPushSubscriptionStatus(
  userId: string,
  client?: PrismaClient | Prisma.TransactionClient
) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const db = getDb(client);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { browserPushEnabled: true },
  });

  const activeCount = await (db as any).pushSubscription.count({
    where: {
      userId,
      isActive: true,
    },
  });

  return {
    browserPushEnabled: user?.browserPushEnabled !== false,
    activeSubscriptionsCount: activeCount,
  };
}

/**
 * Claims due push delivery tasks using atomic lease semantics.
 */
export async function claimDuePushDeliveries(
  workerId: string,
  limit: number = 50,
  leaseDurationSeconds: number = 300,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const db = getDb(client);
  const now = new Date();
  const leaseExpiryThreshold = new Date(now.getTime() - leaseDurationSeconds * 1000);

  // 1. Find candidates due for delivery that are unleased or have expired lease
  const candidates = await (db as any).pushDeliveryQueue.findMany({
    where: {
      status: "PENDING",
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { claimedAt: null },
            { claimedAt: { lt: leaseExpiryThreshold } },
          ],
        },
      ],
    },
    take: Math.min(100, Math.max(1, limit)),
    orderBy: { createdAt: "asc" },
  });

  const claimed: any[] = [];

  for (const candidate of candidates) {
    const leaseToken = `push_lease_${workerId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const res = await (db as any).pushDeliveryQueue.updateMany({
      where: {
        id: candidate.id,
        status: "PENDING",
        OR: [
          { claimedAt: null },
          { claimedAt: { lt: leaseExpiryThreshold } },
        ],
      },
      data: {
        status: "PROCESSING",
        claimedAt: now,
        claimedBy: workerId,
        leaseToken,
      },
    });

    if (res.count === 1) {
      claimed.push({
        ...candidate,
        status: "PROCESSING",
        claimedAt: now,
        claimedBy: workerId,
        leaseToken,
      });
    }
  }

  return claimed;
}

/**
 * Processes a batch of due push delivery jobs.
 * Handles rate limits, exponential backoff, and deactivates permanently failed (404/410) subscriptions.
 */
export async function processDuePushDeliveries(
  workerId: string,
  limit: number = 50,
  client?: PrismaClient | Prisma.TransactionClient
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  deactivated: number;
}> {
  const db = getDb(client);
  const claimedJobs = await claimDuePushDeliveries(workerId, limit, 300, db);

  let succeeded = 0;
  let failed = 0;
  let deactivated = 0;

  for (const job of claimedJobs) {
    try {
      const result = await sendWebPushNotification(
        {
          endpoint: job.endpoint,
          p256dh: job.p256dh,
          auth: job.auth,
        },
        job.payload as any
      );

      if (result.success) {
        // Success: mark delivery SENT and update subscription lastSuccessAt
        await (db as any).pushDeliveryQueue.update({
          where: { id: job.id },
          data: {
            status: "SENT",
            claimedAt: null,
            claimedBy: null,
            leaseToken: null,
          },
        });

        if (job.subscriptionId) {
          await (db as any).pushSubscription.updateMany({
            where: { id: job.subscriptionId },
            data: {
              lastSuccessAt: new Date(),
              failureCount: 0,
            },
          });
        }
        succeeded++;
      } else if (result.isPermanent) {
        // Permanent failure (404/410 Gone): mark PERMANENT_FAILURE and deactivate subscription
        await (db as any).pushDeliveryQueue.update({
          where: { id: job.id },
          data: {
            status: "PERMANENT_FAILURE",
            lastError: result.error || "Subscription expired or revoked",
            claimedAt: null,
            claimedBy: null,
            leaseToken: null,
          },
        });

        await (db as any).pushSubscription.updateMany({
          where: { endpoint: job.endpoint },
          data: {
            isActive: false,
            lastFailureAt: new Date(),
            failureCount: { increment: 1 },
          },
        });

        deactivated++;
        failed++;
      } else {
        // Transient failure: retry with exponential backoff
        const nextAttempts = (job.attempts || 0) + 1;
        const maxAttempts = job.maxAttempts || 5;

        if (nextAttempts >= maxAttempts) {
          await (db as any).pushDeliveryQueue.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              attempts: nextAttempts,
              lastError: result.error || "Exceeded max delivery attempts",
              claimedAt: null,
              claimedBy: null,
              leaseToken: null,
            },
          });
        } else {
          // Exponential backoff: 2^(attempts) * 60 seconds (up to 1 hour max)
          const backoffSeconds = Math.min(3600, Math.pow(2, nextAttempts) * 60);
          const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

          await (db as any).pushDeliveryQueue.update({
            where: { id: job.id },
            data: {
              status: "PENDING",
              attempts: nextAttempts,
              nextAttemptAt,
              lastError: result.error || "Transient push failure",
              claimedAt: null,
              claimedBy: null,
              leaseToken: null,
            },
          });
        }
        failed++;
      }
    } catch (err: any) {
      console.warn(`[WebPushWorker] Unexpected error on delivery ${job.id}:`, err);
      await (db as any).pushDeliveryQueue.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          attempts: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + 120000), // Retry in 2 mins
          lastError: err.message || "Unexpected exception",
          claimedAt: null,
          claimedBy: null,
          leaseToken: null,
        },
      });
      failed++;
    }
  }

  return {
    processed: claimedJobs.length,
    succeeded,
    failed,
    deactivated,
  };
}

/**
 * Attempts immediate non-blocking delivery for all pending push tasks of a given notification.
 */
export async function dispatchPendingPushForNotification(
  notificationId: string,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const db = getDb(client);

  if (!db || typeof (db as any).pushDeliveryQueue?.findMany !== "function") {
    return;
  }

  const pendingJobs = await (db as any).pushDeliveryQueue.findMany({
    where: {
      notificationId,
      status: "PENDING",
    },
  });

  if (!pendingJobs || pendingJobs.length === 0) return;

  for (const job of pendingJobs) {
    try {
      const result = await sendWebPushNotification(
        {
          endpoint: job.endpoint,
          p256dh: job.p256dh,
          auth: job.auth,
        },
        job.payload as any
      );

      if (result.success) {
        await (db as any).pushDeliveryQueue.update({
          where: { id: job.id },
          data: { status: "SENT" },
        });
        if (job.subscriptionId) {
          await (db as any).pushSubscription.updateMany({
            where: { id: job.subscriptionId },
            data: { lastSuccessAt: new Date(), failureCount: 0 },
          });
        }
      } else if (result.isPermanent) {
        await (db as any).pushDeliveryQueue.update({
          where: { id: job.id },
          data: {
            status: "PERMANENT_FAILURE",
            lastError: result.error,
          },
        });
        await (db as any).pushSubscription.updateMany({
          where: { endpoint: job.endpoint },
          data: {
            isActive: false,
            lastFailureAt: new Date(),
          },
        });
      }
    } catch {
      // Leave as PENDING for cron worker to retry
    }
  }
}

