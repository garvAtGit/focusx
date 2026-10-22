import prisma from "@/lib/prisma";
import { QueriesClient } from "./QueriesClient";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { MessageSquare, Calendar, ArrowRight, UserCircle2, Clock } from "lucide-react";
import { getActiveLibrary } from "@/lib/dashboard-utils";

export default async function QueriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const { hasPermission } = await import("@/lib/permissions");
  const canView = await hasPermission(session, library.id, 'queries.view');
  if (!canView) redirect("/dashboard");

  const queries = await prisma.query.findMany({
    where: { libraryId: library.id },
    include: {
      student: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <QueriesClient queries={queries} />
    </div>
  );
}
