import { NextRequest } from "next/server";
import { getSession } from "@/app/actions/auth-actions";
import { verifyRelayKey } from "@/lib/relay-auth";
import crypto from "crypto";

export interface AdminAuthResult {
  authorized: boolean;
  error?: string;
  statusCode?: number;
  user?: any;
  isKeyAuth?: boolean;
}

/**
 * Validates administrative access for fleet and rollout management operations.
 * Accepts:
 * 1. An authenticated administrator session (role === 'ADMIN').
 * 2. An authenticated administrative bearer token or API key (RELAY_API_KEY or ADMIN_API_KEY).
 */
export async function verifyAdminAuth(request: Request | NextRequest): Promise<AdminAuthResult> {
  // 1. Check API Key in headers (Authorization: Bearer ... or x-api-key)
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");
  const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : apiKeyHeader;

  if (rawKey) {
    if (verifyRelayKey(rawKey)) {
      return { authorized: true, isKeyAuth: true };
    }

    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey && adminKey.trim()) {
      const a = crypto.createHash("sha256").update(rawKey.trim()).digest();
      const b = crypto.createHash("sha256").update(adminKey.trim()).digest();
      try {
        if (crypto.timingSafeEqual(a, b)) {
          return { authorized: true, isKeyAuth: true };
        }
      } catch {
        // Fall through
      }
    }
  }

  // 2. Check Session Cookie via getSession()
  try {
    const session = await getSession();
    if (session && session.role === "ADMIN") {
      return { authorized: true, user: session };
    }
  } catch {
    // Session parsing error
  }

  return {
    authorized: false,
    error: "Unauthorized: Super Administrator privileges or valid administrative key required",
    statusCode: 401,
  };
}
