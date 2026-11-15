'use client';

import { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Eye,
  User,
  Phone,
  Mail,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  Smartphone,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { getBroadcastRecipientsAction } from '@/app/actions/notification-actions';

interface RecipientItem {
  id: string;
  studentId: string;
  name: string;
  phone: string | null;
  email: string | null;
  isRead: boolean;
  readAt: string | Date | null;
  deliveredAt: string | Date;
}

interface BroadcastInfo {
  id: string;
  title: string;
  message: string;
  type: string;
  audienceType: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: string | Date;
  readCount?: number;
  readRate?: number;
}

interface BroadcastDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcast: BroadcastInfo | null;
}

export function BroadcastDeliveryModal({
  isOpen,
  onClose,
  broadcast,
}: BroadcastDeliveryModalProps) {
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'READ' | 'UNREAD'>('ALL');

  useEffect(() => {
    if (!isOpen || !broadcast) {
      setRecipients([]);
      setError(null);
      setSearchQuery('');
      setFilterMode('ALL');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getBroadcastRecipientsAction(broadcast.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.recipients) {
          setRecipients(res.recipients as any);
        } else {
          setError(res.error || 'Failed to load recipients');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || 'Network error fetching delivery receipts');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, broadcast]);

  if (!isOpen || !broadcast) return null;

  const totalRecipients = recipients.length || broadcast.sentCount;
  const readCount = recipients.filter((r) => r.isRead).length;
  const unreadCount = Math.max(0, totalRecipients - readCount);
  const computedRate = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0;

  const filteredRecipients = recipients.filter((r) => {
    const matchesQuery =
      searchQuery.trim() === '' ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.phone && r.phone.includes(searchQuery)) ||
      (r.email && r.email.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesQuery) return false;

    if (filterMode === 'READ') return r.isRead;
    if (filterMode === 'UNREAD') return !r.isRead;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between bg-muted/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {broadcast.type}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(broadcast.createdAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground mt-1 line-clamp-1">
              {broadcast.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 max-w-xl">
              {broadcast.message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Analytics Top Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-card border-b border-border">
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Total Targets
            </div>
            <div className="text-xl font-black text-foreground mt-0.5">
              {broadcast.totalTargets}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {broadcast.sentCount} delivered successfully
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Read by Students
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5" />
              {readCount}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Confirmed opened in app
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Read Rate
            </div>
            <div className="text-xl font-black text-primary mt-0.5 flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5" />
              {computedRate}%
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${computedRate}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Unread / Pending
            </div>
            <div className="text-xl font-black text-amber-500 mt-0.5">
              {unreadCount}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Awaiting student open
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-5 py-3 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/10">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({recipients.length})
            </button>
            <button
              onClick={() => setFilterMode('READ')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'READ'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Read ({readCount})
            </button>
            <button
              onClick={() => setFilterMode('UNREAD')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterMode === 'UNREAD'
                  ? 'bg-amber-500 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {/* Recipient Details Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Fetching real-time delivery and read receipts...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-destructive flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              {searchQuery ? 'No recipients matching your search.' : 'No individual recipient receipts found.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecipients.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/60 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {r.name ? r.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-xs">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        {r.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {r.phone}
                          </span>
                        )}
                        {r.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {r.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {r.isRead ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Read
                        </span>
                        {r.readAt && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(r.readAt).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour: '2-digit',
                              minute: '2-digit',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                          <Clock className="w-3 h-3" />
                          Delivered (Unread)
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Sent{' '}
                          {new Date(r.deliveredAt).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <span>Telemetry verified via mobile app in-app read receipts & push delivery.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
