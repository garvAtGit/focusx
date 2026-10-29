import prisma from "@/lib/prisma";
import { Pool } from "pg";

export type ReviewSource = "FOCUSX" | "LIBRARY_NEAR";

export interface LibraryReview {
  id: string;
  libraryId: string;
  librarySlug?: string | null;
  studentId?: string | null;
  userName: string;
  userAvatar?: string | null;
  rating: number; // 1 to 5
  content: string;
  source: ReviewSource;
  createdAt: string;
}

export interface LibraryReviewsSummary {
  reviews: LibraryReview[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

/**
 * Global pool for external reviews database (when REVIEWS_DATABASE_URL is provided).
 * Uses a singleton on globalThis to avoid exhausting connections in Next.js dev server.
 */
const globalForReviews = globalThis as unknown as {
  reviewsPool: Pool | undefined;
};

function getExternalReviewsPool(): Pool | null {
  const connectionString = process.env.REVIEWS_DATABASE_URL;
  if (!connectionString) return null;

  if (!globalForReviews.reviewsPool) {
    globalForReviews.reviewsPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 15000,
    });
  }
  return globalForReviews.reviewsPool;
}

/**
 * Creates a clean canonical slug for resilient cross-platform matching.
 * e.g. ("Kripa Library", "Mandawali") -> "kripa-library-mandawali"
 */
export function generateLibrarySlug(name: string, locality?: string | null): string {
  const combined = [name, locality].filter(Boolean).join(" ");
  return combined
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-"); // Collapse consecutive hyphens
}

interface EncodedReviewMeta {
  __focusx_sync?: boolean;
  source?: ReviewSource;
  authorName?: string;
  authorAvatar?: string;
  librarySlug?: string;
  text?: string;
}

/**
 * Parses review content. If it was stored with external sync metadata,
 * extracts author name, source, and review text.
 */
function parseReviewContent(rawContent: string, defaultAuthor: string, defaultAvatar?: string | null): {
  content: string;
  userName: string;
  userAvatar: string | null;
  source: ReviewSource;
  librarySlug?: string | null;
} {
  try {
    if (rawContent.startsWith("{\"__focusx_sync\":true")) {
      const parsed = JSON.parse(rawContent) as EncodedReviewMeta;
      return {
        content: parsed.text || "",
        userName: parsed.authorName || defaultAuthor || "Student",
        userAvatar: parsed.authorAvatar || defaultAvatar || null,
        source: parsed.source || "LIBRARY_NEAR",
        librarySlug: parsed.librarySlug || null,
      };
    }
  } catch {
    // Fallback to plain text
  }

  return {
    content: rawContent,
    userName: defaultAuthor || "Student",
    userAvatar: defaultAvatar || null,
    source: "FOCUSX",
    librarySlug: null,
  };
}

/**
 * Encodes review content for external metadata storage.
 */
function encodeReviewContent(
  content: string, 
  source: ReviewSource, 
  authorName: string, 
  authorAvatar?: string,
  librarySlug?: string
): string {
  if (source === "LIBRARY_NEAR" || librarySlug) {
    return JSON.stringify({
      __focusx_sync: true,
      source,
      authorName,
      authorAvatar: authorAvatar || null,
      librarySlug: librarySlug || null,
      text: content,
    });
  }
  return content;
}

/**
 * Resolves a library's details (ID and canonical slug) for robust dual-key matching.
 */
async function resolveLibraryIdentifiers(libraryIdOrSlug: string): Promise<{ id: string; slug: string; name: string } | null> {
  const lib = await prisma.library.findFirst({
    where: {
      OR: [
        { id: libraryIdOrSlug },
      ],
    },
    select: { id: true, name: true, locality: true },
  });

  if (!lib) return null;

  return {
    id: lib.id,
    slug: generateLibrarySlug(lib.name, lib.locality),
    name: lib.name,
  };
}

/**
 * Fetch all reviews for a library.
 * 1. If REVIEWS_DATABASE_URL is set -> directly queries the shared reviews database table.
 * 2. Otherwise -> queries local Prisma Query table.
 * Supports matching by exact libraryId OR canonical librarySlug.
 */
