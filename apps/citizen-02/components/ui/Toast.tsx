"use client";

import { useAppStore } from "@/lib/store";

export function Toast() {
  const toast = useAppStore((s) => s.toast);

  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-govuk-black text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-toast-in"
      role="status"
      aria-live="polite"
    >
      {toast.text}
    </div>
  );
}
