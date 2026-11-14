"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  History,
  Search,
  Filter,
  UserPlus,
  RefreshCw,
  Clock,
  ArrowRightLeft,
  PauseCircle,
  PlayCircle,
  XCircle,
  Shield,
  CreditCard,
  User,
  Sparkles,
} from "lucide-react";
import { getLibraryActivityHistory, type ActivityHistoryItem } from "@/app/actions/history-actions";
import { SkeletonShimmer } from "@/components/ui/SkeletonShimmer";
import { formatDistanceToNow, format } from "date-fns";

const ACTION_FILTERS = [
  { id: "ALL", label: "All Activity" },
  { id: "STUDENT_ADDED", label: "New Students" },
  { id: "PLAN_CHANGED", label: "Plan Changes" },
  { id: "SEAT_CHANGED", label: "Seat Moves" },
  { id: "MEMBERSHIP_PAUSED", label: "Pauses" },
  { id: "MEMBERSHIP_RESUMED", label: "Resumes" },
  { id: "BOOKING_REVOKED", label: "Revocations" },
];

export function HistoryClient({ initialLibraryId }: { initialLibraryId?: string }) {
  const [activities, setActivities] = useState<ActivityHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const fetchActivities = (page = 1, filter = selectedFilter, search = searchQuery) => {
    startTransition(async () => {
      const res = await getLibraryActivityHistory({
        page,
        limit: 25,
        actionFilter: filter,
        search,
        libraryId: initialLibraryId,
      });
      setActivities(res.activities);
      setTotalCount(res.totalCount);
      setCurrentPage(res.page);
      setTotalPages(res.totalPages);
    });
  };

  useEffect(() => {
    fetchActivities(1, selectedFilter, searchQuery);
  }, [selectedFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities(1, selectedFilter, searchQuery);
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case "STUDENT_ADDED":
        return {
          icon: <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
          label: "Student Enrolled",
        };
      case "PLAN_CHANGED":
        return {
          icon: <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          bg: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900",
          label: "Plan Changed",
        };
      case "SEAT_CHANGED":
        return {
          icon: <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900",
          label: "Seat Reassigned",
        };
      case "MEMBERSHIP_PAUSED":
        return {
          icon: <PauseCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
          label: "Paused",
        };
      case "MEMBERSHIP_RESUMED":
        return {
          icon: <PlayCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
          bg: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900",
          label: "Resumed",
        };
      case "BOOKING_REVOKED":
        return {
          icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
          label: "Membership Revoked",
        };
      case "DUES_COLLECTED":
        return {
          icon: <CreditCard className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
          bg: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900",
          label: "Payment Collected",
        };
      default:
        return {
          icon: <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />,
          bg: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
          label: "Staff Action",
        };
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">
              Activity History
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Plain-English audit log of all actions taken by librarians, receptionists, and staff.
          </p>
        </div>

        <button
          onClick={() => fetchActivities(currentPage, selectedFilter, searchQuery)}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all shadow-2xs self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-primary" : ""}`} />
          Refresh Activity
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full focusx-sidebar-scroll">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full shrink-0 transition-all cursor-pointer ${
                selectedFilter === f.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
          />
        </form>
      </div>

      {/* Main Activity Timeline / List */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {isPending && activities.length === 0 ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonShimmer className="w-9 h-9 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <SkeletonShimmer className="h-4 w-3/5" />
                  <SkeletonShimmer className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/70 text-muted-foreground mx-auto flex items-center justify-center mb-3">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No activity recorded yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              Actions taken by your library staff (adding students, changing plans, assigning seats) will appear here in simple, easy-to-read language.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {activities.map((act) => {
              const badge = getActionBadge(act.actionType);
              const createdAtDate = new Date(act.createdAt);
              const relativeTime = formatDistanceToNow(createdAtDate, { addSuffix: true });
              const fullTime = format(createdAtDate, "PPpp");

              return (
                <div
                  key={act.id}
                  className="p-4 sm:px-6 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Action Icon */}
                    <div className="p-2 rounded-lg bg-muted/80 border border-border/80 shrink-0 mt-0.5">
                      {badge.icon}
                    </div>

                    {/* Narrative Description */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground tracking-tight">
                        {act.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {/* Actor Badge */}
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                          <User className="w-3 h-3 text-muted-foreground" />
                          {act.actorName}
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-sm bg-muted border border-border/60 text-muted-foreground">
                            {act.actorRole}
                          </span>
                        </span>

                        <span>•</span>

                        {/* Category Badge */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}>
                          {badge.label}
                        </span>

                        {act.studentName && (
                          <>
                            <span>•</span>
                            <span className="text-muted-foreground">
                              Student: <strong className="text-foreground/90 font-medium">{act.studentName}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0 sm:self-center pl-11 sm:pl-0">
                    <time
                      dateTime={act.createdAt.toString()}
                      title={fullTime}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground cursor-help"
                    >
                      {relativeTime}
                    </time>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span> ({totalCount} total events)
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchActivities(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              >
                Previous
              </button>
              <button
                onClick={() => fetchActivities(currentPage + 1)}
                disabled={currentPage >= totalPages || isPending}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
