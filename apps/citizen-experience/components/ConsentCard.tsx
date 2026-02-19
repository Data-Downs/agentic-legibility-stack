"use client";

import type { ConsentGrant } from "@/lib/types";

interface ConsentCardProps {
  grant: ConsentGrant;
  decision?: "granted" | "denied";
  onDecision?: (grantId: string, decision: "granted" | "denied") => void;
  onReset?: (grantId: string) => void;
  disabled?: boolean;
}

export function ConsentCard({ grant, decision, onDecision, onReset, disabled }: ConsentCardProps) {
  const borderColor = decision === "granted"
    ? "#00703c"
    : decision === "denied"
      ? "#b1b4b6"
      : "#912b88";

  const badgeBg = decision === "granted"
    ? "bg-green-100 text-green-800"
    : decision === "denied"
      ? "bg-gray-100 text-gray-600"
      : "bg-purple-100 text-purple-800";

  const badgeText = decision === "granted"
    ? "Consent Granted"
    : decision === "denied"
      ? "Declined"
      : "Consent Required";

  return (
    <div
      className={`my-2 rounded-lg border bg-white ${decision === "denied" ? "opacity-60" : ""}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeBg}`}>
            {badgeText}
          </span>
          {!decision && grant.required && (
            <span className="text-[10px] text-red-600 font-medium">Required</span>
          )}
          {decision === "granted" && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00703c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Description */}
        <p className={`text-sm font-medium ${decision === "denied" ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
          {grant.description}
        </p>
        <p className="text-xs text-govuk-dark-grey mt-0.5">{grant.purpose}</p>

        {/* Data that will be shared */}
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

        {/* Source */}
        <p className="text-[10px] text-govuk-dark-grey mt-1.5">
          Source: <span className="font-medium">{grant.source.replace(/-/g, " ")}</span>
          {grant.duration && <> &middot; Duration: {grant.duration.replace(/-/g, " ")}</>}
        </p>

        {/* Pending — show action buttons */}
        {!decision && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onDecision?.(grant.id, "granted")}
              disabled={disabled}
              className="text-xs font-bold text-white px-3 py-1 rounded disabled:opacity-50"
              style={{ backgroundColor: "#912b88" }}
            >
              I agree
            </button>
            <button
              onClick={() => onDecision?.(grant.id, "denied")}
              disabled={disabled}
              className="text-xs font-medium text-govuk-dark-grey px-3 py-1 rounded border border-govuk-mid-grey hover:bg-gray-50 disabled:opacity-50"
            >
              No thanks
            </button>
          </div>
        )}

        {/* Granted or Denied — show Change link */}
        {decision && !disabled && (
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs font-medium ${
              decision === "granted" ? "text-green-700" : "text-govuk-dark-grey"
            }`}>
              {decision === "granted" ? "You agreed to share this data" : "You declined this consent"}
            </span>
            <button
              onClick={() => onReset?.(grant.id)}
              className="text-xs text-govuk-blue underline hover:no-underline"
            >
              Change
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
