'use client';

import { useState } from 'react';
import { Flame, Key, User as UserIcon, Moon, Sun, ArrowLeft, ScanLine, LayoutTemplate, Sparkles, Camera } from 'lucide-react';
import Link from 'next/link';

export default function PrototypePass() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [designStyle, setDesignStyle] = useState<'aurora' | 'graphic'>('graphic');
  // Dummy data
  const student = {
    name: 'Garv Choudhary', // Full name for testing
    uniqueId: 'FD-26QXY4',
    profilePhotoUrl: null,
    joinDate: '15.06',
  };
  const currentStreak: number = 0;

  // Helper to format name: "Garv Choudhary" -> "Garv  C."
  const formatName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
      const firstName = parts[0];
      const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase();
      return `${firstName}\u00A0\u00A0${lastNameInitial}.`; // Added extra non-breaking space
    }
    return fullName;
  };
  
  const formattedName = formatName(student.name);

  return (
    <div className={`min-h-[100dvh] w-full relative overflow-x-hidden overflow-y-auto transition-colors duration-700 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Top Controls - purely for the prototype */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        <Link href="/" className={`p-2 rounded-full backdrop-blur-md border transition-all ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-black/5 border-black/10 text-black hover:bg-black/10'}`}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>
      
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-black/10 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-lg">
        {/* Style Toggle */}
        <button 
          onClick={() => setDesignStyle('aurora')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-bold uppercase tracking-wider ${designStyle === 'aurora' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black')}`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Aurora
        </button>
        <button 
          onClick={() => setDesignStyle('graphic')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-bold uppercase tracking-wider ${designStyle === 'graphic' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black')}`}
        >
          <LayoutTemplate className="w-3.5 h-3.5" /> Graphic
        </button>

        <div className="w-px h-5 bg-white/20 mx-1"></div>

        {/* Theme Toggle */}
        <button onClick={() => setTheme('light')} className={`p-1.5 rounded-full transition-all ${theme === 'light' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}>
          <Sun className="w-4 h-4" />
        </button>
        <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-full transition-all ${theme === 'dark' ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black'}`}>
          <Moon className="w-4 h-4" />
        </button>
      </div>

      {/* ==============================================================
          DESIGN 1: AURORA BOREALIS
          ============================================================== */}
      {designStyle === 'aurora' && (
        <>
          <div className="fixed top-0 left-0 right-0 h-[60vh] pointer-events-none z-0">
            <div className={`absolute inset-0 transition-opacity duration-700 ${theme === 'light' ? 'opacity-40 bg-gradient-to-b from-slate-200 to-transparent' : 'opacity-0'}`}></div>
            <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[150%] h-[150%] max-w-[1000px] opacity-80">
              <div className={`absolute top-0 left-[20%] w-[40%] h-[60%] rounded-[100%] mix-blend-screen filter blur-[80px] sm:blur-[120px] animate-aurora-1 ${theme === 'dark' ? 'bg-blue-600/60' : 'bg-blue-500/80 mix-blend-multiply'}`}></div>
              <div className={`absolute top-[10%] right-[20%] w-[45%] h-[55%] rounded-[100%] mix-blend-screen filter blur-[80px] sm:blur-[120px] animate-aurora-2 ${theme === 'dark' ? 'bg-purple-600/60' : 'bg-purple-500/80 mix-blend-multiply'}`}></div>
              <div className={`absolute -top-[10%] left-[30%] w-[50%] h-[40%] rounded-[100%] mix-blend-screen filter blur-[100px] sm:blur-[140px] animate-aurora-3 ${theme === 'dark' ? 'bg-orange-500/50' : 'bg-orange-400/70 mix-blend-multiply'}`}></div>
            </div>
            <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-100% ${theme === 'dark' ? 'to-[#050505]' : 'to-slate-50'}`}></div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-start pt-24 sm:pt-32 px-4 pb-20">
            <div className="w-full max-w-[380px] mb-8 text-center sm:text-left sm:ml-4">
              <h1 className={`text-3xl font-heading font-medium tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Good evening, <span className={`font-serif italic font-bold bg-clip-text text-transparent animate-liquid bg-[length:300%_300%] ${theme === 'dark' ? 'bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400' : 'bg-gradient-to-r from-blue-600 via-fuchsia-600 to-orange-600'}`}>{formattedName}</span>
              </h1>
            </div>

            <div className={`w-full max-w-[380px] rounded-[32px] overflow-hidden shadow-2xl backdrop-blur-3xl border transition-all duration-500 ${theme === 'dark' ? 'bg-white/[0.04] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]' : 'bg-white/[0.7] border-white shadow-[0_8px_32px_rgba(0,0,0,0.05)]'}`}>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              
              <div className={`absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-lg border backdrop-blur-md ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white/80 border-black/5'}`}>
                <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent font-bold text-xs uppercase tracking-wider">{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
              </div>

              <div className="pt-12 px-6 pb-6 flex flex-col items-center text-center relative z-10">
                <div className={`relative w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl p-1 ${theme === 'dark' ? 'bg-gradient-to-b from-white/20 to-transparent' : 'bg-gradient-to-b from-black/10 to-transparent'}`}>
                  <div className={`absolute inset-0 rounded-full animate-spin-slow blur-md ${theme === 'dark' ? 'bg-gradient-to-tr from-blue-500 via-purple-500 to-orange-500 opacity-20' : 'bg-gradient-to-tr from-blue-400 via-purple-400 to-orange-400 opacity-40'}`}></div>
                  <div className={`w-full h-full rounded-full flex items-center justify-center relative z-10 overflow-hidden ${theme === 'dark' ? 'bg-[#111] text-white/50' : 'bg-white text-slate-400'}`}>
                    {student.profilePhotoUrl ? <img src={student.profilePhotoUrl} alt="" className="w-full h-full object-cover" /> : <img src="https://api.dicebear.com/9.x/micah/svg?seed=placeholder" alt="Placeholder" className="w-full h-full object-cover" />}
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full font-mono font-bold text-sm tracking-[0.2em] border shadow-sm ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/90' : 'bg-black/5 border-black/10 text-slate-700'}`}>{student.uniqueId}</div>
              </div>

              <div className="px-6 pb-8 w-full flex flex-col items-center relative z-10">
                <div className="w-full max-w-[240px] aspect-square rounded-[24px] relative overflow-hidden group cursor-pointer">
                  <div className={`absolute inset-0 rounded-[24px] border-2 transition-colors duration-300 z-20 pointer-events-none ${theme === 'dark' ? 'border-white/5 group-hover:border-white/20' : 'border-black/5 group-hover:border-black/10'}`}></div>
                  <div className={`absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg')] bg-contain bg-center bg-no-repeat scale-105 transition-transform duration-500 group-hover:scale-110 blur-[2px] ${theme === 'dark' ? 'invert opacity-30' : 'opacity-20'}`} />
                  <div className={`absolute inset-0 backdrop-blur-[4px] transition-colors duration-300 z-10 ${theme === 'dark' ? 'bg-black/10 group-hover:bg-black/20' : 'bg-white/30 group-hover:bg-white/40'}`} />
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50 animate-scan z-10 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-30 transition-all duration-300 group-hover:scale-[1.03]">
                    <div className={`font-medium px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl flex flex-col items-center gap-1.5 ${theme === 'dark' ? 'bg-white/10 text-white border-white/20 shadow-black/50' : 'bg-white/90 text-slate-800 border-white shadow-slate-200/50'}`}>
                      <ScanLine className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className="text-sm tracking-wide">Tap to reveal</span>
                    </div>
                  </div>
                </div>
                <p className={`mt-6 text-[10px] font-bold tracking-[0.3em] uppercase ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>FocusX Digital Pass</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==============================================================
          DESIGN 2: GRAPHIC / MAGAZINE
          ============================================================== */}
      {designStyle === 'graphic' && (
        <div className={`relative min-h-[100dvh] w-full flex flex-col items-center px-4 pt-28 pb-20 ${theme === 'dark' ? 'bg-[#111111]' : 'bg-[#e5e5e5]'}`}>
          
          {/* Background Grid & Typography */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Grid Pattern */}
            <div className={`absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CiAgPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPgogIDxwYXRoIGQ9Ik0wIDM5aDQwVjQwSDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+CiAgPHBhdGggZD0iTTM5IDB2NDBoMVYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPgo8L3N2Zz4=')] ${theme === 'light' ? 'invert opacity-20' : 'opacity-10'}`}></div>
            
            {/* Massive repeating text */}
            <div className="absolute top-[10%] -left-[50%] w-[200%] rotate-[-10deg] flex flex-col opacity-[0.03] pointer-events-none select-none">
              <span className={`text-[12rem] font-bold leading-none tracking-tighter uppercase whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                {formattedName} {formattedName} {formattedName}
              </span>
              <span className={`text-[12rem] font-bold leading-none tracking-tighter uppercase whitespace-nowrap ml-20 ${theme === 'dark' ? 'text-transparent border-text-white' : 'text-transparent border-text-black'}`} style={{ WebkitTextStroke: '2px currentColor' }}>
                {formattedName} {formattedName} {formattedName}
              </span>
              <span className={`text-[12rem] font-bold leading-none tracking-tighter uppercase whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                {formattedName} {formattedName} {formattedName}
              </span>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-[400px]">
            {/* The Poster Card */}
            <div className={`relative w-full rounded-sm overflow-hidden shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1A1A1A] text-white shadow-black/80' : 'bg-white text-black shadow-black/20'}`}>
              
              {/* Top Graphic Header */}
              <div className={`w-full px-6 py-4 flex items-center justify-between border-b-[3px] ${theme === 'dark' ? 'border-[#333] bg-[#222]' : 'border-black bg-slate-100'}`}>
                <div className="flex flex-col justify-center">
                  <span className="font-serif italic text-lg opacity-80 mb-1">Good evening,</span>
                  <span className="font-heading font-black text-4xl uppercase tracking-tighter leading-none">{formattedName}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-50">Streak</span>
                  <span className="font-mono font-bold text-xl flex items-center gap-1">
                    <Flame className="w-5 h-5 text-[#2781CA] drop-shadow-[0_0_8px_rgba(39,129,202,0.8)]" /> {currentStreak}
                  </span>
                </div>
              </div>

              {/* Photo Framing Area - Stylized blue block */}
              <div className="relative w-full aspect-square bg-[#2781CA] flex flex-col items-center justify-end overflow-hidden p-6">
                {/* Lanyard Hole Mockup */}
                <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-16 h-3 rounded-full border-2 shadow-inner ${theme === 'dark' ? 'bg-[#111] border-black/50' : 'bg-[#ddd] border-black/10'}`}></div>

                {/* Decorative Text */}
                <div className="absolute top-1/4 -left-6 -rotate-90 text-[10px] font-mono font-bold tracking-[0.4em] opacity-50 text-black">
                  FOCUSX // DIGITAL PASS // {new Date().getFullYear()}
                </div>

                <div className="absolute bottom-6 right-6 w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl rotate-12">
                  <span className="text-[#2781CA] font-heading font-bold text-xl leading-none text-center">FX<br/>48</span>
                </div>

                {/* The Student Photo inside a graphic frame */}
                <div className="relative w-[85%] aspect-[3/4] border-[4px] border-white shadow-2xl bg-[#0a0a0a] overflow-hidden -mb-16 rotate-[-2deg] flex items-center justify-center">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CiAgPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPgogIDxwYXRoIGQ9Ik0wIDM5aDQwVjQwSDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+CiAgPHBhdGggZD0iTTM5IDB2NDBoMVYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPgo8L3N2Zz4=')] opacity-30 mix-blend-overlay"></div>
                  {student.profilePhotoUrl ? (
                    <img src={student.profilePhotoUrl} alt="Student" className="w-full h-full object-cover filter grayscale contrast-125 mix-blend-luminosity opacity-90" />
                  ) : (
                    <>
                      <img src="https://api.dicebear.com/9.x/micah/svg?seed=placeholder&backgroundColor=2781CA" alt="Placeholder" className="w-full h-full object-cover opacity-90" />
                      <div className="absolute inset-0 backdrop-blur-sm bg-black/30 flex flex-col items-center justify-center gap-3 text-white z-10 transition-all duration-300">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg">
                          <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <span className="font-sans text-[11px] font-medium tracking-wide text-white/90 drop-shadow-md">Choose a photo</span>
                      </div>
                    </>
                  )}
                  {/* Photo overlay texture */}
                  <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"></div>
                </div>
              </div>

              {/* Bottom Info & QR Area */}
              <div className="w-full p-6 pt-8 flex flex-col gap-6">
                
                {/* ID Tag */}
                <div className="flex items-end justify-between border-b-2 border-black/10 dark:border-white/10 pb-4">
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-2xl tracking-[0.1em]">{student.uniqueId}</span>
                  </div>
                </div>

                {/* Graphic QR Skeleton */}
                <div className="w-full flex justify-center mt-2">
                  <div className={`relative w-full aspect-[4/1] flex items-center justify-center border border-black group cursor-pointer overflow-hidden transition-all duration-300`}>
                    
                    {/* Faded QR Background */}
                    <div className={`absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg')] bg-cover bg-center bg-no-repeat opacity-[0.08] blur-[1px] ${theme === 'dark' ? 'invert' : ''}`}></div>

                    {/* Scanner line horizontal */}
                    <div className="absolute -left-[1px] -right-[1px] h-[1px] bg-[#2781CA] animate-scan z-20"></div>

                    <div className="relative z-10 flex items-center gap-3">
                      <ScanLine className="w-5 h-5 opacity-70" />
                      <span className="font-mono font-bold text-sm tracking-[0.2em] uppercase">Scan Pass</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
