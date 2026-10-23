"use client";

import React, { useState } from "react";
import { Plus, CheckCircle2, AlertCircle, Cpu, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HardwareSetupClient({ libraryId, initialHardware }: { libraryId: string, initialHardware: any[] }) {
  const [claimCode, setClaimCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const router = useRouter();

  const handleSelfDestruct = async (hwId: string) => {
    if (!confirm('Are you sure you want to factory reset this device? It will erase all memory and reboot into setup mode.')) return;
    
    try {
      const res = await fetch('/api/hardware/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hwId, command: 'factory_reset' })
      });
      if (res.ok) {
        alert('Self-destruct command queued! The device will wipe its memory on the next ping or realtime update.');
      } else {
        alert('Failed to send command.');
      }
    } catch (e) {
      alert('Error sending command.');
    }
  };


  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCode || claimCode.length < 5) return;
    
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/hardware/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimCode: claimCode.trim().toUpperCase(), libraryId })
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || "Hardware successfully paired!" });
        setClaimCode("");
        router.refresh(); // refresh the server component to pull new hardware
      } else {
        setMessage({ type: 'error', text: data.error || "Failed to pair hardware." });
      }
    } catch (err) {
      setMessage({ type: 'error', text: "A network error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pair New Hardware Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <Plus className="w-5 h-5 text-teal-700" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Pair New Hardware</h2>
          </div>
          <p className="text-slate-500 pl-13">Enter the 6-character code displayed on your FocusX ESP32 captive portal to link it to your library.</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleClaim} className="flex gap-3">
            <input
              type="text"
              placeholder="e.g., A7B29F"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              className="flex-1 max-w-sm rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-lg tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal"
              maxLength={8}
            />
            <button
              type="submit"
              disabled={isSubmitting || claimCode.length < 5}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Link Device"}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-teal-50 text-teal-900 border border-teal-200' : 'bg-red-50 text-red-900 border border-red-200'}`}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-teal-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
              <div>
                <h4 className={`font-semibold ${message.type === 'success' ? 'text-teal-800' : 'text-red-800'}`}>
                  {message.type === 'success' ? 'Success' : 'Error'}
                </h4>
                <p className="text-sm mt-1">{message.text}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Hardware List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 p-6">
          <h3 className="text-lg font-semibold text-slate-800">Linked Devices</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {initialHardware.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No hardware devices are currently linked to this library.
            </div>
          ) : (
            initialHardware.map((hw) => {
              const lastActive = new Date((hw.lastSeenAt || hw.lastSync)).getTime();
              const isOnline = Date.now() - lastActive < 120000;

              return (
                <div key={hw.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOnline ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800">FocusX ESP32 Reader</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                          <span>MAC: {hw.macAddress}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span>BLE ID: {hw.bleReaderId || 'N/A'}</span>
                          {hw.currentAuthRevision && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span className="text-teal-700 font-medium">Snapshot: Rev {hw.currentAuthRevision}</span>
                            </>
                          )}
                          {hw.freeFlashBytes && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span>Storage: {Math.round(hw.freeFlashBytes / 1024)} KB free</span>
                            </>
                          )}
                        </div>
                        {/* Subsystem Health Indicators */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            hw.clockState === '1' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {hw.clockState === '1' ? '✓ NTP Clock Synced' : '⚠ Clock Sync Pending'}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {hw.pendingEventsCount === 0 ? '✓ Outbox Clean (0 queued)' : `⟳ ${hw.pendingEventsCount} queued`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{
                        backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
                        color: isOnline ? '#15803d' : '#b91c1c'
                      }}>
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                        {isOnline ? "ONLINE" : "OFFLINE"}
                      </div>
                      <button onClick={() => handleSelfDestruct(hw.id)} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded-md transition-colors font-medium border border-red-200 shadow-sm">
                        Factory Reset
                      </button>
                    </div>
                  </div>

                  {/* Clean alert for librarian if machine is disconnected or malfunctioning */}
                  {!isOnline && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>There is an issue with the machine. Please reboot it.</span>
                    </div>
                  )}
                </div>
              );
            }
                    </div>
                  </div>

                  {/* Clean alert for librarian if machine is disconnected or malfunctioning */}
                  {!isOnline && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>There is an issue with the machine. Please reboot it.</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
