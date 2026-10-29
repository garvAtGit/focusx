import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { retryDeviceRollout, retryRolloutFailed, getRolloutDetails } from "@/lib/ota-rollout-service";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.statusCode || 401 });
  }

  const { id } = await props.params;
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || "www.focusx.in";
  const baseUrl = `${protocol}://${host}`;

  try {
    const body = await request.json().catch(() => ({}));
    const { deviceRolloutId } = body;

    if (deviceRolloutId) {
      const retried = await retryDeviceRollout(deviceRolloutId, baseUrl);
      const rollout = await getRolloutDetails(id);
      return NextResponse.json({
        success: true,
        message: "Device update retry successfully queued.",
        retriedDevice: retried,
        rollout,
      });
    } else {
      const result = await retryRolloutFailed(id, baseUrl);
      const rollout = await getRolloutDetails(id);
      return NextResponse.json({
        success: true,
        message: `Retried ${result.retriedCount} of ${result.totalFailed} failed device(s).`,
        result,
        rollout,
      });
    }
  } catch (error: any) {
    console.error("[Retry Rollout Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to retry rollout." }, { status: 400 });
  }
}
