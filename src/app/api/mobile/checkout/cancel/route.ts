import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { cancelStudentPendingBooking } from "@/lib/booking-authority";
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache";
import prisma from '@/lib/prisma';
import { reconcileMobilePayment } from '@/lib/mobile-payment-recovery';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateMobileRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { bookingId, referenceId, libraryId } = body;
    // Check provider facts before releasing an order whose native callback was lost.
    if (typeof referenceId === 'string') {
      const intent = await prisma.bookingIntent.findUnique({ where: { referenceId } });
      if (!intent || intent.studentId !== auth.userId) return NextResponse.json({ error: 'Checkout not found' }, { status: 404 });
      await reconcileMobilePayment(intent);
    }

    const result = await cancelStudentPendingBooking({
      studentId: auth.userId,
      bookingId,
      referenceId,
      libraryId,
    });

    if (libraryId) {
      await invalidateLibraryRuntimeCache(libraryId);
    }

    return NextResponse.json({ success: result.success, result });
  } catch (error: unknown) {
    console.error("Mobile cancel checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel checkout" },
      { status: 500 }
    );
  }
}
