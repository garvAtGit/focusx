"use client"

import { useState } from "react"
import { CheckCircle2, LogOut, Clock } from "lucide-react"
import { StudentProfileModal } from "@/components/StudentProfileModal"

interface CheckinLog {
  id: string;
  student: { id?: string; name: string; phone: string | null };
  status: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: Date;
}

export function DashboardAttendance({ logs }: { logs: CheckinLog[] }) {
  const [daysBack, setDaysBack] = useState(0); // 0 = today, 1 = yesterday, etc
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysBack);
  const targetDateString = targetDate.toISOString().split('T')[0];

  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp).toISOString().split('T')[0];
    return logDate === targetDateString;
  });

  return (
    <>
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col max-h-[400px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-heading">Attendance</h2>
          <select 
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="text-xs bg-muted border-none rounded-md px-2 py-1 cursor-pointer focus:ring-0"
          >
            <option value={0}>Today</option>
            <option value={1}>Yesterday</option>
            <option value={2}>2 Days Ago</option>
            <option value={3}>3 Days Ago</option>
            <option value={4}>4 Days Ago</option>
            <option value={5}>5 Days Ago</option>
            <option value={6}>6 Days Ago</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-y-auto pr-2 content-start">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground h-full col-span-full">
              <Clock className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No activity recorded</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div 
                key={log.id} 
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  if (log.student.id) setProfileStudentId(log.student.id);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${log.status === 'CHECK_IN' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                    {log.status === 'CHECK_IN' ? <CheckCircle2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm hover:underline">{log.student.name}</p>
                    <p className="text-xs text-muted-foreground">{log.student.phone}</p>
                  </div>
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <StudentProfileModal 
        studentId={profileStudentId}
        open={!!profileStudentId}
        onOpenChange={(open) => !open && setProfileStudentId(null)}
      />
    </>
  )
}
