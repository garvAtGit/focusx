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

    const body = await request.json();
    const { deviceId, action } = body;

    if (!deviceId || !action || (action !== "IN" && action !== "OUT")) {
      return NextResponse.json({ error: "Missing or invalid deviceId/action" }, { status: 400 });
    }

    const relay = await prisma.relay.findFirst({
      where: { OR: [{ bleReaderId: deviceId }, { macAddress: deviceId }] }
    });

    if (!relay) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 30; // 30-second short-lived token
    const nonce = crypto.randomUUID().substring(0, 8);
    
    // Task 1: Use per-device provisioned secret to isolate blast radius
    if (!relay.deviceSecret) {
      return NextResponse.json({ error: "Device not provisioned with a secret" }, { status: 403 });
    }
    const deviceSecret = relay.deviceSecret;

    // Payload: uid:deviceId:libraryId:action:iat:exp:nonce
    const payloadToSign = `${session.userId}:${deviceId}:${relay.libraryId}:${action}:${iat}:${exp}:${nonce}`;
    
    // Token HMAC
    const signature = crypto.createHmac('sha256', deviceSecret).update(payloadToSign).digest('hex');
    
    // Final Token (appended with everything needed to reconstruct)
    const bleToken = `BLE:${session.userId}:${relay.libraryId}:${action}:${iat}:${exp}:${nonce}:${signature}`;

    return NextResponse.json({
      success: true,
      token: bleToken
    });

  } catch (error) {
    console.error("BLE Token generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
