"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface JsonSectionProps {
  label: string;
  value: unknown;
  onChange: (updated: unknown) => void;
}

export default function JsonSection({ label, value, onChange }: JsonSectionProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    try {
      const parsed = JSON.parse(text);
      setError(null);
      onChange(parsed);
    } catch {
      setError("Invalid JSON");
    }
  }

  function handleToggle() {
    if (!open) {
      // Refresh text from current value when opening
      setText(JSON.stringify(value, null, 2));
      setError(null);
    }
    setOpen(!open);
  }

  const lineCount = text.split("\n").length;

  return (
    <div className="border border-studio-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {label}
      </button>
      {open && (
        <div className="p-4 bg-white">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            rows={Math.min(Math.max(lineCount + 1, 4), 24)}
            className={`w-full font-mono text-xs border rounded-lg px-3 py-2 focus:outline-none ${
              error
                ? "border-red-400 focus:border-red-500"
                : "border-studio-border focus:border-studio-accent"
            }`}
            spellCheck={false}
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
