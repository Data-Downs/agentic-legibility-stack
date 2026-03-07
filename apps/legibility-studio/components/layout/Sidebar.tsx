"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  FileSearch,
  BarChart3,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Mail,
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
    label: "Personas",
    href: "/personas",
    icon: <Users size={18} />,
    matchPrefix: "/personas",
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

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  if (item.disabled) {
    return (
      <span
        className={`flex items-center gap-3 py-2.5 text-sm text-gray-400 cursor-not-allowed select-none ${collapsed ? "justify-center px-0" : "px-4"}`}
        title={collapsed ? item.label : undefined}
      >
        {item.icon}
        {!collapsed && item.label}
      </span>
    );
  }

  return (
    <a
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 py-2.5 text-sm transition-colors ${collapsed ? "justify-center px-0" : "px-4"} ${
        active
          ? "text-gray-900 font-semibold"
          : "text-gray-500 hover:text-gray-900"
      }`}
    >
      {item.icon}
      {!collapsed && item.label}
    </a>
  );
}

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 bg-studio-body border-r border-studio-border flex flex-col z-30 transition-[width] duration-200"
      style={{ width: collapsed ? "56px" : "var(--sidebar-width)" }}
    >
      {/* Brand */}
      <div className={`h-14 flex items-center ${collapsed ? "justify-center" : "px-5 justify-between"}`}>
        {!collapsed && (
          <a href="/" className="text-gray-900 font-bold text-base tracking-tight">
            Legibility Studio
          </a>
        )}
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 pt-4">
        {!collapsed && (
          <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Main
          </p>
        )}
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={isActive(pathname, item)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {!collapsed && (
          <p className="px-4 mt-8 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            System
          </p>
        )}
        {collapsed && <div className="mt-8" />}
        <div className="space-y-0.5">
          {systemNav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={isActive(pathname, item)}
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className={`border-t border-studio-border ${collapsed ? "py-3 px-2" : "px-4 py-4"}`}>
        {collapsed ? (
          <a
            href="mailto:chris@datadowns.com"
            title="chris@datadowns.com"
            className="flex justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Mail size={16} />
          </a>
        ) : (
          <>
            <p className="text-[11px] text-gray-400">Agentic Legibility Stack</p>
            <p className="text-[11px] text-gray-400 mt-1">
              A project by Chris Downs
            </p>
            <a
              href="mailto:chris@datadowns.com"
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 mt-0.5"
            >
              <Mail size={10} />
              chris@datadowns.com
            </a>
            <p className="text-[10px] text-gray-300 mt-2">&copy; {new Date().getFullYear()} Chris Downs</p>
          </>
        )}
      </div>
    </aside>
  );
}
