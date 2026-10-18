import prisma from "@/lib/prisma";
import { StudentsClient } from "./StudentsClient";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { formatStandardDate } from "@/lib/date-utils";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import {
  getCachedStudentCounts,
  getCachedStudentPage,
  getCachedStudentMetadata,
  type TabCounts,
  type StudentMetadata,
} from "@/lib/student-cache";

function buildTabPredicate(tab: string, now: Date, sevenDaysFromNow: Date, libraryId: string) {
  switch (tab) {
    case "PAUSED":
      return Prisma.sql`b."status" = 'CONFIRMED' AND b."isPaused" = true`;
    case "DUES":
      return Prisma.sql`b."status" = 'CONFIRMED' AND b."amountDuePaise" > 0`;
    case "EXPIRING":
      return Prisma.sql`b."status" = 'CONFIRMED' AND b."endTime" >= ${now} AND b."endTime" <= ${sevenDaysFromNow} AND b."isPaused" = false`;
    case "INACTIVE":
      return Prisma.sql`b."status" <> 'CANCELLED' AND b."endTime" < ${now} AND (u."isExpiredLead" IS NULL OR u."isExpiredLead" = false) AND NOT EXISTS (
        SELECT 1 FROM "Booking" b2 
        WHERE b2."studentId" = b."studentId" AND b2."status" = 'CONFIRMED' AND b2."endTime" >= ${now} AND b2."libraryId" = ${libraryId}
      ) AND (
        SELECT b3."status" FROM "Booking" b3 WHERE b3."studentId" = b."studentId" AND b3."libraryId" = ${libraryId} ORDER BY b3."createdAt" DESC LIMIT 1
      ) <> 'CANCELLED'`;
    case "EXPIRED":
      return Prisma.sql`b."status" <> 'CANCELLED' AND b."endTime" < ${now} AND u."isExpiredLead" = true AND NOT EXISTS (
        SELECT 1 FROM "Booking" b2 
        WHERE b2."studentId" = b."studentId" AND b2."status" = 'CONFIRMED' AND b2."endTime" >= ${now} AND b2."libraryId" = ${libraryId}
      ) AND (
        SELECT b3."status" FROM "Booking" b3 WHERE b3."studentId" = b."studentId" AND b3."libraryId" = ${libraryId} ORDER BY b3."createdAt" DESC LIMIT 1
      ) <> 'CANCELLED'`;
    case "REVOKED":
      return Prisma.sql`b."status" = 'CANCELLED' AND NOT EXISTS (
        SELECT 1 FROM "Booking" b2 
        WHERE b2."studentId" = b."studentId" AND b2."status" = 'CONFIRMED' AND b2."endTime" >= ${now} AND b2."libraryId" = ${libraryId}
      ) AND (
        SELECT b3."status" FROM "Booking" b3 WHERE b3."studentId" = b."studentId" AND b3."libraryId" = ${libraryId} ORDER BY b3."createdAt" DESC LIMIT 1
      ) = 'CANCELLED'`;
    case "ACTIVE":
    default:
      return Prisma.sql`b."status" = 'CONFIRMED' AND b."endTime" >= ${now} AND b."isPaused" = false`;
  }
}

async function fetchStudentCounts(
  libraryId: string,
  now: Date,
  sevenDaysFromNow: Date,
  query: string = ""
): Promise<TabCounts> {
  const searchPredicate = query
    ? Prisma.sql`AND (
        u."name" ILIKE ${`%${query}%`}
        OR u."phone" ILIKE ${`%${query}%`}
        OR u."uniqueId" ILIKE ${`%${query}%`}
      )`
    : Prisma.empty;

  const countRows = await prisma.$queryRaw<Array<TabCounts>>(Prisma.sql`
    WITH StudentStates AS (
      SELECT 
        b."studentId",
        BOOL_OR(b."status" = 'CONFIRMED' AND b."endTime" >= ${now} AND b."isPaused" = false) AS has_active,
        BOOL_OR(b."status" = 'CONFIRMED' AND b."isPaused" = true) AS has_paused,
        BOOL_OR(b."status" = 'CONFIRMED' AND b."amountDuePaise" > 0) AS has_dues,
        BOOL_OR(b."status" = 'CONFIRMED' AND b."endTime" >= ${now} AND b."endTime" <= ${sevenDaysFromNow} AND b."isPaused" = false) AS has_expiring,
        (
          SELECT b2."status"
          FROM "Booking" b2
          WHERE b2."studentId" = b."studentId" AND b2."libraryId" = ${libraryId}
          ORDER BY b2."createdAt" DESC
          LIMIT 1
        ) AS latest_status,
        BOOL_OR(u."isExpiredLead" = true) AS is_expired_lead
      FROM "Booking" b
      INNER JOIN "User" u ON u."id" = b."studentId"
      WHERE b."libraryId" = ${libraryId}
      ${searchPredicate}
      GROUP BY b."studentId"
    )
    SELECT 
      COUNT(*) FILTER (WHERE has_active)::int AS "active",
      COUNT(*) FILTER (WHERE has_paused)::int AS "paused",
      COUNT(*) FILTER (WHERE has_dues)::int AS "dues",
      COUNT(*) FILTER (WHERE has_expiring)::int AS "expiring",
      COUNT(*) FILTER (WHERE NOT has_active AND NOT has_paused AND latest_status <> 'CANCELLED' AND NOT is_expired_lead)::int AS "inactive",
      COUNT(*) FILTER (WHERE NOT has_active AND NOT has_paused AND latest_status <> 'CANCELLED' AND is_expired_lead)::int AS "expired",
      COUNT(*) FILTER (WHERE NOT has_active AND NOT has_paused AND latest_status = 'CANCELLED')::int AS "revoked"
    FROM StudentStates
  `);

  return (
    countRows[0] ?? {
      active: 0,
      paused: 0,
      dues: 0,
      expiring: 0,
      inactive: 0,
      expired: 0,
      revoked: 0,
    }
  );
}

