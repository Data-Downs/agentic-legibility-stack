"use client";

import { useState } from "react";
import { useAppStore, getTasks, saveTasks } from "@/lib/store";
import type { StoredTask } from "@/lib/types";
import { UrgencyDot } from "./ui/UrgencyDot";
import { DEMO_TODAY } from "@/lib/types";

type FilterTab = "all" | "driving" | "benefits" | "family";

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "driving", label: "Driving" },
  { id: "benefits", label: "Benefits" },
  { id: "family", label: "Family" },
];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const diff = target.getTime() - DEMO_TODAY.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  return `${Math.floor(days / 30)} months`;
}

function getUrgency(days: number): "urgent" | "warning" | "ok" {
  if (days < 14) return "urgent";
  if (days < 30) return "warning";
  return "ok";
}

export function TasksView() {
  const persona = useAppStore((s) => s.persona);
  const openBottomSheet = useAppStore((s) => s.openBottomSheet);
  const showToast = useAppStore((s) => s.showToast);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  if (!persona) return null;

  const allTasks = getTasks(persona);
  const activeTasks = allTasks.filter(
    (t) => t.status !== "completed" && t.status !== "dismissed"
  );
  const completedTasks = allTasks.filter(
    (t) => t.status === "completed" || t.status === "dismissed"
  );

  const filterTasks = (tasks: StoredTask[]) =>
    activeFilter === "all"
      ? tasks
      : tasks.filter((t) => t.service === activeFilter);

  const filteredActive = filterTasks(activeTasks).sort((a, b) => {
    const aDays = a.dueDate ? daysUntil(a.dueDate) : 999;
    const bDays = b.dueDate ? daysUntil(b.dueDate) : 999;
    return aDays - bDays;
  });

  const filteredCompleted = filterTasks(completedTasks);

  const handleDismiss = (taskId: string) => {
    const tasks = getTasks(persona);
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = "dismissed";
      task.updatedAt = new Date().toISOString();
      saveTasks(persona, tasks);
      showToast("Task dismissed");
    }
  };

  const handleAccept = (taskId: string) => {
    const tasks = getTasks(persona);
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = "accepted";
      task.updatedAt = new Date().toISOString();
      saveTasks(persona, tasks);
      showToast("Task accepted");
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-20">
      <h2 className="text-2xl font-bold text-govuk-black mb-4">To do</h2>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors touch-feedback ${
              activeFilter === f.id
                ? "bg-govuk-blue text-white"
                : "bg-white text-govuk-dark-grey shadow-sm hover:shadow-md"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Active tasks */}
      {filteredActive.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-base font-extrabold text-govuk-black mb-3">
            Active ({filteredActive.length})
          </h3>
          <div className="bg-white rounded-card shadow-sm divide-y divide-gray-100">
            {filteredActive.map((task) => {
              const days = task.dueDate ? daysUntil(task.dueDate) : null;
              return (
                <div
                  key={task.id}
                  className="p-3.5"
                >
                  <button
                    onClick={() => openBottomSheet("task-detail", task)}
                    className="flex items-start gap-3 w-full text-left touch-feedback"
                  >
                    {days !== null && (
                      <UrgencyDot urgency={getUrgency(days)} size="md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-govuk-black">
                        {task.description}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-govuk-dark-grey mt-0.5">
                        <span className="capitalize">{task.service}</span>
                        <span>&middot;</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          task.type === "agent"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {task.type}
                        </span>
                        <span>&middot;</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          task.status === "accepted"
                            ? "bg-green-50 text-green-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}>
                          {task.status}
                        </span>
                      </span>
                    </div>
                    {days !== null && (
                      <span className={`text-xs font-bold shrink-0 ${
                        days < 0 ? "text-govuk-red" :
                        days < 14 ? "text-govuk-red" :
                        days < 30 ? "text-govuk-orange" :
                        "text-govuk-dark-grey"
                      }`}>
                        {formatDueLabel(days)}
                      </span>
                    )}
                  </button>

                  {/* Action buttons for suggested tasks */}
                  {task.status === "suggested" && (
                    <div className="flex items-center gap-2 mt-2 ml-8">
                      <button
                        onClick={() => handleAccept(task.id)}
                        className="px-3 py-1 rounded-full bg-govuk-green text-white text-xs font-bold hover:bg-govuk-green/90 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDismiss(task.id)}
                        className="px-3 py-1 rounded-full bg-gray-100 text-govuk-dark-grey text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-govuk-dark-grey">
          <svg
            className="mx-auto mb-3 opacity-40"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <p className="text-sm">No active tasks</p>
        </div>
      )}

      {/* Completed tasks */}
      {filteredCompleted.length > 0 && (
        <div>
          <h3 className="text-base font-extrabold text-govuk-black mb-3">
            Completed ({filteredCompleted.length})
          </h3>
          <div className="bg-white rounded-card shadow-sm divide-y divide-gray-100 opacity-60">
            {filteredCompleted.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3.5"
              >
                <span className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm text-govuk-dark-grey line-through">
                    {task.description}
                  </span>
                  <span className="text-xs text-govuk-mid-grey capitalize">{task.service}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
