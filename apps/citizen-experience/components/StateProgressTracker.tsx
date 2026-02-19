"use client";

interface StateProgressProps {
  currentState: string;
  stateHistory: string[];
}

const MILESTONES = [
  { label: "Identity", states: ["not-started", "identity-verified"] },
  { label: "Eligibility", states: ["eligibility-checked"] },
  { label: "Consent", states: ["consent-given"] },
  { label: "Details", states: ["personal-details-collected", "housing-details-collected", "income-details-collected", "bank-details-verified"] },
  { label: "Submit", states: ["claim-submitted"] },
  { label: "Active", states: ["awaiting-interview", "claim-active"] },
];

const TERMINAL_STATES = ["claim-active", "rejected", "handed-off"];

function getMilestoneStatus(
  milestone: typeof MILESTONES[number],
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

export function StateProgressTracker({ currentState, stateHistory }: StateProgressProps) {
  if (TERMINAL_STATES.includes(currentState) && currentState !== "claim-active") {
    return null; // Don't show progress for rejected/handed-off
  }

  // Human-readable current state
  const stateLabels: Record<string, string> = {
    "not-started": "Getting started",
    "identity-verified": "Identity verified",
    "eligibility-checked": "Eligibility checked",
    "consent-given": "Consent granted",
    "personal-details-collected": "Personal details",
    "housing-details-collected": "Housing details",
    "income-details-collected": "Income details",
    "bank-details-verified": "Bank verified",
    "claim-submitted": "Claim submitted",
    "awaiting-interview": "Interview scheduled",
    "claim-active": "Claim active",
  };

  return (
    <div className="bg-white border-b border-govuk-mid-grey px-4 py-3">
      {/* Current state label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-govuk-dark-grey">
          UC Application Progress
        </span>
        <span className="text-xs font-medium text-govuk-blue">
          {stateLabels[currentState] || currentState}
        </span>
      </div>

      {/* Milestone steps */}
      <div className="flex items-center gap-1">
        {MILESTONES.map((milestone, idx) => {
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
              {idx < MILESTONES.length - 1 && (
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
