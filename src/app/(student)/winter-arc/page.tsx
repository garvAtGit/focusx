"use client";

import { motion } from "framer-motion";
import { Playfair_Display, Inter } from "next/font/google";
import { useState, useEffect } from "react";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"] });
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "600"] });

const leagues = [
  { hours: 6, target: 150, discount: 15 },
  { hours: 8, target: 200, discount: 17 },
  { hours: 10, target: 250, discount: 19 },
  { hours: 12, target: 300, discount: 23 },
  { hours: 24, target: 350, discount: 25, label: "RESERVED SEAT" },
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

export default function CozyWinterArcForm() {
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selectedLeague || !name || !phone) {
      setError("Please fill out all fields and select a league.");
      return;
    }

    setIsLoading(true);
    setError('');

    const league = leagues.find(l => l.hours === selectedLeague);
    if (!league) return;

    try {
      const res = await fetch('/api/winter-arc/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueHours: league.hours,
          targetHours: league.target,
          discount: league.discount,
          name,
          phone
        })
      });

      if (!res.ok) throw new Error("Failed to pledge");

      // Redirect to the new dashboard
      window.location.href = '/student/dashboard';
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0705] text-[#e8ded1] flex flex-col items-center relative overflow-hidden font-serif selection:bg-[#4a2e1b] selection:text-[#fff6e5]">
      
      {/* Background Ambience: Warm Fireplace & Frosty Window */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center opacity-[0.25] mix-blend-luminosity pointer-events-none scale-105 filter sepia-[20%] brightness-75"
        style={{ backgroundImage: 'url(/cozy_winter_academia.jpg)' }}
      />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#0a0705_80%)] pointer-events-none" />
      <div className="fixed inset-0 z-0 opacity-[0.10] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      <Snowflakes />

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="z-10 w-full max-w-7xl px-4 md:px-12 py-12 md:py-20 flex flex-col"
      >
        {/* Header Section */}
        <div className="mb-12 md:mb-16 text-center md:text-left border-b border-[#362b24] pb-10">
          <p className={`${inter.className} text-[10px] md:text-xs tracking-[0.4em] uppercase text-[#d9a05b] mb-4`}>
            Starts October 6th
          </p>
          <h1 className={`${playfair.className} text-6xl md:text-8xl lg:text-[9rem] leading-none tracking-tighter mb-6 font-bold text-[#f5ecd8] drop-shadow-xl`}>
            Winter Arc
          </h1>
          <p className={`${inter.className} text-sm md:text-lg text-[#b5a796] max-w-md font-light tracking-wide mx-auto md:mx-0`}>
            A 30-day discipline protocol. The hearth is lit. Lock in your hours and build strong.
          </p>
        </div>

        {/* Content Layout: Mobile (Stack) vs Desktop (Side-by-Side) */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 w-full">
          
          {/* Leagues Section */}
          <div className="w-full lg:w-3/5">
            <h2 className={`${inter.className} text-[10px] tracking-widest uppercase text-[#8c7c6c] mb-6 border-b border-[#362b24]/50 pb-2`}>
              Select Your League
            </h2>
            
            {/* Horizontal Scroll on Mobile, Grid on Desktop */}
            <div className="flex overflow-x-auto lg:grid lg:grid-cols-3 gap-4 pb-4 snap-x snap-mandatory no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
              {leagues.map((league) => {
                const isSelected = selectedLeague === league.hours;
                return (
                  <div
                    key={league.hours}
                    onClick={() => setSelectedLeague(league.hours)}
                    className={`
                      shrink-0 w-[240px] lg:w-auto snap-center flex flex-col p-6 cursor-pointer transition-all duration-500 relative rounded-sm backdrop-blur-xl
                      ${isSelected 
                        ? 'bg-[#1a1410]/95 border border-[#d9a05b]/60 scale-100 lg:scale-105 shadow-[0_0_30px_rgba(217,160,91,0.15)] z-10' 
                        : 'bg-[#140f0c]/70 border border-[#4a3b32] hover:border-[#b5a796]/40 opacity-80 hover:opacity-100'
                      }
                    `}
                  >
                    {/* Ornate corner touches on selected */}
                    {isSelected && (
                      <>
                        <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#d9a05b]/60" />
                        <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[#d9a05b]/60" />
                        <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#d9a05b]/60" />
                        <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#d9a05b]/60" />
                      </>
                    )}

                    {league.label && (
                      <div className="absolute top-0 right-0">
                        <span className={`${inter.className} text-[9px] uppercase tracking-widest px-2 py-1 ${isSelected ? 'bg-[#d9a05b]/20 text-[#d9a05b] border-b border-l border-[#d9a05b]/40' : 'bg-[#1a1410] text-[#a39687]'}`}>
                          {league.label}
                        </span>
                      </div>
                    )}
                    
                    <div className="mb-8 mt-2">
                      <span className={`${playfair.className} text-6xl font-bold block leading-none mb-2 ${isSelected ? 'text-[#f5ecd8]' : 'text-[#b5a796]'}`}>{league.hours}</span>
                      <span className={`${inter.className} text-xs uppercase tracking-widest ${isSelected ? 'text-[#d9a05b]' : 'text-[#756658]'}`}>Hours</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end border-b border-[#362b24] pb-2">
                        <span className={`${inter.className} text-[10px] uppercase tracking-wider text-[#8c7c6c]`}>Target</span>
                        <span className={`${playfair.className} font-bold ${isSelected ? 'text-[#e8ded1]' : 'text-[#a39687]'}`}>{league.target}h</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className={`${inter.className} text-[10px] uppercase tracking-wider text-[#8c7c6c]`}>Reward</span>
                        <span className={`${playfair.className} text-lg font-bold ${isSelected ? 'text-[#d9a05b]' : 'text-[#a39687]'}`}>{league.discount}% OFF</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Section */}
          <div className="w-full lg:w-2/5">
            <h2 className={`${inter.className} text-[10px] tracking-widest uppercase text-[#8c7c6c] mb-6 border-b border-[#362b24]/50 pb-2`}>
              The Pledge
            </h2>
            
            <div className="bg-[#140f0c]/80 border border-[#4a3b32] p-8 backdrop-blur-xl relative rounded-sm shadow-2xl">
              {/* Form ornate corners */}
              <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#b5a796]/30" />
              <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[#b5a796]/30" />
              <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#b5a796]/30" />
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#b5a796]/30" />

              <p className={`${playfair.className} text-xl md:text-2xl text-[#b5a796] italic mb-10 leading-relaxed text-center lg:text-left`}>
                "I commit to the discipline required. My only competition is the person I was yesterday."
              </p>

              <div className="space-y-8">
                {error && <p className="text-red-400 text-sm">{error}</p>}
                
                <div className="group">
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${inter.className} w-full bg-transparent border-b border-[#4a3b32] py-3 text-lg text-[#f5ecd8] focus:outline-none focus:border-[#d9a05b] transition-colors placeholder:text-[#5d4f43] rounded-none`}
                    placeholder="Full Name"
                  />
                </div>

                <div className="group">
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`${inter.className} w-full bg-transparent border-b border-[#4a3b32] py-3 text-lg text-[#f5ecd8] focus:outline-none focus:border-[#d9a05b] transition-colors placeholder:text-[#5d4f43] rounded-none`}
                    placeholder="Phone Number"
                  />
                </div>

                <div className="pt-6">
                  <button 
                    onClick={handleSubmit}
                    disabled={!selectedLeague || isLoading}
                    className={`
                      w-full py-5 px-6 font-bold tracking-[0.2em] uppercase transition-all duration-500 rounded-sm
                      ${selectedLeague 
                        ? 'bg-[#d9a05b]/10 text-[#d9a05b] border border-[#d9a05b]/40 hover:bg-[#d9a05b]/20 shadow-[0_0_15px_rgba(217,160,91,0.1)]' 
                        : 'bg-[#1a1410]/50 text-[#5d4f43] cursor-not-allowed border border-[#362b24]'}
                      ${inter.className} text-xs md:text-sm
                    `}
                  >
                    {isLoading ? "Signing Ledger..." : (selectedLeague ? `Accept ${selectedLeague}H League` : "Choose League First")}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Global CSS for hiding scrollbar on the carousel and overriding layout navbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
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
