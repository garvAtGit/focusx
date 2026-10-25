'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Search,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Loader2,
} from 'lucide-react';
import type { BookingIntentStatus, RefundTaskStatus } from '@prisma/client';

interface BookingIntentItem {
  id: string;
  referenceId: string;
  source: string;
  status: BookingIntentStatus;
  expectedAmountPaise: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  failureReason: string | null;
  createdAt: Date;
  student: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  library: {
    id: string;
    name: string;
    city: string | null;
  };
  plan: {
    name: string;
    type: string;
  };
  seat: {
    name: string;
    type: string;
  } | null;
}

interface RefundTaskItem {
  id: string;
  paymentId: string;
  amountPaise: number;
  reason: string;
  status: RefundTaskStatus;
  attempts: number;
  lastError: string | null;
  providerRefundId: string | null;
  createdAt: Date;
  booking: {
    id: string;
    student: { name: string; phone: string | null };
    library: { name: string };
  } | null;
}

interface BookingsClientProps {
  initialIntents: BookingIntentItem[];
  refundTasks: RefundTaskItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentStatus: 'ALL' | BookingIntentStatus;
  initialQuery: string;
  initialTab: 'INTENTS' | 'REFUNDS';
}

export function BookingsClient({
  initialIntents,
  refundTasks,
  totalCount,
  currentPage,
  pageSize,
  currentStatus,
  initialQuery,
  initialTab,
}: BookingsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<'INTENTS' | 'REFUNDS'>(initialTab);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [selectedIntent, setSelectedIntent] = useState<BookingIntentItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const pendingRefunds = refundTasks.filter((r) => r.status === 'PENDING' || r.status === 'FAILED');
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Keep search input in sync if URL changes externally
  useEffect(() => {
    setSearchInput(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // URL navigation helper
  const updateUrl = useCallback(
    (updates: {
      page?: number;
      q?: string;
      status?: 'ALL' | BookingIntentStatus;
      tab?: 'INTENTS' | 'REFUNDS';
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

      if (nextTab === 'REFUNDS') {
        params.set('tab', 'REFUNDS');
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

  // Debounced search effect (350ms)
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

  const handleStatusSelect = (status: 'ALL' | BookingIntentStatus) => {
    updateUrl({ status, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    updateUrl({ page: newPage });
  };

  const handleTabChange = (newTab: 'INTENTS' | 'REFUNDS') => {
    setTab(newTab);
    updateUrl({ tab: newTab, page: 1 });
  };

  const getStatusBadge = (status: BookingIntentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            Confirmed
          </span>
        );
      case 'AWAITING_PAYMENT':
      case 'HOLDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#2781CA] border border-blue-200">
            {status}
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
      case 'EXPIRED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            {status}
          </span>
        );
      case 'REFUNDED':
      case 'REFUND_PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Generate pagination items
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
              Financial Integrity & Audits
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {totalCount.toLocaleString()} Total Transactions
            </span>
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-[#2781CA]" />
            Global Bookings, Transactions & Ledger
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Audit platform booking intents, Razorpay payment orders, failed transactions, and auto-refund tasks.
          </p>
        </div>
      </div>

      {/* Main Tabs: Intents vs Refund Queue */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => handleTabChange('INTENTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'INTENTS'
              ? 'bg-[#2781CA] text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)]'
              : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          Booking Intents & Ledger ({totalCount.toLocaleString()})
        </button>

        <button
          onClick={() => handleTabChange('REFUNDS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            tab === 'REFUNDS'
              ? 'bg-amber-600 text-white shadow-[0_2px_10px_-4px_rgba(217,119,6,0.5)]'
              : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refunds Queue
          {pendingRefunds.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
              {pendingRefunds.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'INTENTS' ? (
        <>
          {/* Controls: Search & Status Filters */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['ALL', 'CONFIRMED', 'AWAITING_PAYMENT', 'FAILED', 'REFUNDED'] as const).map((st) => (
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
                placeholder="Search across all pages (ref ID, student, library)..."
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

          {/* Table */}
          <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-4 font-bold">Reference ID</th>
                    <th className="px-6 py-4 font-bold">Student</th>
                    <th className="px-6 py-4 font-bold">Library & Seat</th>
                    <th className="px-6 py-4 font-bold">Amount</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold">Timestamp</th>
                    <th className="px-6 py-4 font-bold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialIntents.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-slate-900 font-bold">{item.referenceId}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                          Via {item.source}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{item.student.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.student.phone || 'No phone'}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-semibold">{item.library.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.seat ? `Seat #${item.seat.name}` : 'Flexible Plan'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-black text-slate-900 text-sm">
                          ₹{(item.expectedAmountPaise / 100).toFixed(2)}
                        </span>
                      </td>

                      <td className="px-6 py-4">{getStatusBadge(item.status)}</td>

                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {new Date(item.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Kolkata',
                        })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedIntent(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                  {initialIntents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <FilterX className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-slate-800 text-sm">No transactions found</div>
                          <p className="text-xs text-slate-400">
                            {searchInput
                              ? `No transactions matched "${searchInput}" across all records in the ledger.`
                              : 'No transactions found for this status filter.'}
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
                <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> transactions
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
        </>
      ) : (
        /* Refund Queue View */
        <div className="space-y-4">
          <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-4 font-bold">Payment ID</th>
                    <th className="px-6 py-4 font-bold">Student & Library</th>
                    <th className="px-6 py-4 font-bold">Refund Amount</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold">Attempts & Error</th>
                    <th className="px-6 py-4 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {refundTasks.map((rf) => (
                    <tr key={rf.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-900 font-bold">
                        {rf.paymentId}
                        {rf.providerRefundId && (
                          <div className="text-[10px] text-emerald-600 font-mono font-bold">
                            Refund ID: {rf.providerRefundId}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {rf.booking?.student.name || 'Student'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {rf.booking?.library.name || 'Library'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-black text-amber-600 text-sm">
                          ₹{(rf.amountPaise / 100).toFixed(2)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            rf.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rf.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {rf.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-slate-700 font-medium">Attempts: {rf.attempts}</div>
                        {rf.lastError && (
                          <div className="text-[11px] text-rose-600 font-semibold truncate max-w-xs" title={rf.lastError}>
                            {rf.lastError}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {new Date(rf.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                  {refundTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No pending or failed refund tasks recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Intent Modal */}
      {selectedIntent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-[2.5rem] p-7 shadow-2xl relative space-y-6 animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight">Transaction #{selectedIntent.referenceId}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Source: {selectedIntent.source}</p>
              </div>
              <button
                onClick={() => setSelectedIntent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 font-medium">Student:</span>{' '}
                <span className="text-slate-900 font-bold block mt-0.5">{selectedIntent.student.name}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Phone:</span>{' '}
                <span className="text-slate-900 font-mono font-bold block mt-0.5">{selectedIntent.student.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Library:</span>{' '}
                <span className="text-slate-900 font-semibold block mt-0.5">{selectedIntent.library.name}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Amount:</span>{' '}
                <span className="text-emerald-600 font-black text-sm block mt-0.5">
                  ₹{(selectedIntent.expectedAmountPaise / 100).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Razorpay Payment ID:</span>{' '}
                <span className="text-slate-800 font-mono font-semibold block mt-0.5 break-all">{selectedIntent.providerPaymentId || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Razorpay Order ID:</span>{' '}
                <span className="text-slate-800 font-mono font-semibold block mt-0.5 break-all">{selectedIntent.providerOrderId || 'None'}</span>
              </div>
              {selectedIntent.failureReason && (
                <div className="col-span-2 text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-200 mt-1">
                  <span className="font-bold">Failure Reason:</span> {selectedIntent.failureReason}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedIntent(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
