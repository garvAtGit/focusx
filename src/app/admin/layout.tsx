import { redirect } from "next/navigation";
import { getSession, logout } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ShieldAlert, LogOut, ArrowLeft } from "lucide-react";
import Link from "next/link";

async function AdminAuthWrapper({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const currentPath = headerStore.get('x-pathname') || '';

  // Allow /admin/login to render without layout wrapping
  if (currentPath.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  const session = await getSession();
  
  if (!session) {
    redirect("/admin/login");
  }

  // Admin Verification & Whitelist Promotion
  if (session.role !== "ADMIN") {
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
      : [];
    const adminPhones = process.env.ADMIN_PHONES
      ? process.env.ADMIN_PHONES.split(",").map((p) => p.trim())
      : [];

    const isMatch =
      (session.email && adminEmails.includes(session.email.toLowerCase())) ||
      (session.phone && adminPhones.includes(session.phone));

    if (isMatch) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { role: "ADMIN" },
      });
      try {
        await redis.del(`usersess:${session.userId}`);
      } catch {}
    } else {
      // Clean, unambiguous 403 Access Denied screen instead of silent bounce
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl relative">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied (403)</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your account <span className="text-white font-medium">({session.phone || session.email})</span> is registered with role{' '}
              <span className="text-amber-400 font-semibold">{session.role}</span> and does not have Super Admin authorization.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Go to Library Dashboard
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Switch Account / Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-slate-900 flex">
      {/* Persistent Left Sidebar */}
      <AdminSidebar userEmail={session.email} userPhone={session.phone} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin mb-4" />
            <p className="text-slate-400 font-medium">Loading FocusX Command Center...</p>
          </div>
        </div>
      }
    >
      <AdminAuthWrapper>{children}</AdminAuthWrapper>
    </Suspense>
  );
}
