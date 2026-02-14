"use client";

interface HandoffSummaryProps {
  handoffId: string;
  serviceAttempted: string;
  stepsCompleted: string[];
  stepsBlocked: string[];
  dataCollected: string[];
  suggestedActions: string[];
}

export default function HandoffSummary({
  handoffId,
  serviceAttempted,
  stepsCompleted,
  stepsBlocked,
  dataCollected,
  suggestedActions,
}: HandoffSummaryProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">Handoff Package</h3>
        <span className="text-xs text-gray-400 font-mono">{handoffId}</span>
      </div>

      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Service attempted
        </div>
        <div className="font-medium">{serviceAttempted}</div>
      </div>

      {stepsCompleted.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Completed steps
          </div>
          <ul className="text-sm space-y-1">
            {stepsCompleted.map((step, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-green-600">&#10003;</span> {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stepsBlocked.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Blocked steps
          </div>
          <ul className="text-sm space-y-1">
            {stepsBlocked.map((step, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-red-600">&#10007;</span> {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dataCollected.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Data already collected
          </div>
          <div className="flex flex-wrap gap-1">
            {dataCollected.map((field) => (
              <span
                key={field}
                className="text-xs bg-gray-100 border border-gray-300 px-2 py-0.5 rounded"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestedActions.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Suggested actions for agent
          </div>
          <ul className="text-sm space-y-1">
            {suggestedActions.map((action, i) => (
              <li key={i} className="text-gray-700">
                {i + 1}. {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
