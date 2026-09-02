import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    return NextResponse.json({ success: true, intentId: 'mock-intent-123' });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