export async function getLibraryReviews(libraryIdOrSlug: string): Promise<LibraryReviewsSummary> {
  const resolved = await resolveLibraryIdentifiers(libraryIdOrSlug);
  const targetId = resolved ? resolved.id : libraryIdOrSlug;
  const targetSlug = resolved ? resolved.slug : generateLibrarySlug(libraryIdOrSlug);

  const pool = getExternalReviewsPool();

  // PATH 1: Direct Shared Database Access (External DB)
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT 
          id, 
          library_id AS "libraryId", 
          library_slug AS "librarySlug",
          user_id AS "studentId", 
          user_name AS "userName", 
          user_avatar AS "userAvatar", 
          rating, 
          content, 
          source, 
          created_at AS "createdAt"
         FROM reviews
         WHERE library_id = $1 OR library_slug = $2
         ORDER BY created_at DESC`,
        [targetId, targetSlug]
      );

      const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let ratingSum = 0;
      let ratedCount = 0;

      const reviews: LibraryReview[] = res.rows.map((row) => {
        const rating = Math.max(1, Math.min(5, Math.round(row.rating || 5)));
        ratingDistribution[rating as keyof typeof ratingDistribution]++;
        ratingSum += rating;
        ratedCount++;

        return {
          id: String(row.id),
          libraryId: String(row.libraryId),
          librarySlug: row.librarySlug ? String(row.librarySlug) : null,
          studentId: row.studentId ? String(row.studentId) : null,
          userName: String(row.userName || "Student"),
          userAvatar: row.userAvatar ? String(row.userAvatar) : null,
          rating,
          content: String(row.content),
          source: (row.source === "LIBRARY_NEAR" ? "LIBRARY_NEAR" : "FOCUSX") as ReviewSource,
          createdAt: new Date(row.createdAt).toISOString(),
        };
      });

      const averageRating = ratedCount > 0 ? Number((ratingSum / ratedCount).toFixed(1)) : 0;

      return {
        reviews,
        averageRating,
        totalReviews: reviews.length,
        ratingDistribution,
      };
    } catch (err) {
      console.warn("[Reviews] Failed querying external shared database, falling back to local:", err);
    }
  }

  // PATH 2: Local Database (Prisma Query Table)
  const queries = await prisma.query.findMany({
    where: {
      libraryId: targetId,
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

  const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let ratingSum = 0;
  let ratedCount = 0;

  const reviews: LibraryReview[] = queries.map((q) => {
    const rawRating = q.rating ?? 5;
    const clampedRating = Math.max(1, Math.min(5, rawRating));
    const parsed = parseReviewContent(q.content, q.student?.name || "Verified Student", q.student?.profilePhotoUrl);

    ratingDistribution[clampedRating as keyof typeof ratingDistribution]++;
    ratingSum += clampedRating;
    ratedCount++;

    return {
      id: q.id,
      libraryId: q.libraryId,
      librarySlug: parsed.librarySlug || targetSlug,
      studentId: q.studentId,
      userName: parsed.userName,
      userAvatar: parsed.userAvatar,
      rating: clampedRating,
      content: parsed.content,
      source: parsed.source,
      createdAt: q.createdAt.toISOString(),
    };
  });

  const averageRating = ratedCount > 0 ? Number((ratingSum / ratedCount).toFixed(1)) : 0;

  return {
    reviews,
    averageRating,
    totalReviews: reviews.length,
    ratingDistribution,
  };
}

/**
 * Creates a review.
 * 1. If REVIEWS_DATABASE_URL is set -> directly writes to the shared database.
 * 2. Otherwise -> writes to local database (Prisma Query table).
 */
export async function createLibraryReview(params: {
  libraryId: string;
  studentId: string;
  rating: number;
  content: string;
  source?: ReviewSource;
  authorName?: string;
  authorAvatar?: string;
}): Promise<LibraryReview> {
  const { libraryId, studentId, rating, content, source = "FOCUSX", authorName, authorAvatar } = params;

  const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));
  const resolved = await resolveLibraryIdentifiers(libraryId);
  const targetId = resolved ? resolved.id : libraryId;
  const targetSlug = resolved ? resolved.slug : generateLibrarySlug(libraryId);

  const pool = getExternalReviewsPool();

  // PATH 1: Direct Shared Database Access (External DB)
  if (pool) {
    try {
      const res = await pool.query(
        `INSERT INTO reviews (library_id, library_slug, user_id, user_name, user_avatar, rating, content, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, library_id, library_slug, user_id, user_name, user_avatar, rating, content, source, created_at`,
        [
          targetId,
          targetSlug,
          studentId,
          authorName || "Student",
          authorAvatar || null,
          clampedRating,
          content.trim(),
          source,
        ]
      );

      const row = res.rows[0];
      return {
        id: String(row.id),
        libraryId: String(row.library_id),
        librarySlug: row.library_slug ? String(row.library_slug) : targetSlug,
        studentId: row.user_id ? String(row.user_id) : studentId,
        userName: String(row.user_name || "Student"),
        userAvatar: row.user_avatar ? String(row.user_avatar) : null,
        rating: clampedRating,
        content: String(row.content),
        source,
        createdAt: new Date(row.created_at).toISOString(),
      };
    } catch (err) {
      console.warn("[Reviews] Failed inserting into external shared DB, writing to local DB:", err);
    }
  }

  // PATH 2: Local Database (Prisma Query Table)
  const storedContent = encodeReviewContent(
    content.trim(), 
    source, 
    authorName || "Student", 
    authorAvatar,
    targetSlug
  );

  const created = await prisma.query.create({
    data: {
      libraryId: targetId,
      studentId,
      type: "REVIEW",
      rating: clampedRating,
      content: storedContent,
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
  });

  return {
    id: created.id,
    libraryId: created.libraryId,
    librarySlug: targetSlug,
    studentId: created.studentId,
    userName: authorName || created.student?.name || "Student",
    userAvatar: authorAvatar || created.student?.profilePhotoUrl || null,
    rating: clampedRating,
    content: content.trim(),
    source,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * Synchronize a review from Library Near into FocusX.
 */
export async function syncReviewFromLibraryNear(params: {
  libraryId: string;
  rating: number;
  content: string;
  authorName: string;
  authorAvatar?: string;
  externalReviewId?: string;
}): Promise<LibraryReview> {
  const { libraryId, rating, content, authorName, authorAvatar } = params;

  let fallbackStudent = await prisma.user.findFirst({
    where: { role: "STUDENT" },
    select: { id: true, name: true },
  });

  if (!fallbackStudent) {
    fallbackStudent = await prisma.user.findFirst({
      select: { id: true, name: true },
    });
  }

  if (!fallbackStudent) {
    throw new Error("No user available to associate syndicated review");
  }

  return await createLibraryReview({
    libraryId,
    studentId: fallbackStudent.id,
    rating,
    content,
    source: "LIBRARY_NEAR",
    authorName,
    authorAvatar,
  });
}
