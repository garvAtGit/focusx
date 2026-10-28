'use client';

import React, { useState } from 'react';
import { Wifi, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface StudentLibraryWifiCardProps {
  libraryName: string;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
}

export function StudentLibraryWifiCard({
  libraryName,
  wifiSsid,
  wifiPassword,
}: StudentLibraryWifiCardProps) {
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!wifiSsid && !wifiPassword) {
    return null;
  }

  const handleCopy = () => {
    if (!wifiPassword) return;
    navigator.clipboard.writeText(wifiPassword);
    setCopied(true);
    toast.success('Wi-Fi password copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-blue-500/10 via-sky-500/5 to-transparent border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Wifi className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              Library Wi-Fi
            </span>
            <span className="text-xs text-muted-foreground font-medium">{libraryName}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-foreground">
              {wifiSsid || 'Library Network'}
            </span>
            {wifiPassword && (
              <span className="text-xs font-mono text-muted-foreground bg-background/80 border border-border px-2 py-0.5 rounded-md">
                {showPassword ? wifiPassword : '••••••••'}
              </span>
            )}
          </div>
        </div>
      </div>

      {wifiPassword && (
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background/80 border border-border transition-colors text-xs flex items-center gap-1.5"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Password</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default StudentLibraryWifiCard;
