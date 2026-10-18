'use client';

import { useState, useMemo } from 'react';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameDay,
  isToday,
  isBefore,
  isAfter,
  addDays,
  parseISO
} from 'date-fns';
import { Clock, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
// ... (I need to be careful, I am replacing from line 16, which is where Clock is imported)
// Let's replace the whole header block instead.
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Log = {
  timestamp: Date | string;
  status: 'CHECK_IN' | 'CHECK_OUT';
};

export function FocusActivityCalendar({ logs }: { logs: Log[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Group logs by day string (yyyy-MM-dd in IST)
  const logsByDay = useMemo(() => {
    const map = new Map<string, Log[]>();
    logs.forEach(log => {
      // Convert to IST for grouping
      const d = new Date(log.timestamp);
      d.setMinutes(d.getMinutes() + 330);
      const dateStr = d.toISOString().split('T')[0];
      
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(log);
    });
    return map;
  }, [logs]);

  // Compute daily hours
  const dailyHours = useMemo(() => {
    const hoursMap = new Map<string, number>();
    
    logsByDay.forEach((dayLogs, dateStr) => {
      let totalMs = 0;
      let lastCheckin: Date | null = null;
      
      // Sort logs chronologically
      dayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      dayLogs.forEach(log => {
        if (log.status === 'CHECK_IN') {
          lastCheckin = new Date(log.timestamp);
        } else if (log.status === 'CHECK_OUT' && lastCheckin) {
          totalMs += new Date(log.timestamp).getTime() - (lastCheckin as Date).getTime();
          lastCheckin = null;
        }
      });
      
      if (lastCheckin) {
        // Unclosed check-in
        const checkinDay = new Date(lastCheckin);
        checkinDay.setMinutes(checkinDay.getMinutes() + 330);
        
        const nowIST = new Date();
        nowIST.setMinutes(nowIST.getMinutes() + 330);

        if (checkinDay.toISOString().split('T')[0] === nowIST.toISOString().split('T')[0]) {
          totalMs += new Date().getTime() - (lastCheckin as Date).getTime();
        } else {
          totalMs += 2 * 60 * 60 * 1000; // Assume 2 hours if left open overnight
        }
      }

      hoursMap.set(dateStr, totalMs / (1000 * 60 * 60)); // convert to hours
    });

    return hoursMap;
  }, [logsByDay]);

  // Current month grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startPadding = monthStart.getDay(); // 0 is Sunday
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const now = new Date();

  const getHeatmapColor = (hours: number) => {
    if (hours === 0) return 'bg-muted text-muted-foreground opacity-50';
    if (hours < 2) return 'bg-primary/30 text-primary-foreground';
    if (hours < 4) return 'bg-primary/60 text-primary-foreground';
    if (hours < 6) return 'bg-primary/80 text-primary-foreground font-bold';
    return 'bg-primary text-primary-foreground font-bold shadow-sm';
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      // Input is yyyy-MM
      const [year, month] = e.target.value.split('-');
      setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, 1));
    }
  };

  const selectedDayLogs = selectedDay 
    ? logsByDay.get(
        (() => {
          const d = new Date(selectedDay);
          d.setMinutes(d.getMinutes() + 330); // Need to pad IST correctly for lookup, actually `selectedDay` is already a pure Date from calendar, which is local midnight.
          return format(selectedDay, 'yyyy-MM-dd'); // just use local format if we treat it as the day string
        })()
      ) || []
    : [];

  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe || isRightSwipe) {
      if (navigator.vibrate) navigator.vibrate(10);
      const newDate = new Date(currentDate);
      if (isLeftSwipe) {
        newDate.setMonth(newDate.getMonth() + 1);
      } else {
        newDate.setMonth(newDate.getMonth() - 1);
      }
      setCurrentDate(newDate);
    }
  };

  return (
    <>
      <div 
        className="bg-card rounded-2xl p-6 w-full border border-border shadow-sm flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h2 className="text-xl font-medium text-slate-800 tracking-tight">
              {format(selectedDay || new Date(), 'EEE, MMMM d')}
            </h2>
          </div>
          
          <div className="flex items-center gap-1 bg-slate-50/80 rounded-xl p-1 border border-slate-100">
            <button 
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(10);
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() - 1);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-2 text-slate-600 min-w-[70px] text-center">
              {format(currentDate, 'MMM yyyy')}
            </span>
            <button 
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(10);
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() + 1);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-6">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">{day}</div>
          ))}

          {/* Padding days */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square rounded-sm bg-transparent" />
          ))}

          {/* Month days */}
          {daysInMonth.map((day) => {
            const isFuture = isAfter(day, now) && !isSameDay(day, now);
            const dateStr = format(day, 'yyyy-MM-dd');
            const hours = dailyHours.get(dateStr) || 0;
            
            if (isFuture) {
              return (
                <div key={day.toISOString()} className="aspect-square rounded-sm bg-muted/20 flex items-center justify-center text-muted-foreground/30 text-xs font-medium cursor-not-allowed">
                  {format(day, 'd')}
                </div>
              );
            }

            return (
              <div 
                key={day.toISOString()} 
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setSelectedDay(day);
                }}
                className={`aspect-square rounded-sm flex items-center justify-center text-xs transition-transform duration-200 hover:scale-110 cursor-pointer ${getHeatmapColor(hours)} ${isToday(day) ? 'ring-2 ring-foreground ring-offset-1 ring-offset-card' : ''}`}
                title={`${Math.round(hours * 10) / 10} hours`}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mt-auto">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3.5 h-3.5 rounded-[2px] bg-muted opacity-50" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-primary/30" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-primary/60" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-primary/80" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-primary shadow-sm" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Timeline Modal */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-md bg-card border-border sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-xl flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Activity for {selectedDay && format(selectedDay, 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-6">
            {selectedDayLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No activity recorded for this date.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-primary/20 ml-3 space-y-6 pb-2">
                {selectedDayLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log, i) => {
                  const d = new Date(log.timestamp);
                  // Format strictly as IST
                  const timeString = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={i} className="relative pl-6">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-card ${log.status === 'CHECK_IN' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{log.status === 'CHECK_IN' ? 'Checked In' : 'Checked Out'}</span>
                        <span className="text-sm text-muted-foreground">{timeString} (IST)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
