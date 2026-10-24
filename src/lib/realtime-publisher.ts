import prisma from "@/lib/prisma";
import { publishMqttMessage } from "@/lib/hardware-sync";

export interface OutboxRecord {
  id: string;
  eventId: string;
  topic: string | null;
  type: string;
  payload: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  checkinLogId: string | null;
  studentId: string | null;
  isPublished: boolean;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  leaseToken: string | null;
  lastError: string | null;
}

/**
 * Sanitizes error messages before persisting to database to prevent
 * leaking secrets, JWTs, service role keys, or connection credentials.
 */
export function sanitizeError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  // Redact Supabase/JWT tokens
  msg = msg.replace(/ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]");
  // Redact Bearer tokens
  msg = msg.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  // Redact api keys
  msg = msg.replace(/apikey['":\s]+[A-Za-z0-9._-]+/gi, "apikey: [REDACTED]");
  // Redact database credentials
  msg = msg.replace(/postgres(?:ql)?:\/\/[^@]+@/gi, "postgresql://[REDACTED_USER_PASS]@");
  return msg.substring(0, 500);
}

/**
 * Atomically claims a batch of pending or expired-lease outbox records
 * using PostgreSQL's FOR UPDATE SKIP LOCKED with unique lease-generation tokens
 * to prevent race conditions across concurrent or restarted worker instances.
 */
export async function claimOutboxBatch(
  batchSize: number = 50,
  workerId: string = `worker-${process.pid}-${Date.now()}`,
  leaseDurationSeconds: number = 60
): Promise<OutboxRecord[]> {
  const claimed = await prisma.$queryRaw<OutboxRecord[]>`
    UPDATE "RealtimeOutbox"
    SET "status" = 'PROCESSING',
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "leaseToken" = gen_random_uuid()::text
    WHERE id IN (
      SELECT id FROM "RealtimeOutbox"
      WHERE "status" IN ('PENDING', 'PROCESSING')
        AND "isPublished" = false
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
        AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - (${leaseDurationSeconds} * INTERVAL '1 second'))
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;
  return claimed;
}

/**
 * Delivers a single outbox record with guaranteed delivery semantics:
 * - Realtime notifications to Supabase REST Broadcast
 * - Hardware revision notifications to MQTT Broker
 * - Bounded exponential backoff with jitter on transient failures
 * - Terminal transition to DEAD_LETTER on exceeding max attempts
 * - Fencing token guard conditional on exact leaseToken to reject stale writes
 */
export async function processOutboxItem(
  outbox: OutboxRecord | any, 
  workerId?: string,
  leaseToken?: string
): Promise<boolean> {
  if (!outbox || outbox.isPublished) return true;

  const targetLeaseToken = leaseToken || outbox.leaseToken;
  const currentWorker = workerId || outbox.lockedBy;

  try {
    // 1. MQTT Hardware Revision Route
    if (outbox.type === "MQTT_SYNC" || (outbox.topic && outbox.topic.startsWith("library/"))) {
      if (outbox.topic) {
        await publishMqttMessage(outbox.topic, outbox.payload);
      }
    } 
    // 2. Realtime Mobile/Librarian Broadcast Route
    else {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase credentials not configured in environment");
      }

      const headers = {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json'
      };

      // 2a. Student Broadcast (if studentId is attached)
      if (outbox.studentId) {
        const studentTopic = `scan:${encodeURIComponent(outbox.studentId)}`;
        const studentEvent = encodeURIComponent('scan_result');
        const studentUrl = `${supabaseUrl}/realtime/v1/api/broadcast/${studentTopic}/events/${studentEvent}`;

        const studentRes = await fetch(studentUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(outbox.payload)
        });

        if (!studentRes.ok) {
          const errBody = await studentRes.text().catch(() => "");
          throw new Error(`Supabase REST Error (Student status ${studentRes.status}): ${errBody}`);
        }
      }

      // 2b. Librarian Broadcast (if checkinLogId is attached)
      if (outbox.checkinLogId) {
        const checkinLog = await prisma.checkinLog.findUnique({
          where: { id: outbox.checkinLogId },
          select: { libraryId: true, status: true, timestamp: true }
        });

        if (checkinLog) {
          const libTopic = `library_scans:${encodeURIComponent(checkinLog.libraryId)}`;
          const libEvent = encodeURIComponent('scanner_update');
          const libUrl = `${supabaseUrl}/realtime/v1/api/broadcast/${libTopic}/events/${libEvent}`;

          const libPayload = {
            status: checkinLog.status,
            eventId: outbox.eventId,
            timestamp: checkinLog.timestamp.toISOString(),
            doorId: (outbox.payload as any)?.doorId
          };

          const libRes = await fetch(libUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(libPayload)
          });

          if (!libRes.ok) {
            console.error('[Realtime Publisher] Librarian notification non-critical error:', await libRes.text().catch(() => ""));
          }
        }
      }
    }

    // Mark as published successfully with exact leaseToken fencing guard
    const whereSuccess: any = { id: outbox.id };
    if (targetLeaseToken) {
      whereSuccess.leaseToken = targetLeaseToken;
    } else {
      // Unfenced callers must never mutate rows leased to a tokenized worker
      whereSuccess.leaseToken = null;
      if (currentWorker) {
        whereSuccess.OR = [
          { lockedBy: currentWorker },
          { lockedBy: null }
        ];
      }
    }

    const updateRes = await prisma.realtimeOutbox.updateMany({
      where: whereSuccess,
      data: {
        status: "PUBLISHED",
        isPublished: true,
        attempts: { increment: 1 },
        lockedAt: null,
        lockedBy: null,
        leaseToken: null,
        lastError: null
      }
    });

    if (updateRes.count === 0 && (targetLeaseToken || currentWorker)) {
      console.warn(`[Outbox Lease Fenced] Stale worker ${currentWorker} (leaseToken ${targetLeaseToken}) completed event ${outbox.eventId}, but lease was already claimed by another worker. State mutation prevented.`);
      return false;
    }

    return true;

  } catch (error: any) {
    const attempts = (outbox.attempts || 0) + 1;
    const maxAttempts = outbox.maxAttempts || 5;
    const cleanError = sanitizeError(error);

    const whereError: any = { id: outbox.id };
    if (targetLeaseToken) {
      whereError.leaseToken = targetLeaseToken;
    } else {
      // Unfenced callers must never mutate rows leased to a tokenized worker
      whereError.leaseToken = null;
      if (currentWorker) {
        whereError.OR = [
          { lockedBy: currentWorker },
          { lockedBy: null }
        ];
      }
    }

    if (attempts >= maxAttempts) {
      console.error(`[Realtime Publisher DLQ] Event ${outbox.eventId} exceeded ${maxAttempts} attempts. Moving to DEAD_LETTER:`, cleanError);
      await prisma.realtimeOutbox.updateMany({
        where: whereError,
        data: {
          status: "DEAD_LETTER",
          attempts,
          lockedAt: null,
          lockedBy: null,
          leaseToken: null,
          lastError: cleanError
        }
      });
    } else {
      // Exponential backoff: 2s, 4s, 8s, 16s... + jitter, capped at 300s (5 min)
      const baseDelayMs = 1000 * Math.pow(2, attempts);
      const jitterMs = Math.floor(Math.random() * 1000);
      const delayMs = Math.min(baseDelayMs, 300000) + jitterMs;
      const nextAttemptAt = new Date(Date.now() + delayMs);

      console.warn(`[Realtime Publisher Retry] Event ${outbox.eventId} failed attempt ${attempts}/${maxAttempts}. Next attempt in ${delayMs}ms:`, cleanError);

      await prisma.realtimeOutbox.updateMany({
        where: whereError,
        data: {
          status: "PENDING",
          attempts,
          lockedAt: null,
          lockedBy: null,
          leaseToken: null,
          nextAttemptAt,
          lastError: cleanError
        }
      });
    }

    return false;
  }
}

/**
 * Legacy entry point for single event outbox publish
 */
export async function publishOutbox(eventId: string): Promise<boolean> {
  const outbox = await prisma.realtimeOutbox.findUnique({ where: { eventId } });
  if (!outbox || outbox.isPublished) return true;
  return processOutboxItem(outbox);
}

/**
 * Admin utility to retrieve dead-letter queue items for operational review
 */
export async function getDeadLetterItems(limit: number = 50) {
  return prisma.realtimeOutbox.findMany({
    where: { status: "DEAD_LETTER" },
    orderBy: { updatedAt: "desc" },
    take: limit
  });
}

/**
 * Admin utility to safely replay a dead-letter item back into PENDING state
 */
export async function replayDeadLetterItem(eventIdOrId: string): Promise<boolean> {
  const result = await prisma.realtimeOutbox.updateMany({
    where: {
      OR: [{ id: eventIdOrId }, { eventId: eventIdOrId }],
      status: "DEAD_LETTER"
    },
    data: {
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null
    }
  });
  return result.count > 0;
}
