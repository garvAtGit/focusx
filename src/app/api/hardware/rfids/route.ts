import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Authenticate the ESP32 using the standard hardware API key
    if (!verifyRelayKey(request.headers.get("authorization")?.replace("Bearer ", ""))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get("libraryId");

    if (!libraryId) {
      return NextResponse.json({ error: "Missing libraryId" }, { status: 400 });
    }

    // Find all users who have an active booking for this library right now
    const now = new Date();
    const activeBookings = await prisma.booking.findMany({
      where: {
        libraryId,
        status: "CONFIRMED",
        startTime: { lte: now },
        endTime: { gt: now },
        student: {
          rfidTag: { not: null }
        }
      },
      include: {
        student: {
          select: { rfidTag: true }
        }
      }
    });

    // We only want unique RFIDs and their maximum expiration date
    // A user might have multiple active bookings, we want the longest one
    const rfidMap = new Map<string, number>();

    for (const booking of activeBookings) {
      const rfid = booking.student.rfidTag;
      if (rfid) {
        const expTime = Math.floor(booking.endTime.getTime() / 1000); // Unix timestamp in seconds
        
        if (!rfidMap.has(rfid) || rfidMap.get(rfid)! < expTime) {
          rfidMap.set(rfid, expTime);
        }
      }
    }

    const payload = Array.from(rfidMap.entries()).map(([uid, exp]) => ({
      uid,
      exp
    }));

    return NextResponse.json(payload);

  } catch (error: unknown) {
    console.error("Failed to fetch RFIDs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
