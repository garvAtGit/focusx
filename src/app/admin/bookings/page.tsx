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
  const rawChannel = typeof searchParams.channel === "string" ? searchParams.channel.toUpperCase() : "ALL";
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
  const channel: "ALL" | "RECEPTION" | "RAZORPAY" =
    rawChannel === "RECEPTION" || rawChannel === "RAZORPAY" ? rawChannel : "ALL";
  const tab = searchParams.tab === "REFUNDS" ? "REFUNDS" : "INTENTS";

  // Build Prisma where filter for BookingIntents
  const where: Prisma.BookingIntentWhereInput = {};

  if (status !== "ALL") {
    where.status = status;
  }

  if (channel === "RECEPTION") {
    where.source = { in: ["RECEPTION", "MANUAL", "RENEWAL", "HARDWARE"] };
  } else if (channel === "RAZORPAY") {
    where.source = "RAZORPAY";
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
    ? `bookings:q:${encodeURIComponent(q.toLowerCase())}:p:${page}:s:${status}:c:${channel}`
    : `bookings:p:${page}:s:${status}:c:${channel}`;

  const { intents, totalCount, refundTasks, receptionStudentCount, razorpayStudentCount } = await getCachedAdminData(
    cacheKey,
    async () => {
      const [count, intents, refundTasks, receptionStudents, razorpayStudents] = await Promise.all([
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
        prisma.bookingIntent.findMany({
          where: { source: { in: ["RECEPTION", "MANUAL", "RENEWAL", "HARDWARE"] } },
          select: { studentId: true },
          distinct: ["studentId"],
        }),
        prisma.bookingIntent.findMany({
          where: { source: "RAZORPAY" },
          select: { studentId: true },
          distinct: ["studentId"],
        }),
      ]);

      return {
        intents,
        totalCount: count,
        refundTasks,
        receptionStudentCount: receptionStudents.length,
        razorpayStudentCount: razorpayStudents.length,
      };
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
        currentChannel={channel}
        receptionStudentCount={receptionStudentCount}
        razorpayStudentCount={razorpayStudentCount}
        initialQuery={q}
        initialTab={tab}
      />
    </div>
  );
}

