'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, CheckCircle2, Navigation, Heart, Search, Plus } from 'lucide-react'
import Image from 'next/image'

type MockupLibrary = {
  name: string;
  locality: string | null;
  address: string | null;
  city: string | null;
  photos: string[];
  plans: Array<{
    price: number;
  }>;
};

export function InteractivePhoneMockup({ libraries }: { libraries: MockupLibrary[] }) {
  const [step, setStep] = useState(0)
  const [cursorPos, setCursorPos] = useState({ x: 150, y: 500, scale: 1, opacity: 0 });
  const [scrollY, setScrollY] = useState(0);
  
  // Safe default data in case db is empty
  const defaultLibs = [
    { name: "Shanti Library", locality: "Mandawali", minPrice: 600, rating: 4.9, image: "https://images.unsplash.com/photo-1568667256549-094345857637?w=800&q=80", city: "Delhi NCR" },
    { name: "Focus Study Circle", locality: "Preet Vihar", minPrice: 800, rating: 4.8, image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80", city: "Delhi NCR" }
  ];

  const displayLibs = libraries && libraries.length > 0 ? libraries.map((lib, i) => ({
    name: lib.name,
    locality: lib.locality || lib.address?.split(',')[0] || "Delhi",
    city: lib.city || "Delhi NCR",
    minPrice: lib.plans?.length > 0 ? Math.min(...lib.plans.map((plan) => plan.price)) : 500,
    rating: 4.9, // Mock rating for display
    image: lib.photos?.[0] || defaultLibs[i % defaultLibs.length].image
  })) : defaultLibs;

  const activeLib = displayLibs[0];

  useEffect(() => {
    let t1: NodeJS.Timeout | undefined;
    let t2: NodeJS.Timeout | undefined;
    let t3: NodeJS.Timeout | undefined;
    let t4: NodeJS.Timeout | undefined;
    let t5: NodeJS.Timeout | undefined;
    let t6: NodeJS.Timeout | undefined;
    let initialTimer: NodeJS.Timeout | undefined;

    if (step === 0) {
      initialTimer = setTimeout(() => {
        setScrollY(0);
        // 1. Move to first library card
        setCursorPos({ x: 150, y: 350, scale: 1, opacity: 0.8 });
      }, 0);
      // 2. Press
      t1 = setTimeout(() => setCursorPos({ x: 150, y: 350, scale: 0.8, opacity: 0.8 }), 2000);
      // 3. Switch to Step 1 (Library Detail)
      t2 = setTimeout(() => {
        setStep(1);
      }, 2300);
    } else if (step === 1) {
      // 1. Scroll down the detail page to reveal plans
      t1 = setTimeout(() => {
        setScrollY(-350);
      }, 500);

      // 2. Move cursor to select the plan radio
      t2 = setTimeout(() => {
        setCursorPos({ x: 150, y: 300, scale: 1, opacity: 0.8 });
      }, 1000);

      // 3. Press plan
      t3 = setTimeout(() => setCursorPos({ x: 150, y: 300, scale: 0.8, opacity: 0.8 }), 2500);
      
      // 4. Move to sticky "Pay Now" bottom bar
      t4 = setTimeout(() => {
        setCursorPos({ x: 220, y: 550, scale: 1, opacity: 0.8 });
      }, 3000);

      // 5. Press Pay Now
      t5 = setTimeout(() => setCursorPos({ x: 220, y: 550, scale: 0.8, opacity: 0.8 }), 4500);

      // 6. Switch to Step 2 (Success)
      t6 = setTimeout(() => setStep(2), 4800);

    } else if (step === 2) {
      initialTimer = setTimeout(() => {
        // Hide cursor
        setCursorPos({ x: 150, y: 450, scale: 1, opacity: 0 });
      }, 0);
      // Restart loop
      t1 = setTimeout(() => setStep(0), 3000);
    }

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
      if (t4) clearTimeout(t4);
      if (t5) clearTimeout(t5);
      if (t6) clearTimeout(t6);
      if (initialTimer) clearTimeout(initialTimer);
    }
  }, [step]);

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative z-10 perspective-1000"
    >
      {/* 3D Floating Effect Wrapper */}
      <motion.div
        animate={{ y: [-10, 10, -10] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="relative"
      >
        {/* The iPhone Bezel */}
        <div className="w-[300px] h-[600px] bg-background rounded-[45px] border-[10px] border-[#1a1a1e] shadow-2xl overflow-hidden relative flex flex-col ring-1 ring-black/10">
          
          {/* Dynamic Island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-50 flex items-center justify-between px-2">
            <div className="w-2 h-2 rounded-full bg-slate-800/80" />
            <div className="w-2 h-2 rounded-full bg-green-500/20 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-green-500" />
            </div>
          </div>

          {/* Glare Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none z-40 transform -skew-x-12 translate-x-10" />

          {/* Web App Top Navbar */}
          <div className="pt-10 px-4 pb-3 border-b border-border bg-white z-30 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image src="/final-logo.svg" alt="FocusX Logo" width={40} height={40} className="object-contain" />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold rounded-full bg-[#0a1128] text-white px-3 py-1.5">
                <Plus className="w-3 h-3" />
                Add Your Library
              </div>
            </div>
          </div>

          {/* Screen Content Wrapper */}
          <div className="flex-1 bg-background relative overflow-hidden">
            <AnimatePresence mode="wait">
              {/* STATE 0: Library List */}
              {step === 0 && (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex flex-col"
                >
                  {/* Search Shell */}
                  <div className="p-4 border-b border-border/40 bg-white/95 sticky top-0 z-20">
                    <div className="flex items-center w-full bg-white rounded-full border border-border shadow-[0_3px_15px_-2px_rgba(0,0,0,0.12)] pl-1.5 pr-1.5 py-1.5">
                      <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-sm mr-2">
                        <Search className="h-4 w-4" strokeWidth={3} />
                      </div>
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <input type="text" placeholder="Search libraries near you" className="text-[11px] font-medium bg-transparent outline-none truncate" readOnly />
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1 h-8 w-auto px-2.5 rounded-full border border-border/80 text-black bg-slate-100">
                        <MapPin className="h-3 w-3" />
                        <span className="text-[9px] font-medium leading-none">Near Me</span>
                      </div>
                    </div>
                  </div>

                  {/* Library Grid */}
                  <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                    <h2 className="text-lg font-bold tracking-tight text-foreground font-heading">
                      14 libraries in Delhi
                    </h2>
                    
                    <div className="grid grid-cols-1 gap-6 pb-10">
                      {displayLibs.map((lib, idx) => (
                        <motion.div 
                          key={idx}
                          className="group flex flex-col gap-2 cursor-pointer"
                        >
                          <div className={`relative aspect-square w-full overflow-hidden rounded-xl bg-muted ${idx === 0 ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                            <Image
                              src={lib.image}
                              alt={`${lib.name} thumbnail`}
                              fill
                              className="object-cover"
                            />
                            <div className="absolute top-3 left-3 bg-white/95 px-2 py-0.5 rounded-md text-[10px] font-bold border border-black/5 shadow-sm z-10 text-black">
                              Verified
                            </div>
                            <div className="absolute top-3 right-3 bg-black/50 p-1.5 rounded-full z-10">
                              <Heart className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex flex-col gap-0.5 mt-1">
                            <h3 className="font-bold text-[15px] truncate text-foreground leading-snug tracking-tight">
                              {lib.name}
                            </h3>
                            <p className="text-[13px] text-muted-foreground truncate">{lib.locality}</p>
                            <p className="text-[13px] text-muted-foreground truncate font-medium text-primary mt-1">
                              Starts at ₹{lib.minPrice}/mo
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STATE 1: Library Detail */}
              {step === 1 && (
                <motion.div 
                  key="detail"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute inset-0 bg-background flex flex-col"
                >
                  {/* Scrollable Content Container */}
                  <motion.div 
                    animate={{ y: scrollY }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    className="flex flex-col pb-24"
                  >
                    {/* Hero Image */}
                    <div className="relative w-full aspect-[4/3] shrink-0">
                      <Image src={activeLib.image} alt={activeLib.name} fill className="object-cover" />
                      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white p-1.5 rounded-full">
                        <Navigation className="w-4 h-4 -rotate-90" />
                      </div>
                    </div>
                    
                    {/* Detail Body */}
                    <div className="p-4 flex flex-col">
                      <h1 className="text-xl font-heading font-extrabold text-foreground mb-1 leading-tight">{activeLib.name}</h1>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground mb-4">
                        <span className="flex items-center gap-1 text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20"><CheckCircle2 className="w-2.5 h-2.5" /> Verified</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {activeLib.locality}</span>
                      </div>
                      
                      <div className="w-full h-px bg-border my-2" />

                      <div className="py-4 space-y-4">
                        <div>
                          <h3 className="text-xs font-bold text-foreground mb-1">About the Library</h3>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            A premium study space designed for deep work. Features ergonomic chairs, high-speed internet, and a completely distraction-free environment.
                          </p>
                        </div>
                        
                        <div>
                          <h3 className="text-xs font-bold text-foreground mb-2">Amenities</h3>
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded text-[10px] font-medium text-muted-foreground">
                              <span>📶</span> High-Speed WiFi
                            </div>
                            <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded text-[10px] font-medium text-muted-foreground">
                              <span>❄️</span> Fully AC
                            </div>
                            <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded text-[10px] font-medium text-muted-foreground">
                              <span>⚡</span> Power Backup
                            </div>
                            <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded text-[10px] font-medium text-muted-foreground">
                              <span>🪑</span> Ergonomic Chairs
                            </div>
                          </div>
                        </div>
                      </div>

                      <label className="text-sm font-bold text-foreground flex items-center justify-between mb-3 pt-4 border-t border-border">
                        <span>Select a Plan</span>
                      </label>

                      {/* Plan Card */}
                      <div className="p-3 border-2 border-primary bg-primary/5 shadow-[0_0_15px_rgba(37,99,235,0.1)] rounded-xl cursor-pointer transition-all relative overflow-hidden">
                        <div className="flex items-start gap-3">
                          <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center mt-0.5 shrink-0">
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="font-bold text-foreground text-sm">Flexible Booking</span>
                              <span className="font-bold text-foreground text-sm">₹{activeLib.minPrice}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">Any 4 hours • Valid for today</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Sticky Checkout Bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-border p-3 z-40 flex justify-between items-center shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.1)] pb-5">
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Amount</div>
                      <div className="text-sm font-black text-foreground">
                        ₹{activeLib.minPrice}
                      </div>
                    </div>
                    <div className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-full shadow-lg shadow-primary/30 flex items-center justify-center text-[13px]">
                      Proceed to Pay
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STATE 2: Success Modal */}
              {step === 2 && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                >
                  <div className="bg-card border border-border shadow-2xl rounded-3xl p-6 w-full text-center space-y-3">
                    <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-heading font-black text-foreground">Booking Confirmed!</h2>
                    <p className="text-xs text-muted-foreground">Your seat has been successfully reserved. You can view all details in your dashboard.</p>
                    
                    <div className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-full transition-opacity mt-4 text-[13px] shadow-lg shadow-primary/30">
                      Go to Dashboard
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Animated Ghost Cursor */}
        <motion.div
          animate={{
            x: cursorPos.x,
            y: cursorPos.y,
            scale: cursorPos.scale,
            opacity: cursorPos.opacity,
          }}
          transition={{
            duration: 0.6,
            ease: "easeInOut"
          }}
          className="absolute top-0 left-0 w-8 h-8 rounded-full bg-blue-500/40 border-2 border-blue-400 z-50 pointer-events-none blur-[1px]"
          style={{ transformOrigin: "center" }}
        />
      </motion.div>
    </motion.div>
  )
}
