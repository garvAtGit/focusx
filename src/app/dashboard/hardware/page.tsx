import fs from "fs";
import path from "path";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { hasPermission } from "@/lib/permissions";
import HardwareSetupClient from "./HardwareSetupClient";

export default async function HardwareSetupPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const canView = await hasPermission(session, library.id, 'hardware.view');
  if (!canView) {
    redirect("/dashboard");
  }

  // Fetch current relays (hardware) for this library
  const hardware = await prisma.relay.findMany({
    where: { libraryId: library.id },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch recent OTA execution logs for persistent fleet observability
  const otaLogs = await prisma.entryLog.findMany({
    where: { libraryId: library.id, doorId: "OTA" },
    orderBy: { timestamp: 'desc' },
    take: 10
  });

  // Dynamically resolve latest release version from staged manifest
  let latestReleaseVersion = "5.1.1-ota";
  try {
    const manifestPath = path.join(process.cwd(), "firmware_releases", "manifest.json");
    if (fs.existsSync(manifestPath)) {
      const mf = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (mf?.version) latestReleaseVersion = mf.version;
    }
  } catch {}

  return (
    <div className="p-8 max-w-4xl mx-auto flex-1 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Hardware Setup</h1>
        <p className="text-slate-500">Pair and manage your FocusX ESP32 Beacons for seamless attendance.</p>
      </div>

      <HardwareSetupClient 
        libraryId={library.id} 
        initialHardware={hardware}
        otaLogs={otaLogs}
        latestReleaseVersion={latestReleaseVersion}
      />
    </div>
  );
}
