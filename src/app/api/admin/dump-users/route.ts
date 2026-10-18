import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    mobile_project: "focusdesk-95385"
  });
}
