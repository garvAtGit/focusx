import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const relay = await prisma.relay.updateMany({
      where: { macAddress: "000000000000" },
      data: { bleReaderId: "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1" }
    });
    return NextResponse.json({ success: true, updated: relay.count });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
