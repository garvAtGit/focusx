import { adminAuth } from "@/lib/firebase/firebaseAdmin"
import prisma from "@/lib/prisma"

export type MobileAuthResult = {
  userId: string
  role: string
  employerLibraryId: string | null
}

/**
 * Extracts and verifies Firebase identity from the standard
 * Authorization: Bearer <Firebase ID Token> header.
 *
 * Returns the canonical User record mapped from Firebase UID,
 * or null if authentication fails.
 *
 * This is the single auth entry-point for all /api/mobile/* routes.
 * No token in JSON body. No cookie session fallback.
 */
export async function authenticateMobileRequest(
  req: Request,
): Promise<MobileAuthResult | null> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const idToken = authHeader.slice(7).trim()
  if (!idToken || !adminAuth) return null

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true)
    const user = await prisma.user.findUnique({
      where: { authId: decoded.uid },
      select: { id: true, role: true, employerLibraryId: true },
    })
    if (!user) return null

    return {
      userId: user.id,
      role: user.role,
      employerLibraryId: user.employerLibraryId,
    }
  } catch (error) {
    console.error("[mobile-auth] Firebase token verification failed:", error)
    return null
  }
}
