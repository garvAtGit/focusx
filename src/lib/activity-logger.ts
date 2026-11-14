import prisma from "@/lib/prisma";
import { generateUUIDv7 } from "@/lib/id-generator";

export interface LogActivityParams {
  libraryId: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  actionType:
    | "STUDENT_ADDED"
    | "PLAN_CHANGED"
    | "SEAT_CHANGED"
    | "MEMBERSHIP_PAUSED"
    | "MEMBERSHIP_RESUMED"
    | "RFID_ASSIGNED"
    | "DUES_COLLECTED"
    | "BOOKING_REVOKED"
    | "RENEWAL_COMPLETED";
  description: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Super Simple, Human-Readable Activity Logger
 * Records librarian and receptionist staff actions in plain everyday language.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const id = generateUUIDv7();
    await prisma.libraryActivityLog.create({
      data: {
        id,
        libraryId: params.libraryId,
        actorId: params.actorId ?? null,
        actorName: params.actorName ?? "Staff Member",
        actorRole: params.actorRole ?? "LIBRARIAN",
        studentId: params.studentId ?? null,
        studentName: params.studentName ?? null,
        actionType: params.actionType,
        description: params.description,
        metadata: (params.metadata ?? {}) as any,
      },
    });
  } catch (error) {
    // Non-blocking logging failure to guarantee core transactions never abort
    console.warn("[logActivity] Failed to record activity log:", error);
  }
}
