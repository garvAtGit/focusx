"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowUpCircle,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Play,
  RotateCcw,
  Ban,
  Radio,
  Building2,
  ChevronRight,
  Copy,
  Check,
  Plus,
  ShieldCheck,
  Loader2,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";

interface FirmwareRelease {
  version: string;
  name: string;
  sha256: string;
  size: number;
  buildDate: string;
  capabilities: string[];
  filename: string;
  isLatest: boolean;
  downloadUrl?: string;
}

interface RolloutDevice {
  id: string;
  relayId: string;
  macAddress: string | null;
  bleReaderId: string | null;
  nfcTagId: string;
  libraryId: string;
  libraryName: string;
  batchIndex: number;
  status: string;
  initialVersion: string | null;
  targetVersion: string;
  currentVersion: string | null;
  cmdId: string | null;
  attempts: number;
  lastError: string | null;
  dispatchedAt: Date | string | null;
  completedAt: Date | string | null;
  updatedAt: Date | string;
  isOnline: boolean;
  isStale: boolean;
  isEligibleForRetry: boolean;
}

interface RolloutDetails {
  id: string;
  name: string;
  targetVersion: string;
  targetSha256: string;
  targetSize: number;
  status: string;
  totalBatches: number;
  currentBatch: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  targetCount: number;
  notStartedCount: number;
  queuedCount: number;
  inProgressCount: number;
  succeededCount: number;
  failedCount: number;
  expiredCount: number;
  cancelledCount: number;
  devices: RolloutDevice[];
}

interface FleetDevice {
  id: string;
  macAddress: string | null;
  bleReaderId: string | null;
  nfcTagId: string;
  firmwareVersion: string;
  status: string;
  isOnline: boolean;
  isStale: boolean;
  lastSeenAt: Date | string | null;
  lastSync: Date | string;
  libraryId: string;
  libraryName: string;
  currentOtaState: string;
  latestRollout: any;
}

