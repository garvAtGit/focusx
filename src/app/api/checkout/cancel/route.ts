import { NextResponse } from "next/server";
import { getSession } from "@/app/actions/auth-actions";
import { adminAuth } from "@/lib/firebase/firebaseAdmin";
import prisma from "@/lib/prisma";
import { cancelStudentPendingBooking } from "@/lib/booking-authority";
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    let authUserId = session?.userId;

    const body = await req.json().catch(() => ({}));
    const { bookingId, referenceId, libraryId, idToken } = body;

    if (!session && idToken && adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken, true);
        const user = await prisma.user.findUnique({ where: { authId: decoded.uid } });
        if (user) authUserId = user.id;
      } catch (e) {
        console.error("Token verification failed in cancel checkout", e);
      }
    }

    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await cancelStudentPendingBooking({
      studentId: authUserId,
      bookingId,
      referenceId,
      libraryId,
    });

    if (libraryId) {
      await invalidateLibraryRuntimeCache(libraryId);
    }

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    console.error("Cancel checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel checkout" },
      { status: 500 }
    );
  }
}
