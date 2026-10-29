import prisma from "@/lib/prisma"
import { SettingsClient } from "./SettingsClient"
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { hasPermission } from "@/lib/permissions";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);
  if (!library) {
    redirect("/onboarding");
  }

  const canView = await hasPermission(session, library.id, 'settings.view');
  if (!canView) {
    redirect("/dashboard");
  }

  return <SettingsClient library={library} />
}
