import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { readerId } = body;

    if (!readerId) {
      return NextResponse.json({ success: false, error: "Missing readerId" }, { status: 400 });
    }

    const relay = await prisma.relay.findUnique({
      where: { bleReaderId: readerId },
      select: { id: true, lastSeenAt: true },
    });

    if (!relay) {
      return NextResponse.json({ success: false, error: "Relay not found" }, { status: 404 });
    }

    const now = Date.now();
    const lastSeenTime = relay.lastSeenAt ? relay.lastSeenAt.getTime() : 0;
    if (now - lastSeenTime > 30_000) {
      await prisma.relay.update({
        where: { id: relay.id },
        data: { lastSeenAt: new Date(now) },
      });
    }

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: any) {
    console.error("Hardware ping error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
