"use client";

import type { ServiceType } from "@/lib/types";

interface StateProgressProps {
  currentState: string;
  stateHistory: string[];
  service: ServiceType | null;
}

interface Milestone {
  label: string;
  states: string[];
}

// Per-service milestone definitions — derived from each state-model.json
const SERVICE_MILESTONES: Record<string, { title: string; milestones: Milestone[] }> = {
  benefits: {
    title: "UC Application Progress",
    milestones: [
      { label: "Identity", states: ["not-started", "identity-verified"] },
      { label: "Eligibility", states: ["eligibility-checked"] },
      { label: "Consent", states: ["consent-given"] },
      { label: "Details", states: ["personal-details-collected", "housing-details-collected", "income-details-collected", "bank-details-verified"] },
      { label: "Submit", states: ["claim-submitted"] },
      { label: "Active", states: ["awaiting-interview", "claim-active"] },
    ],
  },
  driving: {
    title: "Driving Licence Renewal",
    milestones: [
      { label: "Identity", states: ["not-started", "identity-verified"] },
      { label: "Eligibility", states: ["eligibility-checked"] },
      { label: "Consent", states: ["consent-given"] },
      { label: "Details", states: ["details-confirmed"] },
      { label: "Photo", states: ["photo-submitted"] },
      { label: "Payment", states: ["payment-made"] },
      { label: "Submit", states: ["application-submitted"] },
      { label: "Complete", states: ["completed"] },
    ],
  },
};

// Fallback: generic milestones for unknown services
const FALLBACK_CONFIG = {
  title: "Application Progress",
  milestones: [
    { label: "Identity", states: ["not-started", "identity-verified"] },
    { label: "Eligibility", states: ["eligibility-checked"] },
    { label: "Consent", states: ["consent-given"] },
    { label: "Complete", states: ["completed", "claim-active"] },
  ],
};

const TERMINAL_STATES = ["claim-active", "completed", "rejected", "handed-off"];

// Human-readable labels for all known states across services
const STATE_LABELS: Record<string, string> = {
  "not-started": "Getting started",
  "identity-verified": "Identity verified",
  "eligibility-checked": "Eligibility checked",
  "consent-given": "Consent granted",
  // UC states
  "personal-details-collected": "Personal details",
  "housing-details-collected": "Housing details",
  "income-details-collected": "Income details",
  "bank-details-verified": "Bank verified",
  "claim-submitted": "Claim submitted",
  "awaiting-interview": "Interview scheduled",
  "claim-active": "Claim active",
  // Driving licence states
  "details-confirmed": "Details confirmed",
  "photo-submitted": "Photo submitted",
  "payment-made": "Payment made",
  "application-submitted": "Application submitted",
  "completed": "Complete",
  // Terminal
  "rejected": "Rejected",
  "handed-off": "Handed off",
};

function getMilestoneStatus(
  milestone: Milestone,
  currentState: string,
  stateHistory: string[],
): "completed" | "current" | "future" {
  const isCurrent = milestone.states.includes(currentState);
  if (isCurrent) return "current";

  // Check if any state in this milestone has been visited
  const visited = milestone.states.some((s) => stateHistory.includes(s));
  if (visited) return "completed";

  return "future";
}

export function StateProgressTracker({ currentState, stateHistory, service }: StateProgressProps) {
  if (TERMINAL_STATES.includes(currentState) && currentState !== "claim-active" && currentState !== "completed") {
    return null; // Don't show progress for rejected/handed-off
  }

  const config = (service && SERVICE_MILESTONES[service]) || FALLBACK_CONFIG;

  return (
    <div className="bg-white border-b border-govuk-mid-grey px-4 py-3">
      {/* Current state label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-govuk-dark-grey">
          {config.title}
        </span>
        <span className="text-xs font-medium text-govuk-blue">
          {STATE_LABELS[currentState] || currentState}
        </span>
      </div>

      {/* Milestone steps */}
      <div className="flex items-center gap-1">
        {config.milestones.map((milestone, idx) => {
          const status = getMilestoneStatus(milestone, currentState, stateHistory);
          return (
            <div key={milestone.label} className="flex items-center flex-1 min-w-0">
              {/* Step dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    status === "completed"
                      ? "bg-green-600 text-white"
                      : status === "current"
                        ? "bg-govuk-blue text-white ring-2 ring-blue-200"
                        : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {status === "completed" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-[9px] mt-0.5 text-center leading-tight hidden sm:block ${
                    status === "current"
                      ? "font-bold text-govuk-blue"
                      : status === "completed"
                        ? "text-green-700"
                        : "text-gray-400"
                  }`}
                >
                  {milestone.label}
                </span>
              </div>

              {/* Connector line */}
              {idx < config.milestones.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 ${
                    status === "completed" ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
