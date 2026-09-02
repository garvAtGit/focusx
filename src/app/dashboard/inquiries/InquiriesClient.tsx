"use client"
import { formatStandardDate } from "@/lib/date-utils";

import { useState } from "react"
import { updateInquiryStatus, submitInquiry } from "@/app/actions/inquiry-actions"
import toast from "react-hot-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED';
  createdAt: Date;
}

function isInquiryStatus(value: string): value is Inquiry["status"] {
  return value === "NEW" || value === "CONTACTED" || value === "CONVERTED" || value === "CLOSED";
}

export function InquiriesClient({ initialInquiries, libraryId }: { initialInquiries: Inquiry[], libraryId: string }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState("+91 ");

  async function handleAdd(formData: FormData) {
    setAdding(true);
    formData.append("libraryId", libraryId);
    const res = await submitInquiry(formData);
    if (res?.success) {
      toast.success("Inquiry added");
      setIsAddOpen(false);
      setPhone("+91 ");
      // Optimistically reload or just let the user see it on next refresh. 
      // To properly show it instantly, we can add a basic temp object:
      const newInquiry: Inquiry = {
        id: Math.random().toString(),
        name: formData.get("name") as string,
        phone: formData.get("phone") as string,
        message: formData.get("message") as string,
        status: 'NEW',
        createdAt: new Date(),
      };
      setInquiries(prev => [newInquiry, ...prev]);
    } else {
      toast.error("Failed to add inquiry");
    }
    setAdding(false);
  }

  async function handleStatusChange(id: string, newStatus: Inquiry['status']) {
    setUpdatingId(id);
    const res = await updateInquiryStatus(id, newStatus, libraryId);
    if (res?.success) {
      toast.success("Status updated");
      setInquiries(prev => prev.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv));
    } else {
      toast.error("Failed to update status");
    }
    setUpdatingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">All Inquiries</h2>
          <p className="text-sm text-muted-foreground">Manage leads and inquiries.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 rounded-md inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2">
            <Plus className="w-4 h-4" /> Add Inquiry
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Inquiry</DialogTitle>
            </DialogHeader>
            <form action={handleAdd} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Student Name</Label>
                <Input name="name" required placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input name="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Message (Optional)</Label>
                <Input name="message" placeholder="Interested in a seat..." />
              </div>
              <Button type="submit" className="w-full" disabled={adding}>
                {adding ? "Adding..." : "Add Inquiry"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {inquiries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <p>No inquiries yet. When students contact you from the library page, they will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
      {inquiries.map((inq, index) => (
        <div key={inq.id} className="border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground">#{index + 1}. {inq.name}</h3>
              {inq.status === 'NEW' && <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>}
            </div>
            <p className="text-sm font-medium text-foreground"><a href={`tel:${inq.phone}`} className="hover:underline">{inq.phone}</a></p>
            {inq.message && <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{inq.message}&rdquo;</p>}
            <p className="text-xs text-muted-foreground mt-2">
              Submitted on {formatStandardDate(inq.createdAt)} at {new Date(inq.createdAt).toLocaleTimeString()}
            </p>
          </div>
          
          <div className="shrink-0 flex items-center gap-2">
            <select
              disabled={updatingId === inq.id}
              value={inq.status}
              onChange={(e) => {
                const newStatus = e.target.value;
                if (isInquiryStatus(newStatus)) {
                  void handleStatusChange(inq.id, newStatus);
                }
              }}
              className="text-sm border border-input rounded-md px-3 py-2 bg-background focus:ring-primary focus:border-primary"
            >
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="CONVERTED">Converted (Enrolled)</option>
              <option value="CLOSED">Closed (Not Interested)</option>
            </select>
          </div>
        </div>
      ))}
        </div>
      )}
    </div>
  )
}