export function OtaFleetClient({
  initialReleases,
  initialDevices,
  initialRollouts,
  initialActiveRollout,
}: {
  initialReleases: FirmwareRelease[];
  initialDevices: FleetDevice[];
  initialRollouts: any[];
  initialActiveRollout: RolloutDetails | null;
}) {
  const [releases] = useState<FirmwareRelease[]>(initialReleases);
  const [devices, setDevices] = useState<FleetDevice[]>(initialDevices);
  const [rollouts, setRollouts] = useState<any[]>(initialRollouts);
  const [activeRollout, setActiveRollout] = useState<RolloutDetails | null>(initialActiveRollout);

  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [batchFilter, setBatchFilter] = useState<string>("ALL");
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalTargetVersion, setModalTargetVersion] = useState(
    initialReleases[0]?.version || "5.1.1-ota"
  );
  const [modalStrategy, setModalStrategy] = useState<"CANARY_FIRST" | "STAGED" | "ALL_AT_ONCE">("CANARY_FIRST");
  const [modalCohort, setModalCohort] = useState<"ALL" | "OUTDATED" | "LIBRARY" | "CUSTOM">("OUTDATED");
  const [modalLibraryId, setModalLibraryId] = useState<string>("");
  const [modalSelectedDeviceIds, setModalSelectedDeviceIds] = useState<string[]>([]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(id);
    setTimeout(() => setCopiedSha(null), 2000);
    toast.success("SHA-256 copied to clipboard");
  };

  const refreshRollout = async (rolloutId?: string) => {
    const targetId = rolloutId || activeRollout?.id;
    if (!targetId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/ota/rollouts/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveRollout(data.rollout);
      }
      const listRes = await fetch("/api/admin/ota/rollouts");
      if (listRes.ok) {
        const listData = await listRes.json();
        setRollouts(listData.rollouts);
      }
      const devRes = await fetch("/api/admin/ota/devices");
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevices(devData.devices);
      }
    } catch {
      toast.error("Failed to refresh rollout status.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvanceBatch = async () => {
    if (!activeRollout) return;
    if (
      !confirm(
        `Are you sure you want to advance from Batch ${activeRollout.currentBatch} to Batch ${
          activeRollout.currentBatch + 1
        }? This will dispatch firmware commands to the next stage.`
      )
    )
      return;

    setActionLoading("advance");
    try {
      const res = await fetch(`/api/admin/ota/rollouts/${activeRollout.id}/advance`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Advanced to next batch!");
        setActiveRollout(data.rollout);
      } else {
        toast.error(data.error || "Failed to advance batch.");
      }
    } catch {
      toast.error("Network error while advancing batch.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryDevice = async (deviceRolloutId: string) => {
    if (!activeRollout) return;
    setActionLoading(`retry_${deviceRolloutId}`);
    try {
      const res = await fetch(`/api/admin/ota/rollouts/${activeRollout.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceRolloutId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Retry queued for device.");
        setActiveRollout(data.rollout);
      } else {
        toast.error(data.error || "Failed to queue retry.");
      }
    } catch {
      toast.error("Network error while queuing retry.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryAllFailed = async () => {
    if (!activeRollout) return;
    if (!confirm("Retry all eligible failed and expired devices in current active batches?")) return;

    setActionLoading("retry_all");
    try {
      const res = await fetch(`/api/admin/ota/rollouts/${activeRollout.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Failed devices queued for retry.");
        setActiveRollout(data.rollout);
      } else {
        toast.error(data.error || "Failed to retry devices.");
      }
    } catch {
      toast.error("Network error during retry.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRollout = async () => {
    if (!activeRollout) return;
    if (!confirm("Are you sure you want to cancel this rollout? Undispatched devices will be halted.")) return;

    setActionLoading("cancel");
    try {
      const res = await fetch(`/api/admin/ota/rollouts/${activeRollout.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Rollout cancelled.");
        setActiveRollout(data.rollout);
      } else {
        toast.error(data.error || "Failed to cancel rollout.");
      }
    } catch {
      toast.error("Network error during cancellation.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRollout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) {
      toast.error("Please provide a name for this rollout.");
      return;
    }

    setActionLoading("create_rollout");
    try {
      const payload: any = {
        name: modalName.trim(),
        targetVersion: modalTargetVersion,
        batchStrategy: modalStrategy,
        autoDispatchFirstBatch: true,
      };

      if (modalCohort === "OUTDATED") {
        payload.onlyOutdated = true;
      } else if (modalCohort === "LIBRARY") {
        payload.libraryId = modalLibraryId;
      } else if (modalCohort === "CUSTOM") {
        payload.deviceIds = modalSelectedDeviceIds;
      }

      const res = await fetch("/api/admin/ota/rollouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Rollout created and Batch 1 initiated!");
        setIsCreateModalOpen(false);
        setActiveRollout(data.rollout);
        refreshRollout(data.rollout.id);
      } else {
        toast.error(data.error || "Failed to create rollout.");
      }
    } catch {
      toast.error("Network error while creating rollout.");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered Devices for Active Rollout
  const filteredDevices = useMemo(() => {
    if (!activeRollout) return [];
    return activeRollout.devices.filter((dev) => {
      const matchesSearch =
        searchTerm === "" ||
        (dev.macAddress && dev.macAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (dev.bleReaderId && dev.bleReaderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (dev.libraryName && dev.libraryName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        dev.relayId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "IN_PROGRESS" &&
          ["DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING", "QUEUED", "DISPATCHED"].includes(
            dev.status
          )) ||
        dev.status === statusFilter;

      const matchesBatch =
        batchFilter === "ALL" || dev.batchIndex.toString() === batchFilter;

      return matchesSearch && matchesStatus && matchesBatch;
    });
  }, [activeRollout, searchTerm, statusFilter, batchFilter]);

  // Unique Libraries for Filter
  const libraries = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((d) => map.set(d.libraryId, d.libraryName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [devices]);

  return (
    <div className="space-y-8">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <ArrowUpCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">OTA Fleet Rollout Management</h1>
              <p className="text-sm text-slate-400">
                Staged firmware deployment, live verification, and failure recovery across the dual-RFID scanner fleet.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshRollout()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setModalName(`Rollout to ${releases[0]?.version || "5.1.1-ota"} (${new Date().toLocaleDateString()})`);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition shadow-lg shadow-red-600/20"
          >
            <Plus className="w-4 h-4" />
            New Rollout
          </button>
        </div>
      </div>

      {/* 2. Release Management Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Layers className="w-4 h-4 text-red-400" />
          Available Firmware Releases
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {releases.map((rel) => (
            <div
              key={rel.version}
              className={`rounded-2xl border p-4 bg-slate-950/60 backdrop-blur-sm relative overflow-hidden transition ${
                rel.isLatest ? "border-emerald-500/30 shadow-sm shadow-emerald-500/5" : "border-slate-800/80"
              }`}
            >
              {rel.isLatest && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Latest Production
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-base text-white">{rel.name}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">v{rel.version}</p>

              <div className="mt-4 space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Binary Size:</span>
                  <span className="font-mono text-slate-200">
                    {(rel.size / 1024 / 1024).toFixed(2)} MB ({rel.size.toLocaleString()} B)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">SHA-256:</span>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                    <span>{rel.sha256.substring(0, 10)}...{rel.sha256.substring(58)}</span>
                    <button
                      onClick={() => copyToClipboard(rel.sha256, rel.version)}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Copy SHA-256"
                    >
                      {copiedSha === rel.version ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Capabilities:</span>
                  <span className="text-slate-300 capitalize">{rel.capabilities.join(", ")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Active Rollout View */}
      {activeRollout ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-6">
          {/* Active Rollout Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white tracking-tight">{activeRollout.name}</h2>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    activeRollout.status === "ACTIVE"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : activeRollout.status === "COMPLETED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {activeRollout.status}
                </span>
                <span className="text-xs text-slate-400 font-mono">Target: v{activeRollout.targetVersion}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Batch {activeRollout.currentBatch} of {activeRollout.totalBatches} active • Created on{" "}
                {new Date(activeRollout.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Stage Progression Action Controls */}
            <div className="flex items-center gap-2">
              {activeRollout.status === "ACTIVE" && activeRollout.currentBatch < activeRollout.totalBatches && (
                <button
                  onClick={handleAdvanceBatch}
                  disabled={actionLoading === "advance"}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition shadow-md shadow-amber-600/20"
                >
                  {actionLoading === "advance" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Advance to Batch {activeRollout.currentBatch + 1}
                </button>
              )}

              {activeRollout.failedCount > 0 && activeRollout.status === "ACTIVE" && (
                <button
                  onClick={handleRetryAllFailed}
                  disabled={actionLoading === "retry_all"}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-medium transition"
                >
                  {actionLoading === "retry_all" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Retry Failed ({activeRollout.failedCount})
                </button>
              )}

              {activeRollout.status === "ACTIVE" && (
                <button
                  onClick={handleCancelRollout}
                  disabled={actionLoading === "cancel"}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs font-medium transition"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Metric Cards Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="rounded-xl border border-slate-800/80 p-3 bg-slate-900/40">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Devices</span>
              <div className="text-xl font-bold text-white mt-1">{activeRollout.targetCount}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 p-3 bg-emerald-500/5">
              <span className="text-[11px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Succeeded
              </span>
              <div className="text-xl font-bold text-emerald-400 mt-1">{activeRollout.succeededCount}</div>
            </div>
            <div className="rounded-xl border border-amber-500/20 p-3 bg-amber-500/5">
              <span className="text-[11px] text-amber-400 uppercase font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" /> In Progress
              </span>
              <div className="text-xl font-bold text-amber-400 mt-1">{activeRollout.inProgressCount}</div>
            </div>
            <div className="rounded-xl border border-blue-500/20 p-3 bg-blue-500/5">
              <span className="text-[11px] text-blue-400 uppercase font-semibold flex items-center gap-1">
                <Radio className="w-3 h-3" /> Queued
              </span>
              <div className="text-xl font-bold text-blue-400 mt-1">{activeRollout.queuedCount}</div>
            </div>
            <div className="rounded-xl border border-rose-500/20 p-3 bg-rose-500/5">
              <span className="text-[11px] text-rose-400 uppercase font-semibold flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Failed
              </span>
              <div className="text-xl font-bold text-rose-400 mt-1">{activeRollout.failedCount}</div>
            </div>
            <div className="rounded-xl border border-slate-800 p-3 bg-slate-900/30">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Not Started</span>
              <div className="text-xl font-bold text-slate-300 mt-1">{activeRollout.notStartedCount}</div>
            </div>
            <div className="rounded-xl border border-slate-800 p-3 bg-slate-900/30">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Cancelled</span>
              <div className="text-xl font-bold text-slate-400 mt-1">{activeRollout.cancelledCount}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Overall Rollout Completion</span>
              <span className="font-bold text-white">
                {activeRollout.targetCount > 0
                  ? Math.round((activeRollout.succeededCount / activeRollout.targetCount) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${(activeRollout.succeededCount / (activeRollout.targetCount || 1)) * 100}%`,
                }}
              />
              <div
                className="bg-amber-500 transition-all duration-500"
                style={{
                  width: `${(activeRollout.inProgressCount / (activeRollout.targetCount || 1)) * 100}%`,
                }}
              />
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{
                  width: `${(activeRollout.failedCount / (activeRollout.targetCount || 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Device List & Filters */}
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Target Device Fleet</span>
                <span className="text-xs text-slate-400">({filteredDevices.length} showing)</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search device, MAC, library..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-red-500 w-48"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCEEDED">Succeeded</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="QUEUED">Queued</option>
                  <option value="FAILED">Failed</option>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                {/* Batch Filter */}
                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Batches</option>
                  {Array.from({ length: activeRollout.totalBatches }, (_, i) => i + 1).map((b) => (
                    <option key={b} value={b.toString()}>
                      Batch {b} {b === 1 ? "(Canary)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Device Identity</th>
                    <th className="py-3 px-4">Library</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Version Flow</th>
                    <th className="py-3 px-4">OTA State</th>
                    <th className="py-3 px-4">Heartbeat</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredDevices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-slate-200">
                          {dev.bleReaderId || dev.macAddress || dev.relayId.substring(0, 8)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">{dev.relayId}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {dev.libraryName}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            dev.batchIndex === activeRollout.currentBatch
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : dev.batchIndex < activeRollout.currentBatch
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          Stage {dev.batchIndex}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="text-slate-400">{dev.initialVersion || "legacy"}</span>
                        <span className="text-slate-400 mx-1.5">→</span>
                        <span className="font-bold text-white">{dev.targetVersion}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit border ${
                              dev.status === "SUCCEEDED"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : dev.status === "FAILED"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : ["DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"].includes(dev.status)
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                                : dev.status === "QUEUED" || dev.status === "DISPATCHED"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {dev.status}
                          </span>
                          {dev.lastError && (
                            <span className="text-[10px] text-rose-400 font-mono truncate max-w-[180px]" title={dev.lastError}>
                              {dev.lastError}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              dev.isOnline ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-slate-400"
                            }`}
                          />
                          <span className={`text-[11px] ${dev.isOnline ? "text-emerald-400 font-medium" : "text-slate-400"}`}>
                            {dev.isOnline ? "Online" : dev.isStale ? "Stale" : "Offline"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {dev.isEligibleForRetry ? (
                          <button
                            onClick={() => handleRetryDevice(dev.id)}
                            disabled={actionLoading === `retry_${dev.id}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition inline-flex items-center gap-1 border border-slate-700"
                          >
                            {actionLoading === `retry_${dev.id}` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            Retry
                          </button>
                        ) : dev.status === "SUCCEEDED" ? (
                          <span className="text-emerald-400 font-bold text-[11px]">Verified</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredDevices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No devices match the specified search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center bg-slate-950/40 space-y-3">
          <ArrowUpCircle className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No Active Fleet Rollout</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All devices are either idle or up-to-date. Create a new staged rollout to begin updating the dual-RFID
            scanner fleet to an approved firmware candidate.
          </p>
          <button
            onClick={() => {
              setModalName(`Rollout to ${releases[0]?.version || "5.1.1-ota"} (${new Date().toLocaleDateString()})`);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Launch First Fleet Rollout
          </button>
        </div>
      )}

      {/* 4. Historical Rollouts List */}
      {rollouts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-400" />
            Rollout Execution History
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rollout Name</th>
                  <th className="py-3 px-4">Target Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Stages</th>
                  <th className="py-3 px-4">Completion</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {rollouts.map((ro) => (
                  <tr key={ro.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-4 font-bold text-white">{ro.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">v{ro.targetVersion}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          ro.status === "ACTIVE"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : ro.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {ro.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      Batch {ro.currentBatch} / {ro.totalBatches}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{ro.progressPercent}%</span>
                        <span className="text-[10px] text-slate-400">
                          ({ro.succeededCount}/{ro.targetCount})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{new Date(ro.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => refreshRollout(ro.id)}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Create Rollout Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <ArrowUpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Create New Fleet Rollout</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRollout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rollout Name</label>
                <input
                  type="text"
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. Production Rollout v5.1.1-ota"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Firmware Release</label>
                <select
                  value={modalTargetVersion}
                  onChange={(e) => setModalTargetVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-red-500"
                >
                  {releases.map((rel) => (
                    <option key={rel.version} value={rel.version}>
                      v{rel.version} — {rel.name} ({(rel.size / 1024 / 1024).toFixed(2)} MB)
                      {rel.isLatest ? " [LATEST]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Cohort</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setModalCohort("OUTDATED")}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      modalCohort === "OUTDATED"
                        ? "bg-red-500/10 border-red-500/40 text-red-300 font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div>Only Outdated Devices</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Skip devices already on target version</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalCohort("ALL")}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      modalCohort === "ALL"
                        ? "bg-red-500/10 border-red-500/40 text-red-300 font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div>All Fleet Devices</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Target entire fleet unconditionally</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalCohort("LIBRARY")}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      modalCohort === "LIBRARY"
                        ? "bg-red-500/10 border-red-500/40 text-red-300 font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div>By Specific Library</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Deploy only to one facility</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalCohort("CUSTOM")}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      modalCohort === "CUSTOM"
                        ? "bg-red-500/10 border-red-500/40 text-red-300 font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div>Custom Selection</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Select devices individually</div>
                  </button>
                </div>
              </div>

              {modalCohort === "LIBRARY" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Select Library</label>
                  <select
                    value={modalLibraryId}
                    onChange={(e) => setModalLibraryId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none"
                  >
                    <option value="">Choose a library...</option>
                    {libraries.map((lib) => (
                      <option key={lib.id} value={lib.id}>
                        {lib.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalCohort === "CUSTOM" && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 border border-slate-800 rounded-xl bg-slate-900/60">
                  {devices.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalSelectedDeviceIds.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalSelectedDeviceIds([...modalSelectedDeviceIds, d.id]);
                          } else {
                            setModalSelectedDeviceIds(modalSelectedDeviceIds.filter((id) => id !== d.id));
                          }
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-red-500 focus:ring-0"
                      />
                      <span className="font-mono">{d.bleReaderId || d.macAddress || d.id.substring(0, 8)}</span>
                      <span className="text-slate-400">({d.libraryName})</span>
                    </label>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Staged Rollout Strategy</label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      checked={modalStrategy === "CANARY_FIRST"}
                      onChange={() => setModalStrategy("CANARY_FIRST")}
                      className="mt-0.5 text-red-500 focus:ring-0"
                    />
                    <div>
                      <div className="font-bold text-white">Canary First (Recommended)</div>
                      <div className="text-[11px] text-slate-400">
                        Batch 1 deploys to 1 pilot device. Administrator explicitly advances to Batch 2 (remaining cohort)
                        after verifying healthy operation.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      checked={modalStrategy === "STAGED"}
                      onChange={() => setModalStrategy("STAGED")}
                      className="mt-0.5 text-red-500 focus:ring-0"
                    />
                    <div>
                      <div className="font-bold text-white">3-Stage Progressive Rollout</div>
                      <div className="text-[11px] text-slate-400">
                        Batch 1: 10% canary &rarr; Batch 2: 40% &rarr; Batch 3: 50% remainder.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      checked={modalStrategy === "ALL_AT_ONCE"}
                      onChange={() => setModalStrategy("ALL_AT_ONCE")}
                      className="mt-0.5 text-red-500 focus:ring-0"
                    />
                    <div>
                      <div className="font-bold text-white">Single Batch (All At Once)</div>
                      <div className="text-[11px] text-slate-400">
                        Dispatches to all selected cohort devices in a single batch without staging.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "create_rollout"}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition shadow-lg shadow-red-600/20 inline-flex items-center gap-2"
                >
                  {actionLoading === "create_rollout" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Launch Fleet Rollout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
