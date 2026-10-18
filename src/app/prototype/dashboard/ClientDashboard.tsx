'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  BookOpen,
  Footprints,
  MoreVertical,
  Edit2,
  Trophy,
  Medal,
  Flame,
  User as UserIcon
} from 'lucide-react';
import { format, isSameDay, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

type SerializedLog = {
  id: string;
  status: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
};

type LeaderboardEntry = {
  id?: string;
  name: string;
  avatar: string | null;
  minutes: number;
  rank: number;
  isCurrentUser: boolean;
};

export function ClientDashboard({ logs, leaderboards, libraryName }: { logs: SerializedLog[], leaderboards: { today: LeaderboardEntry[], week: LeaderboardEntry[], month: LeaderboardEntry[] }, libraryName: string }) {
  // 1. Process Logs for Live State
  const parsedLogs = useMemo(() => logs.map(l => ({ ...l, timestamp: new Date(l.timestamp) })), [logs]);
  const lastLog = parsedLogs[parsedLogs.length - 1];
  const isCurrentlyCheckedIn = lastLog?.status === 'CHECK_IN';

  // 2. Live Focus Timer State
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [ringOffset, setRingOffset] = useState(452); // Start fully empty

  useEffect(() => {
    if (!isCurrentlyCheckedIn || !lastLog) return;
    
    const updateTimer = () => {
      const realMinutes = differenceInMinutes(new Date(), lastLog.timestamp);
      
      setElapsedMinutes(realMinutes);
      
      // Calculate how full the ring should be. Let's make a full ring = 8 hours (480 mins)
      // This way long study sessions (like 11 hours) still look cool and the animation has room.
      const targetOffset = 452 - (452 * (Math.min(realMinutes, 480) / 480));
      
      // Delay slightly longer to guarantee browser paint before applying CSS transition
      setTimeout(() => {
        setRingOffset(targetOffset);
      }, 300);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [isCurrentlyCheckedIn, lastLog]);

  // Format elapsed time like "2h 15m"
  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;
  const timerString = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const [leaderboardTimeline, setLeaderboardTimeline] = useState<'today' | 'week' | 'month'>('today');
  const currentLeaderboard = leaderboards[leaderboardTimeline] || [];

  return (
    <div className="space-y-8">
      {/* --- WIDGET 1: LIVE FOCUS GROWTH --- */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Animated Background Pulse if active */}
        {isCurrentlyCheckedIn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 bg-blue-100 rounded-full blur-3xl opacity-50 animate-pulse" />
          </div>
        )}

        <div className="relative z-10 text-center">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Current Session</h2>
          
          {/* Circular Progress / Ring */}
          <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
            {/* Background Track */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="8" fill="none" className="text-slate-100" />
              {isCurrentlyCheckedIn && (
                <circle 
                  cx="80" cy="80" r="72" 
                  stroke="url(#blue-gradient)" 
                  strokeWidth="8" 
                  fill="none" 
                  strokeDasharray="452" 
                  strokeDashoffset={ringOffset} 
                  strokeLinecap="round"
                  className="transition-all duration-[2000ms] ease-out" 
                />
              )}
              <defs>
                <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Center Content */}
            <div className="flex flex-col items-center justify-center bg-white rounded-full w-32 h-32 shadow-sm border border-slate-50">
              {isCurrentlyCheckedIn ? (
                <>
                  <div className="text-3xl font-black text-slate-900 tracking-tighter">{timerString}</div>
                  <div className="text-xs font-medium text-blue-500 mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Deep Work
                  </div>
                </>
              ) : (
                <>
                  <BookOpen className="w-8 h-8 text-slate-300 mb-2" />
                  <div className="text-xs font-bold text-slate-400">Ready</div>
                </>
              )}
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-500 font-medium">
            {isCurrentlyCheckedIn 
              ? "Stay focused. The ring grows as you study." 
              : "Check in at the library to start your focus ring."}
          </p>
        </div>
      </div>

      {/* --- WIDGET 2: LEADERBOARD --- */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="flex flex-col gap-5 mb-6 relative z-10">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-medium text-slate-800 tracking-tight">
              Top Scholars
            </h2>
            <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 w-fit">
              <p className="text-[13px] text-slate-500 font-medium">{libraryName}</p>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </div>
          
          {/* Timeline Pills */}
          <div className="flex p-1 bg-slate-50 rounded-xl">
            {(['today', 'week', 'month'] as const).map(t => (
              <button
                key={t}
                onClick={() => setLeaderboardTimeline(t)}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg capitalize transition-colors ${
                  leaderboardTimeline === t 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-100' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'today' ? 'Today' : `This ${t}`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          {currentLeaderboard.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No activity yet.</p>
            </div>
          ) : (
            currentLeaderboard.map((student, i) => {
              const hrs = Math.floor(student.minutes / 60);
              const mins = student.minutes % 60;
              
              // If it's the extra row appended for the current user who is not in top 5, add a divider
              const isExtraRow = student.isCurrentUser && student.rank > 5;
              const maxMinutes = currentLeaderboard[0]?.minutes || 1;

              return (
                <div key={`${student.id}-${student.rank}`}>
                  {isExtraRow && <div className="h-px bg-slate-100 my-4" />}
                  
                  <div className={`flex items-center gap-3 ${isExtraRow ? 'opacity-90' : ''}`}>
                    <div className={`w-6 text-center font-bold text-sm ${student.rank === 1 ? 'text-amber-500' : student.rank === 2 ? 'text-slate-400' : student.rank === 3 ? 'text-amber-700' : 'text-slate-300'}`}>
                      {student.rank}
                    </div>
                    
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border ${student.isCurrentUser ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-100'}`}>
                      {student.avatar ? (
                        <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                      ) : (
                        student.isCurrentUser 
                          ? <UserIcon className="w-5 h-5 text-blue-500" />
                          : <span className="text-slate-400 font-bold text-sm">{student.name.charAt(0)}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm truncate ${student.isCurrentUser ? 'text-blue-600' : 'text-slate-900'}`}>
                        {student.isCurrentUser ? `${student.name} (You)` : student.name}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="h-1.5 bg-slate-100 rounded-full w-full max-w-[100px] overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${student.isCurrentUser ? 'bg-blue-500' : 'bg-slate-300'}`} 
                            style={{ width: `${Math.max(5, (student.minutes / maxMinutes) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className={`font-bold text-sm ${student.isCurrentUser ? 'text-blue-600' : 'text-slate-900'}`}>
                        {hrs > 0 ? `${hrs}h ` : ''}{mins}m
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- WIDGET 3: TIMELINE VIEW --- */}
      <TimelineWidget logs={parsedLogs} />
    </div>
  );
}

type ParsedLog = Omit<SerializedLog, 'timestamp'> & { timestamp: Date };

function TimelineWidget({ logs }: { logs: ParsedLog[] }) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  // Find a day that has logs to be our initial selected date, or default to today
  const [selectedDate, setSelectedDate] = useState(() => {
    if (logs.length > 0) return logs[logs.length - 1].timestamp;
    return new Date();
  });

  // Calculate active dates for the blue dots
  const activeDatesStr = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => set.add(format(l.timestamp, 'yyyy-MM-dd')));
    return set;
  }, [logs]);

  // Build timeline events for the selected date
  const timelineEvents = useMemo(() => {
    const dayLogs = logs.filter(l => isSameDay(l.timestamp, selectedDate));
    if (dayLogs.length === 0) return [];

    dayLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const events = [];
    
    // Assume start of day was Home
    if (dayLogs[0].status === 'CHECK_IN') {
      events.push({
        type: 'location',
        title: 'Away / Home',
        subtitle: `Started at ${format(new Date(dayLogs[0].timestamp).setHours(8,0,0,0), 'h:mm a')}`, // Fake start of day
        icon: <Home className="w-4 h-4 text-white" />,
        iconBg: 'bg-blue-500',
      });
      events.push({
        type: 'action',
        title: 'Commuting',
        duration: 'Arriving',
        timeRange: `Until ${format(dayLogs[0].timestamp, 'h:mm a')}`,
        icon: <Footprints className="w-4 h-4 text-gray-700" />,
      });
    }

    for (let i = 0; i < dayLogs.length; i++) {
      const currentLog = dayLogs[i];
      const timeStr = format(currentLog.timestamp, 'h:mm a');

      if (currentLog.status === 'CHECK_IN') {
        // Location node for library
        events.push({
          type: 'location',
          title: 'FocusX Library',
          subtitle: `Arrived ${timeStr}`,
          icon: <BookOpen className="w-4 h-4 text-white" />,
          iconBg: 'bg-indigo-500',
        });

        // Action node for Study Session
        const nextLog = dayLogs[i + 1];
        if (nextLog && nextLog.status === 'CHECK_OUT') {
          const mins = differenceInMinutes(nextLog.timestamp, currentLog.timestamp);
          events.push({
            type: 'action',
            title: 'Deep Work Session',
            duration: `${Math.floor(mins/60)}h ${mins%60}m`,
            timeRange: `${timeStr} - ${format(nextLog.timestamp, 'h:mm a')}`,
            icon: <Footprints className="w-4 h-4 text-gray-700" />,
          });
        } else if (!nextLog) {
          // Still active
          const mins = differenceInMinutes(new Date(), currentLog.timestamp);
          events.push({
            type: 'action',
            title: 'Currently Studying',
            duration: `${Math.floor(mins/60)}h ${mins%60}m so far`,
            timeRange: `Started ${timeStr}`,
            icon: <Footprints className="w-4 h-4 text-gray-700" />,
          });
        }
      } else if (currentLog.status === 'CHECK_OUT') {
        // Location node for Away
        events.push({
          type: 'location',
          title: 'Away / Break',
          subtitle: `Left at ${timeStr}`,
          icon: <Home className="w-4 h-4 text-white" />,
          iconBg: 'bg-blue-500',
        });

        // Action node for Break
        const nextLog = dayLogs[i + 1];
        if (nextLog && nextLog.status === 'CHECK_IN') {
          const mins = differenceInMinutes(nextLog.timestamp, currentLog.timestamp);
          events.push({
            type: 'action',
            title: 'Time Away',
            duration: `${Math.floor(mins/60)}h ${mins%60}m`,
            timeRange: `${timeStr} - ${format(nextLog.timestamp, 'h:mm a')}`,
            icon: <Footprints className="w-4 h-4 text-gray-700" />,
          });
        }
      }
    }

    return events;
  }, [logs, selectedDate]);

  // Calendar render logic
  const monthStart = startOfMonth(selectedDate);
  const startPadding = monthStart.getDay();
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: endOfMonth(selectedDate) });

  return (
    <div className="relative w-full h-[600px] bg-white overflow-hidden shadow-xl rounded-[40px] border-[6px] border-slate-900 flex flex-col">
      {/* App Bar */}
      <div className="flex items-center px-4 pt-10 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button className="mx-auto flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
                onClick={() => setIsCalendarOpen(true)}>
          <span className="font-bold text-[17px] text-gray-900 tracking-tight">
            {isSameDay(selectedDate, new Date()) ? 'Today' : format(selectedDate, 'E, MMM d')}
          </span>
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-white relative">
        {timelineEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Footprints className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No activity for this day.</p>
          </div>
        ) : (
          <>
            <div className="absolute left-[39px] top-8 bottom-12 w-[3px] bg-[#4285F4] rounded-full" />
            <div className="space-y-0">
              {timelineEvents.map((event, i) => (
                <div key={i} className="flex items-start gap-4 py-3 relative z-10">
                  <div className={`w-12 flex justify-center ${event.type === 'action' ? 'mt-3' : 'mt-1'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm z-10 ${event.type === 'action' ? 'bg-white border border-gray-300' : event.iconBg}`}>
                      {event.icon}
                    </div>
                  </div>
                  <div className={`flex-1 ${event.type === 'action' ? 'pt-1' : 'pt-1.5'}`}>
                    {event.type === 'action' ? (
                      <div className="border border-blue-500 rounded-[20px] p-3 inline-block pr-6 bg-white/50 backdrop-blur-sm">
                        <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{event.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-[13px] text-gray-500">
                          <span>{event.duration}</span>
                        </div>
                        <div className="text-[13px] text-gray-500 mt-0.5">{event.timeRange}</div>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{event.title}</h3>
                        <p className="text-[13px] text-gray-500 mt-0.5">{event.subtitle}</p>
                      </>
                    )}
                  </div>
                  <button className={`text-gray-400 hover:text-gray-600 ${event.type === 'action' ? 'pt-3' : 'pt-1.5'}`}>
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <button className="absolute bottom-6 right-6 w-14 h-14 bg-white border border-gray-200 shadow-[0_4px_12px_rgb(0,0,0,0.15)] rounded-full flex items-center justify-center text-blue-600 hover:bg-gray-50 transition-colors z-10">
        <Edit2 className="w-6 h-6" />
      </button>

      {/* Calendar Overlay Modal */}
      {isCalendarOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-[340px] rounded-3xl shadow-2xl overflow-hidden pb-6">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-[28px] font-medium text-gray-800 tracking-tight">{format(selectedDate, 'E, MMM d')}</h2>
            </div>
            
            <div className="flex items-center justify-center px-4 py-2 gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                      onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setMonth(newDate.getMonth() - 1);
                        setSelectedDate(newDate);
                      }}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-[14px] font-bold text-gray-700">{format(selectedDate, 'MMMM yyyy')}</span>
              <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                      onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setMonth(newDate.getMonth() + 1);
                        setSelectedDate(newDate);
                      }}>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-4 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center text-[11px] font-bold text-gray-400">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-2 px-4">
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square flex flex-col items-center justify-center relative">
                  <span className="text-[13px] text-gray-300">
                    {/* dummy previous month days */}
                  </span>
                </div>
              ))}
              {daysInMonth.map((dayObj) => {
                const dayStr = format(dayObj, 'yyyy-MM-dd');
                const isActive = activeDatesStr.has(dayStr);
                const isSelected = isSameDay(dayObj, selectedDate);
                const dayNum = format(dayObj, 'd');

                return (
                  <div 
                    key={dayStr}
                    onClick={() => {
                      setSelectedDate(dayObj);
                      setIsCalendarOpen(false);
                    }}
                    className="aspect-[1/1.1] flex flex-col items-center justify-center relative cursor-pointer group"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors
                      ${isSelected ? 'bg-[#1a73e8] text-white shadow-md' : 'text-[#1a73e8] group-hover:bg-blue-50'}
                      ${!isActive && !isSelected ? 'text-gray-500' : ''}
                    `}>
                      {dayNum}
                    </div>
                    {isActive && !isSelected && (
                      <div className="absolute bottom-1 w-[5px] h-[5px] rounded-full bg-[#1a73e8]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
