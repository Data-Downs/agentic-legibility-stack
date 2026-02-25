"use client";

import type { ConsentGrant } from "@/lib/types";

interface ConsentPanelProps {
  grants: ConsentGrant[];
  decisions: Record<string, "granted" | "denied">;
  onDecision: (grantId: string, decision: "granted" | "denied") => void;
  disabled?: boolean;
}

function GrantRow({
  grant,
  decision,
  onDecision,
  disabled,
}: {
  grant: ConsentGrant;
  decision?: "granted" | "denied";
  onDecision: (grantId: string, decision: "granted" | "denied") => void;
  disabled?: boolean;
}) {
  return (
    <div className={`px-3 py-3 ${decision === "denied" ? "opacity-60" : ""}`}>
      {/* Description + required badge */}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${decision === "denied" ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
          {grant.description}
        </p>
        {grant.required && (
          <span className="text-[10px] text-red-600 font-medium whitespace-nowrap shrink-0 mt-0.5">
            Required
          </span>
        )}
      </div>
      <p className="text-xs text-govuk-dark-grey mt-0.5">{grant.purpose}</p>

      {/* Data tags */}
      <div className="mt-2">
        <p className="text-[10px] font-bold uppercase text-govuk-dark-grey mb-1">Data to be shared:</p>
        <div className="flex flex-wrap gap-1">
          {grant.data_shared.map((d) => (
            <span
              key={d}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                decision === "denied"
                  ? "bg-gray-100 text-gray-500"
                  : "bg-purple-50 text-purple-700"
              }`}
            >
              {d.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>

      {/* Source + duration */}
      <p className="text-[10px] text-govuk-dark-grey mt-1.5">
        Source: <span className="font-medium">{grant.source.replace(/-/g, " ")}</span>
        {grant.duration && <> &middot; Duration: {grant.duration.replace(/-/g, " ")}</>}
      </p>

      {/* Decision controls */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => onDecision(grant.id, "granted")}
          disabled={disabled}
          className={`text-xs font-bold px-3 py-1 rounded transition-colors disabled:opacity-50 ${
            decision === "granted"
              ? "bg-[#912b88] text-white"
              : "border border-govuk-mid-grey text-govuk-dark-grey hover:bg-purple-50"
          }`}
        >
          {decision === "granted" && (
            <svg className="inline -mt-0.5 mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          I agree
        </button>
        <button
          onClick={() => onDecision(grant.id, "denied")}
          disabled={disabled}
          className={`text-xs font-medium px-3 py-1 rounded transition-colors disabled:opacity-50 ${
            decision === "denied"
              ? "bg-gray-200 text-govuk-dark-grey"
              : "border border-govuk-mid-grey text-govuk-dark-grey hover:bg-gray-50"
          }`}
        >
          No thanks
        </button>
      </div>
    </div>
  );
}

export function ConsentPanel({
  grants,
  decisions,
  onDecision,
  disabled,
}: ConsentPanelProps) {
  const allDecided = grants.length > 0 && grants.every((g) => decisions[g.id] !== undefined);

  return (
    <div
      className="my-2 rounded-lg border bg-white"
      style={{ borderLeft: "4px solid #912b88" }}
    >
      {/* Panel header */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
          Consent Required
        </span>
        <p className="text-xs text-govuk-dark-grey mt-1">
          Review and grant consent for your application.
        </p>
      </div>

      {/* Grant rows */}
      <div className="divide-y divide-gray-100">
        {grants.map((grant) => (
          <GrantRow
            key={grant.id}
            grant={grant}
            decision={decisions[grant.id]}
            onDecision={onDecision}
            disabled={disabled}
          />
        ))}
      </div>

      {/* All reviewed hint */}
      {allDecided && (
        <div className="px-3 pb-3 pt-1">
          <p className="text-xs text-govuk-dark-grey text-center">
            All consents reviewed — check the summary below.
          </p>
        </div>
      )}
    </div>
  );
}
