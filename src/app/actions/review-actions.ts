'use server'

import prisma from "@/lib/prisma"
import { revalidatePath, updateTag } from "next/cache"
import { getSession } from "./auth-actions"
import { deleteByPattern } from "@/lib/redis"

export type FormattedReview = {
  id: string
  rating: number
  content: string
  createdAt: string
  isVerified: boolean
  student: {
    id: string
    name: string
    profilePhotoUrl: string | null
  }
}

export type ReviewStats = {
  averageRating: number
  totalReviews: number
  ratingCounts: Record<number, number>
}

export type LibraryReviewsResponse = {
  reviews: FormattedReview[]
  stats: ReviewStats
  currentUserReview: FormattedReview | null
  isCurrentUserEnrolled: boolean
  currentUserId: string | null
}

/**
 * Fetches all reviews for a library, calculates verified badge status
 * based on whether each reviewing student has an enrolled booking (CONFIRMED/COMPLETED)
 * at this specific library.
 */
export async function getLibraryReviews(libraryId: string): Promise<LibraryReviewsResponse> {
  const session = await getSession();
  const currentUserId = session?.userId || null;

  try {
    const rawReviews = await prisma.query.findMany({
      where: {
        libraryId,
        type: "REVIEW",
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            profilePhotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const reviewerStudentIds = Array.from(new Set(rawReviews.map((r) => r.studentId)));

    // Batch query to find which of these students have had an enrolled booking in this library
    let enrolledStudentIds = new Set<string>();
    if (reviewerStudentIds.length > 0) {
      const confirmedBookings = await prisma.booking.findMany({
        where: {
          libraryId,
          studentId: { in: reviewerStudentIds },
          status: { in: ["CONFIRMED", "COMPLETED"] },
        },
        select: {
          studentId: true,
        },
      });
      enrolledStudentIds = new Set(confirmedBookings.map((b) => b.studentId));
    }

    // Check if the current user is enrolled in this library
    let isCurrentUserEnrolled = false;
    if (currentUserId) {
      if (enrolledStudentIds.has(currentUserId)) {
        isCurrentUserEnrolled = true;
      } else {
        const userBooking = await prisma.booking.findFirst({
          where: {
            libraryId,
            studentId: currentUserId,
            status: { in: ["CONFIRMED", "COMPLETED"] },
          },
          select: { id: true },
        });
        isCurrentUserEnrolled = !!userBooking;
      }
    }

    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    let ratedReviewCount = 0;
    let currentUserReview: FormattedReview | null = null;

    const reviews: FormattedReview[] = rawReviews.map((r) => {
      // Only count reviews with valid integer ratings in the 1-5 range
      const validRating = r.rating !== null && r.rating !== undefined 
        && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5
        ? r.rating 
        : null;

      if (validRating !== null) {
        ratingCounts[validRating] = (ratingCounts[validRating] || 0) + 1;
        ratingSum += validRating;
        ratedReviewCount++;
      }

      const isVerified = enrolledStudentIds.has(r.studentId);

      const formatted: FormattedReview = {
        id: r.id,
        rating: validRating ?? 0,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        isVerified,
        student: {
          id: r.student.id,
          name: r.student.name || "Student",
          profilePhotoUrl: r.student.profilePhotoUrl,
        },
      };

      if (currentUserId && r.studentId === currentUserId) {
        currentUserReview = formatted;
      }

      return formatted;
    });

    const averageRating = ratedReviewCount > 0 ? Number((ratingSum / ratedReviewCount).toFixed(1)) : 0;

    return {
      reviews,
      stats: {
        averageRating,
        totalReviews: ratedReviewCount,
        ratingCounts,
      },
      currentUserReview,
      isCurrentUserEnrolled,
      currentUserId,
    };
  } catch (error) {
    console.error("Error fetching library reviews:", error);
    // Re-throw so callers can distinguish a DB error from a library with zero reviews
    throw new Error("Failed to load reviews. Please try again later.");
  }
}

/**
 * Submits or updates a student review for a library.
 * Verifies student enrollment dynamically.
 */
export async function submitLibraryReview(data: {
  libraryId: string
  rating: number
  content: string
}): Promise<{
  success: boolean
  error?: string
  isVerified?: boolean
  message?: string
}> {
  const session = await getSession();
  if (!session || !session.userId) {
    return { success: false, error: "Please log in to submit a review." };
  }

  const { libraryId, rating, content } = data;

  if (!libraryId || typeof libraryId !== "string") {
    return { success: false, error: "Library ID is required." };
  }

  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return { success: false, error: "Rating must be a whole number between 1 and 5 stars." };
  }

  const cleanContent = content ? content.trim() : "";
  if (cleanContent.length < 3) {
    return { success: false, error: "Review must be at least 3 characters long." };
  }
  if (cleanContent.length > 1000) {
    return { success: false, error: "Review cannot exceed 1000 characters." };
  }

  try {
    // Verify library exists
    const library = await prisma.library.findUnique({
      where: { id: libraryId },
      select: { id: true },
    });

    if (!library) {
      return { success: false, error: "Library not found." };
    }

    // Check if the student has an existing review for this library
    const existing = await prisma.query.findFirst({
      where: {
        libraryId,
        studentId: session.userId,
        type: "REVIEW",
      },
    });

    if (existing) {
      await prisma.query.update({
        where: { id: existing.id },
        data: {
          rating: numRating,
          content: cleanContent,
        },
      });
    } else {
      await prisma.query.create({
        data: {
          libraryId,
          studentId: session.userId,
          type: "REVIEW",
          rating: numRating,
          content: cleanContent,
        },
      });
    }

    // Check enrollment status for response feedback
    const activeBooking = await prisma.booking.findFirst({
      where: {
        libraryId,
        studentId: session.userId,
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      select: { id: true },
    });

    const isVerified = Boolean(activeBooking);

    // Evict Redis caches so listing & details pages reflect new review immediately
    try {
      await deleteByPattern("libraries:search:*");
      await deleteByPattern(`library:reviews:${libraryId}`);
    } catch (e) {
      console.error("Redis cache clearance error:", e);
    }

    updateTag(`library:${libraryId}`);
    updateTag("libraries:featured");
    revalidatePath(`/library/${libraryId}`);
    revalidatePath("/libraries");
    revalidatePath("/dashboard/queries");

    return {
      success: true,
      isVerified,
      message: isVerified
        ? "Review published with Verified Student badge!"
        : "Review published successfully!",
    };
  } catch (error) {
    console.error("Error submitting review:", error);
    return { success: false, error: "Failed to submit review. Please try again." };
  }
}
