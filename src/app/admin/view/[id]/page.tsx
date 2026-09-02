import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, X, Edit, ArrowLeft, MapPin, Building, CreditCard, Users } from "lucide-react";
import { approveLibrary, rejectLibrary } from "@/app/actions/admin-actions";
import { getSession } from "@/app/actions/auth-actions";

export default async function AdminViewLibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect("/");
  
  const { id } = await params;
  
  const library = await prisma.library.findUnique({
    where: { id },
    include: { librarian: true }
  });

  if (!library) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/admin/edit/${library.id}`} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2">
            <Edit className="w-4 h-4" /> Edit Details
          </Link>
          <form action={async () => { "use server"; await rejectLibrary(library.id); }}>
            <button type="submit" className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive/20 transition-colors flex items-center gap-2">
              <X className="w-4 h-4" /> Reject
            </button>
          </form>
          <form action={async () => { "use server"; await approveLibrary(library.id); }}>
            <button type="submit" className="px-4 py-2 bg-success text-success-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
              <Check className="w-4 h-4" /> Approve
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
            {library.name}
            <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wide ${
              library.kycStatus === 'APPROVED' ? 'bg-success/10 text-success' : 
              library.kycStatus === 'REJECTED' ? 'bg-destructive/10 text-destructive' : 
              'bg-warning/10 text-warning'
            }`}>
              {library.kycStatus}
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> {library.address}, {library.city}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-primary" /> Basic Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Manager Name</p>
                <p className="font-medium text-foreground">{library.managerName || "N/A"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Manager Phone</p>
                <p className="font-medium text-foreground">{library.managerPhone || "N/A"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Librarian Email</p>
                <p className="font-medium text-foreground">{library.librarian.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">WhatsApp</p>
                <p className="font-medium text-foreground">{library.whatsapp || "N/A"}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-primary" /> KYC & Passbook Document
            </h2>
            {library.passbookPhoto ? (
              <div className="rounded-xl overflow-hidden border border-border">
                {/* Admins preview user-uploaded URLs from arbitrary providers. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={library.passbookPhoto} alt="Passbook/KYC Document" className="w-full h-auto object-contain max-h-[500px] bg-muted/50" />
              </div>
            ) : (
              <div className="bg-muted/50 rounded-xl p-8 text-center text-muted-foreground border border-dashed border-border">
                No passbook or KYC document uploaded yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" /> Details
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Available Seats</p>
                <p className="font-medium text-foreground">{library.seatsAvailable || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Timings</p>
                <p className="font-medium text-foreground">{library.openingTime || "N/A"} - {library.closingTime || "N/A"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Facilities</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {library.facilities.map(f => (
                    <span key={f} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs font-medium">{f}</span>
                  ))}
                  {library.facilities.length === 0 && <span className="text-muted-foreground">None listed</span>}
                </div>
              </div>
            </div>
          </div>
          
          {library.photos.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Library Photos</h2>
              <div className="space-y-3">
                {library.photos.map((url, i) => (
                  // Library uploads may use arbitrary providers.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Library photo ${i+1}`} className="w-full rounded-lg border border-border object-cover aspect-video" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
