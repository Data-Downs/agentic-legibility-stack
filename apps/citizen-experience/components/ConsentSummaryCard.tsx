"use client";

import type { ConsentGrant } from "@/lib/types";

interface ConsentSummaryCardProps {
  grants: ConsentGrant[];
  decisions: Record<string, "granted" | "denied">;
  onSubmit: () => void;
  onChangeDecision: (grantId: string) => void;
  hasRequiredDenials: boolean;
  isSubmitting: boolean;
}

export function ConsentSummaryCard({
  grants,
  decisions,
  onSubmit,
  onChangeDecision,
  hasRequiredDenials,
  isSubmitting,
}: ConsentSummaryCardProps) {
  const grantedCount = grants.filter((g) => decisions[g.id] === "granted").length;
  const deniedCount = grants.filter((g) => decisions[g.id] === "denied").length;

  return (
    <div
      className="my-3 rounded-lg border bg-white"
      style={{ borderLeft: "4px solid #1d70b8" }}
    >
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
            Consent Summary
          </span>
          <span className="text-[10px] text-govuk-dark-grey">
            {grantedCount} granted &middot; {deniedCount} declined
          </span>
        </div>

        <p className="text-xs text-govuk-dark-grey mb-3">
          Review your consent decisions before continuing.
        </p>

        {/* Summary rows */}
        <div className="divide-y divide-gray-100">
          {grants.map((grant) => {
            const decision = decisions[grant.id];
            const isGranted = decision === "granted";

            return (
              <div key={grant.id} className="py-2 first:pt-0 last:pb-0">
                {/* Row header: description + status + change */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-govuk-black truncate">
                      {grant.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isGranted
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isGranted ? "Granted" : "Declined"}
                    </span>
                    <button
                      onClick={() => onChangeDecision(grant.id)}
                      className="text-[10px] text-govuk-blue underline hover:no-underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Data being shared (only if granted) */}
                {isGranted && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {grant.data_shared.map((d) => (
                      <span
                        key={d}
                        className="text-[9px] bg-gray-100 text-govuk-dark-grey px-1.5 py-0.5 rounded"
                      >
                        {d.replace(/_/g, " ")}
                      </span>
                    ))}
                    <span className="text-[9px] text-govuk-dark-grey">
                      &rarr; {grant.source.replace(/-/g, " ")}
                    </span>
                  </div>
                )}

                {/* Required denial warning (inline) */}
                {!isGranted && grant.required && (
                  <p className="text-[10px] text-red-600 mt-0.5">
                    This consent is required to continue your application.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Required denials warning banner */}
        {hasRequiredDenials && (
          <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-2.5 rounded-r">
            <p className="text-xs font-bold text-yellow-800">
              Required consents declined
            </p>
            <p className="text-[10px] text-yellow-700 mt-0.5">
              You have declined one or more required consents. Your application
              cannot proceed without these. Please change your decisions above to
              continue.
            </p>
          </div>
        )}

        {/* Submit button */}
        <div className="mt-3">
          <button
            onClick={onSubmit}
            disabled={hasRequiredDenials || isSubmitting}
            className={`w-full py-2 rounded font-bold text-sm transition-colors ${
              hasRequiredDenials || isSubmitting
                ? "bg-govuk-mid-grey text-white cursor-not-allowed"
                : "bg-[#00703c] text-white hover:bg-[#005a30]"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              "Submit and continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
