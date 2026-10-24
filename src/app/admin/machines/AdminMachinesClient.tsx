"use client";

import React, { useState, useEffect } from "react";
import { 
  Cpu, Wifi, Signal, DoorClosed, DoorOpen, Radio, 
  AlertTriangle, CheckCircle2, XCircle, Search, RefreshCw, 
  Unlock, RotateCcw, AlertCircle, Building2, Phone, MapPin 
} from "lucide-react";
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

export function AdminMachinesClient({
  libraries,
  initialModulesMap,
}: {
  libraries: LibraryWithRelays[];
  initialModulesMap: Record<string, ModuleHealth>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
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

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;

    // Listen to real-time broadcast and DB updates for relays
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
    } catch (err) {
      toast.error("Network error while sending command.");
    } finally {
      setIsSendingCmd(null);
    }
  };

  const filteredLibraries = libraries.filter((lib) => {
    const q = searchTerm.toLowerCase();
    const libMatches =
      lib.name.toLowerCase().includes(q) || lib.address.toLowerCase().includes(q);
    const relayMatches = lib.relays.some(
      (r) =>
        (r.macAddress && r.macAddress.toLowerCase().includes(q)) ||
        (r.bleReaderId && r.bleReaderId.toLowerCase().includes(q))
    );
    return libMatches || relayMatches;
  });

  const getRssiBadge = (rssi?: number) => {
    if (typeof rssi !== "number") return null;
    let colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    let label = "Strong";
    if (rssi < -80) {
      colorClass = "bg-red-50 text-red-700 border-red-200";
      label = "Weak";
    } else if (rssi < -70) {
      colorClass = "bg-amber-50 text-amber-700 border-amber-200";
      label = "Fair";
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${colorClass}`}>
        <Signal className="w-3.5 h-3.5" />
        <span>{rssi} dBm ({label})</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Stats bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by library name, MAC, or Reader ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Showing <span className="font-bold text-foreground">{filteredLibraries.length}</span> libraries
        </div>
      </div>

      {/* Libraries & Hardware Grid */}
      <div className="grid gap-6">
        {filteredLibraries.map((lib) => {
          const hasRelays = lib.relays.length > 0;

          return (
            <div key={lib.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              {/* Library Header */}
              <div className="p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-foreground">{lib.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {lib.address}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {lib.managerName && <div><span className="font-semibold text-foreground">Manager:</span> {lib.managerName}</div>}
                  {lib.managerPhone && <div><span className="font-semibold text-foreground">Phone:</span> {lib.managerPhone}</div>}
                </div>
              </div>

              {/* Machine Relays List */}
              <div className="p-5 space-y-4">
                {!hasRelays ? (
                  <div className="py-6 text-center text-sm text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                    No hardware machine linked to this library.
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
                        className={`p-5 rounded-xl border transition-all ${
                          !isOnline
                            ? "border-border bg-muted/5 opacity-80"
                            : hasComponentIssue
                            ? "border-amber-300 bg-amber-50/20"
                            : "border-border bg-card"
                        }`}
                      >
                        {/* Hardware Alert Banner for Admin */}
                        {isOnline && hasComponentIssue && (
                          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 flex items-start gap-2.5 text-xs font-medium">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Hardware Alert: </span>
                              {!nfc1Ok && "Entry Reader (PN532 #1) error. "}
                              {!nfc2Ok && "Exit Reader (PN532 #2) error. "}
                              {!doorClosed && "Door sensor indicates gate held open."}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                          {/* Machine Info */}
                          <div className="flex items-start gap-3.5">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                              isOnline ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            }`}>
                              <Cpu className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5">
                                <h4 className="font-bold text-foreground text-base">FocusX Smart Gate Relay</h4>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                  isOnline
                                    ? "bg-emerald-500/15 text-emerald-700"
                                    : "bg-red-500/15 text-red-700"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                                  {isOnline ? "ONLINE" : "OFFLINE"}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono mt-1">
                                <span>MAC: {relay.macAddress || "N/A"}</span>
                                <span>BLE ID: {relay.bleReaderId || "N/A"}</span>
                                {isOnline ? (
                                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Live
                                  </span>
                                ) : (
                                  <span>Last Seen: {lastActiveTime > 0 ? new Date(lastActiveTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "Never"}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Remote Actions */}
                          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                            <button
                              type="button"
                              onClick={() => handleCommand(relay.id, "open_in")}
                              disabled={isSendingCmd !== null || !isOnline}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                              title="Trigger Door Unlock from Entry side"
                            >
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Unlock In</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCommand(relay.id, "open_out")}
                              disabled={isSendingCmd !== null || !isOnline}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                              title="Trigger Door Unlock from Exit side"
                            >
                              <Unlock className="w-3.5 h-3.5 text-blue-600" />
                              <span>Unlock Out</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Send factory reset command to device?")) {
                                  handleCommand(relay.id, "factory_reset");
                                }
                              }}
                              disabled={isSendingCmd !== null || !isOnline}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                              title="Reboot & Factory Reset Device"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset</span>
                            </button>
                          </div>
                        </div>

                        {/* Diagnostic Badges */}
                        <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground mr-1">Modules Health:</span>

                          {/* Reader 1 (Entry) */}
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                            nfc1Ok
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {nfc1Ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>Reader 1 (Entry): {nfc1Ok ? "OK" : "ERROR"}</span>
                          </span>

                          {/* Reader 2 (Exit) */}
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                            nfc2Ok
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {nfc2Ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>Reader 2 (Exit): {nfc2Ok ? "OK" : "ERROR"}</span>
                          </span>

                          {/* Door Sensor */}
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                            doorClosed
                              ? "bg-slate-50 text-slate-700 border-slate-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {doorClosed ? <DoorClosed className="w-3.5 h-3.5 text-slate-500" /> : <DoorOpen className="w-3.5 h-3.5 text-amber-600" />}
                            <span>Door Sensor: {doorClosed ? "Closed" : "Open"}</span>
                          </span>

                          {/* BLE Beacon */}
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                            <Radio className="w-3.5 h-3.5" />
                            <span>BLE Beacon: Active</span>
                          </span>

                          {/* WiFi Signal */}
                          {getRssiBadge(modules.rssi)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
