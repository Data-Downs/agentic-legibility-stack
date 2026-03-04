"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}

export default function Section({
  title,
  defaultOpen,
  children,
  badge,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border border-studio-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
        {badge && (
          <span className="ml-auto text-xs font-normal text-gray-400">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}
