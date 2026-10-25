import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { BookingsClient } from "./BookingsClient";
import { getCachedAdminData } from "@/lib/admin-cache";
import { Prisma, BookingIntentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminBookingsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const searchParams = await props.searchParams;
  const rawPage = typeof searchParams.page === "string" ? parseInt(searchParams.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const rawStatus = typeof searchParams.status === "string" ? searchParams.status.toUpperCase() : "ALL";
  const validStatuses: string[] = [
    "CONFIRMED",
    "AWAITING_PAYMENT",
    "HOLDING",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "REFUNDED",
    "REFUND_PENDING",
  ];
  const status = validStatuses.includes(rawStatus) ? (rawStatus as BookingIntentStatus) : "ALL";
  const tab = searchParams.tab === "REFUNDS" ? "REFUNDS" : "INTENTS";

  // Build Prisma where filter for BookingIntents
  const where: Prisma.BookingIntentWhereInput = {};

  if (status !== "ALL") {
    where.status = status;
  }

  if (q) {
    where.OR = [
      { referenceId: { contains: q, mode: "insensitive" } },
      { providerPaymentId: { contains: q, mode: "insensitive" } },
      { providerOrderId: { contains: q, mode: "insensitive" } },
      {
        student: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
      },
      {
        library: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const cacheKey = q
    ? `bookings:q:${encodeURIComponent(q.toLowerCase())}:p:${page}:s:${status}`
    : `bookings:p:${page}:s:${status}`;

  const { intents, totalCount, refundTasks } = await getCachedAdminData(
    cacheKey,
    async () => {
      const [count, intents, refundTasks] = await Promise.all([
        prisma.bookingIntent.count({ where }),
        prisma.bookingIntent.findMany({
          where,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { createdAt: "desc" },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
            library: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
            plan: {
              select: {
                name: true,
                type: true,
              },
            },
            seat: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        }),
        prisma.refundTask.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            booking: {
              select: {
                id: true,
                student: { select: { name: true, phone: true } },
                library: { select: { name: true } },
              },
            },
          },
        }),
      ]);

      return { intents, totalCount: count, refundTasks };
    },
    q ? 20 : 30
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <BookingsClient
        initialIntents={intents}
        refundTasks={refundTasks}
        totalCount={totalCount}
        currentPage={page}
        pageSize={PAGE_SIZE}
        currentStatus={status}
        initialQuery={q}
        initialTab={tab}
      />
    </div>
  );
}

