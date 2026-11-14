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
  Zap,
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
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto overflow-x-hidden min-h-0 focusx-sidebar-scroll">
          <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Menu
          </div>
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
          {isVisible('/dashboard/rules') && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/rules" icon={<Zap />}>
              Automations
            </NavItem>
          )}

          {(isVisible('/dashboard/staff') || isVisible('/dashboard/widgets') || isVisible('/dashboard/settings')) && (
            <div className="pt-2">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-t border-sidebar-border/40 pt-2">
                System
              </div>
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
            </div>
          )}
        </nav>
        
        <div className="p-2.5 border-t border-sidebar-border shrink-0 bg-sidebar/50">
          <form action={logout}>
            <button type="submit" className="w-full text-left px-2.5 py-1.5 rounded-md font-medium text-xs text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-between group">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4"><LogOut className="w-4 h-4" /></span>
                Logout
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-destructive opacity-70">Sign out</span>
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
