'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  CreditCard,
  Users,
  Smartphone,
  ShieldCheck,
  HelpCircle,
  Building2,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export interface AdminTicketItem {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  libraryId: string;
  deviceMac: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  resolvedAt: string | Date | null;
  library: {
    id: string;
    name: string;
    city: string | null;
  };
  creator: {
    name: string;
    phone: string | null;
  };
  messages: {
    content: string;
    senderRole: string;
    createdAt: string | Date;
  }[];
  _count: {
    messages: number;
  };
}

const CATEGORY_CONFIG: Record<
  TicketCategory,
  { label: string; icon: typeof Wrench; badgeClass: string }
> = {
  HARDWARE: { label: 'Hardware', icon: Wrench, badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  BILLING_PAYOUTS: { label: 'Billing', icon: CreditCard, badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  STUDENTS_BOOKINGS: { label: 'Bookings', icon: Users, badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  APP_SOFTWARE: { label: 'App Bug', icon: Smartphone, badgeClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  KYC_VERIFICATION: { label: 'KYC & Bank', icon: ShieldCheck, badgeClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  OTHER: { label: 'General', icon: HelpCircle, badgeClass: 'bg-slate-400/10 text-slate-400 border-slate-400/20' },
};

const PRIORITY_BADGES: Record<TicketPriority, { label: string; badgeClass: string }> = {
  URGENT: { label: 'URGENT', badgeClass: 'bg-red-500 text-white font-black animate-pulse shadow-sm shadow-red-500/30' },
  HIGH: { label: 'High', badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold' },
  MEDIUM: { label: 'Medium', badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20 font-medium' },
  LOW: { label: 'Low', badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20 font-medium' },
};

const STATUS_BADGES: Record<TicketStatus, { label: string; badgeClass: string; dotClass: string }> = {
  OPEN: { label: 'Open', badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dotClass: 'bg-emerald-500' },
  IN_PROGRESS: { label: 'In Progress', badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20', dotClass: 'bg-blue-500' },
  WAITING_ON_LIBRARIAN: { label: 'Waiting on Library', badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20', dotClass: 'bg-amber-500' },
  RESOLVED: { label: 'Resolved', badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20', dotClass: 'bg-green-500' },
  CLOSED: { label: 'Closed', badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dotClass: 'bg-slate-400' },
};

export function AdminTicketsClient({ tickets }: { tickets: AdminTicketItem[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TicketCategory>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>('ALL');

  // Stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'OPEN').length;
    const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const waitingLibrarian = tickets.filter((t) => t.status === 'WAITING_ON_LIBRARIAN').length;
    const urgent = tickets.filter((t) => t.priority === 'URGENT' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
    const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    return { total, open, inProgress, waitingLibrarian, urgent, resolved };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesNum = String(t.ticketNumber).includes(q) || `#${t.ticketNumber}`.includes(q);
        const matchesLib = t.library.name.toLowerCase().includes(q);
        const matchesCreator = t.creator.name.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesNum || matchesLib || matchesCreator;
      }
      return true;
    });
  }, [tickets, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <LifeBuoy className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Support Command Center
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-mono font-medium">
                  {tickets.length} Total
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Triage, debug, and resolve B2B operational and hardware issues raised by partner libraries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Needs First Reply</span>
            <AlertCircle className="w-3.5 h-3.5 text-emerald-500" />
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.open}</p>
          <p className="text-[11px] text-emerald-500 font-medium mt-0.5">Status: Open</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>In Engineering Progress</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.inProgress}</p>
          <p className="text-[11px] text-blue-500 font-medium mt-0.5">Active triage</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Urgent Escalations</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          </p>
          <p className="text-2xl font-bold text-red-500 mt-1">{stats.urgent}</p>
          <p className="text-[11px] text-red-400 font-medium mt-0.5">High priority SLA</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Resolved / Closed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.resolved}</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Completed tickets</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket #, library name, staff name, issue description..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Categories</option>
              <option value="HARDWARE">Hardware & IoT</option>
              <option value="BILLING_PAYOUTS">Billing & Payouts</option>
              <option value="STUDENTS_BOOKINGS">Students & Bookings</option>
              <option value="APP_SOFTWARE">App / Software Bug</option>
              <option value="KYC_VERIFICATION">KYC & Bank</option>
              <option value="OTHER">Other Inquiry</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent Only</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Status Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-xs">
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'OPEN', label: 'Open' },
              { key: 'IN_PROGRESS', label: 'In Progress' },
              { key: 'WAITING_ON_LIBRARIAN', label: 'Waiting on Library' },
              { key: 'RESOLVED', label: 'Resolved' },
              { key: 'CLOSED', label: 'Closed' },
            ] as const
          ).map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
        {filteredTickets.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <LifeBuoy className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium">No tickets match your filters.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Try adjusting the category or search keywords above.
            </p>
          </div>
        ) : (
          filteredTickets.map((t) => {
            const cat = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG.OTHER;
            const CatIcon = cat.icon;
            const pri = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.MEDIUM;
            const stat = STATUS_BADGES[t.status] || STATUS_BADGES.OPEN;
            const lastMsg = t.messages[0];

            return (
              <Link
                key={t.id}
                href={`/admin/tickets/${t.id}`}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/40 transition-colors group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      #{t.ticketNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cat.badgeClass}`}
                    >
                      <CatIcon className="w-3 h-3" />
                      {cat.label}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] uppercase tracking-wider border ${pri.badgeClass}`}
                    >
                      {pri.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${stat.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${stat.dotClass}`} />
                      {stat.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {t.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {t.library.name}
                      {t.library.city ? ` (${t.library.city})` : ''}
                    </span>
                    <span>•</span>
                    <span>Staff: {t.creator.name}</span>
                    {t.deviceMac && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                          MAC: {t.deviceMac}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>
                      {new Date(t.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {lastMsg && (
                    <p className="text-xs text-muted-foreground/80 line-clamp-1 italic pt-0.5">
                      Latest: &ldquo;{lastMsg.content}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t._count.messages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
                  >
                    Open Thread
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
