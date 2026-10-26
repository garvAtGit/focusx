"use client";

import React, { useState } from "react";
import { Plus, CheckCircle2, AlertCircle, Cpu, Loader2, ArrowUpCircle, RefreshCw, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HardwareSetupClient({ libraryId, initialHardware }: { libraryId: string, initialHardware: any[] }) {
  const [claimCode, setClaimCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const router = useRouter();

  const handleSelfDestruct = async (hwId: string) => {
    if (!confirm('Are you sure you want to factory reset this device? It will erase all memory and reboot into setup mode.')) return;
    
    setActionLoading(prev => ({ ...prev, [hwId]: 'reset' }));
    try {
      const res = await fetch('/api/hardware/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hwId, command: 'factory_reset' })
      });
      if (res.ok) {
        alert('Self-destruct command queued! The device will wipe its memory on the next ping or heartbeat.');
      } else {
        alert('Failed to send command.');
      }
    } catch {
      alert('Error sending command.');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[hwId];
        return next;
      });
    }
  };

  const handleSendCommand = async (hwId: string, command: string, description: string) => {
    setActionLoading(prev => ({ ...prev, [hwId]: command }));
    try {
      const res = await fetch('/api/hardware/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hwId, command })
      });
      if (res.ok) {
        alert(`${description} queued successfully! The device will execute it on the next heartbeat.`);
      } else {
        alert(`Failed to queue ${description}.`);
      }
    } catch {
      alert(`Error queueing ${description}.`);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[hwId];
        return next;
      });
    }
  };

  const handleQueueOTA = async (hwId: string) => {
    if (!confirm('Queue OTA firmware update (v5.1.0-ota) to this device? It will be downloaded and verified on the next heartbeat.')) return;

    setActionLoading(prev => ({ ...prev, [hwId]: 'ota' }));
    try {
      const res = await fetch('/api/hardware/ota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relayId: hwId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`OTA firmware update queued! Command: ${data.queuedCommand}`);
      } else {
        alert(`Failed to queue OTA: ${data.error || 'Server error'}`);
      }
    } catch {
      alert('Network error while requesting OTA update.');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[hwId];
        return next;
      });
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
    } catch {
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
          <h3 className="text-lg font-semibold text-slate-800">Linked Devices & Fleet Observability</h3>
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
              const fwVer = hw.firmwareVersion || "5.0.0-p0a";
              const isUpToDate = fwVer === "5.1.0-ota";
              const activeAction = actionLoading[hw.id];

              return (
                <div key={hw.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOnline ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-800">FocusX ESP32 Reader</h4>
                          {/* Firmware Version Badge */}
                          <span className={`px-2 py-0.5 text-xs font-mono rounded-full font-medium ${
                            isUpToDate 
                              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            v{fwVer}
                          </span>
                        </div>
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
                          {hw.pendingCommand && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-50 text-purple-700 border border-purple-200">
                              Queued: {hw.pendingCommand.split(':')[0]}
                            </span>
                          )}
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
                      
                      {/* Fleet Management Action Buttons */}
                      <div className="flex items-center gap-2 mt-1">
                        {!isUpToDate && (
                          <button 
                            onClick={() => handleQueueOTA(hw.id)} 
                            disabled={!!activeAction}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors font-medium shadow-sm flex items-center gap-1 disabled:opacity-50"
                          >
                            {activeAction === 'ota' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
                            OTA Update
                          </button>
                        )}
                        <button 
                          onClick={() => handleSendCommand(hw.id, 'SYNC_SNAPSHOT', 'Snapshot sync')} 
                          disabled={!!activeAction}
                          title="Trigger snapshot update"
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-md transition-colors font-medium border border-slate-300 flex items-center gap-1 disabled:opacity-50"
                        >
                          {activeAction === 'SYNC_SNAPSHOT' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Sync
                        </button>
                        <button 
                          onClick={() => handleSendCommand(hw.id, 'REBOOT', 'Remote reboot')} 
                          disabled={!!activeAction}
                          title="Reboot reader"
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-md transition-colors font-medium border border-slate-300 flex items-center gap-1 disabled:opacity-50"
                        >
                          {activeAction === 'REBOOT' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Reboot
                        </button>
                        <button 
                          onClick={() => handleSelfDestruct(hw.id)} 
                          disabled={!!activeAction}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs rounded-md transition-colors font-medium border border-red-200 shadow-sm disabled:opacity-50"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Warning banner for offline devices */}
                  {!isOnline && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Device has not reported a heartbeat in over 2 minutes. Check Wi-Fi connection or power supply.</span>
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
