'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Radio,
  Clock,
  ShieldAlert,
  Server,
  Zap,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Loader2,
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

interface SystemClientProps {
  outboxEvents: OutboxEvent[];
  suspiciousUsers: SuspiciousUser[];
  recentLogs: EntryLogItem[];
  stats: { total: number; pending: number; failed: number };
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentStatus: string;
  initialQuery: string;
  initialTab: 'OUTBOX' | 'SECURITY' | 'LOGS';
}

export function SystemClient({
  outboxEvents,
  suspiciousUsers,
  recentLogs,
  stats,
  totalCount,
  currentPage,
  pageSize,
  currentStatus,
  initialQuery,
  initialTab,
}: SystemClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<'OUTBOX' | 'SECURITY' | 'LOGS'>(initialTab);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    setSearchInput(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const updateUrl = useCallback(
    (updates: {
      page?: number;
      q?: string;
      status?: string;
      tab?: 'OUTBOX' | 'SECURITY' | 'LOGS';
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      const nextQ = updates.q !== undefined ? updates.q.trim() : searchInput.trim();
      const nextStatus = updates.status !== undefined ? updates.status : currentStatus;
      const nextPage = updates.page !== undefined ? updates.page : 1;
      const nextTab = updates.tab !== undefined ? updates.tab : tab;

      if (nextQ) {
        params.set('q', nextQ);
      } else {
        params.delete('q');
      }

      if (nextStatus && nextStatus !== 'ALL') {
        params.set('status', nextStatus);
      } else {
        params.delete('status');
      }

      if (nextPage > 1) {
        params.set('page', nextPage.toString());
      } else {
        params.delete('page');
      }

      if (nextTab !== 'OUTBOX') {
        params.set('tab', nextTab);
      } else {
        params.delete('tab');
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

      startTransition(() => {
        router.push(targetUrl, { scroll: false });
      });
    },
    [pathname, searchParams, searchInput, currentStatus, tab, router]
  );

  useEffect(() => {
    if (searchInput.trim() === initialQuery.trim()) return;

    const timer = setTimeout(() => {
      updateUrl({ q: searchInput, page: 1 });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, initialQuery, updateUrl]);

  const handleClearSearch = () => {
    setSearchInput('');
    updateUrl({ q: '', page: 1 });
  };

  const handleStatusSelect = (status: string) => {
    updateUrl({ status, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    updateUrl({ page: newPage });
  };

  const handleTabChange = (newTab: 'OUTBOX' | 'SECURITY' | 'LOGS') => {
    setTab(newTab);
    updateUrl({ tab: newTab, page: 1 });
  };

  const renderPaginationItems = () => {
    const items: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      if (currentPage <= 4) {
        items.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        items.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        items.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return items.map((item, idx) => {
      if (item === '...') {
        return (
          <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 font-bold select-none text-xs">
            ...
          </span>
        );
      }
      const pageNum = item as number;
      const isActive = pageNum === currentPage;
      return (
        <button
          key={`page-${pageNum}`}
          onClick={() => handlePageChange(pageNum)}
          disabled={isPending}
          className={`min-w-9 h-9 px-3 rounded-xl text-xs font-bold transition-all ${
            isActive
              ? 'bg-[#2781CA] text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)]'
              : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          {pageNum}
        </button>
      );
    });
  };

  const startEntry = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-[#2781CA] border border-blue-100">
              Hardware Gateway & Telemetry
            </span>
            <span className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online
            </span>
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-[#2781CA]" />
            System Pulse & Realtime Outbox Engine
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Monitor asynchronous websocket outbox dispatching, dead-letter events, and hardware access security alerts.
          </p>
        </div>
      </div>

      {/* KPI Stats (Signature Librarian 3-card Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Total Outbox */}
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#0085FF]/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-[#0085FF]/20 transition-colors duration-500" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">Total Outbox Events</span>
            <div className="p-2.5 bg-blue-50 border border-blue-100 shadow-sm rounded-xl">
              <Server className="w-5 h-5 text-[#2781CA]" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-5xl font-black text-slate-900 tracking-tight">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-4 font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#2781CA]" /> Historical message bus volume
            </div>
          </div>
        </div>

        {/* Card 2: Pending Delivery (Electric Lime) */}
        <div className="bg-[#C6F135] p-7 rounded-[2.5rem] border border-[#b5e022] shadow-[0_8px_30px_rgba(198,241,53,0.15)] hover:shadow-[0_8px_30px_rgba(198,241,53,0.25)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-25 rounded-full blur-[40px] pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-900">Pending Realtime Sync</span>
            <div className="p-2.5 bg-white/50 backdrop-blur-sm rounded-xl">
              <Radio className="w-5 h-5 text-slate-900" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-5xl font-black text-slate-900 tracking-tight">{stats.pending}</div>
            <div className="text-xs font-bold text-slate-800/80 mt-4 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-900" /> In transit to physical relays
            </div>
          </div>
        </div>

        {/* Card 3: Dead Letter / Failed */}
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-rose-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-rose-500/20 transition-colors duration-500" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">Failed / Dead-Letter</span>
            <div className="p-2.5 bg-rose-50 border border-rose-100 shadow-sm rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-5xl font-black text-slate-900 tracking-tight">{stats.failed}</div>
            <div className="text-xs text-rose-600 mt-4 font-bold flex items-center gap-1">
              {stats.failed > 0 ? 'Requires attention / retry' : 'All dispatched cleanly'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => handleTabChange('OUTBOX')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'OUTBOX'
              ? 'bg-[#2781CA] text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)]'
              : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          Realtime Outbox Queue ({totalCount.toLocaleString()})
        </button>
        <button
          onClick={() => handleTabChange('SECURITY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            tab === 'SECURITY'
              ? 'bg-amber-600 text-white shadow-[0_2px_10px_-4px_rgba(217,119,6,0.5)]'
              : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Access Failure Flags ({suspiciousUsers.length})
        </button>
        <button
          onClick={() => handleTabChange('LOGS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'LOGS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          Hardware Entry Stream ({recentLogs.length})
        </button>
      </div>

      {tab === 'OUTBOX' && (
        <div className="space-y-4">
          {/* Controls: Search & Status Filters */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['ALL', 'PENDING', 'COMPLETED', 'FAILED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusSelect(st)}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    currentStatus === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateUrl({ q: searchInput, page: 1 });
                  }
                }}
                placeholder="Search across all events (event ID, topic)..."
                className="w-full h-11 pl-10 pr-10 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2781CA] focus:bg-white transition-all shadow-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#2781CA]" />
                ) : searchInput ? (
                  <button
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-4 font-bold">Event ID</th>
                    <th className="px-6 py-4 font-bold">Topic & Type</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold">Attempts</th>
                    <th className="px-6 py-4 font-bold">Error / Details</th>
                    <th className="px-6 py-4 font-bold">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outboxEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{ev.eventId}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{ev.topic || 'General'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{ev.type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            ev.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ev.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700 font-medium">
                        {ev.attempts} / {ev.maxAttempts}
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate" title={ev.lastError || 'None'}>
                        {ev.lastError || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
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
                      <td colSpan={6} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <FilterX className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-slate-800 text-sm">No outbox events found</div>
                          <p className="text-xs text-slate-400">
                            {searchInput
                              ? `No events matched "${searchInput}" across all records.`
                              : 'No events found for this status filter.'}
                          </p>
                          {(searchInput || currentStatus !== 'ALL') && (
                            <button
                              onClick={() => {
                                setSearchInput('');
                                updateUrl({ q: '', status: 'ALL', page: 1 });
                              }}
                              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                            >
                              Clear Filters & Search
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-medium text-slate-500">
                Showing <span className="font-bold text-slate-900">{startEntry}</span> to{' '}
                <span className="font-bold text-slate-900">{endEntry}</span> of{' '}
                <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> events
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isPending}
                  className="flex items-center gap-1 px-3.5 h-9 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1">{renderPaginationItems()}</div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isPending}
                  className="flex items-center gap-1 px-3.5 h-9 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'SECURITY' && (
        <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">Phone</th>
                  <th className="px-6 py-4 font-bold">Consecutive Failures</th>
                  <th className="px-6 py-4 font-bold">RFID Tag</th>
                  <th className="px-6 py-4 font-bold">Failure Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suspiciousUsers.map((su) => (
                  <tr key={su.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{su.name}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{su.phone || 'No phone'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                        {su.consecutiveFailures} Denied Attempts
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-purple-600">{su.rfidTag || 'None'}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{su.failureReasons || 'Access denied'}</td>
                  </tr>
                ))}
                {suspiciousUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      Zero suspicious access violations recorded. All hardware access tokens clean.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'LOGS' && (
        <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-4 font-bold">Timestamp</th>
                  <th className="px-6 py-4 font-bold">Student</th>
                  <th className="px-6 py-4 font-bold">Library</th>
                  <th className="px-6 py-4 font-bold">Gate Status</th>
                  <th className="px-6 py-4 font-bold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{log.user?.name || 'Walk-in / Unknown'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{log.user?.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{log.library.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          log.status === 'CHECK_IN' || log.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{log.reason || 'Normal hardware swipe'}</td>
                  </tr>
                ))}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No hardware entry logs recorded yet.
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
