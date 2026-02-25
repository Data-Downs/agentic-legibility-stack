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
    <div className={`px-5 py-4 ${decision === "denied" ? "opacity-60" : ""}`}>
      {/* Description + required badge */}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-base font-medium ${decision === "denied" ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
          {grant.description}
        </p>
        {grant.required && (
          <span className="text-xs text-red-600 font-medium whitespace-nowrap shrink-0 mt-0.5">
            Required
          </span>
        )}
      </div>
      <p className="text-sm text-govuk-dark-grey mt-1">{grant.purpose}</p>

      {/* Data tags */}
      <div className="mt-3">
        <p className="text-xs font-bold uppercase text-govuk-dark-grey mb-1.5">Data to be shared:</p>
        <div className="flex flex-wrap gap-1.5">
          {grant.data_shared.map((d) => (
            <span
              key={d}
              className={`text-xs px-2 py-0.5 rounded-lg ${
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
      <p className="text-xs text-govuk-dark-grey mt-2">
        Source: <span className="font-medium">{grant.source.replace(/-/g, " ")}</span>
        {grant.duration && <> &middot; Duration: {grant.duration.replace(/-/g, " ")}</>}
      </p>

      {/* Decision controls */}
      <div className="flex items-center gap-2.5 mt-3">
        <button
          onClick={() => onDecision(grant.id, "granted")}
          disabled={disabled}
          className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
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
          className={`text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
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
      className="my-3 rounded-2xl border border-purple-200 bg-white"
      style={{ boxShadow: "0 2px 8px rgba(145,43,136,0.08)" }}
    >
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#912b88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </span>
          <span className="text-sm font-bold text-purple-700">
            Consent Required
          </span>
        </div>
        <p className="text-sm text-govuk-dark-grey mt-2 ml-[38px]">
          Review and grant consent for your application.
        </p>
      </div>

      {/* Grant rows */}
      <div className="space-y-0">
        {grants.map((grant, idx) => (
          <div key={grant.id}>
            {idx > 0 && <div className="border-t border-gray-200 mx-5" />}
            <GrantRow
              grant={grant}
              decision={decisions[grant.id]}
              onDecision={onDecision}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      {/* All reviewed hint */}
      {allDecided && (
        <div className="px-5 pb-4 pt-1">
          <p className="text-sm text-govuk-dark-grey text-center">
            All consents reviewed — check the summary below.
          </p>
        </div>
      )}
    </div>
  );
}
