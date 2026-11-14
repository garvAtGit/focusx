"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchActiveStudents, createOfflineStudentWithRFID } from "@/app/actions/student-actions"
import { assignRFIDDirectly, generateRFIDCommandQR } from "@/app/actions/hardware-actions"
import toast from "react-hot-toast"
import { Search, Loader2, CheckCircle2 } from "lucide-react"
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
  const [assignedStudentName, setAssignedStudentName] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [tab, setTab] = useState<'SEARCH' | 'CREATE'>('SEARCH');
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState("");

  async function loadStudents(searchQuery?: string) {
    setLoading(true);
    const result = await searchActiveStudents(searchQuery);
    if (result.success && result.students) {
      setStudents(result.students);
    } else {
      toast.error("Failed to load students");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    setAssignedStudentName(null);
    setQrPayload(null);
    setSearch("");
    void loadStudents();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!search.trim()) return;
    const timer = setTimeout(() => {
      void loadStudents(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open]);

  const filtered = students.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.phone?.includes(search) ||
    s.uniqueId?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAssign(
    studentId: string,
    studentName: string,
    bookings?: ActiveStudent["bookings"],
  ) {
    if (assigning) return;
    setAssigning(true);
    try {
      // 1. Direct assignment: links RFID to student in DB and triggers hardware sync
      const res = await assignRFIDDirectly(studentId, rfidTag);
      if (res.error) {
        toast.error(res.error);
        setAssigning(false);
        return;
      }

      // Also generate QR in background for optional offline fallback
      let exp = 0;
      if (bookings && bookings.length > 0 && bookings[0].endTime) {
        exp = Math.floor(new Date(bookings[0].endTime).getTime() / 1000);
      }
      generateRFIDCommandQR(studentId, "ADD_RFID", rfidTag, exp).then((qrRes) => {
        if (qrRes.qrPayload) setQrPayload(qrRes.qrPayload);
      }).catch(() => {});

      toast.success(`RFID assigned to ${studentName}!`);
      setAssignedStudentName(studentName);
      if (onSuccess) onSuccess();
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
      } else {
        const studentName = res.student?.name || newName.trim();
        toast.success(`Created ${studentName} and assigned RFID!`);
        setAssignedStudentName(studentName);
        if (res.qrPayload) setQrPayload(res.qrPayload);
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
        
        {assignedStudentName ? (
          <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">RFID Assigned Successfully!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tag <strong className="font-mono text-foreground">{rfidTag}</strong> is now linked to <strong className="text-foreground">{assignedStudentName}</strong>.
              </p>
            </div>
            <div className="w-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
              ✓ Gate hardware revision updated. Access credentials have been synced to the door machine.
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full mt-2">
              Done
            </Button>
            {qrPayload && (
              <details className="w-full text-xs text-muted-foreground text-left cursor-pointer pt-2">
                <summary className="font-medium hover:text-foreground">Show QR Code (Optional manual sync)</summary>
                <div className="flex flex-col items-center p-4 mt-2 bg-white rounded-xl border border-border">
                  <QRCode value={qrPayload} size={150} />
                  <span className="text-[10px] text-muted-foreground mt-2">Scan at door reader camera if gate is offline</span>
                </div>
              </details>
            )}
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
                    placeholder="Search student by name, phone, or ID..." 
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
                          onClick={() => handleAssign(s.id, s.name, s.bookings)}
                        >
                          {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Assign"}
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
                  This will create a new student profile and instantly sync the RFID tag to the door machine.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
