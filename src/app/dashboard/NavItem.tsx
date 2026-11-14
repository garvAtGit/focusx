'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function NavItem({ 
  href, 
  onClick, 
  icon, 
  children,
  badge,
  compact = true,
}: { 
  href: string;
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
  compact?: boolean;
}) {
  const pathname = usePathname();
  
  // Exact match for /dashboard, prefix match for others
  const isActive = href === "/dashboard" 
    ? pathname === "/dashboard" 
    : pathname.startsWith(href);

  return (
    <Link 
      href={href} 
      onClick={onClick}
      prefetch={true}
      className={`group flex items-center justify-between rounded-lg font-medium transition-all duration-150 ${
        compact 
          ? 'px-2.5 py-1.5 text-[13px] gap-2.5' 
          : 'px-4 py-2 text-sm gap-3'
      } ${
        isActive 
          ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs' 
          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 hover:text-sidebar-foreground'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 truncate">
        {icon && (
          <span className={`w-4 h-4 flex items-center justify-center shrink-0 transition-colors ${
            isActive ? 'text-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'
          } [&>svg]:w-4 [&>svg]:h-4`}>
            {icon}
          </span>
        )}
        <span className="truncate">{children}</span>
      </div>
      {badge && <span className="shrink-0">{badge}</span>}
    </Link>
  );
}
