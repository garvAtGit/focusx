"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Cpu,
  Signal,
  DoorClosed,
  DoorOpen,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Unlock,
  RotateCcw,
  Building2,
  MapPin,
  Copy,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
  Monitor,
  Activity,
  Terminal,
  RefreshCw,
  X,
  Clock,
  History,
  Eye,
  ArrowLeft,
  ArrowRight,
  RadioTower,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
import { translateDiagnosticEvent } from "@/lib/diagnostic-dictionary";
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type RelayData = {
  id: string;
  macAddress: string | null;
  bleReaderId: string | null;
  nfcTagId: string;
  status: string;
  lastSync: Date | string;
  lastSeenAt: Date | string | null;
  pendingCommand: string | null;
  firmwareVersion?: string | null;
  lastScreenLine0?: string | null;
  lastScreenLine1?: string | null;
  lastScreenBacklight?: number | null;
  lastScreenUpdatedAt?: Date | string | null;
  diagQueueDepth?: number | null;
  diagDroppedCount?: number | null;
  lastDiagAckAt?: Date | string | null;
  resetReason?: string | null;
  createdAt: Date | string;
};

type LibraryWithRelays = {
  id: string;
  name: string;
  address: string;
  managerName: string | null;
  managerPhone: string | null;
  relays: RelayData[];
};

type ModuleHealth = {
  nfc1?: boolean;
  nfc2?: boolean;
  doorReed?: boolean; // true = closed, false = open/alarm
  ble?: boolean;
  rssi?: number;
  updatedAt?: number;
};

type FilterTab = "WITH_HARDWARE" | "ONLINE" | "WARNINGS" | "ALL" | "UNLINKED";

