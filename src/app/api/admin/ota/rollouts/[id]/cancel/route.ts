import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { cancelRollout } from "@/lib/ota-rollout-service";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.statusCode || 401 });
  }

  const { id } = await props.params;

  try {
    const rollout = await cancelRollout(id);
    return NextResponse.json({
      success: true,
      message: "Rollout has been cancelled and non-dispatched devices halted.",
      rollout,
    });
  } catch (error: any) {
    console.error("[Cancel Rollout Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel rollout." }, { status: 400 });
  }
}
