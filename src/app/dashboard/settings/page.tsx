import prisma from "@/lib/prisma"
import { SettingsClient } from "./SettingsClient"
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { getActiveLibrary } from "@/lib/dashboard-utils";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);
  
  if (!library) {
    redirect("/onboarding");
  }

  return <SettingsClient library={library} />
}
