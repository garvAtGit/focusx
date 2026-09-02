'use client';

import { ScanLine, Camera, QrCode } from 'lucide-react';
import { AccessQRModal } from '@/components/AccessQRModal';
import Link from 'next/link';

interface DigitalPassCardProps {
  student: {
    name: string | null;
    uniqueId: string;
    profilePhotoUrl: string | null;
  };
  currentStreak: number; // Keeping prop to avoid breaking page.tsx, but unused in UI
  libraryId: string;
  studentId: string;
  isCheckedIn: boolean;
  initialQrPayload?: string;
}

export function DigitalPassCard({ student, currentStreak, libraryId, studentId, isCheckedIn, initialQrPayload }: DigitalPassCardProps) {
  const theme: string = 'light'; // Hardcoded to match the finalized light mode preference

  const formatName = (name: string | null) => {
    if (!name || !name.trim()) return "STUDENT";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].toUpperCase();
    return `${parts[0].toUpperCase()}  ${parts[parts.length - 1][0].toUpperCase()}.`;
  };

  const formattedName = formatName(student.name);

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      {/* The Poster Card */}
      <div className={`relative w-full rounded-sm overflow-hidden shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1A1A1A] text-white shadow-black/80' : 'bg-white text-black shadow-black/20'}`}>
        
        {/* Top Graphic Header */}
        <div className={`w-full px-6 py-5 flex items-center justify-between border-b-[3px] ${theme === 'dark' ? 'border-[#333] bg-[#222]' : 'border-black bg-slate-100'}`}>
          <div className="flex flex-col justify-center">
            <span className="font-serif font-bold text-xl text-slate-800 tracking-tight mb-1">Welcome back,</span>
            <span className="font-heading font-black text-[2.5rem] uppercase tracking-tighter leading-none text-slate-900">{formattedName}</span>
          </div>
          {currentStreak > 0 && (
            <div className="flex flex-col items-end justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Streak</span>
              <span className="font-serif italic font-bold text-2xl text-[#2781CA] leading-none mt-1">{currentStreak}</span>
            </div>
          )}
        </div>

        {/* Photo Framing Area - Stylized blue block */}
        <div className="relative w-full aspect-[4/3] bg-[#2781CA] flex flex-col items-center justify-end overflow-hidden p-6 pb-2">
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
          <div className="relative w-[85%] aspect-square border-[4px] border-white shadow-2xl bg-[#0a0a0a] overflow-hidden -mb-6 rotate-[-2deg] flex items-center justify-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CiAgPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPgogIDxwYXRoIGQ9Ik0wIDM5aDQwVjQwSDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+CiAgPHBhdGggZD0iTTM5IDB2NDBoMVYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPgo8L3N2Zz4=')] opacity-30 mix-blend-overlay z-20 pointer-events-none"></div>
            {student.profilePhotoUrl ? (
              <img src={student.profilePhotoUrl} alt="Student" className="w-full h-full object-cover relative z-10" />
            ) : (
              <Link href="/student/profile" className="absolute inset-0 z-30 group">
                <img src="https://api.dicebear.com/9.x/micah/svg?seed=placeholder&backgroundColor=2781CA" alt="Placeholder" className="w-full h-full object-cover opacity-90 relative z-10 transition-opacity group-hover:opacity-50" />
                <div className="absolute inset-0 backdrop-blur-sm bg-black/30 flex flex-col items-center justify-center gap-3 text-white transition-all duration-300">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg group-hover:bg-white/40 group-hover:scale-110 transition-all">
                    <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  <span className="font-sans text-[11px] font-medium tracking-wide text-white/90 drop-shadow-md">Choose a photo</span>
                </div>
              </Link>
            )}
            {/* Photo overlay texture */}
            <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] z-20 pointer-events-none"></div>
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

          {/* Graphic QR Skeleton wrapped with AccessQRModal */}
          <div className="w-full flex justify-center mt-2">
            <AccessQRModal 
              libraryId={libraryId} 
              studentId={studentId}
              isCheckedIn={isCheckedIn}
              initialQrPayload={initialQrPayload}
            >
              <div className={`relative w-full max-w-[280px] mx-auto aspect-[4/1] flex items-center justify-center border border-black group cursor-pointer overflow-hidden transition-all duration-300`}>
                
                {/* Faded QR Background */}
                <QrCode className="absolute inset-0 w-full h-full opacity-10 text-slate-800 scale-150 pointer-events-none transition-transform duration-500 group-hover:scale-125" strokeWidth={1} />

                {/* Scanner line horizontal */}
                <div className="absolute -left-[1px] -right-[1px] h-[1px] bg-[#2781CA] animate-scan z-20 opacity-50 group-hover:opacity-100"></div>

                <div className="relative z-10 flex items-center gap-3">
                  <ScanLine className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="font-mono font-bold text-sm tracking-[0.2em] uppercase">Tap to Show QR</span>
                </div>
              </div>
            </AccessQRModal>
          </div>

        </div>
      </div>
    </div>
  );
}
