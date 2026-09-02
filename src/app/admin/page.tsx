import prisma from "@/lib/prisma";
import Link from "next/link";
import { approveLibrary, rejectLibrary } from "@/app/actions/admin-actions";
import { Check, X, Eye, MapPin } from "lucide-react";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect("/");
  const pendingLibraries = await prisma.library.findMany({
    where: { kycStatus: "PENDING" },
    orderBy: { createdAt: "asc" }
  });

  const reviewedLibraries = await prisma.library.findMany({
    where: { kycStatus: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { updatedAt: "desc" },
    take: 10
  });

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-heading font-bold mb-2">Pending Approvals</h1>
        <p className="text-muted-foreground mb-6">Review and approve new libraries before they go live on the platform.</p>

        {pendingLibraries.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
            <Check className="w-12 h-12 text-success mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground">All caught up!</h3>
            <p className="text-muted-foreground mt-2">There are no libraries waiting for approval right now.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingLibraries.map((lib) => (
              <div key={lib.id} className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-6 md:items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold">{lib.name}</h2>
                    <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs font-bold rounded uppercase tracking-wide">
                      Pending
                    </span>
                  </div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-sm mb-3">
                    <MapPin className="w-4 h-4" /> {lib.address}
                  </p>
                  <div className="flex gap-4 text-sm mb-3">
                    <div><span className="text-muted-foreground">Manager:</span> {lib.managerName || "N/A"}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {lib.managerPhone || "N/A"}</div>
                    <div><span className="text-muted-foreground">Seats:</span> {lib.seatsAvailable || 0}</div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 w-fit px-2 py-1 rounded">
                    Received: {new Date(lib.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} (IST)
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/view/${lib.id}`} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2">
                    <Eye className="w-4 h-4" /> View Profile
                  </Link>
                  <form action={async () => { "use server"; await rejectLibrary(lib.id); }}>
                    <button type="submit" className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive/20 transition-colors flex items-center gap-2">
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </form>
                  <form action={async () => { "use server"; await approveLibrary(lib.id); }}>
                    <button type="submit" className="px-4 py-2 bg-success text-success-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-heading font-bold mb-6">Recently Reviewed</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Library Name</th>
                <th className="px-6 py-4 font-medium">Location</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviewedLibraries.map((lib) => (
                <tr key={lib.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{lib.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{lib.city || lib.address}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded uppercase tracking-wide ${
                      lib.kycStatus === "APPROVED" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {lib.kycStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/view/${lib.id}`} className="text-primary hover:underline font-medium flex items-center gap-1">
                      <Eye className="w-4 h-4" /> View Profile
                    </Link>
                  </td>
                </tr>
              ))}
              {reviewedLibraries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No recently reviewed libraries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
