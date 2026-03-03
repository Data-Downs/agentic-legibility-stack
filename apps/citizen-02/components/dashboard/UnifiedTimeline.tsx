"use client";

import type { PersonaData, TimelineItem, StoredTask } from "@/lib/types";
import { DEMO_TODAY } from "@/lib/types";
import { getTasks } from "@/lib/store";
import { UrgencyDot } from "../ui/UrgencyDot";
import { LiveBadge } from "../ui/LiveBadge";

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

function getUrgency(days: number): TimelineItem["urgency"] {
  if (days < 0) return "urgent";
  if (days < 14) return "urgent";
  if (days < 30) return "warning";
  return "ok";
}

export function buildTimelineItems(
  personaData: PersonaData,
  persona: string | null,
  filterService?: string,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Vehicle dates
  if (personaData.vehicles) {
    for (const v of personaData.vehicles) {
      if (v.motExpiry) {
        const days = daysUntil(v.motExpiry);
        if (days > -30 && days < 180) {
          items.push({
            id: `mot-${v.registrationNumber}`,
            title: `MOT due — ${v.make} ${v.model}`,
            subtitle: v.registrationNumber,
            daysUntil: days,
            dueLabel: formatDueLabel(days),
            urgency: getUrgency(days),
            service: "driving",
            source: "data",
            dueDate: v.motExpiry,
          });
        }
      }
      if (v.taxExpiry) {
        const days = daysUntil(v.taxExpiry);
        if (days > -30 && days < 180) {
          items.push({
            id: `tax-${v.registrationNumber}`,
            title: `Road tax due — ${v.make} ${v.model}`,
            daysUntil: days,
            dueLabel: formatDueLabel(days),
            urgency: getUrgency(days),
            service: "driving",
            source: "data",
            dueDate: v.taxExpiry,
          });
        }
      }
    }
  }

  // Pregnancy
  if (personaData.pregnancy?.dueDate) {
    const days = daysUntil(personaData.pregnancy.dueDate);
    if (days > 0) {
      items.push({
        id: "baby-due",
        title: "Baby due date",
        subtitle: personaData.pregnancy.hospital,
        daysUntil: days,
        dueLabel: formatDueLabel(days),
        urgency: days < 60 ? "warning" : "ok",
        service: "family",
        source: "data",
        dueDate: personaData.pregnancy.dueDate,
      });
    }
  }

  // Agent/user tasks from localStorage
  if (persona) {
    const storedTasks = getTasks(persona);
    for (const task of storedTasks) {
      if (task.status === "dismissed" || task.status === "completed") continue;
      const days = task.dueDate ? daysUntil(task.dueDate) : 999;
      items.push({
        id: `task-${task.id}`,
        title: task.description,
        detail: task.detail,
        daysUntil: days,
        dueLabel: task.dueDate ? formatDueLabel(days) : "",
        urgency: task.dueDate ? getUrgency(days) : "info",
        service: task.service,
        source: task.type === "agent" ? "agent" : "user",
        taskStatus: task.status,
        taskType: task.type,
        dueDate: task.dueDate || undefined,
      });
    }
  }

  // Sort by urgency (most urgent first)
  items.sort((a, b) => a.daysUntil - b.daysUntil);

  // Filter by service if provided
  if (filterService) {
    return items.filter((item) => item.service === filterService);
  }

  return items;
}

interface UnifiedTimelineProps {
  personaData: PersonaData;
  persona: string | null;
  maxItems?: number;
  filterService?: string;
  onItemTap?: (item: TimelineItem) => void;
  onSeeAll?: () => void;
}

export function UnifiedTimeline({
  personaData,
  persona,
  maxItems = 6,
  filterService,
  onItemTap,
  onSeeAll,
}: UnifiedTimelineProps) {
  const items = buildTimelineItems(personaData, persona, filterService);
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-extrabold text-govuk-black">To do</h3>
        {items.length > maxItems && onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-sm text-govuk-blue font-medium"
          >
            See all ({items.length})
          </button>
        )}
      </div>

      <div className="bg-white rounded-card shadow-sm divide-y divide-gray-100">
        {displayItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemTap?.(item)}
            className="flex items-center gap-3 w-full p-3.5 text-left hover:bg-gray-50 transition-colors touch-feedback first:rounded-t-card last:rounded-b-card"
          >
            <UrgencyDot urgency={item.urgency} size="md" />
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-govuk-black truncate">
                {item.title}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-govuk-dark-grey">
                <span className="capitalize">{item.service}</span>
                {item.source !== "data" && (
                  <>
                    <span>&middot;</span>
                    <span className="capitalize">{item.source}</span>
                  </>
                )}
                {item.isLive && <LiveBadge />}
              </span>
            </div>
            <span className={`text-xs font-bold shrink-0 ${
              item.urgency === "urgent" ? "text-govuk-red" :
              item.urgency === "warning" ? "text-govuk-orange" :
              "text-govuk-dark-grey"
            }`}>
              {item.dueLabel}
            </span>
            <svg
              className="shrink-0 text-govuk-mid-grey"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
