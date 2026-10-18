import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth-actions";
import { Suspense } from "react";

async function AdminAuthWrapper({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }

  // Admin Check / Auto-Upgrade
  if (session.role !== "ADMIN") {
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase()) : [];
    const adminPhones = process.env.ADMIN_PHONES ? process.env.ADMIN_PHONES.split(",").map(p => p.trim()) : [];
    
    if (
      (session.email && adminEmails.includes(session.email.toLowerCase())) ||
      (session.phone && adminPhones.includes(session.phone))
    ) {
      // Auto-upgrade to ADMIN
      await prisma.user.update({
        where: { id: session.userId },
        data: { role: "ADMIN" }
      });
    } else {
      redirect("/dashboard"); // Redirect unauthorized users
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin Navbar */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2 group">
            <Image src="/final-logo.svg" alt="FocusX Logo" width={48} height={48} className="object-contain" />
            <span className="text-xl font-heading font-bold text-primary">Admin Control</span>
          </Link>
          <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-full font-bold uppercase tracking-wide">
            Superuser
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{session.email}</span>
          <form action={logout}>
            <button type="submit" className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-muted-foreground font-medium">Loading Admin Portal...</p>
        </div>
      </div>
    }>
      <AdminAuthWrapper>{children}</AdminAuthWrapper>
    </Suspense>
  );
}
