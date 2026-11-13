import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { AdminMachinesClient } from "./AdminMachinesClient";
import { redis } from "@/lib/redis";
import { getCachedAdminData } from "@/lib/admin-cache";

export const dynamic = "force-dynamic";

export default async function AdminMachinesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  // Fetch all libraries with their relays (cached for 30s)
  const libraries = await getCachedAdminData("machines:fleet", async () => {
    return prisma.library.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        managerName: true,
        managerPhone: true,
        relays: {
          select: {
            id: true,
            macAddress: true,
            bleReaderId: true,
            nfcTagId: true,
            status: true,
            lastSync: true,
            lastSeenAt: true,
            pendingCommand: true,
            firmwareVersion: true,
            lastScreenLine0: true,
            lastScreenLine1: true,
            lastScreenBacklight: true,
            lastScreenUpdatedAt: true,
            diagQueueDepth: true,
            diagDroppedCount: true,
            lastDiagAckAt: true,
            resetReason: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }, 30);

  // Batched non-blocking fetch for relay module diagnostics (single mget roundtrip vs N requests)
  const allRelays = libraries.flatMap((l) => l.relays);
  const initialModulesMap: Record<string, any> = {};

  if (allRelays.length > 0) {
    try {
      const relayKeys = allRelays.map((relay) => `relay:modules:${relay.id}`);
      const rawList = await redis.mget<(string | object | null)[]>(...relayKeys);
      allRelays.forEach((relay, idx) => {
        const raw = rawList?.[idx];
        if (raw) {
          initialModulesMap[relay.id] = typeof raw === "string" ? JSON.parse(raw) : raw;
        }
      });
    } catch {
      // ignore cache miss
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-sans pb-12">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-[#2781CA] border border-blue-100">
              FocusX IoT Telemetry
            </span>
            <span className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Gateway Active
            </span>
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none">
            Libraries & Hardware Machines
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Realtime ESP32 relay heartbeat, multi-reader NFC telemetry, and remote gate actuation across all libraries.
          </p>
        </div>
      </div>

      <AdminMachinesClient libraries={libraries} initialModulesMap={initialModulesMap} />
    </div>
  );
}
