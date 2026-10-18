"use client";

import { useState } from "react";
import { Info } from "lucide-react";

export function MathReveal({ mathText, theme = "light" }: { mathText: string, theme?: "dark" | "light" | "lime" }) {
  const [open, setOpen] = useState(false);

  const themeStyles = {
    dark: {
      button: "text-slate-400 hover:text-white",
      border: "border-slate-700/50",
      text: "text-slate-500",
    },
    lime: {
      button: "text-slate-600 hover:text-slate-900",
      border: "border-slate-900/10",
      text: "text-slate-700",
    },
    light: {
      button: "text-slate-400 hover:text-slate-700",
      border: "border-slate-100",
      text: "text-slate-400",
    },
  };

  const styles = themeStyles[theme];

  return (
    <div className="mt-5 relative z-20">
      <button 
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors w-fit px-2 py-1.5 rounded-lg -ml-2 ${open ? 'bg-slate-900/5' : ''} ${styles.button}`}
      >
        <Info className="w-3.5 h-3.5" />
        {open ? "Hide Math" : "How is this calculated?"}
      </button>
      
      {open && (
        <div className={`pt-3 border-t ${styles.border} animate-in fade-in slide-in-from-top-1 duration-200`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider leading-relaxed ${styles.text}`}>
            {mathText}
          </p>
        </div>
      )}
    </div>
  );
}
