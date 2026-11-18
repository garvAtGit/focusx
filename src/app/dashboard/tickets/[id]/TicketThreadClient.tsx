'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LifeBuoy,
  ArrowLeft,
  Send,
  CheckCircle2,
  Clock,
  Shield,
  ShieldCheck,
  Building2,
  Cpu,
  RefreshCw,
  XCircle,
  AlertCircle,
  Loader2,
  Wrench,
  CreditCard,
  Users,
  Smartphone,
  HelpCircle,
  CornerDownRight,
  Info,
  Bot,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addTicketMessageAction, updateTicketStatusAction, reopenTicketAction } from '@/app/actions/ticket-actions';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import toast from 'react-hot-toast';

export interface TicketDetail {
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
  resolvedAt: Date | string | null;
  closedAt: Date | string | null;
  escalatedAt?: Date | string | null;
  botProcessedAt?: Date | string | null;
  autoResolved?: boolean | null;
  botAction?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  library: {
    id: string;
    name: string;
    locality: string | null;
    city: string | null;
  };
  creator: {
    id: string;
    name: string;
    phone: string | null;
    profilePhotoUrl: string | null;
  };
  messages: {
    id: string;
    senderId: string;
    senderRole: string;
    content: string;
    isInternalNote: boolean;
    createdAt: Date | string;
    sender: {
      id: string;
      name: string;
      role: string;
      profilePhotoUrl: string | null;
    };
  }[];
}

