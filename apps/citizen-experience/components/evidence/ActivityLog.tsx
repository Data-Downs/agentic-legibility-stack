"use client";

interface TraceEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface ActivityLogProps {
  events: TraceEvent[];
}

const eventLabels: Record<string, string> = {
  "llm.request": "Agent thinking",
  "llm.response": "Agent responded",
  "capability.invoked": "Service called",
  "capability.result": "Service responded",
  "policy.evaluated": "Eligibility checked",
  "consent.requested": "Consent requested",
  "consent.granted": "Consent given",
  "consent.denied": "Consent denied",
  "credential.requested": "Credential requested",
  "credential.presented": "Credential shared",
  "receipt.issued": "Receipt issued",
  "state.transition": "State changed",
  "handoff.initiated": "Handoff started",
  "error.raised": "Error occurred",
};

const eventIcons: Record<string, string> = {
  "llm.request": "&#9679;",
  "llm.response": "&#9679;",
  "capability.invoked": "&#9654;",
  "capability.result": "&#9632;",
  "consent.granted": "&#10003;",
  "consent.denied": "&#10007;",
  "receipt.issued": "&#9733;",
  "handoff.initiated": "&#9888;",
  "error.raised": "&#9888;",
};

export default function ActivityLog({ events }: ActivityLogProps) {
  if (events.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center">
        <p className="text-gray-400">No activity recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-3">
        Activity Log
      </h3>
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
        {events.map((event) => (
          <div key={event.id} className="relative pl-8 py-2">
            <div
              className="absolute left-1.5 top-3 w-3 h-3 bg-white border-2 border-govuk-blue rounded-full"
              dangerouslySetInnerHTML={{
                __html: eventIcons[event.type] || "&#9679;",
              }}
              style={{ fontSize: "8px", lineHeight: "12px", textAlign: "center" }}
            />
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-medium">
                {eventLabels[event.type] || event.type}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(event.timestamp).toLocaleTimeString("en-GB")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
