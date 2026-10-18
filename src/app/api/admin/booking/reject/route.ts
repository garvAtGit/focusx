import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import {
  BookingAuthorityError,
  cancelPendingReceptionBooking,
} from "@/lib/booking-authority";
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { library: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (session.role === 'LIBRARIAN' && booking.library.librarianId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ error: 'Booking is not pending' }, { status: 400 });
    }

    const updatedBooking = await cancelPendingReceptionBooking(
      bookingId,
      "RECEPTION_PAYMENT_REJECTED",
    );
    await invalidateLibraryRuntimeCache(updatedBooking.libraryId);

    return NextResponse.json({ success: true, booking: updatedBooking });
  } catch (error: unknown) {
    console.error("Booking Rejection Error:", error);
    if (error instanceof BookingAuthorityError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
