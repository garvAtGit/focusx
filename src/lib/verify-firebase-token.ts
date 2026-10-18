import { adminAuth } from "@/lib/firebase/firebaseAdmin"

export type VerifiedCaller =
  | { ok: true; uid: string; phone: string | null }
  | { ok: false; error: string }

/**
 * Server-side trust boundary for Firebase identity.
 *
 * Verifies a Firebase ID token and (optionally) confirms it belongs to the
 * phone number the caller claims. Every flow that creates, links, or elevates
 * an account MUST route through here instead of trusting a client-supplied
 * `authId`/`phone` string — otherwise an attacker can assert someone else's
 * identity by passing their UID/phone.
 */
export async function verifyFirebaseIdToken(
  idToken: string | null | undefined,
  expectedPhone?: string
): Promise<VerifiedCaller> {
  if (!adminAuth) return { ok: false, error: "Auth not initialized" }
  if (!idToken || typeof idToken !== "string") {
    return { ok: false, error: "Missing auth token" }
  }

  let decoded
  try {
    // checkRevoked=true rejects tokens from logged-out / disabled accounts.
    decoded = await adminAuth.verifyIdToken(idToken, true)
  } catch {
    return { ok: false, error: "Invalid auth credentials" }
  }

  const tokenPhone = (decoded.phone_number as string | undefined) ?? null

  if (expectedPhone) {
    const raw = expectedPhone.trim()
    const candidates = new Set<string>([
      raw,
      raw.startsWith("+91") ? raw.slice(3) : `+91${raw}`,
    ])
    if (!tokenPhone || !candidates.has(tokenPhone)) {
      return { ok: false, error: "Phone number does not match verified identity" }
    }
  }

  return { ok: true, uid: decoded.uid, phone: tokenPhone }
}
