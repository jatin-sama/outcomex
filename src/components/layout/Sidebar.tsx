import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FileSpreadsheet,
  Network,
  Calculator,
  Download,
  Settings,
  History,
} from "lucide-react";

interface SidebarProps {
  currentPath?: string;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses & Offerings", icon: BookOpen },
  { href: "/roster", label: "Student Roster", icon: Users },
  { href: "/marks", label: "Marks Entry & Import", icon: FileSpreadsheet },
  { href: "/mappings", label: "CO-PO Mappings", icon: Network },
  { href: "/attainment", label: "Attainment Engine", icon: Calculator },
  { href: "/reports", label: "Excel Reports", icon: Download },
  { href: "/history", label: "Audit & History", icon: History },
  { href: "/admin", label: "Department Admin", icon: Settings },
];

export function Sidebar({ currentPath = "/" }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          OBE Workflow Modules
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* System Status info box */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>Active Scheme</span>
          <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            60/40 v1
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          PCE Autonomous 2025-26 rules applied.
        </p>
      </div>
    </aside>
  );
}
