import { NavItem } from "./NavItem";
import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { MobileNav } from "./MobileNav";
import { logout, getSession } from "@/app/actions/auth-actions";
import { Suspense } from "react";
import { CommandPalette } from "@/components/command/CommandPalette";
import {
  Search,
  LayoutDashboard,
  Users,
  MessageSquare,
  HelpCircle,
  Wallet,
  Grid,
  List,
  ShieldCheck,
  UserCheck,
  AppWindow,
  Settings,
  LogOut,
  Zap,
  ScanLine,
  Bell,
  Lock,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { getEffectiveStaffPermissions } from "@/lib/permissions";
import { AdminLibrarySwitcher } from "@/components/AdminLibrarySwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";

async function DashboardAuthWrapper({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const activeLib = await getActiveLibrary(session);

  let adminLibraries: { id: string; name: string }[] = [];
  let activeLibraryId = "";
  if (session.role === 'ADMIN') {
    if (activeLib) activeLibraryId = activeLib.id;
    adminLibraries = await prisma.library.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Resolve user's effective permissions for active library
  const resolution = activeLib
    ? await getEffectiveStaffPermissions(session.userId, activeLib.id)
    : null;

  // Authorization gate: must be ADMIN, LIBRARIAN, or ACTIVE staff member
  const isAuthorizedStaff =
    session.role === 'ADMIN' ||
    session.role === 'LIBRARIAN' ||
    (resolution && resolution.status === 'ACTIVE');

  if (!isAuthorizedStaff) {
    redirect("/");
  }

  // Compute allowed navigation routes
  const allowedRoutes: string[] = [];
  if (session.role === 'ADMIN' || session.role === 'LIBRARIAN' || resolution?.isAdmin || resolution?.isOwner) {
      allowedRoutes.push(
        '/dashboard',
        '/dashboard/students',
        '/dashboard/notifications',
        '/dashboard/queries',
        '/dashboard/inquiries',
        '/dashboard/financials',
        '/dashboard/seats',
        '/dashboard/plans',
        '/dashboard/approvals',
        '/dashboard/scanner',
        '/dashboard/hardware',
        '/dashboard/staff',
        '/dashboard/widgets',
        '/dashboard/settings',
        '/dashboard/rules'
      );
    } else if (resolution && resolution.status === 'ACTIVE') {
      if (resolution.permissions.length > 0) allowedRoutes.push('/dashboard');
      if (resolution.permissions.includes('students.view')) allowedRoutes.push('/dashboard/students');
      if (resolution.permissions.includes('notifications.view')) allowedRoutes.push('/dashboard/notifications');
      if (resolution.permissions.includes('queries.view')) allowedRoutes.push('/dashboard/queries');
      if (resolution.permissions.includes('inquiries.view')) allowedRoutes.push('/dashboard/inquiries');
      if (resolution.permissions.includes('financials.view')) allowedRoutes.push('/dashboard/financials');
      if (resolution.permissions.includes('seats.view')) allowedRoutes.push('/dashboard/seats');
      if (resolution.permissions.includes('plans.view')) allowedRoutes.push('/dashboard/plans');
      if (resolution.permissions.includes('approvals.view')) allowedRoutes.push('/dashboard/approvals');
      if (
        resolution.permissions.includes('attendance.view') ||
        resolution.permissions.includes('attendance.manage')
      ) {
        allowedRoutes.push('/dashboard/scanner');
      }
      if (resolution.permissions.includes('hardware.view')) allowedRoutes.push('/dashboard/hardware');
      if (resolution.permissions.includes('staff.view')) allowedRoutes.push('/dashboard/staff');
      if (resolution.permissions.includes('widgets.view')) allowedRoutes.push('/dashboard/widgets');
      if (resolution.permissions.includes('settings.view')) allowedRoutes.push('/dashboard/settings');
      if (resolution.permissions.includes('rules.view')) allowedRoutes.push('/dashboard/rules');
  } else if (session.role === 'RECEPTIONIST') {
    // Safe fallback for legacy receptionists
    allowedRoutes.push('/dashboard', '/dashboard/students', '/dashboard/notifications', '/dashboard/queries', '/dashboard/inquiries', '/dashboard/approvals', '/dashboard/scanner');
  }

  const isVisible = (href: string) => allowedRoutes.includes(href);

  const librarianNotifications = await prisma.notification.findMany({
    where: {
      OR: [{ userId: session.userId }, { studentId: session.userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const displayRole = resolution?.isOwner
    ? 'OWNER'
    : resolution?.role !== 'NONE'
    ? resolution?.role
    : session.role;

  return (
    <NotificationProvider userId={session.userId} initialNotifications={librarianNotifications}>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-lg border-r border-sidebar-border hidden md:flex h-screen sticky top-0 shrink-0 select-none">
          <div className="px-4 pt-3.5 pb-2 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <Image src="/final-logo.svg" alt="FocusX Logo" width={34} height={34} className="object-contain shrink-0" />
              <span className="text-lg font-heading font-bold text-sidebar-primary tracking-tight">FocusX</span>
            </Link>
            <div className="mt-2.5 flex items-center justify-between px-2.5 py-1.5 bg-background/60 hover:bg-background/90 border border-border/80 rounded-md text-xs text-muted-foreground shadow-2xs transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 opacity-70" />
                <span className="text-[12px]">Search...</span>
              </div>
              <kbd className="font-sans text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border/60 tracking-wider opacity-70 font-mono">⌘K</kbd>
            </div>
            {session.role === 'ADMIN' && (
              <div className="space-y-1.5 mt-2">
                <AdminLibrarySwitcher 
                  libraries={adminLibraries} 
                  activeLibraryId={activeLibraryId} 
                />
                <Link
                  href="/admin"
                  className="flex items-center justify-between px-2.5 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-[11px] font-semibold transition-colors"
                >
                  <span>Command Center HQ</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-red-500/20 px-1 py-0.5 rounded">Superuser</span>
                </Link>
              </div>
            )}
          </div>
          
          <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto overflow-x-hidden min-h-0 focusx-sidebar-scroll">
            <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Menu
            </div>
            {isVisible('/dashboard') && (
              <NavItem href="/dashboard" icon={<LayoutDashboard />}>
                Overview
              </NavItem>
            )}
            {isVisible('/dashboard/students') && (
              <NavItem href="/dashboard/students" icon={<Users />}>
                Students
              </NavItem>
            )}
            {isVisible('/dashboard/notifications') && (
              <NavItem href="/dashboard/notifications" icon={<Bell />}>
                Notifications
              </NavItem>
            )}
            {isVisible('/dashboard/queries') && (
              <NavItem href="/dashboard/queries" icon={<MessageSquare />}>
                Queries
              </NavItem>
            )}
            {isVisible('/dashboard/inquiries') && (
              <NavItem href="/dashboard/inquiries" icon={<HelpCircle />}>
                Inquiries
              </NavItem>
            )}
            {isVisible('/dashboard/financials') && (
              <NavItem href="/dashboard/financials" icon={<Wallet />}>
                Financials
              </NavItem>
            )}
            {isVisible('/dashboard/seats') && (
              <NavItem href="/dashboard/seats" icon={<Grid />}>
                Manage Seats
              </NavItem>
            )}
            {isVisible('/dashboard/plans') && (
              <NavItem href="/dashboard/plans" icon={<List />}>
                Manage Plans
              </NavItem>
            )}
            {isVisible('/dashboard/approvals') && (
              <NavItem href="/dashboard/approvals" icon={<ShieldCheck />}>
                Pending Approvals
              </NavItem>
            )}
            {isVisible('/dashboard/scanner') && (
              <NavItem href="/dashboard/scanner" icon={<ScanLine />}>
                Web Scanner
              </NavItem>
            )}
            {isVisible('/dashboard/hardware') && (
              <NavItem href="/dashboard/hardware" icon={<ScanLine />}>
                Hardware Setup
              </NavItem>
            )}
            {isVisible('/dashboard/rules') && (
              <NavItem href="/dashboard/rules" icon={<Zap />}>
                Automations
              </NavItem>
            )}

            {(isVisible('/dashboard/staff') || isVisible('/dashboard/widgets') || isVisible('/dashboard/settings')) && (
              <div className="pt-2">
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-t border-sidebar-border/40 pt-2">
                  System
                </div>
                {isVisible('/dashboard/staff') && (
                  <NavItem href="/dashboard/staff" icon={<UserCheck />}>
                    Staff & Roles
                  </NavItem>
                )}
                {isVisible('/dashboard/widgets') && (
                  <NavItem href="/dashboard/widgets" icon={<AppWindow />}>
                    Widgets
                  </NavItem>
                )}
                {isVisible('/dashboard/settings') && (
                  <NavItem href="/dashboard/settings" icon={<Settings />}>
                    Settings
                  </NavItem>
                )}
              </div>
            )}
          </nav>

          <div className="p-2.5 border-t border-sidebar-border shrink-0 bg-sidebar/50">
            <form action={logout}>
              <button 
                type="submit" 
                className="w-full text-left px-2.5 py-1.5 rounded-md font-medium text-xs text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                    <LogOut className="w-4 h-4" />
                  </span>
                  <span>Logout</span>
                </div>
                <span className="text-[10px] text-muted-foreground group-hover:text-destructive opacity-70">Sign out</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden max-h-screen">
          {/* Desktop Top Header Bar with Live Bell */}
          <header className="hidden md:flex h-14 border-b border-sidebar-border bg-card/60 backdrop-blur-md items-center justify-between px-8 sticky top-0 z-30 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {session.role === 'ADMIN' ? 'Admin / Staff Portal' : activeLib?.name || 'Staff Dashboard'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full font-semibold">
                {displayRole}
              </span>
            </div>
          </header>

          {/* Mobile Header */}
          <header className="md:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <Image src="/final-logo.svg" alt="FocusX Logo" width={48} height={48} className="object-contain" />
              <span className="text-xl font-heading font-bold text-sidebar-primary hidden sm:block">FocusX</span>
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <MobileNav
                role={session.role}
                adminLibraries={adminLibraries}
                activeLibraryId={activeLibraryId}
                allowedRoutes={allowedRoutes}
              />
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
            {allowedRoutes.length === 0 ? (
              <div className="max-w-md mx-auto my-12 p-8 border border-border bg-card rounded-2xl shadow-sm text-center">
                <div className="w-12 h-12 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold font-heading text-foreground mb-2">Restricted Access</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Your staff account does not currently have permissions to view any dashboard modules. Please contact your library owner to request access.
                </p>
                <form action={logout}>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg text-sm transition-colors"
                  >
                    Logout
                  </button>
                </form>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
        
        <CommandPalette />
      </div>
    </NotificationProvider>
  );
}

export default function LibrarianLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-muted-foreground font-medium">Loading Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardAuthWrapper>{children}</DashboardAuthWrapper>
    </Suspense>
  );
}
