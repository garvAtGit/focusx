import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import prisma from "@/lib/prisma";
import { RulesClient } from "./RulesClient";

export default async function AutomationsPage() {
  const session = await getSession();
  if (!session || (session.role !== "LIBRARIAN" && session.role !== "ADMIN")) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const rules = await prisma.libraryRule.findMany({
    where: { libraryId: library.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">
          Automations
        </h1>
        <p className="text-muted-foreground mt-1">
          Set rules that automatically take action when something happens — no
          code required.
        </p>
      </div>
      <RulesClient initialRules={rules} />
    </div>
  );
}
