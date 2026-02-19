"use client";

import { useState } from "react";

interface CaseTimelineEntry {
  caseId: string;
  traceEventId: string;
  traceId?: string;
  eventType: string;
  actor: "agent" | "citizen" | "system";
  summary: string;
  createdAt: string;
  tracePayload?: Record<string, unknown>;
}

const ACTOR_STYLES: Record<string, { icon: string; label: string; color: string }> = {
  agent: { icon: "A", label: "Agent", color: "bg-blue-100 text-blue-800 border-blue-300" },
  citizen: { icon: "C", label: "Citizen", color: "bg-green-100 text-green-800 border-green-300" },
  system: { icon: "S", label: "System", color: "bg-gray-100 text-gray-600 border-gray-300" },
};

function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="mt-2 ml-11 border border-govuk-mid-grey rounded bg-gray-50 p-3">
      <div className="text-xs font-bold text-govuk-dark-grey mb-1.5">Trace event payload</div>
      <div className="space-y-1">
        {Object.entries(payload).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-xs">
            <span className="font-mono text-govuk-dark-grey min-w-[120px]">{key}:</span>
            <span className="font-mono break-all">
              {typeof value === "object" && value !== null
                ? JSON.stringify(value)
                : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineEntry({ entry }: { entry: CaseTimelineEntry }) {
  const [expanded, setExpanded] = useState(false);
  const style = ACTOR_STYLES[entry.actor] || ACTOR_STYLES.system;
  const hasPayload = entry.tracePayload && Object.keys(entry.tracePayload).length > 0;

  return (
    <div>
      <div
        className={`flex items-start gap-3 relative ${hasPayload ? "cursor-pointer" : ""}`}
        onClick={() => hasPayload && setExpanded(!expanded)}
      >
        {/* Actor icon */}
        <div
          className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 ${style.color}`}
          title={style.label}
        >
          {style.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{entry.summary}</span>
            <span className="text-xs text-govuk-dark-grey font-mono">
              {entry.eventType}
            </span>
            {hasPayload && (
              <span className="text-xs text-govuk-blue">
                {expanded ? "\u25B2" : "\u25BC"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-govuk-dark-grey">
              {new Date(entry.createdAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            {entry.traceId && (
              <span className="text-xs text-govuk-dark-grey font-mono">
                {entry.traceId}
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && entry.tracePayload && (
        <PayloadView payload={entry.tracePayload} />
      )}
    </div>
  );
}

export default function CaseTimelineView({
  timeline,
}: {
  timeline: CaseTimelineEntry[];
}) {
  if (timeline.length === 0) {
    return (
      <p className="text-sm text-govuk-dark-grey italic">No events recorded.</p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-govuk-mid-grey" />

      <div className="space-y-3">
        {timeline.map((entry, i) => (
          <TimelineEntry key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}
