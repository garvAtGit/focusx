import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/app/actions/auth-actions"

export async function GET(
  _request: Request,
  context: { params: Promise<{ referenceId: string }> },
) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { referenceId } = await context.params
  const intent = await prisma.bookingIntent.findFirst({
    where: {
      referenceId,
      studentId: session.userId,
    },
    select: {
      status: true,
      bookingId: true,
      failureReason: true,
      updatedAt: true,
    },
  })
  if (!intent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(intent, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
