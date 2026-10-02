import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import HardwareSetupClient from "./HardwareSetupClient";

export default async function HardwareSetupPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    redirect("/");
  }

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  // Fetch current relays (hardware) for this library
  const hardware = await prisma.relay.findMany({
    where: { libraryId: library.id },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-8 max-w-4xl mx-auto flex-1 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Hardware Setup</h1>
        <p className="text-slate-500">Pair and manage your FocusX ESP32 Beacons for seamless attendance.</p>
      </div>

      <HardwareSetupClient libraryId={library.id} initialHardware={hardware} />
    </div>
  );
}
