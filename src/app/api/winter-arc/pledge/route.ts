import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { appendToGoogleSheet } from "@/lib/google-sheets";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leagueHours, targetHours, discount } = body;

    if (!leagueHours || !targetHours || !discount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch user to get name and phone for Google Sheets sync
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    const name = user?.name || "Unknown";
    const phone = user?.phone || "Unknown";

    // 2. Save the pledge to Postgres
    const pledge = await prisma.winterArcEnrollment.upsert({
      where: { studentId: session.userId },
      update: {
        leagueHours,
        targetHours,
        discount
      },
      create: {
        studentId: session.userId,
        leagueHours,
        targetHours,
        discount
      }
    });

    // 3. Sync to Google Sheets (Tab 0: Pledges)
    // We do this non-blocking (fire and forget) so the user doesn't wait for Google API
    const sheetId = "1DWnfQMG9WDPhyj_k1dqRPvD-9L4LxcxCqy-ERRIrTYE";
    const date = new Date().toLocaleDateString();
    
    // Row format: [Date, Name, Phone, League, Target Hours, Discount]
    appendToGoogleSheet(sheetId, [date, name, phone, `${leagueHours} Hours`, `${targetHours}h`, `${discount}%`])
      .catch(err => console.error("Failed to append pledge to sheets:", err));

    return NextResponse.json({ success: true, pledge });
  } catch (error) {
    console.error("Pledge Error:", error);
    return NextResponse.json({ error: "Failed to process pledge" }, { status: 500 });
  }
}
