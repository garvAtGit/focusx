import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { advanceRolloutBatch } from "@/lib/ota-rollout-service";

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
    const updatedRollout = await advanceRolloutBatch(id, baseUrl);
    return NextResponse.json({
      success: true,
      message: `Rollout successfully advanced to batch ${updatedRollout?.currentBatch} of ${updatedRollout?.totalBatches}`,
      rollout: updatedRollout,
    });
  } catch (error: any) {
    console.error("[Advance Rollout Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to advance rollout batch." }, { status: 400 });
  }
}
