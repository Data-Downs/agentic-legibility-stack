"use client";

import { useState } from "react";

interface ServiceAccessGrant {
  id: string;
  serviceId: string;
  fieldKey: string;
  dataTier: string;
  purpose?: string;
  grantedAt: string;
  revokedAt?: string;
}

const SERVICE_LABELS: Record<string, string> = {
  "dvla.renew-driving-licence": "DVLA - Renew Driving Licence",
  "dwp.apply-universal-credit": "DWP - Universal Credit",
  "dwp.check-state-pension": "DWP - State Pension",
  "hmrc.check-tax": "HMRC - Check Tax",
};

export function AccessControlSection({
  accessMap,
  personaId,
  onRefresh,
}: {
  accessMap: Record<string, ServiceAccessGrant[]>;
  personaId: string;
  onRefresh: () => void;
}) {
  const [view, setView] = useState<"by-service" | "by-field">("by-service");
  const [revoking, setRevoking] = useState<string | null>(null);

  const revokeAccess = async (opts: { grantId?: string; serviceId?: string; fieldKey?: string }) => {
    const key = opts.grantId || opts.serviceId || opts.fieldKey || "";
    setRevoking(key);
    try {
      const res = await fetch(`/api/personal-data/${personaId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error("Revoke error:", error);
    } finally {
      setRevoking(null);
    }
  };

  const services = Object.keys(accessMap);
  const hasAccess = services.length > 0;

  // Build field-centric view
  const byField: Record<string, { serviceId: string; grant: ServiceAccessGrant }[]> = {};
  for (const [serviceId, grants] of Object.entries(accessMap)) {
    for (const grant of grants) {
      if (!byField[grant.fieldKey]) byField[grant.fieldKey] = [];
      byField[grant.fieldKey].push({ serviceId, grant });
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4351c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <h3 className="font-bold text-sm">Data access control</h3>
      </div>

      {!hasAccess ? (
        <p className="text-sm text-govuk-dark-grey italic">
          No services currently have access to your data.
        </p>
      ) : (
        <>
          {/* View toggle */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("by-service")}
              className={`flex-1 text-xs py-1.5 rounded-md transition-all ${
                view === "by-service" ? "bg-white shadow-sm font-bold" : "text-govuk-dark-grey"
              }`}
            >
              By service
            </button>
            <button
              onClick={() => setView("by-field")}
              className={`flex-1 text-xs py-1.5 rounded-md transition-all ${
                view === "by-field" ? "bg-white shadow-sm font-bold" : "text-govuk-dark-grey"
              }`}
            >
              By field
            </button>
          </div>

          {view === "by-service" ? (
            <div className="space-y-3">
              {services.map((serviceId) => {
                const grants = accessMap[serviceId];
                return (
                  <div key={serviceId} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {SERVICE_LABELS[serviceId] || serviceId}
                      </span>
                      <button
                        onClick={() => revokeAccess({ serviceId })}
                        disabled={revoking === serviceId}
                        className="text-xs text-govuk-red underline"
                      >
                        {revoking === serviceId ? "Revoking..." : "Revoke all"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {grants.map((g) => (
                        <span
                          key={g.id}
                          className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded"
                        >
                          {g.fieldKey.replace(/_/g, " ")}
                          <button
                            onClick={() => revokeAccess({ grantId: g.id })}
                            disabled={revoking === g.id}
                            className="text-govuk-dark-grey hover:text-govuk-red"
                            aria-label={`Revoke ${g.fieldKey}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(byField).map(([fieldKey, entries]) => (
                <div key={fieldKey} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <span className="text-sm font-medium">{fieldKey.replace(/_/g, " ")}</span>
                    <span className="text-xs text-govuk-dark-grey ml-2">
                      ({entries.length} service{entries.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <button
                    onClick={() => revokeAccess({ fieldKey })}
                    disabled={revoking === fieldKey}
                    className="text-xs text-govuk-red underline"
                  >
                    {revoking === fieldKey ? "..." : "Revoke all"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
