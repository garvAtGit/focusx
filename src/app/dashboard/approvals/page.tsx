import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import ApprovalActions from "./ApprovalActions";
import StudentProfileTrigger from "./StudentProfileTrigger";
import { calculateBookingTotal } from "@/lib/pricing-utils";
import { AlertTriangle, UserCheck, ShieldCheck, Phone, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { formatStandardDate } from "@/lib/date-utils";

export default async function PendingApprovalsPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) redirect("/login");

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const pendingBookings = await prisma.booking.findMany({
    where: {
      libraryId: library.id,
      status: "PENDING_PAYMENT"
    },
    include: {
      student: true,
      plan: true,
      seat: true,
      standaloneLocker: true
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Pending Approvals</h1>
        <p className="text-muted-foreground mt-1">Review and approve &ldquo;Pay at Reception&rdquo; requests.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {pendingBookings.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center text-muted-foreground mb-4">
              <Clock className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No pending requests</h3>
            <p className="text-muted-foreground">When students request a seat via &ldquo;Pay at Reception&rdquo;, it will appear here for your approval.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="p-4 font-semibold text-muted-foreground text-sm">Student</th>
                  <th className="p-4 font-semibold text-muted-foreground text-sm">Requested Plan</th>
                  <th className="p-4 font-semibold text-muted-foreground text-sm">Seat / Locker</th>
                  <th className="p-4 font-semibold text-muted-foreground text-sm">Amount Due</th>
                  <th className="p-4 font-semibold text-muted-foreground text-sm">Requested At</th>
                  <th className="p-4 font-semibold text-muted-foreground text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <StudentProfileTrigger studentId={b.studentId}>
                        <div className="font-medium text-primary hover:underline">{b.student.name}</div>
                        <div className="text-xs font-semibold text-muted-foreground mt-0.5">FD ID: {b.student.uniqueId}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{b.student.email || "No Email"}</div>
                        {b.student.phone && <div className="text-xs text-muted-foreground">{b.student.phone}</div>}
                      </StudentProfileTrigger>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">{b.plan.name}</div>
                      <div className="text-xs text-muted-foreground">{b.plan.validityDays} Days • {b.plan.type}</div>
                      {b.startTime && b.endTime && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatStandardDate(b.startTime)} - {formatStandardDate(b.endTime)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {b.seat ? (
                        <div className="font-medium text-foreground">Seat {b.seat.name}</div>
                      ) : (
                        <div className="font-medium text-muted-foreground">Flexible Desk</div>
                      )}
                      {b.hasLocker && <div className="text-xs text-primary font-medium">Includes Locker</div>}
                      {b.standaloneLocker && <div className="text-xs text-primary font-medium">Standalone Locker {b.standaloneLocker.name}</div>}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-foreground">
                        ₹{calculateBookingTotal(b).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <ApprovalActions bookingId={b.id} totalAmount={calculateBookingTotal(b)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
