"use client";

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-govuk-green bg-govuk-green/10 px-1.5 py-0.5 rounded">
      <span className="w-1.5 h-1.5 rounded-full bg-govuk-green animate-pulse" />
      Live
    </span>
  );
}
