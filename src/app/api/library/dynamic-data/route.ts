import crypto from "node:crypto";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { LeaseResourceType } from "@prisma/client";
import { activeBookingsCacheKey } from "@/lib/library-cache";
import {
  getPrismaErrorCode,
  isPrismaSchemaUnavailable,
  isPrismaTemporarilyUnavailable,
} from "@/lib/prisma-errors";

type ActiveBooking = {
  id: string;
  seatId: string | null;
  standaloneLockerId: string | null;
};

function isActiveBookingArray(value: unknown): value is ActiveBooking[] {
  return Array.isArray(value);
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const { searchParams } = new URL(req.url);
  const libraryId = searchParams.get("libraryId");

  try {
    if (!libraryId) {
      return NextResponse.json({ error: "Missing libraryId" }, { status: 400 });
    }

    const session = await getSession();

    let currentPlanEndDate = null;
    let studentActiveBookingId = null;

    if (session?.userId) {
      const studentActiveBooking = await prisma.booking.findFirst({
        where: {
          studentId: session.userId,
          libraryId: libraryId,
          status: "CONFIRMED",
          endTime: { gt: new Date() }
        },
        orderBy: { endTime: 'desc' }
      });
      if (studentActiveBooking) {
        currentPlanEndDate = studentActiveBooking.endTime.toISOString();
        studentActiveBookingId = studentActiveBooking.id;
      }
    }

    const cacheKey = activeBookingsCacheKey(libraryId);
    let cachedBookings: unknown = null;
    try {
      cachedBookings = await redis.get(cacheKey);
    } catch (e) {
      console.error("Redis get error:", e);
    }
    let activeBookings: ActiveBooking[] = [];

    if (!cachedBookings) {
      activeBookings = await prisma.booking.findMany({
        where: {
          libraryId: libraryId,
          status: 'CONFIRMED',
          endTime: {
            gt: new Date()
          }
        },
        select: {
          id: true,
          seatId: true,
          standaloneLockerId: true
        }
      });
      try {
        await redis.set(cacheKey, activeBookings, { ex: 15 });
      } catch (e) {
        console.error("Redis set error:", e);
      }
    } else if (typeof cachedBookings === 'string') {
      try {
        const parsed: unknown = JSON.parse(cachedBookings);
        if (isActiveBookingArray(parsed)) activeBookings = parsed;
      } catch (e) {
        console.error("Redis parse error:", e);
      }
    } else if (isActiveBookingArray(cachedBookings)) {
      activeBookings = cachedBookings;
    }

    const activeLeases = await prisma.resourceLease.findMany({
      where: {
        libraryId,
        expiresAt: { gt: new Date() }
      },
      select: {
        resourceType: true,
        resourceId: true,
      }
    });

    const occupiedSeatIds = [
      ...activeBookings
        .filter((booking) => booking.id !== studentActiveBookingId)
        .map((booking) => booking.seatId)
        .filter(Boolean),
      ...activeLeases
        .filter((lease) => lease.resourceType === LeaseResourceType.SEAT)
        .map((lease) => lease.resourceId),
    ] as string[];

    const occupiedLockerIds = [
      ...activeBookings
        .map((booking) => booking.standaloneLockerId)
        .filter(Boolean),
      ...activeLeases
        .filter(
          (lease) =>
            lease.resourceType === LeaseResourceType.STANDALONE_LOCKER,
        )
        .map((lease) => lease.resourceId),
    ] as string[];

    return NextResponse.json({
      session: session ? {
        userId: session.userId,
        phone: session.phone,
        email: session.email
      } : null,
      occupiedSeatIds,
      occupiedLockerIds,
      currentPlanEndDate,
      studentActiveBookingId
    });

  } catch (error: unknown) {
    console.error("Dynamic data fetch error:", {
      requestId,
      prismaCode: getPrismaErrorCode(error),
      error,
    });
    if (isPrismaSchemaUnavailable(error)) {
      return NextResponse.json(
        {
          code: "BOOKING_SCHEMA_NOT_READY",
          error: "Live booking availability is temporarily unavailable.",
          requestId,
        },
        { status: 503 },
      );
    }
    if (isPrismaTemporarilyUnavailable(error)) {
      return NextResponse.json(
        {
          code: "BOOKING_DATABASE_UNAVAILABLE",
          error: "Live booking availability is temporarily unavailable.",
          requestId,
        },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }
    return NextResponse.json(
      { error: "Unable to load live booking availability.", requestId },
      { status: 500 },
    );
  }
}
