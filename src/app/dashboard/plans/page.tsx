import prisma from "@/lib/prisma";
import { PlansClient } from "./PlansClient";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";

import { getActiveLibrary } from "@/lib/dashboard-utils";

export default async function ManagePlansPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) redirect("/login");

  const library = await getActiveLibrary(session);

  if (!library) redirect("/onboarding");

  // Fetch plans from live Supabase DB
  const plans = await prisma.plan.findMany({ where: { libraryId: library.id, isActive: true } });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PlansClient initialPlans={plans} />
    </div>
  );
}
