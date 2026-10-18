import { NextResponse, type NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/app/actions/auth-actions"
import { getActiveLibrary } from "@/lib/dashboard-utils"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (
    !session
    || !["LIBRARIAN", "ADMIN", "RECEPTIONIST"].includes(session.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const activeLibrary = await getActiveLibrary(session)
  const libraryId = activeLibrary?.id
  if (!libraryId) {
    return NextResponse.json({ error: "Library not found" }, { status: 404 })
  }

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 64) ?? ""
  if (query.length < 2) {
    return NextResponse.json(
      { students: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }

  const students = await prisma.user.findMany({
    where: {
      bookings: { some: { libraryId } },
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { uniqueId: { startsWith: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      uniqueId: true,
      bookings: {
        where: {
          libraryId,
          status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
        },
        orderBy: { startTime: "desc" },
        take: 1,
        select: {
          id: true,
          planId: true,
          seatId: true,
          startTime: true,
          endTime: true,
          status: true,
          plan: {
            select: {
              id: true,
              name: true,
              validityDays: true,
              durationHours: true,
              price: true,
              type: true,
            },
          },
          seat: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
    take: 8,
  })

  return NextResponse.json(
    { students },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
