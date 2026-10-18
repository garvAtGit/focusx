'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function NavItem({ href, onClick, icon, children }: { href: string, onClick?: () => void, icon?: ReactNode, children: ReactNode }) {
  const pathname = usePathname();
  
  // Exact match for /dashboard, prefix match for others
  const isActive = href === "/dashboard" 
    ? pathname === "/dashboard" 
    : pathname.startsWith(href);

  return (
    <Link 
      href={href} 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${
        isActive 
          ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground'
      }`}
    >
      {icon && <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>}
      {children}
    </Link>

  );
}
