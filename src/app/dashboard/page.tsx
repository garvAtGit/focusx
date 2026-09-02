import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { calculateBookingTotal } from "@/lib/pricing-utils";
import { Prisma } from "@prisma/client";
import { DashboardOverviewClient } from "./DashboardOverviewClient";

export default async function LibrarianDashboardPage() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) redirect("/");

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  // Calculate past 30 days range
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const expiringBefore = new Date();
  expiringBefore.setDate(expiringBefore.getDate() + 3);

  const now = new Date();
  const [
    studentCount,
    totalSeatsCount,
    occupiedSeatRows,
    pendingQueries,
    recentBookings,
    checkinLogsRaw,
    expiringCount,
    pendingApprovals,
    entryLogs,
    todaysBookings,
    latestEntryStates,
    thirtyDayBookings
  ] = await Promise.all([
    prisma.user.count({
      where: {
        bookings: {
          some: {
            libraryId: library.id,
            status: 'CONFIRMED',
            endTime: { gte: now },
          },
        },
      },
    }),
    prisma.seat.count({ where: { libraryId: library.id } }),
    prisma.booking.findMany({
      where: {
        libraryId: library.id,
        status: 'CONFIRMED',
        isPaused: false,
        seatId: { not: null },
        startTime: { lte: now },
        endTime: { gte: now }
      },
      select: { seatId: true },
      distinct: ['seatId']
    }),
    prisma.query.count({ where: { libraryId: library.id, createdAt: { gte: sevenDaysAgo } } }),
    prisma.booking.findMany({
      where: { libraryId: library.id },
      include: { student: true, plan: true, seat: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.checkinLog.findMany({
      where: { libraryId: library.id, timestamp: { gte: sevenDaysAgo } },
      include: { student: { select: { name: true, phone: true } } },
      orderBy: { timestamp: 'desc' },
      take: 500,
    }),
    prisma.booking.count({
      where: {
        libraryId: library.id,
        status: "CONFIRMED",
        endTime: { gt: now, lt: expiringBefore },
      },
    }),
    prisma.booking.findMany({
      where: { libraryId: library.id, status: 'PENDING_PAYMENT' },
      include: { student: true, plan: true, seat: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.entryLog.findMany({
      where: { libraryId: library.id, timestamp: { gte: sevenDaysAgo }, status: { in: ["SUCCESS", "IN", "OUT"] } },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { timestamp: 'desc' },
      take: 500,
    }),
    prisma.booking.findMany({
      where: {
        libraryId: library.id,
        status: { in: ["CONFIRMED", "COMPLETED"] },
        createdAt: { gte: startOfDay },
      },
      include: { plan: true, standaloneLocker: true, student: true, seat: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.$queryRaw<Array<{ userId: string; status: string }>>(Prisma.sql`
      SELECT DISTINCT ON ("userId") "userId", "status"
      FROM "EntryLog"
      WHERE "libraryId" = ${library.id}
        AND "timestamp" >= ${startOfDay}
        AND "userId" IS NOT NULL
        AND "status" IN ('SUCCESS', 'IN', 'OUT')
      ORDER BY "userId", "timestamp" DESC
    `),
    prisma.booking.findMany({
      where: {
        libraryId: library.id,
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ["CONFIRMED", "COMPLETED"] }
      },
      select: { createdAt: true, paymentRef: true }
    })
  ]);

  const totalSeats = totalSeatsCount || library.seatsAvailable || 1;
  const bookedSeats = occupiedSeatRows.length;
  const occupancyPercentage = Math.min(100, Math.round((bookedSeats / totalSeats) * 100));

  const insideUserIds = latestEntryStates
    .filter(({ status }) => status !== "OUT")
    .map(({ userId }) => userId);
  const studentsInside = await prisma.user.findMany({
    where: { id: { in: insideUserIds } },
  });

  // Formatting Live Access
  const combinedLogsUnfiltered = [
    ...checkinLogsRaw.map(log => ({
      id: log.id,
      studentId: log.studentId,
      name: log.student?.name || 'Unknown',
      phone: log.student?.phone || '',
      action: log.status,
      timestamp: log.timestamp
    })),
    ...entryLogs.map(log => ({
      id: log.id,
      studentId: log.userId,
      name: log.user?.name || 'Unknown',
      phone: log.user?.phone || '',
      action: (log.status === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN') as 'CHECK_IN' | 'CHECK_OUT',
      timestamp: log.timestamp
    }))
  ];

  const seenEvents = new Set<string>();
  const combinedLogs = combinedLogsUnfiltered.filter(log => {
    if (!log.studentId) return false;
    // Discard milliseconds for deduplication to prevent slight desyncs
    const timeKey = Math.floor(new Date(log.timestamp).getTime() / 1000);
    const key = `${log.studentId}-${timeKey}-${log.action}`;
    if (seenEvents.has(key)) return false;
    seenEvents.add(key);
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const liveAccess = combinedLogs.slice(0, 15).map(log => ({
    id: log.id,
    name: log.name,
    phone: log.phone,
    action: log.action,
    time: new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  }));

  // Formatting Today's Attendance
  // Formatting Today's Attendance
  const todaysLogs = combinedLogs.filter(log => new Date(log.timestamp) >= startOfDay);
  const studentAttendanceMap = new Map();

  todaysLogs.forEach(log => {
    if (!studentAttendanceMap.has(log.name)) {
      studentAttendanceMap.set(log.name, {
        name: log.name,
        phone: log.phone,
        studentId: log.studentId,
        events: []
      });
    }
    studentAttendanceMap.get(log.name).events.push(log);
  });

  const todaysStudentIds = [...new Set(todaysLogs.map(log => log.studentId).filter(Boolean))] as string[];
  
  const studentsWithHistory = await prisma.user.findMany({
    where: { id: { in: todaysStudentIds } },
    include: {
      bookings: {
        where: { libraryId: library.id, status: 'CONFIRMED' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      checkins: { where: { libraryId: library.id }, orderBy: { timestamp: 'asc' } },
      entryLogs: { where: { libraryId: library.id }, orderBy: { timestamp: 'asc' } }
    }
  });

  const studentAvgMap = new Map();
  for (const stu of studentsWithHistory) {
     const currentBooking = stu.bookings[0];
     if (!currentBooking) {
       studentAvgMap.set(stu.id, { avgHrs: 0, optedHrs: 24, overstayHrs: 0 });
       continue;
     }
     
     const bookingStart = new Date(currentBooking.createdAt).getTime();
     const stuLogs = [
       ...(stu.checkins || []).map(log => ({
         status: log.status === 'CHECK_IN' || log.status === 'CHECK_OUT' ? log.status : 'CHECK_IN',
         timestamp: log.timestamp
       })),
       ...(stu.entryLogs || []).map(log => ({
         status: (log.status === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN') as 'CHECK_IN' | 'CHECK_OUT',
         timestamp: log.timestamp
       }))
     ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
     
     const activeLogs = stuLogs.filter(l => new Date(l.timestamp).getTime() >= bookingStart);
     const daysMap = new Map<string, { in: Date | null, durationMs: number }>();
     
     for (const log of activeLogs) {
       const date = new Date(log.timestamp);
       const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
       let dayData = daysMap.get(dayKey);
       if (!dayData) { dayData = { in: null, durationMs: 0 }; daysMap.set(dayKey, dayData); }
       if (log.status === 'CHECK_IN') {
         if (!dayData.in) dayData.in = date;
       } else if (log.status === 'CHECK_OUT') {
         if (dayData.in) {
           dayData.durationMs += (date.getTime() - dayData.in.getTime());
           dayData.in = null;
         }
       }
     }
     
     let totalDurationMs = 0;
     let daysCount = 0;
     Array.from(daysMap.values()).forEach(data => {
       if (data.durationMs > 0) {
         totalDurationMs += data.durationMs;
         daysCount++;
       }
     });
     
     const avgMs = daysCount > 0 ? totalDurationMs / daysCount : 0;
     const avgHrs = avgMs / (1000 * 60 * 60);
     const optedHrs = currentBooking.plan?.durationHours || 24;
     const overstayHrs = Math.max(0, avgHrs - optedHrs);
     const image = stu.kycAadhaarProfilePhotoUrl || stu.profilePhotoUrl || null;
     studentAvgMap.set(stu.id, { avgHrs, optedHrs, overstayHrs, image });
  }

  function formatHrs(hrs: number) {
    if (hrs === 0) return "0m";
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  const todaysAttendance = Array.from(studentAttendanceMap.values()).map(student => {
    const sortedEvents = student.events.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const firstIn = sortedEvents.find((e: any) => e.action === 'CHECK_IN');
    const lastOut = sortedEvents.reverse().find((e: any) => e.action === 'CHECK_OUT');
    
    // Reverse back for timeline
    sortedEvents.reverse();

    let totalHrs = "0h 0m";
    let todayHrs = 0;
    if (firstIn) {
      const endTime = lastOut ? new Date(lastOut.timestamp).getTime() : new Date().getTime();
      const startTime = new Date(firstIn.timestamp).getTime();
      
      let totalBreakMs = 0;
      let lastOutTime: number | null = null;

      for (const event of sortedEvents) {
        const eventTime = new Date((event as any).timestamp).getTime();
        if (eventTime < startTime) continue;

        if ((event as any).action === 'CHECK_OUT') {
           lastOutTime = eventTime;
        } else if ((event as any).action === 'CHECK_IN' && lastOutTime) {
           const breakMs = eventTime - lastOutTime;
           if (breakMs > 1.5 * 60 * 60 * 1000) {
             totalBreakMs += breakMs;
           }
           lastOutTime = null;
        }
      }

      const totalDurationMs = Math.max(0, (endTime - startTime) - totalBreakMs);
      const diffMins = Math.floor(totalDurationMs / 1000 / 60);
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      totalHrs = `${hrs}h ${mins}m`;
      todayHrs = diffMins / 60;
    }

    const avgData = studentAvgMap.get(student.studentId) || { avgHrs: 0, optedHrs: 24, overstayHrs: 0, image: null };

    return {
      studentId: student.studentId,
      name: student.name,
      image: avgData.image,
      phone: student.phone,
      firstIn: firstIn ? new Date(firstIn.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-',
      lastOut: lastOut ? new Date(lastOut.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'Still In',
      totalHrs,
      todayHrs,
      avgHrs: avgData.avgHrs,
      optedHrs: avgData.optedHrs,
      overstayHrs: avgData.overstayHrs,
      avgStr: formatHrs(avgData.avgHrs),
      optedStr: formatHrs(avgData.optedHrs),
      events: sortedEvents.reduce((acc: any[], e: any) => {
        const action = e.action === 'CHECK_IN' ? 'IN' : 'OUT';
        if (acc.length === 0 || acc[acc.length - 1].action !== action) {
          acc.push({
            action,
            type: action === 'IN' ? 'in' : 'out',
            time: new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
          });
        }
        return acc;
      }, [])
    };
  });

  // Formatting Chart Data (Default 30 Days)
  const chartDataMap = new Map();
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
    chartDataMap.set(label, { enrollments: 0, renewals: 0 });
  }

  thirtyDayBookings.forEach(booking => {
    const d = new Date(booking.createdAt);
    const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
    if (chartDataMap.has(label)) {
      const isRenewal = booking.paymentRef?.startsWith('RENEWAL_');
      const data = chartDataMap.get(label);
      if (isRenewal) {
        data.renewals++;
      } else {
        data.enrollments++;
      }
      chartDataMap.set(label, data);
    }
  });

  const chartData = Array.from(chartDataMap.entries()).map(([name, counts]) => ({
    name,
    enrollments: counts.enrollments,
    renewals: counts.renewals
  }));

  // Formatting Approvals
  const pendingApprovalsData = pendingApprovals.map(app => ({
    id: app.id,
    student: app.student.name,
    plan: app.plan.name,
    time: new Date(app.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })
  }));

  // Formatting Recent Activity
  const recentActivityData = recentBookings.map(b => ({
    id: b.id,
    student: b.student.name,
    phone: b.student.phone,
    plan: b.plan.name,
    time: new Date(b.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })
  }));

  // Formatting Transactions
  const todaysTransactionsData = todaysBookings.map(b => {
    const price = calculateBookingTotal(b);
    return {
      id: b.id,
      student: b.student.name,
      phone: b.student.phone,
      amount: price,
      method: b.paymentRef?.startsWith('pay_') ? 'Razorpay' : 
              b.paymentRef?.toUpperCase().includes('CASH') ? 'Paid at reception (cash)' :
              b.paymentRef?.toUpperCase().includes('ONLINE') ? 'Paid at reception (online)' :
              'Razorpay',
      time: new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    };
  });

  return (
    <DashboardOverviewClient 
      library={library}
      studentCount={studentCount}
      occupancyPercentage={occupancyPercentage}
      bookedSeats={bookedSeats}
      totalSeats={totalSeats}
      expiringCount={expiringCount}
      pendingQueries={pendingQueries}
      studentsInside={studentsInside}
      chartData={chartData}
      todaysAttendance={todaysAttendance}
      pendingApprovals={pendingApprovalsData}
      liveAccess={liveAccess}
      recentActivity={recentActivityData}
      todaysTransactions={todaysTransactionsData}
    />
  );
}
