import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { id, command } = await request.json();

    if (!id || !command) {
      return NextResponse.json({ error: 'Missing id or command' }, { status: 400 });
    }

    // Update the pendingCommand for the hardware relay in Supabase
    const relay = await prisma.relay.update({
      where: { id },
      data: { pendingCommand: command }
    });

    return NextResponse.json({ success: true, relay });
  } catch (error) {
    console.error('Failed to queue hardware command:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
