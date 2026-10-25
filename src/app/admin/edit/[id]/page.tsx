import { formatStandardDate } from "@/lib/date-utils";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { updateLibraryDetails } from "@/app/actions/admin-actions";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession } from "@/app/actions/auth-actions";
import { AdminNoteEditor } from "@/components/admin-note-editor";

export default async function AdminEditLibraryPage(props: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect("/admin/login");
  const params = await props.params;
  const library = await prisma.library.findUnique({
    where: { id: params.id }
  });

  if (!library) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans pb-12">
      <Link href="/admin/libraries" className="text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2 w-fit transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Libraries
      </Link>

      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none">Edit Library</h1>
          <p className="text-sm font-medium text-slate-500 mt-2">Modify library details and operational parameters before approval.</p>
        </div>
        <span className={`px-3 py-1 text-xs font-black rounded-full uppercase tracking-wider ${
          library.kycStatus === "APPROVED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : 
          library.kycStatus === "REJECTED" ? "bg-rose-50 text-rose-700 border border-rose-200" : 
          "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          {library.kycStatus}
        </span>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <form action={updateLibraryDetails.bind(null, library.id)} className="space-y-6">
          
          <div className="space-y-2">
            <Label htmlFor="name">Library Name</Label>
            <Input id="name" name="name" defaultValue={library.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Full Address</Label>
            <Input id="address" name="address" defaultValue={library.address} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="managerName">Manager Name</Label>
              <Input id="managerName" name="managerName" defaultValue={library.managerName || ""} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="managerPhone">Manager Phone</Label>
              <Input id="managerPhone" name="managerPhone" defaultValue={library.managerPhone || ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={library.city || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={library.state || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locality">Locality</Label>
              <Input id="locality" name="locality" defaultValue={library.locality || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seatsAvailable">Seats Available</Label>
              <Input id="seatsAvailable" name="seatsAvailable" type="number" defaultValue={library.seatsAvailable || 0} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea 
              id="description" 
              name="description" 
              defaultValue={library.description || ""} 
              className="w-full px-3 py-2 rounded-md border border-border bg-transparent text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="openingTime">Opening Time</Label>
              <Input id="openingTime" name="openingTime" type="time" defaultValue={library.openingTime || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingTime">Closing Time</Label>
              <Input id="closingTime" name="closingTime" type="time" defaultValue={library.closingTime || ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="facilities">Facilities (Comma Separated)</Label>
            <Input id="facilities" name="facilities" defaultValue={(library.facilities || []).join(", ")} placeholder="WiFi, AC, RO Water" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="metroStation">Metro Station</Label>
              <Input id="metroStation" name="metroStation" defaultValue={library.metroStation || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metroDistance">Metro Distance (km)</Label>
              <Input id="metroDistance" name="metroDistance" type="number" step="any" defaultValue={library.metroDistance || ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleMapsUrl">Google Maps URL</Label>
            <Input id="googleMapsUrl" name="googleMapsUrl" defaultValue={library.googleMapsUrl || ""} />
          </div>

          <div className="pt-4 mt-6 border-t border-border text-sm text-muted-foreground">
            Created At: {formatStandardDate(library.createdAt)}
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </form>
      </div>

      <AdminNoteEditor 
        libraryId={library.id} 
        initialNote={library.adminNotes || ""} 
        phone={library.managerPhone} 
      />
    </div>
  );
}
