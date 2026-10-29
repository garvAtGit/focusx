import { NextResponse } from "next/server";
import { syncReviewFromLibraryNear, getLibraryReviews } from "@/lib/reviews-service";
import prisma from "@/lib/prisma";

function isAuthorized(req: Request): boolean {
  const syncSecret = process.env.LIBRARY_NEAR_SYNC_SECRET;
  if (!syncSecret) {
    // In local development before secret is configured, allow for testing
    return true;
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === syncSecret;
}

/**
 * PUSH SYNC:
 * Called by "Library Near" to push a review created on their website into FocusX.
 */
export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized sync request" }, { status: 401 });
    }

    const body = await req.json();
    const { libraryId, rating, content, authorName, authorAvatar, externalReviewId } = body;

    if (!libraryId || !rating || !content) {
      return NextResponse.json({ error: "Missing required fields: libraryId, rating, content" }, { status: 400 });
    }

    // Verify library exists in FocusX
    const libraryExists = await prisma.library.findUnique({
      where: { id: libraryId },
      select: { id: true, name: true },
    });

    if (!libraryExists) {
      return NextResponse.json({ error: `Library ${libraryId} not found on FocusX` }, { status: 404 });
    }

    const review = await syncReviewFromLibraryNear({
      libraryId,
      rating: Number(rating),
      content: String(content),
      authorName: authorName || "Library Near User",
      authorAvatar: authorAvatar || null,
      externalReviewId,
    });

    return NextResponse.json({
      success: true,
      message: "Review successfully synchronized from Library Near",
      review,
    });
  } catch (error: unknown) {
    console.error("[POST /api/reviews/sync] Error:", error);
    return NextResponse.json({ error: "Failed to sync review" }, { status: 500 });
  }
}

/**
 * PULL SYNC:
 * Called by "Library Near" to pull recent reviews submitted on FocusX
 * so they can be displayed on Library Near.
 */
export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized sync request" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const libraryId = searchParams.get("libraryId");

    if (libraryId) {
      const summary = await getLibraryReviews(libraryId);
      return NextResponse.json({
        success: true,
        source: "FOCUSX",
        ...summary,
      });
    }

    // Return recent FocusX reviews across all libraries
    const recentQueries = await prisma.query.findMany({
      where: { type: "REVIEW" },
      include: {
        library: { select: { id: true, name: true } },
        student: { select: { name: true, profilePhotoUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      source: "FOCUSX",
      count: recentQueries.length,
      reviews: recentQueries.map((q) => ({
        id: q.id,
        libraryId: q.libraryId,
        libraryName: q.library.name,
        studentName: q.student?.name || "Student",
        rating: q.rating ?? 5,
        content: q.content,
        createdAt: q.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error("[GET /api/reviews/sync] Error:", error);
    return NextResponse.json({ error: "Failed to export reviews" }, { status: 500 });
  }
}

