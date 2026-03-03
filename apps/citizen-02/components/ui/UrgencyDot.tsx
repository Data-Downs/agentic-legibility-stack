"use client";

type Urgency = "urgent" | "warning" | "ok" | "info";

const URGENCY_COLORS: Record<Urgency, string> = {
  urgent: "bg-govuk-red",
  warning: "bg-govuk-orange",
  ok: "bg-govuk-green",
  info: "bg-govuk-blue",
};

interface UrgencyDotProps {
  urgency: Urgency;
  size?: "sm" | "md";
}

export function UrgencyDot({ urgency, size = "sm" }: UrgencyDotProps) {
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  return (
    <span
      className={`${sizeClass} rounded-full ${URGENCY_COLORS[urgency]} inline-block shrink-0`}
      aria-label={`${urgency} urgency`}
    />
  );
}
