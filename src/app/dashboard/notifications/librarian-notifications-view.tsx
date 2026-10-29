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
  Check,
  Building2,
  UserCheck,
  Info,
  ShieldAlert,
  UserMinus,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import {
  searchLibrarianStudentsAction,
  getLibraryAudienceCountsAction,
  sendLibrarianBroadcastAction,
  getLibrarianBroadcastHistoryAction,
  retryBroadcastAction,
  cancelScheduledBroadcastAction,
} from '@/app/actions/notification-actions';
import { BrowserPushSettings } from '@/components/notifications/BrowserPushSettings';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { openWhatsAppChat, formatNotificationForWhatsApp } from '@/lib/whatsapp';

interface LibraryOption {
  id: string;
  name: string;
  city: string | null;
  address: string;
}

interface StudentRecipient {
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

export default function LibrarianNotificationsView({
  libraries,
  initialLibraryId,
  initialHistory,
}: {
  libraries: LibraryOption[];
  initialLibraryId: string;
  initialHistory: BroadcastHistoryItem[];
}) {
  const [selectedLibraryId, setSelectedLibraryId] = useState(initialLibraryId);
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'settings'>('compose');
  const [isPending, startTransition] = useTransition();

  // Audience counts
  const [audienceCounts, setAudienceCounts] = useState<{
    allStudentsCount: number;
    checkedInCount: number;
  }>({ allStudentsCount: 0, checkedInCount: 0 });

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('INFO');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [audienceMode, setAudienceMode] = useState<
    'INDIVIDUAL_STUDENT' | 'SELECTED_STUDENTS' | 'ALL_LIBRARY_STUDENTS' | 'CURRENTLY_CHECKED_IN'
  >('ALL_LIBRARY_STUDENTS');

  // Scheduling State
  const [sendMode, setSendMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const localTimeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  const [alsoSendWhatsApp, setAlsoSendWhatsApp] = useState(false);

  // Recipient Selection State
  const [selectedStudents, setSelectedStudents] = useState<StudentRecipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentRecipient[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Status & Confirmation
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // History State
  const [history, setHistory] = useState<BroadcastHistoryItem[]>(initialHistory);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);

  // Fetch counts when library changes
  const fetchCounts = async (libId: string) => {
    try {
      const res = await getLibraryAudienceCountsAction(libId);
      if (res.success && res.data) {
        setAudienceCounts(res.data);
      }
    } catch {
      // Non-fatal
    }
  };

  // Search students within selected library
  const executeSearch = async (page = 1) => {
    if (!selectedLibraryId) return;
    setIsSearching(true);
    try {
      const res = await searchLibrarianStudentsAction({
        libraryId: selectedLibraryId,
        query: searchQuery,
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

  // Refresh history for selected library
  const refreshHistory = async () => {
    if (!selectedLibraryId) return;
    setIsRefreshingHistory(true);
    try {
      const res = await getLibrarianBroadcastHistoryAction(selectedLibraryId, 1, 20);
      if (res.success && res.data) {
        setHistory(res.data.broadcasts);
      }
    } finally {
      setIsRefreshingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedLibraryId) {
      fetchCounts(selectedLibraryId);
      refreshHistory();
      setSelectedStudents([]);
      if (audienceMode === 'INDIVIDUAL_STUDENT' || audienceMode === 'SELECTED_STUDENTS') {
        executeSearch(1);
      }
    }
  }, [selectedLibraryId]);

  useEffect(() => {
    if (audienceMode === 'INDIVIDUAL_STUDENT' || audienceMode === 'SELECTED_STUDENTS') {
      executeSearch(1);
    }
  }, [audienceMode]);

  // Recipient toggles
  const toggleSelectStudent = (student: StudentRecipient) => {
    if (audienceMode === 'INDIVIDUAL_STUDENT') {
      setSelectedStudents([student]);
    } else {
      setSelectedStudents((prev) => {
        const exists = prev.some((s) => s.id === student.id);
        if (exists) return prev.filter((s) => s.id !== student.id);
        return [...prev, student];
      });
    }
  };

  const removeStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  // Submit Handler
  const handleSendBroadcast = async () => {
    setStatusMessage(null);
    setIsConfirmOpen(false);

    if (sendMode === 'SCHEDULE') {
      if (!scheduledDateTime || new Date(scheduledDateTime).getTime() <= Date.now()) {
        setStatusMessage({
          type: 'error',
          text: 'Please select a future date and time for scheduled notification.',
        });
        return;
      }
    }

    const idempotencyKey = `lib_bcast_${selectedLibraryId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    startTransition(async () => {
      try {
        const res = await sendLibrarianBroadcastAction({
          libraryId: selectedLibraryId,
          title,
          message,
          type,
          actionLabel: actionLabel.trim() || null,
          actionUrl: actionUrl.trim() || null,
          audienceMode,
          recipientIds:
            audienceMode === 'INDIVIDUAL_STUDENT' || audienceMode === 'SELECTED_STUDENTS'
              ? selectedStudents.map((s) => s.id)
              : undefined,
          idempotencyKey,
          scheduledFor: sendMode === 'SCHEDULE' ? new Date(scheduledDateTime).toISOString() : undefined,
        });

        if (res.success && res.data) {
          const { sentCount, failedCount, totalTargets, isScheduled } = res.data;

          if (isScheduled) {
            setStatusMessage({
              type: 'success',
              text: `Notification scheduled successfully for ${new Date(scheduledDateTime).toLocaleString()} (${localTimeZone})!`,
            });
          } else if (failedCount === 0) {
            setStatusMessage({
              type: 'success',
              text: `Notification delivered successfully to ${sentCount} students!`,
            });
          } else {
            setStatusMessage({
              type: 'warning',
              text: `Completed with warnings: ${sentCount} succeeded, ${failedCount} failed out of ${totalTargets}.`,
            });
          }

          if (alsoSendWhatsApp && audienceMode === 'INDIVIDUAL_STUDENT' && selectedStudents[0]?.phone) {
            const waText = formatNotificationForWhatsApp(title, message, selectedLib?.name, actionUrl);
            openWhatsAppChat(selectedStudents[0].phone, waText);
          }

          setTitle('');
          setMessage('');
          setActionLabel('');
          setActionUrl('');
          setSelectedStudents([]);
          setScheduledDateTime('');
          setSendMode('NOW');
          refreshHistory();
        } else {
          setStatusMessage({
            type: 'error',
            text: res.error || 'Failed to dispatch library notification.',
          });
        }
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'Network error occurred while submitting.',
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

  // Retry an interrupted or failed broadcast
  const handleRetry = async (broadcastId: string) => {
    startTransition(async () => {
      try {
        const res = await retryBroadcastAction(broadcastId);
        if (res.success && res.data) {
          setStatusMessage({
            type: 'success',
            text: `Broadcast resumed! ${res.data.sentCount} total delivered (${res.data.failedCount} failed).`,
          });
          refreshHistory();
        } else {
          setStatusMessage({
            type: 'error',
            text: res.error || 'Failed to resume broadcast.',
          });
        }
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'Failed to retry broadcast.',
        });
      }
    });
  };

  const selectedLib = libraries.find((l) => l.id === selectedLibraryId);

  return (
    <div className="space-y-8">
      {/* Header and Multi-Library Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">
            Student Notifications
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Send instant alerts, operational announcements, and attendance notifications to students.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Library Switcher */}
          {libraries.length > 1 ? (
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-xs">
              <Building2 className="w-4 h-4 text-primary" />
              <select
                value={selectedLibraryId}
                onChange={(e) => setSelectedLibraryId(e.target.value)}
                className="bg-transparent text-sm font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id} className="bg-card text-foreground">
                    {lib.name} ({lib.city || 'Central'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            selectedLib && (
              <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>{selectedLib.name}</span>
              </div>
            )
          )}

          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
                activeTab === 'compose'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Compose
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                refreshHistory();
              }}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1 ${
                activeTab === 'history'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> History
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1 ${
                activeTab === 'settings'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Push Settings
            </button>
          </div>
        </div>
      </div>

      {/* Status Banner */}
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
          <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: COMPOSE */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Side (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Send className="w-5 h-5 text-primary" /> Create Notification
              </h2>

              {/* Title */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-sm font-medium">
                  <label htmlFor="lib-title">Title</label>
                  <span className={`text-xs ${title.length > 200 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {title.length}/200
                  </span>
                </div>
                <input
                  id="lib-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Silent Zone Air Conditioning Update"
                  maxLength={200}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              {/* Category */}
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

              {/* Message */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-sm font-medium">
                  <label htmlFor="lib-msg">Message</label>
                  <span className={`text-xs ${message.length > 2000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {message.length}/2000
                  </span>
                </div>
                <textarea
                  id="lib-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide essential details to your students clearly..."
                  maxLength={2000}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-y"
                />
              </div>

              {/* Navigation Action URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="lib-action-label">
                    Action Label (Optional)
                  </label>
                  <input
                    id="lib-action-label"
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="e.g. Check Desk"
                    maxLength={60}
                    className="w-full px-4 py-2 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="lib-action-url">
                    Internal Route (Optional)
                  </label>
                  <input
                    id="lib-action-url"
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="e.g. /student/dashboard"
                    maxLength={500}
                    className="w-full px-4 py-2 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  {actionUrl && !actionUrl.startsWith('/') && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Must begin with a leading &apos;/&apos;
                    </p>
                  )}
                </div>
              </div>

              {/* Audience Mode */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Target Audience
                  </label>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-primary" /> Members: {audienceCounts.allStudentsCount}
                    </span>
                    <span className="flex items-center gap-1 text-success font-semibold">
                      <UserCheck className="w-3.5 h-3.5 text-success" /> Inside: {audienceCounts.checkedInCount}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {[
                    {
                      id: 'ALL_LIBRARY_STUDENTS',
                      label: 'All Library Students',
                      desc: `All ${audienceCounts.allStudentsCount} active booking members`,
                    },
                    {
                      id: 'CURRENTLY_CHECKED_IN',
                      label: 'Currently Checked-In',
                      desc: `${audienceCounts.checkedInCount} students presently inside`,
                    },
                    {
                      id: 'SELECTED_STUDENTS',
                      label: 'Select Multiple Students',
                      desc: 'Choose custom students via search',
                    },
                    {
                      id: 'INDIVIDUAL_STUDENT',
                      label: 'Individual Student',
                      desc: 'Target one specific student',
                    },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => {
                        setAudienceMode(aud.id as any);
                        setSelectedStudents([]);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        audienceMode === aud.id
                          ? 'border-primary bg-primary/5 shadow-xs'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      <div className="font-semibold text-sm flex items-center justify-between">
                        <span>{aud.label}</span>
                        {audienceMode === aud.id && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{aud.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Student Search & Preview Side (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Student Search & Tray for Custom Modes */}
            {(audienceMode === 'INDIVIDUAL_STUDENT' || audienceMode === 'SELECTED_STUDENTS') && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    {audienceMode === 'INDIVIDUAL_STUDENT' ? 'Select 1 Student' : 'Select Students'}
                  </h3>
                  <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-full">
                    {selectedStudents.length} Selected
                  </span>
                </div>

                {/* Selected Student Chips */}
                {selectedStudents.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Recipient List</span>
                      <button
                        type="button"
                        onClick={() => setSelectedStudents([])}
                        className="text-destructive hover:underline"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-muted/40 rounded-xl border border-border">
                      {selectedStudents.map((student) => (
                        <span
                          key={student.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border border-border text-xs rounded-full font-medium"
                        >
                          <span className="truncate max-w-[120px]">{student.name}</span>
                          {student.phone && (
                            <button
                              type="button"
                              title={`Direct WhatsApp to ${student.name} (${student.phone})`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const waMsg = formatNotificationForWhatsApp(title, message, selectedLib?.name, actionUrl);
                                openWhatsAppChat(student.phone, waMsg);
                              }}
                              className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded-full hover:bg-emerald-50 transition-colors"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeStudent(student.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && executeSearch(1)}
                      placeholder="Search member name, phone..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => executeSearch(1)}
                    disabled={isSearching}
                    className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80"
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                  </button>
                </div>

                {/* Search Results */}
                <div className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Searching members...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No active members found matching query.
                    </div>
                  ) : (
                    searchResults.map((student) => {
                      const isSelected = selectedStudents.some((s) => s.id === student.id);
                      return (
                        <div
                          key={student.id}
                          onClick={() => toggleSelectStudent(student)}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type={audienceMode === 'INDIVIDUAL_STUDENT' ? 'radio' : 'checkbox'}
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 text-primary border-input"
                            />
                            <div>
                              <div className="font-semibold text-foreground">{student.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {student.phone || student.email || student.uniqueId || 'Member'}
                              </div>
                            </div>
                          </div>
                          {student.phone && (
                            <button
                              type="button"
                              title={`Direct WhatsApp to ${student.name} (${student.phone})`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const waMsg = formatNotificationForWhatsApp(title, message, selectedLib?.name, actionUrl);
                                openWhatsAppChat(student.phone, waMsg);
                              }}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1 text-[11px] font-semibold shrink-0"
                            >
                              <WhatsAppIcon className="w-3 h-3" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pagination */}
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

            {/* Delivery Summary & Action Button */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" /> Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Target Library</span>
                  <span className="font-semibold">{selectedLib?.name || 'Selected'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Audience</span>
                  <span className="font-semibold">{audienceMode.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Estimated Recipients</span>
                  <span className="font-bold text-primary">
                    {audienceMode === 'ALL_LIBRARY_STUDENTS'
                      ? `${audienceCounts.allStudentsCount} Students`
                      : audienceMode === 'CURRENTLY_CHECKED_IN'
                      ? `${audienceCounts.checkedInCount} Students`
                      : `${selectedStudents.length} Students`}
                  </span>
                </div>
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

              {/* Direct WhatsApp Option for Individual Student */}
              {audienceMode === 'INDIVIDUAL_STUDENT' && selectedStudents[0]?.phone && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
                        <WhatsAppIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                          Direct WhatsApp Option
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                          {selectedStudents[0].name} ({selectedStudents[0].phone})
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!message.trim()}
                      onClick={() => {
                        const waMsg = formatNotificationForWhatsApp(title, message, selectedLib?.name, actionUrl);
                        openWhatsAppChat(selectedStudents[0].phone, waMsg);
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95 shrink-0"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      Open WhatsApp Chat
                    </button>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-foreground font-medium select-none">
                    <input
                      type="checkbox"
                      checked={alsoSendWhatsApp}
                      onChange={(e) => setAlsoSendWhatsApp(e.target.checked)}
                      className="rounded border-input text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>Also open WhatsApp message when sending this in-app notification</span>
                  </label>
                </div>
              )}

              {/* Direct WhatsApp summary for multiple selected students */}
              {audienceMode === 'SELECTED_STUDENTS' && selectedStudents.some((s) => !!s.phone) && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <WhatsAppIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>{selectedStudents.filter((s) => !!s.phone).length}</strong> of {selectedStudents.length} selected students have WhatsApp phone numbers. Click the WhatsApp icon on any student pill above to message directly.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                {audienceMode === 'INDIVIDUAL_STUDENT' && selectedStudents[0]?.phone && (
                  <button
                    type="button"
                    disabled={!message.trim()}
                    onClick={() => {
                      const waMsg = formatNotificationForWhatsApp(title, message, selectedLib?.name, actionUrl);
                      openWhatsAppChat(selectedStudents[0].phone, waMsg);
                    }}
                    className="sm:w-1/2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <WhatsAppIcon className="w-4 h-4" /> Message on WhatsApp
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    !title.trim() ||
                    !message.trim() ||
                    isPending ||
                    (sendMode === 'SCHEDULE' && !scheduledDateTime) ||
                    (audienceMode === 'INDIVIDUAL_STUDENT' && selectedStudents.length !== 1) ||
                    (audienceMode === 'SELECTED_STUDENTS' && selectedStudents.length === 0) ||
                    (audienceMode === 'ALL_LIBRARY_STUDENTS' && audienceCounts.allStudentsCount === 0) ||
                    (audienceMode === 'CURRENTLY_CHECKED_IN' && audienceCounts.checkedInCount === 0) ||
                    (actionUrl.trim().length > 0 && !actionUrl.trim().startsWith('/'))
                  }
                  onClick={() => setIsConfirmOpen(true)}
                  className={`py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${
                    audienceMode === 'INDIVIDUAL_STUDENT' && selectedStudents[0]?.phone ? 'sm:w-1/2' : 'w-full'
                  }`}
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> {sendMode === 'SCHEDULE' ? 'Scheduling...' : 'Dispatching...'}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> {sendMode === 'SCHEDULE' ? 'Schedule Notification' : 'Send Notification'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Clock className="w-5 h-5 text-primary" /> Past Notifications for {selectedLib?.name}
            </h2>
            <button
              onClick={refreshHistory}
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
                  <th className="px-6 py-4">Delivered</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Timing</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No notifications recorded for this library yet.
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
                        {bcast.audienceType.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {bcast.sentCount} / {bcast.totalTargets}
                        {bcast.failedCount > 0 && (
                          <span className="text-destructive font-normal ml-1">
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
                        ) : (bcast.status === 'PROCESSING' || bcast.status === 'PARTIALLY_FAILED' || bcast.status === 'FAILED') ? (
                          <button
                            onClick={() => handleRetry(bcast.id)}
                            className="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs font-semibold rounded-lg hover:bg-secondary/80 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Resume
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
        </div>
      )}

      {/* TAB 3: PUSH SETTINGS */}
      {activeTab === 'settings' && (
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
                <h3 className="font-bold text-lg text-foreground">Confirm Notification</h3>
                <p className="text-xs text-muted-foreground">Sending to members of {selectedLib?.name}</p>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-xl space-y-2 text-xs border border-border">
              <div>
                <span className="text-muted-foreground">Title: </span>
                <span className="font-bold text-foreground">{title}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Audience Mode: </span>
                <span className="font-bold text-foreground">{audienceMode.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Recipients: </span>
                <span className="font-bold text-primary">
                  {audienceMode === 'ALL_LIBRARY_STUDENTS'
                    ? `${audienceCounts.allStudentsCount} Students`
                    : audienceMode === 'CURRENTLY_CHECKED_IN'
                    ? `${audienceCounts.checkedInCount} Students`
                    : `${selectedStudents.length} Selected`}
                </span>
              </div>
              {alsoSendWhatsApp && audienceMode === 'INDIVIDUAL_STUDENT' && selectedStudents[0]?.phone && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold text-[11px] mt-2">
                  <WhatsAppIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Will also open WhatsApp chat for {selectedStudents[0].name}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-border font-medium text-xs hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={isPending}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-xs shadow hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
