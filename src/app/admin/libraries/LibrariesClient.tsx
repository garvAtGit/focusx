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
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-[#2781CA] border border-blue-100">
              FocusX Ecosystem Fleet
            </span>
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-[#2781CA]" />
            Library Fleet & KYC Approvals
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Oversee all registered study spaces, examine passbooks, and approve or edit onboarding profiles.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-[#2781CA] text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)]'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            All ({libraries.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            Pending
            {pendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Active ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'REJECTED'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library, city, manager..."
            className="w-full h-11 pl-11 pr-4 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2781CA] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Libraries List */}
      <div className="grid grid-cols-1 gap-5">
        {filteredLibraries.map((lib) => {
          const isCurrentProcessing = processingId === lib.id && isPending;
          return (
            <div
              key={lib.id}
              className="p-6 rounded-[2.5rem] bg-white border border-slate-200/80 hover:border-slate-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              {/* Left Column: Details */}
              <div className="space-y-3.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{lib.name}</h2>
                  <span
                    className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      lib.kycStatus === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : lib.kycStatus === 'REJECTED'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {lib.kycStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {lib.address || 'Address pending'} {lib.city ? `(${lib.city})` : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    Manager: <span className="text-slate-900 font-bold">{lib.managerName || lib.librarian?.name || 'N/A'}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-900 font-mono font-bold">{lib.managerPhone || lib.librarian?.phone || 'N/A'}</span>
                  </span>
                </div>

                {/* Metrics row */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 font-bold flex items-center gap-2 shadow-xs">
                    <Armchair className="w-3.5 h-3.5 text-[#2781CA]" />
                    {lib._count.seats} Seats Configured ({lib.seatsAvailable || 0} Capacity)
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 font-bold flex items-center gap-2 shadow-xs">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    {lib._count.bookings} Total Bookings
                  </span>
                  <span className="text-slate-400 text-xs font-medium">
                    Added: {new Date(lib.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Link
                  href={`/admin/view/${lib.id}`}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  View KYC & Passbook
                </Link>

                <Link
                  href={`/admin/edit/${lib.id}`}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                  Edit
                </Link>

                {lib.kycStatus !== 'APPROVED' && (
                  <button
                    disabled={isCurrentProcessing}
                    onClick={() => handleApprove(lib.id, lib.name)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
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
                    className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
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
          <div className="p-12 rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-900 font-black text-base">No libraries matched your filter</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Try searching for a different keyword or change status tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
