"use client";

import { useState } from "react";
import { StudentProfileModal } from "@/components/StudentProfileModal";

export default function StudentProfileTrigger({ studentId, children }: { studentId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <div 
        className="cursor-pointer hover:opacity-80 transition-opacity" 
        onClick={() => setOpen(true)}
      >
        {children}
      </div>
      <StudentProfileModal 
        studentId={studentId} 
        open={open} 
        onOpenChange={setOpen} 
      />
    </>
  );
}
