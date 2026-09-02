import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { UserNav } from "@/components/user-nav";
import Link from "next/link";
import { NotificationBell } from "./NotificationBell";
import { NotificationListener } from "./NotificationListener";
import { AccessQRModal } from "./AccessQRModal";
import type { Notification } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { generateEntryQR } from '@/app/actions/hardware-actions';

export async function NavbarAuth() {
  const session = await getSession();
  let notifications: Notification[] = [];
  let user = null;
  let activeBooking = null;
  let initialQrPayload = undefined;

  if (session?.userId) {
    user = await prisma.user.findUnique({ where: { id: session.userId } });
    notifications = await prisma.notification.findMany({
      where: { studentId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    // Find the user's most recent active booking to provide library context for the QR Code icon
    activeBooking = await prisma.booking.findFirst({
      where: { 
        studentId: session.userId,
        status: "CONFIRMED",
        endTime: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (activeBooking) {
      const qrResult = await generateEntryQR(activeBooking.libraryId, "MAIN_GATE", session.userId);
      if (qrResult.success && qrResult.qrPayload) {
        initialQrPayload = qrResult.qrPayload;
      }
    }
  }

  if (session && user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationListener notifications={notifications} />
        <AccessQRModal 
          libraryId={activeBooking?.libraryId || ""} 
          studentId={session.userId} 
          initialQrPayload={initialQrPayload}
          iconOnly 
        />
        <NotificationBell notifications={notifications} />
        <UserNav user={user} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <AccessQRModal libraryId="" studentId="" iconOnly />
      <Link href="/login" className="ml-1 sm:ml-2">
        <Button className="h-9 px-5 rounded-full font-bold text-sm shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          Sign In
        </Button>
      </Link>
    </div>
  );
}
