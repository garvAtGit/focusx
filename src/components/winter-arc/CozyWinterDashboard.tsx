"use client";

import { motion } from "framer-motion";
import { Playfair_Display, Inter } from "next/font/google";
import { useState, useEffect } from "react";
import { Bell, ScanLine, User, Bluetooth, QrCode, ChevronLeft, ChevronRight, ChevronDown, Clock, BookOpen, Snowflake, ScrollText } from "lucide-react";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "700", "800"] });
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "600"] });



const checkinLogs = [
  { day: "Day 2", date: "Oct 2 (Today)", in: "10:15 AM", out: "Ongoing", duration: "6h 15m", active: true },
  { day: "Day 1", date: "Oct 1", in: "09:00 AM", out: "05:30 PM", duration: "8h 30m", active: false },
];

const Snowflakes = () => {
  const [flakes, setFlakes] = useState<{ id: number; left: number; duration: number; delay: number; size: number; opacity: number }[]>([]);

  useEffect(() => {
    const newFlakes = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      duration: Math.random() * 15 + 15,
      delay: Math.random() * 10,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1
    }));
    setFlakes(newFlakes);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {flakes.map(flake => (
        <motion.div
          key={flake.id}
          className="absolute top-[-10px] bg-[#e0e7ff] rounded-full blur-[1px]"
          style={{ 
            left: `${flake.left}%`, 
            width: flake.size, 
            height: flake.size,
            opacity: flake.opacity
          }}
          animate={{
            y: ['0vh', '100vh'],
            x: [`0px`, `${Math.sin(flake.id) * 20}px`]
          }}
          transition={{
            duration: flake.duration,
            delay: flake.delay,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

export default function CozyWinterDashboard({ student, pledge, recentLogs, topScholars, activeBooking }: any) {
  const studentName = student?.name || "Student";
  const studentId = student?.uniqueId || "FD-000000";
  const studentPhoto = student?.profilePhotoUrl || 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=2070&auto=format&fit=crop';
  const streak = student?.currentStreak || 0;
  const targetHours = pledge?.targetHours || 8;
  const [activeTab, setActiveTab] = useState('Today');

  // Compute Today's Focus from recentLogs
  let todaysFocusMinutes = 0;
  if (recentLogs && Array.isArray(recentLogs)) {
    const todayLogs = recentLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString());
    const sorted = todayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let lastIn = null;
    for (const log of sorted) {
      if (log.status === 'CHECK_IN') {
        lastIn = new Date(log.timestamp);
      } else if (log.status === 'CHECK_OUT' && lastIn) {
        todaysFocusMinutes += Math.floor((new Date(log.timestamp).getTime() - lastIn.getTime()) / 60000);
        lastIn = null;
      }
    }
    if (lastIn) {
      todaysFocusMinutes += Math.floor((new Date().getTime() - lastIn.getTime()) / 60000);
    }
  }

  const focusStr = `${Math.floor(todaysFocusMinutes / 60)}h ${todaysFocusMinutes % 60}m`;
  const progressPercent = Math.min(100, Math.floor((todaysFocusMinutes / (targetHours * 60)) * 100));

  // Convert live recentLogs from Prisma to the formatted array needed by the UI
  const formatLogs = () => {
    if (!recentLogs || !Array.isArray(recentLogs)) return [];
    
    // Group logs by date
    const grouped = recentLogs.reduce((acc: any, log: any) => {
      const dateKey = new Date(log.timestamp).toLocaleDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(log);
      return acc;
    }, {});

    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    return sortedDates.map((dateStr, index) => {
      const dayLogs = grouped[dateStr].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const firstIn = dayLogs.find((l: any) => l.status === 'CHECK_IN');
      const lastOut = dayLogs.reverse().find((l: any) => l.status === 'CHECK_OUT');
      
      const inStr = firstIn ? new Date(firstIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--';
      const outStr = lastOut ? new Date(lastOut.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ongoing';
      
      const isActive = outStr === 'Ongoing' && new Date(dateStr).toDateString() === new Date().toDateString();
      
      return {
        day: `Day ${sortedDates.length - index}`,
        date: new Date(dateStr).toDateString() === new Date().toDateString() ? `Today` : dateStr,
        in: inStr,
        out: outStr,
        duration: "See Details", // Would calculate real duration here in production
        active: isActive
      };
    });
  };

  const dynamicLogs = formatLogs().slice(0, 5); // take last 5 days

  return (
    <div className="min-h-screen bg-[#0a0705] text-[#e8ded1] flex flex-col items-center relative overflow-x-hidden font-serif selection:bg-[#4a2e1b] selection:text-[#fff6e5] pb-24">
      
      {/* Background Ambience: Warm Fireplace & Frosty Window */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center opacity-[0.25] mix-blend-luminosity pointer-events-none scale-105 filter sepia-[20%] brightness-75"
        style={{ backgroundImage: 'url(/cozy_winter_academia.jpg)' }}
      />
      {/* Warm ambient gradient overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0705]/60 via-[#0a0705]/80 to-[#0a0705] pointer-events-none" />
      
      {/* Film grain */}
      <div className="fixed inset-0 z-0 opacity-[0.10] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      <Snowflakes />

      <div className="relative z-10 w-full max-w-md px-4 pt-6 flex flex-col gap-6">
        
        {/* Top Navigation */}
        <header className="flex justify-between items-center w-full mb-2">
          <div className="flex items-center gap-2">
            <span className={`${playfair.className} text-2xl font-bold text-[#f5ecd8] tracking-tighter`}>X</span>
          </div>
          <div className="flex items-center gap-5 text-[#b5a796]">
            <ScanLine size={20} className="hover:text-[#f5ecd8] transition-colors cursor-pointer" />
            <Bell size={20} className="hover:text-[#f5ecd8] transition-colors cursor-pointer" />
            <div className="w-8 h-8 rounded-full border border-[#4a3b32] bg-[#1a1410] flex items-center justify-center overflow-hidden shadow-[0_0_10px_rgba(217,119,6,0.1)]">
              <User size={16} className="text-[#d9a05b]" />
            </div>
          </div>
        </header>

        {/* Identity & Access Card (Hero) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-[#4a3b32] bg-[#140f0c]/85 backdrop-blur-xl p-6 relative rounded-sm shadow-2xl shadow-black"
        >
          {/* Ornate corners */}
          <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#b5a796]/40" />
          <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[#b5a796]/40" />
          <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#b5a796]/40" />
          <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#b5a796]/40" />

          <div className="flex justify-between items-start mb-6">
            <div>
              <p className={`${playfair.className} text-lg italic text-[#a39687] mb-1`}>Welcome back,</p>
              <h1 className={`${playfair.className} text-3xl font-bold text-[#f5ecd8] tracking-wide`}>{studentName.toUpperCase()}</h1>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className={`${inter.className} text-[9px] uppercase tracking-[0.2em] text-[#8c7c6c] mb-1`}>Streak</span>
              <span className={`${playfair.className} text-2xl font-bold text-[#d9a05b] drop-shadow-[0_0_8px_rgba(217,160,91,0.4)]`}>{streak}</span>
            </div>
          </div>

          {/* Portrait / Polaroid area */}
          <div className="w-full aspect-[4/3] bg-[#0a0705] border border-[#362b24] p-2 mb-6 relative overflow-hidden group rounded-sm">
            <div 
              className="w-full h-full bg-cover bg-center opacity-80 group-hover:opacity-100 transition-opacity duration-700 filter contrast-125 sepia-[30%]"
              style={{ backgroundImage: `url(${studentPhoto})` }}
            />
            {/* Ember glow shadow */}
            <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(20,10,0,0.9)] pointer-events-none" />
          </div>

          <h2 className={`${inter.className} text-xl tracking-[0.3em] text-[#f5ecd8] text-center mb-6 font-light`}>
            {studentId}
          </h2>

          <div className="space-y-3">
            <button className="w-full py-4 flex items-center justify-center gap-3 border border-[#b5a796]/30 bg-[#1c1612]/70 hover:bg-[#1c1612] transition-colors group">
              <QrCode size={16} className="text-[#b5a796]" />
              <span className={`${inter.className} text-xs tracking-widest text-[#e8ded1] uppercase group-hover:text-[#f5ecd8]`}>
                Tap to show QR
              </span>
            </button>
            <button className="w-full py-4 flex items-center justify-center gap-3 border border-[#4a3b32] bg-transparent hover:bg-[#1c1612]/40 transition-colors group">
              <Bluetooth size={16} className="text-[#d9a05b]" />
              <span className={`${inter.className} text-xs tracking-widest text-[#d9a05b] uppercase`}>
                Unlock via Bluetooth
              </span>
            </button>
          </div>
        </motion.div>

        {/* The Scholar's Arc (Personal Progress) - COZY WINTER */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-[#4a3b32] bg-[#140f0c]/85 backdrop-blur-xl p-6 relative rounded-sm"
        >
          {/* Subtle frost glow overlay */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 blur-[50px] rounded-full pointer-events-none" />

          <div className="flex justify-between items-start mb-6 border-b border-[#362b24] pb-4">
            <div className="flex items-center gap-3">
              <Snowflake size={18} className="text-[#93c5fd] drop-shadow-[0_0_8px_rgba(147,197,253,0.5)]" />
              <h2 className={`${playfair.className} text-xl text-[#f5ecd8]`}>Winter Arc</h2>
            </div>
            <span className={`${inter.className} text-[9px] uppercase tracking-[0.2em] text-[#93c5fd] border border-[#93c5fd]/30 bg-[#93c5fd]/10 px-2 py-1`}>
              Active
            </span>
          </div>

          <div className="mb-2 flex justify-between items-end">
            <div>
              <p className={`${inter.className} text-[10px] uppercase tracking-[0.2em] text-[#8c7c6c] mb-1`}>Today's Focus</p>
              <p className={`${playfair.className} text-3xl font-bold text-[#f5ecd8]`}>{focusStr}</p>
            </div>
            <div className="text-right">
              <p className={`${inter.className} text-[10px] uppercase tracking-[0.2em] text-[#8c7c6c] mb-1`}>Goal</p>
              <p className={`${playfair.className} text-xl text-[#a39687]`}>{targetHours}h 00m</p>
            </div>
          </div>

          {/* Glowing Ember/Frost Progress Bar */}
          <div className="h-1.5 w-full bg-[#0a0705] relative mt-4 mb-6 border border-[#362b24] overflow-hidden rounded-full">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#1e3a8a] via-[#3b82f6] to-[#93c5fd] shadow-[0_0_10px_rgba(147,197,253,0.8)]"
            />
          </div>

          <div className="flex justify-between items-center text-[11px] text-[#8c7c6c]">
            <span className={`${inter.className} uppercase tracking-wider`}>Monthly Arc: 42 / 240 hrs</span>
            <span className={`${playfair.className} italic text-[#d9a05b]`}>The hearth is lit.</span>
          </div>
        </motion.div>

        {/* The Arc Ledger (Check-in/Check-out Daily Log) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="border border-[#4a3b32] bg-[#140f0c]/85 backdrop-blur-xl p-6 relative rounded-sm"
        >
          <div className="flex items-center gap-3 mb-6 border-b border-[#362b24] pb-4">
            <ScrollText size={18} className="text-[#b5a796]" />
            <h2 className={`${playfair.className} text-xl text-[#f5ecd8]`}>The Arc Ledger</h2>
          </div>

          <div className="space-y-4">
            {dynamicLogs.map((log, i) => (
              <div key={i} className="flex items-center justify-between border-b border-[#261d18] pb-4 last:border-0 last:pb-0">
                <div>
                  <p className={`${inter.className} text-[10px] uppercase tracking-widest ${log.active ? 'text-[#d9a05b]' : 'text-[#8c7c6c]'} mb-1`}>
                    <span className="font-bold text-[#b5a796]">{log.day}</span> &nbsp;•&nbsp; {log.date}
                  </p>
                  <p className={`${playfair.className} text-sm text-[#e8ded1]`}>
                    {log.in} <span className="text-[#8c7c6c] mx-1">→</span> {log.out}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`${playfair.className} text-lg ${log.active ? 'text-[#93c5fd]' : 'text-[#b5a796]'}`}>
                    {log.duration}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <button onClick={() => window.location.href = '/student/profile'} className={`${inter.className} w-full mt-4 py-3 text-[10px] uppercase tracking-widest text-[#8c7c6c] hover:text-[#d9a05b] transition-colors border border-transparent hover:border-[#4a3b32]`}>
            View Full Archive
          </button>
        </motion.div>

        {/* The Daily Charter (Plan Details) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="border border-[#4a3b32] bg-[#140f0c]/85 backdrop-blur-xl p-6 relative rounded-sm"
        >
          <div className="flex items-center gap-3 mb-6 border-b border-[#362b24] pb-4">
            <BookOpen size={18} className="text-[#b5a796]" />
            <h2 className={`${playfair.className} text-xl text-[#f5ecd8]`}>Active Plan</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={`${inter.className} text-[10px] uppercase tracking-[0.2em] text-[#8c7c6c]`}>Current Plan</span>
              <span className={`${playfair.className} text-sm text-[#f5ecd8] font-semibold`}>{activeBooking?.plan?.name || "No Active Plan"}</span>
            </div>
            
            <div className="flex justify-between items-center border-t border-[#261d18] pt-4">
              <span className={`${inter.className} text-[10px] uppercase tracking-[0.2em] text-[#8c7c6c]`}>Library</span>
              <div className="flex items-center gap-2">
                <span className={`${playfair.className} text-sm text-[#e8ded1]`}>{activeBooking?.library?.name || "FocusX"}</span>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-[#261d18] pt-4">
              <span className={`${inter.className} text-[10px] uppercase tracking-[0.2em] text-[#8c7c6c]`}>Renewal Date</span>
              <span className={`${playfair.className} text-sm text-[#b5a796] italic`}>{activeBooking ? new Date(activeBooking.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "-"}</span>
            </div>
          </div>
        </motion.div>

        {/* Top Scholars / The Ledger Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-[#4a3b32] bg-[#140f0c]/85 backdrop-blur-xl p-6 relative rounded-sm"
        >
          <div className="mb-6">
            <h2 className={`${playfair.className} text-2xl text-[#f5ecd8] mb-1`}>Top Scholars</h2>
            <div className="flex items-center gap-1 text-[#b5a796] cursor-pointer">
              <span className={`${inter.className} text-xs tracking-wide`}>Shanti Library</span>
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex w-full mb-8 border-b border-[#362b24]">
            {['Today', 'This Week', 'This Month'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  flex-1 pb-3 text-center transition-all duration-300 relative
                  ${inter.className} text-[10px] uppercase tracking-widest
                  ${activeTab === tab ? 'text-[#f5ecd8]' : 'text-[#756658] hover:text-[#b5a796]'}
                `}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#d9a05b]" />
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="space-y-5">
            {(() => {
              let scholarsToRender = [];
              if (Array.isArray(topScholars)) scholarsToRender = topScholars;
              else if (topScholars) {
                if (activeTab === 'Today') scholarsToRender = topScholars.today || [];
                else if (activeTab === 'This Week') scholarsToRender = topScholars.week || [];
                else if (activeTab === 'This Month') scholarsToRender = topScholars.month || [];
              }
              return scholarsToRender;
            })().map((scholar: any, i: number) => (
              <div key={`${scholar.name}-${scholar.rank}`} className="flex items-center justify-between group">
                <div className="flex items-center gap-4 flex-1">
                  <span className={`${playfair.className} text-[#b5a796] w-4 text-center italic`}>
                    {scholar.rank}
                  </span>
                  
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full border border-[#362b24] bg-[#1a1410] flex items-center justify-center text-xs font-serif text-[#a39687]">
                    {scholar.name.charAt(0)}
                  </div>
                  
                  <div className="flex-1">
                    <p className={`${playfair.className} text-sm text-[#e8ded1] group-hover:text-[#f5ecd8] transition-colors mb-1`}>
                      {scholar.name}
                    </p>
                    {/* Progress Bar */}
                    <div className="h-[2px] w-full bg-[#0a0705] relative max-w-[120px] rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#8c572a] to-[#d9a05b]" 
                        style={{ width: scholar.progress }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className={`${inter.className} text-xs text-[#b5a796] tracking-wider`}>
                  {scholar.time}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Date / Calendar Widget */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border border-[#4a3b32] bg-[#140f0c]/85 backdrop-blur-xl p-5 flex justify-between items-center rounded-sm"
        >
          <span className={`${playfair.className} text-lg text-[#f5ecd8]`}>
            Fri, October 2
          </span>
          <div className="flex items-center gap-3">
            <button className="w-6 h-6 border border-[#362b24] flex items-center justify-center hover:bg-[#1a1410] transition-colors rounded-sm text-[#b5a796]">
              <ChevronLeft size={12} />
            </button>
            <span className={`${inter.className} text-[10px] tracking-widest text-[#a39687] uppercase`}>
              Oct 2026
            </span>
            <button className="w-6 h-6 border border-[#362b24] flex items-center justify-center hover:bg-[#1a1410] transition-colors rounded-sm text-[#b5a796]">
              <ChevronRight size={12} />
            </button>
          </div>
        </motion.div>

      </div>

      {/* Global CSS for overriding layout navbar and body */}
      <style dangerouslySetInnerHTML={{__html: `
        header.navbar-sticky { 
          background-color: #0a0705 !important; 
          border-bottom-color: #362b24 !important; 
        }
        header.navbar-sticky span.text-primary { 
          color: #f5ecd8 !important; 
        }
        body {
          background-color: #0a0705 !important;
        }
        footer {
          display: none !important;
        }
      `}} />
    </div>
  );
}

