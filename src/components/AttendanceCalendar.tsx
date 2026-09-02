"use client"

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowDown } from 'lucide-react';

interface AttendanceCalendarProps {
  logs: { status: string; timestamp: Date | string }[];
  optedHrs: number;
}

export function AttendanceCalendar({ logs, optedHrs }: AttendanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Parse all logs into a day map
  const daysMap = useMemo(() => {
    const map = new Map<string, { durationMs: number; events: any[] }>();
    
    // Sort logs chronologically
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Track open check-in
    let currentCheckIn: { time: number, dayKey: string } | null = null;
    let lastAction: string | null = null;

    for (const log of sortedLogs) {
      const action = log.status === 'CHECK_IN' ? 'IN' : 'OUT';
      if (lastAction === action) continue; // Deduplicate
      lastAction = action;

      const date = new Date(log.timestamp);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const timeMs = date.getTime();
      
      let dayData = map.get(dayKey);
      if (!dayData) {
        dayData = { durationMs: 0, events: [] };
        map.set(dayKey, dayData);
      }

      dayData.events.push({
        action,
        time: date
      });

      if (action === 'IN') {
        if (!currentCheckIn) {
          currentCheckIn = { time: timeMs, dayKey };
        }
      } else if (action === 'OUT') {
        if (currentCheckIn) {
          // Add duration to the check-in's day
          const inDayData = map.get(currentCheckIn.dayKey);
          if (inDayData) {
            inDayData.durationMs += (timeMs - currentCheckIn.time);
          }
          currentCheckIn = null;
        }
      }
    }

    // If still checked in today, add duration until now
    if (currentCheckIn) {
        const inDayData = map.get(currentCheckIn.dayKey);
        if (inDayData) {
            inDayData.durationMs += (Date.now() - currentCheckIn.time);
        }
    }

    return map;
  }, [logs]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const days = [];
    
    // Padding empty cells for previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDateStr(null);
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDateStr(null);
  };

  const getColorClass = (durationMs: number) => {
    if (durationMs === 0) return 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-400';
    
    const hrs = durationMs / (1000 * 60 * 60);
    if (hrs > optedHrs + 0.5) {
      return 'bg-rose-500 hover:bg-rose-600 border-rose-600 text-white shadow-sm'; // Overstay
    } else if (hrs >= optedHrs - 1) {
      return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white shadow-sm'; // Met limit
    } else {
      return 'bg-emerald-200 hover:bg-emerald-300 border-emerald-300 text-emerald-800'; // Partial
    }
  };

  const formatHrs = (ms: number) => {
    const hrs = ms / (1000 * 60 * 60);
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const selectedDateEvents = selectedDateStr ? daysMap.get(selectedDateStr) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
        <h4 className="text-sm font-bold text-slate-800">Attendance Calendar</h4>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[100px] text-center">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="p-5">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="w-full aspect-square" />;
            
            const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const data = daysMap.get(dayKey);
            const isSelected = selectedDateStr === dayKey;
            
            return (
              <button
                key={dayKey}
                onClick={() => setSelectedDateStr(isSelected ? null : dayKey)}
                className={`
                  w-full aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all border
                  ${getColorClass(data?.durationMs || 0)}
                  ${isSelected ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 z-10' : ''}
                `}
                title={data?.durationMs ? `${formatHrs(data.durationMs)} studied` : 'No attendance'}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDateStr && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-5 animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h5 className="text-sm font-bold text-slate-800">
              {new Date(selectedDateStr.split('-')[0] as any, selectedDateStr.split('-')[1] as any, selectedDateStr.split('-')[2] as any).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h5>
            <span className="text-xs font-black text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
              Total: {formatHrs(selectedDateEvents?.durationMs || 0)}
            </span>
          </div>
          
          {(!selectedDateEvents?.events || selectedDateEvents.events.length === 0) ? (
            <p className="text-sm text-slate-500 text-center py-4 bg-white rounded-xl border border-slate-200 border-dashed">No attendance logs for this day.</p>
          ) : (
            <div className="space-y-0 max-h-[200px] overflow-y-auto pr-2 flex flex-col">
              {selectedDateEvents.events.map((ev, i) => (
                <React.Fragment key={i}>
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${ev.action === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {ev.action}
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {ev.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {i < selectedDateEvents.events.length - 1 && (
                    <div className="flex justify-start pl-[20px] py-1 relative z-0">
                      <ArrowDown className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
