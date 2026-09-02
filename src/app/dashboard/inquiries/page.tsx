import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Mail, Phone, Calendar, ArrowRight, UserCircle2 } from "lucide-react";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { InquiriesClient } from "./InquiriesClient";

export default async function InquiriesPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) redirect("/login");

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const inquiries = await prisma.inquiry.findMany({
    where: { libraryId: library.id },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Inquiries & Leads</h1>
        <p className="text-muted-foreground mt-1">Manage prospective students who contacted you from the library page.</p>
      </div>
      
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <InquiriesClient initialInquiries={inquiries} libraryId={library.id} />
      </div>
    </div>
  )
}
