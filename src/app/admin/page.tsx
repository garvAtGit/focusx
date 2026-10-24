import prisma from "@/lib/prisma";
import Link from "next/link";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { approveLibrary, rejectLibrary } from "@/app/actions/admin-actions";
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

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

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
    activeCheckins,
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
    prisma.checkinLog.count({ where: { status: "CHECK_IN" } }),
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

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
              FocusX Mission Control
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Platform Healthy
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Platform Command Center
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Realtime metrics, ecosystem governance, and hardware sync across all libraries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/libraries"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all flex items-center gap-2"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            Library Directory
          </Link>
          <Link
            href="/admin/team"
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-md shadow-red-600/20 flex items-center gap-2"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Team ({totalAdmins})
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Libraries */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Libraries
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{totalLibraries}</div>
            <div className="flex items-center gap-2 text-xs mt-2">
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {approvedLibrariesCount} Active
              </span>
              <span className="text-slate-500">•</span>
              <span className={`font-medium ${pendingKycCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {pendingKycCount} Pending KYC
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Students & Users */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Students Enrolled
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{totalStudents}</div>
            <div className="flex items-center gap-2 text-xs mt-2">
              <span className="text-emerald-400 font-medium">
                {verifiedStudents} DigiLocker Verified
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Live Seat Occupancy */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Check-ins
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              {activeCheckins}
              <span className="text-xs font-normal text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                Live Now
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-2 font-medium">
              {bookingsToday} bookings created today
            </div>
          </div>
        </div>

        {/* Card 4: Hardware & Outbox */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              IoT Fleet & Sync
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {claimedHardware} / {totalHardwareClaims}
            </div>
            <div className="flex items-center gap-2 text-xs mt-2">
              <span className="text-slate-400 font-medium">Claimed Devices</span>
              <span className="text-slate-500">•</span>
              <span className={`font-medium ${pendingOutboxCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {pendingOutboxCount} Sync Queue
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Center: Pending KYC Approvals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white">Pending KYC Approvals</h2>
            {pendingKycCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {pendingKycCount} Require Action
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                All Cleared
              </span>
            )}
          </div>
          <Link
            href="/admin/libraries"
            className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
          >
            View All Libraries <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pendingLibraries.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-white font-medium text-sm">All library applications have been reviewed</p>
            <p className="text-slate-500 text-xs mt-1">
              New library onboardings and passbook verification submissions will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingLibraries.map((lib) => (
              <div
                key={lib.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-750 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white text-base">{lib.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        {lib.address || lib.city || "Address not provided"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                      Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-500">Manager:</span>{" "}
                      <span className="text-slate-300 font-medium">{lib.managerName || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Phone:</span>{" "}
                      <span className="text-slate-300 font-medium">{lib.managerPhone || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Seats:</span>{" "}
                      <span className="text-slate-300 font-medium">{lib.seatsAvailable || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Submitted:</span>{" "}
                      <span className="text-slate-300 font-medium">
                        {new Date(lib.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Link
                    href={`/admin/view/${lib.id}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" /> Inspect KYC
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await rejectLibrary(lib.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/20 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await approveLibrary(lib.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm shadow-emerald-600/20 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Global Bookings Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent Platform Bookings</h2>
          <Link
            href="/admin/bookings"
            className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
          >
            All Transactions <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Student</th>
                  <th className="px-5 py-3.5 font-semibold">Library</th>
                  <th className="px-5 py-3.5 font-semibold">Seat Number</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-200">{b.student?.name || "Student"}</div>
                      <div className="text-[11px] text-slate-400">{b.student?.phone || "No phone"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-slate-200 font-medium">{b.library?.name}</div>
                      <div className="text-[11px] text-slate-400">{b.library?.city || "India"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                        {b.seat ? `Seat #${b.seat.name}` : "Flexible Plan"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === "CONFIRMED"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : b.status === "COMPLETED"
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
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
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
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
