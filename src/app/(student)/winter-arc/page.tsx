import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import CozyWinterArcForm from "./WinterArcClient";

export default async function WinterArcPage() {
  const session = await getSession();
  const isLoggedIn = !!session;

  let currentHours = 0;
  let activeBooking = null;

  if (isLoggedIn) {
    activeBooking = await prisma.booking.findFirst({
    where: { 
      studentId: session.userId,
      status: 'CONFIRMED',
      endTime: { gt: new Date() }
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  });
  }

  if (activeBooking && activeBooking.plan && activeBooking.plan.durationHours) {
    currentHours = activeBooking.plan.durationHours;
  }

  return <CozyWinterArcForm currentHours={currentHours} isLoggedIn={isLoggedIn} />;
}
