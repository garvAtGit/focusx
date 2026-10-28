import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { id, command, args } = await request.json();

    if (!id || !command) {
      return NextResponse.json({ error: 'Missing id or command' }, { status: 400 });
    }

    if (command === 'CLEAR') {
      const relay = await prisma.relay.update({
        where: { id },
        data: { pendingCommand: null }
      });
      return NextResponse.json({ success: true, message: 'Pending command cleared', relay });
    }

    const now = Date.now();
    const cmdId = `cmd_${now}_${crypto.randomBytes(3).toString('hex')}`;
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24-hour expiration

    const structuredCommand = JSON.stringify({
      cmdId,
      action: command,
      status: "QUEUED",
      args: args || {},
      createdAt: now,
      expiresAt
    });

    const relay = await prisma.relay.update({
      where: { id },
      data: { pendingCommand: structuredCommand }
    });

    return NextResponse.json({
      success: true,
      cmdId,
      command: structuredCommand,
      relay
    });
  } catch (error) {
    console.error('Failed to queue hardware command:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
