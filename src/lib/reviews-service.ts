import prisma from "@/lib/prisma";
import { Pool } from "pg";

export type ReviewSource = "FOCUSX" | "LIBRARY_NEAR" | "GOOGLE";

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
 * Normalizes a Supabase connection URL.
 * Automatically translates direct hostnames (db.<ref>.supabase.co:5432), which fail
 * on IPv4 networks due to lack of A records, into the resilient IPv4 Supabase pooler host.
 */
function normalizeSupabaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const match = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (match) {
      const projectRef = match[1];
      const user = parsed.username.includes(".") ? parsed.username : `postgres.${projectRef}`;
      const password = parsed.password;
      const host = "aws-1-ap-southeast-1.pooler.supabase.com";
      const port = "6543";
      const db = parsed.pathname || "/postgres";
      return `postgresql://${user}:${password}@${host}:${port}${db}`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
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
    const normalized = normalizeSupabaseUrl(connectionString);
    globalForReviews.reviewsPool = new Pool({
      connectionString: normalized,
      max: 5,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: false },
    });

    globalForReviews.reviewsPool.on("error", (err) => {
      console.warn("[Reviews Pool] External database background pool error:", err.message);
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

/**
 * Sanitizes phone numbers to standard 10 digits for indexing and cross-DB matching.
 */
function sanitizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits.length > 0 ? digits : null;
}

function cleanAlphaNumeric(raw?: string | null): string {
  if (!raw) return "";
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
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
  if (source === "LIBRARY_NEAR" || source === "GOOGLE" || librarySlug) {
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

interface FocusXLibraryInfo {
  id: string;
  name: string;
  locality?: string | null;
  city?: string | null;
  whatsapp?: string | null;
  managerPhone?: string | null;
  slug: string;
}

/**
 * Resolves a library's details from FocusX database.
 */
async function resolveFocusXLibrary(libraryIdOrSlug: string): Promise<FocusXLibraryInfo | null> {
  const lib = await prisma.library.findFirst({
    where: {
      OR: [
        { id: libraryIdOrSlug },
      ],
    },
    select: { 
      id: true, 
      name: true, 
      locality: true, 
      city: true, 
      whatsapp: true, 
      managerPhone: true 
    },
  });

  if (!lib) return null;

  return {
    id: lib.id,
    name: lib.name,
    locality: lib.locality,
    city: lib.city,
    whatsapp: lib.whatsapp,
    managerPhone: lib.managerPhone,
    slug: generateLibrarySlug(lib.name, lib.locality),
  };
}

interface RemoteBranchMatch {
  id: string;
  name: string;
  slug: string;
  locality?: string | null;
}

/**
 * Finds matching branch IDs in LibraryNear Supabase database using:
 * 1. Exact UUID match (if input is already a LibraryNear UUID)
 * 2. 10-digit phone number match (phone_number or whatsapp_number)
 * 3. Exact slug match
 * 4. Cleaned alphanumeric name & locality match
 */
async function findRemoteBranches(
  pool: Pool,
  targetId: string,
  targetSlug: string,
  focusLib?: FocusXLibraryInfo | null
): Promise<RemoteBranchMatch[]> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

    // 1. Direct UUID match on branch ID
    if (isUuid) {
      const res = await pool.query(
        "SELECT id, name, slug, locality FROM public.library_branches WHERE id = $1 LIMIT 5",
        [targetId]
      );
      if (res.rowCount && res.rowCount > 0) {
        return res.rows;
      }
    }

    // 2. Phone match if FocusX library has phone numbers
    if (focusLib) {
      const phone1 = sanitizePhone(focusLib.whatsapp);
      const phone2 = sanitizePhone(focusLib.managerPhone);
      const phones = Array.from(new Set([phone1, phone2].filter(Boolean))) as string[];

      if (phones.length > 0) {
        const placeholders = phones.map((_, i) => `$${i + 1}`).join(", ");
        const phoneRes = await pool.query(
          `SELECT id, name, slug, locality 
           FROM public.library_branches 
           WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE ANY(ARRAY[${placeholders}]::text[])
              OR regexp_replace(whatsapp_number, '[^0-9]', '', 'g') LIKE ANY(ARRAY[${placeholders}]::text[])
           LIMIT 5`,
          phones.map(p => `%${p}`)
        );
        if (phoneRes.rowCount && phoneRes.rowCount > 0) {
          return phoneRes.rows;
        }
      }
    }

    // 3. Exact Slug match
    if (targetSlug) {
      const slugRes = await pool.query(
        "SELECT id, name, slug, locality FROM public.library_branches WHERE slug = $1 LIMIT 5",
        [targetSlug]
      );
      if (slugRes.rowCount && slugRes.rowCount > 0) {
        return slugRes.rows;
      }
    }

    // 4. Clean Alphanumeric Name match
    const nameClean = cleanAlphaNumeric(focusLib?.name || targetId);
    if (nameClean.length >= 3) {
      const nameRes = await pool.query(
        `SELECT id, name, slug, locality 
         FROM public.library_branches 
         WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = $1
         LIMIT 5`,
        [nameClean]
      );
      if (nameRes.rowCount && nameRes.rowCount > 0) {
        return nameRes.rows;
      }
    }
  } catch (err) {
    console.warn("[Reviews] Error matching remote branch:", err);
  }

  return [];
}

/**
 * Fetch all reviews for a library.
 * Integrates:
 * 1. Local student reviews from FocusX database (Prisma Query table).
 * 2. External reviews from LibraryNear database (Supabase pooler).
 * Deduplicates, normalizes ratings, and computes rating distribution.
 */
export async function getLibraryReviews(libraryIdOrSlug: string): Promise<LibraryReviewsSummary> {
  const resolvedLib = await resolveFocusXLibrary(libraryIdOrSlug);
  const targetId = resolvedLib ? resolvedLib.id : libraryIdOrSlug;
  const targetSlug = resolvedLib ? resolvedLib.slug : generateLibrarySlug(libraryIdOrSlug);

  const localReviews: LibraryReview[] = [];
  const remoteReviews: LibraryReview[] = [];

  // ==========================================
  // PATH 1: Local FocusX Database (Prisma)
  // ==========================================
  try {
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

    for (const q of queries) {
      const rawRating = q.rating ?? 5;
      const clampedRating = Math.max(1, Math.min(5, Math.round(rawRating)));
      const parsed = parseReviewContent(q.content, q.student?.name || "Verified Student", q.student?.profilePhotoUrl);

      localReviews.push({
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
      });
    }
  } catch (err) {
    console.warn("[Reviews] Failed querying local Prisma reviews:", err);
  }

  // ==========================================
  // PATH 2: External LibraryNear Supabase Pooler
  // ==========================================
  const pool = getExternalReviewsPool();
  if (pool) {
    try {
      const branches = await findRemoteBranches(pool, targetId, targetSlug, resolvedLib);
      if (branches.length > 0) {
        const branchIds = branches.map((b) => b.id);
        const res = await pool.query(
          `SELECT 
            r.id, 
            r.library_branch_id, 
            r.rating, 
            r.review_text, 
            r.created_at, 
            r.source, 
            COALESCE(r.reviewer_name, p.full_name, 'Student') AS reviewer_name,
            COALESCE(r.reviewer_photo_url, p.avatar_url) AS reviewer_photo_url,
            b.slug AS branch_slug
           FROM public.library_reviews r
           LEFT JOIN public.profiles p ON r.user_id = p.id
           LEFT JOIN public.library_branches b ON r.library_branch_id = b.id
           WHERE r.library_branch_id = ANY($1::uuid[])
             AND (r.status = 'published' OR r.status IS NULL)
           ORDER BY r.created_at DESC`,
          [branchIds]
        );

        for (const row of res.rows) {
          const rating = Math.max(1, Math.min(5, Math.round(row.rating || 5)));
          const rawSource = String(row.source || "").toLowerCase();
          const source: ReviewSource = rawSource === "google" ? "GOOGLE" : "LIBRARY_NEAR";

          remoteReviews.push({
            id: String(row.id),
            libraryId: targetId,
            librarySlug: row.branch_slug || targetSlug,
            studentId: null,
            userName: String(row.reviewer_name || "Student"),
            userAvatar: row.reviewer_photo_url ? String(row.reviewer_photo_url) : null,
            rating,
            content: String(row.review_text || ""),
            source,
            createdAt: new Date(row.created_at).toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn("[Reviews] Failed querying external LibraryNear database (fallback to local):", err);
    }
  }

  // ==========================================
  // DEDUPLICATION & AGGREGATION
  // ==========================================
  const seenKeys = new Set<string>();
  const mergedReviews: LibraryReview[] = [];

  // FocusX local reviews take priority for identity
  for (const r of [...localReviews, ...remoteReviews]) {
    // Generate a deduplication fingerprint based on content + userName + rating
    const snippet = r.content.slice(0, 40).toLowerCase().trim();
    const key = `${r.userName.toLowerCase()}-${r.rating}-${snippet}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedReviews.push(r);
    }
  }

  // Sort descending by date
  mergedReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Compute distribution and average
  const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let ratingSum = 0;
  let ratedCount = 0;

  for (const rev of mergedReviews) {
    const ratingKey = rev.rating as keyof typeof ratingDistribution;
    if (ratingDistribution[ratingKey] !== undefined) {
      ratingDistribution[ratingKey]++;
    }
    ratingSum += rev.rating;
    ratedCount++;
  }

  const averageRating = ratedCount > 0 ? Number((ratingSum / ratedCount).toFixed(1)) : 0;

  return {
    reviews: mergedReviews,
    averageRating,
    totalReviews: mergedReviews.length,
    ratingDistribution,
  };
}

/**
 * Creates a review.
 * 1. Always saves to the local FocusX database (Prisma Query table) for guaranteed persistence.
 * 2. If REVIEWS_DATABASE_URL is set and matching LibraryNear branch exists, syndicates to LibraryNear.
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

  const resolvedLib = await resolveFocusXLibrary(libraryId);
  const targetId = resolvedLib ? resolvedLib.id : libraryId;
  const targetSlug = resolvedLib ? resolvedLib.slug : generateLibrarySlug(libraryId);

  // 1. Create locally in FocusX Prisma
  const storedContent = encodeReviewContent(
    content.trim(), 
    source, 
    authorName || "Student", 
    authorAvatar,
    targetSlug
  );

  const localQuery = await prisma.query.create({
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

  const finalUserName = authorName || localQuery.student?.name || "Student";
  const finalUserAvatar = authorAvatar || localQuery.student?.profilePhotoUrl || null;

  // 2. Syndicate to LibraryNear Supabase pooler if configured
  const pool = getExternalReviewsPool();
  if (pool) {
    try {
      const branches = await findRemoteBranches(pool, targetId, targetSlug, resolvedLib);
      if (branches.length > 0) {
        const primaryBranch = branches[0];
        await pool.query(
          `INSERT INTO public.library_reviews (
            library_branch_id, 
            user_id, 
            rating, 
            review_text, 
            status, 
            reviewer_name, 
            reviewer_photo_url, 
            source,
            created_at,
            updated_at
          ) VALUES ($1, NULL, $2, $3, 'published', $4, $5, 'user', NOW(), NOW())`,
          [
            primaryBranch.id,
            clampedRating,
            content.trim(),
            finalUserName,
            finalUserAvatar,
          ]
        );
      }
    } catch (err) {
      console.warn("[Reviews] Failed syndicating review to LibraryNear external DB:", err);
    }
  }

  return {
    id: localQuery.id,
    libraryId: targetId,
    librarySlug: targetSlug,
    studentId,
    userName: finalUserName,
    userAvatar: finalUserAvatar,
    rating: clampedRating,
    content: content.trim(),
    source,
    createdAt: localQuery.createdAt.toISOString(),
  };
}

/**
 * Synchronize a review pushed from LibraryNear into FocusX.
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
