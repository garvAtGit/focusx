'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Send,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
  Filter,
  Check,
  Building2,
  UserCheck,
  Info,
  ShieldAlert,
  Activity,
  Bell,
  Smartphone,
  Radio,
  RotateCcw,
  Server,
  Zap,
} from 'lucide-react';
import {
  searchNotificationRecipientsAction,
  getAdminLibrariesAction,
  sendAdminBroadcastAction,
  getAdminBroadcastHistoryAction,
  cancelScheduledBroadcastAction,
  retryBroadcastAction,
  getNotificationSystemHealthAction,
} from '@/app/actions/notification-actions';
import { BrowserPushSettings } from '@/components/notifications/BrowserPushSettings';
import type { BroadcastAudienceType } from '@/lib/notification-shared';

interface LibraryOption {
  id: string;
  name: string;
  city: string | null;
  address: string;
}

interface RecipientUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  uniqueId: string | null;
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  message: string;
  type: string;
  audienceType: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  status: string;
  errorMessage: string | null;
  scheduledFor?: string | Date | null;
  isCancelled?: boolean;
  createdAt: string | Date;
  sender?: {
    name: string;
    email: string | null;
  };
}

export default function AdminNotificationsView({
  initialHistory,
  initialLibraries,
}: {
  initialHistory: BroadcastHistoryItem[];
  initialLibraries: LibraryOption[];
}) {
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'monitoring' | 'push-settings'>('compose');
  const [isPending, startTransition] = useTransition();

  // Monitoring State
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('INFO');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [audienceType, setAudienceType] = useState<BroadcastAudienceType>('ALL');

  // Scheduling State
  const [sendMode, setSendMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const localTimeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  // Library & Recipient Filter State
  const [libraries] = useState<LibraryOption[]>(initialLibraries);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientUser[]>([]);

  // Recipient Search Modal / Drawer State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRole, setSearchRole] = useState<'ALL' | 'STUDENT' | 'LIBRARIAN' | 'ADMIN'>('ALL');
  const [searchLibraryId, setSearchLibraryId] = useState<string>('');
  const [searchResults, setSearchResults] = useState<RecipientUser[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Confirmation Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Broadcast History State
  const [history, setHistory] = useState<BroadcastHistoryItem[]>(initialHistory);
  const [historyPage, setHistoryPage] = useState(1);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);

  // Trigger search when query or filters change
  const executeSearch = async (page = 1) => {
    setIsSearching(true);
    try {
      const res = await searchNotificationRecipientsAction({
        query: searchQuery,
        role: searchRole,
        libraryId: searchLibraryId || undefined,
        page,
        limit: 10,
      });

      if (res.success && res.data) {
        setSearchResults(res.data.users);
        setSearchTotalCount(res.data.totalCount);
        setSearchPage(page);
      } else {
        setSearchResults([]);
        setSearchTotalCount(0);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (audienceType.startsWith('CUSTOM')) {
      executeSearch(1);
    }
  }, [searchRole, searchLibraryId, audienceType]);

  // Recipient selection handlers
  const toggleSelectRecipient = (user: RecipientUser) => {
    setSelectedRecipients((prev) => {
      const exists = prev.some((r) => r.id === user.id);
      if (exists) {
        return prev.filter((r) => r.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const removeRecipient = (userId: string) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.id !== userId));
  };

  const clearAllRecipients = () => {
    setSelectedRecipients([]);
  };

  const toggleLibrarySelection = (libId: string) => {
    setSelectedLibraryIds((prev) =>
      prev.includes(libId) ? prev.filter((id) => id !== libId) : [...prev, libId]
    );
  };

  // Refresh Broadcast History
  const refreshHistory = async (page = 1) => {
    setIsRefreshingHistory(true);
    try {
      const res = await getAdminBroadcastHistoryAction(page, 20);
      if (res.success && res.data) {
        setHistory(res.data.broadcasts);
        setHistoryPage(page);
      }
    } finally {
      setIsRefreshingHistory(false);
    }
  };

  // Submit Broadcast Handler
  const handleSendBroadcast = async () => {
    setStatusMessage(null);
    setIsConfirmOpen(false);

    if (sendMode === 'SCHEDULE') {
      if (!scheduledDateTime || new Date(scheduledDateTime).getTime() <= Date.now()) {
        setStatusMessage({
          type: 'error',
          text: 'Please select a future date and time for scheduled broadcast.',
        });
        return;
      }
    }

    // Generate unique client idempotency key per submission to prevent duplicates
    const idempotencyKey = `bcast_req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    startTransition(async () => {
      try {
        const res = await sendAdminBroadcastAction({
          title,
          message,
          type,
          actionLabel: actionLabel.trim() || null,
          actionUrl: actionUrl.trim() || null,
          audienceType,
          targetLibraryIds: audienceType === 'LIBRARY_STUDENTS' ? selectedLibraryIds : undefined,
          recipientIds: audienceType.startsWith('CUSTOM')
            ? selectedRecipients.map((r) => r.id)
            : undefined,
          idempotencyKey,
          scheduledFor: sendMode === 'SCHEDULE' ? new Date(scheduledDateTime).toISOString() : undefined,
        });

        if (res.success && res.data) {
          const { sentCount, failedCount, totalTargets, isScheduled } = res.data;

          if (isScheduled) {
            setStatusMessage({
              type: 'success',
              text: `Broadcast scheduled successfully for ${new Date(scheduledDateTime).toLocaleString()} (${localTimeZone})!`,
            });
          } else if (failedCount === 0) {
            setStatusMessage({
              type: 'success',
              text: `Broadcast delivered successfully to all ${sentCount} recipients!`,
            });
          } else {
            setStatusMessage({
              type: 'warning',
              text: `Broadcast completed with partial failures: ${sentCount} succeeded, ${failedCount} failed out of ${totalTargets}.`,
            });
          }

          // Reset form on success
          setTitle('');
          setMessage('');
          setActionLabel('');
          setActionUrl('');
          setSelectedRecipients([]);
          setSelectedLibraryIds([]);
          setScheduledDateTime('');
          setSendMode('NOW');
          refreshHistory(1);
        } else {
          setStatusMessage({
            type: 'error',
            text: res.error || 'Failed to dispatch broadcast notification.',
          });
        }
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'A network error occurred while submitting.',
        });
      }
    });
  };

  const handleCancelBroadcast = async (broadcastId: string) => {
    try {
      const res = await cancelScheduledBroadcastAction(broadcastId);
      if (res.success) {
        setHistory((prev) =>
          prev.map((item) =>
            item.id === broadcastId
              ? { ...item, status: 'CANCELLED', isCancelled: true }
              : item
          )
        );
        setStatusMessage({
          type: 'success',
          text: 'Scheduled broadcast successfully cancelled.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to cancel scheduled broadcast.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error cancelling broadcast.',
      });
    }
  };

  // Load system health data
  const loadHealthData = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await getNotificationSystemHealthAction();
      if (res.success && res.data) {
        setHealthData(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load health data:", err);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monitoring') {
      loadHealthData();
    }
  }, [activeTab]);

  // Retry an interrupted or failed broadcast
  const handleRetryBroadcast = async (broadcastId: string) => {
    startTransition(async () => {
      try {
        const res = await retryBroadcastAction(broadcastId);
        if (res.success && res.data) {
          setStatusMessage({
            type: 'success',
            text: `Broadcast resumed! ${res.data.sentCount} delivered (${res.data.failedCount} failed) out of ${res.data.totalTargets} total targets.`,
          });
          refreshHistory(historyPage);
          loadHealthData();
        } else {
          setStatusMessage({
            type: 'error',
            text: res.error || 'Failed to resume broadcast.',
          });
        }
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'Error occurred while retrying broadcast.',
        });
      }
    });
  };

  // Recipient stats for mixed selection preview
  const studentCount = selectedRecipients.filter((r) => r.role === 'STUDENT').length;
  const librarianCount = selectedRecipients.filter((r) => r.role === 'LIBRARIAN').length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">
            Notification Center
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Durable, multi-role broadcast messaging across students and librarians.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-muted p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs md:text-sm transition-all ${
              activeTab === 'compose'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Compose Broadcast
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              refreshHistory(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs md:text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> History
          </button>
          <button
            onClick={() => {
              setActiveTab('monitoring');
              loadHealthData();
            }}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs md:text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'monitoring'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Monitoring & Health
          </button>
          <button
            onClick={() => setActiveTab('push-settings')}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs md:text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'push-settings'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Push Settings
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : statusMessage.type === 'warning'
              ? 'bg-warning/10 border-warning/30 text-warning'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
            {statusMessage.type === 'warning' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            {statusMessage.type === 'error' && <ShieldAlert className="w-5 h-5 flex-shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-sm opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: COMPOSE BROADCAST */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Form (8 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" /> Compose Message
              </h2>

              {/* Title Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-sm font-medium">
                  <label htmlFor="notif-title">Title</label>
                  <span className={`text-xs ${title.length > 200 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {title.length}/200
                  </span>
                </div>
                <input
                  id="notif-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled System Maintenance"
                  maxLength={200}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              {/* Category / Type Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['INFO', 'WARNING', 'SUCCESS', 'EXPIRING'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setType(cat)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      type === cat
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Message Body */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-sm font-medium">
                  <label htmlFor="notif-msg">Message Body</label>
                  <span className={`text-xs ${message.length > 2000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {message.length}/2000
                  </span>
                </div>
                <textarea
                  id="notif-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type the broadcast message clearly and concisely..."
                  maxLength={2000}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-y"
                />
              </div>

              {/* Optional Action URL & Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="notif-action-label">
                    Action Label (Optional)
                  </label>
                  <input
                    id="notif-action-label"
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="e.g. View Booking"
                    maxLength={60}
                    className="w-full px-4 py-2 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="notif-action-url">
                    Internal Route URL (Optional)
                  </label>
                  <input
                    id="notif-action-url"
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="e.g. /student/dashboard"
                    maxLength={500}
                    className="w-full px-4 py-2 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  {actionUrl && !actionUrl.startsWith('/') && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> URL must be an internal path starting with &apos;/&apos;
                    </p>
                  )}
                </div>
              </div>

              {/* Target Audience Mode */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Target Audience
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {[
                    { id: 'ALL', label: 'All Students & Librarians', desc: 'Universal platform broadcast' },
                    { id: 'ALL_STUDENTS', label: 'All Students', desc: 'Every registered student' },
                    { id: 'ALL_LIBRARIANS', label: 'All Librarians', desc: 'Every registered librarian' },
                    { id: 'LIBRARY_STUDENTS', label: 'Students of Library', desc: 'Active/past bookings at selected libraries' },
                    { id: 'CUSTOM_MIXED', label: 'Custom (Students & Librarians)', desc: 'Hand-picked mixed recipients' },
                    { id: 'CUSTOM_STUDENTS', label: 'Custom Students', desc: 'Specific students only' },
                    { id: 'CUSTOM_LIBRARIANS', label: 'Custom Librarians', desc: 'Specific librarians only' },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => {
                        setAudienceType(aud.id as BroadcastAudienceType);
                        if (aud.id === 'CUSTOM_STUDENTS') setSearchRole('STUDENT');
                        else if (aud.id === 'CUSTOM_LIBRARIANS') setSearchRole('LIBRARIAN');
                        else setSearchRole('ALL');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        audienceType === aud.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      <div className="font-semibold text-sm flex items-center justify-between">
                        <span>{aud.label}</span>
                        {audienceType === aud.id && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{aud.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Library Selection (for LIBRARY_STUDENTS) */}
              {audienceType === 'LIBRARY_STUDENTS' && (
                <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" /> Select Target Libraries ({selectedLibraryIds.length})
                    </span>
                    {selectedLibraryIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedLibraryIds([])}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                    {libraries.map((lib) => (
                      <label
                        key={lib.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLibraryIds.includes(lib.id)}
                          onChange={() => toggleLibrarySelection(lib.id)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-input"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-foreground">{lib.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">({lib.city || lib.address})</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recipient Selection & Preview Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Custom Recipient Search & Tray */}
            {audienceType.startsWith('CUSTOM') && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" /> Select Specific Recipients
                  </h3>
                  <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-full">
                    {selectedRecipients.length} Selected
                  </span>
                </div>

                {/* Selected Recipients Chips */}
                {selectedRecipients.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Composition: {studentCount} Students, {librarianCount} Librarians
                      </span>
                      <button
                        type="button"
                        onClick={clearAllRecipients}
                        className="text-destructive hover:underline"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-muted/40 rounded-xl border border-border">
                      {selectedRecipients.map((user) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border border-border text-xs rounded-full font-medium shadow-2xs"
                        >
                          <span className="truncate max-w-[120px]">{user.name}</span>
                          <span
                            className={`text-[10px] uppercase px-1 rounded font-bold ${
                              user.role === 'LIBRARIAN'
                                ? 'bg-secondary text-secondary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {user.role[0]}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeRecipient(user.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Bar & Role Filter */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && executeSearch(1)}
                        placeholder="Search name, email, phone..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => executeSearch(1)}
                      disabled={isSearching}
                      className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
                    >
                      {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                    </button>
                  </div>

                  {/* Role filter buttons (for CUSTOM_MIXED) */}
                  {audienceType === 'CUSTOM_MIXED' && (
                    <div className="flex gap-1.5 text-xs">
                      {(['ALL', 'STUDENT', 'LIBRARIAN', 'ADMIN'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSearchRole(r)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                            searchRole === r
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {r === 'ALL' ? 'All Roles' : r === 'STUDENT' ? 'Students' : r === 'LIBRARIAN' ? 'Librarians' : 'Admins'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Results Paginated List */}
                <div className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Searching users...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No matching users found. Try adjusting your search query.
                    </div>
                  ) : (
                    searchResults.map((user) => {
                      const isSelected = selectedRecipients.some((r) => r.id === user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => toggleSelectRecipient(user)}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-input"
                            />
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <span>{user.name}</span>
                                <span
                                  className={`text-[9px] uppercase px-1 py-0.2 rounded font-bold ${
                                    user.role === 'LIBRARIAN'
                                      ? 'bg-secondary text-secondary-foreground'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {user.role}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {user.email || user.phone || user.uniqueId || 'No identifier'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pagination Controls */}
                {searchTotalCount > 10 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      Page {searchPage} of {Math.ceil(searchTotalCount / 10)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={searchPage <= 1 || isSearching}
                        onClick={() => executeSearch(searchPage - 1)}
                        className="px-2 py-1 bg-muted rounded disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={searchPage >= Math.ceil(searchTotalCount / 10) || isSearching}
                        onClick={() => executeSearch(searchPage + 1)}
                        className="px-2 py-1 bg-muted rounded disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Broadcast Summary & Submission Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" /> Delivery Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Audience Mode</span>
                  <span className="font-semibold">{audienceType}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-bold uppercase text-primary">{type}</span>
                </div>
                {audienceType.startsWith('CUSTOM') && (
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Selected Recipients</span>
                    <span className="font-bold">{selectedRecipients.length} Users</span>
                  </div>
                )}
                {audienceType === 'LIBRARY_STUDENTS' && (
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Target Libraries</span>
                    <span className="font-bold">{selectedLibraryIds.length} Selected</span>
                  </div>
                )}
              </div>

              {/* Send Now vs Schedule Later */}
              <div className="pt-2 border-t border-border space-y-3">
                <label className="text-xs font-semibold text-foreground block">
                  Dispatch Schedule
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendMode('NOW')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      sendMode === 'NOW'
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Send Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode('SCHEDULE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      sendMode === 'SCHEDULE'
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" /> Schedule Later
                  </button>
                </div>

                {sendMode === 'SCHEDULE' && (
                  <div className="space-y-2 bg-muted/40 p-3 rounded-xl border border-border">
                    <label className="text-[11px] font-semibold text-muted-foreground block">
                      Target Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Timezone: <span className="font-semibold text-foreground">{localTimeZone}</span></span>
                      <span>(Saved in UTC)</span>
                    </div>

                    <div className="text-[10px] text-amber-600 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 mt-1">
                      <span className="font-semibold">Note:</span> Background worker runs hourly on Vercel (`0 * * * *`). Scheduled notifications dispatch at the earliest cron pass after the selected threshold.
                    </div>

                    {scheduledDateTime && (
                      <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-lg text-[11px] space-y-1">
                        <div className="font-bold text-primary flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Scheduled Preview
                        </div>
                        <div className="text-muted-foreground">
                          Will dispatch on: <strong className="text-foreground">{new Date(scheduledDateTime).toLocaleString()}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={
                  !title.trim() ||
                  !message.trim() ||
                  isPending ||
                  (sendMode === 'SCHEDULE' && !scheduledDateTime) ||
                  (audienceType.startsWith('CUSTOM') && selectedRecipients.length === 0) ||
                  (audienceType === 'LIBRARY_STUDENTS' && selectedLibraryIds.length === 0) ||
                  (actionUrl.trim().length > 0 && !actionUrl.trim().startsWith('/'))
                }
                onClick={() => setIsConfirmOpen(true)}
                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> {sendMode === 'SCHEDULE' ? 'Scheduling Broadcast...' : 'Dispatching Broadcast...'}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> {sendMode === 'SCHEDULE' ? 'Schedule Broadcast' : 'Review & Send Broadcast'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BROADCAST HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Past Broadcast Notifications
            </h2>
            <button
              onClick={() => refreshHistory(historyPage)}
              disabled={isRefreshingHistory}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Title & Details</th>
                  <th className="px-6 py-4">Audience</th>
                  <th className="px-6 py-4">Targets</th>
                  <th className="px-6 py-4">Delivered</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Timing</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No broadcasts recorded yet.
                    </td>
                  </tr>
                ) : (
                  history.map((bcast) => (
                    <tr key={bcast.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground text-sm">{bcast.title}</div>
                        <div className="text-muted-foreground text-xs line-clamp-1 max-w-sm mt-0.5">
                          {bcast.message}
                        </div>
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {bcast.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {bcast.audienceType}
                      </td>
                      <td className="px-6 py-4 font-bold">{bcast.totalTargets}</td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {bcast.sentCount}{' '}
                        {bcast.failedCount > 0 && (
                          <span className="text-destructive font-normal">
                            ({bcast.failedCount} failed)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                            bcast.status === 'COMPLETED'
                              ? 'bg-success/10 text-success border border-success/20'
                              : bcast.status === 'SCHEDULED'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : bcast.status === 'CANCELLED'
                              ? 'bg-muted text-muted-foreground border border-border'
                              : bcast.status === 'PARTIALLY_FAILED'
                              ? 'bg-warning/10 text-warning border border-warning/20'
                              : bcast.status === 'PROCESSING'
                              ? 'bg-primary/10 text-primary border border-primary/20 animate-pulse'
                              : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}
                        >
                          {bcast.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {bcast.scheduledFor ? (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-amber-500">Scheduled:</div>
                            {new Date(bcast.scheduledFor).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </div>
                        ) : (
                          <div>
                            {new Date(bcast.createdAt).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {bcast.status === 'SCHEDULED' && !bcast.isCancelled ? (
                          <button
                            type="button"
                            onClick={() => handleCancelBroadcast(bcast.id)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Cancel
                          </button>
                        ) : (bcast.status === 'FAILED' || bcast.status === 'PARTIALLY_FAILED') ? (
                          <button
                            type="button"
                            onClick={() => handleRetryBroadcast(bcast.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Delivery Lifecycle Reference Guide */}
          <div className="bg-card border border-border rounded-xl p-4 text-xs space-y-2">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <Info className="w-4 h-4 text-primary" /> Delivery Stage Reference & Clarification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1 text-muted-foreground">
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                <span className="font-bold text-foreground block">1. Database Stored</span>
                Notification record created in PostgreSQL.
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                <span className="font-bold text-foreground block">2. Recipient Fanout</span>
                Audience manifest generated and mapped.
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                <span className="font-bold text-foreground block">3. Realtime Dispatched</span>
                Broadcast to Supabase private user channel.
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                <span className="font-bold text-foreground block">4. Push Provider Accepted</span>
                Accepted by Google/Apple/Mozilla push servers (does not guarantee device wake).
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                <span className="font-bold text-foreground block">5. Inbox Read</span>
                Confirmed opened or marked as read by recipient.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM MONITORING & HEALTH */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Notification System Health & Backlog
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time visibility into outbox processing, push delivery queue backlogs, and external provider statuses.
              </p>
            </div>
            <button
              onClick={loadHealthData}
              disabled={isLoadingHealth}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted flex items-center gap-1.5 transition-colors w-fit"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
              Refresh Metrics
            </button>
          </div>

          {isLoadingHealth && !healthData ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Loading system metrics...
            </div>
          ) : healthData ? (
            <div className="space-y-6">
              {/* Top Overview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 space-y-1 shadow-xs">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Radio className="w-3.5 h-3.5 text-primary" /> Realtime Outbox Backlog
                  </span>
                  <div className="text-2xl font-bold text-foreground">
                    {healthData.realtimeOutbox.pendingBacklog}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Unpublished events waiting in PostgreSQL outbox
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 space-y-1 shadow-xs">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-primary" /> Push Queue Backlog
                  </span>
                  <div className="text-2xl font-bold text-foreground">
                    {healthData.pushQueue.pendingBacklog}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {healthData.pushQueue.processingCount} currently in-flight
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 space-y-1 shadow-xs">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-500" /> Active Push Devices
                  </span>
                  <div className="text-2xl font-bold text-foreground">
                    {healthData.subscriptions.activeDevices}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {healthData.subscriptions.totalDevices} total registered devices
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 space-y-1 shadow-xs">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Failed Deliveries
                  </span>
                  <div className="text-2xl font-bold text-foreground">
                    {healthData.pushQueue.failedCount + healthData.pushQueue.permanentFailureCount}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {healthData.pushQueue.permanentFailureCount} unsubscribed (410 Gone)
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Broadcast Job Metrics */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Broadcast Operations Summary
                  </h3>
                  <div className="divide-y divide-border text-xs">
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Total Broadcast Jobs</span>
                      <span className="font-bold">{healthData.broadcasts.total}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Completed Successfully</span>
                      <span className="font-bold text-emerald-600">{healthData.broadcasts.completed}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Pending / Scheduled</span>
                      <span className="font-bold text-amber-600">{healthData.broadcasts.pending}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Currently Processing</span>
                      <span className="font-bold text-primary">{healthData.broadcasts.processing}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Failed / Stalled</span>
                      <span className="font-bold text-destructive">{healthData.broadcasts.failed}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Cancelled Prior to Dispatch</span>
                      <span className="font-bold text-muted-foreground">{healthData.broadcasts.cancelled}</span>
                    </div>
                  </div>
                </div>

                {/* Infrastructure Provider Status */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" /> Infrastructure Providers Status
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground">VAPID Push Credentials</div>
                        <div className="text-muted-foreground text-[11px]">
                          RFC 8292 application server key pair for Web Push
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                        healthData.providers.vapidConfigured
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}>
                        {healthData.providers.vapidConfigured ? 'CONFIGURED' : 'MISSING'}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground">Supabase Realtime</div>
                        <div className="text-muted-foreground text-[11px]">
                          Private channel WebSocket subscriptions & broadcast publishing
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                        healthData.providers.supabaseRealtimeConfigured
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}>
                        {healthData.providers.supabaseRealtimeConfigured ? 'CONNECTED' : 'MISSING KEYS'}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground">Vercel Background Cron</div>
                        <div className="text-muted-foreground text-[11px]">
                          Hourly scheduled processing (`0 * * * *`)
                        </div>
                      </div>
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                        HOURLY SCHEDULE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Health metrics unavailable. Click Refresh Metrics to retry.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PUSH PREFERENCES */}
      {activeTab === 'push-settings' && (
        <div className="max-w-2xl mx-auto py-4">
          <BrowserPushSettings />
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Confirm Broadcast</h3>
                <p className="text-xs text-muted-foreground">Please review targeting parameters</p>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-xl space-y-2 text-xs border border-border">
              <div>
                <span className="text-muted-foreground">Title: </span>
                <span className="font-bold text-foreground">{title}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Audience: </span>
                <span className="font-bold text-foreground">{audienceType}</span>
              </div>
              {audienceType.startsWith('CUSTOM') && (
                <div>
                  <span className="text-muted-foreground">Recipients: </span>
                  <span className="font-bold text-foreground">
                    {selectedRecipients.length} ({studentCount} Students, {librarianCount} Librarians)
                  </span>
                </div>
              )}
              {audienceType === 'LIBRARY_STUDENTS' && (
                <div>
                  <span className="text-muted-foreground">Libraries: </span>
                  <span className="font-bold text-foreground">{selectedLibraryIds.length} Selected</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Notifications will be durably created in PostgreSQL and dispatched to each recipient&apos;s
              inbox with deduplication guarantees.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-border font-medium text-xs hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={isPending}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-xs shadow hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isPending ? 'Sending...' : 'Confirm & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
