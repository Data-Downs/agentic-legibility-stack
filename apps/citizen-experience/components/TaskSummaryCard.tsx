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
      className="my-3 rounded-lg border bg-white"
      style={{ borderLeft: "4px solid #1d70b8" }}
    >
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
            Ready to submit
          </span>
          <span className="text-[10px] text-govuk-dark-grey">
            {completedCount} {completedCount === 1 ? "item" : "items"} completed
          </span>
        </div>

        <p className="text-xs text-govuk-dark-grey mb-3">
          Review your details before submitting.
        </p>

        {/* Summary rows */}
        <div className="divide-y divide-gray-100">
          {tasks.map((task) => {
            const completion = completions[task.id];
            if (!completion) return null;

            const isAgent = task.type === "agent";

            return (
              <div key={task.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-govuk-black truncate">
                      {task.description}
                    </p>
                    <p className="text-[10px] text-govuk-dark-grey mt-0.5 truncate">
                      {completion}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isAgent
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {isAgent ? "Agent" : "You"}
                    </span>
                    <button
                      onClick={() => onChangeTask(task.id)}
                      className="text-[10px] text-govuk-blue underline hover:no-underline"
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
        <div className="mt-3">
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`w-full py-2 rounded font-bold text-sm transition-colors ${
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
