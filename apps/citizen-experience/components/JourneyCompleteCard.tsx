"use client";

import { useAppStore } from "@/lib/store";

interface JourneyCompleteCardProps {
  state: "claim-active" | "rejected" | "handed-off";
}

const STATE_CONFIG: Record<string, { icon: string; title: string; borderColor: string; borderClass: string; shadowStyle: string; iconBgClass: string; titleClass: string }> = {
  "claim-active": {
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Application complete",
    borderColor: "#00703c",
    borderClass: "border-green-200",
    shadowStyle: "0 2px 8px rgba(0,112,60,0.08)",
    iconBgClass: "bg-green-100",
    titleClass: "text-green-700",
  },
  rejected: {
    icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Application unsuccessful",
    borderColor: "#d4351c",
    borderClass: "border-red-200",
    shadowStyle: "0 2px 8px rgba(212,53,28,0.08)",
    iconBgClass: "bg-red-100",
    titleClass: "text-red-700",
  },
  "handed-off": {
    icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
    title: "Referred to advisor",
    borderColor: "#f47738",
    borderClass: "border-orange-200",
    shadowStyle: "0 2px 8px rgba(244,119,56,0.08)",
    iconBgClass: "bg-orange-100",
    titleClass: "text-orange-700",
  },
};

export function JourneyCompleteCard({ state }: JourneyCompleteCardProps) {
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);

  const config = STATE_CONFIG[state] || STATE_CONFIG["claim-active"];

  const handleSave = () => {
    startNewConversation(null);
    navigateTo("dashboard");
  };

  return (
    <div
      className={`my-3 rounded-2xl border ${config.borderClass} bg-white`}
      style={{ boxShadow: config.shadowStyle }}
    >
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`w-7 h-7 rounded-full ${config.iconBgClass} flex items-center justify-center shrink-0`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={config.borderColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={config.icon} />
            </svg>
          </span>
          <span className={`text-sm font-bold ${config.titleClass}`}>
            {config.title}
          </span>
        </div>

        <p className="text-sm text-govuk-dark-grey mb-5">
          This conversation has ended. Your details have been recorded.
        </p>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: config.borderColor }}
        >
          Save application details
        </button>
      </div>
    </div>
  );
}
