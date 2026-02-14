"use client";

import { useState } from "react";

interface TraceEvent {
  id: string;
  traceId: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface Receipt {
  id: string;
  capabilityId: string;
  timestamp: string;
  action: string;
  outcome: string;
  details: Record<string, unknown>;
}

interface TraceExplorerProps {
  events: TraceEvent[];
  receipts: Receipt[];
  onSelectEvent?: (event: TraceEvent) => void;
}

const typeColors: Record<string, string> = {
  "llm.request": "bg-purple-100 text-purple-800",
  "llm.response": "bg-purple-100 text-purple-800",
  "capability.invoked": "bg-blue-100 text-blue-800",
  "capability.result": "bg-blue-100 text-blue-800",
  "policy.evaluated": "bg-indigo-100 text-indigo-800",
  "consent.requested": "bg-yellow-100 text-yellow-800",
  "consent.granted": "bg-green-100 text-green-800",
  "consent.denied": "bg-red-100 text-red-800",
  "consent.revoked": "bg-orange-100 text-orange-800",
  "credential.requested": "bg-cyan-100 text-cyan-800",
  "credential.presented": "bg-cyan-100 text-cyan-800",
  "receipt.issued": "bg-emerald-100 text-emerald-800",
  "state.transition": "bg-teal-100 text-teal-800",
  "handoff.initiated": "bg-amber-100 text-amber-800",
  "error.raised": "bg-red-100 text-red-800",
};

export default function TraceExplorer({ events, receipts, onSelectEvent }: TraceExplorerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const eventTypes = Array.from(new Set(events.map((e) => e.type)));

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs px-2 py-1 rounded border ${
            filter === "all" ? "bg-govuk-blue text-white border-govuk-blue" : "border-govuk-mid-grey"
          }`}
        >
          All ({events.length})
        </button>
        {eventTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`text-xs px-2 py-1 rounded border ${
              filter === type ? "bg-govuk-blue text-white border-govuk-blue" : "border-govuk-mid-grey"
            }`}
          >
            {type} ({events.filter((e) => e.type === type).length})
          </button>
        ))}
      </div>

      {/* Summary row */}
      <div className="flex gap-4 mb-4 text-sm text-govuk-dark-grey">
        <span>{events.length} events</span>
        <span>{receipts.length} receipts</span>
        <span>{eventTypes.length} event types</span>
      </div>

      {/* Events list */}
      <div className="space-y-1">
        {filtered.map((event, idx) => {
          const isExpanded = expandedId === event.id;
          return (
            <div
              key={event.id}
              className={`border rounded transition-colors ${
                isExpanded ? "border-govuk-blue bg-blue-50" : "border-govuk-mid-grey hover:border-govuk-blue"
              }`}
            >
              <button
                onClick={() => {
                  setExpandedId(isExpanded ? null : event.id);
                  onSelectEvent?.(event);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-3"
              >
                <span className="text-xs text-govuk-dark-grey w-6 text-right">{idx + 1}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${typeColors[event.type] || "bg-gray-100"}`}>
                  {event.type}
                </span>
                <span className="text-xs text-govuk-dark-grey ml-auto">
                  {new Date(event.timestamp).toLocaleTimeString("en-GB", { hour12: false, fractionalSecondDigits: 3 })}
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-200">
                  <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded mt-2 overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                  <div className="text-xs text-govuk-dark-grey mt-2 font-mono">
                    ID: {event.id} | Trace: {event.traceId}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
