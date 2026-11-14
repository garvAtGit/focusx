import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { diagnosticStorageId, diagnosticWireId } from "@/lib/diagnostic-policy";
import { assembleCrashDump } from "@/lib/hardware-crash-dump";

export const dynamic = "force-dynamic";

/** Core dumps contain sensitive memory. Only administrators can download them. */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized || auth.user?.role !== "ADMIN") return NextResponse.json({ error: "Administrator session required" }, { status: 401 });
  const relayId = request.nextUrl.searchParams.get("relayId");
  if (!relayId) return NextResponse.json({ error: "relayId required" }, { status: 400 });
  const meta = await prisma.deviceDiagnosticLog.findFirst({
    where: { relayId, eventCode: 1011 }, orderBy: { serverReceivedAt: "desc" },
  });
  if (!meta) return NextResponse.json({ error: "No crash dump uploaded" }, { status: 404 });
  const prefix = diagnosticWireId(relayId, meta.eventId).replace(/_meta$/, "");
  const chunks = await prisma.deviceDiagnosticLog.findMany({
    where: { relayId, eventCode: 1010, eventId: { startsWith: diagnosticStorageId(relayId, `${prefix}_`) } },
    take: 4096,
  });
  try {
    const bytes = assembleCrashDump(prefix, Number(meta.param2), chunks.map((c) => ({ offset: c.param1 ?? -1, hex: c.detail ?? "" })));
    return new NextResponse(bytes, { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${prefix}.bin"`,
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return NextResponse.json({ error: "Crash dump incomplete or corrupt", receivedChunks: chunks.length }, { status: 409 });
  }
}
