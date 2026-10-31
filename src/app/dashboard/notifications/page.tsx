import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { getLibrarianBroadcastHistory } from "@/lib/notifications";
import LibrarianNotificationsView from "./librarian-notifications-view";

export const dynamic = "force-dynamic";

export default async function LibrarianNotificationsPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "LIBRARIAN" && session.role !== "ADMIN" && session.role !== "RECEPTIONIST")
  ) {
    redirect("/login");
  }

  let libraries: Array<{ id: string; name: string; city: string | null; address: string }> = [];

  if (session.role === "ADMIN") {
    libraries = await prisma.library.findMany({
      select: { id: true, name: true, city: true, address: true },
      orderBy: { name: "asc" },
    });
  } else {
    libraries = await prisma.library.findMany({
      where: {
        OR: [
          { librarianId: session.userId },
          ...(session.employerLibraryId ? [{ id: session.employerLibraryId }] : []),
          { staffMemberships: { some: { userId: session.userId, status: 'ACTIVE' } } },
        ],
      },
      select: { id: true, name: true, city: true, address: true },
      orderBy: { name: "asc" },
    });
  }

  if (libraries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h2 className="text-xl font-bold text-foreground">No Managed Library Found</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your account is not currently linked as an active librarian or staff member for any registered library.
        </p>
      </div>
    );
  }

  const initialLibraryId = libraries[0].id;
  let broadcasts: any[] = [];
  try {
    const historyData = await getLibrarianBroadcastHistory(initialLibraryId, { page: 1, limit: 20 });
    broadcasts = JSON.parse(JSON.stringify(historyData.broadcasts || []));
  } catch (err) {
    console.error("[LibrarianNotificationsPage] Failed to load broadcast history:", err);
  }

  return (
    <div className="max-w-7xl mx-auto py-4">
      <LibrarianNotificationsView
        libraries={libraries}
        initialLibraryId={initialLibraryId}
        initialHistory={broadcasts}
      />
    </div>
  );
}
