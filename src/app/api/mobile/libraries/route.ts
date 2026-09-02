import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function GET(req: Request) {
  try {
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

    const libraries = await prisma.library.findMany({
      where: { kycStatus: 'APPROVED' },
      include: {
        plans: {
          where: { isActive: true },
          select: {
            id: true,
            validityDays: true,
            price: true,
            discount: true,
            type: true,
            name: true,
          }
        }
      }
    });

    // Format for mobile app
    const formattedLibraries = libraries.map(lib => ({
      id: lib.id,
      name: lib.name,
      address: lib.address,
      locality: lib.locality || lib.city,
      photos: lib.photos || [],
      lat: null,
      lng: null,
      plans: lib.plans,
      facilities: lib.facilities || [],
    }));

    return NextResponse.json({ libraries: formattedLibraries });
  } catch (error) {
    console.error("Mobile libraries fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
