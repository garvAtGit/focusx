"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  UserCheck, LayoutGrid, Timer, BellRing, 
  TrendingUp, ArrowUpRight, ArrowDownRight, ArrowRight,
  MoreHorizontal, ChevronDown, CheckCircle2, CheckSquare, Settings, Settings2, FileText, 
  MapPin, LogIn, LogOut, CreditCard, Wallet, BookOpen, UserPlus
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatStandardDate } from "@/lib/date-utils";
import { StudentProfileModal } from "@/components/StudentProfileModal";

export function DashboardOverviewClient({
  library,
  studentCount,
  occupancyPercentage,
  bookedSeats,
  totalSeats,
  expiringCount,
  pendingQueries,
  studentsInside,
  chartData,
  todaysAttendance,
  pendingApprovals,
  liveAccess,
  recentActivity,
  todaysTransactions
}: any) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(todaysAttendance[0]?.name || null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [activeChartData, setActiveChartData] = useState(chartData);
  const [dateRange, setDateRange] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  useEffect(() => {
    if (dateRange === "30d" && !customStart) {
      setActiveChartData(chartData);
      return;
    }

    if (dateRange === "custom" && (!customStart || !customEnd)) {
      return;
    }

    const fetchChartData = async () => {
      setIsLoadingChart(true);
      try {
        let start = new Date();
        let end = new Date();
        
        if (dateRange === "today") {
          start.setHours(0,0,0,0);
        } else if (dateRange === "7d") {
          start.setDate(start.getDate() - 6);
          start.setHours(0,0,0,0);
        } else if (dateRange === "3m") {
          start.setMonth(start.getMonth() - 3);
          start.setHours(0,0,0,0);
        } else if (dateRange === "custom") {
          start = new Date(customStart);
          end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
        }

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        
        const res = await fetch(`/api/dashboard/analytics/bookings?start=${startStr}&end=${endStr}`);
        if (!res.ok) throw new Error("Failed to fetch");
        
        const data = await res.json();
        
        const transformedData = data.days.map((d: any) => {
           const dateObj = new Date(d.date);
           return {
              name: dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }),
              enrollments: d.newCount,
              renewals: d.renewalCount
           };
        });

        // Ensure at least 2 points so AreaChart renders correctly if it's "Today"
        if (transformedData.length === 1) {
           transformedData.unshift({
             name: "Start",
             enrollments: 0,
             renewals: 0
           });
        } else if (transformedData.length === 0 && dateRange === "today") {
           transformedData.push({ name: "Start", enrollments: 0, renewals: 0 });
           transformedData.push({ name: "End", enrollments: 0, renewals: 0 });
        }
        
        setActiveChartData(transformedData);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingChart(false);
      }
    };
    
    fetchChartData();
  }, [dateRange, customStart, customEnd, chartData]);

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [showInside, setShowInside] = useState(false);
  const studentsWidgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      if (studentsWidgetRef.current && !studentsWidgetRef.current.contains(event.target as Node)) {
        setShowInside(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleExportCSV = () => {
    // Generate CSV for attendance
    const headers = ["Student", "First In", "Last Out", "Total Time", "Events"];
    const rows = todaysAttendance.map((s: any) => [
      s.name,
      s.firstIn,
      s.lastOut,
      s.totalHrs,
      s.events.map((e: any) => `${e.action} at ${e.time}`).join(" | ")
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-8 font-sans pb-10">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none">Dashboard Overview</h1>
          <p className="text-sm font-medium text-slate-500 mt-2">Welcome back, {library.name}. Here is your library&apos;s pulse.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/students" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-[0_2px_10px_-4px_var(--color-primary)] hover:opacity-90 transition-all active:scale-[0.98]">
            + New Booking
          </Link>
        </div>
      </div>

      {/* Top Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 relative">
        
        {/* 1. Students Inside Widget */}
        <div className="relative z-20" ref={studentsWidgetRef}>
          <div 
            className="bg-slate-900 p-7 rounded-[3rem] border border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-slate-700 transition-all duration-300 group cursor-pointer flex flex-col justify-between h-full relative overflow-hidden"
            onClick={() => setShowInside(!showInside)}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0085FF] opacity-20 blur-[50px] rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-start mb-6 relative z-10">
              <span className="text-sm font-bold text-slate-300">Students Inside</span>
              <div className="p-2.5 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors">
                <UserCheck className="w-5 h-5 text-[#0085FF] transition-colors" />
              </div>
            </div>
            
            <h3 className="text-5xl font-black text-white tracking-tight relative z-10">{studentsInside.length}</h3>
            
            <div className="mt-4 flex items-center gap-3 relative z-10">
              <div className="flex -space-x-2 overflow-hidden">
                 {studentsInside.slice(0, 4).map((student: any) => (
                   <div key={student.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-900 bg-slate-200 flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden text-slate-600">
                     {student.name.substring(0, 2).toUpperCase()}
                   </div>
                 ))}
                 {studentsInside.length > 4 && (
                   <div className="inline-flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-slate-900 bg-slate-800 text-[10px] font-bold text-white z-10 shadow-sm">
                     +{studentsInside.length - 4}
                   </div>
                 )}
              </div>
              <div className="text-[11px] font-bold text-slate-400 group-hover:text-slate-300 transition-colors">Tap to view &rarr;</div>
            </div>
          </div>

          {showInside && (
            <div className="absolute top-full left-0 mt-3 w-64 bg-white border border-slate-200 rounded-3xl shadow-xl p-4 z-50 flex flex-col gap-2 max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-2 px-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Currently Inside</span>
                <button onClick={() => setShowInside(false)} className="text-slate-400 hover:text-slate-900"><MoreHorizontal className="w-4 h-4" /></button>
              </div>
              {studentsInside.length === 0 && <div className="text-sm text-slate-500 text-center py-4">No one inside</div>}
              {studentsInside.map((student: any) => (
                <Link key={student.id} href={`/dashboard/students?search=${student.phone}`} className="flex items-center gap-3 w-full p-2 rounded-2xl hover:bg-slate-50 transition-colors text-left group">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 shrink-0">
                     {student.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{student.name}</div>
                    <div className="text-[10px] font-semibold text-slate-400">View Profile &rarr;</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 2. Active Students */}
        <Link href="/dashboard/students" className="bg-[#C6F135] p-7 rounded-[3rem] border border-[#b5e022] shadow-[0_8px_30px_rgba(198,241,53,0.15)] hover:shadow-[0_8px_30px_rgba(198,241,53,0.25)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden block">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-20 rounded-full blur-[40px] pointer-events-none"></div>
          
          <div className="absolute bottom-0 left-0 right-0 h-28 opacity-[0.08] pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Area type="monotone" dataKey="enrollments" stroke="none" fill="#000000" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-800">Active Students</span>
            <div className="p-2.5 bg-white/40 backdrop-blur-sm rounded-xl">
              <UserCheck className="w-5 h-5 text-slate-900" />
            </div>
          </div>
          <div className="relative z-10 mt-auto">
            <h3 className="text-5xl font-black text-slate-900 tracking-tight drop-shadow-sm">{studentCount}</h3>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-slate-800/80 uppercase tracking-widest">Real-time count</span>
            </div>
          </div>
        </Link>

        {/* 3. Seat Occupancy */}
        <Link href="/dashboard/seats" className="bg-white p-7 rounded-[3rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between block">
          <div className="flex justify-between items-start mb-6">
            <span className="text-sm font-bold text-slate-500">Seat Occupancy</span>
            <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
              <LayoutGrid className="w-5 h-5 text-slate-900" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-black text-slate-900 tracking-tight">{occupancyPercentage}%</h3>
            </div>
            <div className="mt-4 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className="bg-slate-900 h-2.5 rounded-full" style={{ width: `${occupancyPercentage}%` }}></div>
            </div>
            <div className="mt-2.5 text-[11px] font-bold text-slate-400">
              {bookedSeats} of {totalSeats} seats booked
            </div>
          </div>
        </Link>

        {/* 4. Expiring Soon */}
        <Link href="/dashboard/students?filter=expiring" className="bg-white p-7 rounded-[3rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden block">
          <div className="absolute -right-12 -top-12 w-72 h-72 bg-amber-500/15 rounded-full blur-[60px] pointer-events-none group-hover:bg-amber-500/25 transition-colors duration-500"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">Expiring Soon</span>
            <div className="p-2.5 bg-white border border-slate-100 shadow-sm rounded-xl">
              <Timer className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-5xl font-black text-slate-900 tracking-tight">{expiringCount}</h3>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">In next 3 days</span>
            </div>
          </div>
        </Link>

        {/* 5. New Queries */}
        <Link href="/dashboard/queries" className="bg-white p-7 rounded-[3rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden block">
          <div className="absolute -right-12 -bottom-12 w-72 h-72 bg-[#0085FF]/15 rounded-full blur-[60px] pointer-events-none group-hover:bg-[#0085FF]/25 transition-colors duration-500"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">New Queries (7d)</span>
            <div className="p-2.5 bg-white border border-slate-100 shadow-sm rounded-xl">
              <BellRing className="w-5 h-5 text-[#0085FF]" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-5xl font-black text-slate-900 tracking-tight">{pendingQueries}</h3>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Reviews & complaints
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6 items-start">
         
         <div className="xl:col-span-2 flex flex-col gap-6">
            
            {/* Admissions Chart */}
            <div className="bg-white border border-slate-200/60 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/50 gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Admissions Chart</h2>
                    <p className="text-[13px] font-semibold text-slate-500 mt-1">Bookings (New & Renewals)</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-8 cursor-pointer relative"
                      style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                    >
                      <option value="today">Today</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="3m">Last 3 Months</option>
                      <option value="custom">Custom Range</option>
                    </select>

                    {dateRange === "custom" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                        />
                        <span className="text-slate-400 font-medium">to</span>
                        <input
                          type="date"
                          className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6 h-[350px] w-full relative">
                  {isLoadingChart && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEnrollments" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary, #3b82f6)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary, #3b82f6)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorRenewals" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-xl border border-slate-800">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 border-b border-slate-700 pb-2">{payload[0].payload.name}</p>
                                <div className="flex flex-col gap-1.5">
                                   <div className="flex items-center gap-3 justify-between">
                                     <span className="flex items-center gap-1.5 text-slate-300 text-xs font-semibold"><div className="w-2 h-2 rounded-full bg-primary" /> New Enrollments</span>
                                     <span className="font-bold">{payload[0]?.value || 0}</span>
                                   </div>
                                   <div className="flex items-center gap-3 justify-between">
                                     <span className="flex items-center gap-1.5 text-slate-300 text-xs font-semibold"><div className="w-2 h-2 rounded-full bg-slate-400" /> Renewals</span>
                                     <span className="font-bold">{payload[1]?.value || 0}</span>
                                   </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area 
                        type="monotoneX" 
                        dataKey="enrollments" 
                        stroke="var(--color-primary, #3b82f6)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorEnrollments)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-primary, #3b82f6)' }}
                      />
                      <Area 
                        type="monotoneX" 
                        dataKey="renewals" 
                        stroke="#94a3b8" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorRenewals)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* Today's Attendance */}
            <div className="bg-gradient-to-b from-white to-indigo-50/40 border border-slate-200/60 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <div>
                     <h2 className="text-xl font-black text-slate-900 tracking-tight">Today&apos;s Attendance</h2>
                     <p className="text-[13px] font-semibold text-slate-500 mt-1">{todaysAttendance.length} students recorded today</p>
                   </div>
                   <div className="flex gap-3">
                     <button onClick={handleExportCSV} className="text-[13px] font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:bg-slate-50 hover:shadow-[0_4px_15px_rgba(0,0,0,0.06)] transition-all">Export CSV</button>
                   </div>
                </div>
                <div className="p-0 overflow-x-auto overflow-y-auto w-full max-h-[500px]">
                   <table className="w-full text-left table-fixed border-collapse min-w-[900px]">
                      <thead className="bg-white sticky top-0 z-20 shadow-sm">
                        <tr>
                          <th className="w-[40%] px-8 py-5 text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-100">Student</th>
                          <th className="w-[15%] px-8 py-5 text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-100">First In</th>
                          <th className="w-[15%] px-8 py-5 text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-100">Last Out</th>
                          <th className="w-[15%] px-8 py-5 text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-100">Daily Avg</th>
                          <th className="w-[15%] px-8 py-5 text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-100">Today</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                  {todaysAttendance.length === 0 && (
                    <tr><td colSpan={4} className="px-8 py-8 text-center text-sm text-slate-500">No attendance records today</td></tr>
                  )}
                  {todaysAttendance.map((student: any) => {
                    const isExpanded = expandedStudent === student.name;
                    return (
                      <React.Fragment key={student.name}>
                        <tr 
                          onClick={() => setExpandedStudent(isExpanded ? null : student.name)}
                          className="bg-white hover:bg-slate-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-8 py-5">
                            <div 
                              className="flex items-center gap-4 hover:bg-slate-50 p-1.5 -m-1.5 rounded-lg transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProfileStudentId(student.studentId);
                              }}
                            >
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 shrink-0 overflow-hidden">
                                {student.image ? (
                                  <img src={student.image} alt={student.name} className="w-full h-full object-cover" />
                                ) : (
                                  student.name.substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="text-[15px] font-black text-slate-900 group-hover:text-[#0085FF] transition-colors">{student.name}</div>
                                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{student.optedStr} limit</span>
                                </div>
                                <div className="text-[13px] font-semibold text-slate-500 mt-0.5">{student.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-[14px] font-bold text-slate-900">{student.firstIn}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-[14px] font-bold text-slate-400">{student.lastOut}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className={`flex flex-col`}>
                              <span className={`text-[14px] font-bold ${student.overstayHrs > 0.5 ? 'text-rose-600' : 'text-slate-900'}`}>{student.avgStr}</span>
                              {student.overstayHrs > 0.5 && (
                                <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Overstaying</span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-start justify-between w-full">
                              <div className="flex flex-col">
                                <span className={`text-[14px] font-bold ${(student.todayHrs - student.optedHrs) > 0.5 ? 'text-rose-600' : 'text-slate-400'}`}>{student.totalHrs}</span>
                                {(student.todayHrs - student.optedHrs) > 0.5 && (
                                  <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest mt-0.5">Overstaying</span>
                                )}
                              </div>
                              <button className="text-[13px] font-bold text-slate-400 group-hover:text-[#0085FF] flex items-center transition-colors mt-0.5">
                                 <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#0085FF]' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                            <td colSpan={5} className="px-8 py-6 relative">
                                <div className="absolute left-[3.25rem] top-0 bottom-10 w-0.5 bg-slate-200 rounded-b-full z-0"></div>
                                
                                <div className="pl-10 pr-0 relative z-10 w-full">
                                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
                                    <div 
                                      className="overflow-x-auto relative px-8 py-6"
                                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    >
                                      <style>{`
                                        .scrollbar-hide::-webkit-scrollbar { display: none; }
                                      `}</style>
                                      <div className="min-w-max flex items-start gap-12 relative scrollbar-hide">
                                        <div className="absolute top-[13px] left-4 right-4 h-0.5 bg-slate-200 z-0"></div>
                                        
                                        {student.events.map((ev: any, i: number) => (
                                          <div key={i} className={`relative flex flex-col items-center gap-3 bg-white px-2 shrink-0 z-10 ${ev.type === 'pending' ? 'opacity-50' : ''}`}>
                                             <span className={`text-[10px] tracking-wider font-black px-3 py-1 rounded-full border-2 border-white shadow-sm
                                                ${ev.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 
                                                  ev.type === 'out' ? 'bg-slate-200 text-slate-600' : 
                                                  'bg-slate-100 text-slate-400 border-dashed'}
                                             `}>
                                               {ev.action}
                                             </span>
                                             <span className={`text-[13px] font-bold ${ev.type === 'pending' ? 'text-slate-400' : 'text-slate-900'}`}>{ev.time}</span>
                                             
                                             {i < student.events.length - 1 && (
                                              <div className="absolute left-full top-0 h-[26px] w-12 flex items-center justify-center bg-white z-10">
                                                <ArrowRight className="w-4 h-4 text-slate-400" />
                                              </div>
                                             )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                    </table>
                </div>
            </div>

            {/* Transactions */}
            <div className="bg-gradient-to-b from-white to-emerald-50/30 border border-slate-200/60 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col min-h-[400px] h-full overflow-hidden">
               <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Today&apos;s Transactions</h2>
                    <p className="text-[13px] font-semibold text-slate-500 mt-1">₹{todaysTransactions.reduce((acc: number, tx: any) => acc + tx.amount, 0).toLocaleString('en-IN')} collected</p>
                  </div>
                  <Link href="/dashboard/financials" className="text-sm font-bold text-[#0085FF] hover:underline">View All</Link>
               </div>
               <div className="flex-1 overflow-x-auto overflow-y-auto p-0">
                 <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="bg-white sticky top-0">
                      <tr>
                        <th className="px-8 py-4 text-[10px] uppercase tracking-wider font-black text-slate-400 border-b border-slate-100">Time</th>
                        <th className="px-8 py-4 text-[10px] uppercase tracking-wider font-black text-slate-400 border-b border-slate-100">Details</th>
                        <th className="px-8 py-4 text-[10px] uppercase tracking-wider font-black text-slate-400 border-b border-slate-100 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {todaysTransactions.length === 0 && (
                        <tr><td colSpan={3} className="px-8 py-8 text-center text-sm text-slate-500">No transactions today</td></tr>
                      )}
                      {todaysTransactions.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="text-[13px] font-bold text-slate-900">{tx.time}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                {tx.method.toLowerCase().includes('razorpay') ? <CreditCard className="w-5 h-5 text-slate-500" /> : <Wallet className="w-5 h-5 text-slate-500" />}
                              </div>
                              <div>
                                <Link href={`/dashboard/students?search=${tx.phone}`} className="text-[15px] font-bold text-slate-900 hover:text-[#0085FF] transition-colors inline-block">{tx.student}</Link>
                                <div className="text-[13px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{tx.method}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="text-[15px] font-black text-slate-900">₹{tx.amount.toLocaleString('en-IN')}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>

         </div>

         {/* Right Sidebar */}
         <div className="flex flex-col gap-6 h-full">
            
            {/* Pending Approvals */}
            <div className="bg-white rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col min-h-[420px] max-h-[500px] overflow-hidden">
               <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Pending Approvals</h2>
                  {pendingApprovals.length > 0 && (
                    <span className="text-[11px] font-black bg-[#0085FF] text-white px-3 py-1 rounded-full shadow-sm">{pendingApprovals.length} NEW</span>
                  )}
               </div>
               <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
                  <div className="space-y-4">
                    {pendingApprovals.length === 0 && (
                      <div className="text-sm text-slate-500 text-center py-4">No pending approvals</div>
                    )}
                    {pendingApprovals.map((app: any) => (
                       <div key={app.id} className="p-5 rounded-[2rem] bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col gap-4 group">
                          <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 shrink-0">
                                {app.student.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <Link href={`/dashboard/approvals`} className="text-[15px] font-bold text-slate-900 hover:text-[#0085FF] transition-colors leading-tight inline-block line-clamp-1">{app.student}</Link>
                              <div className="text-[13px] font-semibold text-slate-500 mt-0.5 line-clamp-1">{app.plan} &bull; {app.time}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 w-full">
                             <Link href="/dashboard/approvals" className="w-full text-center px-4 py-2.5 text-[13px] font-bold bg-[#C6F135] text-slate-900 rounded-2xl hover:brightness-95 transition-all shadow-sm hover:-translate-y-0.5 duration-300">Review</Link>
                          </div>
                       </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Live Access Feed */}
            <div className="bg-white border border-slate-200/60 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col min-h-[400px] max-h-[500px] overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    Live Access
                  </h2>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    {liveAccess.length === 0 && (
                      <div className="text-sm text-slate-500 text-center py-4">No recent access</div>
                    )}
                    {liveAccess.map((log: any, i: number) => (
                       <div key={log.id} className="flex items-start gap-5 p-4 hover:bg-slate-50/80 rounded-[2rem] transition-all duration-300 border border-transparent hover:border-slate-100 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                         <div className="relative shrink-0">
                           <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 shrink-0">
                               {log.name.substring(0, 2).toUpperCase()}
                           </div>
                           <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-sm">
                             <div className={`p-1 rounded-full ${log.action === 'CHECK_IN' ? 'bg-emerald-500' : 'bg-slate-400'} text-white`}>
                               {log.action === 'CHECK_IN' ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                             </div>
                           </div>
                         </div>
                         <div className="flex-1 pt-1 flex justify-between items-start">
                           <div>
                             <p className="text-[15px] leading-tight">
                               <Link href={`/dashboard/students?search=${log.phone}`} className="font-bold text-slate-900 hover:text-[#0085FF] transition-colors line-clamp-1">{log.name}</Link>
                             </p>
                             <div className="flex items-center gap-2 mt-1.5">
                               <span className="text-[11px] font-bold text-slate-400">{log.time}</span>
                             </div>
                           </div>
                           <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 ml-2 ${log.action === 'CHECK_IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                             {log.action === 'CHECK_IN' ? 'CHECK IN' : 'CHECK OUT'}
                           </div>
                         </div>
                       </div>
                    ))}
                  </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col min-h-[420px] max-h-[500px] overflow-hidden group relative">
               <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">Recent Bookings</h2>
                </div>
               <div className="p-0 flex-1 overflow-y-auto">
                  <div className="divide-y divide-slate-100">
                    {recentActivity.length === 0 && (
                      <div className="p-6 text-sm text-slate-500 text-center">No recent activity</div>
                    )}
                    {recentActivity.map((activity: any) => (
                      <div key={activity.id} className="flex items-center justify-between px-8 py-5 hover:bg-slate-50 transition-all duration-300 cursor-pointer group/item">
                        <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 shrink-0">
                                {activity.student.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-sm">
                              <div className="p-1 bg-[#0085FF] text-white rounded-full"><UserPlus className="w-3 h-3" /></div>
                            </div>
                          </div>
                          <div>
                            <p className="text-[15px] leading-tight"><Link href={`/dashboard/students?search=${activity.phone}`} className="font-bold text-slate-900 hover:text-[#0085FF] transition-colors line-clamp-1">{activity.student}</Link> <span className="font-medium text-slate-500">enrolled</span></p>
                            <p className="text-[13px] font-bold text-[#0085FF] mt-1">{activity.plan}</p>
                          </div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap ml-4">{activity.time}</div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
         </div>

      </div>

      <StudentProfileModal 
        studentId={profileStudentId}
        open={!!profileStudentId}
        onOpenChange={(open) => !open && setProfileStudentId(null)}
      />
    </div>
  );
}
