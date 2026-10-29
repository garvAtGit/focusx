import { NextResponse } from "next/server";
import { getSession } from "@/app/actions/auth-actions";
import { getLibraryReviews, createLibraryReview } from "@/lib/reviews-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const libraryId = searchParams.get("libraryId");

    if (!libraryId) {
      return NextResponse.json({ error: "Missing libraryId parameter" }, { status: 400 });
    }

    const summary = await getLibraryReviews(libraryId);
    return NextResponse.json({ success: true, ...summary });
  } catch (error: unknown) {
    console.error("[GET /api/reviews] Error:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to write a review.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { libraryId, rating, content } = body;

    if (!libraryId || typeof libraryId !== "string") {
      return NextResponse.json({ error: "Invalid or missing libraryId" }, { status: 400 });
    }

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    if (!content || typeof content !== "string" || content.trim().length < 3) {
      return NextResponse.json({ error: "Please write a review with at least 3 characters" }, { status: 400 });
    }

    const review = await createLibraryReview({
      libraryId,
      studentId: session.userId,
      rating: numericRating,
      content: content.trim(),
      source: "FOCUSX",
    });

    return NextResponse.json({ success: true, review });
  } catch (error: unknown) {
    console.error("[POST /api/reviews] Error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}

