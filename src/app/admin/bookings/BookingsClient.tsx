'use client';

import { useState } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Building2,
  User,
  ArrowUpRight,
  AlertCircle,
  X,
  ExternalLink,
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

export function BookingsClient({
  initialIntents,
  refundTasks,
}: {
  initialIntents: BookingIntentItem[];
  refundTasks: RefundTaskItem[];
}) {
  const [tab, setTab] = useState<'INTENTS' | 'REFUNDS'>('INTENTS');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingIntentStatus>('ALL');
  const [search, setSearch] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<BookingIntentItem | null>(null);

  const pendingRefunds = refundTasks.filter((r) => r.status === 'PENDING' || r.status === 'FAILED');

  const filteredIntents = initialIntents.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.referenceId.toLowerCase().includes(query) ||
      (item.providerPaymentId && item.providerPaymentId.toLowerCase().includes(query)) ||
      (item.providerOrderId && item.providerOrderId.toLowerCase().includes(query)) ||
      item.student.name.toLowerCase().includes(query) ||
      (item.student.phone && item.student.phone.includes(query)) ||
      item.library.name.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: BookingIntentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Confirmed
          </span>
        );
      case 'AWAITING_PAYMENT':
      case 'HOLDING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {status}
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
      case 'EXPIRED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
            {status}
          </span>
        );
      case 'REFUNDED':
      case 'REFUND_PENDING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-red-500" />
            Global Bookings, Transactions & Ledger
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Audit platform booking intents, Razorpay payment orders, failed transactions, and auto-refund tasks.
          </p>
        </div>
      </div>

      {/* Main Tabs: Intents vs Refund Queue */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setTab('INTENTS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            tab === 'INTENTS'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Booking Intents & Ledger ({initialIntents.length})
        </button>

        <button
          onClick={() => setTab('REFUNDS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            tab === 'REFUNDS'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refunds Queue
          {pendingRefunds.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {pendingRefunds.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'INTENTS' ? (
        <>
          {/* Controls: Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              {(['ALL', 'CONFIRMED', 'AWAITING_PAYMENT', 'FAILED', 'REFUNDED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ref ID, payment ID, student..."
                className="w-full h-10 pl-10 pr-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Reference ID</th>
                    <th className="px-5 py-3.5 font-semibold">Student</th>
                    <th className="px-5 py-3.5 font-semibold">Library & Seat</th>
                    <th className="px-5 py-3.5 font-semibold">Amount</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredIntents.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-slate-200 font-semibold">{item.referenceId}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Via {item.source}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-100">{item.student.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.student.phone || 'No phone'}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="text-slate-200 font-medium">{item.library.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.seat ? `Seat #${item.seat.name}` : 'Flexible Plan'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-100 text-sm">
                          ₹{(item.expectedAmountPaise / 100).toFixed(2)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">{getStatusBadge(item.status)}</td>

                      <td className="px-5 py-3.5 text-slate-400">
                        {new Date(item.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Kolkata',
                        })}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedIntent(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredIntents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                        No transactions matched your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Refund Queue View */
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Payment ID</th>
                    <th className="px-5 py-3.5 font-semibold">Student & Library</th>
                    <th className="px-5 py-3.5 font-semibold">Refund Amount</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold">Attempts & Error</th>
                    <th className="px-5 py-3.5 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {refundTasks.map((rf) => (
                    <tr key={rf.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-slate-200">
                        {rf.paymentId}
                        {rf.providerRefundId && (
                          <div className="text-[10px] text-emerald-400 font-mono">
                            Refund ID: {rf.providerRefundId}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-100">
                          {rf.booking?.student.name || 'Student'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {rf.booking?.library.name || 'Library'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-bold text-amber-400">
                          ₹{(rf.amountPaise / 100).toFixed(2)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            rf.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : rf.status === 'FAILED'
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {rf.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="text-slate-300">Attempts: {rf.attempts}</div>
                        {rf.lastError && (
                          <div className="text-[11px] text-red-400 truncate max-w-xs" title={rf.lastError}>
                            {rf.lastError}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-slate-400">
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
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-lg">Transaction #{selectedIntent.referenceId}</h3>
                <p className="text-xs text-slate-400">Source: {selectedIntent.source}</p>
              </div>
              <button
                onClick={() => setSelectedIntent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500">Student:</span>{' '}
                <span className="text-slate-200 font-medium">{selectedIntent.student.name}</span>
              </div>
              <div>
                <span className="text-slate-500">Phone:</span>{' '}
                <span className="text-slate-200 font-mono">{selectedIntent.student.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500">Library:</span>{' '}
                <span className="text-slate-200 font-medium">{selectedIntent.library.name}</span>
              </div>
              <div>
                <span className="text-slate-500">Amount:</span>{' '}
                <span className="text-emerald-400 font-bold">
                  ₹{(selectedIntent.expectedAmountPaise / 100).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Razorpay Payment ID:</span>{' '}
                <span className="text-slate-200 font-mono">{selectedIntent.providerPaymentId || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-500">Razorpay Order ID:</span>{' '}
                <span className="text-slate-200 font-mono">{selectedIntent.providerOrderId || 'None'}</span>
              </div>
              {selectedIntent.failureReason && (
                <div className="col-span-2 text-red-400">
                  <span className="text-slate-500">Failure Reason:</span> {selectedIntent.failureReason}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedIntent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
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
