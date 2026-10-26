import prisma from "@/lib/prisma";
import Link from "next/link";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { startOfDayIST } from "@/lib/date-utils";
import { Prisma } from "@prisma/client";
import { AdminPendingKycClient } from "@/components/admin/AdminPendingKycClient";
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  Cpu,
  Activity,
  AlertTriangle,
  ArrowRight,
  Eye,
  Check,
  X,
  CreditCard,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getCachedAdminData } from "@/lib/admin-cache";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const {
    totalLibraries,
    pendingKycCount,
    approvedLibrariesCount,
    rejectedLibrariesCount,
    totalStudents,
    verifiedStudents,
    totalAdmins,
    totalBookings,
    bookingsToday,
    activeCheckins,
    checkinsToday,
    totalHardwareClaims,
    claimedHardware,
    pendingOutboxCount,
    pendingLibraries,
    recentBookings,
  } = await getCachedAdminData("overview", async () => {
    const startOfToday = startOfDayIST(new Date());

    const [
      totalLibraries,
      pendingKycCount,
      approvedLibrariesCount,
      rejectedLibrariesCount,
      totalStudents,
      verifiedStudents,
      totalAdmins,
      totalBookings,
      bookingsToday,
      activeEntries,
      checkinsToday,
      totalHardwareClaims,
      claimedHardware,
      pendingOutboxCount,
      pendingLibraries,
      recentBookings,
    ] = await Promise.all([
      prisma.library.count(),
      prisma.library.count({ where: { kycStatus: "PENDING" } }),
      prisma.library.count({ where: { kycStatus: "APPROVED" } }),
      prisma.library.count({ where: { kycStatus: "REJECTED" } }),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { digilockerVerified: true } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.$queryRaw<Array<{ userId: string; status: string }>>(Prisma.sql`
        SELECT DISTINCT ON ("userId") "userId", "status"
        FROM "EntryLog"
        WHERE "timestamp" >= ${startOfToday}
          AND "userId" IS NOT NULL
          AND "status" IN ('SUCCESS', 'IN', 'OUT')
        ORDER BY "userId", "timestamp" DESC
      `),
      prisma.entryLog.count({
        where: {
          timestamp: { gte: startOfToday },
          status: { in: ["IN", "SUCCESS"] },
        },
      }),
      prisma.hardwareClaim.count(),
      prisma.hardwareClaim.count({ where: { isClaimed: true } }),
      prisma.realtimeOutbox.count({ where: { status: { in: ["PENDING", "FAILED"] } } }),
      prisma.library.findMany({
        where: { kycStatus: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 4,
      }),
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          student: { select: { name: true, phone: true } },
          library: { select: { name: true, city: true } },
          seat: { select: { name: true } },
        },
      }),
    ]);

    const activeCheckins = activeEntries.filter((e) => e.status !== "OUT").length;

    return {
      totalLibraries,
      pendingKycCount,
      approvedLibrariesCount,
      rejectedLibrariesCount,
      totalStudents,
      verifiedStudents,
      totalAdmins,
      totalBookings,
      bookingsToday,
      activeCheckins,
      checkinsToday,
      totalHardwareClaims,
      claimedHardware,
      pendingOutboxCount,
      pendingLibraries,
      recentBookings,
    };
  }, 30);

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-sans pb-12">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-[#2781CA] border border-blue-100">
              FocusX Mission Control
            </span>
            <span className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Platform Healthy
            </span>
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none">
            Platform Command Center
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Realtime metrics, ecosystem governance, and hardware sync across all libraries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/libraries"
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            Library Directory
          </Link>
          <Link
            href="/admin/team"
            className="px-4 py-2 rounded-xl bg-[#2781CA] hover:opacity-90 text-white text-xs font-bold transition-all shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)] flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Team ({totalAdmins})
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid (FocusX Librarian Theme & Color Grading) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Libraries (Obsidian Widget) */}
        <div className="bg-slate-900 p-7 rounded-[2.5rem] border border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-slate-700 transition-all duration-300 group flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0085FF] opacity-20 blur-[50px] rounded-full pointer-events-none"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-300">Total Libraries</span>
            <div className="p-2.5 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors">
              <Building2 className="w-5 h-5 text-[#0085FF]" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-5xl font-black text-white tracking-tight">{totalLibraries}</div>
            <div className="flex items-center gap-2 text-xs mt-4">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {approvedLibrariesCount} Active
              </span>
              <span className="text-slate-600">•</span>
              <span className={`font-bold ${pendingKycCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {pendingKycCount} Pending KYC
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Students & Users (Electric Lime Card) */}
        <div className="bg-[#C6F135] p-7 rounded-[2.5rem] border border-[#b5e022] shadow-[0_8px_30px_rgba(198,241,53,0.15)] hover:shadow-[0_8px_30px_rgba(198,241,53,0.25)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-25 rounded-full blur-[40px] pointer-events-none"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-900">Enrolled Students</span>
            <div className="p-2.5 bg-white/50 backdrop-blur-sm rounded-xl">
              <Users className="w-5 h-5 text-slate-900" />
            </div>
          </div>
          <div className="relative z-10 mt-auto">
            <div className="text-5xl font-black text-slate-900 tracking-tight drop-shadow-sm">{totalStudents}</div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800/80 mt-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />
              <span>{verifiedStudents} DigiLocker Verified</span>
            </div>
          </div>
        </div>

        {/* Card 3: Live Seat Occupancy (Crisp White Card with Purple Glow) */}
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-purple-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-purple-500/20 transition-colors duration-500"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">Active Check-ins</span>
            <div className="p-2.5 bg-purple-50 border border-purple-100 shadow-sm rounded-xl">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              {activeCheckins}
              <span className="text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Live Now
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-4 font-bold flex items-center gap-1.5">
              <span>{checkinsToday} check-ins today</span>
              <span>•</span>
              <span>{bookingsToday} bookings today</span>
            </div>
          </div>
        </div>

        {/* Card 4: Hardware & Outbox (Crisp White Card with Amber Glow) */}
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-amber-500/20 transition-colors duration-500"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">IoT Fleet & Sync</span>
            <div className="p-2.5 bg-amber-50 border border-amber-100 shadow-sm rounded-xl">
              <Cpu className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-5xl font-black text-slate-900 tracking-tight">
              {claimedHardware} <span className="text-2xl text-slate-400 font-bold">/ {totalHardwareClaims}</span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-4">
              <span className="text-slate-600 font-bold">Claimed Units</span>
              <span className="text-slate-300">•</span>
              <span className={`font-bold ${pendingOutboxCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {pendingOutboxCount} Outbox Queue
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Center: Pending KYC Approvals (Managed by resilient Client Component) */}
      <AdminPendingKycClient
        initialLibraries={pendingLibraries}
        initialPendingCount={pendingKycCount}
      />

      {/* Recent Global Bookings Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Recent Platform Bookings</h2>
          <Link
            href="/admin/bookings"
            className="text-xs font-bold text-[#2781CA] hover:underline flex items-center gap-1 transition-colors"
          >
            All Transactions <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Student</th>
                  <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Library</th>
                  <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Seat Number</th>
                  <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Status</th>
                  <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{b.student?.name || "Student"}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{b.student?.phone || "No phone"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-bold">{b.library?.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{b.library?.city || "India"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        {b.seat ? `Seat #${b.seat.name}` : "Flexible Plan"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          b.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : b.status === "COMPLETED"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {new Date(b.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                    </td>
                  </tr>
                ))}
                {recentBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-medium">
                      No platform bookings recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
