import { NextResponse } from "next/server";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as { libraryId?: string };
    let { libraryId } = body;

    // If no libraryId is provided, try to find their active booking and use that library
    if (!libraryId) {
      const now = new Date();
      const activeBooking = await prisma.booking.findFirst({
        where: {
          studentId: session.userId,
          status: "CONFIRMED",
          startTime: { lte: now },
          endTime: { gte: now },
          isPaused: false
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!activeBooking) {
        // Fallback: Check if they are the librarian or staff for testing purposes
        const managedLibrary = await prisma.library.findFirst({
          where: {
            OR: [
              { librarianId: session.userId },
              { staff: { some: { id: session.userId } } }
            ]
          }
        });
        
        if (!managedLibrary) {
          return NextResponse.json({ error: "No active plan found to unlock doors." }, { status: 403 });
        }
        libraryId = managedLibrary.id;
      } else {
        libraryId = activeBooking.libraryId;
      }
    }

    // Generate the signed payload using ECDSA
    const timestamp = Math.floor(Date.now() / 1000);
    const qid = crypto.randomUUID();
    
    // The ESP32 will verify the signature over: uid + iat + qid
    const payloadToSign = `${session.userId}${timestamp}${qid}`;

    const privateKeyBase64 = process.env.ECDSA_PRIVATE_KEY;
    let signature = "DEV_MOCK_SIGNATURE";

    if (!privateKeyBase64) {
      console.warn("Missing ECDSA_PRIVATE_KEY. Using mock signature.");
    } else {
      let privateKey = privateKeyBase64;
      if (!privateKeyBase64.includes('-----BEGIN PRIVATE KEY-----')) {
        try {
          privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
        } catch {
          console.error("Failed to decode ECDSA_PRIVATE_KEY");
        }
      }

      const sign = crypto.createSign('SHA256');
      sign.update(payloadToSign);
      sign.end();
      signature = sign.sign(privateKey, 'base64');
    }

    // This is the exact payload structure the ESP32 expects to receive over BLE
    const blePayload = {
      uid: session.userId,
      iat: timestamp,
      qid: qid,
      door: "MAIN_GATE",
      sig: signature
    };

    return NextResponse.json({
      success: true,
      token: JSON.stringify(blePayload)
    });

  } catch (error) {
    console.error("BLE Token generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
