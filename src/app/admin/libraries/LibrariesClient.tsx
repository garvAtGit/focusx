'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  Check,
  X,
  Eye,
  Edit,
  MapPin,
  Phone,
  User,
  Armchair,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { approveLibrary, rejectLibrary } from '@/app/actions/admin-actions';
import toast from 'react-hot-toast';

interface LibraryItem {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  managerName: string | null;
  managerPhone: string | null;
  seatsAvailable: number | null;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  librarian: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  _count: {
    seats: number;
    bookings: number;
    staff: number;
  };
}

export function LibrariesClient({ initialLibraries }: { initialLibraries: LibraryItem[] }) {
  const [libraries, setLibraries] = useState<LibraryItem[]>(initialLibraries);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingCount = libraries.filter((l) => l.kycStatus === 'PENDING').length;
  const approvedCount = libraries.filter((l) => l.kycStatus === 'APPROVED').length;
  const rejectedCount = libraries.filter((l) => l.kycStatus === 'REJECTED').length;

  const filteredLibraries = libraries.filter((lib) => {
    const matchesStatus =
      statusFilter === 'ALL' || lib.kycStatus === statusFilter;

    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      lib.name.toLowerCase().includes(query) ||
      (lib.city && lib.city.toLowerCase().includes(query)) ||
      (lib.managerName && lib.managerName.toLowerCase().includes(query)) ||
      (lib.managerPhone && lib.managerPhone.includes(query)) ||
      (lib.librarian?.name && lib.librarian.name.toLowerCase().includes(query)) ||
      (lib.librarian?.phone && lib.librarian.phone.includes(query));

    return matchesStatus && matchesSearch;
  });

  const handleApprove = (id: string, name: string) => {
    setProcessingId(id);
    startTransition(async () => {
      try {
        await approveLibrary(id);
        setLibraries((prev) =>
          prev.map((l) => (l.id === id ? { ...l, kycStatus: 'APPROVED' } : l))
        );
        toast.success(`${name} has been approved and activated!`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to approve library');
      } finally {
        setProcessingId(null);
      }
    });
  };

  const handleReject = (id: string, name: string) => {
    setProcessingId(id);
    startTransition(async () => {
      try {
        await rejectLibrary(id);
        setLibraries((prev) =>
          prev.map((l) => (l.id === id ? { ...l, kycStatus: 'REJECTED' } : l))
        );
        toast.success(`${name} has been rejected`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to reject library');
      } finally {
        setProcessingId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-red-500" />
            Library Fleet & KYC Approvals
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Oversee all registered study spaces, examine passbooks, and approve or edit onboarding profiles.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({libraries.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pending
            {pendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'REJECTED'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library, city, manager..."
            className="w-full h-10 pl-10 pr-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Libraries List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredLibraries.map((lib) => {
          const isCurrentProcessing = processingId === lib.id && isPending;
          return (
            <div
              key={lib.id}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              {/* Left Column: Details */}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white tracking-tight">{lib.name}</h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      lib.kycStatus === 'APPROVED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : lib.kycStatus === 'REJECTED'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {lib.kycStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {lib.address || 'Address pending'} {lib.city ? `(${lib.city})` : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    Manager: <span className="text-slate-200 font-medium">{lib.managerName || lib.librarian?.name || 'N/A'}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-200 font-medium">{lib.managerPhone || lib.librarian?.phone || 'N/A'}</span>
                  </span>
                </div>

                {/* Metrics row */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium flex items-center gap-1.5">
                    <Armchair className="w-3.5 h-3.5 text-blue-400" />
                    {lib._count.seats} Seats Configured ({lib.seatsAvailable || 0} Capacity)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    {lib._count.bookings} Total Bookings
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Added: {new Date(lib.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href={`/admin/view/${lib.id}`}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  View KYC & Passbook
                </Link>

                <Link
                  href={`/admin/edit/${lib.id}`}
                  className="px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 border border-slate-750 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5 text-slate-400" />
                  Edit
                </Link>

                {lib.kycStatus !== 'APPROVED' && (
                  <button
                    disabled={isCurrentProcessing}
                    onClick={() => handleApprove(lib.id, lib.name)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isCurrentProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                )}

                {lib.kycStatus !== 'REJECTED' && (
                  <button
                    disabled={isCurrentProcessing}
                    onClick={() => handleReject(lib.id, lib.name)}
                    className="px-3.5 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isCurrentProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    Reject
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredLibraries.length === 0 && (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-white font-medium text-sm">No libraries matched your filter</p>
            <p className="text-slate-500 text-xs mt-1">Try searching for a different keyword or change status tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
