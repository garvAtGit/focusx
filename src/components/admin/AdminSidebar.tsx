'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  Cpu,
  Activity,
  ArrowUpCircle,
  Bell,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { logout } from '@/app/actions/auth-actions';

interface AdminSidebarProps {
  userEmail?: string | null;
  userPhone?: string | null;
}

const NAV_ITEMS = [
  {
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: 'Libraries & KYC',
    href: '/admin/libraries',
    icon: Building2,
  },
  {
    label: 'Users & Students',
    href: '/admin/users',
    icon: Users,
  },
  {
    label: 'Admin Team',
    href: '/admin/team',
    icon: ShieldCheck,
  },
  {
    label: 'Bookings & Ledger',
    href: '/admin/bookings',
    icon: CreditCard,
  },
  {
    label: 'OTA Fleet Rollout',
    href: '/admin/ota',
    icon: ArrowUpCircle,
  },
  {
    label: 'Hardware & IoT',
    href: '/admin/machines',
    icon: Cpu,
  },
  {
    label: 'Notifications',
    href: '/admin/notifications',
    icon: Bell,
  },
  {
    label: 'System & Outbox',
    href: '/admin/system',
    icon: Activity,
  },
];

export function AdminSidebar({ userEmail, userPhone }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const navContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center p-1 shadow-inner">
            <Image
              src="/final-logo.svg"
              alt="FocusX Logo"
              width={26}
              height={26}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">FocusX</span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                HQ
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Command Center</span>
          </div>
        </Link>
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Management
        </div>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-red-600/15 text-red-400 border border-red-500/30 font-semibold shadow-sm shadow-red-500/5'
                  : 'text-slate-300 hover:bg-slate-900/80 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    active ? 'text-red-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {active && <ChevronRight className="w-3.5 h-3.5 text-red-400" />}
            </Link>
          );
        })}

        <div className="pt-6 px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Portals
        </div>
        <Link
          href="/dashboard"
          target="_blank"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900/80 hover:text-white transition-all border border-transparent group"
        >
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-slate-200" />
            <span>Library Dashboard</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
        </Link>
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900/80 hover:text-white transition-all border border-transparent group"
        >
          <div className="flex items-center gap-3">
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-200" />
            <span>Public Student App</span>
          </div>
        </Link>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-amber-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow">
              SA
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {userEmail || userPhone || 'Super Administrator'}
              </span>
              <span className="text-[10px] text-red-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Root Authority
              </span>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden h-14 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-sm text-white">FocusX Command Center</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
          Superuser
        </span>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-72 h-full animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 z-30">
        {navContent}
      </aside>
    </>
  );
}
