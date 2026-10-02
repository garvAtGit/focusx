import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin");
  if (!pin) return NextResponse.json({ error: "Missing pin" }, { status: 400 });
  
  try {
    const claim = await prisma.hardwareClaim.findUnique({ where: { claimCode: pin } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    return NextResponse.json({ isClaimed: claim.isClaimed });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
