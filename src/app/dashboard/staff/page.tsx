import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { removeReceptionist } from "@/app/actions/staff-actions";
import { Trash2, UserPlus, Shield } from "lucide-react";
import { StaffForm } from "./StaffForm";
import { getActiveLibrary } from "@/lib/dashboard-utils";

export default async function StaffPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);

  if (!library) redirect("/onboarding");

  const staff = await prisma.user.findMany({
    where: { employerLibraryId: library.id, role: 'RECEPTIONIST' },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Staff & Roles</h1>
        <p className="text-muted-foreground mt-1">Manage who has access to your library&apos;s dashboard.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-heading">Add Receptionist</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Receptionists can manage students, bookings, and inquiries, but cannot view financials or edit plans.
          </p>

          <StaffForm />
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col min-h-[400px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-muted text-foreground rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-heading">Active Staff</h2>
          </div>

          <div className="flex-1 space-y-4">
            {staff.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-xl bg-muted/20">
                No staff members added yet.
              </div>
            ) : (
              staff.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="font-bold text-foreground">{user.name}</h3>
                    <p className="text-sm text-muted-foreground">{user.phone}</p>
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Receptionist
                    </span>
                  </div>
                  <form action={async () => {
                    'use server'
                    await removeReceptionist(user.id);
                  }}>
                    <button 
                      type="submit" 
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Revoke Access"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
