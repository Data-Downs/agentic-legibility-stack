"use client";

interface TaskSummaryCardProps {
  tasks: Array<{
    id: string;
    description: string;
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
  const completedCount = tasks.filter((t) => completions[t.id]).length;

  return (
    <div
      className="my-3 rounded-2xl border border-blue-200 bg-white"
      style={{ boxShadow: "0 2px 8px rgba(29,112,184,0.08)" }}
    >
      <div className="px-5 py-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d70b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </span>
          <span className="text-sm font-bold text-blue-700">
            Ready to submit
          </span>
          <span className="text-xs text-govuk-dark-grey ml-auto">
            {completedCount} {completedCount === 1 ? "item" : "items"} completed
          </span>
        </div>

        <p className="text-sm text-govuk-dark-grey mb-4">
          Review your details before submitting.
        </p>

        {/* Summary rows */}
        <div className="space-y-0">
          {tasks.map((task) => {
            const completion = completions[task.id];
            if (!completion) return null;

            const isAgent = task.type === "agent";

            return (
              <div key={task.id} className="py-3 border-t border-gray-200 first:border-t-0 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-govuk-black truncate">
                      {task.description}
                    </p>
                    <p className="text-xs text-govuk-dark-grey mt-0.5 truncate">
                      {completion}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                        isAgent
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {isAgent ? "Agent" : "You"}
                    </span>
                    <button
                      onClick={() => onChangeTask(task.id)}
                      className="text-xs text-govuk-blue underline hover:no-underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit button */}
        <div className="mt-4">
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
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
              "Submit all details"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