export function AdminMachinesClient({
  libraries,
  initialModulesMap,
}: {
  libraries: LibraryWithRelays[];
  initialModulesMap: Record<string, ModuleHealth>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("WITH_HARDWARE");
  const [modulesMap, setModulesMap] = useState<Record<string, ModuleHealth>>(initialModulesMap);
  const [liveRelays, setLiveRelays] = useState<Record<string, RelayData>>(() => {
    const map: Record<string, RelayData> = {};
    for (const lib of libraries) {
      for (const r of lib.relays) {
        map[r.id] = r;
      }
    }
    return map;
  });
  const [isSendingCmd, setIsSendingCmd] = useState<string | null>(null);
  const [expandedLibraries, setExpandedLibraries] = useState<Record<string, boolean>>({});
  const [activeDiagRelay, setActiveDiagRelay] = useState<RelayData | null>(null);
  const [diagLogs, setDiagLogs] = useState<any[]>([]);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);
  const [diagFilter, setDiagFilter] = useState<string>("ALL");

  // Screen Timeline State (Scrubbable with Keyboard)
  const [timelineRelayId, setTimelineRelayId] = useState<string | null>(null);
  const [screenHistoryMap, setScreenHistoryMap] = useState<Record<string, Array<{
    id: string;
    line0: string;
    line1: string;
    backlight: number;
    trigger: string;
    timestamp: string;
  }>>>({});
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(false);

  // 5-Minute "Live Peek" Ephemeral Stream State
  const [livePeekRelayId, setLivePeekRelayId] = useState<string | null>(null);
  const [livePeekRemainingSec, setLivePeekRemainingSec] = useState<number>(0);
  const [isStartingLivePeek, setIsStartingLivePeek] = useState<boolean>(false);

  const openTimeline = async (relayId: string) => {
    setTimelineRelayId(relayId);
    setHistoryIndex(0);
    setIsLoadingTimeline(true);
    try {
      const res = await fetch(`/api/hardware/screen-history?relayId=${relayId}&limit=60`);
      if (res.ok) {
        const data = await res.json();
        setScreenHistoryMap((prev) => ({
          ...prev,
          [relayId]: data.history || [],
        }));
        setHistoryIndex(0);
      } else {
        toast.error("Failed to load screen history");
      }
    } catch {
      toast.error("Network error loading screen history");
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  const closeTimeline = () => {
    setTimelineRelayId(null);
    setHistoryIndex(0);
  };

  // Keyboard navigation for Timeline Scrubbing (Left Arrow = Older, Right Arrow = Newer, Esc = Close)
  useEffect(() => {
    if (!timelineRelayId) return;
    const history = screenHistoryMap[timelineRelayId] || [];
    if (history.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setHistoryIndex((prev) => Math.min(history.length - 1, prev + 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setHistoryIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeTimeline();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timelineRelayId, screenHistoryMap]);

  // Live Peek Toggle Handler
  const toggleLivePeek = async (relayId: string) => {
    const isCurrentlyActive = livePeekRelayId === relayId && livePeekRemainingSec > 0;
    setIsStartingLivePeek(true);
    try {
      if (isCurrentlyActive) {
        const res = await fetch("/api/hardware/debug-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relayId, action: "STOP" }),
        });
        if (res.ok) {
          setLivePeekRelayId(null);
          setLivePeekRemainingSec(0);
          toast.success("Live Peek stream ended");
        }
      } else {
        const res = await fetch("/api/hardware/debug-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relayId, action: "START", durationSec: 300 }),
        });
        if (res.ok) {
          setLivePeekRelayId(relayId);
          setLivePeekRemainingSec(300);
          toast.success("5-Minute Live Peek activated! Sub-second LCD stream active.");
        } else {
          toast.error("Failed to start Live Peek session");
        }
      }
    } catch {
      toast.error("Error communicating with debug session API");
    } finally {
      setIsStartingLivePeek(false);
    }
  };

  // Timer countdown for Live Peek
  useEffect(() => {
    if (!livePeekRelayId || livePeekRemainingSec <= 0) return;
    const interval = setInterval(() => {
      setLivePeekRemainingSec((prev) => {
        if (prev <= 1) {
          setLivePeekRelayId(null);
          toast("5-minute Live Peek session ended.", { icon: "⏱️" });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [livePeekRelayId, livePeekRemainingSec]);

  const openDiagModal = async (relay: RelayData) => {
    setActiveDiagRelay(relay);
    setIsLoadingDiag(true);
    try {
      const res = await fetch(`/api/hardware/diagnostics?relayId=${relay.id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setDiagLogs(data.logs || []);
      } else {
        toast.error("Failed to load diagnostic logs");
      }
    } catch {
      toast.error("Network error loading diagnostics");
    } finally {
      setIsLoadingDiag(false);
    }
  };

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;

    const channel = supabase
      .channel("admin-hardware-diagnostics")
      .on("broadcast", { event: "hardware_status" }, (payload: any) => {
        if (payload?.payload?.relayId) {
          const relayId = payload.payload.relayId;
          if (payload.payload.modules) {
            setModulesMap((prev) => ({
              ...prev,
              [relayId]: {
                ...payload.payload.modules,
                updatedAt: Date.now(),
              },
            }));
          }

          setLiveRelays((prev) => {
            const current = prev[relayId];
            return {
              ...prev,
              [relayId]: {
                ...(current || ({} as RelayData)),
                id: relayId,
                lastSync: payload.payload.lastSync || new Date().toISOString(),
                lastSeenAt: payload.payload.lastSeenAt || new Date().toISOString(),
                status: payload.payload.status || "ONLINE",
              },
            };
          });
        }
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Relay" },
        (payload: any) => {
          if (payload.new?.id) {
            setLiveRelays((prev) => ({
              ...prev,
              [payload.new.id]: {
                ...prev[payload.new.id],
                ...payload.new,
              },
            }));
          }
        }
      )
      .on("broadcast", { event: "screen_mirror" }, (msg: any) => {
        const p = msg?.payload;
        if (p?.relayId) {
          setLiveRelays((prev) => {
            const current = prev[p.relayId];
            return {
              ...prev,
              [p.relayId]: {
                ...(current || ({} as RelayData)),
                lastScreenLine0: p.line0,
                lastScreenLine1: p.line1,
                lastScreenBacklight: p.backlight,
                lastScreenUpdatedAt: p.updatedAt,
                diagQueueDepth: p.diagQueueDepth,
                diagDroppedCount: p.diagDroppedCount,
                resetReason: p.resetReason,
              },
            };
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCommand = async (relayId: string, command: string) => {
    setIsSendingCmd(`${relayId}:${command}`);
    try {
      const res = await fetch("/api/hardware/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: relayId, command }),
      });
      if (res.ok) {
        toast.success(`Command '${command}' queued successfully!`);
      } else {
        toast.error("Failed to send command.");
      }
    } catch {
      toast.error("Network error while sending command.");
    } finally {
      setIsSendingCmd(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const toggleExpand = (id: string) => {
    setExpandedLibraries((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Fleet Statistics Calculations
  const stats = useMemo(() => {
    let totalRelays = 0;
    let onlineRelays = 0;
    let equippedLibs = 0;
    let faultCount = 0;

    for (const lib of libraries) {
      if (lib.relays.length > 0) {
        equippedLibs++;
      }
      for (const baseRelay of lib.relays) {
        totalRelays++;
        const relay = liveRelays[baseRelay.id] || baseRelay;
        const modules = modulesMap[relay.id] || {};
        if (relay.status === "ONLINE") {
          onlineRelays++;
        }
        const hasIssue =
          modules.nfc1 === false ||
          modules.nfc2 === false ||
          modules.doorReed === false;
        if (hasIssue) {
          faultCount++;
        }
      }
    }

    return {
      totalRelays,
      onlineRelays,
      equippedLibs,
      faultCount,
      unlinkedLibs: libraries.length - equippedLibs,
    };
  }, [libraries, liveRelays, modulesMap]);

  // Filtering Logic
  const filteredLibraries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return libraries.filter((lib) => {
      const matchesSearch =
        !q ||
        lib.name.toLowerCase().includes(q) ||
        lib.address.toLowerCase().includes(q) ||
        (lib.managerName && lib.managerName.toLowerCase().includes(q)) ||
        lib.relays.some(
          (r) =>
            (r.macAddress && r.macAddress.toLowerCase().includes(q)) ||
            (r.bleReaderId && r.bleReaderId.toLowerCase().includes(q))
        );

      if (!matchesSearch) return false;

      const hasRelays = lib.relays.length > 0;
      const anyOnline = lib.relays.some(
        (r) => (liveRelays[r.id] || r).status === "ONLINE"
      );
      const anyWarning = lib.relays.some((r) => {
        const m = modulesMap[r.id] || {};
        return m.nfc1 === false || m.nfc2 === false || m.doorReed === false;
      });

      switch (activeFilter) {
        case "WITH_HARDWARE":
          return hasRelays;
        case "ONLINE":
          return anyOnline;
        case "WARNINGS":
          return anyWarning;
        case "UNLINKED":
          return !hasRelays;
        case "ALL":
        default:
          return true;
      }
    });
  }, [libraries, searchTerm, activeFilter, liveRelays, modulesMap]);

  const renderRssi = (rssi?: number) => {
    if (typeof rssi !== "number") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white text-slate-500 border border-slate-200/80 shadow-sm">
          <Signal className="w-3.5 h-3.5 text-slate-400" /> N/A
        </span>
      );
    }

    let color = "text-emerald-700";
    let bg = "bg-emerald-50 border-emerald-200";
    let bars = 4;
    let label = "Strong";

    if (rssi < -85) {
      color = "text-rose-700";
      bg = "bg-rose-50 border-rose-200";
      bars = 1;
      label = "Poor";
    } else if (rssi < -75) {
      color = "text-amber-700";
      bg = "bg-amber-50 border-amber-200";
      bars = 2;
      label = "Fair";
    } else if (rssi < -65) {
      color = "text-[#2781CA]";
      bg = "bg-blue-50 border-blue-200";
      bars = 3;
      label = "Good";
    }

    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border shadow-sm ${bg} ${color}`}
        title={`Signal: ${rssi} dBm (${label})`}
      >
        <div className="flex items-end gap-0.5 h-3">
          <span className={`w-0.5 h-1.5 rounded-full ${bars >= 1 ? "bg-current" : "bg-slate-300"}`} />
          <span className={`w-0.5 h-2 rounded-full ${bars >= 2 ? "bg-current" : "bg-slate-300"}`} />
          <span className={`w-0.5 h-2.5 rounded-full ${bars >= 3 ? "bg-current" : "bg-slate-300"}`} />
          <span className={`w-0.5 h-3 rounded-full ${bars >= 4 ? "bg-current" : "bg-slate-300"}`} />
        </div>
        <span>{rssi} dBm</span>
      </span>
    );
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Top Metric Grid (Matching FocusX Librarian Theme & Color Grading) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 relative">
        {/* 1. Obsidian Widget: Gate Controllers */}
        <div className="bg-slate-900 p-7 rounded-[2.5rem] border border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-slate-700 transition-all duration-300 group flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0085FF] opacity-20 blur-[50px] rounded-full pointer-events-none"></div>

          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-300">Gate Controllers</span>
            <div className="p-2.5 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors">
              <Cpu className="w-5 h-5 text-[#0085FF]" />
            </div>
          </div>

          <div className="relative z-10">
            <h3 className="text-5xl font-black text-white tracking-tight">
              {stats.onlineRelays}{" "}
              <span className="text-2xl text-slate-400 font-bold">/ {stats.totalRelays}</span>
            </h3>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Active Bidirectional Relays
              </span>
            </div>
          </div>
        </div>

        {/* 2. Signature Electric Lime Card: IoT Coverage */}
        <div className="bg-[#C6F135] p-7 rounded-[2.5rem] border border-[#b5e022] shadow-[0_8px_30px_rgba(198,241,53,0.15)] hover:shadow-[0_8px_30px_rgba(198,241,53,0.25)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-25 rounded-full blur-[40px] pointer-events-none"></div>

          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-900">IoT Coverage</span>
            <div className="p-2.5 bg-white/50 backdrop-blur-sm rounded-xl">
              <Building2 className="w-5 h-5 text-slate-900" />
            </div>
          </div>

          <div className="relative z-10 mt-auto">
            <h3 className="text-5xl font-black text-slate-900 tracking-tight drop-shadow-sm">
              {stats.equippedLibs}{" "}
              <span className="text-2xl text-slate-800 font-bold">/ {libraries.length}</span>
            </h3>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-slate-800/80 uppercase tracking-widest">
                {stats.equippedLibs} Fitted • {stats.unlinkedLibs} Unlinked
              </span>
            </div>
          </div>
        </div>

        {/* 3. Crisp White Card: Diagnostic Alarms */}
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-amber-500/20 transition-colors duration-500"></div>

          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">Diagnostic Alarms</span>
            <div className="p-2.5 bg-slate-50 border border-slate-100 shadow-sm rounded-xl">
              {stats.faultCount > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
            </div>
          </div>

          <div className="relative z-10">
            <h3
              className={`text-4xl font-black tracking-tight ${
                stats.faultCount > 0 ? "text-amber-600" : "text-slate-900"
              }`}
            >
              {stats.faultCount > 0 ? `${stats.faultCount} Active` : "Zero Faults"}
            </h3>
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  stats.faultCount > 0 ? "bg-amber-500" : "bg-emerald-500"
                }`}
              ></span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                {stats.faultCount > 0
                  ? "NFC Reader or Gate Warning"
                  : "All RFID & Reed Nominal"}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Crisp White Card: Realtime Bus */}
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#2781CA]/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-[#2781CA]/20 transition-colors duration-500"></div>

          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">Realtime Telemetry</span>
            <div className="p-2.5 bg-blue-50/70 border border-blue-100/60 shadow-sm rounded-xl">
              <Radio className="w-5 h-5 text-[#2781CA]" />
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Supabase Bus</h3>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Zap className="w-3.5 h-3.5 text-[#2781CA]" />
              <span className="uppercase tracking-widest">Broadcast Channel Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar (FocusX Clean White Card Placement) */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by library name, MAC, or BLE Reader ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2781CA] focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-900"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveFilter("WITH_HARDWARE")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === "WITH_HARDWARE"
                ? "bg-[#2781CA] text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)]"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            With Hardware ({stats.equippedLibs})
          </button>

          <button
            onClick={() => setActiveFilter("ONLINE")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === "ONLINE"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online ({stats.onlineRelays})
          </button>

          {stats.faultCount > 0 && (
            <button
              onClick={() => setActiveFilter("WARNINGS")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFilter === "WARNINGS"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Sensor Alerts ({stats.faultCount})
            </button>
          )}

          <button
            onClick={() => setActiveFilter("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === "ALL"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All ({libraries.length})
          </button>

          <button
            onClick={() => setActiveFilter("UNLINKED")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === "UNLINKED"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            Unlinked ({stats.unlinkedLibs})
          </button>
        </div>
      </div>

      {/* Library Nodes Listing (FocusX Rounded 2.5rem Cards) */}
      <div className="space-y-5">
        {filteredLibraries.length === 0 ? (
          <div className="p-12 rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center space-y-3">
            <Cpu className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-black text-slate-900">No Matching Hardware Found</h3>
            <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">
              No library nodes match your current search and filter criteria. Try clicking &quot;All&quot; or clearing the search bar.
            </p>
          </div>
        ) : (
          filteredLibraries.map((lib) => {
            const hasRelays = lib.relays.length > 0;
            const isExpanded = expandedLibraries[lib.id] ?? hasRelays;

            return (
              <div
                key={lib.id}
                className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-slate-300 transition-all duration-300 overflow-hidden"
              >
                {/* Library Header Bar */}
                <div
                  onClick={() => toggleExpand(lib.id)}
                  className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer select-none hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                        hasRelays
                          ? "bg-blue-50 text-[#2781CA] border-blue-100 shadow-sm"
                          : "bg-slate-100 text-slate-400 border-slate-200/60"
                      }`}
                    >
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">
                          {lib.name}
                        </h3>
                        {hasRelays ? (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {lib.relays.length} {lib.relays.length === 1 ? "Gate Relay" : "Gate Relays"}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200">
                            Unlinked Branch
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {lib.address}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-auto">
                    {lib.managerName && (
                      <div className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hidden sm:block">
                        <span className="font-bold text-slate-400 uppercase text-[10px] mr-1">Manager:</span> {lib.managerName}
                      </div>
                    )}
                    {lib.managerPhone && (
                      <div className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hidden sm:block">
                        <span className="font-bold text-slate-400 uppercase text-[10px] mr-1 font-sans">Phone:</span> {lib.managerPhone}
                      </div>
                    )}
                    <button
                      type="button"
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Relays Container */}
                {isExpanded && (
                  <div className="p-6 space-y-4 bg-slate-50/40">
                    {!hasRelays ? (
                      <div className="py-8 px-6 rounded-2xl bg-white border border-dashed border-slate-200 text-center flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">
                            No FocusX Smart Relay gateway attached
                          </p>
                          <p className="text-xs font-medium text-slate-500 mt-1">
                            This branch currently operates without IoT gate hardware. Pair an ESP32 unit to enable RFID attendance and automated door actuation.
                          </p>
                        </div>
                        <span className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          Manual Check-in Only
                        </span>
                      </div>
                    ) : (
                      lib.relays.map((baseRelay) => {
                        const relay = liveRelays[baseRelay.id] || baseRelay;
                        const modules = modulesMap[relay.id] || {};
                        const isOnline = relay.status === "ONLINE";
                        const lastActiveTime = Math.max(
                          relay.lastSeenAt ? new Date(relay.lastSeenAt).getTime() : 0,
                          relay.lastSync ? new Date(relay.lastSync).getTime() : 0
                        );

                        // Component health checks
                        const nfc1Ok = modules.nfc1 !== false;
                        const nfc2Ok = modules.nfc2 !== false;
                        const doorClosed = modules.doorReed !== false;
                        const hasComponentIssue = !nfc1Ok || !nfc2Ok || !doorClosed;

                        return (
                          <div
                            key={relay.id}
                            className={`p-6 rounded-2xl border transition-all ${
                              !isOnline
                                ? "bg-white border-slate-200 opacity-80"
                                : hasComponentIssue
                                ? "bg-amber-50/40 border-amber-300 shadow-sm"
                                : "bg-white border-slate-200/90 shadow-sm hover:border-slate-300"
                            }`}
                          >
                            {/* Hardware Alert Banner */}
                            {isOnline && hasComponentIssue && (
                              <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs font-semibold">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-black">Hardware Sensor Warning: </span>
                                  {!nfc1Ok && "Entry Reader (PN532 #1) disconnected. "}
                                  {!nfc2Ok && "Exit Reader (PN532 #2) disconnected. "}
                                  {!doorClosed && "Gate Reed switch indicates door held open."}
                                </div>
                              </div>
                            )}

                            {/* Top Controller Row */}
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                              {/* Left: Device Info */}
                              <div className="flex items-start gap-4">
                                <div
                                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                                    isOnline
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm"
                                      : "bg-red-50 text-red-600 border-red-200"
                                  }`}
                                >
                                  <Cpu className="w-6 h-6" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-3">
                                    <h4 className="font-black text-slate-900 text-base">
                                      FocusX Smart Gate Relay
                                    </h4>
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                                        isOnline
                                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                          : "bg-red-100 text-red-800 border-red-200"
                                      }`}
                                    >
                                      <span
                                        className={`w-2 h-2 rounded-full ${
                                          isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                                        }`}
                                      />
                                      {isOnline ? "ONLINE" : "OFFLINE"}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono font-bold text-slate-600 mt-2">
                                    <span
                                      onClick={() => copyToClipboard(relay.macAddress || "", "MAC Address")}
                                      className="hover:border-[#2781CA] cursor-pointer transition-colors flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 shadow-xs"
                                      title="Click to copy MAC"
                                    >
                                      <span>MAC: {relay.macAddress || "N/A"}</span>
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    </span>

                                    <span
                                      onClick={() => copyToClipboard(relay.bleReaderId || "", "BLE Reader ID")}
                                      className="hover:border-[#2781CA] cursor-pointer transition-colors flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 shadow-xs"
                                      title="Click to copy BLE ID"
                                    >
                                      <span>BLE: {relay.bleReaderId || "N/A"}</span>
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    </span>

                                    {isOnline ? (
                                      <span className="text-emerald-700 font-sans font-black flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                        Live Pulse
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-sans font-medium">
                                        Last Seen:{" "}
                                        {lastActiveTime > 0
                                          ? new Date(lastActiveTime).toLocaleTimeString("en-IN", {
                                              timeZone: "Asia/Kolkata",
                                            })
                                          : "Never"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Remote Actuation Controls */}
                              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
                                <button
                                  type="button"
                                  onClick={() => handleCommand(relay.id, "open_in")}
                                  disabled={isSendingCmd !== null || !isOnline}
                                  className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Trigger Door Unlock from Entry side"
                                >
                                  <Unlock className="w-4 h-4" />
                                  <span>{isSendingCmd === `${relay.id}:open_in` ? "Actuating..." : "Unlock In"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCommand(relay.id, "open_out")}
                                  disabled={isSendingCmd !== null || !isOnline}
                                  className="px-4 py-2.5 rounded-xl text-xs font-black bg-[#2781CA] hover:opacity-90 text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)] flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Trigger Door Unlock from Exit side"
                                >
                                  <Unlock className="w-4 h-4" />
                                  <span>{isSendingCmd === `${relay.id}:open_out` ? "Actuating..." : "Unlock Out"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Send remote factory reset & reboot signal to this ESP32 controller?")) {
                                      handleCommand(relay.id, "factory_reset");
                                    }
                                  }}
                                  disabled={isSendingCmd !== null || !isOnline}
                                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Reboot & Reset Controller"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Reset</span>
                                </button>
                              </div>
                            </div>

                            {/* Diagnostic Sensor Bar */}
                            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">
                                Telemetry:
                              </span>

                              {/* Reader 1 (Entry) */}
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${
                                  nfc1Ok
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {nfc1Ok ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                <span>Reader 1 (Entry): {nfc1Ok ? "OK" : "ERR"}</span>
                              </span>

                              {/* Reader 2 (Exit) */}
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${
                                  nfc2Ok
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {nfc2Ok ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                <span>Reader 2 (Exit): {nfc2Ok ? "OK" : "ERR"}</span>
                              </span>

                              {/* Door Reed Sensor */}
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${
                                  doorClosed
                                    ? "bg-slate-50 text-slate-700 border-slate-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {doorClosed ? (
                                  <DoorClosed className="w-3.5 h-3.5 text-slate-500" />
                                ) : (
                                  <DoorOpen className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                <span>Door: {doorClosed ? "Secured" : "Open Alert"}</span>
                              </span>

                              {/* BLE Beacon */}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-blue-50 text-[#2781CA] border-blue-100 shadow-xs">
                                <Radio className="w-3.5 h-3.5 text-[#2781CA]" />
                                <span>BLE Radar: Active</span>
                              </span>

                              {/* WiFi RSSI */}
                              {renderRssi(modules.rssi)}
                            </div>

                            {/* FocusX Virtual 16x2 LCD Mirror & Diagnostics Subsystem Bar */}
                            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                              {/* Left: Virtual 16x2 LCD Mirror */}
                              {(() => {
                                const isTimelineMode = timelineRelayId === relay.id;
                                const isLiveStreaming = livePeekRelayId === relay.id && livePeekRemainingSec > 0;
                                const history = screenHistoryMap[relay.id] || [];
                                const currentFrame = isTimelineMode && history.length > 0 ? history[historyIndex] : null;

                                const displayLine0 = isTimelineMode
                                  ? (currentFrame?.line0 || "NO DATA")
                                  : (relay.lastScreenLine0 || "FOCUSX READY");

                                const displayLine1 = isTimelineMode
                                  ? (currentFrame?.line1 || "")
                                  : (relay.lastScreenLine1 || "TAP RFID / BLE");

                                const displayBacklight = isTimelineMode
                                  ? (currentFrame?.backlight ?? 1)
                                  : (relay.lastScreenBacklight ?? 1);

                                return (
                                  <div className={`lg:col-span-7 bg-slate-950 p-4 rounded-2xl border transition-all duration-300 shadow-inner flex flex-col justify-between ${
                                    isLiveStreaming
                                      ? "border-cyan-500/80 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-2 ring-cyan-500/30"
                                      : isTimelineMode
                                      ? "border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-2 ring-amber-500/30"
                                      : "border-slate-800"
                                  }`}>
                                    {/* Mirror Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans font-bold text-slate-400 mb-2 pb-2 border-b border-slate-800">
                                      <div className="flex items-center gap-2">
                                        <Monitor className={`w-3.5 h-3.5 ${isLiveStreaming ? "text-cyan-400 animate-pulse" : isTimelineMode ? "text-amber-400" : "text-[#39e58c]"}`} />
                                        <span className="text-slate-200">
                                          {isTimelineMode ? "Screen Appearance Timeline" : "Virtual 16x2 LCD Mirror"}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider ${
                                            displayBacklight > 0
                                              ? isTimelineMode
                                                ? "bg-amber-950 text-amber-300 border border-amber-800"
                                                : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                              : "bg-slate-900 text-slate-500 border border-slate-800"
                                          }`}
                                        >
                                          BL: {displayBacklight > 0 ? "ON" : "OFF"}
                                        </span>
                                      </div>

                                      {/* Mode Status Badges & Quick Action Controls */}
                                      <div className="flex items-center gap-1.5">
                                        {/* 5-Min Live Peek Toggle Button */}
                                        <button
                                          type="button"
                                          onClick={() => toggleLivePeek(relay.id)}
                                          disabled={isStartingLivePeek}
                                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                                            isLiveStreaming
                                              ? "bg-rose-950/90 text-rose-300 border border-rose-700 animate-pulse hover:bg-rose-900"
                                              : "bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-800 active:scale-95"
                                          }`}
                                          title="Activate 5-minute accelerated real-time LCD streaming (Core 0 only, zero storage bloat)"
                                        >
                                          {isLiveStreaming ? (
                                            <>
                                              <Square className="w-2.5 h-2.5 fill-rose-300 text-rose-300" />
                                              <span>Stop Peek ({Math.floor(livePeekRemainingSec / 60)}:{(livePeekRemainingSec % 60).toString().padStart(2, "0")})</span>
                                            </>
                                          ) : (
                                            <>
                                              <RadioTower className="w-2.5 h-2.5 text-cyan-400" />
                                              <span>Live Peek (5 Min)</span>
                                            </>
                                          )}
                                        </button>

                                        {/* Timeline Mode Toggle Button */}
                                        <button
                                          type="button"
                                          onClick={() => (isTimelineMode ? closeTimeline() : openTimeline(relay.id))}
                                          disabled={isLoadingTimeline}
                                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                                            isTimelineMode
                                              ? "bg-amber-950/90 text-amber-300 border border-amber-700 hover:bg-amber-900"
                                              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 active:scale-95"
                                          }`}
                                          title="Scrub historical screen frames with keyboard arrow keys"
                                        >
                                          <History className={`w-2.5 h-2.5 ${isLoadingTimeline ? "animate-spin" : "text-amber-400"}`} />
                                          <span>{isTimelineMode ? "Exit Timeline" : "Timeline"}</span>
                                        </button>

                                        {/* Live Stale Check Badge */}
                                        {!isTimelineMode && (() => {
                                          const screenTs = relay.lastScreenUpdatedAt ? new Date(relay.lastScreenUpdatedAt).getTime() : 0;
                                          const isStale = !screenTs || (Date.now() - screenTs > 90000);
                                          return (
                                            <span
                                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                                isLiveStreaming
                                                  ? "bg-cyan-950/90 text-cyan-300 border border-cyan-700"
                                                  : isStale
                                                  ? "bg-amber-950/80 text-amber-400 border border-amber-800/70"
                                                  : "bg-emerald-950/80 text-emerald-400 border border-emerald-800/70"
                                              }`}
                                            >
                                              <Clock className="w-2.5 h-2.5" />
                                              {isLiveStreaming ? "Realtime Stream" : isStale ? "Mirror Stale (>90s)" : "Mirror Live"}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    {/* Monospace 16x2 Character Matrix */}
                                    <div
                                      className={`p-3.5 rounded-xl border font-mono tracking-widest text-[13px] leading-relaxed select-all transition-all duration-300 ${
                                        displayBacklight > 0
                                          ? isTimelineMode
                                            ? "bg-[#291e0a] text-amber-300 border-amber-800 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                            : isLiveStreaming
                                            ? "bg-[#06202a] text-cyan-300 border-cyan-700 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                                            : "bg-[#0c2b1e] text-[#39e58c] border-[#1b5e3f] shadow-[0_0_15px_rgba(57,229,140,0.15)]"
                                          : "bg-[#14171a] text-slate-500 border-slate-800"
                                      }`}
                                    >
                                      <div className="font-bold whitespace-pre font-mono">
                                        {displayLine0.padEnd(16, " ").slice(0, 16)}
                                      </div>
                                      <div className="font-bold whitespace-pre font-mono">
                                        {displayLine1.padEnd(16, " ").slice(0, 16)}
                                      </div>
                                    </div>

                                    {/* Interactive Scrubber Controls (Timeline Mode) */}
                                    {isTimelineMode ? (
                                      <div className="mt-3 pt-3 border-t border-slate-800/90 flex flex-col gap-2.5">
                                        {/* Scrubber Bar & Step Buttons */}
                                        <div className="flex items-center justify-between gap-3">
                                          <button
                                            type="button"
                                            onClick={() => setHistoryIndex((prev) => Math.min(Math.max(0, history.length - 1), prev + 1))}
                                            disabled={historyIndex >= history.length - 1}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-amber-300 text-xs font-bold flex items-center gap-1 border border-slate-800 transition-colors"
                                            title="Step back in time (Left Arrow ◄)"
                                          >
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                            <span>Older</span>
                                          </button>

                                          <div className="flex-1 flex flex-col items-center gap-1">
                                            <input
                                              type="range"
                                              min={0}
                                              max={Math.max(0, history.length - 1)}
                                              value={historyIndex}
                                              onChange={(e) => setHistoryIndex(Number(e.target.value))}
                                              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                                            />
                                            <span className="text-[10px] font-mono text-slate-400">
                                              Frame {history.length > 0 ? history.length - historyIndex : 0} of {history.length}
                                            </span>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => setHistoryIndex((prev) => Math.max(0, prev - 1))}
                                            disabled={historyIndex <= 0}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-amber-300 text-xs font-bold flex items-center gap-1 border border-slate-800 transition-colors"
                                            title="Step forward in time (Right Arrow ►)"
                                          >
                                            <span>Newer</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        {/* Timestamp & Trigger Metadata */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                                          <div className="flex items-center gap-1.5 text-amber-300 font-mono">
                                            <Clock className="w-3 h-3 text-amber-400" />
                                            <span>
                                              {currentFrame?.timestamp
                                                ? new Date(currentFrame.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                                                : "No historical records"}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/80 text-[10px] font-mono font-bold">
                                              Trigger: {currentFrame?.trigger || "SNAPSHOT"}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={closeTimeline}
                                              className="text-[10px] text-slate-400 hover:text-white underline font-bold"
                                            >
                                              Return to Live
                                            </button>
                                          </div>
                                        </div>

                                        {/* Keyboard Binding Helper */}
                                        <div className="text-[10px] text-slate-400 text-center font-sans bg-slate-900/40 py-1 px-2 rounded-lg border border-slate-800/50">
                                          ⌨️ <span className="font-bold text-amber-300">Keyboard Controls Active:</span> Use <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">◄ Left</kbd> and <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Right ►</kbd> arrow keys to scrub screens | <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Esc</kbd> to exit
                                        </div>
                                      </div>
                                    ) : (
                                      /* Live Mirror Footer */
                                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-sans">
                                        <span>Matrix: 16 Cols x 2 Rows</span>
                                        <div className="flex items-center gap-3">
                                          <span>
                                            Updated:{" "}
                                            {relay.lastScreenUpdatedAt
                                              ? new Date(relay.lastScreenUpdatedAt).toLocaleTimeString("en-IN", {
                                                  timeZone: "Asia/Kolkata",
                                                })
                                              : "Waiting for heartbeat..."}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => openTimeline(relay.id)}
                                            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold underline transition-colors"
                                          >
                                            <History className="w-3 h-3" />
                                            Timeline History
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Right: Diagnostics Telemetry & Logs Drawer Trigger */}
                              <div className="lg:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                      <Activity className="w-3.5 h-3.5 text-[#2781CA]" />
                                      Fault Diagnostics Subsystem
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                      {relay.firmwareVersion || "v5.1.1-ota"}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs font-medium my-2">
                                    <div className="p-2 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Reset Reason</span>
                                      <span className="font-mono font-bold text-slate-800 truncate block text-[11px]" title={relay.resetReason || "POWERON_RESET"}>
                                        {relay.resetReason || "POWERON_RESET"}
                                      </span>
                                    </div>

                                    <div className="p-2 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Ring Buffer</span>
                                      <span className="font-mono font-bold text-slate-800 block text-[11px]">
                                        {relay.diagQueueDepth ?? 0} / 64 events
                                      </span>
                                    </div>

                                    <div className="p-2 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Dropped Faults</span>
                                      <span
                                        className={`font-mono font-bold block text-[11px] ${
                                          (relay.diagDroppedCount ?? 0) > 0 ? "text-rose-600 font-black" : "text-emerald-700"
                                        }`}
                                      >
                                        {relay.diagDroppedCount ?? 0} dropped
                                      </span>
                                    </div>

                                    <div className="p-2 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Last Ingest ACK</span>
                                      <span className="font-mono text-slate-600 block text-[10px]">
                                        {relay.lastDiagAckAt
                                          ? new Date(relay.lastDiagAckAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
                                          : "Never"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => openDiagModal(relay)}
                                  className="w-full mt-2 py-2 px-3 rounded-xl bg-[#2781CA]/10 hover:bg-[#2781CA]/20 text-[#2781CA] border border-[#2781CA]/30 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs"
                                >
                                  <Terminal className="w-3.5 h-3.5" />
                                  <span>View Remote Fault Audit Logs</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Diagnostics Fault Audit Modal */}
      {activeDiagRelay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2781CA]/10 text-[#2781CA] border border-[#2781CA]/20 flex items-center justify-center">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    Device Fault Diagnostics & Remote Audit
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    Relay ID: <span className="font-mono text-slate-700">{activeDiagRelay.id}</span> | MAC:{" "}
                    <span className="font-mono text-slate-700">{activeDiagRelay.macAddress || "N/A"}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDiagModal(activeDiagRelay)}
                  disabled={isLoadingDiag}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDiag ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDiagRelay(null)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-wider">Severity:</span>
              {["ALL", "CRITICAL", "ERROR", "WARN", "INFO"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDiagFilter(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    diagFilter === tab
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Logs List Container */}
            <div className="p-6 overflow-y-auto flex-1 space-y-2.5 bg-slate-50/30">
              {isLoadingDiag ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#2781CA]" />
                  <span className="text-xs font-bold">Querying server diagnostic ingestion records...</span>
                </div>
              ) : diagLogs.filter((l) => diagFilter === "ALL" || l.severity === diagFilter).length === 0 ? (
                <div className="py-16 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800">No matching fault events found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    The isolated diagnostics subsystem reports zero unacknowledged faults for this filter.
                  </p>
                </div>
              ) : (
                diagLogs
                  .filter((l) => diagFilter === "ALL" || l.severity === diagFilter)
                  .map((log) => {
                    const sev = log.severity;
                    const sevColor =
                      sev === "FATAL"
                        ? "bg-rose-100 text-rose-900 border-rose-300"
                        : sev === "CRITICAL"
                        ? "bg-red-100 text-red-800 border-red-300"
                        : sev === "ERROR"
                        ? "bg-orange-100 text-orange-800 border-orange-300"
                        : sev === "WARN"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-sky-100 text-sky-800 border-sky-300";

                    const meta = translateDiagnosticEvent(log.eventCode, log.severity, log.param1, log.param2, log.detail);

                    return (
                      <div
                        key={log.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${sevColor}`}>
                              {sev}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm">{meta.title}</h4>
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                              {meta.category}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">Code #{log.eventCode}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(log.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                          </div>
                        </div>

                        <p className="text-slate-700 font-medium text-xs leading-relaxed mb-3">
                          {meta.explanation}
                        </p>

                        <div className="flex flex-wrap items-center gap-2.5 text-[11px] pt-2.5 border-t border-slate-100">
                          {meta.param1Label && meta.param1Formatted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 font-medium">
                              <span className="font-bold text-slate-500">{meta.param1Label}:</span>
                              <span className="font-mono font-bold text-slate-900">{meta.param1Formatted}</span>
                            </span>
                          )}
                          {meta.param2Label && meta.param2Formatted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 font-medium">
                              <span className="font-bold text-slate-500">{meta.param2Label}:</span>
                              <span className="font-mono font-bold text-slate-900">{meta.param2Formatted}</span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 font-mono text-[10px]">
                            Uptime: {Math.floor(Number(log.uptimeMs) / 1000)}s
                          </span>
                          {meta.recommendedAction && (
                            <span className="ml-auto text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Tip: {meta.recommendedAction}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center text-xs text-slate-400">
              <span>Diagnostics isolated from attendance decision critical path</span>
              <button
                type="button"
                onClick={() => setActiveDiagRelay(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
