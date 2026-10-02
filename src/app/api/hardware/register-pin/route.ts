import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { pin, mac, readerId } = await request.json();
    if (!pin || !mac) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Clean up old unclaimed pins for this mac address to avoid clutter
    await prisma.hardwareClaim.deleteMany({
      where: { macAddress: mac, isClaimed: false }
    });

    const claim = await prisma.hardwareClaim.upsert({
      where: { claimCode: pin },
      update: { macAddress: mac, bleReaderId: readerId, isClaimed: false },
      create: { claimCode: pin, macAddress: mac, bleReaderId: readerId, isClaimed: false }
    });

    return NextResponse.json({ success: true, claim });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
