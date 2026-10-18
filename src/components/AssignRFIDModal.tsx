"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchActiveStudents, createOfflineStudentWithRFID } from "@/app/actions/student-actions"
import { generateRFIDCommandQR } from "@/app/actions/hardware-actions"
import toast from "react-hot-toast"
import { Search, Loader2 } from "lucide-react"
import QRCode from "react-qr-code"

interface AssignRFIDModalProps {
  rfidTag: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ActiveStudent = {
  id: string;
  name: string;
  phone: string | null;
  uniqueId: string | null;
  rfidTag: string | null;
  bookings: Array<{
    endTime: Date | string;
  }>;
};

export function AssignRFIDModal({ rfidTag, open, onOpenChange, onSuccess }: AssignRFIDModalProps) {
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [tab, setTab] = useState<'SEARCH' | 'CREATE'>('SEARCH');
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState("");

  async function loadStudents() {
    setLoading(true);
    const result = await searchActiveStudents();
    if (result.success && result.students) {
      setStudents(result.students);
    } else {
      toast.error("Failed to load students");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setQrPayload(null);
      setSearch("");
      void loadStudents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const filtered = students.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.phone?.includes(search) ||
    s.uniqueId?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAssign(
    studentId: string,
    bookings?: ActiveStudent["bookings"],
  ) {
    if (assigning) return;
    setAssigning(true);
    try {
      let exp = 0;
      if (bookings && bookings.length > 0 && bookings[0].endTime) {
        exp = Math.floor(new Date(bookings[0].endTime).getTime() / 1000);
      }
      
      const res = await generateRFIDCommandQR(studentId, "ADD_RFID", rfidTag, exp);
      if (res.error) {
        toast.error(res.error);
      } else if (res.qrPayload) {
        toast.success("RFID assigned in database!");
        setQrPayload(res.qrPayload);
        if (onSuccess) onSuccess();
      }
    } catch {
      toast.error("Failed to assign RFID");
    } finally {
      setAssigning(false);
    }
  }

  async function handleCreateAndAssign() {
    if (!newName.trim()) return toast.error("Name is required");
    if (assigning) return;
    setAssigning(true);
    try {
      const res = await createOfflineStudentWithRFID("", newName.trim(), rfidTag, newGender || undefined);
      if (res.error) {
        toast.error(res.error);
      } else if (res.qrPayload) {
        toast.success(`Created ${res.student?.name} and assigned RFID!`);
        setQrPayload(res.qrPayload);
        if (onSuccess) onSuccess();
      }
    } catch {
      toast.error("Failed to create student");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign RFID Tag</DialogTitle>
        </DialogHeader>
        
        {qrPayload ? (
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <h3 className="font-bold text-foreground">Scan at the Door</h3>
            <p className="text-sm text-muted-foreground text-center">
              The tag <strong className="text-foreground">{rfidTag}</strong> has been assigned in the database. Scan this QR code at the library door scanner to sync the hardware.
            </p>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
              <QRCode value={qrPayload} size={200} />
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full mt-4">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-muted p-3 rounded-lg border flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Tag ID:</span>
              <span className="font-mono font-bold text-primary">{rfidTag}</span>
            </div>

            <div className="flex bg-muted p-1 rounded-lg">
              <button 
                onClick={() => setTab('SEARCH')} 
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${tab === 'SEARCH' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Search Existing
              </button>
              <button 
                onClick={() => setTab('CREATE')} 
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${tab === 'CREATE' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Create New (Offline)
              </button>
            </div>

            {tab === 'SEARCH' ? (
              <>
                <div className="relative">
                  <Input 
                    placeholder="Search student by name or phone..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {loading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground p-4">No students found.</p>
                  ) : (
                    filtered.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 transition-colors">
                        <div>
                          <p className="font-bold text-sm text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.phone} • {s.uniqueId}</p>
                          {s.rfidTag && <p className="text-[10px] text-warning mt-1">Currently has tag: {s.rfidTag}</p>}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          disabled={assigning}
                          onClick={() => handleAssign(s.id, s.bookings)}
                        >
                          Assign
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Student Name *</label>
                  <Input 
                    placeholder="Enter student's full name" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Gender (Optional)</label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="pt-2">
                  <Button 
                    className="w-full" 
                    onClick={handleCreateAndAssign}
                    disabled={assigning || !newName.trim()}
                  >
                    {assigning ? "Creating..." : "Create & Assign RFID"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  This will create a new student profile without a phone number and instantly assign the RFID tag to it.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
