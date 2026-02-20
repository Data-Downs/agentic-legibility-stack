"use client";

import { Search, Bell, User } from "lucide-react";

export default function TopBar() {
  return (
    <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-[var(--topbar-height)] bg-studio-topbar border-b border-white/10 flex items-center justify-between px-6 z-20">
      {/* Search */}
      <div className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search services, cases..."
          className="w-full bg-white/10 text-sm text-white placeholder-gray-500 rounded-lg pl-9 pr-4 py-2 border border-white/10 focus:outline-none focus:border-studio-accent"
          disabled
        />
      </div>

      {/* Right icons */}
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5 bg-studio-accent/20 text-studio-accent text-xs font-medium px-2.5 py-1 rounded-full">
          Prototype
        </span>
        <button className="text-gray-400 hover:text-white transition-colors" aria-label="Notifications" disabled>
          <Bell size={18} />
        </button>
        <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors" aria-label="User" disabled>
          <User size={16} />
        </button>
      </div>
    </header>
  );
}
