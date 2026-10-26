'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Eye,
  Check,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { approveLibrary, rejectLibrary } from '@/app/actions/admin-actions';
import toast from 'react-hot-toast';

export interface PendingLibraryItem {
  id: string;
  name: string;
  address: string;
  city: string | null;
  managerName: string | null;
  managerPhone: string | null;
  seatsAvailable: number | null;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date | string;
}

interface AdminPendingKycClientProps {
  initialLibraries: PendingLibraryItem[];
  initialPendingCount: number;
}

export function AdminPendingKycClient({
  initialLibraries,
  initialPendingCount,
}: AdminPendingKycClientProps) {
  const [libraries, setLibraries] = useState<PendingLibraryItem[]>(initialLibraries);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [processingMap, setProcessingMap] = useState<Record<string, 'APPROVING' | 'REJECTING'>>({});
  const [, startTransition] = useTransition();

  const handleApprove = (id: string, name: string) => {
    // Prevent duplicate triggers if already processing this card
    if (processingMap[id]) return;

    setProcessingMap((prev) => ({ ...prev, [id]: 'APPROVING' }));

    startTransition(async () => {
      try {
        await approveLibrary(id);
        setLibraries((prev) => prev.filter((l) => l.id !== id));
        setPendingCount((prev) => Math.max(0, prev - 1));
        toast.success(`${name} KYC has been approved & activated!`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to approve library');
        setProcessingMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  };

  const handleReject = (id: string, name: string) => {
    // Prevent duplicate triggers if already processing this card
    if (processingMap[id]) return;

    setProcessingMap((prev) => ({ ...prev, [id]: 'REJECTING' }));

    startTransition(async () => {
      try {
        await rejectLibrary(id);
        setLibraries((prev) => prev.filter((l) => l.id !== id));
        setPendingCount((prev) => Math.max(0, prev - 1));
        toast.success(`${name} KYC has been rejected`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to reject library');
        setProcessingMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Pending KYC Approvals</h2>
          {pendingCount > 0 ? (
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
              {pendingCount} Require Action
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              All Cleared
            </span>
          )}
        </div>
        <Link
          href="/admin/libraries"
          className="text-xs font-bold text-[#2781CA] hover:underline flex items-center gap-1 transition-colors"
        >
          View All Libraries <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {libraries.length === 0 ? (
        <div className="p-10 rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-90" />
          <p className="text-slate-900 font-black text-base">All library applications have been reviewed</p>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            New library onboardings and passbook verification submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {libraries.map((lib) => {
            const currentAction = processingMap[lib.id];
            const isProcessing = Boolean(currentAction);

            return (
              <div
                key={lib.id}
                className={`p-6 rounded-[2.5rem] bg-white border border-slate-200/80 hover:border-slate-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all flex flex-col justify-between space-y-5 ${
                  isProcessing ? 'opacity-70 pointer-events-none' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900 text-lg tracking-tight">{lib.name}</h3>
                      <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {lib.address || lib.city || 'Address not provided'}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      Pending KYC
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Manager:</span>{' '}
                      <span className="text-slate-800 font-bold">{lib.managerName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Phone:</span>{' '}
                      <span className="text-slate-800 font-mono font-bold">{lib.managerPhone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Seats:</span>{' '}
                      <span className="text-slate-800 font-bold">{lib.seatsAvailable || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Submitted:</span>{' '}
                      <span className="text-slate-800 font-medium">
                        {new Date(lib.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <Link
                    href={`/admin/view/${lib.id}`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" /> Inspect KYC
                  </Link>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleReject(lib.id, lib.name)}
                    className="py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {currentAction === 'REJECTING' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rejecting...
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5" /> Reject
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApprove(lib.id, lib.name)}
                    className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {currentAction === 'APPROVING' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Approve
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
