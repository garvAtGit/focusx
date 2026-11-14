"use server";

import prisma from "@/lib/prisma";
import { getSession } from "./auth-actions";
import { getActiveLibrary } from "@/lib/dashboard-utils";

export interface ActivityHistoryItem {
  id: string;
  libraryId: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  studentId: string | null;
  studentName: string | null;
  actionType: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export async function getLibraryActivityHistory(params: {
  page?: number;
  limit?: number;
  actionFilter?: string;
  search?: string;
  libraryId?: string;
}): Promise<{
  activities: ActivityHistoryItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { activities: [], totalCount: 0, page: 1, totalPages: 0, error: "Unauthorized" };
  }

  // Resolve target library reliably using session context and active library cookies
  let targetLibraryId: string | null | undefined = params.libraryId;
  if (!targetLibraryId) {
    const activeLib = await getActiveLibrary(session);
    targetLibraryId = activeLib?.id || null;
  }

  if (!targetLibraryId) {
    // Fallback: pick first library in system for admin testing
    const anyLib = await prisma.library.findFirst({ select: { id: true } });
    targetLibraryId = anyLib?.id || null;
  }

  if (!targetLibraryId) {
    return { activities: [], totalCount: 0, page: 1, totalPages: 0, error: "No library found" };
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const whereClause: any = {
    libraryId: targetLibraryId,
  };

  if (params.actionFilter && params.actionFilter !== "ALL") {
    whereClause.actionType = params.actionFilter;
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    whereClause.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { studentName: { contains: q, mode: "insensitive" } },
      { actorName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [totalCount, rows] = await Promise.all([
    prisma.libraryActivityLog.count({ where: whereClause }),
    prisma.libraryActivityLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    activities: rows.map((r) => ({
      id: r.id,
      libraryId: r.libraryId,
      actorId: r.actorId,
      actorName: r.actorName || "Staff Member",
      actorRole: r.actorRole || "LIBRARIAN",
      studentId: r.studentId,
      studentName: r.studentName,
      actionType: r.actionType,
      description: r.description,
      metadata: (r.metadata as Record<string, unknown>) || null,
      createdAt: r.createdAt,
    })),
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
}
