import { Prisma } from "@prisma/client"
import { NextResponse, type NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/app/actions/auth-actions"
import { getActiveLibrary } from "@/lib/dashboard-utils"

type DailyRow = {
  date: string
  newCount: number
  renewalCount: number
  totalRevenue: number
}

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`)
  return Number.isNaN(date.getTime()) ? null : date
}

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

  const start = parseDate(request.nextUrl.searchParams.get("start"))
  const end = parseDate(request.nextUrl.searchParams.get("end"), true)
  if (!start || !end || end < start) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
  }
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Date range cannot exceed 366 days" },
      { status: 400 },
    )
  }

  const rows = await prisma.$queryRaw<DailyRow[]>(Prisma.sql`
    WITH ranged AS (
      SELECT
        b."id",
        b."studentId",
        b."createdAt",
        NOT EXISTS (
          SELECT 1
          FROM "Booking" earlier
          WHERE earlier."studentId" = b."studentId"
            AND earlier."libraryId" = b."libraryId"
            AND earlier."status" IN ('CONFIRMED', 'COMPLETED')
            AND (
              earlier."createdAt" < b."createdAt"
              OR (
                earlier."createdAt" = b."createdAt"
                AND earlier."id" < b."id"
              )
            )
        ) AS "isFirst",
        COALESCE(
          intent."expectedAmountPaise" / 100.0,
          p."price" * (1 - COALESCE(p."discount", 0) / 100.0)
            + COALESCE(locker."price", 0)
        )::double precision AS revenue
      FROM "Booking" b
      INNER JOIN "Plan" p ON p."id" = b."planId"
      LEFT JOIN "StandaloneLocker" locker
        ON locker."id" = b."standaloneLockerId"
      LEFT JOIN "BookingIntent" intent
        ON intent."bookingId" = b."id"
      WHERE b."libraryId" = ${libraryId}
        AND b."status" IN ('CONFIRMED', 'COMPLETED')
        AND b."createdAt" >= ${start}
        AND b."createdAt" <= ${end}
    )
    SELECT
      TO_CHAR(
        DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'),
        'YYYY-MM-DD'
      ) AS date,
      COUNT(*) FILTER (WHERE "isFirst")::int AS "newCount",
      COUNT(*) FILTER (WHERE NOT "isFirst")::int AS "renewalCount",
      COALESCE(SUM(revenue), 0)::double precision AS "totalRevenue"
    FROM ranged
    GROUP BY 1
    ORDER BY 1 ASC
  `)

  return NextResponse.json(
    {
      days: rows.map((row) => ({
        date: row.date,
        newCount: Number(row.newCount),
        renewalCount: Number(row.renewalCount),
        totalRevenue: Number(row.totalRevenue),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
