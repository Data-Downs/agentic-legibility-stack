"use client";

import { useState } from "react";

interface TaskCardProps {
  task: {
    id: string;
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string | null;
    dataNeeded?: string[];
  };
  onAccept?: (taskId: string) => void;
  onDismiss?: (taskId: string) => void;
}

export function TaskCard({ task, onAccept, onDismiss }: TaskCardProps) {
  const [status, setStatus] = useState<"suggested" | "accepted" | "dismissed">("suggested");

  const isAgent = task.type === "agent";
  const borderColor = isAgent ? "#1d70b8" : "#00703c";
  const badgeBg = isAgent ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
  const badgeLabel = isAgent ? "Agent" : "You";
  const acceptLabel = isAgent ? "Do this" : "Got it";

  if (status === "dismissed") return null;

  return (
    <div
      className={`my-2 rounded-lg border bg-white transition-opacity ${status === "accepted" ? "opacity-70" : ""}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeBg}`}>
            {badgeLabel}
          </span>
          {task.dueDate && (
            <span className="text-[10px] font-medium text-orange-600">
              Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-sm font-medium text-govuk-black">{task.description}</p>
        <p className="text-xs text-govuk-dark-grey mt-0.5">{task.detail}</p>

        {/* Data needed */}
        {task.dataNeeded && task.dataNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {task.dataNeeded.map((d) => (
              <span key={d} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        {status === "suggested" && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setStatus("accepted");
                onAccept?.(task.id);
              }}
              className="text-xs font-bold text-white px-3 py-1 rounded"
              style={{ backgroundColor: borderColor }}
            >
              {acceptLabel}
            </button>
            <button
              onClick={() => {
                setStatus("dismissed");
                onDismiss?.(task.id);
              }}
              className="text-xs font-medium text-govuk-dark-grey px-3 py-1 rounded border border-govuk-mid-grey hover:bg-gray-50"
            >
              Dismiss
            </button>
          </div>
        )}

        {status === "accepted" && (
          <div className="mt-2">
            <span className="text-xs font-medium text-green-700">Accepted</span>
          </div>
        )}
      </div>
    </div>
  );
}
