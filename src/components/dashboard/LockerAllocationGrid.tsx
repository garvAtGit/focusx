'use client';

import React, { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Search,
  Filter,
  User,
  PauseCircle,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatStandardDate } from '@/lib/date-utils';
import type { LockerAllocationItem, LockerAllocationChartData } from '@/app/actions/seat-actions';

interface LockerAllocationGridProps {
  initialData: LockerAllocationChartData;
  onRefresh?: () => Promise<void>;
}

export default function LockerAllocationGrid({
  initialData,
  onRefresh,
}: LockerAllocationGridProps) {
  const [data, setData] = useState<LockerAllocationChartData>(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'PAUSED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'STANDALONE' | 'ATTACHED'>('ALL');
  const [selectedLocker, setSelectedLocker] = useState<LockerAllocationItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtered lockers memo
  const filteredLockers = useMemo(() => {
    return data.lockers.filter((item) => {
      // 1. Status Filter
      if (statusFilter === 'AVAILABLE' && item.status !== 'AVAILABLE') return false;
      if (statusFilter === 'OCCUPIED' && item.status !== 'OCCUPIED') return false;
      if (statusFilter === 'PAUSED' && item.status !== 'PAUSED') return false;

      // 2. Type Filter
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchSeat = item.seatName ? item.seatName.toLowerCase().includes(query) : false;
        const matchStudent = item.student
          ? item.student.name.toLowerCase().includes(query) ||
            (item.student.uniqueId && item.student.uniqueId.toLowerCase().includes(query)) ||
            (item.student.username && item.student.username.toLowerCase().includes(query))
          : false;

        if (!matchName && !matchSeat && !matchStudent) return false;
      }

      return true;
    });
  }, [data.lockers, statusFilter, typeFilter, searchQuery]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Lockers
            </span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">
            {data.stats.total}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.stats.standaloneCount} Standalone • {data.stats.attachedCount} Attached
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Available
            </span>
            <Unlock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {data.stats.available}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Ready for student allocation
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Occupied
            </span>
            <Lock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {data.stats.occupied - data.stats.paused}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Active in confirmed bookings
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Paused / Held
            </span>
            <PauseCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {data.stats.paused}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Preserved during plan pause
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by locker number, student name, FD ID, or @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 text-sm rounded-xl border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl border border-border shrink-0">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'ALL'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('STANDALONE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'STANDALONE'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Standalone
            </button>
            <button
              onClick={() => setTypeFilter('ATTACHED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'ATTACHED'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Seat Attached
            </button>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {(['ALL', 'AVAILABLE', 'OCCUPIED', 'PAUSED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {status === 'ALL' ? 'All Lockers' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}

          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filteredLockers.length} of {data.lockers.length} lockers
          </span>
        </div>
      </div>

      {/* Visual Locker Grid */}
      {filteredLockers.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/60 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <Lock className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-foreground">No lockers match your filter</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search terms or clearing status filters to see available lockers.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setTypeFilter('ALL');
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {filteredLockers.map((locker) => {
            const isAvailable = locker.status === 'AVAILABLE';
            const isOccupied = locker.status === 'OCCUPIED';
            const isPaused = locker.status === 'PAUSED';
            const isHold = locker.status === 'HOLD';

            return (
              <div
                key={locker.id}
                onClick={() => setSelectedLocker(locker)}
                className={`group cursor-pointer rounded-2xl p-3.5 border transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-between relative overflow-hidden ${
                  isAvailable
                    ? 'bg-emerald-500/[0.03] border-emerald-500/25 hover:border-emerald-500/60'
                    : isPaused
                    ? 'bg-amber-500/[0.04] border-amber-500/30 hover:border-amber-500/70'
                    : isHold
                    ? 'bg-purple-500/[0.04] border-purple-500/30 hover:border-purple-500/70'
                    : 'bg-card border-border hover:border-primary/50'
                }`}
              >
                {/* Header: Name and Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-mono font-black text-sm text-foreground tracking-tight">
                      {locker.name}
                    </span>
                    {isAvailable ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0 mt-1" />
                    ) : isPaused ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/20 shrink-0 mt-1 animate-pulse" />
                    ) : isHold ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/20 shrink-0 mt-1" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/20 shrink-0 mt-1" />
                    )}
                  </div>

                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                    {locker.type === 'STANDALONE' ? 'Standalone' : 'Seat Attached'}
                  </div>
                </div>

                {/* Body Content */}
                <div className="my-3 space-y-1">
                  {isAvailable ? (
                    <div className="py-2 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Available</span>
                    </div>
                  ) : locker.student ? (
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground truncate">
                        {locker.student.name}
                      </div>
                      {locker.student.username ? (
                        <div className="text-[10px] font-mono text-primary truncate">
                          @{locker.student.username}
                        </div>
                      ) : locker.student.uniqueId ? (
                        <div className="text-[10px] font-mono text-muted-foreground truncate">
                          {locker.student.uniqueId}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">Reserved</div>
                  )}
                </div>

                {/* Footer Tag */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                  {isPaused ? (
                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <PauseCircle className="w-3 h-3" /> Paused
                    </span>
                  ) : isAvailable ? (
                    <span className="text-muted-foreground font-semibold">
                      ₹{locker.price}/mo
                    </span>
                  ) : locker.endTime ? (
                    <span className="text-muted-foreground font-medium">
                      Till {new Date(locker.endTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Occupied</span>
                  )}

                  <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors">
                    Details →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Locker Details Modal */}
      <Dialog open={!!selectedLocker} onOpenChange={(open) => !open && setSelectedLocker(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-background border border-border shadow-2xl">
          {selectedLocker && (
            <>
              <DialogHeader className="text-left space-y-1">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    {selectedLocker.name}
                  </DialogTitle>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                      selectedLocker.status === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : selectedLocker.status === 'PAUSED'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    {selectedLocker.status}
                  </span>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  {selectedLocker.type === 'STANDALONE'
                    ? 'Independent Standalone Locker Unit'
                    : `Seat-Attached Locker Unit bound to ${selectedLocker.seatName || 'seat'}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Paused alert if paused */}
                {selectedLocker.status === 'PAUSED' && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <PauseCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Membership Paused: </span>
                      This student's plan is currently suspended. Per library policy, their locker assignment remains preserved and will not be reallocated.
                    </div>
                  </div>
                )}

                {/* Assignment Details */}
                {selectedLocker.student ? (
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                    <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      Assigned Member
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-bold text-foreground">
                          {selectedLocker.student.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {selectedLocker.student.username && (
                            <span className="text-xs font-mono font-semibold text-primary">
                              @{selectedLocker.student.username}
                            </span>
                          )}
                          {selectedLocker.student.uniqueId && (
                            <span className="text-xs font-mono text-muted-foreground">
                              {selectedLocker.student.uniqueId}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedLocker.student.phone && (
                        <div className="text-right text-xs font-mono text-muted-foreground">
                          {selectedLocker.student.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>This locker is currently available and ready to assign to any member.</span>
                  </div>
                )}

                {/* Plan & Dates */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Pricing Rate
                    </div>
                    <div className="font-bold text-foreground text-sm mt-0.5">
                      ₹{selectedLocker.price}/mo
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Associated Seat
                    </div>
                    <div className="font-bold text-foreground text-sm mt-0.5">
                      {selectedLocker.seatName || 'None (Standalone)'}
                    </div>
                  </div>

                  {selectedLocker.planName && (
                    <div className="p-3 rounded-xl bg-muted/30 border border-border">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Active Plan
                      </div>
                      <div className="font-bold text-foreground text-sm mt-0.5 truncate">
                        {selectedLocker.planName}
                      </div>
                    </div>
                  )}

                  {selectedLocker.endTime && (
                    <div className="p-3 rounded-xl bg-muted/30 border border-border">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Reservation Valid Till
                      </div>
                      <div className="font-bold text-foreground text-sm mt-0.5">
                        {formatStandardDate(new Date(selectedLocker.endTime))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button size="sm" variant="outline" onClick={() => setSelectedLocker(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

