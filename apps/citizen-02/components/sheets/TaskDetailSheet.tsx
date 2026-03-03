"use client";

import { useAppStore, getTasks, saveTasks } from "@/lib/store";
import type { StoredTask, TimelineItem } from "@/lib/types";
import { UrgencyDot } from "../ui/UrgencyDot";
import { DEMO_TODAY } from "@/lib/types";

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const diff = target.getTime() - DEMO_TODAY.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface TaskDetailSheetProps {
  data: unknown;
}

export function TaskDetailSheet({ data }: TaskDetailSheetProps) {
  const persona = useAppStore((s) => s.persona);
  const closeBottomSheet = useAppStore((s) => s.closeBottomSheet);
  const showToast = useAppStore((s) => s.showToast);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);

  // Data can be a TimelineItem (from dashboard) or a StoredTask (from tasks view)
  const item = data as (TimelineItem & Partial<StoredTask>) | null;
  if (!item) return null;

  // Try to find the stored task if we have a persona
  const storedTask = persona
    ? getTasks(persona).find((t) => `task-${t.id}` === item.id || t.id === item.id)
    : null;

  const handleAccept = () => {
    if (!persona || !storedTask) return;
    const tasks = getTasks(persona);
    const task = tasks.find((t) => t.id === storedTask.id);
    if (task) {
      task.status = "accepted";
      task.updatedAt = new Date().toISOString();
      saveTasks(persona, tasks);
      showToast("Task accepted");
      closeBottomSheet();
    }
  };

  const handleDismiss = () => {
    if (!persona || !storedTask) return;
    const tasks = getTasks(persona);
    const task = tasks.find((t) => t.id === storedTask.id);
    if (task) {
      task.status = "dismissed";
      task.updatedAt = new Date().toISOString();
      saveTasks(persona, tasks);
      showToast("Task dismissed");
      closeBottomSheet();
    }
  };

  const handleAskAbout = () => {
    const service = item.service || storedTask?.service;
    if (service) {
      startNewConversation(service as import("@/lib/types").ServiceType);
      navigateTo("chat", service as import("@/lib/types").ServiceType);
      closeBottomSheet();
      // Send a question about this task
      setTimeout(() => {
        useAppStore.getState().sendMessage(`Tell me more about: ${item.title || item.description}`);
      }, 100);
    }
  };

  const days = item.dueDate ? daysUntil(item.dueDate) : null;

  return (
    <div className="space-y-4">
      {/* Title and urgency */}
      <div className="flex items-start gap-3">
        {item.urgency && item.urgency !== "info" && (
          <UrgencyDot urgency={item.urgency as "urgent" | "warning" | "ok"} size="md" />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-govuk-black">
            {item.title || (storedTask?.description)}
          </h3>
          {item.subtitle && (
            <p className="text-sm text-govuk-dark-grey mt-0.5">{item.subtitle}</p>
          )}
        </div>
      </div>

      {/* Metadata badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-govuk-dark-grey capitalize">
          {item.service}
        </span>
        {(item.source || storedTask?.type) && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
            (item.source === "agent" || storedTask?.type === "agent")
              ? "bg-blue-50 text-blue-700"
              : item.source === "data"
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-600"
          }`}>
            {item.source === "data" ? "data" : storedTask?.type || item.source}
          </span>
        )}
        {(item.taskStatus || storedTask?.status) && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
            (item.taskStatus === "accepted" || storedTask?.status === "accepted")
              ? "bg-green-50 text-green-700"
              : (item.taskStatus === "completed" || storedTask?.status === "completed")
                ? "bg-green-100 text-green-800"
                : "bg-yellow-50 text-yellow-700"
          }`}>
            {storedTask?.status || item.taskStatus}
          </span>
        )}
      </div>

      {/* Due date */}
      {item.dueDate && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide mb-1">Due date</p>
          <p className="text-sm text-govuk-black font-medium">{formatDate(item.dueDate)}</p>
          {days !== null && (
            <p className={`text-xs font-bold mt-0.5 ${
              days < 0 ? "text-govuk-red" :
              days < 14 ? "text-govuk-red" :
              days < 30 ? "text-govuk-orange" :
              "text-govuk-dark-grey"
            }`}>
              {item.dueLabel}
            </p>
          )}
        </div>
      )}

      {/* Detail/description */}
      {(item.detail || storedTask?.detail) && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide mb-1">What the agent will do</p>
          <p className="text-sm text-govuk-black leading-relaxed">
            {item.detail || storedTask?.detail}
          </p>
        </div>
      )}

      {/* Data needed */}
      {storedTask?.dataNeeded && storedTask.dataNeeded.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide mb-2">Data needed</p>
          <ul className="space-y-1">
            {storedTask.dataNeeded.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-govuk-black">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-govuk-mid-grey shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                {d.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={handleAskAbout}
          className="w-full py-3 rounded-full bg-govuk-blue text-white font-bold text-sm hover:bg-blue-800 transition-colors touch-feedback"
        >
          Ask about this
        </button>

        {storedTask && storedTask.status === "suggested" && (
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="flex-1 py-2.5 rounded-full bg-govuk-green text-white font-bold text-sm hover:bg-govuk-green/90 transition-colors touch-feedback"
            >
              Accept task
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-full bg-gray-100 text-govuk-dark-grey font-bold text-sm hover:bg-gray-200 transition-colors touch-feedback"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
