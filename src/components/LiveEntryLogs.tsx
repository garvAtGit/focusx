"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Clock } from "lucide-react";
import { AssignRFIDModal } from "@/components/AssignRFIDModal";
import { StudentProfileModal } from "@/components/StudentProfileModal";
import { getUserBasicDetails } from "@/app/actions/student-actions";

// Initialize Supabase client for realtime subscriptions
// Make sure to add these to your .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

type LiveLog = {
  id: string;
  userId: string | null;
  libraryId: string;
  doorId: string;
  timestamp: string;
  status: string;
  reason?: string | null;
  user?: {
    name: string | null;
    phone: string | null;
    gender: string | null;
  };
};

export function LiveEntryLogs({ libraryId }: { libraryId: string }) {
  const [recentLogs, setRecentLogs] = useState<LiveLog[]>([]);
  const [failureCounts, setFailureCounts] = useState<Record<string, number>>({});
  const [assignRfidTag, setAssignRfidTag] = useState<string | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase Realtime not configured. Missing ENV vars.");
      return;
    }

    // Subscribe to INSERT events on the EntryLog table
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'EntryLog',
          filter: `libraryId=eq.${libraryId}`,
        },
        async (payload) => {
          const newLog = payload.new as LiveLog;
          
          if (newLog.userId) {
            const userRes = await getUserBasicDetails(newLog.userId, libraryId);
            if (userRes.success && userRes.user) {
              newLog.user = userRes.user;
            }
          }

          setRecentLogs((prev) => [newLog, ...prev].slice(0, 15)); // Keep last 15

          // Update failure counts for flagging
          if (newLog.userId) {
            setFailureCounts((prev) => {
              const currentCount = prev[newLog.userId!] || 0;
              if (newLog.status === "DENIED") {
                return { ...prev, [newLog.userId!]: currentCount + 1 };
              } else {
                return { ...prev, [newLog.userId!]: 0 }; // Reset on success
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [libraryId]);

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <Clock className="w-5 h-5 text-primary animate-pulse" />
          <h2 className="font-bold text-foreground">Live Access Logs</h2>
        </div>

        {(!supabaseUrl || !supabaseKey) && (
          <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4 shrink-0">
            ⚠️ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local. Realtime updates are disabled.
          </div>
        )}

        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic flex-1">Waiting for new door scans...</p>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <ul className="space-y-3">
            {recentLogs.map((log) => {
              const isDenied = log.status === "DENIED";
              const consecutiveFailures = log.userId ? (failureCounts[log.userId] || 0) : 0;
              const showWarning = consecutiveFailures >= 3;
              const isUnregistered = isDenied && log.reason?.startsWith("Unregistered RFID");
              // Assuming reason format: "Unregistered RFID: 1A2B3C4D"
              const extractedTag = isUnregistered ? log.reason?.split(":")[1]?.trim() : null;

              return (
                <li key={log.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${isDenied ? 'bg-destructive/10 border-destructive/20' : 'bg-success/10 border-success/20'}`}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        User: <span 
                          className="font-medium hover:underline cursor-pointer"
                          onClick={() => {
                            if (log.userId) setProfileStudentId(log.userId);
                          }}
                        >
                          {log.user ? (
                            <>
                              {log.user.name} {log.user.gender?.toLowerCase() === 'male' ? 'bhai' : log.user.gender?.toLowerCase() === 'female' ? 'behen' : ''} {log.user.phone ? `(${log.user.phone})` : ''}
                            </>
                          ) : (
                            <span className="font-mono text-xs">{log.userId || "UNKNOWN"}</span>
                          )}
                        </span>
                      </span>
                      {isDenied && (
                        <span className="text-[10px] uppercase font-black tracking-widest bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded">
                          Denied
                        </span>
                      )}
                      {showWarning && isDenied && (
                        <span className="text-[10px] uppercase font-black tracking-widest bg-warning text-warning-foreground px-1.5 py-0.5 rounded animate-pulse">
                          Continuous Failures ({consecutiveFailures})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      Door: {log.doorId || "Main Gate"}
                      {isDenied && log.reason && ` • Reason: ${log.reason}`}
                    </span>
                    
                    {isUnregistered && extractedTag && (
                      <div className="mt-2">
                        <button 
                          onClick={() => setAssignRfidTag(extractedTag)}
                          className="text-xs bg-primary text-primary-foreground font-bold px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                        >
                          Assign RFID: {extractedTag}
                        </button>
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${isDenied ? 'text-destructive' : 'text-success'}`}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </li>
              );
            })}
            </ul>
          </div>
        )}
        
        {assignRfidTag && (
          <AssignRFIDModal 
            rfidTag={assignRfidTag} 
            open={!!assignRfidTag} 
            onOpenChange={(open) => {
              if (!open) setAssignRfidTag(null);
            }}
          />
        )}
      </div>

      <StudentProfileModal 
        studentId={profileStudentId}
        open={!!profileStudentId}
        onOpenChange={(open) => !open && setProfileStudentId(null)}
      />
    </>
  );
}
