"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, GitBranch, RefreshCw, Users, BarChart2, Database, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          label: "Dashboard",      icon: LayoutDashboard, roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/pipeline",  label: "New Logo Deals", icon: GitBranch,       roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/renewals",  label: "Renewal Deals",  icon: RefreshCw,       roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/leads",     label: "Leads",          icon: Users,           roles: ["FINANCE", "LEADERSHIP", "REVGEN", "OTHER"] },
  { href: "/analyzer",  label: "Analyzer",       icon: BarChart2,       roles: ["FINANCE", "LEADERSHIP", "REVGEN"] },
  { href: "/sources",   label: "Data Sources",   icon: Database,        roles: ["FINANCE"] },
  { href: "/settings",  label: "Settings",       icon: Settings,        roles: ["FINANCE"] },
] as const;

interface SidebarProps {
  userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(userRole)
  );

  return (
    <aside
      className="peer group fixed top-0 left-0 z-50 flex flex-col min-h-screen
                 w-[54px] hover:w-[220px]
                 transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]
                 bg-navy overflow-hidden shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)]"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-[17px] border-b border-white/10 min-h-[63px] flex-shrink-0">
        <div className="w-7 min-w-[28px] h-7 rounded-lg bg-teal flex items-center justify-center text-white font-extrabold text-[10px] flex-shrink-0 tracking-tight shadow-sm">
          KH
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-[50ms] overflow-hidden whitespace-nowrap">
          <p className="text-white font-bold text-[13px] tracking-tight leading-none">Koda Health</p>
          <p className="text-white/40 text-[9px] uppercase tracking-widest mt-0.5">Revenue Intel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1.5 py-2 flex flex-col gap-px overflow-hidden">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "flex items-center gap-2.5 px-[7px] py-[5px] rounded-lg transition-colors duration-100 whitespace-nowrap",
                isActive
                  ? "bg-teal/25 ring-1 ring-teal/40 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <div className={clsx(
                "w-[22px] min-w-[22px] h-[22px] rounded-[5px] flex items-center justify-center flex-shrink-0",
                isActive ? "bg-teal/30" : "bg-white/10"
              )}>
                <Icon className={clsx("w-3.5 h-3.5", isActive ? "text-teal" : "text-white/70")} />
              </div>
              <span className={clsx(
                "text-[12px] font-medium overflow-hidden",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-[50ms]",
                isActive && "text-white font-semibold"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-1.5 py-2 border-t border-white/10 flex-shrink-0">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-[50ms] px-2 pb-1">
          <p className="text-[10px] text-white/30 whitespace-nowrap">Pipeline Intelligence</p>
        </div>
      </div>
    </aside>
  );
}
