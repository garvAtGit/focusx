import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { getRolloutDetails } from "@/lib/ota-rollout-service";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.statusCode || 401 });
  }

  const { id } = await props.params;
  const rollout = await getRolloutDetails(id);

  if (!rollout) {
    return NextResponse.json({ error: "Rollout not found" }, { status: 404 });
  }

  return NextResponse.json({ rollout });
}
