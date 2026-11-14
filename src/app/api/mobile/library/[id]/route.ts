export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      await adminAuth!.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Allow-list: only what the student app displays. Never return the whole
    // record: it holds owner-only data (KYC documents, admin notes, payment
    // account, Wi-Fi password). Add a field here when the app needs it.
    const library = await prisma.library.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        locality: true,
        city: true,
        district: true,
        state: true,
        pinCode: true,
        metroStation: true,
        metroDistance: true,
        googleMapsUrl: true,
        managerPhone: true,
        whatsapp: true,
        openingTime: true,
        closingTime: true,
        photos: true,
        facilities: true,
        seatsAvailable: true,
        compactSeatMap: true,
        seatNaming: true,
        kycStatus: true,
        plans: { where: { isActive: true } },
        seats: true,
        standaloneLockers: true
      }
    });

    if (!library) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    // `verified` drives the app's verified badge: the library has passed KYC review.
    const { kycStatus, ...publicLibrary } = library;
    return NextResponse.json({ ...publicLibrary, verified: kycStatus === 'APPROVED' });
  } catch (error) {
    console.error("Error fetching library:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

