import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import {
  getAvailableReleases,
  getFleetInventory,
  listRollouts,
  getRolloutDetails,
} from "@/lib/ota-rollout-service";
import { OtaFleetClient } from "./OtaFleetClient";

export const dynamic = "force-dynamic";

export default async function AdminOtaFleetPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/admin/login");
  }

  const releases = getAvailableReleases("https://www.focusx.in");
  const devices = await getFleetInventory();
  const rollouts = await listRollouts();

  // Load details for the most recent active or latest rollout
  let initialRolloutDetails = null;
  const activeRollout = rollouts.find((r) => r.status === "ACTIVE") || rollouts[0];
  if (activeRollout) {
    initialRolloutDetails = await getRolloutDetails(activeRollout.id);
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      <OtaFleetClient
        initialReleases={releases}
        initialDevices={devices}
        initialRollouts={rollouts}
        initialActiveRollout={initialRolloutDetails}
      />
    </div>
  );
}
