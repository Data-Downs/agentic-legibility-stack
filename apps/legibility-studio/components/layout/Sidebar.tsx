"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  FileSearch,
  BarChart3,
  Settings,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPrefix?: string;
  disabled?: boolean;
}

const mainNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: "Services",
    href: "/services",
    icon: <Server size={18} />,
    matchPrefix: "/services",
  },
  {
    label: "Evidence",
    href: "/evidence",
    icon: <FileSearch size={18} />,
    matchPrefix: "/evidence",
  },
  {
    label: "Gap Analysis",
    href: "/gap-analysis",
    icon: <BarChart3 size={18} />,
    matchPrefix: "/gap-analysis",
  },
];

const systemNav: NavItem[] = [
  {
    label: "Settings",
    href: "#",
    icon: <Settings size={18} />,
    disabled: true,
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) {
    return pathname.startsWith(item.matchPrefix);
  }
  return pathname === item.href;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (item.disabled) {
    return (
      <span className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed select-none">
        {item.icon}
        {item.label}
      </span>
    );
  }

  return (
    <a
      href={item.href}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        active
          ? "text-gray-900 font-semibold"
          : "text-gray-500 hover:text-gray-900"
      }`}
    >
      {item.icon}
      {item.label}
    </a>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[var(--sidebar-width)] bg-studio-body border-r border-studio-border flex flex-col z-30">
      {/* Brand */}
      <div className="h-14 flex items-center px-5">
        <a href="/" className="text-gray-900 font-bold text-base tracking-tight">
          Legibility Studio
        </a>
      </div>

      {/* Main nav */}
      <nav className="flex-1 pt-4">
        <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Main
        </p>
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={isActive(pathname, item)}
            />
          ))}
        </div>

        <p className="px-4 mt-8 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          System
        </p>
        <div className="space-y-0.5">
          {systemNav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={isActive(pathname, item)}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-studio-border">
        <p className="text-[11px] text-gray-400">Agentic Legibility Stack</p>
      </div>
    </aside>
  );
}
