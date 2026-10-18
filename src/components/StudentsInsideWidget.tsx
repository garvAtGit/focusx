"use client";

import { useState } from "react";
import { UserCheck, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type StudentInside = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

export function StudentsInsideWidget({ students }: { students: StudentInside[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors group">
          <div>
            <p className="text-muted-foreground text-sm font-medium mb-1">Students Inside (Today)</p>
            <h2 className="text-4xl font-heading font-black text-foreground group-hover:text-primary transition-colors">
              {students.length}
            </h2>
          </div>
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <UserCheck className="w-7 h-7" />
          </div>
        </div>
      } />

      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Students Inside Today
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-3">
          {students.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No students have scanned in today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {students.map(student => (
                <li key={student.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-foreground text-sm">{student.name || "Unknown Name"}</p>
                    <p className="text-xs text-muted-foreground">{student.phone || student.email || "No contact info"}</p>
                  </div>
                  <span className="text-[10px] bg-success/10 text-success px-2 py-1 rounded-full uppercase tracking-wider font-bold">
                    Inside
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