interface TicketThreadClientProps {
  ticket: TicketDetail;
  sessionUserId: string;
  sessionRole: string;
  isAdminView?: boolean;
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
  BOT_REPLIED: {
    label: 'Bot Replied',
    badgeClass: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30 font-semibold',
    dotClass: 'bg-cyan-500',
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
  LOW: { label: 'Low Priority', badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  MEDIUM: { label: 'Medium Priority', badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  HIGH: { label: 'High Priority', badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  URGENT: { label: 'Urgent Priority', badgeClass: 'bg-red-500/15 text-red-500 border-red-500/30 font-bold' },
};

function formatISTDateTime(dInput: Date | string) {
  const d = new Date(dInput);
  return d.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function TicketThreadClient({
  ticket,
  sessionUserId,
  sessionRole,
  isAdminView = false,
}: TicketThreadClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(ticket.messages);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleReopen = async (reason?: string) => {
    setIsReopening(true);
    try {
      const res = await reopenTicketAction(ticket.id, reason);
      if (res.success) {
        setStatus('OPEN');
        toast.success('Ticket reopened for human support.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to reopen ticket.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reopen ticket.');
    } finally {
      setIsReopening(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const res = await addTicketMessageAction(ticket.id, replyText.trim(), false);
      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message as any]);
        setReplyText('');
        if (isAdminView) {
          setStatus('WAITING_ON_LIBRARIAN');
        } else {
          setStatus('IN_PROGRESS');
        }
        toast.success('Reply posted.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to post reply.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post reply.');
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (nextStatus: TicketStatus) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateTicketStatusAction(ticket.id, nextStatus);
      if (res.success && res.status) {
        setStatus(res.status);
        toast.success(`Ticket marked as ${res.status}.`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update ticket status.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const catMeta = CATEGORY_META[ticket.category] || CATEGORY_META.OTHER;
  const statusMeta = STATUS_META[status] || STATUS_META.OPEN;
  const priorityMeta = PRIORITY_META[ticket.priority] || PRIORITY_META.MEDIUM;
  const CatIcon = catMeta.icon;

  const backUrl = isAdminView ? '/admin/tickets' : '/dashboard/tickets';

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={backUrl}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Tickets</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-mono font-bold text-primary">#FX-{ticket.ticketNumber}</span>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          {status !== 'RESOLVED' && status !== 'CLOSED' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('RESOLVED')}
              disabled={isUpdatingStatus}
              className="text-xs font-semibold gap-1.5 text-green-600 border-green-600/30 hover:bg-green-600/10"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark as Resolved
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('IN_PROGRESS')}
              disabled={isUpdatingStatus}
              className="text-xs font-semibold gap-1.5 text-blue-600 border-blue-600/30 hover:bg-blue-600/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reopen Ticket
            </Button>
          )}

          {status !== 'CLOSED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange('CLOSED')}
              disabled={isUpdatingStatus}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Thread + Info Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Discord Thread (3 cols) */}
        <div className="lg:col-span-3 flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden min-h-[600px]">
          {/* Thread Title Bar */}
          <div className="p-4 sm:p-5 border-b border-border bg-muted/20">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                {statusMeta.label}
              </span>

              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${catMeta.color}`}>
                <CatIcon className="w-3.5 h-3.5" />
                {catMeta.label}
              </span>

              <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${priorityMeta.badgeClass}`}>
                {priorityMeta.label}
              </span>

              <span className="text-xs text-muted-foreground ml-auto">
                Opened {formatISTDateTime(ticket.createdAt)}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold font-heading text-foreground">
              {ticket.title}
            </h1>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[650px] focusx-sidebar-scroll">
            {/* Opening Ticket Context Card */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/30 relative">
              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                    {ticket.creator.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-foreground">{ticket.creator.name}</span>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground px-1.5 py-0.2 bg-muted rounded">
                    Ticket Author
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {formatISTDateTime(ticket.createdAt)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </p>

              {ticket.deviceMac && (
                <div className="mt-3 pt-2 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  <span>Linked Scanner / Relay MAC:</span>
                  <code className="bg-background px-2 py-0.5 rounded border border-border font-mono text-[11px] text-foreground font-semibold">
                    {ticket.deviceMac}
                  </code>
                </div>
              )}
            </div>

            {/* Thread Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-card px-3 text-[10px] uppercase font-semibold text-muted-foreground tracking-widest shrink-0">
                Discussion Thread
              </span>
            </div>

            {/* Conversation Messages */}
            {messages.map((msg, index) => {
              if (msg.senderRole === 'SYSTEM') {
                return (
                  <div key={msg.id || index} className="text-center my-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 text-[11px] text-muted-foreground border border-border/60">
                      <Info className="w-3 h-3 text-primary" />
                      {msg.content}
                    </span>
                  </div>
                );
              }

              if (msg.senderRole === 'BOT') {
                return (
                  <div key={msg.id || index} className="my-3.5 rounded-xl border border-cyan-500/30 bg-cyan-950/15 p-4 shadow-sm">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/20">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs text-foreground">FocusX Autonomous Assistant</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30">
                          AI Bot
                        </span>
                        {isAdminView && msg.isInternalNote && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-amber-400" />
                            Internal / shadow
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatISTDateTime(msg.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const isSupport = msg.senderRole === 'SUPPORT' || msg.senderRole === 'ADMIN';
              const isMe = msg.senderId === sessionUserId;

              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-3 items-start ${isSupport ? 'flex-row' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-xs ${
                    isSupport
                      ? 'bg-blue-600 text-white ring-2 ring-blue-500/30'
                      : 'bg-primary/20 text-primary ring-1 ring-primary/30'
                  }`}>
                    {isSupport ? <ShieldCheck className="w-4 h-4" /> : msg.sender?.name?.charAt(0).toUpperCase() || 'L'}
                  </div>

                  {/* Bubble */}
                  <div className={`flex-1 rounded-xl p-4 text-xs sm:text-sm border shadow-2xs ${
                    isSupport
                      ? 'bg-blue-950/20 border-blue-500/30 text-blue-100'
                      : 'bg-card border-border text-foreground'
                  }`}>
                    <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {isSupport ? 'FocusX Support Team' : msg.sender?.name || 'Library Staff'}
                        </span>
                        {isSupport && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px] tracking-wide border border-blue-500/30">
                            <Shield className="w-2.5 h-2.5" /> Official Support
                          </span>
                        )}
                        {!isSupport && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                            Library Staff
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatISTDateTime(msg.createdAt)}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer at Bottom */}
          <div className="p-3 sm:p-4 border-t border-border bg-muted/15">
            {/* Reopen banner if bot replied or resolved */}
            {(status === 'BOT_REPLIED' || (status === 'RESOLVED' && Boolean(ticket.botProcessedAt))) && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Still having this issue or need human administrator review?</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isReopening}
                  onClick={() => handleReopen('Assistance required from human administrator.')}
                  className="text-xs h-7 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
                >
                  {isReopening ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Re-open for Human Admin
                </Button>
              </div>
            )}

            {status === 'CLOSED' ? (
              <div className="p-3 text-center rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>This ticket is closed. Reopen it to continue the discussion.</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isReopening || isUpdatingStatus}
                  onClick={() => {
                    const isBotHandled = Boolean(
                      ticket.autoResolved ||
                      (ticket.botAction && !ticket.botAction.startsWith('SHADOW_') && ticket.botAction !== 'UNPROCESSED')
                    );
                    if (isBotHandled) {
                      handleReopen('Reopened closed bot-handled ticket for human assistance.');
                    } else {
                      handleStatusChange('OPEN');
                    }
                  }}
                  className="text-xs h-7 ml-2"
                >
                  {isReopening ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Reopen Ticket
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isAdminView
                      ? 'Write an official support response as FocusX Engineering...'
                      : 'Reply to FocusX Support... (Press Enter to send, Shift + Enter for new line)'
                  }
                  rows={3}
                  className="text-xs resize-none bg-background focus:ring-primary shadow-inner"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    FocusX Support monitors tickets 24/7. Replies notify both parties immediately.
                  </span>
                  <Button
                    onClick={handleSendReply}
                    disabled={isSending || !replyText.trim()}
                    size="sm"
                    className="font-semibold text-xs gap-1.5 ml-auto"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Metadata Sidebar (1 col) */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-2xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Ticket Details
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Ticket ID</span>
                <span className="font-mono font-bold text-primary">#FX-{ticket.ticketNumber}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">Library</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {ticket.library.name}
                  {ticket.library.locality ? ` (${ticket.library.locality})` : ''}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">Created By</span>
                <span className="font-medium text-foreground">
                  {ticket.creator.name} {ticket.creator.phone ? `(${ticket.creator.phone})` : ''}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border mt-1 ${statusMeta.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                  {statusMeta.label}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">Priority</span>
                <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] border mt-1 ${priorityMeta.badgeClass}`}>
                  {priorityMeta.label}
                </span>
              </div>

              {ticket.deviceMac && (
                <div className="pt-2 border-t border-border">
                  <span className="text-muted-foreground block text-[11px]">Associated Scanner</span>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                      {ticket.deviceMac}
                    </code>
                    <Link
                      href="/dashboard/hardware"
                      className="text-primary hover:underline text-[11px] flex items-center gap-0.5 font-medium"
                    >
                      Inspect <CornerDownRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SLA Commitment Card */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2">
            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>B2B Operations SLA</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              FocusX engineers actively monitor hardware scanners, payments, and student admissions.
              Expected turnaround time is under 2 hours during active library hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
