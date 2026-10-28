'use client';

import React, { useState } from 'react';
import { FocusDeskLoadingScreen } from "@/components/ui/FocusDeskLoadingScreen";
import Link from 'next/link';
import { ArrowLeft, Moon, Sun, Maximize2 } from 'lucide-react';

export default function LoadingPreviewPage() {
  const [isDark, setIsDark] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-[#0B0F19] text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Control Bar */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-xs font-black uppercase tracking-wider text-[#2781CA]">
            FocusDesk Signature Screen Transition Loader
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            {isDark ? 'Light Theme' : 'Dark Theme'}
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#2781CA] text-white hover:bg-[#206ea8] transition-colors shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {isFullScreen ? 'Exit Full Screen' : 'Simulate Full Screen Transition'}
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="p-8 max-w-6xl mx-auto flex flex-col items-center">
        <div className="w-full text-center mb-6">
          <h1 className="text-2xl font-black tracking-tight mb-2">
            Signature 3D FocusDesk Floating Emblem Loader
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Rendered automatically across all dashboard tabs (<code className="font-mono text-[#2781CA]">/dashboard/*</code> and <code className="font-mono text-[#2781CA]">/admin/*</code>) during page/screen transitions.
          </p>
        </div>

        {/* Embedded Container Preview */}
        <div className="w-full rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xl overflow-hidden min-h-[500px] flex items-center justify-center relative">
          <FocusDeskLoadingScreen />
        </div>
      </div>

      {/* Fullscreen Overlay Modal (if toggled) */}
      {isFullScreen && (
        <div className="relative">
          <FocusDeskLoadingScreen fullScreen />
          <button
            onClick={() => setIsFullScreen(false)}
            className="fixed top-6 right-6 z-[60] px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-2xl hover:bg-black transition-all"
          >
            Close Full Screen (Esc)
          </button>
        </div>
      )}
    </div>
  );
}
