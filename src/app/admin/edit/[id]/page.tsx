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
  if (!session || session.role !== 'ADMIN') redirect("/");
  const params = await props.params;
  const library = await prisma.library.findUnique({
    where: { id: params.id }
  });

  if (!library) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Edit Library</h1>
          <p className="text-muted-foreground">Modify library details before approval.</p>
        </div>
        <span className={`px-3 py-1 text-sm font-bold rounded uppercase tracking-wide ${
          library.kycStatus === "APPROVED" ? "bg-success/10 text-success" : 
          library.kycStatus === "REJECTED" ? "bg-destructive/10 text-destructive" : 
          "bg-warning/10 text-warning"
        }`}>
          {library.kycStatus}
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
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
