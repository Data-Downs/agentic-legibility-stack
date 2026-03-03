"use client";

interface TaskSummaryCardProps {
  tasks: Array<{
    id: string;
    description: string;
    detail: string;
    type: "agent" | "user";
  }>;
  completions: Record<string, string>;
  onChangeTask: (taskId: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function TaskSummaryCard({
  tasks,
  completions,
  onChangeTask,
  onSubmit,
  isSubmitting,
}: TaskSummaryCardProps) {
  const agentTasks = tasks.filter((t) => t.type === "agent" && completions[t.id]);
  const userTasks = tasks.filter((t) => t.type === "user" && completions[t.id]);

  return (
    <div
      className="my-3 rounded-2xl bg-amber-50 shadow-sm"
    >
      <div className="px-5 py-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b58105" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </span>
          <span className="text-sm font-bold text-amber-800">
            Confirm before submitting
          </span>
        </div>

        <p className="text-sm text-govuk-black mb-1 font-medium">
          By continuing, the agent will submit information on your behalf to government services.
        </p>
        <p className="text-sm text-govuk-dark-grey mb-4">
          Please review what will happen next. You can change your choices before confirming.
        </p>

        {/* What the agent will do */}
        {agentTasks.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide mb-2">
              The agent will
            </p>
            {agentTasks.map((task) => (
              <div key={task.id} className="py-2.5 border-t border-amber-200 first:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-govuk-black">
                      {task.description}
                    </p>
                    <p className="text-xs text-govuk-dark-grey mt-0.5">
                      {completions[task.id]}
                    </p>
                  </div>
                  <button
                    onClick={() => onChangeTask(task.id)}
                    className="text-xs text-govuk-blue underline hover:no-underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* What the user confirmed */}
        {userTasks.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide mb-2">
              Your choices
            </p>
            {userTasks.map((task) => (
              <div key={task.id} className="py-2.5 border-t border-amber-200 first:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-govuk-black">
                      {task.description}
                    </p>
                    <p className="text-xs text-govuk-dark-grey mt-0.5">
                      {completions[task.id]}
                    </p>
                  </div>
                  <button
                    onClick={() => onChangeTask(task.id)}
                    className="text-xs text-govuk-blue underline hover:no-underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit button */}
        <div className="mt-4">
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`w-full py-3 rounded-full font-bold text-sm transition-colors ${
              isSubmitting
                ? "bg-govuk-mid-grey text-white cursor-not-allowed"
                : "bg-[#00703c] text-white hover:bg-[#005a30]"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              "Confirm and continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
