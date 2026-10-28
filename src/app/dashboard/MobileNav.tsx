'use client'

import { useState } from "react"
import { NavItem } from "./NavItem"
import {
  Menu,
  LayoutDashboard,
  Grid,
  List,
  Users,
  MessageSquare,
  HelpCircle,
  Wallet,
  UserCheck,
  AppWindow,
  Settings,
  LogOut,
  ScanLine,
  Bell,
  ShieldCheck,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { logout } from "@/app/actions/auth-actions"
import { AdminLibrarySwitcher } from "@/components/AdminLibrarySwitcher"

interface MobileNavProps {
  role: string;
  adminLibraries?: { id: string; name: string }[];
  activeLibraryId?: string;
  allowedRoutes?: string[];
}

export function MobileNav({
  role,
  adminLibraries,
  activeLibraryId,
  allowedRoutes,
}: MobileNavProps) {
  const [open, setOpen] = useState(false)

  const isVisible = (href: string) => {
    if (!allowedRoutes) return true;
    return allowedRoutes.includes(href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="p-2 md:hidden hover:bg-sidebar-accent rounded-lg transition-colors cursor-pointer text-sidebar-foreground">
        <Menu className="w-6 h-6" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar text-sidebar-foreground border-sidebar-border p-0 flex flex-col pt-12">
        <VisuallyHidden>
          <SheetTitle>Mobile Navigation</SheetTitle>
        </VisuallyHidden>
        {role === 'ADMIN' && adminLibraries && activeLibraryId && (
          <div className="px-4 pb-4 border-b border-sidebar-border mb-4">
            <AdminLibrarySwitcher 
              libraries={adminLibraries} 
              activeLibraryId={activeLibraryId} 
            />
          </div>
        )}
        <nav className="flex-1 px-4 space-y-2">
          {isVisible('/dashboard') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard" icon={<LayoutDashboard />}>
              Overview
            </NavItem>
          )}
          {isVisible('/dashboard/students') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/students" icon={<Users />}>
              Students
            </NavItem>
          )}
          {isVisible('/dashboard/notifications') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/notifications" icon={<Bell />}>
              Notifications
            </NavItem>
          )}
          {isVisible('/dashboard/queries') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/queries" icon={<MessageSquare />}>
              Queries
            </NavItem>
          )}
          {isVisible('/dashboard/inquiries') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/inquiries" icon={<HelpCircle />}>
              Inquiries
            </NavItem>
          )}
          {isVisible('/dashboard/financials') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/financials" icon={<Wallet />}>
              Financials
            </NavItem>
          )}
          {isVisible('/dashboard/seats') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/seats" icon={<Grid />}>
              Manage Seats
            </NavItem>
          )}
          {isVisible('/dashboard/plans') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/plans" icon={<List />}>
              Manage Plans
            </NavItem>
          )}
          {isVisible('/dashboard/approvals') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/approvals" icon={<ShieldCheck />}>
              Pending Approvals
            </NavItem>
          )}
          {isVisible('/dashboard/scanner') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/scanner" icon={<ScanLine />}>
              Web Scanner
            </NavItem>
          )}
          {isVisible('/dashboard/hardware') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/hardware" icon={<ScanLine />}>
              Hardware Setup
            </NavItem>
          )}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border mt-auto">
          {isVisible('/dashboard/staff') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/staff" icon={<UserCheck />}>
              Staff & Roles
            </NavItem>
          )}
          {isVisible('/dashboard/widgets') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/widgets" icon={<AppWindow />}>
              Widgets
            </NavItem>
          )}
          {isVisible('/dashboard/settings') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/settings" icon={<Settings />}>
              Settings
            </NavItem>
          )}
          <form action={logout}>
            <button type="submit" className="w-full text-left px-4 py-2.5 mt-2 rounded-lg font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center shrink-0"><LogOut className="w-5 h-5" /></span>
              Logout
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
