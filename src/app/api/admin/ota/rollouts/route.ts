import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { listRollouts, createFleetRollout } from "@/lib/ota-rollout-service";

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.statusCode || 401 });
  }

  const rollouts = await listRollouts();
  return NextResponse.json({ rollouts });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.statusCode || 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      name,
      targetVersion,
      deviceIds,
      libraryId,
      onlyOutdated,
      batchStrategy,
      customBatches,
      autoDispatchFirstBatch,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Rollout name is required." }, { status: 400 });
    }
    if (!targetVersion || !targetVersion.trim()) {
      return NextResponse.json({ error: "Target firmware version is required." }, { status: 400 });
    }

    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "www.focusx.in";
    const baseUrl = `${protocol}://${host}`;

    const rollout = await createFleetRollout({
      name: name.trim(),
      targetVersion: targetVersion.trim(),
      deviceIds: Array.isArray(deviceIds) ? deviceIds : undefined,
      libraryId: typeof libraryId === "string" ? libraryId : undefined,
      onlyOutdated: Boolean(onlyOutdated),
      batchStrategy,
      customBatches,
      createdById: auth.user?.userId || "admin",
      autoDispatchFirstBatch: autoDispatchFirstBatch !== false,
      baseUrl,
    });

    return NextResponse.json({ success: true, rollout }, { status: 201 });
  } catch (error: any) {
    console.error("[Create Rollout Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create rollout." },
      { status: error.message?.includes("not found") ? 404 : 400 }
    );
  }
}
