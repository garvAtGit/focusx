"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { getStudentProfile, collectDues } from "@/app/actions/student-actions"
import toast from "react-hot-toast"
import { Loader2, ShieldCheck, CalendarDays, Lock, LayoutGrid, RefreshCw, History, User } from "lucide-react"
import { AttendanceCalendar } from "./AttendanceCalendar"
import type { Prisma } from "@prisma/client"

interface StudentProfileModalProps {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeSeat?: (bookingId: string, currentSeatId: string) => void;
  onRenewPlan?: (bookingId: string, planId: string, seatId: string, hasLocker: boolean, standaloneLockerId: string | null) => void;
}

type ProfileStudent = Prisma.UserGetPayload<{
  include: {
    bookings: {
      include: {
        plan: true;
      };
    };
    entryLogs: true;
    checkins: true;
  };
}>;

export function StudentProfileModal({ studentId, open, onOpenChange, onChangeSeat, onRenewPlan }: StudentProfileModalProps) {
  const [profileStudent, setProfileStudent] = useState<ProfileStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [collectingDuesId, setCollectingDuesId] = useState<string | null>(null);
  const [duesCashInput, setDuesCashInput] = useState("");
  const [duesOnlineInput, setDuesOnlineInput] = useState("");
  const [isSubmittingDues, setIsSubmittingDues] = useState(false);
  const now = new Date();

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!open || !studentId) {
        setProfileStudent(null);
        return;
      }

      setLoading(true);
      const res = await getStudentProfile(studentId);
      if (cancelled) return;

      if (res.success && res.student) {
        setProfileStudent(res.student);
      } else {
        toast.error("Failed to load profile");
        onOpenChange(false);
      }
      setLoading(false);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, studentId, onOpenChange]);

  const handleCollectDues = async (bookingId: string) => {
    setIsSubmittingDues(true);
    const cashPaise = Math.round(Number(duesCashInput || 0) * 100);
    const onlinePaise = Math.round(Number(duesOnlineInput || 0) * 100);
    
    if (cashPaise === 0 && onlinePaise === 0) {
      toast.error("Enter a valid amount to collect");
      setIsSubmittingDues(false);
      return;
    }

    const res = await collectDues(bookingId, cashPaise, onlinePaise);
    if (res.success) {
      toast.success("Dues collected successfully");
      setCollectingDuesId(null);
      setDuesCashInput("");
      setDuesOnlineInput("");
      // Optimistically update the state
      setProfileStudent(prev => {
        if (!prev) return prev;
        const updatedBookings = prev.bookings.map(b => 
          b.id === bookingId ? { ...b, amountPaidCashPaise: res.booking.amountPaidCashPaise, amountPaidOnlinePaise: res.booking.amountPaidOnlinePaise, amountDuePaise: res.booking.amountDuePaise } : b
        );
        return { ...prev, bookings: updatedBookings };
      });
    } else {
      toast.error(res.error || "Failed to collect dues");
    }
    setIsSubmittingDues(false);
  };

  function formatStandardDate(isoString: string | Date | undefined | null) {
    if (!isoString) return "N/A";
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(isoString));
  }

  const currentBooking = profileStudent?.bookings?.[0]; // Assuming bookings are ordered by desc

  const allLogs = React.useMemo(() => {
    if (!profileStudent) return [];
    return [
      ...(profileStudent.checkins || []).map(log => ({
        status: log.status === 'CHECK_IN' || log.status === 'CHECK_OUT' ? log.status : 'CHECK_IN',
        timestamp: log.timestamp
      })),
      ...(profileStudent.entryLogs || []).map(log => ({
        status: (log.status === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN') as 'CHECK_IN' | 'CHECK_OUT',
        timestamp: log.timestamp
      }))
    ];
  }, [profileStudent]);

  if (!open) return null;

  let daysLeft = 0;
  let totalDays = 1;
  let elapsed = 0;
  let progressPct = 0;
  let isExpired = false;

  if (currentBooking) {
    const endOfDay = new Date(currentBooking.endTime);
    endOfDay.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    daysLeft = Math.ceil((endOfDay.getTime() - today.getTime()) / (1000 * 3600 * 24)) + 1;
    totalDays = Math.ceil((endOfDay.getTime() - new Date(currentBooking.startTime).getTime()) / (1000 * 60 * 60 * 24));
    totalDays = Math.max(1, totalDays);
    elapsed = totalDays - Math.max(0, daysLeft);
    progressPct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
    isExpired = endOfDay < today;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg border-l border-slate-200 shadow-2xl p-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : profileStudent ? (
          <>
            {/* Drawer Header */}
            <div className="relative shrink-0 bg-white border-b border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] z-10">
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 opacity-90" />
              <div className="px-8 pt-16 pb-6 relative z-10">
                <div className="flex items-end gap-5">
                  <div className="relative shrink-0 bg-slate-50 rounded-[20px]">
                    {profileStudent.profilePhotoUrl ? (
                      <img src={profileStudent.profilePhotoUrl} alt="" className="w-24 h-24 rounded-[20px] object-cover shadow-xl" />
                    ) : (
                      <div className="w-24 h-24 rounded-[20px] bg-gradient-to-br from-indigo-50 to-white shadow-xl flex items-center justify-center relative z-10">
                        <User className="w-10 h-10 text-indigo-200" />
                      </div>
                    )}
                    {currentBooking && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-white shadow-sm ${
                        currentBooking.status === 'CONFIRMED' && !isExpired && !currentBooking.isPaused ? 'bg-emerald-500' :
                        currentBooking.status === 'CONFIRMED' && currentBooking.isPaused ? 'bg-amber-500' :
                        currentBooking.status === 'CANCELLED' ? 'bg-rose-500' : 'bg-slate-400'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 pb-2 min-w-0">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none truncate">{profileStudent.name}</h2>
                    <p className="text-[13px] font-bold text-slate-500 mt-1.5 opacity-80 truncate">{profileStudent.uniqueId} • {profileStudent.phone}</p>
                    
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {currentBooking && (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                          currentBooking.status === 'CONFIRMED' && !isExpired && !currentBooking.isPaused ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20' : 
                          currentBooking.status === 'CONFIRMED' && currentBooking.isPaused ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20' : 
                          currentBooking.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20' :
                          'bg-slate-50 text-slate-700 ring-1 ring-slate-500/20'
                        }`}>
                          {isExpired ? 'EXPIRED' : currentBooking.status}
                        </span>
                      )}
                      {profileStudent.digilockerVerified && (
                        <span className="text-[10px] bg-emerald-50 px-2 py-1 rounded-md font-bold text-emerald-600 ring-1 ring-emerald-500/20 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                      {currentBooking?.seatId && <span className="text-[10px] bg-slate-50 px-2 py-1 rounded-md font-bold text-slate-600 ring-1 ring-slate-200/60">Seat Assgn.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
              <div className="space-y-6">

                {currentBooking ? (
                  <>
                    {/* Current Plan with progress */}
                    <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <RefreshCw className="w-24 h-24 text-indigo-900" />
                      </div>
                      <div className="flex flex-col gap-4 relative z-10">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Plan</div>
                            <div className="font-black text-2xl text-slate-900 tracking-tight line-clamp-1">{currentBooking.plan?.name}</div>
                            <div className="text-[13px] font-medium text-slate-500 mt-1">{formatStandardDate(currentBooking.startTime)} → {formatStandardDate(currentBooking.endTime)}</div>
                          </div>
                          {(currentBooking.status === 'CONFIRMED' || currentBooking.status === 'PENDING_PAYMENT') && daysLeft > 0 && !currentBooking.isPaused ? (
                            <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl shadow-sm border ${daysLeft <= 7 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                              <span className="text-xl font-black leading-none">{daysLeft}</span>
                              <span className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">Days</span>
                            </div>
                          ) : currentBooking.status === 'CANCELLED' ? (
                            <div className="text-sm font-bold px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">Revoked</div>
                          ) : currentBooking.isPaused ? (
                            <div className="text-sm font-bold px-4 py-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">Paused</div>
                          ) : (
                            <div className="text-sm font-bold px-4 py-2 rounded-xl bg-slate-50 text-slate-500 border border-slate-100">Expired</div>
                          )}
                        </div>
                        
                        {/* Progress bar */}
                        {(currentBooking.status === 'CONFIRMED' || currentBooking.status === 'PENDING_PAYMENT') && !currentBooking.isPaused && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-2">
                              <span>{elapsed} / {totalDays} days used</span>
                              <span>{Math.round(progressPct)}%</span>
                            </div>
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-1000 ${progressPct > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${progressPct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Workspace Assignment */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                          <LayoutGrid className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Seat</div>
                        <div className="font-black text-sm text-slate-800 break-words w-full">{currentBooking.seatId ? 'Assigned' : 'Flexible'}</div>
                      </div>
                      <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-2">
                          <Lock className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Locker</div>
                        <div className="font-black text-sm text-slate-800">
                          {currentBooking.hasLocker ? 'Included' : currentBooking.standaloneLockerId ? 'Standalone' : 'None'}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 text-center">
                    <p className="text-slate-500 text-sm font-medium">No active bookings for this student.</p>
                  </div>
                )}

                {/* Attendance Calendar */}
                <div className="bg-white rounded-[24px] p-2 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="px-4 pt-4 pb-2">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-indigo-500" /> Attendance Calendar
                    </h3>
                  </div>
                  <div className="px-1 pb-1 scale-[0.98] transform origin-top">
                    <AttendanceCalendar logs={allLogs} optedHrs={currentBooking?.plan?.durationHours || 24} />
                  </div>
                </div>

                {/* Plan History */}
                {profileStudent.bookings && profileStudent.bookings.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-400" /> Plan History
                    </h3>
                    <div className="space-y-3">
                      {profileStudent.bookings.map((hist) => {
                        const hEnd = new Date(hist.endTime);
                        hEnd.setHours(0,0,0,0);
                        const hStart = new Date(hist.startTime);
                        hStart.setHours(0,0,0,0);
                        const todayObj = new Date();
                        todayObj.setHours(0,0,0,0);
                        const histDaysLeft = Math.ceil((hEnd.getTime() - todayObj.getTime()) / (1000 * 3600 * 24)) + 1;
                        const histTotal = Math.ceil((hEnd.getTime() - hStart.getTime()) / (1000 * 60 * 60 * 24));
                        const hIsExpired = hEnd < todayObj;

                        return (
                        <div key={hist.id} className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] group hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] hover:border-slate-200 transition-all duration-300">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-black text-[15px] text-slate-800 tracking-tight truncate">{hist.plan?.name}</div>
                              <div className="text-[12px] font-medium text-slate-500 mt-1 truncate">{formatStandardDate(hist.startTime)} → {formatStandardDate(hist.endTime)} <span className="opacity-60 hidden sm:inline">({histTotal} days)</span></div>
                              {(hist.amountDuePaise || 0) > 0 && (
                                <div className="mt-2">
                                  <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded border border-rose-200 inline-block">
                                    Dues: ₹{((hist.amountDuePaise || 0) / 100).toFixed(0)}
                                  </span>
                                  {collectingDuesId !== hist.id ? (
                                    <button 
                                      onClick={() => {
                                        setCollectingDuesId(hist.id);
                                        setDuesCashInput("");
                                        setDuesOnlineInput("");
                                      }}
                                      className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                                    >
                                      Collect
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                                hist.status === 'CONFIRMED' && !hIsExpired ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                hist.status === 'CANCELLED' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                'bg-slate-50 text-slate-500 border border-slate-100'
                              }`}>
                                {hIsExpired ? 'EXPIRED' : hist.status}
                              </span>
                            </div>
                          </div>

                          {collectingDuesId === hist.id && (
                            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                              <div className="text-xs font-bold text-slate-600 mb-2">Collect Pending Dues</div>
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">Cash Received</label>
                                  <input 
                                    type="number" 
                                    className="w-full text-sm p-2 border border-slate-200 rounded bg-white outline-none focus:border-indigo-500" 
                                    placeholder="₹"
                                    value={duesCashInput}
                                    onChange={(e) => setDuesCashInput(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">Online Received</label>
                                  <input 
                                    type="number" 
                                    className="w-full text-sm p-2 border border-slate-200 rounded bg-white outline-none focus:border-indigo-500" 
                                    placeholder="₹"
                                    value={duesOnlineInput}
                                    onChange={(e) => setDuesOnlineInput(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => setCollectingDuesId(null)}
                                  className="text-[11px] font-bold px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={() => handleCollectDues(hist.id)}
                                  disabled={isSubmittingDues}
                                  className="text-[11px] font-bold px-3 py-1.5 bg-indigo-600 text-white hover:opacity-90 rounded disabled:opacity-50 flex items-center"
                                >
                                  {isSubmittingDues && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                  Confirm
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Drawer Footer Actions */}
            <div className="p-5 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                {onRenewPlan && (currentBooking?.status === 'CONFIRMED' || currentBooking?.status === 'COMPLETED') && (
                  <button 
                    onClick={() => {
                      onRenewPlan(currentBooking.id, currentBooking.planId, currentBooking.seatId || "NONE", currentBooking.hasLocker, currentBooking.standaloneLockerId);
                      onOpenChange(false);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-50 text-indigo-600 rounded-[14px] text-sm font-bold hover:bg-indigo-100 transition-colors shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> Renew
                  </button>
                )}
                {onChangeSeat && currentBooking?.status !== 'CANCELLED' && currentBooking?.plan?.type === 'FIXED' && (
                  <button 
                    onClick={() => {
                      onChangeSeat(currentBooking.id, currentBooking.seatId || "NONE");
                      onOpenChange(false);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 text-slate-600 rounded-[14px] text-sm font-bold hover:bg-slate-100 transition-colors shadow-sm"
                  >
                    <LayoutGrid className="w-4 h-4" /> Change Seat
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
