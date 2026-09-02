'use client'

import { useState } from "react"
import { NavItem } from "./NavItem"
import { Menu, LayoutDashboard, Grid, List, Users, MessageSquare, HelpCircle, Wallet, UserCheck, AppWindow, Settings, LogOut } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { logout } from "@/app/actions/auth-actions"
import { AdminLibrarySwitcher } from "@/components/AdminLibrarySwitcher"

export function MobileNav({ role, adminLibraries, activeLibraryId }: { role: string, adminLibraries?: { id: string, name: string }[], activeLibraryId?: string }) {
  const [open, setOpen] = useState(false)

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
          <NavItem onClick={() => setOpen(false)} href="/dashboard" icon={<LayoutDashboard />}>
            Overview
          </NavItem>
          {role !== 'RECEPTIONIST' && (
            <>
              <NavItem onClick={() => setOpen(false)} href="/dashboard/seats" icon={<Grid />}>
                Manage Seats
              </NavItem>
              <NavItem onClick={() => setOpen(false)} href="/dashboard/plans" icon={<List />}>
                Manage Plans
              </NavItem>
            </>
          )}
          <NavItem onClick={() => setOpen(false)} href="/dashboard/students" icon={<Users />}>
            Students
          </NavItem>
          <NavItem onClick={() => setOpen(false)} href="/dashboard/queries" icon={<MessageSquare />}>
            Queries
          </NavItem>
          <NavItem onClick={() => setOpen(false)} href="/dashboard/inquiries" icon={<HelpCircle />}>
            Inquiries
          </NavItem>
          {role !== 'RECEPTIONIST' && (
            <NavItem onClick={() => setOpen(false)} href="/dashboard/financials" icon={<Wallet />}>
              Financials
            </NavItem>
          )}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border mt-auto">
          {role !== 'RECEPTIONIST' && (
            <>
              <NavItem onClick={() => setOpen(false)} href="/dashboard/staff" icon={<UserCheck />}>
                Staff & Roles
              </NavItem>
              <NavItem onClick={() => setOpen(false)} href="/dashboard/widgets" icon={<AppWindow />}>
                Widgets
              </NavItem>
              <NavItem onClick={() => setOpen(false)} href="/dashboard/settings" icon={<Settings />}>
                Settings
              </NavItem>
            </>
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
