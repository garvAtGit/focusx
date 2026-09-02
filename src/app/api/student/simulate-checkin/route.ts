import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";

export async function POST(req: Request) {
  try {
    const { libraryId } = await req.json();
    const session = await getSession();

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const studentId = session.userId;

    // Check last status
    const lastLog = await prisma.checkinLog.findFirst({
      where: { studentId, libraryId },
      orderBy: { timestamp: 'desc' }
    });

    const newStatus = lastLog?.status === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN';

    // Insert mock checkin log
    await prisma.checkinLog.create({
      data: {
        studentId,
        libraryId,
        status: newStatus,
        isOfflineSync: false,
      }
    });

    return NextResponse.json({ success: true, newStatus });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
