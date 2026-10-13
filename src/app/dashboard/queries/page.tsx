import prisma from "@/lib/prisma";
import { QueriesClient } from "./QueriesClient";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { getActiveLibrary } from "@/lib/dashboard-utils";

export default async function QueriesPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) redirect("/login");

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const queries = await prisma.query.findMany({
    where: { libraryId: library.id },
    include: {
      student: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const reviewQueries = queries.filter((q) => q.type === "REVIEW");
  const reviewStudentIds = Array.from(new Set(reviewQueries.map((q) => q.studentId)));
  const confirmedBookings = reviewStudentIds.length > 0 ? await prisma.booking.findMany({
    where: {
      libraryId: library.id,
      studentId: { in: reviewStudentIds },
      status: { in: ["CONFIRMED", "COMPLETED"] }
    },
    select: { studentId: true }
  }) : [];
  const enrolledStudentIds = new Set(confirmedBookings.map((b) => b.studentId));

  const queriesWithVerification = queries.map((q) => ({
    ...q,
    isVerified: q.type === "REVIEW" ? enrolledStudentIds.has(q.studentId) : false
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <QueriesClient queries={queriesWithVerification} />
    </div>
  );
}
