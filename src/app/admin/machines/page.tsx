import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { AdminMachinesClient } from "./AdminMachinesClient";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export default async function AdminMachinesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/");

  // Fetch all libraries with their relays
  const libraries = await prisma.library.findMany({
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
          createdAt: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Fetch cached module diagnostics from Redis
  const initialModulesMap: Record<string, any> = {};
  for (const lib of libraries) {
    for (const relay of lib.relays) {
      try {
        const raw = await redis.get<string | object>(`relay:modules:${relay.id}`);
        if (raw) {
          initialModulesMap[relay.id] = typeof raw === "string" ? JSON.parse(raw) : raw;
        }
      } catch (err) {
        // ignore cache miss
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Libraries & Hardware Machines</h1>
        <p className="text-muted-foreground mt-1">
          Monitor all library machines live, inspect real-time component health, and execute remote hardware commands.
        </p>
      </div>

      <AdminMachinesClient libraries={libraries} initialModulesMap={initialModulesMap} />
    </div>
  );
}
