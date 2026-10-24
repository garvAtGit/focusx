'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';

interface OutboxEvent {
  id: string;
  eventId: string;
  topic: string | null;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SuspiciousUser {
  id: string;
  name: string;
  phone: string | null;
  consecutiveFailures: number;
  failureReasons: string | null;
  rfidTag: string | null;
  updatedAt: Date;
}

interface EntryLogItem {
  id: string;
  timestamp: Date;
  reason: string | null;
  status: string;
  user: { name: string; phone: string | null } | null;
  library: { name: string };
}

export function SystemClient({
  outboxEvents,
  suspiciousUsers,
  recentLogs,
  stats,
}: {
  outboxEvents: OutboxEvent[];
  suspiciousUsers: SuspiciousUser[];
  recentLogs: EntryLogItem[];
  stats: { total: number; pending: number; failed: number };
}) {
  const [tab, setTab] = useState<'OUTBOX' | 'SECURITY' | 'LOGS'>('OUTBOX');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-red-500" />
            System Pulse & Realtime Outbox Engine
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Monitor asynchronous websocket outbox dispatching, dead-letter events, and hardware access security alerts.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Outbox Events
          </div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Pending Realtime Delivery
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats.pending}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Failed / Dead-Letter
          </div>
          <div className="text-2xl font-bold text-red-400 mt-1">{stats.failed}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setTab('OUTBOX')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            tab === 'OUTBOX'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Realtime Outbox Queue ({outboxEvents.length})
        </button>
        <button
          onClick={() => setTab('SECURITY')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            tab === 'SECURITY'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Access Failure Flags ({suspiciousUsers.length})
        </button>
        <button
          onClick={() => setTab('LOGS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            tab === 'LOGS'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Hardware Entry Stream ({recentLogs.length})
        </button>
      </div>

      {tab === 'OUTBOX' && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Event ID</th>
                  <th className="px-5 py-3.5 font-semibold">Topic & Type</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Attempts</th>
                  <th className="px-5 py-3.5 font-semibold">Error / Details</th>
                  <th className="px-5 py-3.5 font-semibold">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {outboxEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-200">{ev.eventId}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-300">{ev.topic || 'General'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{ev.type}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ev.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : ev.status === 'FAILED'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-300">
                      {ev.attempts} / {ev.maxAttempts}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate" title={ev.lastError || 'None'}>
                      {ev.lastError || <span className="text-slate-600 italic">None</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(ev.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
                {outboxEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      Outbox queue is currently empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'SECURITY' && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">User</th>
                  <th className="px-5 py-3.5 font-semibold">Phone</th>
                  <th className="px-5 py-3.5 font-semibold">Consecutive Failures</th>
                  <th className="px-5 py-3.5 font-semibold">RFID Tag</th>
                  <th className="px-5 py-3.5 font-semibold">Failure Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {suspiciousUsers.map((su) => (
                  <tr key={su.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-200">{su.name}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-300">{su.phone || 'No phone'}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold font-mono">
                        {su.consecutiveFailures}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-purple-400">{su.rfidTag || 'None'}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px] max-w-sm truncate" title={su.failureReasons || ''}>
                      {su.failureReasons || 'No reasons specified'}
                    </td>
                  </tr>
                ))}
                {suspiciousUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      Zero users with consecutive gate access failures.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'LOGS' && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-5 py-3.5 font-semibold">Library</th>
                  <th className="px-5 py-3.5 font-semibold">Student</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-slate-200 font-medium">{log.library.name}</td>
                    <td className="px-5 py-3.5 text-slate-200">{log.user?.name || 'Unknown'}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{log.reason || 'Normal gate entry'}</td>
                  </tr>
                ))}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      No entry logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
