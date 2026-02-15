"use client";

import { useState, useEffect, useCallback } from "react";

interface Service {
  id: string;
  name: string;
  department: string;
  description: string;
  hasPolicy: boolean;
  hasStateModel: boolean;
  hasConsent: boolean;
  promoted: boolean;
  completeness: number;
  gapCount: number;
}

/** Built-in services that always appear on the citizen Dashboard */
const BUILT_IN_SERVICE_IDS = new Set([
  "dvla.renew-driving-licence",
  "dwp.apply-universal-credit",
  "dwp.check-state-pension",
]);

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        setServices(data.services || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const togglePromote = useCallback(async (serviceId: string) => {
    setTogglingId(serviceId);
    // Optimistic update
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, promoted: !s.promoted } : s))
    );
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/promote`, {
        method: "POST",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error(`[Promote] FAILED for ${serviceId}: ${res.status}`, errBody);
        // Revert on failure
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? { ...s, promoted: !s.promoted } : s))
        );
      } else {
        const result = await res.json().catch(() => ({}));
        console.log(`[Promote] OK for ${serviceId}:`, result);
      }
    } catch (err) {
      console.error(`[Promote] Network error for ${serviceId}:`, err);
      // Revert on error
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, promoted: !s.promoted } : s))
      );
    } finally {
      setTogglingId(null);
    }
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-govuk-dark-grey">Loading services...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">Services</h1>
        <a
          href="/services/new"
          className="bg-green-700 text-white px-4 py-2 rounded font-bold text-sm hover:bg-green-800 no-underline"
        >
          + Create new service
        </a>
      </div>
      <p className="text-govuk-dark-grey mb-6">
        {services.length} service(s) registered in the Agentic Legibility Stack.
      </p>

      <div className="space-y-4">
        {services.map((service) => (
          <div
            key={service.id}
            className="border border-govuk-mid-grey hover:border-govuk-blue transition-colors"
          >
            <a
              href={`/services/${encodeURIComponent(service.id)}`}
              className="block p-5 no-underline text-inherit"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{service.name}</h2>
                  <p className="text-sm text-govuk-dark-grey mt-1">{service.department}</p>
                  <p className="text-sm mt-2">{service.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{service.completeness}%</div>
                  <div className="text-xs text-govuk-dark-grey">complete</div>
                  {service.gapCount > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      {service.gapCount} gap(s)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  Manifest
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    service.hasPolicy
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Policy {service.hasPolicy ? "" : "(missing)"}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    service.hasStateModel
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  State Model {service.hasStateModel ? "" : "(missing)"}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    service.hasConsent
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Consent {service.hasConsent ? "" : "(missing)"}
                </span>
              </div>
            </a>

            {/* Promote toggle bar */}
            <div className="border-t border-govuk-mid-grey px-5 py-3 flex items-center justify-between bg-gray-50">
              {BUILT_IN_SERVICE_IDS.has(service.id) ? (
                <span className="text-sm text-govuk-dark-grey">
                  <span className="text-blue-700 font-medium">Built-in</span> — always visible on citizen dashboard
                </span>
              ) : (
                <>
                  <span className="text-sm text-govuk-dark-grey">
                    {service.promoted ? (
                      <span className="text-green-700 font-medium">Promoted on citizen dashboard</span>
                    ) : (
                      "Not promoted"
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      togglePromote(service.id);
                    }}
                    disabled={togglingId === service.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                      service.promoted ? "bg-green-600" : "bg-gray-300"
                    } ${togglingId === service.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                    aria-label={`${service.promoted ? "Remove" : "Add"} ${service.name} from citizen dashboard`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        service.promoted ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
