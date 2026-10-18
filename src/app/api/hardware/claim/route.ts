import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "LIBRARIAN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { claimCode, libraryId } = body;

    if (!claimCode || !libraryId) {
      return NextResponse.json({ error: "Missing claimCode or libraryId" }, { status: 400 });
    }

    // Optional: Verify that the librarian owns this libraryId
    if (session.role !== "ADMIN") {
      const library = await prisma.library.findFirst({
        where: {
          id: libraryId,
          OR: [
            { librarianId: session.userId },
            { staff: { some: { id: session.userId } } }
          ]
        }
      });
      if (!library) {
        return NextResponse.json({ error: "Unauthorized for this library" }, { status: 403 });
      }
    }

    const claim = await prisma.hardwareClaim.findUnique({
      where: { claimCode: claimCode.toUpperCase() }
    });

    if (!claim) {
      return NextResponse.json({ error: "Invalid claim code. Ensure the device is powered on." }, { status: 404 });
    }

    if (claim.isClaimed && claim.libraryId !== libraryId) {
      return NextResponse.json({ error: "This hardware is already claimed by another library." }, { status: 409 });
    }

    // Safely execute the final link via transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark claim as claimed
      await tx.hardwareClaim.update({
        where: { id: claim.id },
        data: { isClaimed: true, libraryId }
      });

      // 2. Wipe the bleReaderId from any other relays (enforce 1-to-1)
      if (claim.bleReaderId) {
        await tx.relay.updateMany({
          where: { bleReaderId: claim.bleReaderId },
          data: { bleReaderId: null }
        });
      }

      // 3. Upsert the Relay mapping for this library
      const existingRelay = await tx.relay.findFirst({
        where: { libraryId }
      });

      if (existingRelay) {
        await tx.relay.update({
          where: { id: existingRelay.id },
          data: {
            macAddress: claim.macAddress,
            bleReaderId: claim.bleReaderId,
            nfcTagId: claim.nfcTagId || existingRelay.nfcTagId,
            lastSync: new Date(),
            status: "ONLINE"
          }
        });
      } else {
        await tx.relay.create({
          data: {
            libraryId,
            macAddress: claim.macAddress,
            bleReaderId: claim.bleReaderId,
            nfcTagId: claim.nfcTagId || `ESP32-${Date.now()}`,
            lastSync: new Date(),
            status: "ONLINE"
          }
        });
      }
    });

    return NextResponse.json({ success: true, message: "Hardware successfully linked to library." });
  } catch (error: any) {
    console.error("[Hardware Claim Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