async function fetchStudentBookings(
  libraryId: string,
  tab: string,
  page: number,
  pageSize: number,
  query: string,
  now: Date,
  sevenDaysFromNow: Date
) {
  const tabPredicate = buildTabPredicate(tab, now, sevenDaysFromNow, libraryId);
  const searchPredicate = query
    ? Prisma.sql`AND (
        u."name" ILIKE ${`%${query}%`}
        OR u."phone" ILIKE ${`%${query}%`}
        OR u."uniqueId" ILIKE ${`%${query}%`}
      )`
    : Prisma.empty;

  const pagedIds = await prisma.$queryRaw<Array<{ id: string; createdAt: Date }>>(Prisma.sql`
    SELECT candidate."id", candidate."createdAt"
    FROM (
      SELECT DISTINCT ON (b."studentId")
        b."id",
        b."createdAt",
        b."studentId"
      FROM "Booking" b
      INNER JOIN "User" u ON u."id" = b."studentId"
      WHERE b."libraryId" = ${libraryId}
        AND ${tabPredicate}
        ${searchPredicate}
      ORDER BY b."studentId", b."createdAt" DESC
    ) candidate
    ORDER BY candidate."createdAt" DESC
    LIMIT ${pageSize}
    OFFSET ${(page - 1) * pageSize}
  `);

  const bookingIds = pagedIds.map(({ id }) => id);
  const unorderedBookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: {
      student: {
        include: {
          bookings: {
            include: {
              plan: true,
              seat: true,
              standaloneLocker: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      plan: true,
      seat: true,
      standaloneLocker: true,
    },
  });

  const bookingOrder = new Map(bookingIds.map((id, index) => [id, index]));
  return unorderedBookings.sort(
    (a, b) => (bookingOrder.get(a.id) ?? 0) - (bookingOrder.get(b.id) ?? 0)
  );
}

async function fetchStudentMetadata(libraryId: string): Promise<StudentMetadata> {
  const [plans, seats, standaloneLockers, relays, activeBookings, activeLeases] =
    await Promise.all([
      prisma.plan.findMany({
        where: { libraryId, isActive: true },
      }),
      prisma.seat.findMany({
        where: { libraryId },
        orderBy: { name: "asc" },
      }),
      prisma.standaloneLocker.findMany({
        where: { libraryId },
      }),
      prisma.relay.findMany({
        where: { libraryId },
      }),
      prisma.booking.findMany({
        where: {
          libraryId,
          status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
          endTime: { gt: new Date() },
        },
        select: { standaloneLockerId: true, seatId: true },
      }),
      prisma.resourceLease.findMany({
        where: {
          libraryId,
          resourceType: "STANDALONE_LOCKER",
          expiresAt: { gt: new Date() },
        },
        select: { resourceId: true },
      }),
    ]);

  const occupiedStandaloneLockerIds = Array.from(
    new Set([
      ...activeBookings.map((b) => b.standaloneLockerId).filter(Boolean),
      ...activeLeases.map((l) => l.resourceId),
    ])
  ) as string[];

  const occupiedSeatIds = Array.from(
    new Set(activeBookings.map((b) => b.seatId).filter(Boolean))
  ) as string[];

  return {
    plans,
    seats,
    standaloneLockers,
    relays,
    occupiedStandaloneLockerIds,
    occupiedSeatIds,
  };
}

export default async function StudentsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const requestedPage = parseInt((searchParams.page as string) || "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const query = ((searchParams.query as string) || "").trim();
  const tab = ((searchParams.tab as string) || "ACTIVE").toUpperCase();
  const PAGE_SIZE = 20;

  const session = await getSession();
  if (
    !session ||
    (session.role !== "LIBRARIAN" &&
      session.role !== "ADMIN" &&
      session.role !== "RECEPTIONIST")
  )
    redirect("/login");

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const normalizedTab = [
    "ACTIVE",
    "PAUSED",
    "EXPIRING",
    "INACTIVE",
    "EXPIRED",
    "REVOKED",
    "DUES",
  ].includes(tab)
    ? tab
    : "ACTIVE";

  // 1. Fetch tab counts (cached in Redis or live for search)
  const counts = query
    ? await fetchStudentCounts(library.id, now, sevenDaysFromNow, query)
    : await getCachedStudentCounts(library.id, () =>
        fetchStudentCounts(library.id, now, sevenDaysFromNow)
      );

  const totalStudentsCount =
    normalizedTab === "PAUSED"
      ? counts.paused
      : normalizedTab === "DUES"
      ? counts.dues
      : normalizedTab === "EXPIRING"
      ? counts.expiring
      : normalizedTab === "INACTIVE"
      ? counts.inactive
      : normalizedTab === "EXPIRED"
      ? counts.expired
      : normalizedTab === "REVOKED"
      ? counts.revoked
      : counts.active;

  // 2. Fetch student page data (cached in Redis per tab/page or live for search)
  const pageData = query
    ? {
        bookings: await fetchStudentBookings(
          library.id,
          normalizedTab,
          page,
          PAGE_SIZE,
          query,
          now,
          sevenDaysFromNow
        ),
        totalCount: totalStudentsCount,
      }
    : await getCachedStudentPage(library.id, normalizedTab, page, async () => {
        const bookings = await fetchStudentBookings(
          library.id,
          normalizedTab,
          page,
          PAGE_SIZE,
          "",
          now,
          sevenDaysFromNow
        );
        return { bookings, totalCount: totalStudentsCount };
      });

  const bookings = pageData.bookings;

  // 3. Fetch reference metadata (cached in Redis)
  const meta = await getCachedStudentMetadata(library.id, () =>
    fetchStudentMetadata(library.id)
  );

  // 4. Fetch recent door activity logs (live)
  const [checkinLogsRaw, entryLogsRaw] = await Promise.all([
    prisma.checkinLog.findMany({
      where: { libraryId: library.id },
      include: { student: true, relay: true },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),
    prisma.entryLog.findMany({
      where: {
        libraryId: library.id,
        status: { in: ["SUCCESS", "DENIED", "IN", "OUT"] },
      },
      include: { user: true },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),
  ]);

  const logs = [
    ...checkinLogsRaw.map((log) => ({
      id: log.id,
      studentId: log.studentId,
      libraryId: log.libraryId,
      relayId: log.relayId,
      status: log.status,
      reason: null,
      timestamp: log.timestamp,
      isOfflineSync: log.isOfflineSync,
      createdAt: log.createdAt,
      student: log.student,
      relay: log.relay,
    })),
    ...entryLogsRaw.map((log) => ({
      id: log.id,
      studentId: log.userId || "",
      libraryId: log.libraryId,
      relayId: log.doorId,
      status: (log.status === "DENIED" ? "DENIED" : "CHECK_IN") as
        | "DENIED"
        | "CHECK_IN",
      reason: log.reason,
      timestamp: log.timestamp,
      isOfflineSync: false,
      createdAt: log.createdAt,
      student:
        log.user || {
          id: "",
          name: "Unknown",
          email: "",
          phone: "",
          authId: "",
          role: "STUDENT" as const,
          employerLibraryId: null,
          isKycVerified: false,
          kycStatus: "PENDING",
          createdAt: log.timestamp,
          updatedAt: log.timestamp,
        },
      relay: null,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 50);

  return (
    <div className="w-full mx-auto space-y-6">
      <StudentsClient
        bookings={bookings}
        plans={meta.plans}
        logs={logs}
        relays={meta.relays}
        seats={meta.seats}
        standaloneLockers={meta.standaloneLockers}
        occupiedStandaloneLockerIds={meta.occupiedStandaloneLockerIds}
        occupiedSeatIds={meta.occupiedSeatIds}
        totalCount={totalStudentsCount}
        tabCounts={counts}
        currentPage={page}
        searchQuery={query}
      />
    </div>
  );
}
