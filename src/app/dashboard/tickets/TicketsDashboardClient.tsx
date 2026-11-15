'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Wrench,
  CreditCard,
  Users,
  Smartphone,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RaiseTicketModal } from './RaiseTicketModal';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export interface TicketItem {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  libraryId: string;
  creatorId: string;
  deviceMac: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator: {
    name: string;
    phone: string | null;
    profilePhotoUrl: string | null;
  };
  messages: {
    content: string;
    senderRole: string;
    createdAt: Date | string;
  }[];
  _count: {
    messages: number;
  };
}

interface RelayItem {
  id: string;
  nfcTagId: string;
  macAddress: string | null;
  status: string;
}

interface TicketsDashboardClientProps {
  tickets: TicketItem[];
  relays: RelayItem[];
  libraryId: string;
  libraryName: string;
  sessionRole: string;
}

const CATEGORY_META: Record<
  TicketCategory,
  { label: string; icon: typeof Wrench; color: string }
> = {
  HARDWARE: { label: 'Hardware & IoT', icon: Wrench, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  BILLING_PAYOUTS: { label: 'Billing & Payouts', icon: CreditCard, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  STUDENTS_BOOKINGS: { label: 'Students & Bookings', icon: Users, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  APP_SOFTWARE: { label: 'App / Portal Bug', icon: Smartphone, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  KYC_VERIFICATION: { label: 'KYC & Bank', icon: ShieldCheck, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
  OTHER: { label: 'General Inquiry', icon: HelpCircle, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

const STATUS_META: Record<
  TicketStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  OPEN: {
    label: 'Open',
    badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    dotClass: 'bg-emerald-500 animate-pulse',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    dotClass: 'bg-blue-500 animate-pulse',
  },
  WAITING_ON_LIBRARIAN: {
    label: 'Awaiting Your Reply',
    badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30 font-semibold',
    dotClass: 'bg-amber-500',
  },
  RESOLVED: {
    label: 'Resolved',
    badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20',
    dotClass: 'bg-green-500',
  },
  CLOSED: {
    label: 'Closed',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  },
};

const PRIORITY_META: Record<TicketPriority, { label: string; badgeClass: string }> = {
  LOW: { label: 'Low', badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  MEDIUM: { label: 'Medium', badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  HIGH: { label: 'High', badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  URGENT: { label: 'Urgent', badgeClass: 'bg-red-500/15 text-red-500 border-red-500/30 font-bold' },
};

function formatRelativeTime(dateInput: Date | string) {
  const d = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function TicketsDashboardClient({
  tickets,
  relays,
  libraryId,
  libraryName,
}: TicketsDashboardClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Counts
  const counts = useMemo(() => {
    return {
      all: tickets.length,
      open: tickets.filter((t) => t.status === 'OPEN').length,
      inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      awaiting: tickets.filter((t) => t.status === 'WAITING_ON_LIBRARIAN').length,
      resolved: tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
    };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Status Tab filter
      if (selectedStatusTab === 'OPEN' && t.status !== 'OPEN') return false;
      if (selectedStatusTab === 'IN_PROGRESS' && t.status !== 'IN_PROGRESS') return false;
      if (selectedStatusTab === 'WAITING' && t.status !== 'WAITING_ON_LIBRARIAN') return false;
      if (selectedStatusTab === 'RESOLVED' && t.status !== 'RESOLVED' && t.status !== 'CLOSED') return false;

      // Category filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNumber = `#fx-${t.ticketNumber}`.includes(q) || `${t.ticketNumber}`.includes(q);
        const matchDesc = t.description.toLowerCase().includes(q);
        if (!matchTitle && !matchNumber && !matchDesc) return false;
      }

      return true;
    });
  }, [tickets, selectedStatusTab, categoryFilter, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading text-foreground">Support &amp; Tickets</h1>
              <p className="text-xs text-muted-foreground">
                Track past inquiries, report hardware/billing bugs, and chat with FocusX Operations engineers.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="font-semibold text-xs gap-2 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Raise a Ticket
        </Button>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Tickets</p>
          <p className="text-2xl font-bold text-foreground mt-1">{counts.all}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Raised for {libraryName}</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">Active / Open</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{counts.open + counts.inProgress}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Being investigated by engineering</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">Needs Your Reply</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{counts.awaiting}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Support answered with questions</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Resolved</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{counts.resolved}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Successfully closed issues</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border overflow-x-auto pb-1 text-xs font-medium">
          {[
            { id: 'ALL', label: 'All Tickets', count: counts.all },
            { id: 'OPEN', label: 'Open', count: counts.open },
            { id: 'IN_PROGRESS', label: 'In Progress', count: counts.inProgress },
            { id: 'WAITING', label: 'Awaiting Your Reply', count: counts.awaiting },
            { id: 'RESOLVED', label: 'Resolved / Closed', count: counts.resolved },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedStatusTab === tab.id
                  ? 'bg-primary/10 text-primary font-bold border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedStatusTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, #FX-1001, or keyword..."
              className="pl-8 text-xs h-8"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="HARDWARE">🛠️ Hardware &amp; IoT</SelectItem>
                <SelectItem value="BILLING_PAYOUTS">💳 Billing &amp; Payouts</SelectItem>
                <SelectItem value="STUDENTS_BOOKINGS">👥 Students &amp; Bookings</SelectItem>
                <SelectItem value="APP_SOFTWARE">📱 App &amp; Software</SelectItem>
                <SelectItem value="KYC_VERIFICATION">📋 KYC &amp; Bank</SelectItem>
                <SelectItem value="OTHER">❓ General</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priorities</SelectItem>
                <SelectItem value="URGENT">🔴 Urgent</SelectItem>
                <SelectItem value="HIGH">🟠 High</SelectItem>
                <SelectItem value="MEDIUM">🟡 Medium</SelectItem>
                <SelectItem value="LOW">🟢 Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Ticket List */}
      {filteredTickets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-foreground text-base">No support tickets found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery || selectedStatusTab !== 'ALL' || categoryFilter !== 'ALL'
              ? 'No tickets match your active filter criteria. Try resetting filters.'
              : 'You have not raised any support tickets yet. Need help with a scanner, payment, or app setting?'}
          </p>
          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            className="mt-4 text-xs font-semibold gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Raise a Ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTickets.map((ticket) => {
            const cat = CATEGORY_META[ticket.category] || CATEGORY_META.OTHER;
            const status = STATUS_META[ticket.status] || STATUS_META.OPEN;
            const priority = PRIORITY_META[ticket.priority] || PRIORITY_META.MEDIUM;
            const CatIcon = cat.icon;
            const lastMsg = ticket.messages[0];

            return (
              <Link
                key={ticket.id}
                href={`/dashboard/tickets/${ticket.id}`}
                className="block p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-all hover:border-primary/40 hover:shadow-sm group"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-primary">#FX-{ticket.ticketNumber}</span>
                      
                      {/* Status */}
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${status.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                        {status.label}
                      </span>

                      {/* Category */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${cat.color}`}>
                        <CatIcon className="w-3 h-3" />
                        {cat.label}
                      </span>

                      {/* Priority */}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] border ${priority.badgeClass}`}>
                        {priority.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {ticket.title}
                    </h3>

                    {lastMsg && (
                      <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1.5">
                        <span className="font-semibold text-foreground/80">
                          {lastMsg.senderRole === 'SUPPORT' || lastMsg.senderRole === 'ADMIN'
                            ? 'FocusX Support:'
                            : 'You:'}
                        </span>
                        <span>{lastMsg.content}</span>
                      </p>
                    )}
                  </div>

                  {/* Right metadata */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 text-xs text-muted-foreground gap-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(ticket.updatedAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] bg-muted/80 px-2 py-0.5 rounded">
                        <MessageSquare className="w-3 h-3" />
                        {ticket._count.messages}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Raise Ticket Modal */}
      <RaiseTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        libraryId={libraryId}
        libraryName={libraryName}
        relays={relays}
      />
    </div>
  );
}
