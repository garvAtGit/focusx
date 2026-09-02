'use client'

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Calendar } from "lucide-react";

export default function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentFrom = searchParams.get('from') || '';
  const currentTo = searchParams.get('to') || '';

  const [from, setFrom] = useState(currentFrom);
  const [to, setTo] = useState(currentTo);

  const applyPreset = (preset: string) => {
    const today = new Date();
    let newFrom = '';
    let newTo = '';

    if (preset === 'today') {
      newFrom = today.toISOString().split('T')[0];
      newTo = today.toISOString().split('T')[0];
    } else if (preset === 'this_week') {
      const firstDay = new Date(today);
      firstDay.setDate(today.getDate() - today.getDay());
      newFrom = firstDay.toISOString().split('T')[0];
      newTo = today.toISOString().split('T')[0];
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      newFrom = firstDay.toISOString().split('T')[0];
      newTo = today.toISOString().split('T')[0];
    } else if (preset === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      newFrom = firstDay.toISOString().split('T')[0];
      newTo = lastDay.toISOString().split('T')[0];
    } else if (preset === 'all_time') {
      newFrom = '';
      newTo = '';
    }

    setFrom(newFrom);
    setTo(newTo);
    applyDates(newFrom, newTo);
  };

  const applyDates = (f: string, t: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (f) params.set('from', f);
    else params.delete('from');
    
    if (t) params.set('to', t);
    else params.delete('to');

    // Reset pagination to page 1 when filter changes
    params.delete('page');

    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 items-center justify-between w-full">
      <div className="flex items-center gap-2 text-foreground font-medium">
        <Calendar className="w-5 h-5 text-primary" />
        <span>Filter by Date</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => applyPreset('today')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">Today</button>
        <button onClick={() => applyPreset('this_week')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">This Week</button>
        <button onClick={() => applyPreset('this_month')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">This Month</button>
        <button onClick={() => applyPreset('last_month')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">Last Month</button>
        <button onClick={() => applyPreset('all_time')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">All Time</button>
        
        <div className="flex items-center gap-2 ml-0 md:ml-4 border-l border-border pl-0 md:pl-4">
          <input 
            type="date" 
            value={from} 
            onChange={(e) => setFrom(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input 
            type="date" 
            value={to} 
            onChange={(e) => setTo(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background"
          />
          <button 
            onClick={() => applyDates(from, to)}
            className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
