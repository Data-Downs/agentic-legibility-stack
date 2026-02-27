"use client";

interface TaskCardProps {
  task: {
    id: string;
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string | null;
    dataNeeded?: string[];
  };
  completion?: string;
  onComplete?: (taskId: string, message: string) => void;
  onReset?: (taskId: string) => void;
  disabled?: boolean;
}

export function TaskCard({ task, completion, onComplete, onReset, disabled }: TaskCardProps) {
  const isAgent = task.type === "agent";
  const isCompleted = !!completion;

  const borderClass = isCompleted
    ? "border-green-200"
    : isAgent ? "border-blue-200" : "border-green-200";
  const shadowStyle = isCompleted
    ? "0 2px 8px rgba(0,112,60,0.08)"
    : isAgent ? "0 2px 8px rgba(29,112,184,0.08)" : "0 2px 8px rgba(0,112,60,0.08)";
  const iconBg = isCompleted
    ? "bg-green-100"
    : isAgent ? "bg-blue-100" : "bg-green-100";
  const iconColor = isCompleted
    ? "#00703c"
    : isAgent ? "#1d70b8" : "#00703c";
  const titleColor = isCompleted
    ? "text-green-700"
    : isAgent ? "text-blue-700" : "text-green-700";
  const badgeLabel = isCompleted
    ? "Done"
    : isAgent ? "Agent" : "You";

  const handleAccept = () => {
    const msg = isAgent
      ? `Yes, please go ahead — ${task.description.toLowerCase()}`
      : `I've done it — ${task.description.toLowerCase()}`;
    onComplete?.(task.id, msg);
  };

  return (
    <div
      className={`my-3 rounded-2xl ${borderClass} border bg-white transition-opacity ${isCompleted ? "opacity-80" : ""}`}
      style={{ boxShadow: shadowStyle }}
    >
      <div className="px-5 py-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
            {isCompleted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isAgent ? <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> : <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
              </svg>
            )}
          </span>
          <span className={`text-sm font-bold ${titleColor}`}>
            {badgeLabel}
          </span>
          {!isCompleted && task.dueDate && (
            <span className="text-xs font-medium text-orange-600 ml-auto">
              Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Content */}
        <p className={`text-base font-medium ${isCompleted ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
          {task.description}
        </p>
        <p className="text-sm text-govuk-dark-grey mt-1">{task.detail}</p>

        {/* Data needed tags */}
        {!isCompleted && task.dataNeeded && task.dataNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {task.dataNeeded.map((d) => (
              <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Completed state */}
        {isCompleted && (
          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
            <span className="text-sm font-medium text-green-700 truncate mr-2">
              {completion}
            </span>
            {!disabled && (
              <button
                onClick={() => onReset?.(task.id)}
                className="text-sm text-govuk-blue underline hover:no-underline shrink-0"
              >
                Change
              </button>
            )}
          </div>
        )}

        {/* Action buttons — for non-card tasks */}
        {!isCompleted && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAccept}
              disabled={disabled}
              className="text-sm font-bold text-white px-4 py-2.5 rounded-xl disabled:opacity-50"
              style={{ backgroundColor: isAgent ? "#1d70b8" : "#00703c" }}
            >
              {isAgent ? "Do this" : "Got it"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
