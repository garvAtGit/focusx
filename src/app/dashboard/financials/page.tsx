import { formatStandardDate } from "@/lib/date-utils";
import { calculateBookingTotal } from "@/lib/pricing-utils";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Wallet, TrendingUp, DollarSign, TrendingDown, CreditCard, Info } from "lucide-react";
import FinancialCharts from "./FinancialCharts";
import { ExpenseForm, DeleteExpenseButton } from "./ExpenseForm";
import DateRangeFilter from "@/components/DateRangeFilter";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { MathReveal } from "./MathReveal";

export default async function FinancialsPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string, to?: string, page?: string }>
}) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  const sp = await searchParams;
  const fromDate = sp?.from ? new Date(sp.from) : undefined;
  const toDate = sp?.to ? new Date(sp.to) : undefined;
  
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  const dateFilter = fromDate || toDate ? {
    gte: fromDate,
    lte: toDate
  } : undefined;

  const bookings = await prisma.booking.findMany({
    where: { 
      libraryId: library.id,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      ...(dateFilter ? { createdAt: dateFilter } : {})
    },
    include: {
      plan: true,
      standaloneLocker: true,
      student: true,
      seat: true,
      bookingIntent: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const cancelledBookings = await prisma.booking.findMany({
    where: { 
      libraryId: library.id,
      status: 'CANCELLED',
      ...(dateFilter ? { createdAt: dateFilter } : {})
    },
    include: {
      plan: true,
      student: true,
      bookingIntent: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Fetch expenses
  const expensesList = await prisma.expense.findMany({
    where: { 
      libraryId: library.id,
      ...(dateFilter ? { date: dateFilter } : {})
    },
    orderBy: { createdAt: 'desc' }
  });

  const currentPage = parseInt(sp?.page || '1', 10);
  const perPage = 15;
  const totalPages = Math.ceil(bookings.length / perPage);
  const paginatedBookings = bookings.slice((currentPage - 1) * perPage, currentPage * perPage);

  let totalRealizedRevenue = 0;
  let totalCashCollected = 0;
  let totalOnlineCollected = 0;
  let totalDuesPending = 0;

  bookings.forEach(b => {
    const total = calculateBookingTotal(b);
    totalRealizedRevenue += total;

    if (b.amountPaidCashPaise != null || b.amountPaidOnlinePaise != null || b.amountDuePaise != null) {
      totalCashCollected += (b.amountPaidCashPaise || 0) / 100;
      totalOnlineCollected += (b.amountPaidOnlinePaise || 0) / 100;
      totalDuesPending += (b.amountDuePaise || 0) / 100;
    } else {
      // Legacy bookings fallback
      if (b.paymentRef?.startsWith('RECEPTION_')) {
        totalCashCollected += total;
      } else {
        totalOnlineCollected += total;
      }
    }
  });

  let totalLostRevenue = 0;
  cancelledBookings.forEach(b => {
    totalLostRevenue += calculateBookingTotal(b);
  });

  const suspiciousRevocations = cancelledBookings.filter(b => {
    const diffInHours = (new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);
    return diffInHours > 24;
  });

  const totalExpenses = expensesList.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfit = totalRealizedRevenue - totalExpenses;

  return (
    <div className="w-full space-y-8 font-sans pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none">Financial Overview</h1>
          <p className="text-sm font-medium text-slate-500 mt-2">Track your real cash flow, expenses, and net profit.</p>
        </div>
      </div>

      <div className="bg-white px-6 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200">
        <Suspense fallback={<div className="h-10" />}>
          <DateRangeFilter />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 relative">
        
        {/* 1. Net Profit (Hero) */}
        <div className="bg-slate-900 p-7 rounded-[3rem] border border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-slate-700 transition-all duration-300 group flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0085FF] opacity-20 blur-[50px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-300">Net Profit</span>
            <div className="p-2.5 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors tooltip-trigger relative">
              <DollarSign className="w-5 h-5 text-[#0085FF]" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">₹{netProfit.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${netProfit >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{netProfit >= 0 ? "Profitable" : "Operating at a loss"}</span>
            </div>
            <MathReveal mathText="REALIZED REVENUE - TOTAL EXPENSES" theme="dark" />
          </div>
        </div>

        {/* 2. Realized Revenue */}
        <div className="bg-[#C6F135] p-7 rounded-[3rem] border border-[#b5e022] shadow-[0_8px_30px_rgba(198,241,53,0.15)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-20 rounded-full blur-[40px] pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-800">Realized Revenue</span>
            <div className="p-2.5 bg-white/40 backdrop-blur-sm rounded-xl">
              <TrendingUp className="w-5 h-5 text-slate-900" />
            </div>
          </div>
          <div className="relative z-10 mt-auto">
            <h3 className="text-4xl font-black text-slate-900 tracking-tight drop-shadow-sm">₹{(totalCashCollected + totalOnlineCollected).toLocaleString()}</h3>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-700">
              <span className="bg-white/50 px-2 py-1 rounded-md">Cash: ₹{totalCashCollected.toLocaleString()}</span>
              <span className="bg-white/50 px-2 py-1 rounded-md">Online: ₹{totalOnlineCollected.toLocaleString()}</span>
              {totalDuesPending > 0 && <span className="bg-rose-500 text-white px-2 py-1 rounded-md">Dues: ₹{totalDuesPending.toLocaleString()}</span>}
            </div>
          </div>
        </div>

        {/* 3. Total Expenses */}
        <div className="bg-white p-7 rounded-[3rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <span className="text-sm font-bold text-slate-500">Total Expenses</span>
            <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
              <Wallet className="w-5 h-5 text-slate-900" />
            </div>
          </div>
          <div className="mt-auto">
            <h3 className="text-4xl font-black text-slate-900 tracking-tight">₹{totalExpenses.toLocaleString()}</h3>
            <MathReveal mathText="SUM OF ALL RECORDED EXPENSES (BILLS, RENT)." theme="light" />
          </div>
        </div>

        {/* 4. Lost / Revoked */}
        <div className="bg-white p-7 rounded-[3rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-72 h-72 bg-rose-500/10 rounded-full blur-[60px] pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <span className="text-sm font-bold text-slate-500">Lost / Revoked</span>
            <div className="p-2.5 bg-white border border-slate-100 shadow-sm rounded-xl">
              <TrendingDown className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div className="relative z-10 mt-auto">
            <h3 className="text-4xl font-black text-slate-900 tracking-tight">₹{totalLostRevenue.toLocaleString()}</h3>
            <MathReveal mathText="SUM OF ALL CANCELLED BOOKINGS. ALREADY EXCLUDED FROM REVENUE." theme="light" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-start">
        
        {/* Expenses Manager */}
        <div className="bg-white border border-slate-200/60 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden h-[500px]">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Manage Expenses</h2>
            <p className="text-[13px] font-semibold text-slate-500 mt-1">Add monthly bills or one-time expenses here.</p>
          </div>
          
          <div className="p-8 flex-1 overflow-y-auto">
            <ExpenseForm libraryId={library.id} />

            <div className="mt-8">
              <h3 className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">Recent Expenses</h3>
              {expensesList.length === 0 ? (
                <div className="text-sm text-slate-500 py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  No expenses recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {expensesList.map(exp => (
                    <div key={exp.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div>
                        <p className="font-bold text-[15px] text-slate-900 leading-tight">{exp.name}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{formatStandardDate(exp.date)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-[15px] text-rose-500">₹{exp.amount.toLocaleString()}</span>
                        <DeleteExpenseButton expenseId={exp.id} libraryId={library.id} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="bg-white border border-slate-200/60 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden h-[500px]">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Profit vs Expenses</h2>
            <p className="text-[13px] font-semibold text-slate-500 mt-1">Visual breakdown of your financial health.</p>
          </div>
          
          <div className="p-6 flex-1 flex items-center justify-center">
            <FinancialCharts revenue={totalRealizedRevenue} expenses={totalExpenses} netProfit={netProfit} />
          </div>
        </div>
      </div>

      {session.role === 'ADMIN' && suspiciousRevocations.length > 0 && (
        <div className="bg-rose-50 border border-rose-200/60 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden">
          <div className="p-8 border-b border-rose-100 flex items-center justify-between bg-white/50">
            <div>
              <h2 className="text-xl font-black text-rose-600 tracking-tight flex items-center gap-3">
                <TrendingDown className="w-6 h-6" /> Suspicious Revocations
              </h2>
              <p className="text-[13px] font-semibold text-rose-500/80 mt-1 max-w-2xl">
                These plans were revoked more than 24 hours after they were purchased. This could indicate a librarian collected cash for a long-term plan, then manually cancelled it later to pocket the difference.
              </p>
            </div>
            <span className="bg-rose-600 text-white text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full font-black shadow-sm shrink-0">Requires Audit</span>
          </div>
          
          <div className="p-8 bg-white/30 space-y-4">
            {suspiciousRevocations.map(b => {
              const diffInDays = Math.floor((new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              const hoursDiff = Math.floor((new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60)) % 24;
              let price = b.plan?.price || 0;
              if (b.plan?.discount) price -= (price * b.plan.discount / 100);
              
              return (
                <div key={b.id} className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center hover:border-rose-300 transition-colors">
                  <div>
                    <div className="font-black text-slate-900 text-[15px]">{b.student?.name} <span className="text-slate-400 font-mono text-[11px] ml-2 font-semibold">{b.student?.uniqueId}</span></div>
                    <div className="text-[13px] font-semibold text-slate-500 mt-1">Plan: <span className="font-bold text-slate-900">{b.plan?.name}</span> (₹{price})</div>
                    <div className="text-[13px] font-semibold text-slate-500 mt-1">Reason: <span className="italic text-rose-500">&ldquo;{b.revokedReason || 'No reason provided'}&rdquo;</span></div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl text-[11px] uppercase tracking-wider">
                      Revoked {diffInDays > 0 ? `${diffInDays} days ` : ''}{hoursDiff} hours late
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">{formatStandardDate(b.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 z-10">
           <h2 className="text-xl font-black text-slate-900 tracking-tight">Transaction History</h2>
        </div>
        
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th className="p-6 text-[10px] uppercase tracking-widest font-black text-slate-400">Date & Time</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-black text-slate-400">Student & Plan</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-black text-slate-400">Payment Ref</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-black text-slate-400 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedBookings.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-[13px] font-semibold text-slate-500">No transactions found for this period.</td></tr>
              ) : (
                paginatedBookings.map((b) => {
                  const price = calculateBookingTotal(b);
                  
                  const isRazorpay = b.paymentRef?.startsWith('pay_');
                  const isManual = b.paymentRef?.startsWith('MANUAL_');
                  const isRenewal = b.paymentRef?.startsWith('RENEWAL_');
                  const isReception = b.paymentRef?.startsWith('RECEPTION_');
                  
                  let payMethod = "Cash/Manual";
                  if (isRazorpay) payMethod = "Razorpay";
                  else if (isRenewal) payMethod = b.paymentRef?.includes('ONLINE') ? "Renewal (Online)" : "Renewal (Cash)";
                  else if (isReception) payMethod = b.paymentRef?.includes('ONLINE') ? "Reception (Online)" : "Reception (Cash)";
                  else if (isManual && b.paymentRef?.includes('ONLINE')) payMethod = "Manual (Online)";

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-[14px] font-bold text-slate-900">{formatStandardDate(b.createdAt)}</div>
                        <div className="text-[11px] font-semibold text-slate-500 mt-1">{b.createdAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-[15px] font-bold text-slate-900">{b.student?.name || 'Unknown'}</div>
                        <div className="text-[12px] font-semibold text-slate-500 mt-1">{b.plan?.name || 'Custom Plan'}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-mono text-[12px] font-bold text-slate-600">{b.paymentRef || 'No Ref'}</div>
                        <div className="mt-1.5 flex">
                          <span className="bg-slate-100 px-2 py-1 rounded-md text-[9px] uppercase font-black text-slate-500 tracking-wider">
                            {payMethod}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="text-[16px] font-black text-emerald-500 bg-emerald-50 inline-block px-3 py-1 rounded-xl">+₹{price.toFixed(0)}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-t border-slate-100 bg-slate-50/50 gap-4">
            <p className="text-[13px] font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{((currentPage - 1) * perPage) + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * perPage, bookings.length)}</span> of <span className="font-bold text-slate-900">{bookings.length}</span> transactions
            </p>
            <div className="flex gap-2">
              <a 
                href={`?from=${sp?.from || ''}&to=${sp?.to || ''}&page=${Math.max(1, currentPage - 1)}`}
                className={`px-4 py-2 rounded-xl border border-slate-200 text-[13px] font-bold shadow-sm ${currentPage === 1 ? 'opacity-50 cursor-not-allowed pointer-events-none bg-slate-50' : 'bg-white hover:bg-slate-50 text-slate-900 transition-colors'}`}
              >
                Previous
              </a>
              <a 
                href={`?from=${sp?.from || ''}&to=${sp?.to || ''}&page=${Math.min(totalPages, currentPage + 1)}`}
                className={`px-4 py-2 rounded-xl border border-slate-200 text-[13px] font-bold shadow-sm ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed pointer-events-none bg-slate-50' : 'bg-white hover:bg-slate-50 text-slate-900 transition-colors'}`}
              >
                Next
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
