"use client";

import { useAppStore } from "@/lib/store";

interface JourneyCompleteCardProps {
  state: "claim-active" | "rejected" | "handed-off";
}

const STATE_CONFIG: Record<string, { icon: string; title: string; borderColor: string; badgeBg: string }> = {
  "claim-active": {
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Application complete",
    borderColor: "#00703c",
    badgeBg: "bg-green-100 text-green-800",
  },
  rejected: {
    icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Application unsuccessful",
    borderColor: "#d4351c",
    badgeBg: "bg-red-100 text-red-700",
  },
  "handed-off": {
    icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
    title: "Referred to advisor",
    borderColor: "#f47738",
    badgeBg: "bg-orange-100 text-orange-800",
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
      className="my-3 rounded-lg border bg-white"
      style={{ borderLeft: `4px solid ${config.borderColor}` }}
    >
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.borderColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={config.icon} />
          </svg>
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${config.badgeBg}`}>
            {config.title}
          </span>
        </div>

        <p className="text-xs text-govuk-dark-grey mb-4">
          This conversation has ended. Your details have been recorded.
        </p>

        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded font-bold text-sm text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: config.borderColor }}
        >
          Save application details
        </button>
      </div>
    </div>
  );
}
