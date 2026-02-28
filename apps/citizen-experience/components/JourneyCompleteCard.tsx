"use client";

import { useAppStore } from "@/lib/store";
import { TERMINAL_STATE_CONFIG } from "@als/schemas";
import type { TerminalStateConfig } from "@als/schemas";

interface JourneyCompleteCardProps {
  state: string;
  serviceName?: string;
  serviceId?: string;
}

/** Generate a deterministic reference number from a conversation ID */
function generateReference(conversationId: string | null): string {
  if (!conversationId) return "GOV-0000-0000";
  let hash = 0;
  for (let i = 0; i < conversationId.length; i++) {
    hash = ((hash << 5) - hash + conversationId.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash);
  const upper = ((abs >> 16) & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  const lower = (abs & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return `GOV-${upper}-${lower}`;
}

const FALLBACK_CONFIG: TerminalStateConfig = TERMINAL_STATE_CONFIG["completed"];

export function JourneyCompleteCard({ state, serviceName, serviceId }: JourneyCompleteCardProps) {
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);
  const activeConversationId = useAppStore((s) => s.activeConversationId);

  const config = TERMINAL_STATE_CONFIG[state] || FALLBACK_CONFIG;
  const reference = generateReference(activeConversationId);

  // Use service-specific title if a serviceName is provided
  const displayTitle = serviceName
    ? `${serviceName} — ${config.title.toLowerCase()}`
    : config.title;

  const handleReturnToDashboard = () => {
    startNewConversation(null);
    navigateTo("dashboard");
  };

  return (
    <div
      className={`my-3 rounded-2xl border ${config.borderClass} bg-white`}
      style={{ boxShadow: config.shadowStyle }}
    >
      <div className="px-5 py-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`w-7 h-7 rounded-full ${config.iconBgClass} flex items-center justify-center shrink-0`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={config.borderColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={config.icon} />
            </svg>
          </span>
          <span className={`text-sm font-bold ${config.titleClass}`}>
            {displayTitle}
          </span>
        </div>

        {/* Reference number */}
        <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Reference
          </span>
          <p className="text-sm font-mono font-bold text-govuk-black mt-0.5">
            {reference}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-govuk-dark-grey mb-2">
          {config.description}
        </p>

        {/* Next steps */}
        <p className="text-xs text-govuk-dark-grey mb-5">
          <span className="font-semibold">Next steps:</span> {config.nextSteps}
        </p>

        {/* Return to dashboard button */}
        <button
          onClick={handleReturnToDashboard}
          className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: config.borderColor }}
        >
          Return to dashboard
        </button>
      </div>
    </div>
  );
}
