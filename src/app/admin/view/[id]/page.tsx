import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, X, Edit, ArrowLeft, MapPin, Building, CreditCard, Users } from "lucide-react";
import { approveLibrary, rejectLibrary } from "@/app/actions/admin-actions";
import { getSession } from "@/app/actions/auth-actions";

export default async function AdminViewLibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect("/admin/login");
  
  const { id } = await params;
  
  const library = await prisma.library.findUnique({
    where: { id },
    include: { librarian: true }
  });

  if (!library) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans pb-12">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
        <Link href="/admin/libraries" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-bold">
          <ArrowLeft className="w-4 h-4" /> Back to Libraries
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/admin/edit/${library.id}`} className="px-4 py-2 bg-slate-100 text-slate-800 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 text-xs">
            <Edit className="w-4 h-4" /> Edit Details
          </Link>
          <form action={async () => { "use server"; await rejectLibrary(library.id); }}>
            <button type="submit" className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center gap-2 text-xs">
              <X className="w-4 h-4" /> Reject
            </button>
          </form>
          <form action={async () => { "use server"; await approveLibrary(library.id); }}>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-opacity flex items-center gap-2 text-xs shadow-sm">
              <Check className="w-4 h-4" /> Approve
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none flex items-center gap-3">
            {library.name}
            <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider ${
              library.kycStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
              library.kycStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
              'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {library.kycStatus}
            </span>
          </h1>
          <p className="text-slate-500 mt-2 flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="w-4 h-4 text-[#2781CA]" /> {library.address}, {library.city}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 mb-5">
              <Building className="w-5 h-5 text-[#2781CA]" /> Basic Information
            </h2>
            <div className="grid grid-cols-2 gap-5 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Manager Name</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{library.managerName || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Manager Phone</p>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{library.managerPhone || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Librarian Email</p>
                <p className="font-medium text-slate-800 mt-0.5">{library.librarian.email}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">WhatsApp</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{library.whatsapp || "N/A"}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 mb-5">
              <CreditCard className="w-5 h-5 text-[#2781CA]" /> KYC & Passbook Document
            </h2>
            {library.passbookPhoto ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                {/* Admins preview user-uploaded URLs from arbitrary providers. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={library.passbookPhoto} alt="Passbook/KYC Document" className="w-full h-auto object-contain max-h-[500px]" />
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-10 text-center text-slate-400 border border-dashed border-slate-200 text-xs font-medium">
                No passbook or KYC document uploaded yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 mb-5">
              <Users className="w-5 h-5 text-[#2781CA]" /> Details
            </h2>
            <div className="space-y-4 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Available Seats</p>
                <p className="font-black text-slate-900 text-base mt-0.5">{library.seatsAvailable || 0}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Timings</p>
                <p className="font-bold text-slate-900 mt-0.5">{library.openingTime || "N/A"} - {library.closingTime || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Facilities</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {library.facilities.map(f => (
                    <span key={f} className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-bold">{f}</span>
                  ))}
                  {library.facilities.length === 0 && <span className="text-slate-400 font-medium">None listed</span>}
                </div>
              </div>
            </div>
          </div>
          
          {library.photos.length > 0 && (
            <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h2 className="text-lg font-black text-slate-900 tracking-tight mb-4">Library Photos</h2>
              <div className="space-y-3">
                {library.photos.map((url, i) => (
                  // Library uploads may use arbitrary providers.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Library photo ${i+1}`} className="w-full rounded-2xl border border-slate-200 object-cover aspect-video" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
