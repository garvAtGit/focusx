"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"
import { Calendar, ArrowRightLeft } from "lucide-react"

type DailyMetric = {
  date: string
  newCount: number
  renewalCount: number
  totalRevenue: number
}

type AnalyticsResponse = {
  days: DailyMetric[]
}

export function DashboardCompareChart() {
  function getLocalDateString(date: Date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  const now = new Date();
  const defaultStartA = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEndA = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  
  const defaultStartB = getLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const defaultEndB = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0));

  const [isComparing, setIsComparing] = useState(false);
  const [rangeA, setRangeA] = useState({ start: defaultStartA, end: defaultEndA });
  const [rangeB, setRangeB] = useState({ start: defaultStartB, end: defaultEndB });
  const [daysA, setDaysA] = useState<DailyMetric[]>([]);
  const [daysB, setDaysB] = useState<DailyMetric[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (
      range: { start: string; end: string },
      setter: (days: DailyMetric[]) => void,
    ) => {
      try {
        const response = await fetch(
          `/api/dashboard/analytics/bookings?start=${range.start}&end=${range.end}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) return;
        const result = await response.json() as AnalyticsResponse;
        setter(Array.isArray(result.days) ? result.days : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setter([]);
        }
      }
    };

    void load(rangeA, setDaysA);
    if (isComparing) void load(rangeB, setDaysB);
    return () => controller.abort();
  }, [rangeA, rangeB, isComparing]);

  const summarize = (days: DailyMetric[]) =>
    days.reduce(
      (total, day) => ({
        total: total.total + day.newCount + day.renewalCount,
        newCount: total.newCount + day.newCount,
        renewCount: total.renewCount + day.renewalCount,
        totalRevenue: total.totalRevenue + day.totalRevenue,
      }),
      { total: 0, newCount: 0, renewCount: 0, totalRevenue: 0 },
    );

  const metricsA = useMemo(() => summarize(daysA), [daysA]);
  const metricsB = useMemo(
    () => isComparing ? summarize(daysB) : null,
    [daysB, isComparing],
  );

  const dailyDataA = useMemo(
    () =>
      daysA.map((day) => ({
        date: new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        New: day.newCount,
        Renewal: day.renewalCount,
      })),
    [daysA],
  );

  // If comparing, we build a grouped comparison array instead of daily
  const compareData = isComparing ? [
    {
      name: "Total Bookings",
      PeriodA: metricsA.total,
      PeriodB: metricsB?.total ?? 0,
    },
    {
      name: "New Admissions",
      PeriodA: metricsA.newCount,
      PeriodB: metricsB?.newCount ?? 0,
    },
    {
      name: "Renewals",
      PeriodA: metricsA.renewCount,
      PeriodB: metricsB?.renewCount ?? 0,
    }
  ] : [];

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Admissions & Renewals</h2>
          <p className="text-sm text-muted-foreground mt-1">Track growth and compare date ranges.</p>
        </div>
        
        <button 
          onClick={() => setIsComparing(!isComparing)}
          className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 border transition-all ${isComparing ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:bg-muted'}`}
        >
          <ArrowRightLeft className="w-4 h-4" /> 
          {isComparing ? "Cancel Compare" : "Compare"}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 mb-8">
        {/* Period A Config & Stats */}
        <div className={`flex-1 p-4 rounded-xl border ${isComparing ? 'border-primary/20 bg-primary/5' : 'border-border bg-background'}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full bg-primary"></span>
            <h3 className="font-bold text-sm">{isComparing ? 'Period A' : 'Selected Period'}</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setRangeA({ start: getLocalDateString(new Date()), end: getLocalDateString(new Date()) })} className="px-2.5 py-1 text-xs border border-border bg-background hover:bg-muted font-medium rounded-md transition-colors">Today</button>
            <button onClick={() => {
              const start = new Date(); start.setDate(start.getDate() - start.getDay());
              const end = new Date(start); end.setDate(end.getDate() + 6);
              setRangeA({ start: getLocalDateString(start), end: getLocalDateString(end) });
            }} className="px-2.5 py-1 text-xs border border-border bg-background hover:bg-muted font-medium rounded-md transition-colors">This Week</button>
            <button onClick={() => {
              const n = new Date();
              setRangeA({ start: getLocalDateString(new Date(n.getFullYear(), n.getMonth(), 1)), end: getLocalDateString(new Date(n.getFullYear(), n.getMonth() + 1, 0)) });
            }} className="px-2.5 py-1 text-xs border border-border bg-background hover:bg-muted font-medium rounded-md transition-colors">This Month</button>
            <div className="flex items-center gap-1 border border-border rounded-md px-2 bg-background flex-1 sm:flex-none">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <input 
                type="date" 
                value={rangeA.start} 
                onChange={e => setRangeA(p => ({ ...p, start: e.target.value }))}
                className="w-full text-xs bg-transparent outline-none py-1.5 cursor-pointer"
              />
              <span className="text-muted-foreground self-center text-xs">to</span>
              <input 
                type="date" 
                value={rangeA.end} 
                onChange={e => setRangeA(p => ({ ...p, end: e.target.value }))}
                className="w-full text-xs bg-transparent outline-none py-1.5 cursor-pointer"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground font-medium">New</p>
              <p className="text-xl font-bold text-foreground">{metricsA.newCount}</p>
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground font-medium">Renewals</p>
              <p className="text-xl font-bold text-foreground">{metricsA.renewCount}</p>
            </div>
          </div>
          <div className="mt-2 bg-background rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground font-medium">Total Revenue</p>
            <p className="text-xl font-bold text-success">₹{metricsA.totalRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* Period B Config & Stats */}
        {isComparing && metricsB && (
          <div className="flex-1 p-4 rounded-xl border border-muted-foreground/20 bg-muted/10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-muted-foreground"></span>
              <h3 className="font-bold text-sm">Period B</h3>
            </div>
            <div className="flex gap-2 mb-4">
              <input 
                type="date" 
                value={rangeB.start} 
                onChange={e => setRangeB(p => ({ ...p, start: e.target.value }))}
                className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5"
              />
              <span className="text-muted-foreground self-center">to</span>
              <input 
                type="date" 
                value={rangeB.end} 
                onChange={e => setRangeB(p => ({ ...p, end: e.target.value }))}
                className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground font-medium">New</p>
                <p className="text-xl font-bold text-foreground">{metricsB.newCount}</p>
              </div>
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground font-medium">Renewals</p>
                <p className="text-xl font-bold text-foreground">{metricsB.renewCount}</p>
              </div>
            </div>
            <div className="mt-2 bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground font-medium">Total Revenue</p>
              <p className="text-xl font-bold text-foreground">₹{metricsB.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      <div className="h-[250px] w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          {isComparing ? (
            <BarChart data={compareData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="PeriodA" name="Period A" fill="#2781CA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="PeriodB" name="Period B" fill="#64748b" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <BarChart data={dailyDataA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="New" stackId="a" fill="#2781CA" radius={[0, 0, 4, 4]} />
              <Bar dataKey="Renewal" stackId="a" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
