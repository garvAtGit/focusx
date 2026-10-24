import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { BookingsClient } from "./BookingsClient";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const [intents, refundTasks] = await Promise.all([
    prisma.bookingIntent.findMany({
      take: 150,
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <BookingsClient initialIntents={intents} refundTasks={refundTasks} />
    </div>
  );
}
