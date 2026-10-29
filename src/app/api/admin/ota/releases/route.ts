import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { getAvailableReleases } from "@/lib/ota-rollout-service";

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.statusCode || 401 });
  }

  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || "www.focusx.in";
  const baseUrl = `${protocol}://${host}`;

  const releases = getAvailableReleases(baseUrl);
  return NextResponse.json({ releases });
}
