import { getSession } from "@/app/actions/auth-actions";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { redirect } from "next/navigation";
import { HistoryClient } from "./HistoryClient";

export const metadata = {
  title: "Activity History | FocusX Dashboard",
  description: "View plain-English chronological audit logs of all staff and receptionist actions.",
};

export default async function HistoryPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "LIBRARIAN" && session.role !== "ADMIN" && session.role !== "RECEPTIONIST")
  ) {
    redirect("/");
  }

  const library = await getActiveLibrary(session);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <HistoryClient initialLibraryId={library?.id} />
    </div>
  );
}
